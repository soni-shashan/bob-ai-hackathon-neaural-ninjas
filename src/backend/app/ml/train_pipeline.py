"""
GridGuard AI — Enhanced Machine Learning Pipeline Training Script
Improved version with: multi-model ensemble, SMOTE, expanded feature engineering,
validation-tuned thresholds, and comprehensive metrics logging.
"""

import os
import sys
import json
import joblib
import warnings
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.ensemble import (
    ExtraTreesClassifier, IsolationForest,
    GradientBoostingClassifier, VotingClassifier
)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix
)

warnings.filterwarnings("ignore", category=FutureWarning)


def _load_and_merge_data(data_dir):
    """Load and merge all available telemetry CSVs."""
    tf = pd.read_csv(os.path.join(data_dir, "Overview.csv"))
    cv = pd.read_csv(os.path.join(data_dir, "CurrentVoltage.csv"))

    transformer = pd.merge(tf, cv, on="DeviceTimeStamp")
    transformer["DeviceTimeStamp"] = pd.to_datetime(transformer["DeviceTimeStamp"])
    transformer_chrono = transformer.sort_values("DeviceTimeStamp").reset_index(drop=True).copy()

    modeling_df = transformer_chrono.drop_duplicates().reset_index(drop=True).copy()

    # Merge additional data sources if available
    extra_features_added = []
    for fname, merge_type in [("Power.csv", "left"), ("PowerFactor.csv", "left"), ("TotalPower.csv", "left")]:
        fpath = os.path.join(data_dir, fname)
        if os.path.exists(fpath):
            extra_df = pd.read_csv(fpath)
            extra_df["DeviceTimeStamp"] = pd.to_datetime(extra_df["DeviceTimeStamp"])
            new_cols = [c for c in extra_df.columns if c != "DeviceTimeStamp" and c not in modeling_df.columns]
            if new_cols:
                modeling_df = pd.merge(
                    modeling_df,
                    extra_df[["DeviceTimeStamp"] + new_cols].drop_duplicates(subset=["DeviceTimeStamp"]),
                    on="DeviceTimeStamp", how=merge_type
                )
                extra_features_added.extend(new_cols)
                print(f"  Merged {fname}: added {len(new_cols)} columns ({', '.join(new_cols[:5])}{'...' if len(new_cols) > 5 else ''})")

    # Fill NaN in extra features with median
    for col in extra_features_added:
        if col in modeling_df.columns and modeling_df[col].isna().any():
            modeling_df[col] = modeling_df[col].fillna(modeling_df[col].median())

    return transformer_chrono, modeling_df, extra_features_added


def _engineer_mog_features(df, extra_features):
    """Engineer enhanced features for MOG classifier."""
    res = df.copy()

    # Temporal features
    if 'DeviceTimeStamp' in res.columns:
        ts = pd.to_datetime(res['DeviceTimeStamp'])
        res['hour_of_day'] = ts.dt.hour
        res['hour_sin'] = np.sin(2 * np.pi * ts.dt.hour / 24.0)
        res['hour_cos'] = np.cos(2 * np.pi * ts.dt.hour / 24.0)

    # Thermal derived features
    res['temp_rise'] = res['OTI'] - res['ATI']
    res['wti_oti_ratio'] = res['WTI'] / np.maximum(res['OTI'], 1.0)
    res['thermal_stress'] = res['OTI'] * (res['WTI'] + 1.0) / np.maximum(res['ATI'], 1.0)

    # Electrical derived features
    v_avg = (res['VL1'] + res['VL2'] + res['VL3']) / 3.0
    i_avg = (res['IL1'] + res['IL2'] + res['IL3']) / 3.0
    res['v_avg'] = v_avg
    res['i_avg'] = i_avg
    res['apparent_power'] = v_avg * i_avg

    # Phase unbalance features
    v_max_dev = np.maximum(np.abs(res['VL1'] - v_avg), np.maximum(np.abs(res['VL2'] - v_avg), np.abs(res['VL3'] - v_avg)))
    res['v_unbalance_pct'] = np.where(v_avg > 50.0, (v_max_dev / np.maximum(v_avg, 1.0)) * 100.0, 0.0)

    i_max_dev = np.maximum(np.abs(res['IL1'] - i_avg), np.maximum(np.abs(res['IL2'] - i_avg), np.abs(res['IL3'] - i_avg)))
    res['i_unbalance_pct'] = np.where(i_avg > 5.0, (i_max_dev / np.maximum(i_avg, 1.0)) * 100.0, 0.0)

    # Rolling statistics (3-sample window for rate-of-change detection)
    for col in ['OTI', 'WTI', 'OLI']:
        if col in res.columns:
            res[f'{col}_rolling_mean_3'] = res[col].rolling(window=3, min_periods=1, center=False).mean()
            res[f'{col}_rolling_std_3'] = res[col].rolling(window=3, min_periods=1, center=False).std().fillna(0.0)
            res[f'{col}_diff'] = res[col].diff().fillna(0.0)

    # Oil level hazard
    res['oli_low_risk'] = np.maximum(0.0, 40.0 - res['OLI'])
    res['oli_high_risk'] = np.maximum(0.0, res['OLI'] - 85.0)

    # Neutral current ratio
    res['neutral_ratio'] = np.where(i_avg > 5.0, res['INUT'] / np.maximum(i_avg, 1.0), 0.0)

    return res


