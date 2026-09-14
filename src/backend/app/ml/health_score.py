"""
IEEE C57.91 Physics-Based Transformer Health Score Engine
Grounded in IEEE C57.91 transformer thermal, loading, and insulation degradation principles.
"""

from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd


def compute_health_score_single(
    oti: float = 65.0,
    wti: float = 72.0,
    ati: float = 32.0,
    oli: float = 65.0,
    oti_a: float = 0.0,
    oti_t: float = 0.0,
    vl1: float = 240.0,
    vl2: float = 239.5,
    vl3: float = 240.2,
    il1: float = 28.0,
    il2: float = 27.8,
    il3: float = 28.2,
    inut: float = 1.2
) -> Dict[str, Any]:
    """
    Computes deterministic physics health score (0-100) for a single transformer observation.
    """
    # 1. Thermal Penalty (Max 35 pts)
    oti_pen = (
        0.0 if oti <= 60.0
        else ((oti - 60.0) / 15.0 * 10.0 if oti <= 75.0
              else min(20.0, 10.0 + (oti - 75.0) / 15.0 * 10.0))
    )

    wti_pen = (
        0.0 if wti <= 70.0
        else ((wti - 70.0) / 15.0 * 8.0 if wti <= 85.0
              else min(15.0, 8.0 + (wti - 85.0) / 15.0 * 7.0))
    )

    temp_rise = oti - ati
    rise_pen = 0.0 if temp_rise <= 35.0 else min(8.0, (temp_rise - 35.0) * 0.4)

    temp_diff = wti - oti
    if 0.0 <= temp_diff <= 15.0:
        diff_pen = 0.0
    elif temp_diff > 15.0:
        diff_pen = min(7.0, (temp_diff - 15.0) * 0.7)
    elif temp_diff < -2.0:
        diff_pen = 5.0
    else:
        diff_pen = 0.0

    thermal_pen = float(np.clip(oti_pen + wti_pen + rise_pen + diff_pen, 0.0, 35.0))

    # 2. Oil Level & Hardware Thermal Alarm Penalty (Max 35 pts) — NO MOG_A
    if 40.0 <= oli <= 85.0:
        oli_pen = 0.0
    elif oli < 40.0:
        oli_pen = min(18.0, (40.0 - oli) / 40.0 * 18.0)
    else:
        oli_pen = min(10.0, (oli - 85.0) / 15.0 * 10.0)

    oti_a_pen = float(oti_a) * 10.0
    oti_t_pen = float(oti_t) * 25.0
    oil_alarm_pen = float(np.clip(oli_pen + oti_a_pen + oti_t_pen, 0.0, 35.0))

    # 3. 3-Phase Electrical Symmetry Penalty (Max 30 pts)
    v_avg = (vl1 + vl2 + vl3) / 3.0
    i_avg = (il1 + il2 + il3) / 3.0
    is_energized = v_avg > 50.0

    if is_energized:
        v_max_dev = max(abs(vl1 - v_avg), max(abs(vl2 - v_avg), abs(vl3 - v_avg)))
        v_unbal_pct = (v_max_dev / max(v_avg, 1.0)) * 100.0
        if v_unbal_pct <= 1.5:
            v_unbal_pen = 0.0
        elif v_unbal_pct <= 3.0:
            v_unbal_pen = (v_unbal_pct - 1.5) / 1.5 * 6.0
        else:
            v_unbal_pen = min(12.0, 6.0 + (v_unbal_pct - 3.0) * 3.0)

        i_neutral_ratio = (inut / max(i_avg, 1.0)) if i_avg > 5.0 else 0.0
        if i_neutral_ratio <= 0.35:
            i_neutral_pen = 0.0
        else:
            i_neutral_pen = min(10.0, (i_neutral_ratio - 0.35) * 20.0)

        v_nominal_dev = abs(v_avg - 240.0) / 240.0 * 100.0
        if v_nominal_dev <= 5.0:
            v_nominal_pen = 0.0
        else:
            v_nominal_pen = min(8.0, (v_nominal_dev - 5.0) * 0.8)

        electrical_pen = float(np.clip(v_unbal_pen + i_neutral_pen + v_nominal_pen, 0.0, 30.0))
    else:
        v_unbal_pct = 0.0
        electrical_pen = 0.0

    total_penalty = thermal_pen + oil_alarm_pen + electrical_pen
    health = float(np.clip(100.0 - total_penalty, 0.0, 100.0))

    if health >= 80.0:
        category = "Healthy"
    elif health >= 60.0:
        category = "Normal"
    elif health >= 40.0:
        category = "Warning"
    else:
        category = "Critical"

    return {
        "health_score": round(health, 1),
        "health_category": category,
        "thermal_penalty": round(thermal_pen, 2),
        "oil_alarm_penalty": round(oil_alarm_pen, 2),
        "electrical_penalty": round(electrical_pen, 2),
        "total_penalty": round(total_penalty, 2),
        "v_unbalance_pct": round(v_unbal_pct, 2)
    }


