import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  Building2,
  ArrowRight,
  MessageSquare,
  Send,
  Calendar,
  Zap,
  Activity,
  Trash2,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getTickets,
  createTicket,
  getTicketById,
  updateTicket,
  addTicketComment,
  deleteTicket,
  getAssignableUsers,
  getAssets,
  getCrews,
} from '../services/api';
import {
  TicketResponse,
  TicketCreatePayload,
  TicketPriority,
  TicketStatus,
  UserMinimal,
  AssetSummary,
  CrewMember,
} from '../types';

const STATUS_LIST: { value: TicketStatus | 'ALL'; label: string; color: string }[] = [
  { value: 'ALL', label: 'All Tickets', color: 'slate' },
  { value: 'OPEN', label: 'Open', color: 'red' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'amber' },
  { value: 'PENDING_REVIEW', label: 'Pending Review', color: 'purple' },
  { value: 'RESOLVED', label: 'Resolved', color: 'emerald' },
  { value: 'CLOSED', label: 'Closed', color: 'slate' },
];

const PRIORITY_COLORS: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-950/80', text: 'text-red-300', border: 'border-red-800' },
  HIGH: { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-800' },
  MEDIUM: { bg: 'bg-blue-950/80', text: 'text-blue-300', border: 'border-blue-800' },
  LOW: { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' },
};

const STATUS_COLORS: Record<TicketStatus, { bg: string; text: string; border: string }> = {
  OPEN: { bg: 'bg-red-950/80', text: 'text-red-400', border: 'border-red-800' },
  IN_PROGRESS: { bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-800' },
  PENDING_REVIEW: { bg: 'bg-purple-950/80', text: 'text-purple-300', border: 'border-purple-800' },
  RESOLVED: { bg: 'bg-emerald-950/80', text: 'text-emerald-400', border: 'border-emerald-800' },
  CLOSED: { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' },
};

export const TicketsPage: React.FC = () => {
  const { user: currentUser, isMainAdmin, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const prefilledAssetId = searchParams.get('asset_id') || '';

  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusTab, setStatusTab] = useState<TicketStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Auxiliary data for modal dropdowns
  const [assignableUsers, setAssignableUsers] = useState<UserMinimal[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [crews, setCrews] = useState<CrewMember[]>([]);

  // Modals state
  const [showRaiseModal, setShowRaiseModal] = useState<boolean>(!!prefilledAssetId);
  const [selectedTicket, setSelectedTicket] = useState<TicketResponse | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<TicketCreatePayload>({
    asset_id: prefilledAssetId || '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigned_to_user_id: undefined,
    assigned_crew_id: undefined,
    due_date: '',
  });

  const [commentInput, setCommentInput] = useState<string>('');
  const [resolutionInput, setResolutionInput] = useState<string>('');
  const [showResolutionBox, setShowResolutionBox] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTicketsList = async () => {
    setLoading(true);
    try {
      const data = await getTickets({
        status: statusTab === 'ALL' ? undefined : statusTab,
        priority: priorityFilter || undefined,
        search: searchTerm || undefined,
      });
      setTickets(data);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to fetch tickets' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxData = async () => {
    try {
      const [uList, aList, cList] = await Promise.all([
        getAssignableUsers(),
        getAssets({ limit: 100 }),
        getCrews(),
      ]);
      setAssignableUsers(uList);
      setAssets(aList.items || []);
      setCrews(cList || []);

      if (prefilledAssetId && aList.items?.length) {
        const found = aList.items.find((a) => a.id === prefilledAssetId);
        if (found) {
          setCreateForm((prev) => ({
            ...prev,
            asset_id: found.id,
            title: `Fix Issue / Maintenance for ${found.name} (${found.id})`,
          }));
        }
      }
    } catch {
      // Silently handle aux fetch errors
    }
  };

  useEffect(() => {
    fetchAuxData();
  }, []);

  useEffect(() => {
    fetchTicketsList();
  }, [statusTab, priorityFilter, searchTerm]);

  const handleRaiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.asset_id || !createForm.title || !createForm.description) {
      setStatusMsg({ type: 'error', text: 'Please select an Asset and enter Title & Description.' });
      return;
    }

    try {
      const newTkt = await createTicket(createForm);
      setStatusMsg({ type: 'success', text: `Ticket ${newTkt.id} raised successfully!` });
      setShowRaiseModal(false);
      setCreateForm({
        asset_id: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigned_to_user_id: undefined,
        assigned_crew_id: undefined,
        due_date: '',
      });
      fetchTicketsList();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to raise ticket' });
    }
  };

  const handleOpenTicketDetail = async (ticketId: string) => {
    try {
      const fullTkt = await getTicketById(ticketId);
      setSelectedTicket(fullTkt);
      setResolutionInput(fullTkt.resolution_notes || '');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load ticket details' });
    }
  };

  const handleStatusTransition = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;

    if (newStatus === 'RESOLVED' && !resolutionInput.trim() && !showResolutionBox) {
      setShowResolutionBox(true);
      return;
    }

    try {
      const updated = await updateTicket(selectedTicket.id, {
        status: newStatus,
        resolution_notes: resolutionInput.trim() || undefined,
      });
      setSelectedTicket(updated);
      setShowResolutionBox(false);
      setStatusMsg({ type: 'success', text: `Ticket ${selectedTicket.id} updated to ${newStatus}.` });
      fetchTicketsList();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update ticket status' });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentInput.trim()) return;

    try {
      const updated = await addTicketComment(selectedTicket.id, commentInput.trim());
      setSelectedTicket(updated);
      setCommentInput('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to add comment' });
    }
  };

  const handleDeleteTicketClick = async (ticketId: string) => {
    if (!window.confirm(`Are you sure you want to delete ticket ${ticketId}?`)) return;
    try {
      await deleteTicket(ticketId);
      setSelectedTicket(null);
      setStatusMsg({ type: 'success', text: `Ticket ${ticketId} deleted.` });
      fetchTicketsList();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete ticket' });
    }
  };

  // Metrics
  const totalCount = tickets.length;
  const criticalCount = tickets.filter((t) => t.priority === 'CRITICAL' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#111827] p-6 rounded-xl border border-[#1f2d44]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono tracking-tight flex items-center gap-2">
                Asset Maintenance & Issue Tickets
                <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono">
                  LIFECYCLE ENGINE
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Raise maintenance tickets, assign engineers & field response crews to specific grid assets, and track fix resolution history.
              </p>
            </div>
          </div>
        </div>
        {hasPermission('tickets', 'rw') && (
          <button
            onClick={() => setShowRaiseModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono font-semibold text-xs transition-colors shadow-lg shadow-amber-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Maintenance Ticket</span>
          </button>
        )}
      </div>

      {/* Status Alert Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-red-950/80 border-red-800 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs font-mono opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Total Asset Tickets</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800 flex items-center justify-center text-blue-400">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Critical Active Issues</p>
            <p className="text-2xl font-bold text-red-400 font-mono mt-1">{criticalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">In Progress</p>
            <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{inProgressCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Resolved / Closed</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{resolvedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Tabs */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-[#1f2d44]">
          {STATUS_LIST.map((st) => (
            <button
              key={st.value}
              onClick={() => setStatusTab(st.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex-shrink-0 ${
                statusTab === st.value
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Search & Priority */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ticket ID, title, asset ID, engineer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400 font-mono">
            Loading maintenance tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 font-mono bg-[#111827] rounded-xl border border-[#1f2d44]">
            No tickets found matching the selected filter criteria.
          </div>
        ) : (
          tickets.map((t) => {
            const prioStyle = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.MEDIUM;
            const statusStyle = STATUS_COLORS[t.status] || STATUS_COLORS.OPEN;

            return (
              <div
                key={t.id}
                onClick={() => handleOpenTicketDetail(t.id)}
                className="bg-[#111827] border border-[#1f2d44] hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl group flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400" />
                      {t.id}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className={`px-2 py-0.5 rounded border font-bold ${prioStyle.bg} ${prioStyle.text} ${prioStyle.border}`}>
                        {t.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded border font-bold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 mb-2">
                    {t.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                    {t.description}
                  </p>

                  {/* Asset Context */}
                  <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] mb-4 font-mono text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="text-cyan-300 font-bold truncate">{t.asset_id}</span>
                      <span className="text-slate-400 truncate">({t.asset_name || 'Grid Asset'})</span>
                    </div>
                    {typeof t.asset_health === 'number' && (
                      <span className="text-[10px] font-bold text-slate-300 flex-shrink-0">
                        {t.asset_health}/100 Health
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer / Assignee Info */}
                <div className="pt-3 border-t border-[#1f2d44] flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{t.assigned_to_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RAISE TICKET MODAL */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-mono">Raise Maintenance Ticket</h3>
              </div>
              <button onClick={() => setShowRaiseModal(false)} className="text-slate-400 hover:text-white font-mono text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleRaiseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Select Target Grid Asset *</label>
                <select
                  required
                  value={createForm.asset_id}
                  onChange={(e) => {
                    const selectedA = assets.find((a) => a.id === e.target.value);
                    setCreateForm({
                      ...createForm,
                      asset_id: e.target.value,
                      title: selectedA ? `Maintenance & Fix for ${selectedA.name} (${selectedA.id})` : createForm.title,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="">-- Choose Grid Asset --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.name} ({a.status} - Health {a.health_score}/100)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Ticket Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect Transformer Winding Thermal Anomaly"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Issue Priority *</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="CRITICAL">CRITICAL (Immediate Action Required)</option>
                    <option value="HIGH">HIGH (Severe Degradation/Risk)</option>
                    <option value="MEDIUM">MEDIUM (Standard Maintenance)</option>
                    <option value="LOW">LOW (Routine / Inspection)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Target Fix / Due Date</label>
                  <input
                    type="date"
                    value={createForm.due_date || ''}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Detailed Problem Description & Diagnostic Notes *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe root cause telemetry anomalies, thermal hotspots, oil degradation readings, or physical damage..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1f2d44]">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Assign to Maintenance Engineer / Tech</label>
                  <select
                    value={createForm.assigned_to_user_id || ''}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        assigned_to_user_id: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="">-- Select Engineer/Tech --</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Assign Field Response Crew (Optional)</label>
                  <select
                    value={createForm.assigned_crew_id || ''}
                    onChange={(e) => setCreateForm({ ...createForm, assigned_crew_id: e.target.value || undefined })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="">-- Select Field Crew --</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1f2d44]">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/50"
                >
                  Raise Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET DETAIL DRAWER / MODAL */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-3xl w-full shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#1f2d44] pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-amber-400 font-bold">{selectedTicket.id}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Raised by {selectedTicket.created_by_name}</span>
                </div>
                <h2 className="text-lg font-bold text-white font-mono mt-1">{selectedTicket.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                {isMainAdmin() && (
                  <button
                    onClick={() => handleDeleteTicketClick(selectedTicket.id)}
                    className="p-1.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 transition-colors"
                    title="Delete Ticket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white font-mono text-sm p-1">
                  ✕
                </button>
              </div>
            </div>

            {/* Lifecycle Status Stepper */}
            <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#1e2a3f]">
              <p className="text-[11px] font-mono uppercase text-slate-400 mb-3">Ticket Lifecycle Progress</p>
              <div className="flex items-center justify-between text-xs font-mono">
                {['OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESOLVED', 'CLOSED'].map((st, idx) => {
                  const isCurrent = selectedTicket.status === st;
                  const isPassed =
                    ['OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESOLVED', 'CLOSED'].indexOf(selectedTicket.status) >= idx;

                  return (
                    <div key={st} className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] border ${
                          isCurrent
                            ? 'bg-amber-500 text-black border-amber-300 animate-pulse'
                            : isPassed
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span className={isCurrent ? 'text-amber-400 font-bold' : isPassed ? 'text-slate-200' : 'text-slate-500'}>
                        {st.replace('_', ' ')}
                      </span>
                      {idx < 4 && <div className="w-4 sm:w-8 h-0.5 bg-slate-800" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Transition Action Bar */}
            {hasPermission('tickets', 'rw') && (
              <div className="p-4 rounded-xl bg-[#162032] border border-[#1f2d44] space-y-3">
                <p className="text-xs font-mono font-bold text-slate-200">Update Ticket Status:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.status !== 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold"
                    >
                      Start Work (In Progress)
                    </button>
                  )}
                  {selectedTicket.status !== 'PENDING_REVIEW' && (
                    <button
                      onClick={() => handleStatusTransition('PENDING_REVIEW')}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold"
                    >
                      Submit for Review
                    </button>
                  )}
                  {selectedTicket.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleStatusTransition('RESOLVED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {selectedTicket.status !== 'CLOSED' && (
                    <button
                      onClick={() => handleStatusTransition('CLOSED')}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-mono text-xs font-bold"
                    >
                      Close Ticket
                    </button>
                  )}
                </div>

                {showResolutionBox && (
                  <div className="pt-3 border-t border-[#1f2d44] space-y-2">
                    <label className="block text-xs font-mono text-emerald-400 font-bold">
                      Enter Fix & Resolution Notes *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Describe the actions performed, components replaced, or dielectric test results..."
                      value={resolutionInput}
                      onChange={(e) => setResolutionInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-emerald-800 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleStatusTransition('RESOLVED')}
                      className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold"
                    >
                      Save Resolution Notes & Confirm Resolved
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Asset Context */}
              <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#1e2a3f] space-y-2">
                <p className="text-[11px] uppercase font-mono text-slate-400">Target Asset</p>
                <p className="text-sm font-bold text-cyan-300 font-mono">
                  {selectedTicket.asset_id} - {selectedTicket.asset_name}
                </p>
                {typeof selectedTicket.asset_health === 'number' && (
                  <p className="text-xs text-slate-300 font-mono">
                    Health Index: <span className="font-bold text-white">{selectedTicket.asset_health}/100</span>
                  </p>
                )}
              </div>

              {/* Assignees */}
              <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#1e2a3f] space-y-2 font-mono text-xs">
                <p className="text-[11px] uppercase text-slate-400">Assigned Personnel</p>
                <div className="flex items-center gap-2 text-slate-200">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Engineer: {selectedTicket.assigned_to_name || 'Unassigned'}</span>
                </div>
                {selectedTicket.assigned_crew_name && (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Field Crew: {selectedTicket.assigned_crew_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#1e2a3f] space-y-1">
              <p className="text-[11px] uppercase font-mono text-slate-400">Issue Description</p>
              <p className="text-xs text-slate-200 leading-relaxed">{selectedTicket.description}</p>
            </div>

            {/* Resolution Notes if available */}
            {selectedTicket.resolution_notes && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 space-y-1">
                <p className="text-[11px] uppercase font-mono text-emerald-400 font-bold">Fix Resolution Summary</p>
                <p className="text-xs text-emerald-200 font-mono">{selectedTicket.resolution_notes}</p>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="space-y-3 pt-2 border-t border-[#1f2d44]">
              <h4 className="text-xs font-bold text-slate-200 font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Ticket Activity Timeline & Comments</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedTicket.activities?.map((act) => (
                  <div key={act.id} className="p-3 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="font-bold text-cyan-400">{act.user_name}</span>
                      <span>{new Date(act.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-300 font-mono text-xs">{act.comment}</p>
                  </div>
                ))}
              </div>

              {/* Add Comment Form */}
              {hasPermission('tickets', 'rw') && (
                <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add progress note or comment..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsPage;
