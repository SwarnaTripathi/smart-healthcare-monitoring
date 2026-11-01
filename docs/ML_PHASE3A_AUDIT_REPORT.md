# HealthGuard ML — Phase 3A: Authoritative Model Accuracy & Methodology Audit

**Audit Date:** November 1, 2026  
**Auditor:** Machine Learning Verification & Safety Unit  
**Status:** Complete & Authoritative  
**Artifact Evaluated:** `app/ml/artifacts/lightgbm_deterioration_6h.joblib` (SHA/Timestamp: Nov 1, 2026, 10:12:38 UTC)  

---

## Executive Summary

This audit resolves the reported discrepancies between the training snapshot (**ROC-AUC 0.7456, threshold 0.27**) and the independent verification snapshot (**ROC-AUC 0.7123, threshold 0.18**). It provides an empirical audit of the model architecture, feature matrix, target labeling, right-censoring, nested threshold optimization, and probability calibration.

### Key Audit Findings
1. **Feature Count Resolved (46 Features):** The production model and active codebase utilize exactly **46 ordered features** (not 25 and not 45). The earlier "25 features" report stemmed from Phase 2 (which only used HR, SpO2, and Temp). The addition of extended ICU vitals (RespRate, MAP, SysBP, EtCO2 and trailing dynamics) expanded the matrix to 46. The schema matches with zero order mismatch between training and inference.
2. **Root Cause of Snapshot Discrepancy:**
   - The **Verification Run (0.7123)** was executed at `02:13 UTC` on an older 25-feature cohort (126,051 samples).
   - The **Training Run (0.7456)** was executed at `10:12 UTC` after expanding the feature matrix to 46 features and regenerating the cohort (126,132 samples). The verification script was never re-run after this retrain.
3. **Nested Patient-Level Cross-Validation (Zero Test Leakage):**
   - Operating thresholds were selected strictly on inner folds ($\tau_k \in [0.17, 0.30]$).
   - **Pooled Outer-Fold ROC-AUC:** **0.7622** | **PR-AUC:** **0.3178**
   - **Pooled Outer Sensitivity:** **45.85%** | **Specificity:** **82.47%** | **Precision:** **31.80%**
4. **Right-Censoring Audit:** **16,920 pre-collapse intervals** have $<6$ hours of remaining observation before record termination without deterioration. When strictly evaluating only fully observed uncensored intervals ($N = 109,212$), **ROC-AUC increases to 0.7629** and **PR-AUC to 0.3554**.
5. **Calibration Findings:** Due to `scale_pos_weight = 5.61`, uncalibrated probabilities are over-spread, resulting in a **Brier Score of 0.1754** (vs. prevalence baseline 0.1284), a **Calibration Slope of 0.1727**, and **Intercept of -1.031**. Isotonic or sigmoid post-hoc calibration is required prior to displaying raw probabilities to clinicians.

---

## 1. Feature Schema & Alignment Audit

### 1.1 Resolution of Feature Count (25 vs. 45 vs. 46)
Forensic file inspection of `phase2_verification_audit_report.md`, `app/ml/feature_engineering.py`, and `app/ml/artifacts/lightgbm_deterioration_6h.joblib` reveals the exact progression:

| Evolution Phase | Core Vitals Tracked | Dynamic Trailing Features | Interaction Indices | Total Features |
|---|---|---|---|:---:|
| **Phase 2 (Legacy)** | `heartRate`, `spO2`, `temperature` (3) | Rolling means (8), std (3), min/max (3), deltas (5) | `hr_spo2_ratio`, `decompensation_index`, `combined_volatility` (3) | **25** |
| **Phase 3 (Current)** | `heartRate`, `spO2`, `temperature`, `respRate`, `map`, `sysBP`, `etco2` (7) | Rolling means (14), std (5), min/max (6), deltas (9) | Phase 2 indices + `resp_distress_idx`, `pulse_pressure_proxy` (5) | **46** |

