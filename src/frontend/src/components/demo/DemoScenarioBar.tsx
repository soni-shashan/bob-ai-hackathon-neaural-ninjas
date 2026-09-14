import React, { useState, useEffect } from 'react';
import { PlayCircle, RefreshCw, Zap, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDemoState, setDemoStage } from '../../services/api';
import { DemoStateResponse, DemoStage } from '../../types';

export const DemoScenarioBar: React.FC<{ onStageChange?: () => void }> = ({ onStageChange }) => {
  const [demoState, setDemoState] = useState<DemoStateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchState = async () => {
    try {
      const s = await getDemoState();
      setDemoState(s);
    } catch (e) {
      console.error("Failed to load demo state", e);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleSelectStage = async (stage: DemoStage) => {
    setLoading(true);
    try {
      const updated = await setDemoStage(stage);
      setDemoState(updated);
      if (onStageChange) onStageChange();
    } catch (e) {
      console.error("Failed to set demo stage", e);
    } finally {
      setLoading(false);
    }
  };

  const currentStage = demoState?.current_stage || 'critical';

  return (
    <div className="bg-[#0f172a] border-b border-cyan-900/40 text-xs px-4 py-2 relative z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Hackathon Demo Tag & Context */}
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono font-semibold uppercase tracking-wider text-[11px]">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Hackathon Demo Simulator
          </span>
          <span className="text-slate-300 hidden md:inline">
            Active Asset: <strong className="text-white font-mono">TR-104 (Naroda Substation)</strong>
          </span>
        </div>

        {/* Center: Stage Selectors */}
        <div className="flex items-center gap-1.5 bg-[#0b0f17] p-1 rounded-md border border-slate-800">
          <button
            onClick={() => handleSelectStage('baseline')}
            disabled={loading}
            className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
              currentStage === 'baseline'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Stage 1: Baseline (Risk 42)
          </button>

          <span className="text-slate-600 font-mono">→</span>

          <button
            onClick={() => handleSelectStage('degradation')}
            disabled={loading}
            className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
              currentStage === 'degradation'
                ? 'bg-amber-900/60 text-amber-200 border border-amber-700 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Stage 2: Degradation (Risk 68)
          </button>

          <span className="text-slate-600 font-mono">→</span>

          <button
            onClick={() => handleSelectStage('critical')}
            disabled={loading}
            className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
              currentStage === 'critical'
                ? 'bg-red-950 text-red-200 border border-red-600 shadow-sm font-semibold animate-pulse-subtle'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            Stage 3: Critical Storm (Risk 94)
          </button>
        </div>

        {/* Right: Quick Action Links */}
        <div className="flex items-center gap-3">
          <Link
            to="/assets/TR-104"
            className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 hover:underline text-[11px]"
          >
            Inspect TR-104 Details
            <ChevronRight className="w-3 h-3" />
          </Link>
          <span className="text-slate-700">|</span>
          <Link
            to="/maintenance"
            className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 hover:underline text-[11px]"
          >
            Maintenance Queue
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
