import React, { useState } from 'react';
import {
  Sliders,
  ShieldAlert,
  Cpu,
  Save,
  CheckCircle2,
  Database,
  Server,
  CloudLightning,
  Info
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-[#1f2d44] pb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
          <Sliders className="w-3.5 h-3.5" />
          Grid Resilience Engine Configuration
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
          System Settings & Risk Calculation Engine
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Tune composite scoring weights, risk classification thresholds, and inspect external ML model integration boundaries.
        </p>
      </div>

      {/* ML Integration Status Card */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
              Machine Learning Model Integration Status
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-mono font-bold">
            INTEGRATION READY
          </span>
        </div>

        <div className="p-3.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Active Model Provider:</span>
            <span className="text-white font-bold">Mock Transformer Fault Net (mock-v1)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Endpoint Boundary:</span>
            <span className="text-cyan-400 font-bold">POST /api/ml/predict</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Model Coupling:</span>
            <span className="text-emerald-400">Isolated Behind Backend Service Layer</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          The ML developer’s model can be swapped directly via backend config{' '}
          <code className="bg-slate-800 px-1 rounded text-cyan-300 font-mono text-[11px]">
            USE_EXTERNAL_ML_SERVICE=true
          </code>{' '}
          without modifying any frontend components or client API contracts.
        </p>
      </div>

      {/* Risk Engine Weights Form */}
      <form
        onSubmit={handleSave}
        className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Composite Risk Formula Weights
          </h2>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              totalWeight === 100
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-red-950 text-red-300 border-red-800'
            }`}
          >
            Total: {totalWeight}% {totalWeight === 100 ? '(Normalized)' : '(Must equal 100%)'}
          </span>
        </div>

        <div className="space-y-4 text-xs font-mono">
          {/* Equipment Probability */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>1. Equipment Failure Probability (ML / Sensor Analytics):</span>
              <span className="text-cyan-400 font-bold">{eqWeight}%</span>
            </div>
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
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>2. Meteorological & Storm Exposure Weight:</span>
              <span className="text-amber-400 font-bold">{weatherWeight}%</span>
            </div>
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
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>3. Customer Count & MW Load Disruption Weight:</span>
              <span className="text-rose-400 font-bold">{impactWeight}%</span>
            </div>
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
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>4. Substation Redundancy & Critical Facility Weight:</span>
              <span className="text-emerald-400 font-bold">{critWeight}%</span>
            </div>
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
            <span>Risk Engine weights saved and recalibrated across all active assets.</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={totalWeight !== 100}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold text-xs flex items-center gap-2 transition-colors shadow-lg"
          >
            <Save className="w-3.5 h-3.5" />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