- **Why "25" was reported:** The Phase 2 audit script (`audit_evaluation.py`, line 60) had a hardcoded string `print("Constructing target and extracting 25 historical features...")` written when the project only tracked 3 vitals.
- **Why "45" was occasionally cited:** Python zero-indexing (index 0 to 45 represents 46 total items), or the omission of `etco2`.
- **Authoritative Feature Count:** Exactly **46 features**.

### 1.2 Training vs. Inference Alignment Verification
The production model artifact was directly inspected in memory:
- `model.n_features_`: **46**
- `len(feature_engineering.FEATURE_COLUMNS)`: **46**
- `len(model_metadata.json['feature_columns'])`: **46**
- `list(model.feature_name_) == FEATURE_COLUMNS`: **`True`** (100% exact match in naming, typing, and position).
- In `app/ml/predict.py`, the inference vector is generated via `latest_row[FEATURE_COLUMNS]`, guaranteeing zero feature drift or misalignment.

---

## 2. Metric Differences & Historical Root Cause Analysis

The two reported evaluation snapshots differ across multiple dimensions:

| Parameter | Training Run (`model_metadata.json`) | Verification Run (`verification_metrics.json`) | Root Cause Analysis |
|---|:---:|:---:|---|
| **Timestamp** | Nov 1, 2026, 10:12:38 UTC | Nov 1, 2026, 02:13:31 UTC | Verification ran on an obsolete checkpoint 8 hours prior. |
| **Feature Set** | **46 features** (Extended ICU vitals) | **25 features** (Legacy 3-vital subset) | Feature set expanded between 02:13 and 10:12. |
| **Sample Count ($N$)** | **126,132** | **126,051** | Cohort was regenerated at 10:11:24 with 81 additional negative steps. |
| **ROC-AUC** | **0.7456** | **0.7123** | 46 features provide higher discrimination than 25 features (+0.0333 AUC). |
| **PR-AUC** | **0.3034** | **0.3010** | Extended vitals modestly improve precision-recall balance. |
| **Operating Threshold** | **0.27** | **0.18** | 0.27 maximized global F1; 0.18 was manually selected for ~76% sensitivity. |
| **Threshold Optimization** | Single global search on OOF | Manual selection on OOF | **Both had test-fold threshold leakage**. |

**Conclusion:** Neither prior number represented a fully rigorous nested cross-validation. The 0.7123 metric evaluated an obsolete 25-feature model; the 0.7456 metric evaluated the 46-feature model but used test-fold threshold tuning.

---

## 3. Target Labeling & Right-Censoring Verification

### 3.1 Label Construction
The prediction target is defined as:
$$\text{deterioration\_within\_6h}(t) = \max_{s \in (t, t + 6\text{h}]} [\text{is\_deteriorated}(s)]$$
For pre-collapse monitoring, records where $\text{is\_deteriorated}(t) = 1$ are excluded, isolating the early warning phase.

### 3.2 Right-Censoring Identification
In a finite recording $[0, T_{\text{end}}]$, any observation at time $t$ where:
$$T_{\text{end}} - t < 6.0\text{ hours} \quad \text{AND} \quad \text{no deterioration occurs in } [t, T_{\text{end}}]$$
is **right-censored**: the observation window was cut short before the 6-hour requirement was satisfied. In the legacy pipeline, these were assigned label `0` (Negative).

```
Patient Timeline (e.g., 24h normal patient):
[================== Valid Negative Window ==================][==== Right-Censored (6h) ====]
0h                                                          18h                           24h
                                                            (Follow-up truncated < 6h)
```

### 3.3 Cohort Stratification

| Cohort Stratum | Total Samples | Positive ($Y=1$) | Negative ($Y=0$) | Prevalence |
|---|:---:|:---:|:---:|:---:|
| **Full Telemetry Generated** | 180,000 | 53,868 (during/after collapse) | 126,132 | 29.93% |
| **Base Pre-Collapse Cohort** | **126,132** | **19,080** | **107,052** | **15.13%** |
| **Right-Censored Samples** | **16,920** | 0 | 16,920 | 0.00% |
| **Strictly Uncensored Cohort** | **109,212** | **19,080** | **90,132** | **17.47%** |