def compute_equipment_health_score_clean(df: pd.DataFrame, equipment_id: str = "TX-DIST-01") -> pd.DataFrame:
    """
    Computes vector health scores across telemetry DataFrame (matches Cell 6).
    """
    res = df.copy()
    res['equipment_id'] = equipment_id

    # 1. Thermal Penalty (Max 35 pts)
    oti = res['OTI'].fillna(res['OTI'].median() if 'OTI' in res else 60.0)
    wti = res['WTI'].fillna(res['WTI'].median() if 'WTI' in res else 70.0)
    ati = res['ATI'].fillna(res['ATI'].median() if 'ATI' in res else 30.0)

    oti_pen = np.where(oti <= 60.0, 0.0,
              np.where(oti <= 75.0, (oti - 60.0) / 15.0 * 10.0,
                       np.minimum(20.0, 10.0 + (oti - 75.0) / 15.0 * 10.0)))

    wti_pen = np.where(wti <= 70.0, 0.0,
              np.where(wti <= 85.0, (wti - 70.0) / 15.0 * 8.0,
                       np.minimum(15.0, 8.0 + (wti - 85.0) / 15.0 * 7.0)))

    temp_rise = oti - ati
    rise_pen = np.where(temp_rise <= 35.0, 0.0, np.minimum(8.0, (temp_rise - 35.0) * 0.4))

    temp_diff = wti - oti
    diff_pen = np.where((temp_diff >= 0.0) & (temp_diff <= 15.0), 0.0,
               np.where(temp_diff > 15.0, np.minimum(7.0, (temp_diff - 15.0) * 0.7),
               np.where(temp_diff < -2.0, 5.0, 0.0)))

    thermal_pen = np.clip(oti_pen + wti_pen + rise_pen + diff_pen, 0.0, 35.0)

    # 2. Oil Level & Hardware Thermal Alarm Penalty (Max 35 pts)
    oli = res['OLI'].fillna(res['OLI'].median() if 'OLI' in res else 65.0)
    oli_pen = np.where((oli >= 40.0) & (oli <= 85.0), 0.0,
              np.where(oli < 40.0, np.minimum(18.0, (40.0 - oli) / 40.0 * 18.0),
                       np.minimum(10.0, (oli - 85.0) / 15.0 * 10.0)))

    oti_a_pen = res.get('OTI_A', pd.Series(0, index=res.index)).fillna(0).astype(float) * 10.0
    oti_t_pen = res.get('OTI_T', pd.Series(0, index=res.index)).fillna(0).astype(float) * 25.0
    oil_alarm_pen = np.clip(oli_pen + oti_a_pen + oti_t_pen, 0.0, 35.0)

    # 3. 3-Phase Electrical Symmetry Penalty (Max 30 pts)
    vl1 = res.get('VL1', pd.Series(240.0, index=res.index)).fillna(240.0)
    vl2 = res.get('VL2', pd.Series(240.0, index=res.index)).fillna(240.0)
    vl3 = res.get('VL3', pd.Series(240.0, index=res.index)).fillna(240.0)
    il1 = res.get('IL1', pd.Series(25.0, index=res.index)).fillna(25.0)
    il2 = res.get('IL2', pd.Series(25.0, index=res.index)).fillna(25.0)
    il3 = res.get('IL3', pd.Series(25.0, index=res.index)).fillna(25.0)
    inut = res.get('INUT', pd.Series(0.0, index=res.index)).fillna(0.0)

    v_avg = (vl1 + vl2 + vl3) / 3.0
    i_avg = (il1 + il2 + il3) / 3.0
    is_energized = v_avg > 50.0

    v_max_dev = np.maximum(np.abs(vl1 - v_avg), np.maximum(np.abs(vl2 - v_avg), np.abs(vl3 - v_avg)))
    v_unbal_pct = np.where(is_energized, (v_max_dev / np.maximum(v_avg, 1.0)) * 100.0, 0.0)
    v_unbal_pen = np.where(~is_energized, 0.0,
                  np.where(v_unbal_pct <= 1.5, 0.0,
                  np.where(v_unbal_pct <= 3.0, (v_unbal_pct - 1.5) / 1.5 * 6.0,
                           np.minimum(12.0, 6.0 + (v_unbal_pct - 3.0) * 3.0))))

    i_neutral_ratio = np.where(i_avg > 5.0, inut / np.maximum(i_avg, 1.0), 0.0)
    i_neutral_pen = np.where(i_neutral_ratio <= 0.35, 0.0, np.minimum(10.0, (i_neutral_ratio - 0.35) * 20.0))

    v_nominal_dev = np.where(is_energized, np.abs(v_avg - 240.0) / 240.0 * 100.0, 0.0)
    v_nominal_pen = np.where(v_nominal_dev <= 5.0, 0.0, np.minimum(8.0, (v_nominal_dev - 5.0) * 0.8))

    electrical_pen = np.where(is_energized, np.clip(v_unbal_pen + i_neutral_pen + v_nominal_pen, 0.0, 30.0), 0.0)

    total_penalty = thermal_pen + oil_alarm_pen + electrical_pen
    health = np.clip(100.0 - total_penalty, 0.0, 100.0)

    res['thermal_penalty'] = np.round(thermal_pen, 2)
    res['oil_alarm_penalty'] = np.round(oil_alarm_pen, 2)
    res['electrical_penalty'] = np.round(electrical_pen, 2)
    res['health_score'] = np.round(health, 1)

    conditions = [
        res['health_score'] >= 80.0,
        res['health_score'] >= 60.0,
        res['health_score'] >= 40.0
    ]
    res['health_category'] = np.select(conditions, ['Healthy', 'Normal', 'Warning'], default='Critical')
    return res
