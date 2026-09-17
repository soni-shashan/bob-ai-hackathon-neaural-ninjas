import React, { useState, useEffect } from 'react';
import {
  Radio,
  Cpu,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Copy,
  Check,
  Clock,
  Shield,
  Trash2,
  Filter,
  Flame,
  Terminal,
  RotateCcw,
  ArrowUpRight
} from 'lucide-react';
import {
  getIoTDevices,
  registerIoTDevice,
  deactivateIoTDevice,
  getIoTLogs,
  purgeIoTLogs,
  resetIoTSystem,
  getAssets
} from '../services/api';
import { IoTDeviceStatus, IoTLog, AssetSummary } from '../types';

export const IoTStreamPage: React.FC = () => {
  const [devices, setDevices] = useState<IoTDeviceStatus[]>([]);
  const [logs, setLogs] = useState<IoTLog[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [realOnly, setRealOnly] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Registration modal state
  const [showRegModal, setShowRegModal] = useState<boolean>(false);
  const [regName, setRegName] = useState<string>('');
  const [regAssetId, setRegAssetId] = useState<string>('');
  const [regDeviceType, setRegDeviceType] = useState<string>('real_hardware_gateway');
  const [isSimulatedReg, setIsSimulatedReg] = useState<boolean>(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedCommand, setCopiedCommand] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [deviceRes, logRes, assetRes] = await Promise.all([
        getIoTDevices(realOnly).catch(() => []),
        getIoTLogs(undefined, 50, realOnly).catch(() => []),
        getAssets().then(r => r.items).catch(() => [])
      ]);
      setDevices(deviceRes);
      setLogs(logRes);
      setAssets(assetRes);
      if (assetRes.length > 0 && !regAssetId) {
        setRegAssetId(assetRes[0].id);
      }
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Error fetching IoT data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [realOnly]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, realOnly]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regAssetId) return;

    setSubmitting(true);
    setRegError(null);
    try {
      const res = await registerIoTDevice({
        device_name: regName.trim(),
        asset_id: regAssetId,
        device_type: regDeviceType,
        firmware_version: '2.0.0-REAL',
        is_simulated: isSimulatedReg
      });
      setNewApiKey(res.api_key);
      fetchData();
    } catch (err: any) {
      setRegError(err.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (deviceId: string) => {
    if (!window.confirm(`Deactivate IoT device ${deviceId}?`)) return;
    try {
      await deactivateIoTDevice(deviceId);
      fetchData();
    } catch (err: any) {
      alert(`Deactivation failed: ${err.message}`);
    }
  };

  const handleResetSystem = async () => {
    if (!window.confirm('Reset IoT system to 0 devices and 0 logs? This clears all residual data so you can stream fresh telemetry from a real hardware device.')) return;
    try {
      const res = await resetIoTSystem();
      alert(`IoT System Reset Complete: Deleted ${res.deleted_devices} devices and ${res.deleted_logs} telemetry logs.`);
      fetchData();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, isCmd: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isCmd) {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const getPredictionBadge = (result?: string) => {
    if (!result) return <span className="text-slate-500 text-xs font-mono">NO_PRED</span>;
    switch (result) {
      case 'CRITICAL_RISK':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-red-950 text-red-400 border border-red-800">CRITICAL</span>;
      case 'HIGH_RISK':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800 font-bold">HIGH RISK</span>;
      case 'MODERATE_RISK':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-yellow-950 text-yellow-400 border border-yellow-800">MODERATE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">NORMAL</span>;
    }
  };

  const realCollectorCmd = "python src/iot_sdk/examples/real_hardware_collector.py --asset-id TR-104 --interval 3";

  return (
    <div className="p-6 space-y-6 bg-[#0b0f17] min-h-screen text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2a3f] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
              Live IoT Device Ingestion Gateway
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              PUSH ARCHITECTURE (DEVICE → SERVER)
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            External IoT devices PUSH live sensor readings to <code className="text-cyan-300 font-mono">POST /api/iot/ingest</code> using their API Key. Data is stored in the database and processed through 6-stage ML predictions in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-2 border transition-all ${
              autoRefresh
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700 hover:bg-cyan-900'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${autoRefresh ? 'text-cyan-400 animate-spin' : ''}`} />
            Auto-Refresh (3s): {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleResetSystem}
            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
            title="Reset to 0 devices and 0 logs for clean hardware demo"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            Reset to 0 Devices
          </button>

          <button
            onClick={() => {
              setShowRegModal(true);
              setNewApiKey(null);
              setRegName('');
              setRegError(null);
            }}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Register Device Gateway
          </button>
        </div>
      </div>

      {/* Real Hardware Push Banner */}
      <div className="bg-[#111827] border border-cyan-800/60 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-cyan-950/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-0.5">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              Push Live Sensor Data from Real Hardware / Laptop / Pi
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                DEVICE → SERVER PUSH
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Run this command in terminal to push real physical Linux thermal sensors (<span className="text-cyan-300">/sys/class/thermal</span>), load (<span className="text-cyan-300">/proc/loadavg</span>), and interrupts into GridGuard AI:
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
          <code className="bg-[#0b0f17] border border-slate-700 rounded px-3 py-1.5 text-[11px] font-mono text-cyan-300 overflow-x-auto max-w-full">
            {realCollectorCmd}
          </code>
          <button
            onClick={() => copyToClipboard(realCollectorCmd, true)}
            className="px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 flex-shrink-0"
          >
            {copiedCommand ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copiedCommand ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase">Connected Devices</p>
            <h3 className="text-2xl font-bold font-mono text-white mt-1">{devices.length}</h3>
            <p className="text-slate-500 text-[11px] mt-1 font-mono">
              {devices.length === 0 ? 'No devices registered yet' : `${devices.length} active gateways connected`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase">Pushed Telemetry Logs</p>
            <h3 className="text-2xl font-bold font-mono text-cyan-400 mt-1">{logs.length}</h3>
            <p className="text-slate-500 text-[11px] mt-1 font-mono">Database ingestion records</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase">Real ML Inferences</p>
            <h3 className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {logs.filter(l => l.prediction_triggered).length}
            </h3>
            <p className="text-slate-500 text-[11px] mt-1 font-mono">Auto 6-stage ML triggers</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase">Critical/High Alerts</p>
            <h3 className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {logs.filter(l => l.prediction_result === 'CRITICAL_RISK' || l.prediction_result === 'HIGH_RISK').length}
            </h3>
            <p className="text-slate-500 text-[11px] mt-1 font-mono">High risk detections</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid Layout: Devices Table & Live Ingestion Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Connected IoT Devices */}
        <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-bold font-mono text-white">Registered Gateways</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">{devices.length} devices</span>
          </div>

          {devices.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono space-y-3">
              <Cpu className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-bold text-slate-400">No IoT Devices Connected</p>
              <p className="text-slate-500 text-[11px]">
                Register your hardware gateway or run the Python collector script below to push live telemetry.
              </p>
              <button
                onClick={() => setShowRegModal(true)}
                className="px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-bold"
              >
                + Register Device Gateway
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {devices.map((d) => (
                <div
                  key={d.device_id}
                  className="bg-[#0b0f17] border border-cyan-800/60 rounded-lg p-3 hover:border-cyan-600 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${d.is_active ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'}`} />
                      <span className="text-xs font-bold font-mono text-white truncate max-w-[140px]">
                        {d.device_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        CONNECTED
                      </span>
                      <button
                        onClick={() => handleDeactivate(d.device_id)}
                        title="Deactivate Device"
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Device ID:</span>
                      <span className="text-cyan-300">{d.device_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Asset:</span>
                      <span className="text-amber-300 font-bold">{d.asset_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="text-slate-300 capitalize">{d.device_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Telemetry Pushed:</span>
                      <span className="text-emerald-400 font-bold">{d.total_readings_sent} pkts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Heartbeat:</span>
                      <span className="text-slate-400">{d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleTimeString() : 'Never'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 2 Cols: Live Telemetry Stream */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1f2d44] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h2 className="text-base font-bold font-mono text-white">Live Ingestion & ML Prediction Feed</h2>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm font-mono space-y-3">
              <Radio className="w-8 h-8 text-slate-600 mx-auto animate-bounce" />
              <p className="text-slate-300 font-bold">Waiting for IoT device to PUSH live sensor data...</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No telemetry in database. Once an external IoT device sends data to <code className="text-cyan-300">POST /api/iot/ingest</code>, live ML predictions will stream here instantly.
              </p>
              <div className="p-3 bg-slate-900 rounded-lg max-w-md mx-auto text-xs text-cyan-300 border border-slate-800 text-left">
                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">To start streaming real hardware metrics:</p>
                <code className="text-white font-bold block overflow-x-auto">{realCollectorCmd}</code>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="pb-3 px-2">Time</th>
                    <th className="pb-3 px-2">Asset ID</th>
                    <th className="pb-3 px-2">Device ID</th>
                    <th className="pb-3 px-2">Readings</th>
                    <th className="pb-3 px-2">ML Risk Stage</th>
                    <th className="pb-3 px-2">Fail Prob %</th>
                    <th className="pb-3 px-2">Health Index</th>
                    <th className="pb-3 px-2">Anomaly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-2 text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-cyan-300">
                        {log.asset_id}
                      </td>
                      <td className="py-2.5 px-2 text-slate-300 truncate max-w-[120px]">
                        {log.device_id}
                      </td>
                      <td className="py-2.5 px-2 text-slate-300">
                        {log.readings_count} pkt
                      </td>
                      <td className="py-2.5 px-2">
                        {getPredictionBadge(log.prediction_result)}
                      </td>
                      <td className="py-2.5 px-2">
                        {log.failure_probability !== undefined && log.failure_probability !== null ? (
                          <span className={`font-bold ${log.failure_probability > 0.5 ? 'text-red-400' : log.failure_probability > 0.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {(log.failure_probability * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        {log.health_score !== undefined && log.health_score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{Math.round(log.health_score)}</span>
                            <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${log.health_score < 50 ? 'bg-red-500' : log.health_score < 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${log.health_score}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        {log.is_anomaly ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950 text-red-300 border border-red-800 font-bold">
                            ANOMALY
                          </span>
                        ) : (
                          <span className="text-slate-500">Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#111827] border border-[#1f2d44] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold font-mono text-white">Register IoT Gateway Device</h3>
              </div>
              <button
                onClick={() => setShowRegModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {newApiKey ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-center gap-2 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Device registered! Use the API key below on your IoT device to PUSH live readings.</span>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase">IoT Device API Key</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newApiKey}
                      className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2 text-xs font-mono text-cyan-300 focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(newApiKey)}
                      className="px-3 py-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copiedKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-400 space-y-1">
                  <p className="font-bold text-white">To push live readings from Python SDK:</p>
                  <p className="text-cyan-300">python src/iot_sdk/examples/real_hardware_collector.py --api-key {newApiKey}</p>
                </div>

                <button
                  onClick={() => setShowRegModal(false)}
                  className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <div className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-red-300 text-xs">
                    {regError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase block mb-1">
                    Device Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Naroda Substation Hardware Pi"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase block mb-1">
                    Link to Transformer Asset
                  </label>
                  <select
                    value={regAssetId}
                    onChange={(e) => setRegAssetId(e.target.value)}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} — {a.name} ({a.location})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase block mb-1">
                    Device Type
                  </label>
                  <select
                    value={regDeviceType}
                    onChange={(e) => setRegDeviceType(e.target.value)}
                    className="w-full bg-[#0b0f17] border border-slate-700 rounded p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="real_hardware_gateway">Real System Hardware Gateway (Linux/Pi)</option>
                    <option value="raspberry_pi">Raspberry Pi GPIO Node</option>
                    <option value="sensor_gateway">Industrial Modbus Gateway</option>
                    <option value="esp32">ESP32 Telemetry Node</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRegModal(false)}
                    className="px-4 py-2 rounded bg-slate-800 text-slate-300 hover:text-white text-xs font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold shadow-md shadow-cyan-900/30"
                  >
                    {submitting ? 'Registering...' : 'Generate API Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
