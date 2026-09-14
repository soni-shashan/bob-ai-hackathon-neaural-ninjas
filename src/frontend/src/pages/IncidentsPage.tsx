import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  CloudLightning
} from 'lucide-react';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import { getIncidents } from '../services/api';
import { HistoricalIncident } from '../types';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedIncident, setSelectedIncident] = useState<HistoricalIncident | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getIncidents({
        severity: severityFilter !== 'ALL' ? severityFilter : undefined
      });
      setIncidents(res);
      if (res.length > 0) setSelectedIncident(res[0]);
    } catch (e: any) {
      console.error('Failed to load incidents', e);
      setError(e.message || 'Failed to retrieve historical incident log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [severityFilter]);

  const filteredIncidents = incidents.filter((inc) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      inc.id.toLowerCase().includes(s) ||
      inc.asset_id.toLowerCase().includes(s) ||
      inc.failure_type.toLowerCase().includes(s) ||
      inc.root_cause.toLowerCase().includes(s) ||
      inc.location.toLowerCase().includes(s)
    );
  });

  if (loading && incidents.length === 0) {
    return <LoadingSpinner message="Retrieving grid failure and outage history..." />;
  }

  if (error && incidents.length === 0) {
    return <ErrorMessage message={error} onRetry={fetchIncidents} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <History className="w-3.5 h-3.5" />
            Grid Failure Archive & Reliability Forensics
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Historical Outages & Component Incident Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Root-cause telemetry correlations, restoration durations, and weather impact records.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
          Total Logged Events: <strong className="text-white">{incidents.length}</strong>
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search incident ID, asset, or root cause..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0b0f17] border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Severity Filter:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                severityFilter === sev
                  ? 'bg-cyan-900 text-cyan-200 border border-cyan-700'
                  : 'text-slate-400 hover:text-white bg-[#0b0f17] border border-slate-800'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Incidents Table & Incident Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden">
          <div className="p-3.5 border-b border-[#1f2d44] bg-[#0e1626] flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-200">Failure Event Log</span>
            <span className="text-slate-500">{filteredIncidents.length} matching events</span>
          </div>

          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0b0f17] border-b border-[#1f2d44] text-[11px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Incident ID</th>
                  <th className="py-2.5 px-3 font-semibold">Asset</th>
                  <th className="py-2.5 px-3 font-semibold">Failure Type</th>
                  <th className="py-2.5 px-2 font-semibold text-center">Severity</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Duration</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182334] text-xs font-mono">
                {filteredIncidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  return (
                    <tr
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className={`hover:bg-[#151f33] cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-cyan-300">
                        {inc.id}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        {inc.asset_id}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans max-w-[160px] truncate">
                        {inc.failure_type}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : inc.severity === 'HIGH'
                              ? 'bg-orange-950 text-orange-300 border-orange-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                        {inc.duration_minutes}m
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 text-[11px]">
                        {inc.timestamp.slice(0, 10)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Incident Deep-Dive (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl flex flex-col justify-between">
          {selectedIncident ? (
            <div className="space-y-4">
              <div className="border-b border-[#1f2d44] pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                    {selectedIncident.id}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                      selectedIncident.severity === 'CRITICAL'
                        ? 'bg-red-950 text-red-300 border-red-800'
                        : selectedIncident.severity === 'HIGH'
                        ? 'bg-orange-950 text-orange-300 border-orange-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}
                  >
                    {selectedIncident.severity} SEVERITY
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-mono mt-2">
                  {selectedIncident.failure_type}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedIncident.location} • {selectedIncident.timestamp}
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Outage Duration</span>
                  <span className="text-white font-bold text-base">
                    {selectedIncident.duration_minutes} Minutes
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Customers Disrupted</span>
                  <span className="text-rose-400 font-bold text-base">
                    {selectedIncident.customers_affected.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Root Cause Analysis */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-xs">
                <span className="text-[10px] font-mono uppercase font-bold text-rose-400 block">
                  Root Cause Diagnostics:
                </span>
                <p className="text-slate-200 leading-relaxed font-sans">
                  {selectedIncident.root_cause}
                </p>
              </div>

              {/* Maintenance Performed / Resolution */}
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/60 space-y-1 text-xs">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 block">
                  Corrective Resolution Executed:
                </span>
                <p className="text-slate-200 leading-relaxed font-sans">
                  {selectedIncident.resolution}
                </p>
              </div>

              {/* Weather Conditions During Incident */}
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Weather During Incident:</span>
                <span className="text-amber-300 font-semibold">{selectedIncident.weather_condition}</span>
              </div>

              {/* Link to Asset */}
              <Link
                to={`/assets/${selectedIncident.asset_id}`}
                className="w-full py-2 px-3 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                Inspect Associated Asset ({selectedIncident.asset_id}) →
              </Link>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500 font-mono text-xs">
              Select an incident from the table to view post-mortem analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
