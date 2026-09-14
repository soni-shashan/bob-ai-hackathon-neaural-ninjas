import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Zap, ExternalLink, Filter, MapPin } from 'lucide-react';
import { RiskBadge } from '../common/RiskBadge';

interface SubstationNode {
  id: string;
  assetId: string;
  name: string;
  substation: string;
  x: number;
  y: number;
  voltage: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  failureProbability: number;
  customers: number;
  isDemoPrimary?: boolean;
}

const SUBSTATIONS: SubstationNode[] = [
  {
    id: 'node-naroda',
    assetId: 'TR-104',
    name: 'Transformer TR-104',
    substation: 'Naroda Substation (400/220kV)',
    x: 620,
    y: 130,
    voltage: '400kV',
    riskScore: 94,
    riskLevel: 'CRITICAL',
    failureProbability: 0.82,
    customers: 18500,
    isDemoPrimary: true
  },
  {
    id: 'node-vatva',
    assetId: 'TR-087',
    name: 'Transformer TR-087',
    substation: 'Vatva Industrial Substation',
    x: 580,
    y: 350,
    voltage: '220kV',
    riskScore: 91,
    riskLevel: 'CRITICAL',
    failureProbability: 0.76,
    customers: 14200
  },
  {
    id: 'node-odhav',
    assetId: 'TR-221',
    name: 'Auto-Transformer TR-221',
    substation: 'Odhav Substation',
    x: 690,
    y: 240,
    voltage: '220kV',
    riskScore: 87,
    riskLevel: 'HIGH',
    failureProbability: 0.71,
    customers: 11800
  },
  {
    id: 'node-gandhinagar',
    assetId: 'TR-305',
    name: 'Transformer TR-305',
    substation: 'Gandhinagar Ring 400kV Yard',
    x: 520,
    y: 50,
    voltage: '400kV',
    riskScore: 64,
    riskLevel: 'HIGH',
    failureProbability: 0.54,
    customers: 9400
  },
  {
    id: 'node-sabarmati',
    assetId: 'TR-118',
    name: 'Transformer TR-118',
    substation: 'Sabarmati Central Grid Hub',
    x: 430,
    y: 170,
    voltage: '220kV',
    riskScore: 28,
    riskLevel: 'LOW',
    failureProbability: 0.22,
    customers: 8100
  },
  {
    id: 'node-thaltej',
    assetId: 'BB-201',
    name: 'Main Busbar BB-201',
    substation: 'Thaltej West Substation',
    x: 290,
    y: 190,
    voltage: '220kV',
    riskScore: 19,
    riskLevel: 'LOW',
    failureProbability: 0.12,
    customers: 5200
  },
  {
    id: 'node-sanand',
    assetId: 'FD-042',
    name: 'Feeder Unit FD-042',
    substation: 'Sanand Industrial Substation',
    x: 150,
    y: 310,
    voltage: '132kV',
    riskScore: 22,
    riskLevel: 'LOW',
    failureProbability: 0.15,
    customers: 4200
  },
  {
    id: 'node-bopal',
    assetId: 'TR-402',
    name: 'Transformer TR-402',
    substation: 'Bopal Suburban Substation',
    x: 220,
    y: 220,
    voltage: '132kV',
    riskScore: 16,
    riskLevel: 'LOW',
    failureProbability: 0.10,
    customers: 3600
  },
  {
    id: 'node-sarkhej',
    assetId: 'TR-330',
    name: 'Transformer TR-330',
    substation: 'Sarkhej Logistics Substation',
    x: 270,
    y: 340,
    voltage: '132kV',
    riskScore: 26,
    riskLevel: 'LOW',
    failureProbability: 0.18,
    customers: 2800
  },
  {
    id: 'node-changodar',
    assetId: 'TR-092',
    name: 'Transformer TR-092',
    substation: 'Changodar Heavy Substation',
    x: 210,
    y: 420,
    voltage: '220kV',
    riskScore: 48,
    riskLevel: 'MODERATE',
    failureProbability: 0.38,
    customers: 3900
  },
  {
    id: 'node-nikol',
    assetId: 'TR-168',
    name: 'Feeder Transformer TR-168',
    substation: 'Nikol Substation',
    x: 660,
    y: 180,
    voltage: '132kV',
    riskScore: 49,
    riskLevel: 'MODERATE',
    failureProbability: 0.41,
    customers: 7300
  }
];

