import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  MapPin,
  Search,
  CloudLightning,
  AlertTriangle,
  Zap,
  ChevronRight,
  ShieldAlert,
  Users,
  Compass,
  Activity,
  Thermometer,
  Wind,
  Droplets,
  Radio,
  Gauge,
  TrendingUp,
  Eye,
  Layers
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { getAssets, getWeather, subscribeToDashboardStream } from '../services/api';
import { AssetSummary, WeatherCondition } from '../types';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ══════════════════════════════════════════════════════════════════════
// MAP FOCUS CONTROLLER — handles auto-fit, fly-to, and re-center
// ══════════════════════════════════════════════════════════════════════
/** Forces Leaflet to recalculate its container size after React renders */
const MapResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    // Leaflet can't measure container size until React has fully rendered
    const timer = setTimeout(() => map.invalidateSize(), 200);
    const resizeObs = new ResizeObserver(() => map.invalidateSize());
    if (map.getContainer()) resizeObs.observe(map.getContainer());
    return () => { clearTimeout(timer); resizeObs.disconnect(); };
  }, [map]);
  return null;
};

const MapFocusController: React.FC<{
  assets: AssetSummary[];
  selectedAsset: AssetSummary | null;
  focusAllTrigger: number;
}> = ({ assets, selectedAsset, focusAllTrigger }) => {
  const map = useMap();
  const hasInitialFit = React.useRef(false);
  const lastSelectedId = React.useRef<string | null>(null);

  // Auto-focus directly on where we have resources as soon as assets are loaded
  useEffect(() => {
    if (assets.length > 0 && !hasInitialFit.current) {
      const valid = assets.filter((a) => a.latitude && a.longitude);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map((a) => [a.latitude, a.longitude]));
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 12 });
        hasInitialFit.current = true;
      }
    }
  }, [assets, map]);

  // When user clicks "Focus Grid Assets", refit bounds to all resources
  useEffect(() => {
    if (focusAllTrigger > 0 && assets.length > 0) {
      const valid = assets.filter((a) => a.latitude && a.longitude);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map((a) => [a.latitude, a.longitude]));
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 12 });
      }
    }
  }, [focusAllTrigger, assets, map]);

  // When user clicks a different asset marker, fly smoothly to that asset
  useEffect(() => {
    if (selectedAsset && selectedAsset.latitude && selectedAsset.longitude) {
      if (lastSelectedId.current !== null && lastSelectedId.current !== selectedAsset.id) {
        map.flyTo([selectedAsset.latitude, selectedAsset.longitude], 12, { duration: 0.8 });
      }
      lastSelectedId.current = selectedAsset.id;
    }
  }, [selectedAsset, map]);

  return null;
};

