"""
Condition-Aware Sensor Anomaly Detection Engine
Evaluates load-adjusted thermal rise and 3-phase electrical deviations using Isolation Forest.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")


class ConditionAwareAnomalyDetector:
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.features = ['temp_residual', 'v_unbalance_pct', 'v_nominal_dev_pct', 'i_unbalance_pct', 'oli_low_risk']
        self.thermal_slope = 0.03970896
        self.thermal_intercept = -0.2775688
        self.decision_threshold = 0.0
        self.score_min_train = -0.21839274
        self.score_max_train = 0.17749272
        self.is_loaded = False
        self._load_artifacts()

    def _load_artifacts(self):
        try:
            model_path = os.path.join(ARTIFACTS_DIR, "isolation_forest_model.pkl")
            prep_path = os.path.join(ARTIFACTS_DIR, "isolation_preprocessor.pkl")
            thresh_path = os.path.join(ARTIFACTS_DIR, "anomaly_threshold.pkl")
            feat_path = os.path.join(ARTIFACTS_DIR, "isolation_features.pkl")

            if os.path.exists(model_path) and os.path.exists(prep_path):
                self.model = joblib.load(model_path)
                self.preprocessor = joblib.load(prep_path)
                if os.path.exists(feat_path):
                    self.features = joblib.load(feat_path)
                if os.path.exists(thresh_path):
                    cfg = joblib.load(thresh_path)
                    tb = cfg.get("thermal_baseline", {})
                    self.thermal_slope = tb.get("slope", self.thermal_slope)
                    self.thermal_intercept = tb.get("intercept", self.thermal_intercept)
                    self.decision_threshold = cfg.get("decision_threshold", self.decision_threshold)
                    self.score_min_train = cfg.get("score_min_train", self.score_min_train)
                    self.score_max_train = cfg.get("score_max_train", self.score_max_train)
                self.is_loaded = True
                logger.info("ConditionAwareAnomalyDetector: Isolation Forest artifacts loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load Isolation Forest artifacts: {e}. Running in heuristic fallback mode.")
            self.is_loaded = False

    def engineer_features_single(
        self,
        oti: float,
        ati: float,
        oli: float,
        vl1: float = 240.0,
        vl2: float = 240.0,
        vl3: float = 240.0,
        il1: float = 25.0,
        il2: float = 25.0,
        il3: float = 25.0
    ) -> np.ndarray:
        v_avg = (vl1 + vl2 + vl3) / 3.0
        i_avg = (il1 + il2 + il3) / 3.0
        is_energized = 1.0 if v_avg > 50.0 else 0.0

        temp_rise = oti - ati
        expected_rise = (self.thermal_slope * i_avg + self.thermal_intercept) if is_energized > 0 else 0.0
        temp_residual = (temp_rise - expected_rise) if is_energized > 0 else 0.0

        v_max_dev = max(abs(vl1 - v_avg), max(abs(vl2 - v_avg), abs(vl3 - v_avg)))
        v_unbalance_pct = ((v_max_dev / max(v_avg, 1.0)) * 100.0) if is_energized > 0 else 0.0

        v_nominal_dev_pct = (abs(v_avg - 240.0) / 240.0 * 100.0) if is_energized > 0 else 0.0

        i_max_dev = max(abs(il1 - i_avg), max(abs(il2 - i_avg), abs(il3 - i_avg)))
        i_unbalance_pct = ((i_max_dev / max(i_avg, 1.0)) * 100.0) if (is_energized > 0 and i_avg > 5.0) else 0.0

        oli_low_risk = max(0.0, 40.0 - oli)

        return pd.DataFrame([{
            'temp_residual': temp_residual,
            'v_unbalance_pct': v_unbalance_pct,
            'v_nominal_dev_pct': v_nominal_dev_pct,
            'i_unbalance_pct': i_unbalance_pct,
            'oli_low_risk': oli_low_risk
        }])[self.features]

    def predict_anomaly_single(
        self,
        oti: float,
        ati: float,
        oli: float,
        vl1: float = 240.0,
        vl2: float = 240.0,
        vl3: float = 240.0,
        il1: float = 25.0,
        il2: float = 25.0,
        il3: float = 25.0
    ) -> Dict[str, Any]:
        raw_feat = self.engineer_features_single(oti, ati, oli, vl1, vl2, vl3, il1, il2, il3)

        if self.is_loaded and self.model is not None and self.preprocessor is not None:
            try:
                scaled = self.preprocessor.transform(raw_feat)
                dec_score = float(self.model.decision_function(scaled)[0])
                is_anomaly = bool(dec_score < self.decision_threshold)
            except Exception as e:
                logger.warning(f"Inference error in Isolation Forest: {e}")
                dec_score = 0.05
                is_anomaly = False
        else:
            # Fallback heuristic
            temp_res = float(raw_feat['temp_residual'].iloc[0])
            v_unbal = float(raw_feat['v_unbalance_pct'].iloc[0])
            oli_risk = float(raw_feat['oli_low_risk'].iloc[0])
            is_anomaly = bool(temp_res > 12.0 or v_unbal > 3.0 or oli_risk > 10.0)
            dec_score = -0.10 if is_anomaly else 0.08

        # Normalized anomaly risk [0, 100]
        s_min, s_max = self.score_min_train, self.score_max_train
        norm_score = float(np.clip(1.0 - (dec_score - s_min) / (s_max - s_min + 1e-9), 0.0, 1.0) * 100.0)

        return {
            "is_anomaly": is_anomaly,
            "anomaly_prediction": -1 if is_anomaly else 1,
            "decision_score": round(dec_score, 4),
            "normalized_anomaly_risk": round(norm_score, 1),
            "temp_residual": round(float(raw_feat['temp_residual'].iloc[0]), 2),
            "v_unbalance_pct": round(float(raw_feat['v_unbalance_pct'].iloc[0]), 2),
            "v_nominal_dev_pct": round(float(raw_feat['v_nominal_dev_pct'].iloc[0]), 2),
            "i_unbalance_pct": round(float(raw_feat['i_unbalance_pct'].iloc[0]), 2),
            "oli_low_risk": round(float(raw_feat['oli_low_risk'].iloc[0]), 2)
        }


anomaly_detector = ConditionAwareAnomalyDetector()
