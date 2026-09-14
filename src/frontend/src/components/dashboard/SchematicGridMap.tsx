import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Zap, Activity } from 'lucide-react';
import { RiskBadge } from '../common/RiskBadge';
import { getAssets } from '../../services/api';
import { AssetSummary } from '../../types';

export interface SubstationNode {
  id: string;
  assetId: string;
  name: string;
  substation: string;
  x: number;
  y: number;
  voltage: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  failureProbability: number;
  customers: number;
  healthScore?: number;
  loadMw?: number;
  isMonitoredPrimary?: boolean;
}

interface TopologyNodeDef {
  id: string;
  assetId: string;
  x: number;
  y: number;
  voltage: string;
  defaultName: string;
  defaultSubstation: string;
}

const TOPOLOGY_NODE_DEFS: TopologyNodeDef[] = [
  {
    id: 'node-north-01',
    assetId: 'TR-104',
    x: 620,
    y: 130,
    voltage: '400kV',
    defaultName: 'Primary Distribution Transformer TX-DIST-01',
    defaultSubstation: 'East Transmission Substation'
  },
  {
    id: 'node-central-02',
    assetId: 'TR-087',
    x: 580,
    y: 350,
    voltage: '220kV',
    defaultName: 'Heavy Feeder Transformer TX-DIST-02',
    defaultSubstation: 'East Industrial Substation'
  },
  {
    id: 'node-east-03',
    assetId: 'TR-221',
    x: 690,
    y: 240,
    voltage: '220kV',
    defaultName: 'Industrial Interconnect Transformer TX-IND-01',
    defaultSubstation: 'East Distribution Substation'
  },
  {
    id: 'node-east-feeder',
    assetId: 'TR-168',
    x: 660,
    y: 180,
    voltage: '132kV',
    defaultName: 'Heavy Load Feeder Transformer TX-DIST-05',
    defaultSubstation: 'East Distribution Substation'
  },
  {
    id: 'node-ring-04',
    assetId: 'TR-305',
    x: 520,
    y: 50,
    voltage: '400kV',
    defaultName: 'Regional Ring Auto-Transformer TX-AUTO-01',
    defaultSubstation: 'North Intertie Substation'
  },
  {
    id: 'node-hub-05',
    assetId: 'TR-118',
    x: 430,
    y: 170,
    voltage: '220kV',
    defaultName: 'Central Grid Step-Down Transformer TX-DIST-03',
    defaultSubstation: 'Central Core Substation'
  },
  {
    id: 'node-west-bus',
    assetId: 'BB-201',
    x: 290,
    y: 190,
    voltage: '220kV',
    defaultName: '220kV Main Busbar Section BB-MAIN-01',
    defaultSubstation: 'West Primary Substation'
  },
  {
    id: 'node-west-sub',
    assetId: 'TR-402',
    x: 220,
    y: 220,
    voltage: '132kV',
    defaultName: 'Western Distribution Unit TX-DIST-04',
    defaultSubstation: 'West Distribution Substation'
  },
  {
    id: 'node-south-feeder',
    assetId: 'FD-042',
    x: 150,
    y: 310,
    voltage: '132kV',
    defaultName: 'Commercial Feeder Unit FD-COMM-01',
    defaultSubstation: 'South Industrial Substation'
  },
  {
    id: 'node-south-dist',
    assetId: 'TR-330',
    x: 270,
    y: 340,
    voltage: '132kV',
    defaultName: 'Logistics Distribution Feeder TX-LOG-01',
    defaultSubstation: 'South Logistics Substation'
  },
  {
    id: 'node-south-heavy',
    assetId: 'TR-092',
    x: 210,
    y: 420,
    voltage: '220kV',
    defaultName: 'Industrial Sector Transformer TX-IND-02',
    defaultSubstation: 'South Industrial Substation'
  }
];

const TRANSMISSION_LINES = [
  { from: 'node-ring-04', to: 'node-north-01', voltage: '400kV' },
  { from: 'node-ring-04', to: 'node-hub-05', voltage: '220kV' },
  { from: 'node-north-01', to: 'node-east-03', voltage: '220kV' },
  { from: 'node-north-01', to: 'node-east-feeder', voltage: '132kV' },
  { from: 'node-east-03', to: 'node-central-02', voltage: '220kV' },
  { from: 'node-hub-05', to: 'node-west-bus', voltage: '220kV' },
  { from: 'node-west-bus', to: 'node-west-sub', voltage: '132kV' },
  { from: 'node-west-bus', to: 'node-south-dist', voltage: '132kV' },
  { from: 'node-west-sub', to: 'node-south-feeder', voltage: '132kV' },
  { from: 'node-south-dist', to: 'node-south-heavy', voltage: '220kV' },
  { from: 'node-central-02', to: 'node-south-heavy', voltage: '220kV' },
  { from: 'node-hub-05', to: 'node-central-02', voltage: '220kV' }
];

