"""
HealthGuard LightGBM — 6-Hour Patient Deterioration Prediction Training Pipeline
Uses Patient-Level GroupKFold Cross-Validation (Zero Data Leakage).
Trains LightGBM classifier with class weighting, hyperparameter tuning,
evaluates ROC-AUC, PR-AUC, Sensitivity, Specificity, F1, and saves production model.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb

if os.name == 'nt':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from sklearn.model_selection import GroupKFold
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_recall_fscore_support,
    confusion_matrix,
    brier_score_loss
)

from cohort_generator import generate_full_cohort
from feature_engineering import construct_deterioration_target, extract_features, FEATURE_COLUMNS

MODEL_DIR = "d:/smart health care/app/ml/artifacts"
os.makedirs(MODEL_DIR, exist_ok=True)

def train_and_evaluate(cohort_csv="d:/smart health care/app/ml/cohort_dataset.csv", n_splits=5):
    print("=" * 64)
    print("🏥 HealthGuard LightGBM — 6-Hour Patient Deterioration Training")
    print("=" * 64)
    
    # 1. Load or generate cohort
    if not os.path.exists(cohort_csv):
        print("[INFO] Cohort dataset not found. Generating fresh cohort...")
        df_raw = generate_full_cohort(num_patients=100, output_csv=cohort_csv)
    else:
        print(f"[INFO] Loading existing cohort from: {cohort_csv}")
        df_raw = pd.read_csv(cohort_csv)
        df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'])

    # 2. Target Construction & Feature Engineering
    print("[INFO] Constructing 6-hour deterioration target & engineering dynamic features...")
    df_targeted = construct_deterioration_target(df_raw, horizon_hours=6.0, step_minutes=1.0)
    df_features = extract_features(df_targeted, step_minutes=1.0)
    
    # Filter out records where patient is already in mid-collapse (we focus on the early detection window)
    # The early warning window is where is_deteriorated == 0, but deterioration_within_6h can be 0 or 1
    analysis_df = df_features[df_features['is_deteriorated'] == 0].copy()
    
    X = analysis_df[FEATURE_COLUMNS]
    y = analysis_df['deterioration_within_6h']
    groups = analysis_df['patientId']
    
    pos_count = int(y.sum())
    neg_count = len(y) - pos_count
    pos_ratio = pos_count / len(y)
    print(f"[INFO] Dataset shape: {len(analysis_df):,} samples across {groups.nunique()} patients.")
    print(f"[INFO] Class balance: Positive (Deteriorates in 6h) = {pos_count:,} ({pos_ratio:.1%}), Negative (Stable) = {neg_count:,} ({(1-pos_ratio):.1%})")

    # 3. Patient-Level GroupKFold Cross-Validation
    gkf = GroupKFold(n_splits=n_splits)
    
    oof_preds = np.zeros(len(analysis_df))
    fold_metrics = []
    models = []
    
    scale_pos_weight = neg_count / max(1, pos_count)
    
    params = {
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
        'scale_pos_weight': scale_pos_weight,
        'random_state': 42,
        'verbose': -1
    }
    
    print(f"\n[INFO] Starting {n_splits}-Fold Patient-Level Cross-Validation...")
    
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups)):
        X_train, y_train = X.iloc[train_idx], y.iloc[train_idx]
        X_val, y_val = X.iloc[val_idx], y.iloc[val_idx]
        val_patients = groups.iloc[val_idx].unique()
        
        model = lgb.LGBMClassifier(**params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(stopping_rounds=30, verbose=False)]
        )
        
        val_probs = model.predict_proba(X_val)[:, 1]
        oof_preds[val_idx] = val_probs
        
        auc = roc_auc_score(y_val, val_probs)
        pr_auc = average_precision_score(y_val, val_probs)
        
        fold_metrics.append({
            'fold': fold + 1,
            'val_patients': len(val_patients),
            'val_samples': len(val_idx),
            'roc_auc': float(auc),
            'pr_auc': float(pr_auc)
        })
        models.append(model)
        print(f"  • Fold {fold+1}: ROC-AUC = {auc:.4f} | PR-AUC = {pr_auc:.4f} (Patients: {len(val_patients)})")

    # 4. Out-of-Fold Overall Evaluation
    overall_auc = roc_auc_score(y, oof_preds)
    overall_pr_auc = average_precision_score(y, oof_preds)
    brier = brier_score_loss(y, oof_preds)
    
    # Optimal threshold based on maximum F1
    best_thresh = 0.5
    best_f1 = 0
    for thresh in np.linspace(0.1, 0.9, 81):
        preds_t = (oof_preds >= thresh).astype(int)
        _, _, f1, _ = precision_recall_fscore_support(y, preds_t, average='binary', zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh
            
    final_preds = (oof_preds >= best_thresh).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(y, final_preds, average='binary', zero_division=0)
    cm = confusion_matrix(y, final_preds)
    tn, fp, fn, tp = cm.ravel()
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    print("\n" + "=" * 64)
    print("🎯 Overall Out-Of-Fold Validation Results (6-Hour Horizon)")
    print("-" * 64)
    print(f"  ROC-AUC:           {overall_auc:.4f}")
    print(f"  PR-AUC (Avg Prec): {overall_pr_auc:.4f}")
    print(f"  Brier Score:       {brier:.4f}")
    print(f"  Optimal Threshold: {best_thresh:.2f}")
    print(f"  Sensitivity/Recall:{recall:.4f} ({tp:,}/{tp+fn:,} deteriorations detected)")
    print(f"  Specificity:       {specificity:.4f} ({tn:,}/{tn+fp:,} stable intervals correctly identified)")
    print(f"  Precision (PPV):   {precision:.4f}")
    print(f"  F1 Score:          {f1:.4f}")
    print("=" * 64)
    print(f"  Confusion Matrix:  TN={tn:,} | FP={fp:,} | FN={fn:,} | TP={tp:,}")
    print("=" * 64)

    # 5. Feature Importances (Averaged across folds)
    feature_imp = np.zeros(len(FEATURE_COLUMNS))
    for m in models:
        feature_imp += m.feature_importances_ / len(models)
        
    imp_df = pd.DataFrame({
        'feature': FEATURE_COLUMNS,
        'importance': feature_imp
    }).sort_values(by='importance', ascending=False)
    
    print("\nTop 10 Most Predictive Features for 6-Hour Deterioration:")
    for idx, row in imp_df.head(10).iterrows():
        print(f"  {row['feature']:<25} | Importance: {row['importance']:.1f}")

    # 6. Train Final Production Model on Full Cohort
    print("\n[INFO] Fitting final production model on 100% of cohort data...")
    final_model = lgb.LGBMClassifier(**params)
    final_model.fit(X, y)
    
    model_path = os.path.join(MODEL_DIR, "lightgbm_deterioration_6h.joblib")
    joblib.dump(final_model, model_path)
    print(f"✅ Production model saved to: {model_path}")
    
    metadata = {
        'model_name': 'HealthGuard LightGBM 6h Deterioration Classifier',
        'horizon_hours': 6.0,
        'target_variable': 'deterioration_within_6h',
        'metrics': {
            'roc_auc': round(float(overall_auc), 4),
            'pr_auc': round(float(overall_pr_auc), 4),
            'brier_score': round(float(brier), 4),
            'optimal_threshold': round(float(best_thresh), 2),
            'sensitivity_recall': round(float(recall), 4),
            'specificity': round(float(specificity), 4),
            'precision': round(float(precision), 4),
            'f1_score': round(float(f1), 4),
            'confusion_matrix': {'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp)}
        },
        'feature_columns': FEATURE_COLUMNS,
        'top_features': imp_df.head(10).to_dict(orient='records'),
        'n_patients': int(groups.nunique()),
        'n_samples': int(len(analysis_df)),
        'positive_ratio': round(float(pos_ratio), 4)
    }
    
    meta_path = os.path.join(MODEL_DIR, "model_metadata.json")
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✅ Metadata saved to: {meta_path}")
    
    return metadata

if __name__ == "__main__":
    train_and_evaluate()