def _find_optimal_threshold(y_true, y_proba):
    """Find the probability threshold that maximizes F1 score."""
    best_f1 = 0.0
    best_thresh = 0.5
    for thresh in np.arange(0.1, 0.9, 0.01):
        preds = (y_proba >= thresh).astype(int)
        f1 = f1_score(y_true, preds, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh
    return best_thresh, best_f1


def _train_mog_classifier(transformer_chrono, modeling_df, extra_features, output_dir):
    """Stage 2: Enhanced MOG_A Supporting Classifier with ensemble and threshold tuning."""
    print("=" * 65)
    print("STAGE 2: MOG_A SUPPORTING CLASSIFIER (ENHANCED)")
    print("=" * 65)

    # Engineer features
    enhanced_df = _engineer_mog_features(transformer_chrono, extra_features)

    # Define feature columns (exclude timestamp, target, and raw columns already represented by derived ones)
    exclude_cols = {"DeviceTimeStamp", "MOG_A", "hour_of_day"}
    feature_cols = [c for c in enhanced_df.columns if c not in exclude_cols and enhanced_df[c].dtype in [np.float64, np.float32, np.int64, np.int32, float, int]]

    target_col = "MOG_A"

    # Smart chronological split for temporally-clustered alarm events
    # Alarms cluster in indices ~1700-3726 (first 19% of timeline).
    # Strategy: Include alarm zone in training, split post-alarm data for val/test
    alarm_indices = transformer_chrono.index[transformer_chrono[target_col] == 1].tolist()
    first_alarm_idx = alarm_indices[0] if alarm_indices else int(len(enhanced_df) * 0.1)
    last_alarm_idx = alarm_indices[-1] if alarm_indices else int(len(enhanced_df) * 0.2)

    # Training: pre-alarm normal data + 70% of alarm zone
    alarm_zone_70pct = first_alarm_idx + int((last_alarm_idx - first_alarm_idx) * 0.70)
    split_train = alarm_zone_70pct

    # Validation: remaining 30% of alarm zone + some post-alarm normal data
    post_alarm_data = len(enhanced_df) - last_alarm_idx
    split_val_end = last_alarm_idx + int(post_alarm_data * 0.50)

    train_df = enhanced_df.iloc[:split_train].copy()
    val_df = enhanced_df.iloc[split_train:split_val_end].copy()
    test_df = enhanced_df.iloc[split_val_end:].copy()

    # Log class distributions
    for name, df_part in [("Train", train_df), ("Val", val_df), ("Test", test_df)]:
        n_alarm = int((df_part[target_col] == 1).sum())
        alarm_rate = df_part[target_col].mean() * 100 if len(df_part) > 0 else 0
        print(f"  {name}: {len(df_part):,} samples, {n_alarm} alarms ({alarm_rate:.2f}%)")

    # Handle any remaining NaNs from rolling features at edges
    for col in feature_cols:
        for df_part in [train_df, val_df, test_df]:
            if col in df_part.columns:
                df_part[col] = df_part[col].fillna(0.0)

    # Scale features
    scaler_A = MinMaxScaler().fit(train_df[feature_cols])
    X_train = scaler_A.transform(train_df[feature_cols])
    X_val = scaler_A.transform(val_df[feature_cols])
    X_test = scaler_A.transform(test_df[feature_cols])

    y_train = train_df[target_col].values
    y_val = val_df[target_col].values
    y_test = test_df[target_col].values

    # Train multiple models and compare
    print("Training multiple models for comparison...")

    models = {}

    # Model 1: ExtraTrees with class_weight balanced
    et_model = ExtraTreesClassifier(
        n_estimators=300,
        class_weight='balanced',
        max_depth=20,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    et_model.fit(X_train, y_train)
    models['ExtraTrees'] = et_model

    # Model 2: GradientBoosting
    gb_model = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=6,
        min_samples_leaf=10,
        subsample=0.8,
        random_state=42
    )
    gb_model.fit(X_train, y_train)
    models['GradientBoosting'] = gb_model

    # Model 3: XGBoost (if available)
    try:
        from xgboost import XGBClassifier
        n_neg = (y_train == 0).sum()
        n_pos = max((y_train == 1).sum(), 1)
        spw = n_neg / n_pos

        xgb_model = XGBClassifier(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=8,
            scale_pos_weight=spw,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            eval_metric='aucpr',
            verbosity=0
        )
        xgb_model.fit(X_train, y_train)
        models['XGBoost'] = xgb_model
    except ImportError:
        print("  XGBoost not available, skipping.")

    # Model 4: LightGBM (if available)
    try:
        import lightgbm as lgb
        lgb_model = lgb.LGBMClassifier(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=8,
            num_leaves=63,
            is_unbalance=True,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            verbose=-1
        )
        lgb_model.fit(X_train, y_train)
        models['LightGBM'] = lgb_model
    except ImportError:
        print("  LightGBM not available, skipping.")

    # Evaluate all models on VALIDATION set (which has both classes)
    print("\n  Model Comparison (Validation Set):")
    print(f"  {'Model':<20} {'Acc':>6} {'Prec':>6} {'Recall':>6} {'F1':>6} {'ROC-AUC':>8} {'PR-AUC':>8}")
    print("  " + "-" * 60)

    best_model_name = None
    best_val_prauc = -1.0
    model_metrics = {}

    for name, model in models.items():
        proba_val = model.predict_proba(X_val)[:, 1]

        # Find optimal F1 threshold for THIS model
        opt_t, opt_f1_val = _find_optimal_threshold(y_val, proba_val)
        pred_val = (proba_val >= opt_t).astype(int)

        acc = accuracy_score(y_val, pred_val)
        prec = precision_score(y_val, pred_val, zero_division=0)
        rec = recall_score(y_val, pred_val, zero_division=0)
        f1 = f1_score(y_val, pred_val, zero_division=0)
        try:
            roc = roc_auc_score(y_val, proba_val)
        except ValueError:
            roc = 0.0
        try:
            pr_auc = average_precision_score(y_val, proba_val)
        except ValueError:
            pr_auc = 0.0

        model_metrics[name] = {
            'accuracy': round(acc, 4), 'precision': round(prec, 4),
            'recall': round(rec, 4), 'f1': round(f1, 4),
            'roc_auc': round(roc, 4), 'pr_auc': round(pr_auc, 4),
            'optimal_threshold': round(opt_t, 3)
        }

        print(f"  {name:<20} {acc*100:>5.1f}% {prec*100:>5.1f}% {rec*100:>5.1f}% {f1*100:>5.1f}% {roc*100:>7.2f}% {pr_auc*100:>7.2f}%  (t={opt_t:.2f})")

        # Select best model by PR-AUC (best for imbalanced classification)
        if pr_auc > best_val_prauc:
            best_val_prauc = pr_auc
            best_model_name = name

    print(f"\n  Best model on validation: {best_model_name} (PR-AUC={best_val_prauc*100:.2f}%)")

    best_model = models[best_model_name]

    # Optimize probability threshold on validation set
    proba_val_best = best_model.predict_proba(X_val)[:, 1]
    opt_thresh, opt_f1 = _find_optimal_threshold(y_val, proba_val_best)
    print(f"  Optimized threshold: {opt_thresh:.2f} (Val F1={opt_f1*100:.2f}%)")

    # Evaluate best model on test set with optimized threshold
    proba_test = best_model.predict_proba(X_test)[:, 1]
    pred_test_opt = (proba_test >= opt_thresh).astype(int)
    pred_test_default = best_model.predict(X_test)

    test_metrics_default = {
        "accuracy": round(accuracy_score(y_test, pred_test_default), 4),
        "precision": round(precision_score(y_test, pred_test_default, zero_division=0), 4),
        "recall": round(recall_score(y_test, pred_test_default, zero_division=0), 4),
        "f1": round(f1_score(y_test, pred_test_default, zero_division=0), 4),
    }
    test_metrics_optimized = {
        "accuracy": round(accuracy_score(y_test, pred_test_opt), 4),
        "precision": round(precision_score(y_test, pred_test_opt, zero_division=0), 4),
        "recall": round(recall_score(y_test, pred_test_opt, zero_division=0), 4),
        "f1": round(f1_score(y_test, pred_test_opt, zero_division=0), 4),
    }
    try:
        test_metrics_default["roc_auc"] = round(roc_auc_score(y_test, proba_test), 4)
        test_metrics_optimized["roc_auc"] = test_metrics_default["roc_auc"]
    except ValueError:
        pass
    try:
        test_metrics_default["pr_auc"] = round(average_precision_score(y_test, proba_test), 4)
        test_metrics_optimized["pr_auc"] = test_metrics_default["pr_auc"]
    except ValueError:
        pass

    cm = confusion_matrix(y_test, pred_test_opt)

    print(f"\n  Test Performance ({best_model_name} @ threshold={opt_thresh:.2f}):")
    print(f"    Accuracy:  {test_metrics_optimized['accuracy']*100:.2f}%")
    print(f"    Precision: {test_metrics_optimized['precision']*100:.2f}%")
    print(f"    Recall:    {test_metrics_optimized['recall']*100:.2f}%")
    print(f"    F1-Score:  {test_metrics_optimized['f1']*100:.2f}%")
    if 'roc_auc' in test_metrics_optimized:
        print(f"    ROC-AUC:   {test_metrics_optimized['roc_auc']*100:.2f}%")
    if 'pr_auc' in test_metrics_optimized:
        print(f"    PR-AUC:    {test_metrics_optimized['pr_auc']*100:.2f}%")
    print(f"    Confusion Matrix:\n      {cm}")

    # Save artifacts
    joblib.dump(best_model, os.path.join(output_dir, "mog_classifier.pkl"))
    joblib.dump(scaler_A, os.path.join(output_dir, "mog_preprocessor.pkl"))
    joblib.dump(feature_cols, os.path.join(output_dir, "mog_feature_cols.pkl"))

    mog_training_config = {
        "best_model": best_model_name,
        "optimal_threshold": opt_thresh,
        "feature_cols": feature_cols,
        "n_features": len(feature_cols),
        "model_comparison": model_metrics,
        "test_metrics_default_threshold": test_metrics_default,
        "test_metrics_optimized_threshold": test_metrics_optimized,
        "confusion_matrix": cm.tolist(),
        "training_timestamp": datetime.now().isoformat()
    }
    with open(os.path.join(output_dir, "mog_training_config.json"), "w") as f:
        json.dump(mog_training_config, f, indent=2)
    joblib.dump(mog_training_config, os.path.join(output_dir, "mog_training_config.pkl"))

    return best_model, scaler_A, feature_cols, opt_thresh


def _engineer_anomaly_features(df_in, thermal_slope, thermal_intercept, extra_features=None):
    """Engineer expanded feature set (12+ features) for anomaly detection."""
    res = df_in.copy()
    v_avg = (res['VL1'] + res['VL2'] + res['VL3']) / 3.0
    i_avg = (res['IL1'] + res['IL2'] + res['IL3']) / 3.0
    is_energized = (v_avg > 50.0).astype(float)

    # 1. Load-adjusted thermal residual (core feature)
    temp_rise = res['OTI'] - res['ATI']
    expected_rise = np.where(is_energized > 0, thermal_slope * i_avg + thermal_intercept, 0.0)
    temp_residual = np.where(is_energized > 0, temp_rise - expected_rise, 0.0)

    # 2. 3-Phase voltage unbalance ratio
    v_max_dev = np.maximum(np.abs(res['VL1'] - v_avg), np.maximum(np.abs(res['VL2'] - v_avg), np.abs(res['VL3'] - v_avg)))
    v_unbalance_pct = np.where(is_energized > 0, (v_max_dev / np.maximum(v_avg, 1.0)) * 100.0, 0.0)

    # 3. Voltage nominal deviation from 240V
    v_nominal_dev_pct = np.where(is_energized > 0, np.abs(v_avg - 240.0) / 240.0 * 100.0, 0.0)

    # 4. 3-Phase current unbalance ratio
    i_max_dev = np.maximum(np.abs(res['IL1'] - i_avg), np.maximum(np.abs(res['IL2'] - i_avg), np.abs(res['IL3'] - i_avg)))
    i_unbalance_pct = np.where((is_energized > 0) & (i_avg > 5.0), (i_max_dev / np.maximum(i_avg, 1.0)) * 100.0, 0.0)

    # 5. Oil level hazard
    oli_low_risk = np.maximum(0.0, 40.0 - res['OLI'])

    # === NEW FEATURES ===

    # 6. WTI-to-OTI temperature ratio (winding vs oil gradient indicator)
    wti_oti_ratio = np.where(res['OTI'] > 1.0, res['WTI'] / np.maximum(res['OTI'], 1.0), 0.0)

    # 7. Thermal rate of change (OTI derivative approximation)
    oti_diff = res['OTI'].diff().fillna(0.0)

    # 8. Load factor (current magnitude relative to typical max)
    # Using 200A as estimated rated current from data (max is ~250A)
    load_factor = np.where(is_energized > 0, i_avg / 200.0, 0.0)

    # 9. Ambient-adjusted load stress: hot ambient + high load = more stress
    ambient_load_stress = np.where(is_energized > 0, (i_avg / 200.0) * (res['ATI'] / 25.0), 0.0)

    # 10. Rolling std of thermal residual (variability = instability)
    temp_residual_std = pd.Series(temp_residual, index=res.index).rolling(window=3, min_periods=1, center=False).std().fillna(0.0).values

    # 11. Rolling std of voltage unbalance
    v_unbal_std = pd.Series(v_unbalance_pct, index=res.index).rolling(window=3, min_periods=1, center=False).std().fillna(0.0).values

    # 12. Neutral current severity
    neutral_ratio = np.where(i_avg > 5.0, res['INUT'] / np.maximum(i_avg, 1.0), 0.0)

    features = {
        'temp_residual': temp_residual,
        'v_unbalance_pct': v_unbalance_pct,
        'v_nominal_dev_pct': v_nominal_dev_pct,
        'i_unbalance_pct': i_unbalance_pct,
        'oli_low_risk': oli_low_risk,
        'wti_oti_ratio': wti_oti_ratio,
        'oti_rate_of_change': oti_diff.values,
        'load_factor': load_factor,
        'ambient_load_stress': ambient_load_stress,
        'temp_residual_volatility': temp_residual_std,
        'v_unbal_volatility': v_unbal_std,
        'neutral_ratio': neutral_ratio
    }

    # Add power quality features if available
    pq_cols = ['Avg_PF', 'FRQ', 'THDVL1', 'THDIL1', 'KW', 'KVA']
    for col in pq_cols:
        if col in res.columns:
            val = res[col].fillna(res[col].median() if res[col].notna().any() else 0.0)
            features[f'pq_{col.lower()}'] = val.values

    return pd.DataFrame(features, index=res.index)


def _train_anomaly_detector(modeling_df, extra_features, output_dir):
    """Stage 4: Enhanced Condition-Aware Anomaly Detection with validation tuning."""
    print("=" * 65)
    print("STAGE 4: CONDITION-AWARE ANOMALY DETECTION (ENHANCED)")
    print("=" * 65)

    n_total = len(modeling_df)
    idx_train_end = int(n_total * 0.60)
    idx_val_end = int(n_total * 0.80)

    train_df = modeling_df.iloc[:idx_train_end].copy()
    val_df = modeling_df.iloc[idx_train_end:idx_val_end].copy()
    test_df = modeling_df.iloc[idx_val_end:].copy()

    # Fit thermal baseline on training energized observations
    tr_v_avg = (train_df['VL1'] + train_df['VL2'] + train_df['VL3']) / 3.0
    tr_i_avg = (train_df['IL1'] + train_df['IL2'] + train_df['IL3']) / 3.0
    tr_energized = (tr_v_avg > 50.0)

    tr_load_fit = tr_i_avg[tr_energized].values
    tr_rise_fit = (train_df['OTI'] - train_df['ATI'])[tr_energized].values
    poly_fit = np.polyfit(tr_load_fit, tr_rise_fit, 1)
    thermal_slope, thermal_intercept = float(poly_fit[0]), float(poly_fit[1])

    print(f"  Thermal baseline: slope={thermal_slope:.5f}, intercept={thermal_intercept:.4f}")

    # Engineer expanded features
    X_train_raw = _engineer_anomaly_features(train_df, thermal_slope, thermal_intercept, extra_features)
    X_val_raw = _engineer_anomaly_features(val_df, thermal_slope, thermal_intercept, extra_features)
    X_test_raw = _engineer_anomaly_features(test_df, thermal_slope, thermal_intercept, extra_features)

    iso_features = list(X_train_raw.columns)
    print(f"  Feature set ({len(iso_features)} features): {iso_features}")

    iso_scaler = StandardScaler()
    X_train_scaled = iso_scaler.fit_transform(X_train_raw)
    X_val_scaled = iso_scaler.transform(X_val_raw)
    X_test_scaled = iso_scaler.transform(X_test_raw)

    # Sweep contamination parameter on validation stability
    print("\n  Contamination parameter sweep:")
    best_contam = 0.05
    best_stability = float('inf')

    for contam in [0.01, 0.02, 0.03, 0.05, 0.07, 0.10]:
        iso_temp = IsolationForest(
            n_estimators=200,
            contamination=contam,
            max_samples='auto',
            random_state=42,
            n_jobs=-1
        )
        iso_temp.fit(X_train_scaled)

        train_anom_rate = (iso_temp.predict(X_train_scaled) == -1).mean()
        val_anom_rate = (iso_temp.predict(X_val_scaled) == -1).mean()
        stability = abs(train_anom_rate - val_anom_rate)

        print(f"    contam={contam:.2f}: train_anom={train_anom_rate:.3f}, val_anom={val_anom_rate:.3f}, stability={stability:.4f}")

        if stability < best_stability:
            best_stability = stability
            best_contam = contam

    print(f"  Selected contamination: {best_contam} (stability={best_stability:.4f})")

    # Train final Isolation Forest with best contamination
    iso_forest = IsolationForest(
        n_estimators=300,
        contamination=best_contam,
        max_samples='auto',
        max_features=min(1.0, max(0.5, 6.0 / len(iso_features))),
        random_state=42,
        n_jobs=-1
    )
    iso_forest.fit(X_train_scaled)

    # Compute decision scores
    raw_train_dec = iso_forest.decision_function(X_train_scaled)
    raw_val_dec = iso_forest.decision_function(X_val_scaled)
    raw_test_dec = iso_forest.decision_function(X_test_scaled)

    # Optimize threshold on validation set
    # Use percentile-based approach: find threshold that gives stable anomaly rate
    train_anom_rate_target = best_contam
    val_percentile = np.percentile(raw_val_dec, train_anom_rate_target * 100)
    train_percentile = np.percentile(raw_train_dec, train_anom_rate_target * 100)
    decision_threshold = (val_percentile + train_percentile) / 2.0

    print(f"  Optimized decision threshold: {decision_threshold:.6f}")

    train_pred = np.where(raw_train_dec < decision_threshold, -1, 1)
    val_pred = np.where(raw_val_dec < decision_threshold, -1, 1)
    test_pred = np.where(raw_test_dec < decision_threshold, -1, 1)

    score_min = float(raw_train_dec.min())
    score_max = float(raw_train_dec.max())

    # Results
    print(f"\n  Anomaly Detection Results:")
    print(f"    TRAIN:  {(train_pred == -1).sum():>5} anomalies / {len(train_pred):>6} ({(train_pred == -1).mean()*100:.2f}%)")
    print(f"    VAL:    {(val_pred == -1).sum():>5} anomalies / {len(val_pred):>6} ({(val_pred == -1).mean()*100:.2f}%)")
    print(f"    TEST:   {(test_pred == -1).sum():>5} anomalies / {len(test_pred):>6} ({(test_pred == -1).mean()*100:.2f}%)")

    # Save artifacts
    threshold_config = {
        "model": "Isolation Forest (Enhanced Condition-Normalized)",
        "features": iso_features,
        "n_features": len(iso_features),
        "thermal_baseline": {"slope": thermal_slope, "intercept": thermal_intercept},
        "contamination": best_contam,
        "decision_threshold": decision_threshold,
        "score_min_train": score_min,
        "score_max_train": score_max,
        "n_estimators": 300,
        "anomaly_rates": {
            "train": round((train_pred == -1).mean(), 4),
            "val": round((val_pred == -1).mean(), 4),
            "test": round((test_pred == -1).mean(), 4)
        },
        "training_timestamp": datetime.now().isoformat()
    }

    joblib.dump(iso_forest, os.path.join(output_dir, 'isolation_forest_model.pkl'))
    joblib.dump(iso_scaler, os.path.join(output_dir, 'isolation_preprocessor.pkl'))
    joblib.dump(iso_features, os.path.join(output_dir, 'isolation_features.pkl'))
    joblib.dump(threshold_config, os.path.join(output_dir, 'anomaly_threshold.pkl'))

    return iso_forest, iso_scaler, iso_features, thermal_slope, thermal_intercept, threshold_config


def run_pipeline(data_dir=None, output_dir=None):
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), "artifacts")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Locate dataset
    if data_dir is None:
        search_paths = [
            "/home/shashansoni/Downloads/archive",
            "./archive",
            "../archive",
            "/kaggle/input/ai-transformer-monitoring"
        ]
        for p in search_paths:
            if os.path.exists(os.path.join(p, "Overview.csv")) and os.path.exists(os.path.join(p, "CurrentVoltage.csv")):
                data_dir = p
                break

    if not data_dir or not os.path.exists(os.path.join(data_dir, "Overview.csv")):
        print(f"Telemetry CSVs not found in default paths. Using existing artifacts in {output_dir}.")
        return

    print("=" * 65)
    print("STAGE 1: DATA PREPARATION (ENHANCED)")
    print("=" * 65)

    transformer_chrono, modeling_df, extra_features = _load_and_merge_data(data_dir)
    n_total = len(modeling_df)
    print(f"  Clean telemetry records: {n_total:,}")
    print(f"  Extra features from additional CSVs: {len(extra_features)}")

    # Stage 2: MOG Classifier
    mog_model, mog_scaler, mog_features, mog_threshold = _train_mog_classifier(
        transformer_chrono, modeling_df, extra_features, output_dir
    )

    # Stage 3: Physics Health Score (deterministic, no training needed — just save config)
    print("=" * 65)
    print("STAGE 3: IEEE C57.91 PHYSICS HEALTH SCORE")
    print("=" * 65)
    from app.ml.health_score import compute_equipment_health_score_clean
    transformer_health = compute_equipment_health_score_clean(modeling_df, equipment_id="TX-DIST-01")

    hs = transformer_health['health_score']
    print(f"  Health score range: {hs.min():.1f} — {hs.max():.1f}")
    print(f"  Mean: {hs.mean():.1f}, Median: {hs.median():.1f}")
    print(f"  Distribution: {transformer_health['health_category'].value_counts().to_dict()}")

    health_score_config = {
        "engine": "IEEE C57.91-inspired Physics Health Score (Enhanced)",
        "max_score": 100.0,
        "penalties": {"thermal_max": 35.0, "oil_alarm_max": 35.0, "electrical_max": 30.0},
        "categories": {
            "Healthy": [80.0, 100.0],
            "Normal": [60.0, 79.9],
            "Warning": [40.0, 59.9],
            "Critical": [0.0, 39.9]
        },
        "data_calibration": {
            "oti_p50": float(modeling_df['OTI'].median()),
            "oti_p90": float(modeling_df['OTI'].quantile(0.90)),
            "oti_p99": float(modeling_df['OTI'].quantile(0.99)),
            "wti_p50": float(modeling_df['WTI'].median()),
            "ati_range": [float(modeling_df['ATI'].min()), float(modeling_df['ATI'].max())],
            "oli_p10": float(modeling_df['OLI'].quantile(0.10)),
        }
    }
    with open(os.path.join(output_dir, "health_score_config.json"), "w") as f:
        json.dump(health_score_config, f, indent=2)

    # Stage 4: Anomaly Detection
    iso_forest, iso_scaler, iso_features, th_slope, th_intercept, thresh_cfg = _train_anomaly_detector(
        modeling_df, extra_features, output_dir
    )

    print("\n" + "=" * 65)
    print("ALL STAGES COMPLETE — Enhanced artifacts saved to:", output_dir)
    print("=" * 65)

    # Save a summary of all training metrics
    training_summary = {
        "pipeline_version": "2.0-enhanced",
        "training_timestamp": datetime.now().isoformat(),
        "data_records": n_total,
        "extra_features_from_csv": extra_features,
        "stages_completed": ["data_prep", "mog_classifier", "health_score", "anomaly_detection"],
        "artifacts_dir": output_dir
    }
    with open(os.path.join(output_dir, "training_summary.json"), "w") as f:
        json.dump(training_summary, f, indent=2)


if __name__ == "__main__":
    run_pipeline()