---

## 4. Nested Patient-Level Cross-Validation Methodology

To prevent data leakage:
1. **Outer Loop (Generalization Evaluation):** 5-fold `GroupKFold` grouped strictly by `patientId` (20 patients per test fold, zero patient overlap).
2. **Inner Loop (Threshold Selection):** Within each outer training split (80 patients), an inner 4-fold `GroupKFold` is executed to generate inner out-of-fold predictions and select the optimal operating threshold $\tau_k = \arg\max_\tau F_1(\tau)$.
3. **Test Evaluation:** The outer test fold is evaluated **strictly using $\tau_k$**. The test fold is never touched during threshold selection.

### 4.1 Per-Fold Performance (Production 46-Feature Cohort)

| Fold | Test Patients | Test Samples | Inner Threshold ($\tau_k$) | Inner $F_1$ | ROC-AUC | PR-AUC | Sensitivity | Specificity | Precision | Fold $F_1$ |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Fold 1** | 20 | 25,416 | **0.17** | 0.3715 | 0.7619 | 0.4013 | 43.39% | 84.67% | 31.83% | 0.3672 |
| **Fold 2** | 20 | 25,424 | **0.27** | 0.4213 | 0.7660 | 0.3331 | 38.67% | 85.86% | 31.09% | 0.3446 |
| **Fold 3** | 20 | 25,084 | **0.29** | 0.4568 | 0.7834 | 0.3176 | 51.54% | 82.00% | 34.93% | 0.4164 |
| **Fold 4** | 20 | 25,093 | **0.18** | 0.3555 | 0.8131 | 0.3560 | 65.86% | 77.53% | 35.45% | 0.4609 |
| **Fold 5** | 20 | 25,115 | **0.30** | 0.4668 | 0.6864 | 0.2285 | 28.94% | 82.13% | 23.26% | 0.2579 |
| **Mean $\pm$ SD** | 20 | $25,226 \pm 181$ | **$0.24 \pm 0.06$** | $0.41 \pm 0.05$ | **$0.762 \pm 0.047$** | **$0.327 \pm 0.063$** | **$45.7\% \pm 13.9\%$** | **$82.4\% \pm 3.2\%$** | **$31.3\% \pm 4.9\%$** | **$0.369 \pm 0.077$** |

---

## 5. Pooled Comparative Evaluation

Comparing the three model configurations under strictly nested validation:

| Metric | Production (46 Features, Full Cohort) | Rigorous (46 Features, Uncensored Only) | Legacy Simulation (25 Features, Full Cohort) |
|---|:---:|:---:|:---:|
| **Sample Size ($N$)** | 126,132 | 109,212 | 126,132 |
| **Positive Prevalence** | 15.13% | 17.47% | 15.13% |
| **Pooled ROC-AUC** | **0.7622** | **0.7629** | 0.7484 |
| **Pooled PR-AUC** | **0.3178** | **0.3554** | 0.3059 |
| **Sensitivity (Recall)** | **45.85%** | **48.47%** | 51.29% |
| **Specificity** | **82.47%** | **79.45%** | 76.77% |
| **Precision (PPV)** | **31.80%** | **33.30%** | 28.24% |
| **Negative Predictive Value (NPV)** | **89.52%** | **87.93%** | 89.84% |
| **$F_1$-Score** | **0.3756** | **0.3948** | 0.3642 |
| **Brier Score** | 0.1754 | 0.2035 | 0.1852 |
| **Prevalence Baseline Brier** | 0.1284 | 0.1442 | 0.1284 |
| **Brier Skill Score (BSS)** | -0.3664 | -0.4114 | -0.4426 |

### 5.1 Pooled Confusion Matrices

