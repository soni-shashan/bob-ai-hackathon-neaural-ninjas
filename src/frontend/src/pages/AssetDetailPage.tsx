import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  Cpu,
  AlertTriangle,
  Thermometer,
  Activity,
  Zap,
  Droplet,
  CloudRain,
  Users,
  ShieldCheck,
  Clock,
  Wrench,
  ChevronLeft,
  Calendar,
  AlertCircle,
  Building2,
  HeartPulse,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import {
  getAsset,
  getSensorData,
  getAssetRisk,
  getIncidents
} from '../services/api';
import {
  AssetSummary,
  AssetSensorsResponse,
  RiskAnalysisResponse,
  HistoricalIncident
} from '../types';

export const AssetDetailPage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [asset, setAsset] = useState<AssetSummary | null>(null);
  const [sensors, setSensors] = useState<AssetSensorsResponse | null>(null);
  const [risk, setRisk] = useState<RiskAnalysisResponse | null>(null);
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSensorTab, setActiveSensorTab] = useState<'temperature' | 'vibration' | 'partial_discharge' | 'oil_quality' | 'load'>('partial_discharge');

  const currentAssetId = assetId || 'TR-104';

  const loadAssetData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [assetRes, sensorRes, riskRes, incidentRes] = await Promise.all([
        getAsset(currentAssetId),
        getSensorData(currentAssetId),
        getAssetRisk(currentAssetId),
        getIncidents({ asset_id: currentAssetId })
      ]);

      setAsset(assetRes);
      setSensors(sensorRes);
      setRisk(riskRes);
      setIncidents(incidentRes);
    } catch (err: any) {
      console.error('Failed to load asset details:', err);
      setError(err.message || 'Error loading asset diagnostic data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssetData();
  }, [currentAssetId, context?.refreshTrigger]);

  if (loading && !asset) {
    return <LoadingSpinner message={`Loading SCADA diagnostics for ${currentAssetId}...`} />;
  }

  if (error || !asset) {
    return <ErrorMessage message={error || 'Asset not found.'} onRetry={loadAssetData} />;
  }

  // Active chart data selection
  const currentSensorPoints = sensors ? (sensors[activeSensorTab] || []) : [];
  const latestSensorValue = currentSensorPoints.length > 0 ? currentSensorPoints[currentSensorPoints.length - 1].value : 0;

  const latestSensorPoints = {
    pd: sensors?.partial_discharge?.length ? sensors.partial_discharge[sensors.partial_discharge.length - 1].value : 18.0,
    temp: sensors?.temperature?.length ? sensors.temperature[sensors.temperature.length - 1].value : 72.0,
    vib: sensors?.vibration?.length ? sensors.vibration[sensors.vibration.length - 1].value : 2.5,
    oil: sensors?.oil_quality?.length ? sensors.oil_quality[sensors.oil_quality.length - 1].value : 80.0,
    load: sensors?.load?.length ? sensors.load[sensors.load.length - 1].value : (asset.load_mw || 42.0),
  };

  // Formatting chart points for readable hour labels
  const formattedChartData = currentSensorPoints.map((p, idx) => {
    const d = new Date(p.timestamp);
    const hourLabel = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return {
      time: hourLabel,
      value: p.value,
      baseline: p.baseline,
      threshold_warning: p.threshold_warning,
      threshold_critical: p.threshold_critical
    };
  });

  const riskScore = risk?.risk_score ?? asset.risk_score;
  const failureProb = risk?.failure_probability ?? asset.failure_probability;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        {/* Left: Asset Title & Metadata */}
        <div className="space-y-1">
          <button
            onClick={() => navigate('/assets')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Grid Fleet
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-white tracking-tight leading-snug">
              {asset.name}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 flex-shrink-0">
              {asset.id}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>{asset.location}</span>
            <span>•</span>
            <span>{asset.type}</span>
            <span>•</span>
            <span>Installed {asset.installed_date}</span>
          </p>
        </div>

        {/* Right: Actions & Live Risk Hero Card */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-shrink-0">
          <button
            onClick={() => navigate(`/tickets?asset_id=${asset.id}`)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold text-xs transition-colors shadow-lg shadow-amber-950/40 flex-shrink-0"
          >
            <Wrench className="w-4 h-4" />
            <span>Raise Maintenance Ticket</span>
          </button>

          {/* Live Risk Hero Card */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-4 bg-[#111827] border border-[#1f2d44] p-3 rounded-lg shadow-lg flex-shrink-0">
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Composite Failure Risk
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-extrabold font-mono tabular-nums ${
                    riskScore >= 85 ? 'text-red-400' : riskScore >= 65 ? 'text-orange-400' : 'text-amber-400'
                  }`}
                >
                  {riskScore}
                </span>
                <span className="text-xs text-slate-500 font-mono">/100</span>
                <RiskBadge level={risk?.risk_level || 'CRITICAL'} size="sm" showPulse />
              </div>
            </div>

            <div className="sm:border-l sm:border-slate-800 sm:pl-4">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Failure Likelihood
              </div>
              <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                {Math.round(failureProb * 100)}%
              </div>
            </div>

            <div className="border-l border-slate-800 pl-4 hidden sm:block">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Estimated Failure Window
              </div>
              <div className="text-xs font-mono text-amber-300 font-semibold mt-1">
                {risk?.estimated_failure_window || 'Next 24–72 hours'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SENSOR TIME-SERIES CHARTS SECTION */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden">
        {/* Sensor Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#1f2d44] bg-[#0e1626] px-4 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveSensorTab('partial_discharge')}
              className={`px-3 py-2 text-xs font-mono font-medium rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
                activeSensorTab === 'partial_discharge'
                  ? 'bg-[#111827] text-cyan-300 border-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Partial Discharge (pC)
              <span className="text-[10px] px-1 rounded bg-red-950/80 text-red-300 border border-red-800">
                CRITICAL
              </span>
            </button>

            <button
              onClick={() => setActiveSensorTab('temperature')}
              className={`px-3 py-2 text-xs font-mono font-medium rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
                activeSensorTab === 'temperature'
                  ? 'bg-[#111827] text-cyan-300 border-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5 text-orange-400" />
              Winding Temp (°C)
              <span className="text-[10px] px-1 rounded bg-orange-950/80 text-orange-300 border border-orange-800">
                HIGH
              </span>
            </button>

            <button
              onClick={() => setActiveSensorTab('vibration')}
              className={`px-3 py-2 text-xs font-mono font-medium rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
                activeSensorTab === 'vibration'
                  ? 'bg-[#111827] text-cyan-300 border-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              Vibration (mm/s)
              <span className="text-[10px] px-1 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                HIGH
              </span>
            </button>

            <button
              onClick={() => setActiveSensorTab('oil_quality')}
              className={`px-3 py-2 text-xs font-mono font-medium rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
                activeSensorTab === 'oil_quality'
                  ? 'bg-[#111827] text-cyan-300 border-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Droplet className="w-3.5 h-3.5 text-blue-400" />
              Oil Quality Index
            </button>

            <button
              onClick={() => setActiveSensorTab('load')}
              className={`px-3 py-2 text-xs font-mono font-medium rounded-t-md transition-all flex items-center gap-2 border-b-2 ${
                activeSensorTab === 'load'
                  ? 'bg-[#111827] text-cyan-300 border-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Feeder Load (MW)
            </button>
          </div>

          <div className="pb-2 text-xs font-mono text-slate-400">
            Current Telemetry: <strong className="text-white text-sm">{latestSensorValue}</strong>
          </div>
        </div>

        {/* Telemetry Chart Canvas */}
        <div className="p-4 bg-[#0d1424]">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-cyan-400"></span> Sensor Trend (24h)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-500 stroke-dasharray"></span> 7-Day Baseline
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-red-500 stroke-dasharray"></span> Critical Limit
              </span>
            </span>
            <span className="text-slate-500">100 Samples • 15m intervals</span>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={formattedChartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2d44" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                fontFamily="JetBrains Mono, monospace"
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                fontFamily="JetBrains Mono, monospace"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0d1522',
                  borderColor: '#334155',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#f8fafc'
                }}
              />
              <ReferenceLine
                y={formattedChartData[0]?.baseline}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: 'Baseline', fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }}
              />
              <ReferenceLine
                y={formattedChartData[0]?.threshold_critical}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'Critical Limit', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#ef4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* THREE-COLUMN DIAGNOSTIC GRID: Health Breakdown, Risk Explanation, Weather & Grid Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Column 1: Asset Health Score Diagnostic */}
        <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-3 sm:p-5 shadow-xl space-y-4">
          <div className="border-b border-[#1f2d44] pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-cyan-400" />
              Asset Health Diagnostic
            </h2>
            <span className="text-sm font-bold font-mono text-red-400">
              {asset.health_score}/100
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Multi-factor condition assessment calculated from acoustic partial discharge, infrared thermography, and dissolved gas analysis:
          </p>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-slate-300">Partial Discharge</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                latestSensorPoints.pd >= 35 ? 'bg-red-950 text-red-300 border-red-800' :
                latestSensorPoints.pd >= 25 ? 'bg-orange-950 text-orange-300 border-orange-800' :
                'bg-emerald-950 text-emerald-300 border-emerald-800'
              }`}>
                {latestSensorPoints.pd >= 35 ? 'CRITICAL' : latestSensorPoints.pd >= 25 ? 'ELEVATED' : 'NOMINAL'} ({latestSensorPoints.pd.toFixed(1)} pC)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-slate-300">Winding & Oil Temp</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                latestSensorPoints.temp >= 85 ? 'bg-red-950 text-red-300 border-red-800' :
                latestSensorPoints.temp >= 75 ? 'bg-orange-950 text-orange-300 border-orange-800' :
                'bg-emerald-950 text-emerald-300 border-emerald-800'
              }`}>
                {latestSensorPoints.temp >= 85 ? 'CRITICAL' : latestSensorPoints.temp >= 75 ? 'HIGH' : 'NOMINAL'} ({latestSensorPoints.temp.toFixed(1)}°C)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-slate-300">Vibration Amplitude</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                latestSensorPoints.vib >= 6.5 ? 'bg-red-950 text-red-300 border-red-800' :
                latestSensorPoints.vib >= 4.5 ? 'bg-amber-950 text-amber-300 border-amber-800' :
                'bg-emerald-950 text-emerald-300 border-emerald-800'
              }`}>
                {latestSensorPoints.vib >= 6.5 ? 'HIGH' : latestSensorPoints.vib >= 4.5 ? 'MODERATE' : 'NORMAL'} ({latestSensorPoints.vib.toFixed(1)} mm/s)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-slate-300">Dielectric Oil Condition</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                latestSensorPoints.oil <= 55 ? 'bg-red-950 text-red-300 border-red-800' :
                latestSensorPoints.oil <= 65 ? 'bg-amber-950 text-amber-300 border-amber-800' :
                'bg-emerald-950 text-emerald-300 border-emerald-800'
              }`}>
                {latestSensorPoints.oil <= 55 ? 'DEGRADED' : latestSensorPoints.oil <= 65 ? 'MODERATE' : 'GOOD'} ({latestSensorPoints.oil.toFixed(0)}/100)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-slate-300">Feeder Capacity Draw</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                latestSensorPoints.load >= 65 ? 'bg-orange-950 text-orange-300 border-orange-800' :
                'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {latestSensorPoints.load.toFixed(1)} MW ({((latestSensorPoints.load / (asset.capacity_mva || 100)) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Transparent Risk Explanation */}
        <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl space-y-4">
          <div className="border-b border-[#1f2d44] pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              Why is this asset at risk?
            </h2>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
              Explainable AI
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {risk?.contributing_factors.map((factor, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800/80 text-slate-300"
              >
                <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-snug">{factor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Weather Stress & Grid Impact Breakdown */}
        <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl space-y-4">
          <div className="border-b border-[#1f2d44] pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-amber-400" />
              Weather Stress & Grid Impact
            </h2>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
              HIGH EXPOSURE
            </span>
          </div>

          {/* Risk Decomposition Equation */}
          <div className="p-3 rounded-lg bg-[#0d1522] border border-cyan-900/40 text-xs font-mono space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Risk Decomposition Equation:
            </div>
            <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400">Base Equipment Risk:</span>
              <span className="text-white font-bold">{risk?.base_equipment_risk ?? 68}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-amber-400">+ Weather Stress Delta:</span>
              <span className="text-amber-300 font-bold">+{risk?.weather_stress_delta ?? 26}</span>
            </div>
            <div className="flex items-center justify-between bg-red-950/40 p-2 rounded border border-red-800/80">
              <span className="text-red-300 font-bold">= Final Composite Risk:</span>
              <span className="text-red-400 font-extrabold text-sm">{riskScore}/100</span>
            </div>
          </div>

          {/* Grid Impact Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Customers</span>
              <span className="text-white font-bold text-sm">{asset.customers_affected.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Feeder Load</span>
              <span className="text-white font-bold text-sm">{latestSensorPoints.load.toFixed(1)} MW</span>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Critical Facilities</span>
              <span className="text-cyan-300 font-bold text-xs">{currentAssetId === 'TR-104' ? '2 Hospitals, 3 Water' : 'Municipal Core'}</span>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Grid Zone</span>
              <span className="text-amber-400 font-bold text-xs">{asset.grid_zone || 'East Grid'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RECOMMENDED ACTION PANEL */}
      <div className="bg-gradient-to-br from-[#121c2e] to-[#0f172a] border-2 border-red-700/80 rounded-lg p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700 font-mono text-[10px] font-bold uppercase tracking-wider">
              PRIORITY: IMMEDIATE INTERVENTION
            </span>
            <h2 className="text-lg font-bold text-white font-mono mt-1.5 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-red-400" />
              Automated Maintenance & Pre-positioning Recommendation
            </h2>
          </div>

          <Link
            to="/maintenance"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold shadow-lg shadow-red-900/50 transition-colors"
          >
            Dispatch Crew in Maintenance Planner →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="space-y-2">
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 text-slate-200">
              <strong className="text-cyan-400">1. Inspect Transformer:</strong> Dispatch emergency diagnostic team to {asset.location} within 12 hours.
            </div>
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 text-slate-200">
              <strong className="text-cyan-400">2. Crew Pre-positioning:</strong> Pre-position <strong className="text-white">Crew 2</strong> within 10 km (East Depot staging).
            </div>
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 text-slate-200">
              <strong className="text-cyan-400">3. Diagnostic Tooling:</strong> Prepare oil dissolved gas testing and FLIR thermal camera kits.
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 text-slate-200">
              <strong className="text-cyan-400">4. Load-Transfer Contingency:</strong> Formulate 15 MW load shedding and Central 220kV bus tie transfer.
            </div>
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 text-slate-200">
              <strong className="text-cyan-400">5. Spare Bushings:</strong> Hold replacement 66kV bushings on hot standby in Central Operations Warehouse.
            </div>
            <div className="p-3 rounded bg-emerald-950/40 border border-emerald-800/80 text-emerald-300">
              <strong>Expected Benefit:</strong> Potentially reduce failure probability from 82% to approximately 24% <span className="text-[10px] text-slate-400">(model simulation estimate)</span>.
            </div>
          </div>
        </div>
      </div>

      {/* HISTORICAL INCIDENTS FOR THIS ASSET */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Historical Outage & Maintenance Incidents ({incidents.length})
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Past fault log for {currentAssetId}
          </span>
        </div>

        {incidents.length === 0 ? (
          <p className="text-xs text-slate-400 font-mono py-4 text-center">
            No previous recorded failure incidents for this asset.
          </p>
        ) : (
          <div className="divide-y divide-[#182334] text-xs">
            {incidents.map((inc) => (
              <div key={inc.id} className="py-3.5 space-y-1.5 font-mono">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{inc.failure_type}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded border ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-red-950 text-red-300 border-red-800'
                          : inc.severity === 'HIGH'
                          ? 'bg-orange-950 text-orange-300 border-orange-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px]">{inc.timestamp.slice(0, 10)}</span>
                </div>
                <p className="text-slate-300 font-sans text-xs">
                  <strong>Root Cause:</strong> {inc.root_cause}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                  <span>Duration: <strong className="text-slate-200">{inc.duration_minutes} mins</strong></span>
                  <span>Customers: <strong className="text-slate-200">{inc.customers_affected.toLocaleString()}</strong></span>
                  <span>Weather: <strong className="text-slate-200">{inc.weather_condition}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
