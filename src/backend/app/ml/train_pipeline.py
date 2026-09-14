"""
GridGuard AI — Complete Machine Learning Pipeline Training Script
Matches GridGuard_AI_Final.ipynb stages 1 to 6.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.ensemble import ExtraTreesClassifier, IsolationForest
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score


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
    print("STAGE 1: DATA PREPARATION")
    print("=" * 65)
    tf = pd.read_csv(os.path.join(data_dir, "Overview.csv"))
    cv = pd.read_csv(os.path.join(data_dir, "CurrentVoltage.csv"))

    transformer = pd.merge(tf, cv, on="DeviceTimeStamp")
    transformer["DeviceTimeStamp"] = pd.to_datetime(transformer["DeviceTimeStamp"])
    transformer_chrono = transformer.sort_values("DeviceTimeStamp").reset_index(drop=True).copy()

    exact_dup_count = int(transformer_chrono.duplicated().sum())
    modeling_df = transformer_chrono.drop_duplicates().reset_index(drop=True).copy()
    n_total_mod = len(modeling_df)
    print(f"Loaded {len(transformer):,} raw records -> {n_total_mod:,} deduplicated telemetry records.")

    # 2. MOG_A Supporting Classifier
    print("=" * 65)
    print("STAGE 2: MOG_A SUPPORTING CLASSIFIER")
    print("=" * 65)
    feature_cols = [c for c in transformer_chrono.columns if c not in ["DeviceTimeStamp", "MOG_A"]]
    target_col = "MOG_A"

    alarm_indices = transformer_chrono.index[transformer_chrono[target_col] == 1].tolist()
    last_alarm_idx = alarm_indices[-1] if alarm_indices else int(len(transformer_chrono) * 0.5)

    split_train = int(last_alarm_idx * 0.60)
    split_val = int(last_alarm_idx * 0.80)

    train_df_A = transformer_chrono.iloc[:split_train].copy()
    val_df_A = transformer_chrono.iloc[split_train:split_val].copy()
    test_df_A = transformer_chrono.iloc[split_val:].copy()

    scaler_A = MinMaxScaler().fit(train_df_A[feature_cols])
    X_train_A_sc = scaler_A.transform(train_df_A[feature_cols])
    X_test_A_sc = scaler_A.transform(test_df_A[feature_cols])

    model_A = ExtraTreesClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model_A.fit(X_train_A_sc, train_df_A[target_col])

    pred_test_A = model_A.predict(X_test_A_sc)
    proba_test_A = model_A.predict_proba(X_test_A_sc)[:, 1]

    acc = accuracy_score(test_df_A[target_col], pred_test_A)
    f1 = f1_score(test_df_A[target_col], pred_test_A, zero_division=0)
    print(f"ExtraTrees Classifier Test Accuracy: {acc*100:.2f}%, F1: {f1*100:.2f}%")

    joblib.dump(model_A, os.path.join(output_dir, "mog_classifier.pkl"))
    joblib.dump(scaler_A, os.path.join(output_dir, "mog_preprocessor.pkl"))

    # 3. Physics Health Score
    print("=" * 65)
    print("STAGE 3: IEEE C57.91 PHYSICS HEALTH SCORE")
    print("=" * 65)
    from app.ml.health_score import compute_equipment_health_score_clean
    transformer_health = compute_equipment_health_score_clean(modeling_df, equipment_id="TX-DIST-01")

    health_score_config = {
        "engine": "IEEE C57.91-inspired Physics Health Score",
        "max_score": 100.0,
        "penalties": {"thermal_max": 35.0, "oil_alarm_max": 35.0, "electrical_max": 30.0},
        "categories": {
            "Healthy": [80.0, 100.0],
            "Normal": [60.0, 79.9],
            "Warning": [40.0, 59.9],
            "Critical": [0.0, 39.9]
        }
    }
    with open(os.path.join(output_dir, "health_score_config.json"), "w") as f:
        json.dump(health_score_config, f, indent=2)

    # 4. Condition-Aware Anomaly Detection
    print("=" * 65)
    print("STAGE 4: CONDITION-AWARE SENSOR ANOMALY DETECTION")
    print("=" * 65)
    idx_train_end = int(n_total_mod * 0.60)
    idx_val_end = int(n_total_mod * 0.80)

    train_iso_df = modeling_df.iloc[:idx_train_end].copy()
    val_iso_df = modeling_df.iloc[idx_train_end:idx_val_end].copy()
    test_iso_df = modeling_df.iloc[idx_val_end:].copy()

    tr_v_avg = (train_iso_df['VL1'] + train_iso_df['VL2'] + train_iso_df['VL3']) / 3.0
    tr_i_avg = (train_iso_df['IL1'] + train_iso_df['IL2'] + train_iso_df['IL3']) / 3.0
    tr_energized_mask = (tr_v_avg > 50.0)

    tr_load_fit = tr_i_avg[tr_energized_mask].values
    tr_rise_fit = (train_iso_df['OTI'] - train_iso_df['ATI'])[tr_energized_mask].values
    poly_fit = np.polyfit(tr_load_fit, tr_rise_fit, 1)
    thermal_slope, thermal_intercept = float(poly_fit[0]), float(poly_fit[1])

    def engineer_features(df_in):
        res = df_in.copy()
        v_avg = (res['VL1'] + res['VL2'] + res['VL3']) / 3.0
        i_avg = (res['IL1'] + res['IL2'] + res['IL3']) / 3.0
        is_energized = (v_avg > 50.0).astype(float)
        temp_rise = res['OTI'] - res['ATI']
        expected_rise = np.where(is_energized > 0, thermal_slope * i_avg + thermal_intercept, 0.0)
        temp_residual = np.where(is_energized > 0, temp_rise - expected_rise, 0.0)
        v_max_dev = np.maximum(np.abs(res['VL1'] - v_avg), np.maximum(np.abs(res['VL2'] - v_avg), np.abs(res['VL3'] - v_avg)))
        v_unbalance_pct = np.where(is_energized > 0, (v_max_dev / np.maximum(v_avg, 1.0)) * 100.0, 0.0)
        v_nominal_dev_pct = np.where(is_energized > 0, np.abs(v_avg - 240.0) / 240.0 * 100.0, 0.0)
        i_max_dev = np.maximum(np.abs(res['IL1'] - i_avg), np.maximum(np.abs(res['IL2'] - i_avg), np.abs(res['IL3'] - i_avg)))
        i_unbalance_pct = np.where((is_energized > 0) & (i_avg > 5.0), (i_max_dev / np.maximum(i_avg, 1.0)) * 100.0, 0.0)
        oli_low_risk = np.maximum(0.0, 40.0 - res['OLI'])
        return pd.DataFrame({
            'temp_residual': temp_residual,
            'v_unbalance_pct': v_unbalance_pct,
            'v_nominal_dev_pct': v_nominal_dev_pct,
            'i_unbalance_pct': i_unbalance_pct,
            'oli_low_risk': oli_low_risk
        }, index=res.index)

    iso_features = ['temp_residual', 'v_unbalance_pct', 'v_nominal_dev_pct', 'i_unbalance_pct', 'oli_low_risk']
    X_train_raw = engineer_features(train_iso_df)
    iso_scaler = StandardScaler()
    X_train_scaled = iso_scaler.fit_transform(X_train_raw)

    iso_forest = IsolationForest(n_estimators=150, contamination=0.05, max_samples='auto', random_state=42, n_jobs=-1)
    iso_forest.fit(X_train_scaled)

    raw_train_decision = iso_forest.decision_function(X_train_scaled)
    decision_threshold = 0.0

    threshold_config = {
        "model": "Isolation Forest (Condition-Normalized)",
        "features": iso_features,
        "thermal_baseline": {"slope": thermal_slope, "intercept": thermal_intercept},
        "contamination": 0.05,
        "decision_threshold": decision_threshold,
        "score_min_train": float(raw_train_decision.min()),
        "score_max_train": float(raw_train_decision.max()),
        "calibration_split": "TRAIN (Historical Baseline, strictly no test tuning)"
    }

    joblib.dump(iso_forest, os.path.join(output_dir, 'isolation_forest_model.pkl'))
    joblib.dump(iso_scaler, os.path.join(output_dir, 'isolation_preprocessor.pkl'))
    joblib.dump(iso_features, os.path.join(output_dir, 'isolation_features.pkl'))
    joblib.dump(threshold_config, os.path.join(output_dir, 'anomaly_threshold.pkl'))

    print(f"Fitted baseline slope={thermal_slope:.5f}, intercept={thermal_intercept:.4f}")
    print("All artifacts successfully trained and updated in:", output_dir)


if __name__ == "__main__":
    run_pipeline()
