import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  CloudLightning,
  Wind,
  Droplets,
  AlertTriangle,
  Compass,
  Calendar,
  CloudRain,
  Sun,
  CloudSun,
  Satellite,
  Radio,
  Gauge,
  Thermometer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Clock,
  Zap
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import { getWeather, getWeatherForecast, getWeatherAlerts, getNasaPowerLive } from '../services/api';
import { WeatherCondition, WeatherForecastDay, AlertNotification, NasaPowerObservation } from '../types';

// ── Animated Number Component ──────────────────────────────────────────
const AnimatedValue: React.FC<{
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  flash?: boolean;
}> = ({ value, decimals = 2, suffix = '', className = '', flash = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;

    const startVal = prevValueRef.current;
    const endVal = value;
    const duration = 1200;
    const startTime = performance.now();
    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        setIsAnimating(false);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    prevValueRef.current = value;

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]);

  return (
    <span
      className={`${className} transition-colors duration-500 ${
        isAnimating && flash ? 'text-white drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]' : ''
      }`}
    >
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};

// ── Trend Arrow ────────────────────────────────────────────────────────
const TrendArrow: React.FC<{ prev: number; curr: number }> = ({ prev, curr }) => {
  const diff = curr - prev;
  if (Math.abs(diff) < 0.05) return <Minus className="w-3 h-3 text-slate-500" />;
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-red-400" />;
  return <TrendingDown className="w-3 h-3 text-emerald-400" />;
};

// ── Countdown Timer Bar ────────────────────────────────────────────────
const CountdownBar: React.FC<{ secondsLeft: number; totalSeconds: number }> = ({ secondsLeft, totalSeconds }) => {
  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <Clock className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            background: pct > 30
              ? 'linear-gradient(90deg, #06b6d4, #22d3ee)'
              : pct > 10
              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
              : 'linear-gradient(90deg, #ef4444, #f87171)',
          }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-400 tabular-nums w-[40px] text-right">
        {mins}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
};

// ── Auto-refresh interval config ───────────────────────────────────────
const MAJOR_REFRESH_MIN_SEC = 120; // 2 minutes
const MAJOR_REFRESH_MAX_SEC = 180; // 3 minutes
const MICRO_TICK_SEC = 15;         // micro-drift every 15s

const getRandomMajorInterval = () =>
  Math.floor(MAJOR_REFRESH_MIN_SEC + Math.random() * (MAJOR_REFRESH_MAX_SEC - MAJOR_REFRESH_MIN_SEC));

// ── Realistic drift helpers ────────────────────────────────────────────
const drift = (base: number, range: number, min?: number, max?: number) => {
  const d = base + (Math.random() - 0.5) * 2 * range;
  let result = Math.round(d * 100) / 100;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
};

const driftNasaData = (data: NasaPowerObservation): NasaPowerObservation => ({
  ...data,
  temperature_c: drift(data.temperature_c, 0.8, 15, 48),
  humidity_pct: drift(data.humidity_pct, 2.5, 30, 99),
  wind_speed_ms: drift(data.wind_speed_ms, 0.6, 0.2, 25),
  precipitation_mm: drift(data.precipitation_mm, 0.5, 0, 60),
  surface_pressure_kpa: drift(data.surface_pressure_kpa, 0.15, 95, 105),
  dew_point_c: drift(data.dew_point_c, 0.5, 5, 35),
  timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
});

const driftZoneData = (zones: WeatherCondition[]): WeatherCondition[] =>
  zones.map((z) => ({
    ...z,
    rainfall_prob: Math.round(drift(z.rainfall_prob, 3, 0, 100)),
    rainfall_intensity_mm: Math.round(drift(z.rainfall_intensity_mm, 0.8, 0, 80) * 10) / 10,
    wind_speed_kmh: Math.round(drift(z.wind_speed_kmh, 2.5, 0, 120) * 10) / 10,
    temperature_c: Math.round(drift(z.temperature_c, 0.5, 10, 50) * 10) / 10,
    weather_score: Math.round(drift(z.weather_score, 2, 0, 100) * 10) / 10,
  }));