export const SchematicGridMap: React.FC<{
  assets?: AssetSummary[];
  currentRisk?: number;
  highlightAssetId?: string;
}> = ({ assets: propAssets, currentRisk, highlightAssetId }) => {
  const navigate = useNavigate();
  const [internalAssets, setInternalAssets] = useState<AssetSummary[]>([]);
  const [hoveredNode, setHoveredNode] = useState<SubstationNode | null>(null);

  // Fetch live fleet data from real API if not provided via props
  useEffect(() => {
    if (!propAssets || propAssets.length === 0) {
      getAssets({ limit: 50 })
        .then((res) => setInternalAssets(res.items))
        .catch((err) => console.error('Failed to load assets for schematic grid', err));
    }
  }, [propAssets]);

  const activeAssets = (propAssets && propAssets.length > 0) ? propAssets : internalAssets;

  // Dynamically merge live telemetry, real risk scores, real names and substations
  const dynamicNodes = useMemo<SubstationNode[]>(() => {
    const assetMap = new Map<string, AssetSummary>();
    activeAssets.forEach((a) => assetMap.set(a.id, a));

    return TOPOLOGY_NODE_DEFS.map((def) => {
      const live = assetMap.get(def.assetId);
      const isPrimary = def.assetId === 'TR-104';

      let riskScore = live ? live.risk_score : 50;
      if (isPrimary && currentRisk !== undefined) {
        riskScore = currentRisk;
      }

      const riskLevel: 'LOW' | 'MEDIUM' | 'MODERATE' | 'HIGH' | 'CRITICAL' = live
        ? (live.risk_level as any)
        : (riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW');

      const failProb = live ? live.failure_probability : (riskScore / 100) * 0.85;
      const customers = live ? live.customers_affected : 5000;
      const name = live ? live.name : def.defaultName;
      const substation = live ? live.location : def.defaultSubstation;
      const healthScore = live ? live.health_score : Math.round(100 - riskScore);
      const loadMw = live ? live.load_mw : undefined;

      return {
        id: def.id,
        assetId: def.assetId,
        x: def.x,
        y: def.y,
        voltage: def.voltage,
        name,
        substation,
        riskScore,
        riskLevel,
        failureProbability: failProb,
        customers,
        healthScore,
        loadMw,
        isMonitoredPrimary: isPrimary
      };
    });
  }, [activeAssets, currentRisk]);

  // Transmission lines status derived dynamically from the risk of the connected nodes
  const linesWithStatus = useMemo(() => {
    const nodeMap = new Map<string, SubstationNode>();
    dynamicNodes.forEach((n) => nodeMap.set(n.id, n));

    return TRANSMISSION_LINES.map((line) => {
      const fromNode = nodeMap.get(line.from);
      const toNode = nodeMap.get(line.to);

      const isAlert =
        Boolean((fromNode && (fromNode.riskScore >= 50 || fromNode.riskLevel === 'HIGH' || fromNode.riskLevel === 'CRITICAL')) ||
        (toNode && (toNode.riskScore >= 50 || toNode.riskLevel === 'HIGH' || toNode.riskLevel === 'CRITICAL')));

      return {
        ...line,
        fromNode,
        toNode,
        isAlert
      };
    });
  }, [dynamicNodes]);

  // Thresholds aligned with GridGuard_AI_Final.ipynb: Critical >= 75, High 50-74, Medium 25-49, Low < 25
  const getNodeColor = (node: SubstationNode) => {
    const risk = node.riskScore;
    if (risk >= 75 || node.riskLevel === 'CRITICAL') return '#ef4444'; // Red (Critical)
    if (risk >= 50 || node.riskLevel === 'HIGH') return '#f97316'; // Orange (High)
    if (risk >= 25 || node.riskLevel === 'MEDIUM' || node.riskLevel === 'MODERATE') return '#f59e0b'; // Amber (Medium)
    return '#10b981'; // Emerald (Low)
  };

  return (
    <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden relative">
      {/* Header Bar */}
      <div className="p-4 border-b border-[#1f2d44] flex flex-wrap items-center justify-between gap-3 bg-[#0e1626]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Schematic Grid Topology & Regional Risk Distribution
            </h2>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 animate-pulse text-cyan-400" />
              Live Telemetry Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real distribution telemetry & intertie topology. Click any substation node to open telemetry diagnostics.
          </p>
        </div>

        {/* Legend matching GridGuard_AI_Final.ipynb */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-400">Low (&lt;25)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">Medium (25-49)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="text-slate-400">High (50-74)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-red-400 font-bold">Critical (75-100)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="relative w-full aspect-[16/8] min-h-[380px] max-h-[500px] bg-[#090d16] overflow-hidden">
        {/* Storm Radar Overlay in Eastern Grid Area */}
        <div className="absolute right-0 top-0 bottom-0 w-2/5 bg-gradient-to-l from-red-950/20 via-amber-950/15 to-transparent pointer-events-none border-l border-amber-800/20">
          <div className="p-3 text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-red-400 animate-pulse" />
              Eastern Severe Storm Corridor
            </span>
          </div>
        </div>

        <svg className="w-full h-full" viewBox="0 0 820 480">
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
            </pattern>
            <linearGradient id="line-alert" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="line-normal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid-pattern)" />

          {/* Dynamic Transmission Lines with live alert status */}
          {linesWithStatus.map((line, idx) => {
            const { fromNode, toNode, isAlert } = line;
            if (!fromNode || !toNode) return null;

            return (
              <g key={`line-${idx}`}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isAlert ? 'url(#line-alert)' : 'url(#line-normal)'}
                  strokeWidth={line.voltage === '400kV' ? 3.5 : 2}
                  strokeDasharray={isAlert ? '6 4' : 'none'}
                  className={isAlert ? 'animate-pulse' : ''}
                />
              </g>
            );
          })}

          {/* Substation Nodes dynamically bound to real asset fleet */}
          {dynamicNodes.map((node) => {
            const color = getNodeColor(node);
            const isCritical = node.riskScore >= 75 || node.riskLevel === 'CRITICAL';
            const isHovered = hoveredNode?.id === node.id;
            const isHighlighted = highlightAssetId === node.assetId || (node.isMonitoredPrimary && !highlightAssetId);

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => navigate(`/assets/${node.assetId}`)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Ping wave for critical nodes */}
                {isCritical && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={24}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    opacity="0.6"
                    className="animate-ping"
                  />
                )}

                {/* Outer Glow Ring */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 16 : (isCritical ? 14 : (isHighlighted ? 13 : 11))}
                  fill="#0b0f17"
                  stroke={color}
                  strokeWidth={isHovered ? 3 : (isHighlighted ? 2.5 : 2)}
                />

                {/* Inner Core */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 8 : (isHighlighted ? 7 : 6)}
                  fill={color}
                />

                {/* Node Label */}
                <text
                  x={node.x}
                  y={node.y + 22}
                  fill={isHovered ? '#ffffff' : (isHighlighted ? '#38bdf8' : '#94a3b8')}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isCritical || isHighlighted ? 'bold' : '500'}
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                >
                  {node.assetId}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card with Real Telemetry & Health */}
        {hoveredNode && (
          <div
            className="absolute z-20 pointer-events-none p-3.5 rounded-lg bg-[#0d1522]/95 border border-slate-700 shadow-2xl backdrop-blur-md text-xs w-72 transition-all"
            style={{
              left: Math.min(Math.max(hoveredNode.x - 140, 10), 520),
              top: Math.max(hoveredNode.y - 140, 10)
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {hoveredNode.assetId}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1 rounded border border-cyan-800">
                  {hoveredNode.voltage}
                </span>
              </div>
              <RiskBadge
                level={hoveredNode.riskLevel}
                score={hoveredNode.riskScore}
                size="sm"
              />
            </div>
            <p className="text-slate-200 font-semibold text-xs leading-snug">{hoveredNode.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{hoveredNode.substation}</p>
            
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase">Fail Likelihood</span>
                <span className="text-rose-300 font-bold">
                  {Math.round(hoveredNode.failureProbability * 100)}%
                </span>
              </div>
              <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase">Health Score</span>
                <span className="text-emerald-400 font-bold">
                  {hoveredNode.healthScore ?? Math.round(100 - hoveredNode.riskScore)}/100
                </span>
              </div>
              <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase">Feeder Load</span>
                <span className="text-cyan-300 font-bold">
                  {hoveredNode.loadMw ? `${hoveredNode.loadMw.toFixed(1)} MW` : 'Nominal'}
                </span>
              </div>
              <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase">Customers</span>
                <span className="text-slate-200 font-bold">
                  {hoveredNode.customers.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-cyan-400 font-mono flex items-center justify-between border-t border-slate-800/40 pt-1.5">
              <span className="text-slate-500">Live Telemetry Feed</span>
              <span>Click node to open diagnostics →</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
