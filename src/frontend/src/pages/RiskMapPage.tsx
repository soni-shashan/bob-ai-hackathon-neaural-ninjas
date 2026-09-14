import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  MapPin,
  Filter,
  Search,
  CloudLightning,
  AlertTriangle,
  Zap,
  ChevronRight,
  ShieldAlert,
  Users,
  Compass
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { getAssets } from '../services/api';
import { AssetSummary } from '../types';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

  const html = `
    <div style="transform: translate(-50%, -50%);" class="relative group">
      ${isCritical ? '<span class="animate-ping absolute -inset-1 rounded-full bg-red-500 opacity-75"></span>' : ''}
      <div class="relative px-2 py-1 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 border shadow-xl transition-all w-max whitespace-nowrap flex-nowrap ${isSelected ? 'ring-2 ring-cyan-400 scale-110 z-30' : 'hover:scale-105'} ${colorClasses}">
        <svg class="w-3 h-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${asset.id}</span>
        <span class="border-l border-current/30 pl-1 font-extrabold ml-0.5">${asset.risk_score}</span>
      </div>
      <div class="text-[9px] font-mono text-slate-400 whitespace-nowrap text-center mt-1 hidden group-hover:block bg-[#090d16]/90 px-1 rounded border border-slate-800 absolute left-1/2 -translate-x-1/2 z-40">
        ${asset.location}
      </div>
    </div>
  `;
  return L.divIcon({ html, className: '', iconSize: [0, 0] });
};

export const RiskMapPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [search, setSearch] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [showWeatherOverlay, setShowWeatherOverlay] = useState<boolean>(true);
  const [focusAllTrigger, setFocusAllTrigger] = useState<number>(0);

  const fetchFleet = async () => {
    try {
      const res = await getAssets({ limit: 50 });
      setAssets(res.items);

      // Default selected asset to TR-104
      const primary = res.items.find((a) => a.id === 'TR-104');
      if (primary) setSelectedAsset(primary);
    } catch (e) {
      console.error('Failed to load risk map assets', e);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, [context?.refreshTrigger]);

  const filteredAssets = assets.filter((a) => {
    const matchesSearch = !search || a.id.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()) || a.location.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === 'ALL' || a.risk_level === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Compass className="w-3.5 h-3.5" />
            Geospatial Grid Risk Observatory
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Regional Electrical Sub-Transmission Network
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time geospatial overlay with live radar precipitation and asset vulnerability indexing.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFocusAllTrigger((prev) => prev + 1)}
            className="px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 transition-colors border bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700 shadow-sm"
            title="Auto-center map to view all monitored grid resources"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Focus Grid Resources ({filteredAssets.length})
          </button>
          <button
            onClick={() => setShowWeatherOverlay(!showWeatherOverlay)}
            className={`px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 transition-colors border ${
              showWeatherOverlay
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <CloudLightning className="w-3.5 h-3.5" />
            Weather Radar: {showWeatherOverlay ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Map Canvas with Sidebar Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
        {/* Full-width interactive Map View (8 cols) */}
        <div className="lg:col-span-8 bg-[#090d16] border border-[#1f2d44] rounded-lg shadow-xl relative overflow-hidden flex flex-col">
          {/* Map Top Bar */}
          <div className="p-3 bg-[#0d131f] border-b border-[#1f2d44] flex flex-wrap items-center justify-between gap-3 text-xs z-10">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search substation or asset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#090d16] border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono w-48"
              />
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-400">Filter Risk:</span>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setRiskFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    riskFilter === lvl
                      ? 'bg-cyan-900 text-cyan-200 border border-cyan-600'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Map Visual Simulation Canvas */}
          <div className="relative flex-1 bg-[#0a0e1a] overflow-hidden min-h-[480px]">
            
            <MapContainer 
              center={[28.6139, 77.2090]} 
              zoom={11} 
              className="absolute inset-0 z-0"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                className="map-tiles-dark"
              />

              <MapFocusController
                assets={filteredAssets.length > 0 ? filteredAssets : assets}
                selectedAsset={selectedAsset}
                focusAllTrigger={focusAllTrigger}
              />
              
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
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-red-950/30 via-amber-950/20 to-transparent pointer-events-none border-l border-red-500/20 flex flex-col justify-between p-4 z-10">
                <div className="self-end px-3 py-1.5 rounded-lg bg-red-950/90 border border-red-700 text-red-200 text-xs font-mono flex items-center gap-2 shadow-lg backdrop-blur-md">
                  <CloudLightning className="w-4 h-4 text-red-400 animate-pulse" />
                  <div>
                    <div className="font-bold">Severe Storm Radar Cell</div>
                    <div className="text-[10px] text-red-300">Eastern Grid Corridor (48.5 mm/h)</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 text-right">
                  Doppler Radar Sync • Updated 2m ago
                </div>
              </div>
            )}

            {/* Map Legend */}
            <div className="absolute left-4 bottom-4 p-3 rounded-lg bg-[#0d131f]/90 border border-slate-800 text-xs font-mono space-y-1.5 backdrop-blur-md shadow-xl z-20">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Risk Classification Legend
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">0–24: Low Operational Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-300">25–49: Medium Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="text-slate-300">50–74: High Alert</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="text-red-400 font-bold">75–100: Critical Intervention</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Asset Details Drawer (4 cols) */}
        <div className="lg:col-span-4 bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl flex flex-col justify-between">
          {selectedAsset ? (
            <div className="space-y-4">
              <div className="border-b border-[#1f2d44] pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {selectedAsset.id}
                  </span>
                  <RiskBadge level={selectedAsset.risk_level} score={selectedAsset.risk_score} showPulse />
                </div>
                <h3 className="text-base font-bold text-white font-mono mt-2">
                  {selectedAsset.name}
                </h3>
                <p className="text-xs text-slate-400">{selectedAsset.location}</p>
              </div>

              {/* KPI Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Failure Likelihood</span>
                  <span className="text-rose-400 font-bold text-base">
                    {Math.round(selectedAsset.failure_probability * 100)}%
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Health Score</span>
                  <span className="text-emerald-400 font-bold text-base">
                    {selectedAsset.health_score}/100
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Customers</span>
                  <span className="text-white font-bold text-sm">
                    {selectedAsset.customers_affected.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Feeder Load</span>
                  <span className="text-cyan-300 font-bold text-sm">
                    {selectedAsset.load_mw} MW
                  </span>
                </div>
              </div>

              {/* Weather Status */}
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/60 text-xs space-y-1">
                <div className="flex items-center justify-between font-mono text-amber-300 font-semibold">
                  <span>Weather Stress: {selectedAsset.weather_risk}</span>
                  <CloudLightning className="w-4 h-4" />
                </div>
                <p className="text-slate-400 text-[11px]">
                  Located in Eastern Industrial Storm belt. Elevated lightning exposure and rainfall.
                </p>
              </div>

              {/* Direct Action Button */}
              <button
                onClick={() => navigate(`/assets/${selectedAsset.id}`)}
                className="w-full py-2.5 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                Inspect Telemetry Diagnostics & Actions →
              </button>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500 font-mono text-xs">
              Select an asset marker on the map to inspect risk details.
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>
              Coordinates: {selectedAsset ? `${selectedAsset.latitude.toFixed(4)}°N, ${selectedAsset.longitude.toFixed(4)}°E` : '28.6139°N, 77.2090°E'}
            </span>
            <span>SLDC Telemetry Active • {selectedAsset ? selectedAsset.location : 'Regional Grid'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
