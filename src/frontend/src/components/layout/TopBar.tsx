import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, CloudRain, Bell, UserCheck, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TopBar: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
      setDateStr(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 bg-[#0d131f] border-b border-[#1e2a3f] flex items-center justify-between px-6 z-20 flex-shrink-0">
      {/* Left: Operational Title & Grid Region */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-200">
            Grid Operations Center
          </span>
        </div>
        <span className="text-slate-700 hidden sm:inline">|</span>
        <span className="text-xs text-slate-400 hidden sm:inline font-mono">
          Western Sub-Transmission Division • Ahmedabad Ring
        </span>
      </div>

      {/* Right: Telemetry Time, Weather Alert Indicator, Notifications & User */}
      <div className="flex items-center gap-5">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white font-bold tracking-tight">{timeStr}</span>
          <span className="text-slate-500 text-[10px]">UTC+5:30</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 text-[11px]">{dateStr}</span>
        </div>

        {/* Severe Weather Warning Pill */}
        <Link
          to="/weather"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs font-mono hover:bg-amber-900/50 transition-colors"
        >
          <CloudRain className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="hidden sm:inline font-semibold">East Grid Storm Alert</span>
          <span className="bg-amber-900/80 px-1 py-0.2 text-[10px] rounded border border-amber-700">
            48mm/h
          </span>
        </Link>

        {/* Notifications Icon */}
        <Link
          to="/dashboard"
          className="relative p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
        </Link>

        {/* Operator Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-cyan-800 flex items-center justify-center text-cyan-400 text-xs font-bold font-mono">
            OP
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-slate-200 leading-none">
              Operator Console
            </p>
            <p className="text-[10px] text-cyan-400/80 font-mono leading-none mt-1">
              Senior Grid Controller
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
