import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Wrench,
  Users,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Send,
  Navigation,
  Check,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { KPICard } from '../components/common/KPICard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import { getMaintenancePlan, getCrews, assignCrew } from '../services/api';
import { MaintenancePlanResponse, CrewMember, MaintenanceActionItem } from '../types';

export const MaintenancePage: React.FC = () => {
  const context = useOutletContext<{ refreshTrigger?: number }>();

  const [plan, setPlan] = useState<MaintenancePlanResponse | null>(null);
  const [crews, setCrews] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign modal state
  const [selectedAction, setSelectedAction] = useState<MaintenanceActionItem | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState<string>('CREW-02');
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Sorting filter
  const [sortFilter, setSortFilter] = useState<string>('priority');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [planRes, crewRes] = await Promise.all([
        getMaintenancePlan(),
        getCrews()
      ]);
      setPlan(planRes);
      setCrews(crewRes);
    } catch (e: any) {
      console.error('Failed to load maintenance plan', e);
      setError(e.message || 'Failed to retrieve maintenance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [context?.refreshTrigger]);

  const handleAssignCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction || !selectedCrewId) return;

    setAssigning(true);
    try {
      const res = await assignCrew(selectedAction.asset_id, selectedCrewId);
      setAssignSuccess(res.message);
      await fetchData();
      setTimeout(() => {
        setSelectedAction(null);
        setAssignSuccess(null);
      }, 1500);
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  if (loading && !plan) {
    return <LoadingSpinner message="Optimizing crew positioning and maintenance priorities..." />;
  }

  if (error && !plan) {
    return <ErrorMessage message={error} onRetry={fetchData} />;
  }

  const actions = plan?.actions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Wrench className="w-3.5 h-3.5" />
            Decision-Support Dispatch Console
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Maintenance & Crew Pre-positioning Planner
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Converts predictive ML risk scores and extreme weather threats into optimized dispatch assignments.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={fetchData}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-xs font-mono text-cyan-300 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Re-optimize Plan
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Critical Interventions"
          value={7}
          subtitle="Priority 1-3 equipment"
          icon={AlertTriangle}
          badge={{ text: 'Urgent', variant: 'danger' }}
        />
        <KPICard
          title="Available Field Crews"
          value={crews.length}
          subtitle="Certified HV specialists"
          icon={Users}
          badge={{ text: '100% Ready', variant: 'success' }}
        />
        <KPICard
          title="Crews Deployed"
          value={3}
          subtitle="En route or on-site"
          icon={Navigation}
          badge={{ text: 'Active', variant: 'warning' }}
        />
        <KPICard
          title="Crews on Standby"
          value={2}
          subtitle="Regional depots"
          icon={ShieldAlert}
          badge={{ text: 'Reserve', variant: 'info' }}
        />
      </div>

      {/* PRIORITIZED MAINTENANCE TABLE */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#1f2d44] flex flex-wrap items-center justify-between gap-3 bg-[#0e1626]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Prioritized Grid Maintenance Action Queue
            </h2>
            <p className="text-xs text-slate-400">
              Ranked dynamically by Composite Failure Risk, Downstream Customers, and Weather Urgency.
            </p>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Sort By:</span>
            <select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              className="bg-[#0b0f17] border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="priority">Highest Risk (Priority 1st)</option>
              <option value="customers">Highest Customer Impact</option>
              <option value="eta">Nearest Crew ETA</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f2d44] text-[11px] font-mono uppercase text-slate-400 bg-[#0b0f17]/70">
                <th className="py-3 px-3 font-semibold text-center">Priority</th>
                <th className="py-3 px-4 font-semibold">Asset</th>
                <th className="py-3 px-3 font-semibold">Location</th>
                <th className="py-3 px-3 font-semibold text-right">Risk Score</th>
                <th className="py-3 px-4 font-semibold">Recommended Action</th>
                <th className="py-3 px-3 font-semibold">Assigned Crew</th>
                <th className="py-3 px-3 font-semibold text-center">Travel ETA</th>
                <th className="py-3 px-3 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182334] text-xs font-mono">
              {actions.map((act) => {
                const isTr104 = act.asset_id === 'TR-104';
                return (
                  <tr
                    key={act.id}
                    className={`hover:bg-[#151f33] transition-colors ${
                      isTr104 ? 'bg-red-950/10' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-extrabold text-xs border ${
                          act.priority === 1
                            ? 'bg-red-950 text-red-200 border-red-700 animate-pulse'
                            : act.priority === 2
                            ? 'bg-orange-950 text-orange-200 border-orange-700'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        #{act.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                      <Link to={`/assets/${act.asset_id}`} className="hover:text-cyan-400 hover:underline">
                        {act.asset_id}
                      </Link>
                      {isTr104 && (
                        <span className="text-[9px] font-mono px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-sans">
                      {act.location}
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums">
                      <span className={act.risk_score >= 85 ? 'text-red-400 font-extrabold' : 'text-orange-400'}>
                        {act.risk_score}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-sans max-w-[240px]">
                      <div className="font-semibold text-xs">{act.action}</div>
                      <div className="text-[11px] text-slate-400 truncate">{act.reason}</div>
                    </td>
                    <td className="py-3 px-3 text-cyan-300 font-semibold">
                      {act.crew_name || (
                        <span className="text-amber-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-slate-300">
                      {act.eta_minutes ? `${act.eta_minutes} min` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                          act.status === 'ASSIGNED'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            : act.status === 'PREPARING'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {act.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedAction(act);
                          if (act.crew_id) setSelectedCrewId(act.crew_id);
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[11px] transition-colors"
                      >
                        {act.crew_id ? 'Reassign' : 'Assign Crew'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREW PRE-POSITIONING CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#1f2d44] pb-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-mono">
              <Users className="w-4 h-4 text-cyan-400" />
              Specialized Field Crew Pre-positioning & Asset Proximity
            </h2>
            <p className="text-xs text-slate-400">
              Optimal staging positions calculated from predicted fault probability and incoming storm tracks.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((c) => {
            const isHighlight = c.id === 'CREW-02';
            return (
              <div
                key={c.id}
                className={`p-4 rounded-lg bg-[#111827] border transition-all flex flex-col justify-between shadow-xl ${
                  isHighlight
                    ? 'border-red-600/80 bg-gradient-to-b from-[#161d2d] to-[#111827] ring-1 ring-red-500/40'
                    : 'border-[#1f2d44]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#1f2d44] pb-2 mb-3">
                    <div>
                      <span className="text-xs font-mono font-bold text-white block">
                        {c.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{c.id}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                        c.status === 'ASSIGNED'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : c.status === 'PREPARING'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">
                        Current Depot Location:
                      </span>
                      <span className="text-slate-200 font-sans">{c.current_location}</span>
                    </div>

                    {c.recommended_position && (
                      <div className="p-2 rounded bg-cyan-950/40 border border-cyan-800/80 text-cyan-300">
                        <span className="text-[10px] uppercase block font-bold text-cyan-400">
                          Recommended Staging:
                        </span>
                        <span className="text-white font-bold">{c.recommended_position}</span>
                        {c.recommended_reason && (
                          <p className="text-[10px] text-slate-300 mt-1 font-sans">
                            {c.recommended_reason}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase mt-2">
                        Required Certifications / Skills:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[10px] border border-slate-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase mt-2">
                        Onboard Specialized Equipment:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.equipment.map((eq, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 text-[10px] border border-slate-700"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">ETA to Target:</span>
                  <span className="text-white font-bold">{c.eta_minutes ?? 15} mins</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ASSIGN CREW MODAL */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-lg max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                Assign Field Crew
              </h3>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">TARGET ASSET:</span>
                <span className="text-white font-bold text-sm">
                  {selectedAction.asset_id} • {selectedAction.location}
                </span>
                <p className="text-slate-300 mt-1 font-sans text-xs">{selectedAction.action}</p>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Select Available Crew:</label>
                <select
                  value={selectedCrewId}
                  onChange={(e) => setSelectedCrewId(e.target.value)}
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {crews.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id}) — Status: {c.status}
                    </option>
                  ))}
                </select>
              </div>

              {assignSuccess && (
                <div className="p-3 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{assignSuccess}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 font-mono text-xs">
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignCrew}
                disabled={assigning}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
