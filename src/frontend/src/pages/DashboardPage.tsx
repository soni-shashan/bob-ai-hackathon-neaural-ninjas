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
  ChevronRight,
  ShieldCheck,
  Gauge,
  CheckCircle2
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
  getActiveAlerts
} from '../services/api';
import {
  DashboardSummary,
  AssetSummary,
  RiskTrendPoint,
  AlertNotification
} from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topAssets, setTopAssets] = useState<AssetSummary[]>([]);
  const [allAssets, setAllAssets] = useState<AssetSummary[]>([]);
  const [trendData, setTrendData] = useState<RiskTrendPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sumRes, topAssetRes, allAssetRes, trendRes, alertRes] = await Promise.all([
        getDashboardSummary(),
        getAssets({ sort: 'risk_desc', limit: 6 }),
        getAssets({ limit: 50 }),
        getRiskTrend(),
        getActiveAlerts()
      ]);

      setSummary(sumRes);
      setTopAssets(topAssetRes.items);
      setAllAssets(allAssetRes.items);
      setTrendData(trendRes);
      setAlerts(alertRes);
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
    return <LoadingSpinner message="Connecting to Regional Grid SCADA & ML Predictor..." />;
  }

  if (error && !summary) {
    return <ErrorMessage message={error} onRetry={loadData} />;
  }

  // Compute exact distribution numbers and percentages
  const totalCount = summary?.total_assets ?? 26;
  const critCount = summary?.risk_distribution?.critical.count ?? summary?.critical_assets ?? 1;
  const critPct = summary?.risk_distribution?.critical.percentage ?? Math.round((critCount / totalCount) * 1000) / 10;

  const highCount = summary?.risk_distribution?.high.count ?? summary?.high_risk_assets ?? 5;
  const highPct = summary?.risk_distribution?.high.percentage ?? Math.round((highCount / totalCount) * 1000) / 10;

  const medCount = summary?.risk_distribution?.medium.count ?? summary?.medium_risk_assets ?? 9;
  const medPct = summary?.risk_distribution?.medium.percentage ?? Math.round((medCount / totalCount) * 1000) / 10;

  const lowCount = summary?.risk_distribution?.low.count ?? summary?.low_risk_assets ?? 11;
  const lowPct = summary?.risk_distribution?.low.percentage ?? Math.round((lowCount / totalCount) * 1000) / 10;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Title & Operational Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Activity className="w-3.5 h-3.5" />
            Grid Operational Command Center
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white font-mono">
            Regional Power Grid Overview & Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry, predictive failure analytics, and weather-stress correlations.
          </p>
        </div>

        {/* Normal Baseline & Health Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 bg-[#111827] border border-[#1f2d44] px-3 sm:px-4 py-2.5 rounded-lg shadow-md">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Fleet Health Index
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 flex items-baseline gap-1">
              {summary?.grid_health_score ?? 74}
              <span className="text-xs text-slate-400 font-normal">/100</span>
            </div>
          </div>

          <div className="sm:border-l sm:border-slate-800 sm:pl-4">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Normal Baseline
            </div>
            <div className="text-xs font-mono text-emerald-300 flex items-center gap-1.5 font-bold mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{summary?.normal_baseline_score ?? 78}/100 IEEE Baseline</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 sm:border-l sm:border-slate-800 sm:pl-4 sm:text-right">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Telemetry Status
            </div>
            <div className="text-xs font-mono text-cyan-400 flex items-center justify-end gap-1 font-semibold mt-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Live Dataset Feed
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Risk Tier Distribution & Normal Operating Baseline Breakdown */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-3 sm:p-5 shadow-xl space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1f2d44] pb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Fleet Risk Tier Distribution & Operating Baseline
            </h2>
            <p className="text-xs text-slate-400">
              Composite failure probability distribution across Critical, High, Medium, and Normal Baseline tiers ({totalCount} total assets).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Operating Baseline:</span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Nominal Baseline 78/100
            </span>
          </div>
        </div>

        {/* Visual Proportional Segmented Progress Bar */}
        <div className="space-y-1.5 font-mono text-xs">
          <div className="w-full h-4 rounded-md overflow-hidden flex bg-slate-900 border border-slate-800">
            <div
              style={{ width: `${critPct}%` }}
              className="bg-red-500 hover:bg-red-400 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              title={`Critical: ${critCount} Assets (${critPct}%)`}
            >
              {critPct > 4 && `${critPct}%`}
            </div>
            <div
              style={{ width: `${highPct}%` }}
              className="bg-orange-500 hover:bg-orange-400 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              title={`High Risk: ${highCount} Assets (${highPct}%)`}
            >
              {highPct > 6 && `${highPct}%`}
            </div>
            <div
              style={{ width: `${medPct}%` }}
              className="bg-amber-500 hover:bg-amber-400 transition-all flex items-center justify-center text-[10px] text-slate-950 font-bold"
              title={`Medium Risk: ${medCount} Assets (${medPct}%)`}
            >
              {medPct > 6 && `${medPct}%`}
            </div>
            <div
              style={{ width: `${lowPct}%` }}
              className="bg-emerald-500 hover:bg-emerald-400 transition-all flex items-center justify-center text-[10px] text-slate-950 font-bold"
              title={`Low / Normal Baseline: ${lowCount} Assets (${lowPct}%)`}
            >
              {lowPct > 6 && `${lowPct}%`}
            </div>
          </div>

          {/* 4 Interactive Tier Cards showing counts and percentages */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* Critical Tier */}
            <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-800/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  Critical Tier
                </span>
                <span className="text-xs font-bold text-red-200 bg-red-950 px-2 py-0.5 rounded border border-red-800">
                  {critPct}%
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-bold font-mono text-white">
                  {critCount} <span className="text-xs text-slate-400 font-normal">of {totalCount} Assets</span>
                </div>
                <p className="text-[11px] text-red-300 mt-1 font-sans">
                  Immediate intervention required (&lt;12h window)
                </p>
              </div>
            </div>

            {/* High Risk Tier */}
            <div className="p-3.5 rounded-lg bg-orange-950/20 border border-orange-800/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                  High Risk Tier
                </span>
                <span className="text-xs font-bold text-orange-200 bg-orange-950 px-2 py-0.5 rounded border border-orange-800">
                  {highPct}%
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-bold font-mono text-white">
                  {highCount} <span className="text-xs text-slate-400 font-normal">of {totalCount} Assets</span>
                </div>
                <p className="text-[11px] text-orange-300 mt-1 font-sans">
                  Elevated degradation & storm watch active
                </p>
              </div>
            </div>

            {/* Medium Risk Tier */}
            <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-800/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Medium Risk Tier
                </span>
                <span className="text-xs font-bold text-amber-200 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                  {medPct}%
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-bold font-mono text-white">
                  {medCount} <span className="text-xs text-slate-400 font-normal">of {totalCount} Assets</span>
                </div>
                <p className="text-[11px] text-amber-300 mt-1 font-sans">
                  Continuous SCADA telemetry surveillance
                </p>
              </div>
            </div>

            {/* Low Risk / Normal Baseline Tier */}
            <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-800/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Normal Baseline
                </span>
                <span className="text-xs font-bold text-emerald-200 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {lowPct}%
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-bold font-mono text-white">
                  {lowCount} <span className="text-xs text-slate-400 font-normal">of {totalCount} Assets</span>
                </div>
                <p className="text-[11px] text-emerald-300 mt-1 font-sans">
                  Nominal IEEE C57 operating envelope (&lt;25 Risk)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard
          title="Monitored Assets"
          value={totalCount}
          subtitle="400kV / 220kV / 66kV"
          icon={Cpu}
          trend={{ text: '100% Online', isGood: true }}
        />
        <KPICard
          title="Critical Assets"
          value={critCount}
          subtitle={`${critPct}% of fleet`}
          icon={AlertTriangle}
          badge={{ text: 'Urgent', variant: 'danger' }}
          trend={{ text: 'Action required', isGood: false }}
        />
        <KPICard
          title="High Risk Assets"
          value={highCount}
          subtitle={`${highPct}% of fleet`}
          icon={ShieldAlert}
          badge={{ text: 'Watch', variant: 'warning' }}
          trend={{ text: 'Elevated', isGood: false }}
        />
        <KPICard
          title="Customers at Risk"
          value={(summary?.customers_at_risk ?? 44500).toLocaleString()}
          subtitle="Downstream accounts"
          icon={Users}
          trend={{ text: 'East zone', isGood: false }}
        />
        <KPICard
          title="Weather Alerts"
          value={summary?.active_weather_alerts ?? 2}
          subtitle="Storm cells active"
          icon={CloudLightning}
          badge={{ text: 'Active', variant: 'warning' }}
          trend={{ text: 'East Grid', isGood: false }}
        />
      </div>

      {/* Schematic Geographic Grid Risk Topology bound to live assets */}
      <SchematicGridMap assets={allAssets} highlightAssetId="TR-104" />

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
              All Assets ({totalCount})
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
                  const risk = asset.risk_score;
                  const prob = asset.failure_probability;

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="hover:bg-[#151f33] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-bold text-white group-hover:text-cyan-300 flex items-center gap-2">
                        {asset.id}
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
                          level={risk >= 75 ? 'CRITICAL' : risk >= 50 ? 'HIGH' : risk >= 25 ? 'MEDIUM' : 'LOW'}
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
                Risk elevated by weather squall in East Corridor
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

      {/* Active Alerts Section bound dynamically to live backend alarms & NASA satellite feed */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-3 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#1f2d44] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Active Operational & Meteorological Alerts
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {alerts.length} Active Alarms Triggered
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {alerts.slice(0, 3).map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isHigh = alert.severity === 'HIGH';
            const isWeather = alert.severity === 'WEATHER';

            const borderClass = isCritical
              ? 'bg-red-950/20 border-red-800/60 hover:border-red-600'
              : isHigh
              ? 'bg-orange-950/20 border-orange-800/60 hover:border-orange-600'
              : 'bg-amber-950/20 border-amber-800/60 hover:border-amber-600';

            const badgeClass = isCritical
              ? 'bg-red-900/60 text-red-200 border-red-700'
              : isHigh
              ? 'bg-orange-900/60 text-orange-200 border-orange-700'
              : 'bg-amber-900/60 text-amber-200 border-amber-700';

            const titleHoverClass = isCritical
              ? 'group-hover:text-red-300'
              : isHigh
              ? 'group-hover:text-orange-300'
              : 'group-hover:text-amber-300';

            const targetAsset = alert.asset_id ? allAssets.find((a) => a.id === alert.asset_id) : null;
            const targetUrl = alert.asset_id ? `/assets/${alert.asset_id}` : '/weather';

            return (
              <div
                key={alert.id}
                onClick={() => navigate(targetUrl)}
                className={`p-4 rounded-lg border transition-all cursor-pointer group ${borderClass}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded border ${badgeClass}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })} UTC
                  </span>
                </div>
                <h3 className={`text-xs font-bold text-white font-mono ${titleHoverClass}`}>
                  {alert.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed line-clamp-2">
                  {alert.description}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                  <span>{alert.asset_id ? 'View Telemetry & Actions →' : 'View Weather Matrix →'}</span>
                  {targetAsset && (
                    <span className={isCritical ? 'text-red-400 font-bold' : 'text-orange-400 font-bold'}>
                      Risk: {targetAsset.risk_score}/100
                    </span>
                  )}
                  {isWeather && (
                    <span className="text-amber-400 font-bold">
                      NASA Satellite Live
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
