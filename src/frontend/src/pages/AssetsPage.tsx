import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  Cpu,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import { getAssets, getDemoState, createAsset } from '../services/api';
import { AssetSummary, AssetListResponse } from '../types';

export const AssetsPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);

  // New Transformer Registration Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newAssetForm, setNewAssetForm] = useState({
    id: '',
    name: '',
    type: 'Power Transformer',
    location: '',
    grid_zone: 'East Grid',
    capacity_mva: 50,
    load_mw: 28,
    customers_affected: 8500
  });

  // Filters & Sorting State
  const [search, setSearch] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('risk_desc');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: AssetListResponse = await getAssets({
        search: search.trim() || undefined,
        risk_level: riskFilter !== 'ALL' ? riskFilter : undefined,
        asset_type: typeFilter !== 'ALL' ? typeFilter : undefined,
        location: locationFilter !== 'ALL' ? locationFilter : undefined,
        sort: sortBy,
        page,
        limit
      });
      setAssets(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load assets', err);
      setError(err.message || 'Failed to fetch asset inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search, riskFilter, typeFilter, locationFilter, sortBy, page, context?.refreshTrigger]);

  const handleCreateTransformer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetForm.id.trim() || !newAssetForm.name.trim() || !newAssetForm.location.trim()) {
      alert("Please enter Transformer ID, Name, and Substation Location.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createAsset({
        id: newAssetForm.id.trim(),
        name: newAssetForm.name.trim(),
        type: newAssetForm.type,
        location: newAssetForm.location.trim(),
        grid_zone: newAssetForm.grid_zone,
        capacity_mva: Number(newAssetForm.capacity_mva),
        load_mw: Number(newAssetForm.load_mw),
        customers_affected: Number(newAssetForm.customers_affected)
      });
      setCreateSuccess(`Transformer ${created.id} successfully registered! Generating live SCADA telemetry stream.`);
      await fetchAssets();
      setTimeout(() => {
        setIsAddModalOpen(false);
        setCreateSuccess(null);
        setNewAssetForm({
          id: '',
          name: '',
          type: 'Power Transformer',
          location: '',
          grid_zone: 'East Grid',
          capacity_mva: 50,
          load_mw: 28,
          customers_affected: 8500
        });
      }, 1500);
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Cpu className="w-3.5 h-3.5" />
            Grid Asset Fleet Inventory
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            High-Voltage Substation Equipment
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitored fleet of {total} transmission and distribution components with live sensor diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-mono font-bold text-white shadow-lg transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            + Track New Transformer
          </button>
          <button
            onClick={fetchAssets}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh Fleet
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-4 shadow-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search ID, Name, Substation..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0b0f17] border border-[#1f2d44] rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Risk Filter */}
          <div>
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0b0f17] border border-[#1f2d44] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical (85-100)</option>
              <option value="HIGH">High (50-84)</option>
              <option value="MODERATE">Moderate (30-49)</option>
              <option value="LOW">Low (0-29)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0b0f17] border border-[#1f2d44] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="ALL">All Asset Types</option>
              <option value="Power Transformer">Power Transformer</option>
              <option value="Auto-Transformer">Auto-Transformer</option>
              <option value="Circuit Breaker">Circuit Breaker</option>
              <option value="Substation Feeder">Substation Feeder</option>
              <option value="Busbar Section">Busbar Section</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0b0f17] border border-[#1f2d44] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="ALL">All Substations</option>
              <option value="Naroda">Naroda Substation</option>
              <option value="Vatva">Vatva Substation</option>
              <option value="Odhav">Odhav Substation</option>
              <option value="Gandhinagar">Gandhinagar Substation</option>
              <option value="Sabarmati">Sabarmati Substation</option>
              <option value="Thaltej">Thaltej Substation</option>
              <option value="Sanand">Sanand Substation</option>
              <option value="Bopal">Bopal Substation</option>
              <option value="Changodar">Changodar Substation</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#0b0f17] border border-[#1f2d44] rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="risk_desc">Sort: Highest Risk</option>
              <option value="risk_asc">Sort: Lowest Risk</option>
              <option value="failure_desc">Sort: Failure Probability</option>
              <option value="customers_desc">Sort: Customers Affected</option>
              <option value="health_asc">Sort: Lowest Health</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Asset Table */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden">
        {loading && assets.length === 0 ? (
          <LoadingSpinner height="h-96" />
        ) : error ? (
          <ErrorMessage message={error} onRetry={fetchAssets} />
        ) : assets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            No assets match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f2d44] text-[11px] font-mono uppercase text-slate-400 bg-[#0b0f17]/70">
                  <th className="py-3 px-4 font-semibold">Asset ID</th>
                  <th className="py-3 px-4 font-semibold">Asset Name</th>
                  <th className="py-3 px-3 font-semibold">Type</th>
                  <th className="py-3 px-3 font-semibold">Substation</th>
                  <th className="py-3 px-3 font-semibold text-center">Health</th>
                  <th className="py-3 px-3 font-semibold text-right">Fail Prob</th>
                  <th className="py-3 px-3 font-semibold text-right">Risk Score</th>
                  <th className="py-3 px-3 font-semibold text-right">Customers</th>
                  <th className="py-3 px-3 font-semibold text-center">Weather</th>
                  <th className="py-3 px-3 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Last Maint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182334] text-xs font-mono">
                {assets.map((asset) => {
                  const isDemo = asset.id === 'TR-104';

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="hover:bg-[#151f33] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-bold text-white group-hover:text-cyan-400 flex items-center gap-2">
                        {asset.id}
                        {isDemo && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-sans max-w-[180px] truncate">
                        {asset.name}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {asset.type}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans">
                        {asset.location}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-bold tabular-nums ${
                            asset.health_score < 50
                              ? 'text-red-400'
                              : asset.health_score < 75
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {asset.health_score}
                        </span>
                        <span className="text-[10px] text-slate-500">/100</span>
                      </td>
                      <td className="py-3 px-3 text-right text-rose-300 font-bold tabular-nums">
                        {Math.round(asset.failure_probability * 100)}%
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        <span
                          className={
                            asset.risk_score >= 85
                              ? 'text-red-400 font-extrabold'
                              : asset.risk_score >= 65
                              ? 'text-orange-400'
                              : 'text-amber-400'
                          }
                        >
                          {asset.risk_score}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                        {asset.customers_affected.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                            asset.weather_risk === 'HIGH'
                              ? 'bg-red-950/60 text-red-300 border-red-800'
                              : asset.weather_risk === 'MODERATE'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {asset.weather_risk}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <RiskBadge level={asset.risk_level} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                        {asset.last_maintenance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-3 bg-[#0e1626] border-t border-[#1f2d44] flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Showing <strong className="text-white">{assets.length}</strong> of{' '}
            <strong className="text-white">{total}</strong> assets
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-[#0b0f17] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-white transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-[#0b0f17] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-white transition-colors flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* TRACK NEW TRANSFORMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-lg max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  Register & Track New Transformer
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransformer} className="space-y-3.5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Transformer ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TR-901"
                    value={newAssetForm.id}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, id: e.target.value })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Asset Type</label>
                  <select
                    value={newAssetForm.type}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, type: e.target.value })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  >
                    <option value="Power Transformer">Power Transformer</option>
                    <option value="Auto-Transformer">Auto-Transformer</option>
                    <option value="Circuit Breaker">Circuit Breaker</option>
                    <option value="Substation Feeder">Substation Feeder</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Transformer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maninagar 220kV Step-Down Transformer 901"
                  value={newAssetForm.name}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, name: e.target.value })}
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Substation Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maninagar Substation"
                    value={newAssetForm.location}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, location: e.target.value })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Grid Sector / Zone</label>
                  <select
                    value={newAssetForm.grid_zone}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, grid_zone: e.target.value })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  >
                    <option value="East Grid">East Grid (Industrial)</option>
                    <option value="Central Grid">Central Grid (Urban Metro)</option>
                    <option value="West Grid">West Grid (Commercial)</option>
                    <option value="North Grid">North Grid (Ring Yard)</option>
                    <option value="South Grid">South Grid (Logistics Hub)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Capacity (MVA)</label>
                  <input
                    type="number"
                    value={newAssetForm.capacity_mva}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, capacity_mva: Number(e.target.value) })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Active Load (MW)</label>
                  <input
                    type="number"
                    value={newAssetForm.load_mw}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, load_mw: Number(e.target.value) })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Customers</label>
                  <input
                    type="number"
                    value={newAssetForm.customers_affected}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, customers_affected: Number(e.target.value) })}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  />
                </div>
              </div>

              {createSuccess && (
                <div className="p-3 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Start Tracking Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
