import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  Lock,
  Edit2,
  Trash2,
  Key,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  Zap,
  RefreshCw,
  Sliders,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '../services/api';
import { UserResponse, UserCreatePayload, UserUpdatePayload } from '../types';

const ROLES_LIST = [
  { value: 'MAIN_ADMIN', label: 'Main Admin', color: 'cyan', desc: 'Full system administration & user access control' },
  { value: 'GRID_OPERATOR', label: 'Grid Operator', color: 'blue', desc: 'Monitors real-time grid status, telemetry & alerts' },
  { value: 'MAINTENANCE_ENGINEER', label: 'Maintenance Engineer', color: 'amber', desc: 'Assigned to asset diagnostics, repairs & ticket resolution' },
  { value: 'FIELD_TECH', label: 'Field Technician', color: 'purple', desc: 'On-site sensor inspection and crew field deployment' },
  { value: 'VIEWER', label: 'Read-Only Viewer', color: 'slate', desc: 'Read-only visibility for executive dashboards' },
];

const SECTIONS_LIST = [
  { id: 'dashboard', label: 'Overview Dashboard' },
  { id: 'assets', label: 'Grid Assets & Sub-stations' },
  { id: 'tickets', label: 'Maintenance Tickets & Asset Fixes' },
  { id: 'maintenance', label: 'Crew Dispatch & Planning' },
  { id: 'iot', label: 'IoT Stream & Edge Gateways' },
  { id: 'weather', label: 'Weather Intel & Disaster Stress' },
  { id: 'incidents', label: 'Incidents Log & Post-Mortem' },
  { id: 'advisor', label: 'AI Advisor & Decision Support' },
  { id: 'users', label: 'User Management & RBAC' },
  { id: 'settings', label: 'Risk Model & Threshold Settings' },
];

const DEFAULT_PERMISSIONS: Record<string, string> = {
  dashboard: 'rw',
  assets: 'rw',
  tickets: 'rw',
  maintenance: 'rw',
  iot: 'rw',
  weather: 'rw',
  incidents: 'rw',
  advisor: 'rw',
  users: 'rw',
  settings: 'rw',
};

