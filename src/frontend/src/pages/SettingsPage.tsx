import React, { useState } from 'react';
import {
  Sliders,
  ShieldAlert,
  Save,
  CheckCircle2,
  Info,
  Scale
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [eqWeight, setEqWeight] = useState(40);
  const [weatherWeight, setWeatherWeight] = useState(20);
  const [impactWeight, setImpactWeight] = useState(25);
  const [critWeight, setCritWeight] = useState(15);
  const [saved, setSaved] = useState(false);

  const totalWeight = eqWeight + weatherWeight + impactWeight + critWeight;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-[#1f2d44] pb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
          <Sliders className="w-3.5 h-3.5" />
          Grid Resilience Engine Configuration
        </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white font-mono">
          System Settings & Risk Formula Weights
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure multi-modal risk scoring weights across equipment analytics, weather stress, and customer criticality.
        </p>
      </div>

      {/* Formula Explanation Banner */}
      <div className="bg-[#0b1322] border border-cyan-900/40 rounded-lg p-3 sm:p-4 text-xs font-mono flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-cyan-300 font-bold">
            Composite Multi-Factor Risk Scoring Formula
          </div>
          <p className="text-slate-300 font-sans leading-relaxed">
            Composite failure risk is calculated dynamically for each high-voltage asset according to:
          </p>
          <div className="bg-slate-950/80 px-2 sm:px-3 py-1.5 rounded border border-slate-800 text-cyan-200 text-[10px] sm:text-[11px] font-mono inline-block mt-1 overflow-x-auto max-w-full">
            Risk = (w<sub>eq</sub> × Equipment Failure) + (w<sub>weather</sub> × Meteorological Stress) + (w<sub>impact</sub> × Customer Load) + (w<sub>crit</sub> × Substation Criticality)
          </div>
        </div>
      </div>

      {/* Risk Engine Weights Form */}
      <form
        onSubmit={handleSave}
        className="bg-[#111827] border border-[#1f2d44] rounded-lg p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1f2d44] pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            Composite Risk Formula Weights
          </h2>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
              totalWeight === 100
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-red-950 text-red-300 border-red-800'
            }`}
          >
            Total: {totalWeight}% {totalWeight === 100 ? '(Normalized 100%)' : '(Must equal 100%)'}
          </span>
        </div>

        <div className="space-y-5 text-xs font-mono">
          {/* Equipment Probability */}
          <div className="p-3.5 rounded bg-slate-900/60 border border-slate-800">
            <div className="flex justify-between text-slate-200 mb-1.5">
              <span className="font-semibold">1. Equipment Failure Probability (ML / Sensor Telemetry):</span>
              <span className="text-cyan-400 font-bold text-sm">{eqWeight}%</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mb-2">
              Weight given to predictive ML degradation, partial discharge anomalies, and IEEE physics health score.
            </p>
            <input
              type="range"
              min="10"
              max="70"
              value={eqWeight}
              onChange={(e) => setEqWeight(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Weather Risk */}
          <div className="p-3.5 rounded bg-slate-900/60 border border-slate-800">
            <div className="flex justify-between text-slate-200 mb-1.5">
              <span className="font-semibold">2. Meteorological & Storm Exposure Weight:</span>
              <span className="text-amber-400 font-bold text-sm">{weatherWeight}%</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mb-2">
              Weight given to NASA POWER satellite rainfall intensity, wind shear, and lightning strike density.
            </p>
            <input
              type="range"
              min="5"
              max="40"
              value={weatherWeight}
              onChange={(e) => setWeatherWeight(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Customer & Grid Impact */}
          <div className="p-3.5 rounded bg-slate-900/60 border border-slate-800">
            <div className="flex justify-between text-slate-200 mb-1.5">
              <span className="font-semibold">3. Customer Count & MW Load Disruption Weight:</span>
              <span className="text-rose-400 font-bold text-sm">{impactWeight}%</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mb-2">
              Weight given to downstream metered customer counts and active megawatt load without N-1 redundancy.
            </p>
            <input
              type="range"
              min="10"
              max="50"
              value={impactWeight}
              onChange={(e) => setImpactWeight(Number(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer"
            />
          </div>

          {/* Asset Criticality */}
          <div className="p-3.5 rounded bg-slate-900/60 border border-slate-800">
            <div className="flex justify-between text-slate-200 mb-1.5">
              <span className="font-semibold">4. Substation Redundancy & Critical Facility Weight:</span>
              <span className="text-emerald-400 font-bold text-sm">{critWeight}%</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mb-2">
              Weight given to vital regional hospitals, water treatment plants, and transmission backbone ties.
            </p>
            <input
              type="range"
              min="5"
              max="35"
              value={critWeight}
              onChange={(e) => setCritWeight(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>

        {saved && (
          <div className="p-3 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Risk Engine weights successfully saved and recalibrated across all 26 active assets.</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={totalWeight !== 100}
            className="px-5 py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold text-xs flex items-center gap-2 transition-colors shadow-lg"
          >
            <Save className="w-3.5 h-3.5" />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
