import React from 'react';
import { RiskLevel } from '../../types';

interface RiskBadgeProps {
  level: RiskLevel | string;
  score?: number;
  showPulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  showPulse = false,
  size = 'md'
}) => {
  const normalizedLevel = (level || '').toUpperCase();

  let bgClass = 'bg-slate-800/80 text-slate-300 border-slate-700';
  let dotClass = 'bg-slate-400';
  let textLabel = normalizedLevel;

  switch (normalizedLevel) {
    case 'LOW':
      bgClass = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60';
      dotClass = 'bg-emerald-400';
      break;
    case 'MODERATE':
      bgClass = 'bg-amber-950/40 text-amber-300 border-amber-800/60';
      dotClass = 'bg-amber-400';
      break;
    case 'HIGH':
      bgClass = 'bg-orange-950/40 text-orange-300 border-orange-800/60';
      dotClass = 'bg-orange-400';
      break;
    case 'VERY_HIGH':
      bgClass = 'bg-rose-950/40 text-rose-300 border-rose-800/60';
      dotClass = 'bg-rose-400';
      textLabel = 'VERY HIGH';
      break;
    case 'CRITICAL':
      bgClass = 'bg-red-950/60 text-red-200 border-red-700 shadow-sm shadow-red-900/50';
      dotClass = 'bg-red-500 animate-ping';
      break;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs font-semibold px-2.5 py-1 gap-2',
    lg: 'text-sm font-bold px-3 py-1.5 gap-2.5'
  }[size];

  const isCritical = normalizedLevel === 'CRITICAL';

  return (
    <span
      className={`inline-flex items-center rounded-md border tracking-wider uppercase font-mono ${bgClass} ${sizeClasses} ${
        isCritical && showPulse ? 'ring-1 ring-red-500/50' : ''
      }`}
    >
      <span className="relative flex h-2 w-2">
        {isCritical && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`}></span>
      </span>
      <span>{textLabel}</span>
      {score !== undefined && (
        <span className="opacity-90 pl-1 font-bold border-l border-current/30 tabular-nums">
          {score}
        </span>
      )}
    </span>
  );
};
