import React, { useState, useEffect, useRef } from 'react';
import { Clock, ShieldAlert, CloudRain, Bell, UserCheck, Radio, Menu, Globe, ChevronDown, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, LANGUAGE_OPTIONS, Language } from '../../context/LanguageContext';

interface TopBarProps {
  onMenuToggle: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle }) => {
  const { user } = useAuth();
  const { language, setLanguage, t, currentOption } = useLanguage();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close language dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-[#0d131f] border-b border-[#1e2a3f] flex items-center justify-between px-3 sm:px-4 md:px-6 z-20 flex-shrink-0">
      {/* Left: Hamburger + Operational Title & Grid Region */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Mobile hamburger menu */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-200 truncate">
            <span className="hidden sm:inline">{t('grid_ops_center', 'Grid Operations Center')}</span>
            <span className="sm:hidden">{t('grid_ops_short', 'GridOps')}</span>
          </span>
        </div>
        <span className="text-slate-700 hidden md:inline">|</span>
        <span className="text-xs text-slate-400 hidden md:inline font-mono truncate">
          {t('regional_power_grid', 'Regional Power Grid • Transmission & Distribution Operations')}
        </span>
      </div>

      {/* Right: Language Dropdown, Telemetry Time, Weather Alert, Notifications & User */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-5 flex-shrink-0">
        {/* Real-time Clock */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white font-bold tracking-tight">{timeStr}</span>
          <span className="text-slate-500 text-[10px]">UTC+5:30</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 text-[11px]">{dateStr}</span>
        </div>

        {/* Dynamic Language Selector Dropdown */}
        <div className="relative" ref={langDropdownRef}>
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#131d2e] hover:bg-slate-800 border border-cyan-900/60 hover:border-cyan-500/60 text-xs font-mono text-cyan-300 transition-all shadow-sm"
            title="Select Language / ભાષા પસંદ કરો / भाषा चुनें"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold">{currentOption.flag} {currentOption.nativeName}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLangOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-[#0a0f1c] border border-cyan-800/80 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>{t('select_language', 'Select Language')}</span>
              </div>
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = opt.code === language;
                return (
                  <button
                    key={opt.code}
                    onClick={() => {
                      setLanguage(opt.code);
                      setIsLangOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors text-left ${
                      isSelected
                        ? 'bg-cyan-950/80 text-cyan-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{opt.flag}</span>
                      <span>{opt.nativeName}</span>
                      <span className="text-[10px] text-slate-500">({opt.name})</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Severe Weather Warning Pill */}
        <Link
          to="/weather"
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs font-mono hover:bg-amber-900/50 transition-colors"
        >
          <CloudRain className="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" />
          <span className="hidden sm:inline font-semibold truncate">{t('storm_alert', 'East Grid Storm Alert')}</span>
          <span className="hidden md:inline bg-amber-900/80 px-1 py-0.2 text-[10px] rounded border border-amber-700">
            48mm/h
          </span>
        </Link>

        {/* Notifications Icon */}
        <Link
          to="/dashboard"
          className="relative p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors flex-shrink-0"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
        </Link>

        {/* Operator Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 border border-cyan-800 flex items-center justify-center text-white text-xs font-bold font-mono flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-slate-200 leading-none">
              {user?.name || t('operator_console', 'Operator Console')}
            </p>
            <p className="text-[10px] text-cyan-400 font-mono leading-none mt-1 font-bold">
              {user?.role?.replace('_', ' ') || 'MAIN ADMIN'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

