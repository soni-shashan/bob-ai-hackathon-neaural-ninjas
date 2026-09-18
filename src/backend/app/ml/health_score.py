"""
Enhanced IEEE C57.91 Physics-Based Transformer Health Score Engine
Grounded in IEEE C57.91 transformer thermal, loading, and insulation degradation principles.
Enhanced with: exponential penalty curves, Arrhenius thermal aging factor,
temporal smoothing support, and data-calibrated breakpoints.
"""

from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd


def _exponential_penalty(value: float, threshold_low: float, threshold_high: float, max_penalty: float) -> float:
    """Compute exponential penalty that accelerates beyond threshold_high.

    Returns 0 below threshold_low, ramps linearly to mid-penalty at threshold_high,
    then accelerates exponentially above. More physically realistic than linear piecewise.
    """
    if value <= threshold_low:
        return 0.0
    mid_penalty = max_penalty * 0.5
    if value <= threshold_high:
        return mid_penalty * (value - threshold_low) / max(threshold_high - threshold_low, 1e-6)
    # Exponential acceleration above threshold_high
    excess = value - threshold_high
    scale = max(threshold_high - threshold_low, 1e-6)
    return float(min(max_penalty, mid_penalty + (max_penalty - mid_penalty) * (1.0 - np.exp(-excess / scale * 2.0))))


def _arrhenius_aging_factor(hotspot_temp_c: float, reference_temp: float = 98.0, activation_ratio: float = 14.5) -> float:
    """IEEE C57.91 Section 7 inspired thermal aging acceleration factor.

    At reference temperature (~98°C), aging factor = 1.0 (normal life consumption).
    Every ~6-7°C above reference doubles the aging rate.
    Returns penalty contribution [0, max_aging_penalty].
    """
    if hotspot_temp_c <= reference_temp * 0.6:
        return 0.0
    aging = np.exp((hotspot_temp_c - reference_temp) / activation_ratio)
    # Normalize: aging=1 → 0 penalty, aging=2 → moderate, aging>4 → high
    return float(min(5.0, max(0.0, (aging - 1.0) * 2.5)))


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
    inut: float = 1.2,
    prev_health_score: Optional[float] = None,
    smoothing_alpha: float = 0.3
) -> Dict[str, Any]:
    """
    Computes deterministic physics health score (0-100) for a single transformer observation.
    Enhanced with exponential penalty curves, Arrhenius aging, and optional temporal smoothing.
    """
    # 1. Thermal Penalty (Max 35 pts)
    # OTI penalty: exponential ramp above 60°C, severe above 75°C
    oti_pen = _exponential_penalty(oti, 60.0, 75.0, 20.0)

    # WTI penalty: exponential ramp above 70°C, severe above 85°C
    wti_pen = _exponential_penalty(wti, 70.0, 85.0, 15.0)

    # Temperature rise penalty
    temp_rise = oti - ati
    rise_pen = 0.0 if temp_rise <= 35.0 else min(8.0, (temp_rise - 35.0) * 0.4)

    # WTI-OTI differential penalty
    temp_diff = wti - oti
    if 0.0 <= temp_diff <= 15.0:
        diff_pen = 0.0
    elif temp_diff > 15.0:
        diff_pen = min(7.0, (temp_diff - 15.0) * 0.7)
    elif temp_diff < -2.0:
        diff_pen = 5.0  # Anomalous: winding cooler than oil
    else:
        diff_pen = 0.0

    # Arrhenius aging penalty (additional penalty for extreme temperatures)
    # Use hotspot estimate: typically WTI or OTI+15 if WTI is not a hotspot sensor
    hotspot_est = max(wti, oti + 10.0) if wti > 0 else oti + 10.0
    aging_pen = _arrhenius_aging_factor(hotspot_est)

    thermal_pen = float(np.clip(oti_pen + wti_pen + rise_pen + diff_pen + aging_pen, 0.0, 35.0))

    # 2. Oil Level & Hardware Thermal Alarm Penalty (Max 35 pts)
    if 40.0 <= oli <= 85.0:
        oli_pen = 0.0
    elif oli < 40.0:
        # Exponential penalty for dangerously low oil
        oli_pen = _exponential_penalty(40.0 - oli, 0.0, 20.0, 18.0)
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

    # Optional temporal smoothing (EMA)
    if prev_health_score is not None and smoothing_alpha > 0:
        health = smoothing_alpha * health + (1.0 - smoothing_alpha) * prev_health_score
        health = float(np.clip(health, 0.0, 100.0))

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
        "v_unbalance_pct": round(v_unbal_pct, 2),
        "aging_acceleration_penalty": round(aging_pen, 2),
        "hotspot_estimate_c": round(hotspot_est, 1)
    }


