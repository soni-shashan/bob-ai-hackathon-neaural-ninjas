import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Cpu,
  AlertTriangle,
  Users,
  CloudLightning,
  Activity,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { KPICard } from '../components/common/KPICard';
import { RiskBadge } from '../components/common/RiskBadge';
import { SchematicGridMap } from '../components/dashboard/SchematicGridMap';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import {
  getDashboardSummary,
  getAssets,
  getRiskTrend,
  getActiveAlerts,
  getDemoState
} from '../services/api';
import {
  DashboardSummary,
  AssetSummary,
  RiskTrendPoint,
  AlertNotification,
  DemoStateResponse
} from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topAssets, setTopAssets] = useState<AssetSummary[]>([]);
  const [trendData, setTrendData] = useState<RiskTrendPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [demoState, setDemoState] = useState<DemoStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sumRes, assetRes, trendRes, alertRes, demoRes] = await Promise.all([
        getDashboardSummary(),
        getAssets({ sort: 'risk_desc', limit: 6 }),
        getRiskTrend(),
        getActiveAlerts(),
        getDemoState()
      ]);

      setSummary(sumRes);
      setTopAssets(assetRes.items);
      setTrendData(trendRes);
      setAlerts(alertRes);
      setDemoState(demoRes);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to connect to GridGuard backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [context?.refreshTrigger]);

  if (loading && !summary) {
    return <LoadingSpinner message="Connecting to Western Grid SCADA & ML Predictor..." />;
  }

  if (error && !summary) {
    return <ErrorMessage message={error} onRetry={loadData} />;
  }

  const tr104Risk = demoState?.risk_score ?? 94;

  return (
    <div className="space-y-6">
      {/* Page Title & Operational Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Activity className="w-3.5 h-3.5" />
            Grid Operational Command Center
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Ahmedabad Regional Grid Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry, predictive failure analytics, and weather-stress correlations.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#111827] border border-[#1f2d44] px-4 py-2 rounded-lg">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Grid Health Score
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 flex items-baseline gap-1">
              78<span className="text-xs text-slate-400 font-normal">/100</span>
            </div>
          </div>
          <div className="border-l border-slate-800 pl-4 text-right">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Telemetry Status
            </div>
            <div className="text-xs font-mono text-cyan-400 flex items-center justify-end gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              2 min ago
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Monitored Assets"
          value={summary?.total_assets ?? 248}
          subtitle="400kV / 220kV / 66kV"
          icon={Cpu}
          trend={{ text: '100% Online', isGood: true }}
        />
        <KPICard
          title="Critical Assets"
          value={summary?.critical_assets ?? 7}
          subtitle="Immediate action required"
          icon={AlertTriangle}
          badge={{ text: 'Urgent', variant: 'danger' }}
          trend={{ text: '+2 in 6 hrs', isGood: false }}
        />
        <KPICard
          title="High Risk Assets"
          value={summary?.high_risk_assets ?? 19}
          subtitle="Elevated failure metrics"
          icon={ShieldAlert}
          badge={{ text: 'Watch', variant: 'warning' }}
        />
        <KPICard
          title="Customers at Risk"
          value={(summary?.customers_at_risk ?? 84230).toLocaleString()}
          subtitle="Downstream accounts"
          icon={Users}
          trend={{ text: 'Eastern zone', isGood: false }}
        />
        <KPICard
          title="Weather Alerts"
          value={summary?.active_weather_alerts ?? 3}
          subtitle="Severe rain & storm cells"
          icon={CloudLightning}
          badge={{ text: 'Active', variant: 'warning' }}
          trend={{ text: 'East Grid Zone', isGood: false }}
        />
      </div>

      {/* Schematic Geographic Grid Risk Topology */}
      <SchematicGridMap currentDemoRisk={tr104Risk} highlightAssetId="TR-104" />

      {/* Dual Column: Top Risk Assets Table & 24h Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Risk Assets (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#1f2d44] flex items-center justify-between bg-[#0e1626]">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Priority Grid Risk Equipment
              </h2>
              <p className="text-xs text-slate-400">
                Highest failure likelihood and customer exposure rankings.
              </p>
            </div>
            <button
              onClick={() => navigate('/assets')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              All Assets (248)
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f2d44] text-[11px] font-mono uppercase text-slate-400 bg-[#0b0f17]/60">
                  <th className="py-2.5 px-4 font-semibold">Asset</th>
                  <th className="py-2.5 px-3 font-semibold">Location</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Risk</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Fail Prob</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Customers</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182334] text-xs font-mono">
                {topAssets.map((asset) => {
                  const isDemo = asset.id === 'TR-104';
                  const risk = isDemo ? tr104Risk : asset.risk_score;
                  const prob = isDemo
                    ? (demoState?.failure_probability ?? asset.failure_probability)
                    : asset.failure_probability;

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="hover:bg-[#151f33] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-bold text-white group-hover:text-cyan-300 flex items-center gap-2">
                        {asset.id}
                        {isDemo && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans truncate max-w-[140px]">
                        {asset.location}
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        <span
                          className={
                            risk >= 85
                              ? 'text-red-400 font-extrabold'
                              : risk >= 65
                              ? 'text-orange-400'
                              : 'text-amber-400'
                          }
                        >
                          {risk}
                        </span>
                        <span className="text-slate-600 text-[10px]">/100</span>
                      </td>
                      <td className="py-3 px-3 text-right text-rose-300 font-bold tabular-nums">
                        {Math.round(prob * 100)}%
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                        {asset.customers_affected.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <RiskBadge
                          level={risk >= 85 ? 'CRITICAL' : risk >= 65 ? 'HIGH' : 'MODERATE'}
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 24-Hour Risk Trend Chart (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#1f2d44] flex items-center justify-between bg-[#0e1626]">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                24-Hour Grid Risk Trend
              </h2>
              <p className="text-xs text-rose-400 font-mono font-medium flex items-center gap-1 mt-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Risk increased by 14% in the last 6 hours
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              Mean Risk Index
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-center min-h-[260px]">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2d44" vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  fontFamily="JetBrains Mono, monospace"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[40, 85]}
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
                  formatter={(value: any) => [`${value}/100`, 'Avg Risk Score']}
                />
                <Area
                  type="monotone"
                  dataKey="avg_risk_score"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#riskTrendGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono">
              <span>00:00 (52.4)</span>
              <span>12:00 (65.1)</span>
              <span className="text-rose-400 font-bold">23:00 (75.1 Peak)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Section */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-[#1f2d44] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Active Operational & Meteorological Alerts
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            3 Active Alarms Triggered
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Critical TR-104 */}
          <div
            onClick={() => navigate('/assets/TR-104')}
            className="p-4 rounded-lg bg-red-950/20 border border-red-800/60 hover:border-red-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-red-900/60 text-red-200 border border-red-700">
                CRITICAL
              </span>
              <span className="text-[10px] text-slate-400 font-mono">19:15 UTC</span>
            </div>
            <h3 className="text-xs font-bold text-white group-hover:text-red-300 font-mono">
              Transformer TR-104 (Naroda Substation)
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Partial discharge anomaly (+31%) detected with winding temp at 91.2°C. Heavy rainfall expected within 24 hours.
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-cyan-400">
              <span>View Action Plan →</span>
              <span className="text-red-400 font-bold">Risk: {tr104Risk}/100</span>
            </div>
          </div>

          {/* Card 2: High TR-087 */}
          <div
            onClick={() => navigate('/assets/TR-087')}
            className="p-4 rounded-lg bg-orange-950/20 border border-orange-800/60 hover:border-orange-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-orange-900/60 text-orange-200 border border-orange-700">
                HIGH
              </span>
              <span className="text-[10px] text-slate-400 font-mono">18:40 UTC</span>
            </div>
            <h3 className="text-xs font-bold text-white group-hover:text-orange-300 font-mono">
              Transformer TR-087 (Vatva Substation)
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Winding temperature rising 15°C above historical 7-day baseline under continuous heavy industrial feeder load.
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-cyan-400">
              <span>View Diagnostics →</span>
              <span className="text-orange-400 font-bold">Risk: 91/100</span>
            </div>
          </div>

          {/* Card 3: Weather Storm */}
          <div
            onClick={() => navigate('/weather')}
            className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/60 hover:border-amber-600 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700">
                WEATHER WATCH
              </span>
              <span className="text-[10px] text-slate-400 font-mono">18:10 UTC</span>
            </div>
            <h3 className="text-xs font-bold text-white group-hover:text-amber-300 font-mono">
              Eastern Grid Zone Storm Front
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Severe thunderstorm forecast with 48.5 mm/h downpours and 52 km/h wind gusts threatening Naroda and Odhav substations.
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-cyan-400">
              <span>View Weather Matrix →</span>
              <span className="text-amber-400 font-bold">18 Assets Exposed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
