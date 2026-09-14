"""
MOG_A Supporting Classifier
ExtraTreesClassifier with MinMaxScaler for Magnetic Oil Gauge alarm prediction.
"""

import os
import math
import logging
from typing import Dict, Any, Optional
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
        self.is_loaded = False
        self._load_artifacts()

    def _load_artifacts(self):
        try:
            model_path = os.path.join(ARTIFACTS_DIR, "mog_classifier.pkl")
            prep_path = os.path.join(ARTIFACTS_DIR, "mog_preprocessor.pkl")
            if os.path.exists(model_path) and os.path.exists(prep_path):
                self.model = joblib.load(model_path)
                self.preprocessor = joblib.load(prep_path)
                self.is_loaded = True
                logger.info("MOGClassifier: ExtraTreesClassifier artifacts loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load MOG artifacts: {e}. Running in fallback mode.")
            self.is_loaded = False

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

        row_dict = {
            'OTI': oti, 'WTI': wti, 'ATI': ati, 'OLI': oli,
            'OTI_A': oti_a, 'OTI_T': oti_t,
            'VL1': vl1, 'VL2': vl2, 'VL3': vl3,
            'IL1': il1, 'IL2': il2, 'IL3': il3,
            'VL12': v12, 'VL23': v23, 'VL31': v31,
            'INUT': inut
        }

        df_in = pd.DataFrame([row_dict])[self.feature_cols]

        if self.is_loaded and self.model is not None and self.preprocessor is not None:
            try:
                sc = self.preprocessor.transform(df_in)
                pred = int(self.model.predict(sc)[0])
                prob = float(self.model.predict_proba(sc)[0][1])
            except Exception as e:
                logger.warning(f"Inference error in MOG Classifier: {e}")
                pred = 1 if oli < 35.0 else 0
                prob = 0.85 if pred == 1 else 0.12
        else:
            pred = 1 if (oli < 35.0 or oli > 90.0) else 0
            prob = 0.88 if pred == 1 else 0.10

        return {
            "mog_predicted": pred,
            "mog_probability": round(prob, 4),
            "mog_risk_contribution": round(prob * 100.0, 1)
        }


mog_classifier = MOGClassifier()
