"""
Enhanced MOG_A Supporting Classifier
Supports multi-model ensemble (XGBoost/LightGBM/ExtraTrees/GradientBoosting)
with optimized probability threshold and expanded feature engineering.
"""

import os
import math
import logging
from typing import Dict, Any, Optional, List
import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")


class MOGClassifier:
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.feature_cols = [
            'OTI', 'WTI', 'ATI', 'OLI', 'OTI_A', 'OTI_T',
            'VL1', 'VL2', 'VL3', 'IL1', 'IL2', 'IL3',
            'VL12', 'VL23', 'VL31', 'INUT'
        ]
        self.optimal_threshold = 0.5
        self.is_loaded = False
        self.model_name = "ExtraTreesClassifier"
        self._load_artifacts()

    def _load_artifacts(self):
        try:
            model_path = os.path.join(ARTIFACTS_DIR, "mog_classifier.pkl")
            prep_path = os.path.join(ARTIFACTS_DIR, "mog_preprocessor.pkl")
            feat_path = os.path.join(ARTIFACTS_DIR, "mog_feature_cols.pkl")
            config_path = os.path.join(ARTIFACTS_DIR, "mog_training_config.pkl")

            if os.path.exists(model_path) and os.path.exists(prep_path):
                self.model = joblib.load(model_path)
                self.preprocessor = joblib.load(prep_path)

                if os.path.exists(feat_path):
                    self.feature_cols = joblib.load(feat_path)

                if os.path.exists(config_path):
                    cfg = joblib.load(config_path)
                    self.optimal_threshold = cfg.get("optimal_threshold", 0.5)
                    self.model_name = cfg.get("best_model", "Unknown")

                self.is_loaded = True
                logger.info(f"MOGClassifier: {self.model_name} loaded with {len(self.feature_cols)} features, threshold={self.optimal_threshold:.2f}")
        except Exception as e:
            logger.warning(f"Failed to load MOG artifacts: {e}. Running in fallback mode.")
            self.is_loaded = False

    def _engineer_single_features(
        self,
        oti: float, wti: float, ati: float, oli: float,
        oti_a: float, oti_t: float,
        vl1: float, vl2: float, vl3: float,
        il1: float, il2: float, il3: float,
        vl12: float, vl23: float, vl31: float,
        inut: float
    ) -> Dict[str, float]:
        """Generate enhanced features for a single observation."""
        v_avg = (vl1 + vl2 + vl3) / 3.0
        i_avg = (il1 + il2 + il3) / 3.0

        features = {
            'OTI': oti, 'WTI': wti, 'ATI': ati, 'OLI': oli,
            'OTI_A': oti_a, 'OTI_T': oti_t,
            'VL1': vl1, 'VL2': vl2, 'VL3': vl3,
            'IL1': il1, 'IL2': il2, 'IL3': il3,
            'VL12': vl12, 'VL23': vl23, 'VL31': vl31,
            'INUT': inut,
            # Temporal features (default to noon for single inference)
            'hour_sin': 0.0,
            'hour_cos': 1.0,
            # Thermal derived
            'temp_rise': oti - ati,
            'wti_oti_ratio': wti / max(oti, 1.0),
            'thermal_stress': oti * (wti + 1.0) / max(ati, 1.0),
            # Electrical derived
            'v_avg': v_avg,
            'i_avg': i_avg,
            'apparent_power': v_avg * i_avg,
        }

        # Phase unbalance
        v_max_dev = max(abs(vl1 - v_avg), abs(vl2 - v_avg), abs(vl3 - v_avg))
        features['v_unbalance_pct'] = (v_max_dev / max(v_avg, 1.0)) * 100.0 if v_avg > 50.0 else 0.0

        i_max_dev = max(abs(il1 - i_avg), abs(il2 - i_avg), abs(il3 - i_avg))
        features['i_unbalance_pct'] = (i_max_dev / max(i_avg, 1.0)) * 100.0 if i_avg > 5.0 else 0.0

        # Rolling stats default to 0 for single inference (no history)
        for col in ['OTI', 'WTI', 'OLI']:
            features[f'{col}_rolling_mean_3'] = features.get(col, 0.0)
            features[f'{col}_rolling_std_3'] = 0.0
            features[f'{col}_diff'] = 0.0

        # Oil level hazards
        features['oli_low_risk'] = max(0.0, 40.0 - oli)
        features['oli_high_risk'] = max(0.0, oli - 85.0)

        # Neutral current ratio
        features['neutral_ratio'] = (inut / max(i_avg, 1.0)) if i_avg > 5.0 else 0.0

        return features

    def predict_mog_alarm(
        self,
        oti: float = 65.0,
        wti: float = 72.0,
        ati: float = 32.0,
        oli: float = 65.0,
        oti_a: float = 0.0,
        oti_t: float = 0.0,
        vl1: float = 240.0,
        vl2: float = 240.0,
        vl3: float = 240.0,
        il1: float = 25.0,
        il2: float = 25.0,
        il3: float = 25.0,
        vl12: Optional[float] = None,
        vl23: Optional[float] = None,
        vl31: Optional[float] = None,
        inut: float = 1.0
    ) -> Dict[str, Any]:
        # Approximate line-to-line voltages if not provided
        sqrt3 = math.sqrt(3)
        v12 = vl12 if vl12 is not None else round(((vl1 + vl2) / 2.0) * sqrt3, 1)
        v23 = vl23 if vl23 is not None else round(((vl2 + vl3) / 2.0) * sqrt3, 1)
        v31 = vl31 if vl31 is not None else round(((vl3 + vl1) / 2.0) * sqrt3, 1)

        if self.is_loaded and self.model is not None and self.preprocessor is not None:
            try:
                # Generate all possible features
                all_features = self._engineer_single_features(
                    oti, wti, ati, oli, oti_a, oti_t,
                    vl1, vl2, vl3, il1, il2, il3,
                    v12, v23, v31, inut
                )

                # Build row with only expected features, defaulting missing to 0
                row = {col: all_features.get(col, 0.0) for col in self.feature_cols}
                df_in = pd.DataFrame([row])[self.feature_cols]

                sc = self.preprocessor.transform(df_in)
                prob = float(self.model.predict_proba(sc)[0][1])
                pred = int(prob >= self.optimal_threshold)
            except Exception as e:
                logger.warning(f"Inference error in MOG Classifier: {e}")
                pred = 1 if oli < 35.0 else 0
                prob = 0.85 if pred == 1 else 0.12
        else:
            # Enhanced fallback heuristic
            risk_score = 0.0
            if oli < 35.0:
                risk_score += 0.4
            elif oli > 90.0:
                risk_score += 0.2
            if oti > 50.0:
                risk_score += 0.2
            if oti_a > 0:
                risk_score += 0.15
            if oti_t > 0:
                risk_score += 0.25
            pred = 1 if risk_score >= 0.4 else 0
            prob = min(0.99, risk_score + 0.1) if pred == 1 else max(0.01, risk_score)

        return {
            "mog_predicted": pred,
            "mog_probability": round(prob, 4),
            "mog_risk_contribution": round(prob * 100.0, 1),
            "model_name": self.model_name,
            "threshold_used": round(self.optimal_threshold, 3)
        }


mog_classifier = MOGClassifier()