// ══════════════════════════════════════════════════════════════════════
// MARKER ICON FACTORY — rich tooltip with asset details
// ══════════════════════════════════════════════════════════════════════
const getAssetIcon = (asset: AssetSummary, isSelected: boolean) => {
  const isCritical = asset.risk_score >= 75 || asset.risk_level === 'CRITICAL';
  const isHigh = !isCritical && (asset.risk_score >= 50 || asset.risk_level === 'HIGH');
  const isMedium = !isCritical && !isHigh && (asset.risk_score >= 25 || asset.risk_level === 'MEDIUM' || asset.risk_level === 'MODERATE');

  const colorClasses = isCritical
    ? 'bg-red-950 text-red-200 border-red-600'
    : isHigh
    ? 'bg-orange-950 text-orange-200 border-orange-600'
    : isMedium
    ? 'bg-amber-950 text-amber-200 border-amber-600'
    : 'bg-slate-900 text-emerald-300 border-emerald-700';

  const typeIcon = asset.type === 'Power Transformer'
    ? '⚡' : asset.type === 'Substation Feeder'
    ? '🔌' : asset.type === 'Circuit Breaker'
    ? '🔧' : '⚙️';

  const healthBarColor = asset.health_score >= 70 ? '#10b981' : asset.health_score >= 40 ? '#f59e0b' : '#ef4444';

  const html = `
    <div style="transform: translate(-50%, -50%);" class="relative group">
      ${isCritical ? '<span class="animate-ping absolute -inset-1.5 rounded-lg bg-red-500 opacity-50"></span>' : ''}
      <div class="relative px-2 py-1 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 border shadow-xl transition-all w-max whitespace-nowrap flex-nowrap ${isSelected ? 'ring-2 ring-cyan-400 scale-110 z-30' : 'hover:scale-105'} ${colorClasses}" style="backdrop-filter: blur(8px);">
        <svg class="w-3 h-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${asset.id}</span>
        <span class="border-l border-current/30 pl-1 font-extrabold ml-0.5">${asset.risk_score}</span>
      </div>
      <!-- Rich Hover Tooltip -->
      <div class="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 pointer-events-none">
        <div class="bg-[#0d131f]/95 backdrop-blur-xl border border-[#1f2d44] rounded-lg px-3 py-2.5 shadow-2xl w-[180px]">
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="text-[11px]">${typeIcon}</span>
            <span class="text-[10px] font-bold text-white font-mono truncate">${asset.name}</span>
          </div>
          <div class="text-[9px] text-slate-400 font-mono mb-2">${asset.location}</div>
          <div class="flex items-center justify-between text-[9px] font-mono mb-1">
            <span class="text-slate-500">Health</span>
            <span style="color: ${healthBarColor}" class="font-bold">${asset.health_score}/100</span>
          </div>
          <div class="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full" style="width: ${asset.health_score}%; background: ${healthBarColor};"></div>
          </div>
          <div class="flex items-center justify-between text-[9px] font-mono mt-1.5">
            <span class="text-slate-500">Customers</span>
            <span class="text-cyan-300 font-bold">${asset.customers_affected.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  return L.divIcon({ html, className: '', iconSize: [0, 0] });
};

// ══════════════════════════════════════════════════════════════════════
// RISK GAUGE — circular arc SVG component
// ══════════════════════════════════════════════════════════════════════
const RiskGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 100 }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const halfCirc = circumference * 0.75; // 270° arc
  const offset = halfCirc - (score / 100) * halfCirc;

  const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#f59e0b' : '#10b981';
  const bgColor = score >= 75 ? 'rgba(239,68,68,0.1)' : score >= 50 ? 'rgba(249,115,22,0.1)' : score >= 25 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
        {/* Background arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="rgba(51,65,85,0.3)"
          strokeWidth="6"
          strokeDasharray={`${halfCirc} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${halfCirc} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="risk-gauge-arc"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-mono">Risk Score</span>
      </div>
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full" style={{ background: bgColor, filter: 'blur(12px)', opacity: 0.5 }} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// MINI SPARKLINE — simulated risk trend
// ══════════════════════════════════════════════════════════════════════
const MiniSparkline: React.FC<{ score: number }> = ({ score }) => {
  // Generate a plausible recent trend around the current score
  const points = useMemo(() => {
    const pts: number[] = [];
    let val = Math.max(10, score - 15 + Math.floor(Math.random() * 10));
    for (let i = 0; i < 12; i++) {
      val += Math.floor(Math.random() * 8) - 3;
      val = Math.max(0, Math.min(100, val));
      pts.push(val);
    }
    pts.push(score); // end at actual score
    return pts;
  }, [score]);

  const width = 140;
  const height = 32;
  const maxVal = Math.max(...points, 1);
  const minVal = Math.min(...points);
  const range = Math.max(maxVal - minVal, 10);

  const pathD = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((v - minVal) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const lineColor = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#f59e0b' : '#10b981';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-grad-${score}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#spark-grad-${score})`}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-path"
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={height - ((score - minVal) / range) * (height - 4) - 2}
        r="3"
        fill={lineColor}
        className="animate-pulse"
        style={{ filter: `drop-shadow(0 0 4px ${lineColor})` }}
      />
    </svg>
  );
};

// ══════════════════════════════════════════════════════════════════════
// RISK DISTRIBUTION BAR — compact horizontal bar
// ══════════════════════════════════════════════════════════════════════
const RiskDistributionBar: React.FC<{ assets: AssetSummary[]; onFilterClick: (level: string) => void }> = ({ assets, onFilterClick }) => {
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    assets.forEach((a) => {
      if (a.risk_score >= 75 || a.risk_level === 'CRITICAL') c.critical++;
      else if (a.risk_score >= 50 || a.risk_level === 'HIGH') c.high++;
      else if (a.risk_score >= 25 || a.risk_level === 'MEDIUM' || a.risk_level === 'MODERATE') c.medium++;
      else c.low++;
    });
    return c;
  }, [assets]);

  const total = assets.length || 1;
  const segments = [
    { key: 'CRITICAL', count: counts.critical, color: '#ef4444', label: 'Critical' },
    { key: 'HIGH', count: counts.high, color: '#f97316', label: 'High' },
    { key: 'MEDIUM', count: counts.medium, color: '#f59e0b', label: 'Medium' },
    { key: 'LOW', count: counts.low, color: '#10b981', label: 'Low' },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0d131f]/80 border border-[#1f2d44] rounded-lg backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider whitespace-nowrap">
        <Layers className="w-3 h-3 text-slate-500" />
        Fleet Risk
      </div>
      {/* Bar */}
      <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-slate-800/60 gap-px">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              className="risk-dist-segment h-full rounded-sm"
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.label}: ${s.count} assets`}
              onClick={() => onFilterClick(s.key)}
            />
          ) : null
        )}
      </div>
      {/* Counts */}
      <div className="flex items-center gap-2.5">
        {segments.map((s) => (
          <button
            key={s.key}
            onClick={() => onFilterClick(s.key)}
            className="flex items-center gap-1 text-[10px] font-mono hover:opacity-80 transition-opacity"
            title={`Filter to ${s.label}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-slate-400">{s.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// HEATMAP + NETWORK HELPERS
