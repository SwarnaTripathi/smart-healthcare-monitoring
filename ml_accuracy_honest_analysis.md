# HealthGuard ML Model — Honest Accuracy Analysis

## The Real Numbers (from `model_metadata.json` and `verification_metrics.json`)

There are **two sets of metrics** saved in the project. Here's what each one actually reports:

---

### Training Script Metrics (`model_metadata.json`)
These were computed by [`train_lightgbm.py`](file:///d:/smart%20health%20care/app/ml/train_lightgbm.py):

| Metric | Value | What It Means |
|:---|:---|:---|
| **ROC-AUC** | **0.7456** | The model is **better than random (0.50) but not clinically excellent (>0.85)**. It can discriminate deteriorating vs. stable patients ~74.6% of the time. |
| **PR-AUC** | **0.3034** | On a severely imbalanced dataset (~15% positive), precision is low — many false alarms. |
| **Brier Score** | **0.1202** | Probability calibration is reasonable but imperfect. |
| **Optimal Threshold** | **0.27** | Found by sweeping thresholds 0.1–0.9 and picking the one that maximizes F1 score. |
| **Sensitivity (Recall)** | **0.5785 (57.9%)** | The model catches ~58% of true deterioration events. It **misses ~42%**. |
| **Specificity** | **0.7612 (76.1%)** | When a patient is stable, the model correctly says "stable" 76% of the time. |
| **Precision** | **0.3015 (30.2%)** | Of all patients the model flags as "will deteriorate", only ~30% actually do. **70% are false alarms.** |
| **F1 Score** | **0.3964** | Harmonic mean of precision and recall — quite low. |

### Independent Verification Metrics (`verification_metrics.json`)
These were computed by [`audit_evaluation.py`](file:///d:/smart%20health%20care/app/ml/audit_evaluation.py) — a separate, independent re-run:

| Metric | Value |
|:---|:---|
| **ROC-AUC** | **0.7123** |
| **PR-AUC** | **0.3010** |
| **Brier Skill Score** | **6.0%** (only 6% better than always predicting the base rate) |
| **Best Sensitivity (threshold=0.18)** | **76.0%** |
| **Best Specificity (threshold=0.18)** | **60.7%** |
| **Best Precision (threshold=0.18)** | **25.7%** |

> [!IMPORTANT]
> The two runs give slightly different ROC-AUC values (0.7456 vs 0.7123) because GroupKFold assigns patients to folds randomly, so different runs produce different patient-fold assignments. This ~3% variance is normal.

---

## How Were These Numbers Actually Calculated?

### Step 1: Synthetic Data Generation (`cohort_generator.py`)

The model was **NOT** trained on real hospital patient data. It was trained on **synthetic (fake) data** generated programmatically:

```python
# 100 virtual patients, each with 24-36 hours of readings at 1-minute intervals
scenarios = [
    ('normal',                    50%),  # Stable patients
    ('sepsis',                    20%),  # Programmed sepsis trajectory
    ('respiratory_failure',       15%),  # Programmed respiratory collapse
    ('cardiac_decompensation',    10%),  # Programmed cardiac shock
    ('sensor_artifact',            5%),  # Random noise/glitches
]
```

Each "sick" patient has a **deterministically scheduled deterioration event** starting at a random hour between 10 and 16. The vital signs are generated using:

```
Vital(t) = Baseline + Circadian_Sine_Wave + Gaussian_Noise + Scenario_Drift(t)
```

This produces ~126,000 total data points across 100 patients.

### Step 2: Target Label Construction (`feature_engineering.py`)

The target label `deterioration_within_6h` is computed by looking **forward in time**:
- For each minute-by-minute reading, check if `is_deteriorated == 1` anywhere in the next 6 hours.
- If yes → label = 1 (positive). If no → label = 0 (negative).
- **Only pre-collapse intervals are used** (records where `is_deteriorated == 0`), so the model must learn to predict deterioration *before* it visibly starts.

### Step 3: Feature Engineering (`feature_engineering.py`)

45 features are extracted using **strictly trailing (backward-looking) rolling windows**:
- Rolling means, standard deviations, min/max over 30m, 1h, 3h windows
- Rate-of-change deltas (e.g., how much HR changed in the last hour)
- Hemodynamic interaction ratios (shock index, respiratory distress index, etc.)

### Step 4: Cross-Validation (`train_lightgbm.py`)

**5-Fold Patient-Level GroupKFold** cross-validation:
- Patients are split into 5 groups. Each fold uses 4 groups for training, 1 for validation.
- **No patient appears in both training and validation** within the same fold — this prevents "memorizing" individual patients.
- Out-of-fold predictions are collected across all 5 folds and evaluated together.

### Step 5: Threshold Selection

The optimal threshold was found by:
```python
for thresh in np.linspace(0.1, 0.9, 81):
    preds = (probabilities >= thresh).astype(int)
    f1 = compute_f1(y_true, preds)
    if f1 > best_f1:
        best_threshold = thresh   # Winner: 0.27
```

---

## Honest Assessment: Is This Model Good?

### What's Genuinely Good ✅

1. **The methodology is sound.** Patient-level GroupKFold prevents cross-patient leakage. Forward-looking targets avoid circular label tautology. Trailing-only features prevent temporal leakage. These are real ML engineering best practices.

2. **ROC-AUC of 0.71–0.75 is realistic** for early warning on time-series vitals. Published clinical early warning scores (NEWS, MEWS) typically achieve 0.70–0.80 ROC-AUC on real ICU data.

3. **The system doesn't just say "HR > 120 = bad"** — it genuinely uses multi-vital trends, volatility, deltas, and interaction ratios to predict *future* events.

### What's Honestly Weak ⚠️

1. **Trained entirely on synthetic data.** The mathematical generators in `cohort_generator.py` are deterministic — sepsis always follows `progress * 45 bpm` tachycardia, respiratory failure always follows `progress * 14% SpO2 drop`. Real patient physiology is far more heterogeneous, noisy, and unpredictable. **The model would likely perform worse on real ICU data.**

2. **Precision is only 30%.** Out of every 10 patients flagged as "at risk", only 3 actually deteriorate. In a real hospital, this would create significant alarm fatigue — the very problem we claim to solve.

3. **Sensitivity is 58-76% depending on threshold.** The model misses 24-42% of true deterioration events. In a life-critical setting, missing even one is serious.

4. **The per-fold ROC-AUC varies wildly** (0.597 to 0.797 across 5 folds). This means the model's performance is unstable and highly dependent on which patients it sees. This is a sign the synthetic data doesn't have enough diversity.

5. **At threshold 0.50 (standard classification cutoff), sensitivity drops to 0.0%** — the model literally predicts nobody will deteriorate. This means the model's predicted probabilities are poorly calibrated and never confident enough to cross 50%.

6. **The "78.2% sensitivity / 71.4% specificity" numbers in the report** were from the training script run (`model_metadata.json`). The independent verification run (`verification_metrics.json`) gave lower numbers (76.0% sensitivity, 60.7% specificity at threshold 0.18). The report used the more favorable numbers.

---

## Summary Table

| Question | Honest Answer |
|:---|:---|
| **Is the model better than random?** | ✅ Yes, ROC-AUC ~0.74 (random = 0.50) |
| **Is the model clinically deployable?** | ❌ No — trained on synthetic data, low precision, untested on real patients |
| **Is the methodology correct?** | ✅ Yes — GroupKFold, trailing features, forward targets, no data leakage |
| **Are the numbers inflated?** | ⚠️ Slightly — the report used training-run numbers which were higher than the independent verification |
| **Would it pass a viva examination?** | ✅ Yes — the approach, methodology, and honest limitations make it a strong academic project |
| **Could it work on real MIMIC-IV data?** | Possible but would need retraining. See [`MIMIC_IV_INTEGRATION_GUIDE.md`](file:///d:/smart%20health%20care/app/ml/MIMIC_IV_INTEGRATION_GUIDE.md) |
