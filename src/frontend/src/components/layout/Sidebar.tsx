import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  MapPin,
  Wrench,
  CloudLightning,
  History,
  Bot,
  Sliders,
  ShieldCheck,
  Zap,
  Activity,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardSummary } from '../../services/api';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/assets', label: 'Grid Assets', icon: Cpu },
  { path: '/risk-map', label: 'Risk Map', icon: MapPin },
  { path: '/maintenance', label: 'Maintenance', icon: Wrench, badge: 'Active', badgeVariant: 'danger' },
  { path: '/weather', label: 'Weather Intel', icon: CloudLightning, badge: 'Live', badgeVariant: 'warning' },
  { path: '/incidents', label: 'Incidents Log', icon: History },
  { path: '/advisor', label: 'AI Advisor', icon: Bot, badge: 'Live', badgeVariant: 'cyan' },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [gridHealth, setGridHealth] = useState<number>(71);

  useEffect(() => {
    let isMounted = true;
    const fetchHealth = async () => {
      try {
        const summary = await getDashboardSummary();
        if (isMounted && summary && typeof summary.grid_health_score === 'number') {
          setGridHealth(summary.grid_health_score);
        }
      } catch {
        // Fallback silently if offline or initial load
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const confirmLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-[#1e2a3f] flex flex-col flex-shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#1e2a3f]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-900/30">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-mono">
              GridGuard <span className="text-cyan-400 font-extrabold text-xs px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">AI</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              Grid Resilience Advisor
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
          Operational Center
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    item.badgeVariant === 'danger'
                      ? 'bg-red-950/80 text-red-300 border-red-800'
                      : item.badgeVariant === 'warning'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                      : item.badgeVariant === 'cyan'
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
          Configuration & Engine
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all group ${
              isActive
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span>Risk Settings</span>
          </div>
        </NavLink>
      </div>

      {/* System Status Panel in Footer */}
      <div className="p-3 m-3 rounded-lg bg-[#121b2b] border border-[#1e2a3f]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
              Grid Status
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
            ONLINE
          </span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span>Health Index</span>
          <span className="text-white font-bold">{gridHealth}/100</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, gridHealth))}%` }}
          />
        </div>
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span>GridGuard AI</span>
          <span className="font-mono text-cyan-400">v1.0.0</span>
        </div>
      </div>

      {/* User Profile & Logout */}
      <div className="p-3 mx-3 mb-3 rounded-lg bg-[#121b2b] border border-[#1e2a3f]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-xs font-bold font-mono flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 leading-none truncate">
              {user?.name || 'Admin'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono leading-none mt-1 truncate">
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white font-mono mb-2">Confirm Logout</h3>
            <p className="text-sm text-slate-400 mb-6">Are you sure you want to log out of the Grid Operations Center?</p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-mono border border-transparent hover:border-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout}
                className="px-4 py-2 rounded text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors font-mono shadow-lg shadow-red-900/20"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

