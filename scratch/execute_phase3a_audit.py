"""
HealthGuard ML — Phase 3A: Rigorous Methodology and Accuracy Audit
Script to execute:
1. Feature schema & alignment verification
2. Forensic explanation of 25 vs 46 features and 126,051 vs 126,132 samples
3. Right-censoring audit (censored intervals with < 6h remaining)
4. Nested Patient-Level Cross-Validation (Outer 5-fold GroupKFold, Inner-fold threshold selection)
5. Full Calibration Audit (Brier, Baseline, BSS, Reliability Curve, Calibration Slope & Intercept, Prob distribution)
6. Output json artifact for final report generation.
"""

import os
import sys
if os.name == 'nt':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import json
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import GroupKFold
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_recall_fscore_support,
    confusion_matrix,
    brier_score_loss
)
from sklearn.calibration import calibration_curve
from sklearn.linear_model import LogisticRegression

# Set paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ML_DIR = os.path.join(BASE_DIR, "app", "ml")
COHORT_CSV = os.path.join(ML_DIR, "cohort_dataset.csv")
MODEL_PATH = os.path.join(ML_DIR, "artifacts", "lightgbm_deterioration_6h.joblib")
META_PATH = os.path.join(ML_DIR, "artifacts", "model_metadata.json")
VERIF_PATH = os.path.join(ML_DIR, "artifacts", "verification_metrics.json")
OUT_JSON = os.path.join(BASE_DIR, "scratch", "phase3a_audit_results.json")

sys.path.append(ML_DIR)
from feature_engineering import construct_deterioration_target, extract_features, FEATURE_COLUMNS

