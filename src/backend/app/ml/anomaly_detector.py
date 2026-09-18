"""
Enhanced Condition-Aware Sensor Anomaly Detection Engine
Evaluates load-adjusted thermal rise, 3-phase electrical deviations, power quality,
and temporal patterns using Isolation Forest with 12+ engineered features.
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
        self.contamination = 0.05
        self.is_loaded = False
        self._prev_oti = None  # For rate-of-change estimation in single-sample mode
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
                    self.contamination = cfg.get("contamination", self.contamination)
                self.is_loaded = True
                logger.info(f"ConditionAwareAnomalyDetector: loaded {len(self.features)}-feature Isolation Forest.")
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
        il3: float = 25.0,
        wti: float = 0.0,
        inut: float = 1.0,
        avg_pf: Optional[float] = None,
        frq: Optional[float] = None,
        thdvl1: Optional[float] = None,
        thdil1: Optional[float] = None,
        kw: Optional[float] = None,
        kva: Optional[float] = None
    ) -> np.ndarray:
        v_avg = (vl1 + vl2 + vl3) / 3.0
        i_avg = (il1 + il2 + il3) / 3.0
        is_energized = 1.0 if v_avg > 50.0 else 0.0

        # Core features (original 5)
        temp_rise = oti - ati
        expected_rise = (self.thermal_slope * i_avg + self.thermal_intercept) if is_energized > 0 else 0.0
        temp_residual = (temp_rise - expected_rise) if is_energized > 0 else 0.0

        v_max_dev = max(abs(vl1 - v_avg), max(abs(vl2 - v_avg), abs(vl3 - v_avg)))
        v_unbalance_pct = ((v_max_dev / max(v_avg, 1.0)) * 100.0) if is_energized > 0 else 0.0

        v_nominal_dev_pct = (abs(v_avg - 240.0) / 240.0 * 100.0) if is_energized > 0 else 0.0

        i_max_dev = max(abs(il1 - i_avg), max(abs(il2 - i_avg), abs(il3 - i_avg)))
        i_unbalance_pct = ((i_max_dev / max(i_avg, 1.0)) * 100.0) if (is_energized > 0 and i_avg > 5.0) else 0.0

        oli_low_risk = max(0.0, 40.0 - oli)

        # Extended features (new 7)
        wti_oti_ratio = (wti / max(oti, 1.0)) if oti > 1.0 else 0.0

        # Rate of change estimation
        oti_roc = 0.0
        if self._prev_oti is not None:
            oti_roc = oti - self._prev_oti
        self._prev_oti = oti

        load_factor = (i_avg / 200.0) if is_energized > 0 else 0.0
        ambient_load_stress = (i_avg / 200.0) * (ati / 25.0) if is_energized > 0 else 0.0

        # For single-sample inference, volatility defaults to 0
        temp_residual_volatility = 0.0
        v_unbal_volatility = 0.0

        neutral_ratio = (inut / max(i_avg, 1.0)) if (is_energized > 0 and i_avg > 5.0) else 0.0

        feature_dict = {
            'temp_residual': temp_residual,
            'v_unbalance_pct': v_unbalance_pct,
            'v_nominal_dev_pct': v_nominal_dev_pct,
            'i_unbalance_pct': i_unbalance_pct,
            'oli_low_risk': oli_low_risk,
            'wti_oti_ratio': wti_oti_ratio,
            'oti_rate_of_change': oti_roc,
            'load_factor': load_factor,
            'ambient_load_stress': ambient_load_stress,
            'temp_residual_volatility': temp_residual_volatility,
            'v_unbal_volatility': v_unbal_volatility,
            'neutral_ratio': neutral_ratio
        }

        # Add power quality features if expected by the model
        pq_map = {
            'pq_avg_pf': avg_pf,
            'pq_frq': frq,
            'pq_thdvl1': thdvl1,
            'pq_thdil1': thdil1,
            'pq_kw': kw,
            'pq_kva': kva
        }
        for feat_name, val in pq_map.items():
            if feat_name in self.features:
                feature_dict[feat_name] = val if val is not None else 0.0

        # Build DataFrame with only the features the model expects
        row = {f: feature_dict.get(f, 0.0) for f in self.features}
        return pd.DataFrame([row])[self.features]

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
        il3: float = 25.0,
        wti: float = 0.0,
        inut: float = 1.0,
        **kwargs
    ) -> Dict[str, Any]:
        raw_feat = self.engineer_features_single(
            oti, ati, oli, vl1, vl2, vl3, il1, il2, il3,
            wti=wti, inut=inut, **kwargs
        )

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
            # Enhanced fallback heuristic
            temp_res = float(raw_feat['temp_residual'].iloc[0])
            v_unbal = float(raw_feat['v_unbalance_pct'].iloc[0])
            oli_risk = float(raw_feat['oli_low_risk'].iloc[0])

            # Composite heuristic score
            heuristic_score = (
                (1.0 if temp_res > 12.0 else temp_res / 12.0 * 0.5) * 0.4 +
                (1.0 if v_unbal > 3.0 else v_unbal / 3.0 * 0.5) * 0.3 +
                (1.0 if oli_risk > 10.0 else oli_risk / 10.0 * 0.5) * 0.3
            )
            is_anomaly = bool(heuristic_score > 0.5)
            dec_score = -0.10 if is_anomaly else 0.08

        # Normalized anomaly risk [0, 100]
        s_min, s_max = self.score_min_train, self.score_max_train
        norm_score = float(np.clip(1.0 - (dec_score - s_min) / (s_max - s_min + 1e-9), 0.0, 1.0) * 100.0)

        result = {
            "is_anomaly": is_anomaly,
            "anomaly_prediction": -1 if is_anomaly else 1,
            "decision_score": round(dec_score, 4),
            "normalized_anomaly_risk": round(norm_score, 1),
            "feature_count": len(self.features),
        }

        # Add key diagnostic features to response
        for feat in ['temp_residual', 'v_unbalance_pct', 'v_nominal_dev_pct', 'i_unbalance_pct', 'oli_low_risk']:
            if feat in raw_feat.columns:
                result[feat] = round(float(raw_feat[feat].iloc[0]), 2)

        return result


anomaly_detector = ConditionAwareAnomalyDetector()