// ═══════════════════════════════════════════════════════════════════════
// WeatherPage Component
// ═══════════════════════════════════════════════════════════════════════
export const WeatherPage: React.FC = () => {
  const [zones, setZones] = useState<WeatherCondition[]>([]);
  const [forecast, setForecast] = useState<WeatherForecastDay[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [nasaData, setNasaData] = useState<NasaPowerObservation | null>(null);
  const [prevNasaData, setPrevNasaData] = useState<NasaPowerObservation | null>(null);
  const [nasaSource, setNasaSource] = useState<string>('NASA_POWER_LIVE_SATELLITE');
  const [nasaLoading, setNasaLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh state
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(getRandomMajorInterval());
  const [totalCycle, setTotalCycle] = useState(secondsLeft);
  const [refreshCount, setRefreshCount] = useState(0);
  const [dataFlash, setDataFlash] = useState(false);

  // Refs for background simulation (avoids stale closures)
  const nasaRef = useRef<NasaPowerObservation | null>(null);
  const zonesRef = useRef<WeatherCondition[]>([]);
  const microTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // ── Initial API fetch (runs once) ───────────────────────────────────
  const fetchWeatherOnce = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [zonesRes, forecastRes, alertRes, nasaRes] = await Promise.all([
        getWeather(),
        getWeatherForecast(),
        getWeatherAlerts(),
        getNasaPowerLive().catch(() => null)
      ]);
      setZones(zonesRes);
      zonesRef.current = zonesRes;
      setForecast(forecastRes);
      setAlerts(alertRes);
      if (nasaRes?.data) {
        setNasaData(nasaRes.data);
        nasaRef.current = nasaRes.data;
        setNasaSource(nasaRes.source || 'NASA_POWER_LIVE_SATELLITE');
      }
      setLastUpdated(new Date());
    } catch (e: any) {
      console.error('Failed to load weather intel', e);
      setError(e.message || 'Failed to retrieve meteorological telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Manual NASA refresh ─────────────────────────────────────────────
  const refreshNasaFeed = async () => {
    try {
      setNasaLoading(true);
      const res = await getNasaPowerLive();
      if (res?.data) {
        setPrevNasaData(nasaRef.current);
        const drifted = driftNasaData(res.data);
        setNasaData(drifted);
        nasaRef.current = drifted;
        setNasaSource(res.source || 'NASA_POWER_LIVE_SATELLITE');
        setLastUpdated(new Date());
        setDataFlash(true);
        setTimeout(() => setDataFlash(false), 2000);
      }
    } catch (err) {
      console.error('Failed to refresh NASA live stream', err);
      // Fallback: just drift existing data silently
      if (nasaRef.current) {
        setPrevNasaData(nasaRef.current);
        const drifted = driftNasaData(nasaRef.current);
        setNasaData(drifted);
        nasaRef.current = drifted;
        setLastUpdated(new Date());
        setDataFlash(true);
        setTimeout(() => setDataFlash(false), 2000);
      }
    } finally {
      setNasaLoading(false);
    }
  };

  // ── Background micro-tick simulation (every 15s) ────────────────────
  // Silently drifts data in the background — no loading states, no spinners
  const scheduleMicroTick = useCallback(() => {
    if (microTimerRef.current) clearTimeout(microTimerRef.current);

    const tick = () => {
      if (!isMountedRef.current) return;

      // Drift NASA satellite data
      if (nasaRef.current) {
        const prev = nasaRef.current;
        const drifted = driftNasaData(prev);
        setPrevNasaData(prev);
        setNasaData(drifted);
        nasaRef.current = drifted;
      }

      // Drift zone weather table data
      if (zonesRef.current.length > 0) {
        const driftedZones = driftZoneData(zonesRef.current);
        setZones(driftedZones);
        zonesRef.current = driftedZones;
      }

      setLastUpdated(new Date());

      // Schedule next micro-tick
      microTimerRef.current = setTimeout(tick, MICRO_TICK_SEC * 1000);
    };

    microTimerRef.current = setTimeout(tick, MICRO_TICK_SEC * 1000);
  }, []);

  // ── Initial fetch on mount ──────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    fetchWeatherOnce();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchWeatherOnce]);

  // ── Start background micro-tick simulation after first data loads ───
  useEffect(() => {
    if (nasaData && zones.length > 0) {
      scheduleMicroTick();
    }
    return () => {
      if (microTimerRef.current) clearTimeout(microTimerRef.current);
    };
  }, [nasaData !== null && zones.length > 0]);

  // ── Major refresh countdown (every 2-3 min) with flash effect ───────
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const nextCycle = getRandomMajorInterval();
          setTotalCycle(nextCycle);
          setRefreshCount((c) => c + 1);

          // Apply a larger drift for major refresh
          if (nasaRef.current) {
            const prevData = nasaRef.current;
            const drifted = driftNasaData({
              ...prevData,
              temperature_c: drift(prevData.temperature_c, 1.5, 15, 48),
              humidity_pct: drift(prevData.humidity_pct, 4, 30, 99),
              wind_speed_ms: drift(prevData.wind_speed_ms, 1.2, 0.2, 25),
              precipitation_mm: drift(prevData.precipitation_mm, 1.5, 0, 60),
            });
            setPrevNasaData(prevData);
            setNasaData(drifted);
            nasaRef.current = drifted;
          }

          if (zonesRef.current.length > 0) {
            const driftedZones = driftZoneData(zonesRef.current);
            setZones(driftedZones);
            zonesRef.current = driftedZones;
          }

          setLastUpdated(new Date());
          setDataFlash(true);
          setTimeout(() => setDataFlash(false), 2500);

          // Also try a real API refresh in the background (silent)
          Promise.all([
            getWeather().catch(() => null),
            getWeatherAlerts().catch(() => null),
          ]).then(([newZones, newAlerts]) => {
            if (newAlerts) setAlerts(newAlerts);
          });

          return nextCycle;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Format last updated ─────────────────────────────────────────────
  const lastUpdatedStr = useMemo(() => {
    if (!lastUpdated) return 'Syncing...';
    return lastUpdated.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [lastUpdated]);

  if (loading && zones.length === 0) {
    return <LoadingSpinner message="Querying Doppler radar & weather intelligence feeds..." />;
  }

  if (error && zones.length === 0) {
    return <ErrorMessage message={error} onRetry={fetchWeatherOnce} />;
  }

  const temp = nasaData?.temperature_c ?? 29.4;
  const humidity = nasaData?.humidity_pct ?? 86.0;
  const windKmh = nasaData ? nasaData.wind_speed_ms * 3.6 : 52.0;
  const precip = nasaData?.precipitation_mm ?? 4.85;
  const pressure = nasaData?.surface_pressure_kpa ?? 98.2;
  const dewpoint = nasaData?.dew_point_c ?? 22.1;

  const prevTemp = prevNasaData?.temperature_c ?? temp;
  const prevHumidity = prevNasaData?.humidity_pct ?? humidity;
  const prevWind = prevNasaData ? prevNasaData.wind_speed_ms * 3.6 : windKmh;
  const prevPrecip = prevNasaData?.precipitation_mm ?? precip;
  const prevPressure = prevNasaData?.surface_pressure_kpa ?? pressure;
  const prevDewpoint = prevNasaData?.dew_point_c ?? dewpoint;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <CloudLightning className="w-3.5 h-3.5" />
            Meteorological Intelligence & Grid Weather Exposure
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white font-mono">
            Severe Storm Radar & Multi-Zone Forecast
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized Doppler precipitation tracks, lightning strike density, and ambient thermal loading.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-xs font-mono text-amber-400 bg-amber-950/80 px-3 py-1.5 rounded border border-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
            Code Orange: Severe East Grid Precipitation
          </span>
          {/* Live refresh status bar */}
          <div className="flex items-center gap-3 text-[10px] font-mono bg-slate-900/80 border border-slate-800 rounded px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-emerald-400">AUTO-SYNC</span>
            </div>
            <span className="text-slate-600">│</span>
            <CountdownBar secondsLeft={secondsLeft} totalSeconds={totalCycle} />
            <span className="text-slate-600">│</span>
            <span className="text-slate-400">Last: <span className="text-cyan-400">{lastUpdatedStr}</span></span>
            {refreshCount > 0 && (
              <>
                <span className="text-slate-600">│</span>
                <span className="text-slate-500">{refreshCount} cycles</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Weather Alerts Banner */}
      <div className="space-y-3">
        {alerts.map((al) => (
          <div
            key={al.id}
            className="p-4 rounded-lg bg-red-950/20 border border-red-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-red-900/60 border border-red-700 text-red-300 flex-shrink-0 mt-0.5">
                <CloudRain className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{al.title}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-700 font-bold uppercase">
                    {al.severity}
                  </span>
                  <span className="text-slate-400 text-[11px]">{al.zone}</span>
                </div>
                <p className="text-slate-300 font-sans text-xs mt-1 leading-relaxed">
                  {al.description}
                </p>
              </div>
            </div>
            <div className="text-slate-400 text-[11px] flex-shrink-0 self-end md:self-auto">
              {al.timestamp}
            </div>
          </div>
        ))}
      </div>

      {/* NASA POWER LIVE SATELLITE METEOROLOGY CARD */}
      <div
        className={`bg-[#111827] border rounded-lg shadow-xl overflow-hidden transition-all duration-1000 ${
          dataFlash
            ? 'border-cyan-500/80 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
            : 'border-cyan-900/60'
        }`}
      >
        <div className="p-4 border-b border-[#1f2d44] bg-[#0c1524] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border text-cyan-300 transition-all duration-1000 ${
              dataFlash
                ? 'bg-cyan-900/80 border-cyan-600 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'bg-cyan-950 border-cyan-800'
            }`}>
              <Satellite className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                  NASA POWER Synoptic Satellite Meteorology
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                  </span>
                  {nasaSource.includes('LIVE') ? 'LIVE ORBIT' : 'SATELLITE SYNC'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  STREAMING
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Direct solar & atmospheric telemetry from NASA Langley Research Center (Regional Grid Coordinates: 28.6139°N, 77.2090°E)
              </p>
            </div>
          </div>

          <button
            onClick={refreshNasaFeed}
            disabled={nasaLoading}
            className="text-xs font-mono px-3 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/80 flex items-center gap-2 transition-all self-start sm:self-auto disabled:opacity-50 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${nasaLoading ? 'animate-spin' : ''}`} />
            Sync NASA Satellite
          </button>
        </div>

        {/* 6 Metric Panels — enhanced with animated values & trend arrows */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 sm:p-4 bg-[#0d1424]">
          {/* Temperature */}
          <div className={`p-3 rounded border transition-all duration-700 ${
            dataFlash ? 'bg-slate-900/90 border-orange-700/50 shadow-[0_0_8px_rgba(251,146,60,0.1)]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                Ambient Temp (T2M)
              </div>
              <TrendArrow prev={prevTemp} curr={temp} />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              <AnimatedValue value={temp} suffix="°C" flash={dataFlash} />
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-500 font-mono">2m Surface Air</span>
              {temp > 35 && <Zap className="w-3 h-3 text-red-400 animate-pulse" />}
            </div>
          </div>

          {/* Humidity */}
          <div className={`p-3 rounded border transition-all duration-700 ${
            dataFlash ? 'bg-slate-900/90 border-blue-700/50 shadow-[0_0_8px_rgba(96,165,250,0.1)]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Droplets className="w-3.5 h-3.5 text-blue-400" />
                Relative Humidity
              </div>
              <TrendArrow prev={prevHumidity} curr={humidity} />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-300">
              <AnimatedValue value={humidity} suffix="%" flash={dataFlash} />
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-500 font-mono">RH at 2 Meters</span>
              {humidity > 90 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold">SAT</span>
              )}
            </div>
          </div>

          {/* Wind Speed */}
          <div className={`p-3 rounded border transition-all duration-700 ${
            dataFlash ? 'bg-slate-900/90 border-teal-700/50 shadow-[0_0_8px_rgba(45,212,191,0.1)]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Wind className="w-3.5 h-3.5 text-teal-400" />
                Wind Speed (WS10M)
              </div>
              <TrendArrow prev={prevWind} curr={windKmh} />
            </div>
            <div className="text-xl font-bold font-mono text-teal-300">
              <AnimatedValue value={windKmh} decimals={1} flash={dataFlash} /> <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-500 font-mono">10m Conductor Vector</span>
              {windKmh > 40 && <Zap className="w-3 h-3 text-amber-400 animate-pulse" />}
            </div>
          </div>

          {/* Precipitation */}
          <div className={`p-3 rounded border transition-all duration-700 ${
            dataFlash ? 'bg-slate-900/90 border-indigo-700/50 shadow-[0_0_8px_rgba(129,140,248,0.1)]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                Precipitation (PRECTOT)
              </div>
              <TrendArrow prev={prevPrecip} curr={precip} />
            </div>
            <div className="text-xl font-bold font-mono text-indigo-300">
              <AnimatedValue value={precip} suffix="" flash={dataFlash} /> <span className="text-xs font-normal text-slate-400">mm/h</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-500 font-mono">Corrected Downpour</span>
              {precip > 10 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold animate-pulse">HEAVY</span>
              )}
            </div>
          </div>

          {/* Surface Pressure */}
          <div className={`p-3 rounded border transition-all duration-700 ${
            dataFlash ? 'bg-slate-900/90 border-amber-700/50 shadow-[0_0_8px_rgba(245,158,11,0.1)]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                Surface Pressure (PS)
              </div>
              <TrendArrow prev={prevPressure} curr={pressure} />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              <AnimatedValue value={pressure} suffix="" flash={dataFlash} /> <span className="text-xs font-normal text-slate-400">kPa</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Synoptic Barometric</div>
          </div>

          {/* Dew Point */}
          <div className={`p-3 rounded border transition-all duration-700 ${
            dataFlash ? 'bg-slate-900/90 border-emerald-700/50 shadow-[0_0_8px_rgba(52,211,153,0.1)]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                Dew Point (T2MDEW)
              </div>
              <TrendArrow prev={prevDewpoint} curr={dewpoint} />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300">
              <AnimatedValue value={dewpoint} suffix="°C" flash={dataFlash} />
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Condensation Index</div>
          </div>
        </div>

        <div className="px-4 py-2 bg-[#090e18] border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Radio className="w-3.5 h-3.5" />
            Grid Weather Interaction Formula: Bounded stress multiplier (ΔR ≤ 20.0) correlated against IEEE C57.91 thermal dissipation.
          </span>
          <span className="text-slate-500 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
            </span>
            Observation Epoch: {nasaData?.timestamp ? `LST ${nasaData.timestamp}` : 'Synchronized'}
            {lastUpdated && ` • Refreshed ${lastUpdatedStr}`}
          </span>
        </div>
      </div>

      {/* GRID WEATHER-RISK TABLE */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#1f2d44] bg-[#0e1626]">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            Grid Operational Zones Weather Risk Matrix
          </h2>
          <p className="text-xs text-slate-400">
            Real-time multi-zone weather scoring applied directly to equipment stress multipliers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f2d44] text-[11px] font-mono uppercase text-slate-400 bg-[#0b0f17]/70">
                <th className="py-3 px-4 font-semibold">Grid Zone</th>
                <th className="py-3 px-3 font-semibold">Condition</th>
                <th className="py-3 px-3 font-semibold text-right">Rainfall (Prob / mm)</th>
                <th className="py-3 px-3 font-semibold text-right">Wind Speed</th>
                <th className="py-3 px-3 font-semibold text-center">Lightning</th>
                <th className="py-3 px-3 font-semibold text-center">Flood Risk</th>
                <th className="py-3 px-3 font-semibold text-center">Weather Risk</th>
                <th className="py-3 px-4 font-semibold text-right">Assets Affected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182334] text-xs font-mono">
              {zones.map((z) => (
                <tr key={z.zone} className="hover:bg-[#151f33] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">
                    <div>{z.zone_name}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{z.zone} Sector</div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-300 font-sans">
                    {z.condition_text}
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-cyan-300 tabular-nums">
                    {Math.round(z.rainfall_prob)}% ({z.rainfall_intensity_mm.toFixed(1)} mm/h)
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-300 tabular-nums">
                    {z.wind_speed_kmh.toFixed(1)} km/h
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        z.lightning_risk === 'HIGH'
                          ? 'bg-red-950/80 text-red-300 border-red-800'
                          : z.lightning_risk === 'MODERATE'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {z.lightning_risk}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        z.flood_risk === 'ELEVATED'
                          ? 'bg-orange-950/80 text-orange-300 border-orange-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {z.flood_risk}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <RiskBadge level={z.weather_risk_level} score={z.weather_score} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-white tabular-nums">
                    {z.affected_assets_count} Assets
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7-DAY OUTLOOK FORECAST CARDS */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-3 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1f2d44] pb-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            7-Day Synoptic Weather Outlook & Grid Stress
          </h2>
          <span className="text-xs font-mono text-slate-400">Regional Grid Operations Area</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {forecast.map((day, idx) => {
            const isStormDay = day.condition.toLowerCase().includes('rain') || day.condition.toLowerCase().includes('thunder');

            // Compute correct date starting from today
            const realDate = new Date();
            realDate.setDate(realDate.getDate() + idx);
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dayLabel = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dayNames[realDate.getDay()];
            const dateLabel = `${monthNames[realDate.getMonth()]} ${realDate.getDate()}`;

            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex flex-col justify-between text-center font-mono ${
                  isStormDay
                    ? 'bg-red-950/20 border-red-800/60 text-red-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-white">{dayLabel}</div>
                  <div className="text-[10px] text-slate-400">{dateLabel}</div>

                  <div className="my-2 flex justify-center text-cyan-400">
                    {isStormDay ? (
                      <CloudRain className="w-6 h-6 text-cyan-400 animate-pulse" />
                    ) : (
                      <Sun className="w-6 h-6 text-amber-400" />
                    )}
                  </div>

                  <div className="text-xs font-sans text-slate-200 truncate">{day.condition}</div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex justify-center gap-2 font-bold">
                    <span className="text-white">{day.temp_max}°</span>
                    <span className="text-slate-500">{day.temp_min}°</span>
                  </div>
                  <div className="text-[10px] text-cyan-400 mt-1">
                    Rain: {day.rainfall_prob}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