def run_phase3a_audit():
    print("=" * 72)
    print("🔬 RUNNING HEALTHGUARD ML PHASE 3A METHODOLOGY & ACCURACY AUDIT")
    print("=" * 72)

    # 1. Feature schema audit
    print("\n--- STEP 1: FEATURE SCHEMA AUDIT ---")
    model = joblib.load(MODEL_PATH)
    model_features = list(model.feature_name_)
    code_features = list(FEATURE_COLUMNS)
    
    with open(META_PATH, 'r') as f:
        meta = json.load(f)
    meta_features = meta.get('feature_columns', [])

    feature_schema_audit = {
        'model_n_features': model.n_features_,
        'code_n_features': len(code_features),
        'meta_n_features': len(meta_features),
        'model_equals_code': model_features == code_features,
        'model_equals_meta': model_features == meta_features,
        'feature_list': code_features
    }
    print(f"Model n_features: {model.n_features_}")
    print(f"Code n_features:  {len(code_features)}")
    print(f"Meta n_features:  {len(meta_features)}")
    print(f"Model == Code exact order: {model_features == code_features}")

    # 2. Dataset loading and inspection
    print("\n--- STEP 2: DATASET & RIGHT CENSORING AUDIT ---")
    df_raw = pd.read_csv(COHORT_CSV)
    df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'])
    
    # Analyze raw patient trajectories and potential right-censoring
    patient_summaries = []
    for pid, group in df_raw.groupby('patientId'):
        dur_hrs = (group['timestamp'].max() - group['timestamp'].min()).total_seconds() / 3600.0
        det_steps = group[group['is_deteriorated'] == 1]
        has_det = len(det_steps) > 0
        det_time = det_steps['timestamp'].min() if has_det else None
        scenario = group['scenario'].iloc[0]
        patient_summaries.append({
            'patientId': pid,
            'scenario': scenario,
            'duration_hours': dur_hrs,
            'has_deterioration': has_det,
            'deterioration_timestamp': str(det_time) if det_time else None,
            'total_steps': len(group)
        })
    
    patient_summary_df = pd.DataFrame(patient_summaries)
    print(f"Total Patients: {len(patient_summary_df)}")
    print(f"Scenario breakdown:\n{patient_summary_df['scenario'].value_counts()}")
    print(f"Patients who deteriorated: {patient_summary_df['has_deterioration'].sum()}")

    # Target construction & feature extraction
    df_targeted = construct_deterioration_target(df_raw, horizon_hours=6.0, step_minutes=1.0)
    df_features = extract_features(df_targeted, step_minutes=1.0)

    # Right censoring check:
    # An observation at time t has a complete 6h window if (max_patient_time - t) >= 6 hours,
    # OR if the patient deteriorates at some time t_det with t < t_det <= t + 6h.
    # If the patient does NOT deteriorate in the remaining time AND remaining time < 6h,
    # that interval is right-censored (we do not know if they would have deteriorated at 6h).
    horizon_delta = pd.Timedelta(hours=6.0)
    
    is_right_censored = []
    for pid, group in df_features.groupby('patientId'):
        max_t = group['timestamp'].max()
        det_rows = group[group['is_deteriorated'] == 1]
        first_det_t = det_rows['timestamp'].min() if len(det_rows) > 0 else None
        
        for idx, row in group.iterrows():
            t = row['timestamp']
            is_det_current = row['is_deteriorated']
            target = row['deterioration_within_6h']
            
            # If already deteriorated, it's excluded from analysis anyway
            if is_det_current == 1:
                is_right_censored.append(False)
            elif target == 1:
                # Positive label: confirmed programmed deterioration within 6 hours!
                is_right_censored.append(False)
            else:
                # Negative label: check if patient had full 6h observation window
                if first_det_t is not None:
                    # Patient eventually deteriorates; if t is more than 6h before first_det_t, it's a true negative!
                    time_to_det = (first_det_t - t).total_seconds() / 3600.0
                    # If time_to_det > 6.0, complete 6-hour negative observation window!
                    # If patient record ended before 6h without det, censored.
                    remaining_obs = (max_t - t).total_seconds() / 3600.0
                    if remaining_obs < 6.0 and time_to_det > 6.0:
                        is_right_censored.append(True)
                    else:
                        is_right_censored.append(False)
                else:
                    # Patient never deteriorated (stable/normal or artifact)
                    remaining_obs = (max_t - t).total_seconds() / 3600.0
                    if remaining_obs < 6.0:
                        is_right_censored.append(True)
                    else:
                        is_right_censored.append(False)
                        
    df_features['is_right_censored'] = is_right_censored
    
    # Pre-collapse cohort (standard un-censored filter)
    base_cohort = df_features[df_features['is_deteriorated'] == 0].copy()
    uncensored_cohort = df_features[(df_features['is_deteriorated'] == 0) & (~df_features['is_right_censored'])].copy()
    
    censored_count = int(base_cohort['is_right_censored'].sum())
    total_base = len(base_cohort)
    total_uncensored = len(uncensored_cohort)
    pos_count_base = int(base_cohort['deterioration_within_6h'].sum())
    neg_count_base = total_base - pos_count_base
    pos_count_uncensored = int(uncensored_cohort['deterioration_within_6h'].sum())
    neg_count_uncensored = total_uncensored - pos_count_uncensored
    
    print(f"\nTarget Labels & Censoring Summary:")
    print(f"  Base pre-collapse intervals: {total_base:,} (Positive: {pos_count_base:,}, Negative: {neg_count_base:,})")
    print(f"  Right-censored intervals (<6h observation window at record end): {censored_count:,}")
    print(f"  Uncensored rigorously complete cohort: {total_uncensored:,} (Positive: {pos_count_uncensored:,}, Negative: {neg_count_uncensored:,})")

    # 3. Discrepancy analysis (25 features vs 46 features)
    print("\n--- STEP 3: COMPARISON OF 25-FEATURE VS 46-FEATURE MODELS ---")
    FEATURES_25 = [
        'heartRate', 'spO2', 'temperature',
        'hr_mean_30m', 'hr_mean_1h', 'hr_mean_3h',
        'spo2_mean_30m', 'spo2_mean_1h', 'spo2_mean_3h',
        'temp_mean_1h', 'temp_mean_3h',
        'hr_std_1h', 'spo2_std_1h', 'temp_std_1h',
        'hr_max_1h', 'spo2_min_1h', 'temp_max_1h',
        'hr_delta_30m', 'hr_delta_1h',
        'spo2_delta_30m', 'spo2_delta_1h',
        'temp_delta_1h',
        'hr_spo2_ratio', 'decompensation_index', 'combined_volatility'
    ]
    print(f"Original Phase 2 features count: {len(FEATURES_25)}")
    print(f"Phase 3 Extended features count: {len(FEATURE_COLUMNS)}")

    # 4. NESTED PATIENT-LEVEL CROSS-VALIDATION
    # Outer 5-fold GroupKFold. In each outer fold:
    # Inner 4-fold GroupKFold on outer train to select operating threshold tau_k (maximizing F1 on inner OOF).
    # Then evaluate outer test fold strictly with tau_k. Zero leakage!
    print("\n--- STEP 4: NESTED PATIENT-LEVEL GROUPKFOLD VALIDATION ---")
    
    def run_nested_cv(df_input, feature_list, dataset_name):
        X = df_input[feature_list]
        y = df_input['deterioration_within_6h'].values
        groups = df_input['patientId'].values
        
        outer_gkf = GroupKFold(n_splits=5)
        outer_oof_probs = np.zeros(len(df_input))
        outer_oof_preds = np.zeros(len(df_input))
        
        pos_c = int(y.sum())
        neg_c = len(y) - pos_c
        spw = neg_c / max(1, pos_c)
        
        lgb_params = {
            'objective': 'binary',
            'metric': 'binary_logloss',
            'boosting_type': 'gbdt',
            'n_estimators': 300,
            'learning_rate': 0.05,
            'num_leaves': 31,
            'max_depth': 6,
            'min_child_samples': 20,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'scale_pos_weight': spw,
            'random_state': 42,
            'verbose': -1
        }
        
        outer_results = []
        
        for fold, (train_idx, test_idx) in enumerate(outer_gkf.split(X, y, groups=groups)):
            X_train, y_train = X.iloc[train_idx], y[train_idx]
            groups_train = groups[train_idx]
            X_test, y_test = X.iloc[test_idx], y[test_idx]
            
            # INNER CV on training patients to select threshold tau_k
            inner_gkf = GroupKFold(n_splits=4)
            inner_oof_probs = np.zeros(len(X_train))
            
            for inner_tr_idx, inner_val_idx in inner_gkf.split(X_train, y_train, groups=groups_train):
                X_in_tr, y_in_tr = X_train.iloc[inner_tr_idx], y_train[inner_tr_idx]
                X_in_val, y_in_val = X_train.iloc[inner_val_idx], y_train[inner_val_idx]
                
                in_clf = lgb.LGBMClassifier(**lgb_params)
                in_clf.fit(X_in_tr, y_in_tr, eval_set=[(X_in_val, y_in_val)], callbacks=[lgb.early_stopping(30, verbose=False)])
                inner_oof_probs[inner_val_idx] = in_clf.predict_proba(X_in_val)[:, 1]
                
            # Find optimal threshold tau_k on INNER OOF predictions
            best_thresh = 0.5
            best_f1 = -1.0
            for th in np.linspace(0.10, 0.70, 61):
                p_bin = (inner_oof_probs >= th).astype(int)
                _, _, f1_val, _ = precision_recall_fscore_support(y_train, p_bin, average='binary', zero_division=0)
                if f1_val > best_f1:
                    best_f1 = f1_val
                    best_thresh = th
                    
            # Now train model on full outer training fold
            outer_clf = lgb.LGBMClassifier(**lgb_params)
            outer_clf.fit(X_train, y_train)
            
            test_probs = outer_clf.predict_proba(X_test)[:, 1]
            outer_oof_probs[test_idx] = test_probs
            
            # Predict using ONLY inner-selected threshold
            test_preds = (test_probs >= best_thresh).astype(int)
            outer_oof_preds[test_idx] = test_preds
            
            auc = roc_auc_score(y_test, test_probs)
            prauc = average_precision_score(y_test, test_probs)
            brier = brier_score_loss(y_test, test_probs)
            cm = confusion_matrix(y_test, test_preds)
            tn, fp, fn, tp = cm.ravel()
            sens = tp / (tp + fn) if (tp + fn) > 0 else 0
            spec = tn / (tn + fp) if (tn + fp) > 0 else 0
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0
            f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else 0
            
            fold_stat = {
                'fold': fold + 1,
                'test_patients': int(pd.Series(groups[test_idx]).nunique()),
                'test_samples': int(len(test_idx)),
                'inner_optimal_threshold': round(float(best_thresh), 3),
                'inner_validation_f1': round(float(best_f1), 4),
                'roc_auc': round(float(auc), 4),
                'pr_auc': round(float(prauc), 4),
                'brier_score': round(float(brier), 4),
                'sensitivity': round(float(sens), 4),
                'specificity': round(float(spec), 4),
                'precision': round(float(prec), 4),
                'f1_score': round(float(f1), 4),
                'confusion_matrix': {'tp': int(tp), 'fp': int(fp), 'fn': int(fn), 'tn': int(tn)}
            }
            outer_results.append(fold_stat)
            print(f"  [{dataset_name}] Fold {fold+1}: Thresh={best_thresh:.2f} | AUC={auc:.4f} | PR-AUC={prauc:.4f} | Sens={sens:.4f} | Spec={spec:.4f} | Prec={prec:.4f} | F1={f1:.4f}")
            
        # Pooled outer metrics
        overall_auc = roc_auc_score(y, outer_oof_probs)
        overall_prauc = average_precision_score(y, outer_oof_probs)
        overall_brier = brier_score_loss(y, outer_oof_probs)
        prevalence = float(np.mean(y))
        brier_base = brier_score_loss(y, np.full_like(y, prevalence, dtype=float))
        bss = 1.0 - (overall_brier / brier_base)
        
        pooled_cm = confusion_matrix(y, outer_oof_preds)
        p_tn, p_fp, p_fn, p_tp = pooled_cm.ravel()
        p_sens = p_tp / (p_tp + p_fn) if (p_tp + p_fn) > 0 else 0
        p_spec = p_tn / (p_tn + p_fp) if (p_tn + p_fp) > 0 else 0
        p_prec = p_tp / (p_tp + p_fp) if (p_tp + p_fp) > 0 else 0
        p_f1 = 2 * p_tp / (2 * p_tp + p_fp + p_fn) if (2 * p_tp + p_fp + p_fn) > 0 else 0
        p_npv = p_tn / (p_tn + p_fn) if (p_tn + p_fn) > 0 else 0
        
        # Calibration curve
        prob_true, prob_pred = calibration_curve(y, outer_oof_probs, n_bins=10, strategy='quantile')
        reliability = [{'bin': i+1, 'mean_predicted': round(float(pp), 4), 'observed_fraction': round(float(pt), 4)}
                       for i, (pp, pt) in enumerate(zip(prob_pred, prob_true))]
        
        # Calibration slope and intercept (Logistic regression of actual on logit(pred))
        eps = 1e-7
        clipped_probs = np.clip(outer_oof_probs, eps, 1.0 - eps)
        logit_probs = np.log(clipped_probs / (1.0 - clipped_probs)).reshape(-1, 1)
        lr = LogisticRegression(solver='lbfgs', max_iter=1000)
        lr.fit(logit_probs, y)
        calib_slope = float(lr.coef_[0, 0])
        calib_intercept = float(lr.intercept_[0])
        
        # Probability distribution percentiles
        prob_percentiles = {
            'min': round(float(np.min(outer_oof_probs)), 4),
            'p10': round(float(np.percentile(outer_oof_probs, 10)), 4),
            'p25': round(float(np.percentile(outer_oof_probs, 25)), 4),
            'p50_median': round(float(np.percentile(outer_oof_probs, 50)), 4),
            'p75': round(float(np.percentile(outer_oof_probs, 75)), 4),
            'p90': round(float(np.percentile(outer_oof_probs, 90)), 4),
            'p95': round(float(np.percentile(outer_oof_probs, 95)), 4),
            'p99': round(float(np.percentile(outer_oof_probs, 99)), 4),
            'max': round(float(np.max(outer_oof_probs)), 4)
        }
        
        return {
            'dataset_name': dataset_name,
            'feature_count': len(feature_list),
            'n_samples': len(df_input),
            'n_positive': int(pos_c),
            'n_negative': int(neg_c),
            'prevalence': round(prevalence, 4),
            'pooled_metrics': {
                'roc_auc': round(float(overall_auc), 4),
                'pr_auc': round(float(overall_prauc), 4),
                'brier_score': round(float(overall_brier), 4),
                'brier_baseline': round(float(brier_base), 4),
                'brier_skill_score': round(float(bss), 4),
                'sensitivity': round(float(p_sens), 4),
                'specificity': round(float(p_spec), 4),
                'precision_ppv': round(float(p_prec), 4),
                'npv': round(float(p_npv), 4),
                'f1_score': round(float(p_f1), 4),
                'confusion_matrix': {'tp': int(p_tp), 'fp': int(p_fp), 'fn': int(p_fn), 'tn': int(p_tn)}
            },
            'calibration': {
                'slope': round(calib_slope, 4),
                'intercept': round(calib_intercept, 4),
                'reliability_bins': reliability
            },
            'probability_distribution': prob_percentiles,
            'fold_results': outer_results,
            'raw_oof_probs': outer_oof_probs,
            'raw_y': y
        }

    # Evaluate 4 configurations:
    # A) 46 Features on Full Dataset (126,132 samples) - Nested CV
    print("\n[A] Evaluating 46 Features on Full Cohort (Nested CV)...")
    res_46_full = run_nested_cv(base_cohort, FEATURE_COLUMNS, "46-Features_FullCohort")
    
    # B) 46 Features on Uncensored Cohort (excluding right-censored intervals) - Nested CV
    print("\n[B] Evaluating 46 Features on Strictly Uncensored Cohort (Nested CV)...")
    res_46_uncensored = run_nested_cv(uncensored_cohort, FEATURE_COLUMNS, "46-Features_UncensoredCohort")

    # C) 25 Features on Full Dataset (Simulating Phase 2 configuration) - Nested CV
    print("\n[C] Evaluating 25 Features on Full Cohort (Phase 2 Simulation)...")
    res_25_full = run_nested_cv(base_cohort, FEATURES_25, "25-Features_Legacy")

    # Package full results
    final_audit = {
        'audit_timestamp': pd.Timestamp.now().isoformat(),
        'feature_schema_audit': feature_schema_audit,
        'labeling_and_censoring': {
            'total_raw_records': len(df_raw),
            'total_patients': int(patient_summary_df['patientId'].nunique()),
            'deteriorated_patients': int(patient_summary_df['has_deterioration'].sum()),
            'stable_patients': int((~patient_summary_df['has_deterioration']).sum()),
            'base_cohort_samples': total_base,
            'base_positive': pos_count_base,
            'base_negative': neg_count_base,
            'censored_samples_excluded': censored_count,
            'uncensored_samples': total_uncensored,
            'uncensored_positive': pos_count_uncensored,
            'uncensored_negative': neg_count_uncensored
        },
        'models_evaluated': {
            'production_46_full': {k: v for k, v in res_46_full.items() if not k.startswith('raw_')},
            'rigorous_46_uncensored': {k: v for k, v in res_46_uncensored.items() if not k.startswith('raw_')},
            'legacy_25_simulation': {k: v for k, v in res_25_full.items() if not k.startswith('raw_')}
        }
    }

    with open(OUT_JSON, 'w') as f:
        json.dump(final_audit, f, indent=2)
    print(f"\n✅ Audit complete! Results exported to: {OUT_JSON}")

if __name__ == "__main__":
    run_phase3a_audit()