// ══════════════════════════════════════════════════════════════════════
const getRiskColor = (score: number): string => {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#f59e0b';
  return '#10b981';
};

const getRiskRadius = (score: number): number => {
  if (score >= 75) return 45;
  if (score >= 50) return 35;
  if (score >= 25) return 25;
  return 18;
};

/** Group assets by grid_zone to draw inter-zone polylines */
const buildZonePolylines = (assets: AssetSummary[]): { positions: [number, number][]; color: string }[] => {
  const zoneMap = new Map<string, AssetSummary[]>();
  assets.forEach((a) => {
    const zone = a.grid_zone || a.location;
    if (!zoneMap.has(zone)) zoneMap.set(zone, []);
    zoneMap.get(zone)!.push(a);
  });

  const lines: { positions: [number, number][]; color: string }[] = [];
  zoneMap.forEach((group) => {
    if (group.length < 2) return;
    const sorted = group.sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude);
    const worstScore = Math.max(...group.map((a) => a.risk_score));
    const color = getRiskColor(worstScore);
    // connect sequentially
    for (let i = 0; i < sorted.length - 1; i++) {
      lines.push({
        positions: [
          [sorted[i].latitude, sorted[i].longitude],
          [sorted[i + 1].latitude, sorted[i + 1].longitude],
        ],
        color,
      });
    }
  });
  return lines;
};

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════
export const RiskMapPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [weatherZones, setWeatherZones] = useState<WeatherCondition[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [search, setSearch] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [showWeatherOverlay, setShowWeatherOverlay] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [focusAllTrigger, setFocusAllTrigger] = useState<number>(0);

  // Fetch assets + weather data
  const fetchData = async () => {
    try {
      const [assetRes, weatherRes] = await Promise.all([
        getAssets({ limit: 50 }),
        getWeather().catch(() => [] as WeatherCondition[]),
      ]);
      setAssets(assetRes.items);
      setWeatherZones(weatherRes);

      // Default selected asset to TR-104
      const primary = assetRes.items.find((a) => a.id === 'TR-104');
      if (primary) setSelectedAsset(primary);
    } catch (e) {
      console.error('Failed to load risk map data', e);
    }
  };

  useEffect(() => {
    fetchData();

    const unsubscribe = subscribeToDashboardStream((eventData) => {
      console.log('⚡ Risk Map live background update:', eventData);
      fetchData();
    });

    return () => unsubscribe();
  }, [context?.refreshTrigger]);

  const filteredAssets = assets.filter((a) => {
    const matchesSearch = !search || a.id.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()) || a.location.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === 'ALL' || a.risk_level === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const zonePolylines = useMemo(() => buildZonePolylines(filteredAssets), [filteredAssets]);

  // Find matching weather zone for selected asset
  const selectedWeather = useMemo(() => {
    if (!selectedAsset || weatherZones.length === 0) return null;
    // Try matching by zone
    const zone = selectedAsset.grid_zone || '';
    return weatherZones.find((w) => w.zone === zone || w.zone_name.toLowerCase().includes(selectedAsset.location.split(' ')[0]?.toLowerCase() || '___')) || weatherZones[0] || null;
  }, [selectedAsset, weatherZones]);

  // Contributing risk factors (derived from asset data)
  const riskFactors = useMemo(() => {
    if (!selectedAsset) return [];
    const factors: string[] = [];
    if (selectedAsset.failure_probability > 0.7) factors.push('High Failure Probability');
    if (selectedAsset.health_score < 40) factors.push('Degraded Health');
    if (selectedAsset.load_mw > 30) factors.push('Heavy Load');
    if (selectedAsset.customers_affected > 15000) factors.push('High Impact Zone');
    if (selectedAsset.weather_risk === 'HIGH' || selectedAsset.weather_risk === 'CRITICAL' || selectedAsset.weather_risk === 'High' || selectedAsset.weather_risk === 'Critical') factors.push('Weather Stress');
    if (selectedAsset.risk_score >= 75) factors.push('Critical Threshold');
    if (factors.length === 0) factors.push('Within Normal Parameters');
    return factors;
  }, [selectedAsset]);

  const isCriticalAsset = selectedAsset && (selectedAsset.risk_score >= 75 || selectedAsset.risk_level === 'CRITICAL');

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Compass className="w-3.5 h-3.5" />
            Geospatial Grid Risk Observatory
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white font-mono">
            Regional Electrical Sub-Transmission Network
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time geospatial overlay with live radar precipitation and asset vulnerability indexing.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFocusAllTrigger((prev) => prev + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all border bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700 shadow-sm hover:shadow-cyan-900/30"
            title="Auto-center map to view all monitored grid resources"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Focus Grid Resources ({filteredAssets.length})
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all border ${
              showHeatmap
                ? 'bg-violet-950/60 text-violet-300 border-violet-700 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Risk Zones: {showHeatmap ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowWeatherOverlay(!showWeatherOverlay)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all border ${
              showWeatherOverlay
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
          >
            <CloudLightning className="w-3.5 h-3.5" />
            Weather Radar: {showWeatherOverlay ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Risk Distribution Bar */}
      <RiskDistributionBar assets={assets} onFilterClick={(level) => setRiskFilter(riskFilter === level ? 'ALL' : level)} />

      {/* Map Canvas with Sidebar Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[400px] sm:min-h-[500px] lg:min-h-[600px]">
        {/* Full-width interactive Map View (8 cols) */}
        <div className="lg:col-span-8 bg-[#090d16] border border-[#1f2d44] rounded-lg shadow-xl relative overflow-hidden flex flex-col">
          {/* Map Top Bar */}
          <div className="p-3 bg-[#0d131f]/90 border-b border-[#1f2d44] flex flex-wrap items-center justify-between gap-3 text-xs z-10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search substation or asset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#090d16] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 font-mono w-48 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-400">Filter Risk:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setRiskFilter(lvl)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    riskFilter === lvl
                      ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-600 shadow-sm shadow-cyan-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Map Canvas */}
          <div className="relative flex-1 overflow-hidden" style={{ minHeight: '480px' }}>
            
            <MapContainer 
              center={[28.6139, 77.2090]} 
              zoom={11} 
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              <MapResizer />
              {/* Standard OpenStreetMap — clean white/light tiles */}
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />

              <MapFocusController
                assets={filteredAssets.length > 0 ? filteredAssets : assets}
                selectedAsset={selectedAsset}
                focusAllTrigger={focusAllTrigger}
              />

              {/* Zone polyline connections */}
              {zonePolylines.map((line, idx) => (
                <Polyline
                  key={`poly-${idx}`}
                  positions={line.positions}
                  pathOptions={{
                    color: line.color,
                    weight: 1.5,
                    opacity: 0.25,
                    dashArray: '6 4',
                  }}
                />
              ))}

              {/* Risk Heatmap Circles */}
              {showHeatmap && filteredAssets.map((asset) => (
                <CircleMarker
                  key={`heat-${asset.id}`}
                  center={[asset.latitude, asset.longitude]}
                  radius={getRiskRadius(asset.risk_score)}
                  pathOptions={{
                    color: getRiskColor(asset.risk_score),
                    fillColor: getRiskColor(asset.risk_score),
                    fillOpacity: 0.12,
                    weight: 1,
                    opacity: 0.3,
                  }}
                />
              ))}

              {/* Asset Markers */}
              {filteredAssets.map((asset) => (
                <Marker 
                  key={asset.id}
                  position={[asset.latitude, asset.longitude]}
                  icon={getAssetIcon(asset, selectedAsset?.id === asset.id)}
                  eventHandlers={{ click: () => setSelectedAsset(asset) }}
                />
              ))}
            </MapContainer>

            {/* Weather Radar Band (Overlay over map) */}
            {showWeatherOverlay && (
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-red-950/25 via-amber-950/15 to-transparent pointer-events-none border-l border-red-500/15 flex flex-col justify-between p-4 z-10">
                <div className="self-end px-3 py-2 rounded-lg bg-red-950/80 border border-red-700/80 text-red-200 text-xs font-mono flex items-center gap-2 shadow-lg backdrop-blur-xl">
                  <CloudLightning className="w-4 h-4 text-red-400 animate-pulse" />
                  <div>
                    <div className="font-bold">Severe Storm Radar Cell</div>
                    <div className="text-[10px] text-red-300/80">Eastern Grid Corridor (48.5 mm/h)</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 text-right">
                  Doppler Radar Sync • Updated 2m ago
                </div>
              </div>
            )}

            {/* Map Legend */}
            <div className="absolute left-4 bottom-4 p-3 rounded-lg bg-[#0d131f]/90 border border-slate-800/80 text-xs font-mono space-y-2 backdrop-blur-xl shadow-2xl z-20">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Risk Classification
              </div>
              {/* Gradient bar */}
              <div className="risk-gradient-bar w-full h-2" />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0 Low</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100 Critical</span>
              </div>
              {/* Compact legend items */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-slate-400">Low Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[9px] text-slate-400">Medium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-[9px] text-slate-400">High Alert</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] text-red-400 font-bold">Critical</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Selected Asset Details Drawer (4 cols)
        ───────────────────────────────────────────────────────────── */}
        <div className={`lg:col-span-4 bg-[#111827]/90 backdrop-blur-sm border border-[#1f2d44] rounded-lg shadow-xl flex flex-col overflow-hidden ${
          isCriticalAsset ? 'sidebar-critical-active' : ''
        }`}>
          {selectedAsset ? (
            <div key={selectedAsset.id} className="sidebar-slide-in flex flex-col h-full">
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Header */}
                <div className="border-b border-[#1f2d44] pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                      {selectedAsset.id}
                    </span>
                    <RiskBadge level={selectedAsset.risk_level} score={selectedAsset.risk_score} showPulse />
                  </div>
                  <h3 className="text-base font-bold text-white font-mono mt-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    {selectedAsset.name}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {selectedAsset.location}
                  </p>
                </div>

                {/* Risk Gauge + Sparkline Row */}
                <div className="flex items-center gap-4">
                  <RiskGauge score={selectedAsset.risk_score} size={90} />
                  <div className="flex-1">
                    <div className="text-[10px] font-mono uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Risk Trend (24h)
                    </div>
                    <MiniSparkline score={selectedAsset.risk_score} />
                  </div>
                </div>

                {/* KPI Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-500 uppercase block flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Failure Likelihood
                    </span>
                    <span className="text-rose-400 font-bold text-base">
                      {Math.round(selectedAsset.failure_probability * 100)}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-500 uppercase block flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Health Score
                    </span>
                    <span className="text-emerald-400 font-bold text-base">
                      {selectedAsset.health_score}/100
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-500 uppercase block flex items-center gap-1">
                      <Users className="w-3 h-3" /> Customers
                    </span>
                    <span className="text-white font-bold text-sm">
                      {selectedAsset.customers_affected.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-500 uppercase block flex items-center gap-1">
                      <Gauge className="w-3 h-3" /> Feeder Load
                    </span>
                    <span className="text-cyan-300 font-bold text-sm">
                      {selectedAsset.load_mw} MW
                    </span>
                  </div>
                </div>

                {/* Contributing Risk Factors */}
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    Contributing Risk Factors
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {riskFactors.map((factor, i) => (
                      <span
                        key={i}
                        className={`risk-factor-tag text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                          factor.includes('Critical') || factor.includes('High Failure')
                            ? 'bg-red-950/40 text-red-300 border-red-800/50'
                            : factor.includes('Normal')
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                        }`}
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Weather Status — Real Data */}
                <div className="p-3 rounded-lg bg-amber-950/15 border border-amber-800/40 text-xs space-y-2 backdrop-blur-sm">
                  <div className="flex items-center justify-between font-mono text-amber-300 font-semibold">
                    <span className="flex items-center gap-1">
                      <CloudLightning className="w-3.5 h-3.5" />
                      Weather Stress: {selectedAsset.weather_risk}
                    </span>
                  </div>
                  {selectedWeather ? (
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Thermometer className="w-3 h-3 text-orange-400" />
                        <span>{selectedWeather.temperature_c}°C</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Wind className="w-3 h-3 text-sky-400" />
                        <span>{selectedWeather.wind_speed_kmh} km/h</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Droplets className="w-3 h-3 text-blue-400" />
                        <span>Rain: {selectedWeather.rainfall_intensity_mm} mm/h</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span>Lightning: {selectedWeather.lightning_risk}</span>
                      </div>
                      <div className="col-span-2 text-slate-500 text-[9px] mt-0.5 border-t border-amber-800/20 pt-1.5">
                        Zone: {selectedWeather.zone_name} • {selectedWeather.condition_text}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">
                      Weather data loading...
                    </p>
                  )}
                </div>
              </div>

              {/* Sticky bottom actions */}
              <div className="p-4 border-t border-[#1f2d44] bg-[#0d131f]/60 backdrop-blur-sm space-y-3">
                {/* Direct Action Button */}
                <button
                  onClick={() => navigate(`/assets/${selectedAsset.id}`)}
                  className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-mono font-bold text-xs shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2 hover:shadow-cyan-800/40"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Inspect Telemetry Diagnostics & Actions
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Coordinates */}
                <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between">
                  <span>
                    {selectedAsset.latitude.toFixed(4)}°N, {selectedAsset.longitude.toFixed(4)}°E
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SLDC Active
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mb-4">
                <MapPin className="w-7 h-7 text-slate-500" />
              </div>
              <p className="text-slate-400 font-mono text-xs mb-1">No asset selected</p>
              <p className="text-slate-500 text-[11px]">Click a marker on the map to inspect risk details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