export const UserManagementPage: React.FC = () => {
  const { user: currentUser, isMainAdmin, refreshUserProfile } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [resettingUser, setResettingUser] = useState<UserResponse | null>(null);
  const [viewingUser, setViewingUser] = useState<UserResponse | null>(null);

  const handleDeleteUserClick = async (u: UserResponse) => {
    if (!window.confirm(`Are you sure you want to deactivate user ${u.name} (${u.email})?`)) return;
    try {
      await deleteUser(u.id);
      setStatusMessage({ type: 'success', text: `User ${u.email} account deactivated successfully.` });
      fetchUsersList();
      refreshUserProfile();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to deactivate user.' });
    }
  };


  // Form states
  const [createForm, setCreateForm] = useState<UserCreatePayload>({
    email: '',
    password: '',
    name: '',
    role: 'GRID_OPERATOR',
    department: 'Grid Operations',
    phone: '',
    permissions: { ...DEFAULT_PERMISSIONS },
  });

  const [editForm, setEditForm] = useState<UserUpdatePayload>({
    name: '',
    role: '',
    department: '',
    phone: '',
    is_active: true,
    permissions: {},
  });

  const [newPassword, setNewPassword] = useState<string>('');
  const [showPass, setShowPass] = useState<boolean>(false);

  const fetchUsersList = async () => {
    setLoading(true);
    try {
      const data = await getUsers(searchTerm, roleFilter);
      setUsers(data);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, [searchTerm, roleFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password || !createForm.name) {
      setStatusMessage({ type: 'error', text: 'Please fill in Email, Password, and Full Name.' });
      return;
    }

    try {
      await createUser(createForm);
      setStatusMessage({ type: 'success', text: `User ${createForm.email} created successfully!` });
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        password: '',
        name: '',
        role: 'GRID_OPERATOR',
        department: 'Grid Operations',
        phone: '',
        permissions: { ...DEFAULT_PERMISSIONS },
      });
      fetchUsersList();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create user.' });
    }
  };

  const handleEditClick = (u: UserResponse) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      role: u.role,
      department: u.department || '',
      phone: u.phone || '',
      is_active: u.is_active,
      permissions: u.permissions ? { ...u.permissions } : { ...DEFAULT_PERMISSIONS },
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await updateUser(editingUser.id, editForm);
      setStatusMessage({ type: 'success', text: `User ${editingUser.name} updated successfully!` });
      setEditingUser(null);
      fetchUsersList();
      refreshUserProfile();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update user.' });
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;

    try {
      await resetUserPassword(resettingUser.id, newPassword);
      setStatusMessage({ type: 'success', text: `Password for ${resettingUser.email} reset successfully!` });
      setResettingUser(null);
      setNewPassword('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reset password.' });
    }
  };

  const handleToggleActive = async (u: UserResponse) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      setStatusMessage({
        type: 'success',
        text: `User ${u.name} account ${!u.is_active ? 'activated' : 'deactivated'}.`,
      });
      fetchUsersList();
      refreshUserProfile();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to change status.' });
    }
  };

  // Metrics
  const totalUsers = users.length;
  const mainAdminsCount = users.filter((u) => u.role === 'MAIN_ADMIN').length;
  const maintenanceEngCount = users.filter((u) => u.role === 'MAINTENANCE_ENGINEER' || u.role === 'FIELD_TECH').length;
  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#111827] p-6 rounded-xl border border-[#1f2d44]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono tracking-tight flex items-center gap-2">
                User Management & Access Control
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  MAIN ADMIN
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Create user credentials, assign roles, and set granular section-wise access rights across GridGuard modules.
              </p>
            </div>
          </div>
        </div>
        {isMainAdmin() && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs transition-all shadow-lg shadow-cyan-950/60 border border-cyan-400/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Create New User</span>
          </button>
        )}
      </div>

      {/* Alert Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-red-950/80 border-red-800 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-xs font-medium">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Total System Users</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{totalUsers}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Main Administrators</p>
            <p className="text-2xl font-bold text-cyan-400 font-mono mt-1">{mainAdminsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Maintenance & Field Techs</p>
            <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{maintenanceEngCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800 flex items-center justify-center text-amber-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase font-mono text-slate-400">Active Accounts</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2d44] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users by name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Roles</option>
              {ROLES_LIST.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMainAdmin() && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs transition-colors shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          )}
          <button
            onClick={fetchUsersList}
            className="p-2 rounded-lg bg-[#1a2333] hover:bg-[#222e44] text-slate-400 hover:text-white transition-colors"
            title="Refresh User List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-[#111827] border border-[#1f2d44] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#172033] border-b border-[#1f2d44] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Department & Phone</th>
                <th className="p-4">Section Permissions</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3f]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-mono">
                    Loading registered system users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-mono">
                    No users found matching filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleObj = ROLES_LIST.find((r) => r.value === u.role) || ROLES_LIST[0];
                  const isSelf = currentUser?.id === u.id;

                  // Section counts
                  const perms = u.permissions || DEFAULT_PERMISSIONS;
                  const rwCount = Object.values(perms).filter((p) => p === 'rw').length;
                  const rCount = Object.values(perms).filter((p) => p === 'r').length;
                  const noneCount = Object.values(perms).filter((p) => p === 'none').length;

                  return (
                    <tr key={u.id} className="hover:bg-[#162032]/60 transition-colors">
                      {/* Name & Email */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white font-bold font-mono text-xs flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {u.name}
                              {isSelf && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-bold border ${
                            u.role === 'MAIN_ADMIN'
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                              : u.role === 'MAINTENANCE_ENGINEER'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : u.role === 'FIELD_TECH'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                              : u.role === 'GRID_OPERATOR'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {roleObj.label}
                        </span>
                      </td>

                      {/* Dept & Phone */}
                      <td className="p-4">
                        <div className="text-slate-300 font-medium">{u.department || 'Grid Operations'}</div>
                        {u.phone ? (
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{u.phone}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">No phone</span>
                        )}
                      </td>

                      {/* Section Permissions Overview */}
                      <td className="p-4">
                        {u.role === 'MAIN_ADMIN' ? (
                          <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                            Full Access (10/10)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                              {rwCount} RW
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                              {rCount} Read
                            </span>
                            {noneCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800">
                                {noneCount} Blocked
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <button
                          onClick={() => isMainAdmin() && !isSelf && handleToggleActive(u)}
                          disabled={!isMainAdmin() || isSelf}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-colors ${
                            u.is_active
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800 hover:bg-emerald-900/80'
                              : 'bg-red-950/80 text-red-400 border-red-800 hover:bg-red-900/80'
                          }`}
                        >
                          {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{u.is_active ? 'ACTIVE' : 'DEACTIVATED'}</span>
                        </button>
                      </td>
                      {/* Action Buttons */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingUser(u)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                            title="View Credentials & Section Permissions"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isMainAdmin() && (
                            <>
                              <button
                                onClick={() => handleEditClick(u)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                                title="Edit Role & Permissions"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setResettingUser(u)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-purple-400 hover:bg-slate-800 transition-colors"
                                title="Reset User Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => handleDeleteUserClick(u)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                  title="Deactivate Account"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>


                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">Create New System User</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Email Address (Login Credential) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@electricity.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Substation Protection Unit"
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91-9876543210"
                    value={createForm.phone || ''}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Primary Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section Access Permissions */}
              <div className="pt-3 border-t border-[#1f2d44]">
                <h4 className="text-xs font-bold text-slate-200 font-mono mb-2 flex items-center justify-between">
                  <span>Section-Wise Access Rights</span>
                  <span className="text-[10px] font-normal text-slate-400">Configure Module Access Level</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {SECTIONS_LIST.map((sec) => {
                    const currentPerm = createForm.permissions?.[sec.id] || 'rw';
                    return (
                      <div
                        key={sec.id}
                        className="p-2 rounded bg-[#0b0f17] border border-[#1e2a3f] flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-300 font-medium truncate max-w-[180px]">{sec.label}</span>
                        <select
                          value={currentPerm}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              permissions: {
                                ...createForm.permissions,
                                [sec.id]: e.target.value,
                              },
                            })
                          }
                          className="px-2 py-1 rounded bg-[#162032] border border-slate-700 text-[11px] font-mono text-cyan-300"
                        >
                          <option value="rw">Read & Write</option>
                          <option value="r">Read Only</option>
                          <option value="none">No Access</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1f2d44]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">Edit User & Permissions</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Email (Read Only)</label>
                  <input
                    type="text"
                    disabled
                    value={editingUser.email}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Role</label>
                  <select
                    value={editForm.role || 'GRID_OPERATOR'}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Account Status</label>
                  <select
                    value={editForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="active">Active Account</option>
                    <option value="inactive">Deactivated</option>
                  </select>
                </div>
              </div>

              {/* Section Access Permissions */}
              <div className="pt-3 border-t border-[#1f2d44]">
                <h4 className="text-xs font-bold text-slate-200 font-mono mb-2">
                  Section-Wise Access Permissions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {SECTIONS_LIST.map((sec) => {
                    const currentPerm = editForm.permissions?.[sec.id] || 'rw';
                    return (
                      <div
                        key={sec.id}
                        className="p-2 rounded bg-[#0b0f17] border border-[#1e2a3f] flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-300 font-medium truncate max-w-[180px]">{sec.label}</span>
                        <select
                          value={currentPerm}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              permissions: {
                                ...editForm.permissions,
                                [sec.id]: e.target.value,
                              },
                            })
                          }
                          className="px-2 py-1 rounded bg-[#162032] border border-slate-700 text-[11px] font-mono text-cyan-300"
                        >
                          <option value="rw">Read & Write</option>
                          <option value="r">Read Only</option>
                          <option value="none">No Access</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1f2d44]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-mono">Reset User Password</h3>
              </div>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Set a new password for <span className="font-mono text-cyan-400 font-bold">{resettingUser.email}</span>.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 rounded text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/50"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW USER CREDENTIALS & ACCESS MODAL */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">User Credentials & Access Details</h3>
              </div>
              <button
                onClick={() => setViewingUser(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#1e2a3f]">
                <p className="text-slate-400 uppercase text-[10px]">Full Name</p>
                <p className="text-sm font-bold text-white mt-0.5">{viewingUser.name}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#1e2a3f]">
                <p className="text-slate-400 uppercase text-[10px]">Login Email (Credential)</p>
                <p className="text-sm font-bold text-cyan-400 mt-0.5">{viewingUser.email}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#1e2a3f]">
                <p className="text-slate-400 uppercase text-[10px]">Assigned Role</p>
                <p className="text-sm font-bold text-amber-400 mt-0.5">{viewingUser.role.replace('_', ' ')}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#1e2a3f]">
                <p className="text-slate-400 uppercase text-[10px]">Department</p>
                <p className="text-sm font-bold text-slate-200 mt-0.5">{viewingUser.department || 'Grid Operations'}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1f2d44]">
              <h4 className="text-xs font-bold text-slate-200 font-mono mb-3">
                10-Module Section Permission Matrix
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {SECTIONS_LIST.map((sec) => {
                  const perm = viewingUser.role === 'MAIN_ADMIN' ? 'rw' : (viewingUser.permissions?.[sec.id] || 'rw');
                  return (
                    <div
                      key={sec.id}
                      className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#1e2a3f] flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-slate-300 font-medium truncate max-w-[180px]">{sec.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          perm === 'rw'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            : perm === 'r'
                            ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                            : 'bg-red-950/80 text-red-300 border-red-800'
                        }`}
                      >
                        {perm === 'rw' ? 'READ & WRITE' : perm === 'r' ? 'READ ONLY' : 'BLOCKED'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[#1f2d44]">
              <button
                onClick={() => setViewingUser(null)}
                className="px-4 py-2 rounded text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;