#### A) Production 46-Feature Model (Nested CV, $N = 126,132$)
```
                     Actual Positive      Actual Negative       Total
Predicted Positive       8,749 (TP)          18,762 (FP)        27,511
Predicted Negative      10,331 (FN)          88,290 (TN)        98,621
Total                   19,080              107,052            126,132
```

#### B) Rigorous Uncensored 46-Feature Model (Nested CV, $N = 109,212$)
```
                     Actual Positive      Actual Negative       Total
Predicted Positive       9,249 (TP)          18,522 (FP)        27,771
Predicted Negative       9,831 (FN)          71,610 (TN)        81,441
Total                   19,080               90,132            109,212
```

---

## 6. Model Calibration Audit

### 6.1 Calibration Metrics & Cox Parameters
- **Brier Score:** 0.1754
- **Prevalence Baseline:** 0.1284
- **Brier Skill Score:** **-0.3664**
- **Calibration Slope ($b$):** **0.1727** (A slope $\ll 1.0$ confirms probability over-extremity)
- **Calibration Intercept ($a$):** **-1.031**

### 6.2 Reliability Diagram (Quantile Binned Calibration Curve)

| Bin | Mean Predicted Probability | Observed Empirical Fraction | Calibration Status |
|:---:|:---:|:---:|---|
| **1** | 0.0000 | 0.0130 | Well-calibrated low risk |
| **2** | 0.0000 | 0.0131 | Well-calibrated low risk |
| **3** | 0.0000 | 0.0353 | Slight underestimation |
| **4** | 0.0002 | 0.0457 | Slight underestimation |
| **5** | 0.0009 | 0.1059 | Underestimation |
| **6** | 0.0044 | 0.1948 | Underestimation |
| **7** | 0.0234 | 0.1906 | Underestimation |
| **8** | 0.1468 | 0.2698 | Moderate calibration |
| **9** | 0.6058 | 0.3185 | Overestimation |
| **10** | 0.9656 | 0.3261 | Severe overestimation (predicted 96.6%, actual 32.6%) |

### 6.3 Predicted Probability Distribution
- **Minimum:** 0.0000
- **10th Percentile:** 0.0000
- **25th Percentile:** 0.0000
- **Median (50th):** 0.0018
- **75th Percentile:** 0.1286
- **90th Percentile:** 0.8807
- **95th Percentile:** 0.9783
- **Maximum:** 1.0000

### 6.4 Clinical Explanation of Calibration Disruption
The negative Brier Skill Score and low calibration slope ($0.1727$) are direct consequences of using `scale_pos_weight = 5.61` in LightGBM. Class reweighting shifts the decision boundary to favor sensitivity on imbalanced data, but artificially compresses non-deteriorating patients toward $0.0$ and pushes deteriorating-pattern patients toward $>0.90$. 

While this does **not** harm ranking capability (reflected by the strong ROC-AUC of 0.7622), **the output probabilities cannot be interpreted as true mathematical Bayesian posterior risks without isotonic or Platt recalibration**.

---

## 7. Conclusions & Governance Directives

1. **Current Working API Integrity:** The production model file [`app/ml/artifacts/lightgbm_deterioration_6h.joblib`](file:///d:/smart%20health%20care/app/ml/artifacts/lightgbm_deterioration_6h.joblib) and inference engine [`app/ml/predict.py`](file:///d:/smart%20health%20care/app/ml/predict.py) remain completely operational and uncorrupted.
2. **Definitive Accuracy Metrics for Reports & Viva:**
   - **Discrimination:** **ROC-AUC = 0.7622** | **PR-AUC = 0.3178**
   - **Clinical Decision Point:** Under nested inner thresholding ($\tau \approx 0.24$), the model delivers **45.85% Sensitivity**, **82.47% Specificity**, and **31.80% Precision**.
   - When right-censored intervals are excluded, precision reaches **33.30%** and PR-AUC reaches **0.3554**.
3. **Regulatory Notice:** This model was developed and verified on synthetic physiological simulation cohorts. It should **not** be claimed as clinically validated against real human patient populations without formal external validation on clinical databases such as MIMIC-IV or eICU-CRD.