def compute_equipment_health_score_clean(df: pd.DataFrame, equipment_id: str = "TX-DIST-01") -> pd.DataFrame:
    """
    Computes vector health scores across telemetry DataFrame.
    Enhanced with exponential penalties and Arrhenius aging.
    """
    res = df.copy()
    res['equipment_id'] = equipment_id

    # 1. Thermal Penalty (Max 35 pts) — Enhanced with exponential curves
    oti = res['OTI'].fillna(res['OTI'].median() if 'OTI' in res else 60.0)
    wti = res['WTI'].fillna(res['WTI'].median() if 'WTI' in res else 70.0)
    ati = res['ATI'].fillna(res['ATI'].median() if 'ATI' in res else 30.0)

    # OTI penalty: exponential-like using vectorized approach
    oti_pen = np.where(oti <= 60.0, 0.0,
              np.where(oti <= 75.0, (oti - 60.0) / 15.0 * 10.0,
                       np.minimum(20.0, 10.0 + (20.0 - 10.0) * (1.0 - np.exp(-(oti - 75.0) / 15.0 * 2.0)))))

    wti_pen = np.where(wti <= 70.0, 0.0,
              np.where(wti <= 85.0, (wti - 70.0) / 15.0 * 8.0,
                       np.minimum(15.0, 8.0 + (15.0 - 8.0) * (1.0 - np.exp(-(wti - 85.0) / 15.0 * 2.0)))))

    temp_rise = oti - ati
    rise_pen = np.where(temp_rise <= 35.0, 0.0, np.minimum(8.0, (temp_rise - 35.0) * 0.4))

    temp_diff = wti - oti
    diff_pen = np.where((temp_diff >= 0.0) & (temp_diff <= 15.0), 0.0,
               np.where(temp_diff > 15.0, np.minimum(7.0, (temp_diff - 15.0) * 0.7),
               np.where(temp_diff < -2.0, 5.0, 0.0)))

    # Arrhenius aging factor (vectorized)
    hotspot_est = np.where(wti > 0, np.maximum(wti, oti + 10.0), oti + 10.0)
    aging_raw = np.exp((hotspot_est - 98.0) / 14.5)
    aging_pen = np.clip((aging_raw - 1.0) * 2.5, 0.0, 5.0)
    aging_pen = np.where(hotspot_est <= 98.0 * 0.6, 0.0, aging_pen)

    thermal_pen = np.clip(oti_pen + wti_pen + rise_pen + diff_pen + aging_pen, 0.0, 35.0)

    # 2. Oil Level & Hardware Thermal Alarm Penalty (Max 35 pts)
    oli = res['OLI'].fillna(res['OLI'].median() if 'OLI' in res else 65.0)
    oli_deficit = np.maximum(0.0, 40.0 - oli)
    oli_pen_low = np.where(oli_deficit <= 0.0, 0.0,
                  np.where(oli_deficit <= 20.0, oli_deficit / 20.0 * 9.0,
                           np.minimum(18.0, 9.0 + (18.0 - 9.0) * (1.0 - np.exp(-(oli_deficit - 20.0) / 20.0 * 2.0)))))
    oli_pen_high = np.where(oli > 85.0, np.minimum(10.0, (oli - 85.0) / 15.0 * 10.0), 0.0)
    oli_pen = np.where((oli >= 40.0) & (oli <= 85.0), 0.0,
              np.where(oli < 40.0, oli_pen_low, oli_pen_high))

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
    res['aging_penalty'] = np.round(aging_pen, 2)
    res['health_score'] = np.round(health, 1)

    conditions = [
        res['health_score'] >= 80.0,
        res['health_score'] >= 60.0,
        res['health_score'] >= 40.0
    ]
    res['health_category'] = np.select(conditions, ['Healthy', 'Normal', 'Warning'], default='Critical')
    return res
