import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant: 'danger' | 'warning' | 'success' | 'info';
  };
  trend?: {
    text: string;
    isUp?: boolean;
    isGood?: boolean;
  };
  accentColor?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  accentColor = 'cyan'
}) => {
  const badgeStyles = {
    danger: 'bg-red-950/60 text-red-300 border-red-800/80',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
    info: 'bg-sky-950/60 text-sky-300 border-sky-800/80',
  }[badge?.variant || 'info'];

  return (
    <div className="bg-[#111827]/90 border border-[#1f2d44] rounded-lg p-4 shadow-lg backdrop-blur-sm relative overflow-hidden transition-all duration-200 hover:border-slate-600 hover:bg-[#151f33] min-w-0">
      {/* Subtle top edge glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-60"></div>
      
      {/* Header: Title + Icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase font-semibold tracking-wider text-slate-400 leading-tight min-w-0">
          {title}
        </p>
        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-cyan-400 flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Value + Badge */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums whitespace-nowrap">
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${badgeStyles}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Footer: Subtitle + Trend */}
      {(subtitle || trend) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
          {subtitle && <span className="truncate min-w-0">{subtitle}</span>}
          {trend && (
            <span
              className={`font-mono text-[11px] font-medium flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                trend.isGood ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trend.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