const TRANSMISSION_LINES = [
  { from: 'node-gandhinagar', to: 'node-naroda', voltage: '400kV', status: 'ALERT' },
  { from: 'node-gandhinagar', to: 'node-sabarmati', voltage: '220kV', status: 'NORMAL' },
  { from: 'node-naroda', to: 'node-odhav', voltage: '220kV', status: 'ALERT' },
  { from: 'node-naroda', to: 'node-nikol', voltage: '132kV', status: 'ALERT' },
  { from: 'node-odhav', to: 'node-vatva', voltage: '220kV', status: 'ALERT' },
  { from: 'node-sabarmati', to: 'node-thaltej', voltage: '220kV', status: 'NORMAL' },
  { from: 'node-thaltej', to: 'node-bopal', voltage: '132kV', status: 'NORMAL' },
  { from: 'node-thaltej', to: 'node-sarkhej', voltage: '132kV', status: 'NORMAL' },
  { from: 'node-bopal', to: 'node-sanand', voltage: '132kV', status: 'NORMAL' },
  { from: 'node-sarkhej', to: 'node-changodar', voltage: '220kV', status: 'NORMAL' },
  { from: 'node-vatva', to: 'node-changodar', voltage: '220kV', status: 'NORMAL' },
  { from: 'node-sabarmati', to: 'node-vatva', voltage: '220kV', status: 'ALERT' }
];

export const SchematicGridMap: React.FC<{
  currentDemoRisk?: number;
  highlightAssetId?: string;
}> = ({ currentDemoRisk, highlightAssetId }) => {
  const navigate = useNavigate();
  const [hoveredNode, setHoveredNode] = useState<SubstationNode | null>(null);
  const [selectedVoltage, setSelectedVoltage] = useState<string>('ALL');

  const getNodeColor = (node: SubstationNode) => {
    const risk = (node.isDemoPrimary && currentDemoRisk !== undefined) ? currentDemoRisk : node.riskScore;
    if (risk >= 85) return '#ef4444'; // Red
    if (risk >= 65) return '#f97316'; // Orange
    if (risk >= 30) return '#f59e0b'; // Amber
    return '#10b981'; // Emerald
  };

  const getRiskLabel = (risk: number) => {
    if (risk >= 85) return 'CRITICAL';
    if (risk >= 65) return 'HIGH';
    if (risk >= 30) return 'MODERATE';
    return 'LOW';
  };

  return (
    <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden relative">
      {/* Header Bar */}
      <div className="p-4 border-b border-[#1f2d44] flex flex-wrap items-center justify-between gap-3 bg-[#0e1626]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Schematic Grid Topology & Regional Risk Distribution
          </h2>
          <p className="text-xs text-slate-400">
            Interactive 400kV / 220kV intertie topology. Click any substation node to open telemetry diagnostics.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-400">Low (0-29)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">Moderate (30-49)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="text-slate-400">High (50-84)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-red-400 font-bold">Critical (85-100)</span>
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

          {/* Transmission Lines */}
          {TRANSMISSION_LINES.map((line, idx) => {
            const fromNode = SUBSTATIONS.find((s) => s.id === line.from);
            const toNode = SUBSTATIONS.find((s) => s.id === line.to);
            if (!fromNode || !toNode) return null;

            const isAlert = line.status === 'ALERT';

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

          {/* Substation Nodes */}
          {SUBSTATIONS.map((node) => {
            const risk = (node.isDemoPrimary && currentDemoRisk !== undefined) ? currentDemoRisk : node.riskScore;
            const color = getNodeColor(node);
            const isCritical = risk >= 85;
            const isHovered = hoveredNode?.id === node.id;
            const isHighlighted = highlightAssetId === node.assetId || (node.isDemoPrimary && !highlightAssetId);

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
                  r={isHovered ? 16 : (isCritical ? 14 : 11)}
                  fill="#0b0f17"
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 2}
                />

                {/* Inner Core */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 8 : 6}
                  fill={color}
                />

                {/* Node Label */}
                <text
                  x={node.x}
                  y={node.y + 22}
                  fill={isHovered ? '#ffffff' : '#94a3b8'}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isCritical ? 'bold' : '500'}
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                >
                  {node.assetId}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredNode && (
          <div
            className="absolute z-20 pointer-events-none p-3 rounded-lg bg-[#0d1522]/95 border border-slate-700 shadow-2xl backdrop-blur-md text-xs w-64 transition-all"
            style={{
              left: Math.min(Math.max(hoveredNode.x - 120, 10), 550),
              top: Math.max(hoveredNode.y - 120, 10)
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-white font-mono text-xs">
                {hoveredNode.assetId}
              </span>
              <RiskBadge
                level={getRiskLabel(
                  (hoveredNode.isDemoPrimary && currentDemoRisk !== undefined)
                    ? currentDemoRisk
                    : hoveredNode.riskScore
                )}
                score={
                  (hoveredNode.isDemoPrimary && currentDemoRisk !== undefined)
                    ? currentDemoRisk
                    : hoveredNode.riskScore
                }
                size="sm"
              />
            </div>
            <p className="text-slate-300 font-medium">{hoveredNode.name}</p>
            <p className="text-[11px] text-slate-400">{hoveredNode.substation}</p>
            
            <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1 text-[11px] font-mono">
              <span className="text-slate-400">Failure Prob:</span>
              <span className="text-right text-rose-300 font-bold">
                {Math.round(hoveredNode.failureProbability * 100)}%
              </span>
              <span className="text-slate-400">Customers:</span>
              <span className="text-right text-slate-200">
                {hoveredNode.customers.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-cyan-400 font-mono flex items-center justify-end gap-1">
              Click node to open asset diagnostics →
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
