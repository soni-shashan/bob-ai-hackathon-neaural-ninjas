import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  Database,
  Terminal,
  RotateCcw,
  Cpu,
  Radio,
  HelpCircle,
  Activity
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { askAdvisor } from '../services/api';
import { AdvisorQueryResponse, ChatHistoryItem } from '../types';

const SUGGESTED_PROMPTS = [
  "Give me today's recommended grid maintenance plan.",
  "What is the overall health and risk status across the entire grid?",
  "What areas and substations are most vulnerable to the storm?",
  "Which crews are deployed and where are they staged?",
  "What are the top priority critical assets requiring intervention?",
  "What is the failure impact and contingency plan for TR-104?"
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'advisor';
  text?: string;
  response?: AdvisorQueryResponse;
  timestamp: string;
  isError?: boolean;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg-0',
  sender: 'advisor',
  response: {
    answer: 'GridGuard AI Decision-Support Advisor online, powered by IBM Bob AI. Actively analyzing real-time SCADA telemetry, multi-zone risk matrices, Doppler storm radar, and field crew logistics across the entire regional grid.',
    priority: 'HIGH',
    evidence: [
      'Fleet Telemetry: 26 high-voltage assets monitored across East, North, Central, South, and West grid zones',
      'Fleet Health Index: 71/100 (IEEE Standard Operational Baseline: 78/100)',
      'Risk Breakdown: 3 Critical assets, 5 High-Risk assets, 44,500 downstream customers dependent on stressed nodes',
      'Corridor Weather Front: Eastern Grid corridor experiencing 48.5 mm/h torrential storm squalls and 52 km/h wind shear',
      'Field Crew Staging: 5 specialized repair teams strategically distributed across regional depots'
    ],
    recommended_actions: [
      'Select a suggested operator inquiry below or ask custom operational questions in natural language.',
      'Ask about fleet-wide maintenance plans, corridor storm impacts, crew staging, or individual asset diagnostics.'
    ],
    expected_impact: 'Continuous multi-modal risk scoring and IBM Bob AI reasoning reduce unexpected regional blackout risk by up to 74%.',
    model_name: 'ibm-bob-ai/fast'
  },
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export const AdvisorPage: React.FC = () => {
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleReset = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSend = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Build conversation history for multi-turn LLM reasoning
    const historyPayload: ChatHistoryItem[] = messages
      .filter((m) => m.id !== 'msg-0')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text || m.response?.answer || ''
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await askAdvisor(q, historyPayload);
      const advisorMsg: ChatMessage = {
        id: `adv-${Date.now()}`,
        sender: 'advisor',
        response: res,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, advisorMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'advisor',
        text: `Reasoning communication error: ${err.message || 'Unable to connect to AI engine.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract clickable question if an action contains "Ask me: '...'"
  const parseActionPrompt = (actionText: string): { isPrompt: boolean; cleanPrompt: string } => {
    const match = actionText.match(/Ask (?:me:?\s*)?['"](.*?)['"]/i);
    if (match && match[1]) {
      return { isPrompt: true, cleanPrompt: match[1] };
    }
    return { isPrompt: false, cleanPrompt: '' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Bot className="w-3.5 h-3.5" />
            <span>Operator AI Reasoning Engine</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              IBM Bob AI Real-Time Agent
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            GridGuard AI Advisor
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time conversational grid resilience & operations chatbot powered by IBM Bob AI.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>IBM Bob AI Active</span>
          </div>

          <button
            onClick={handleReset}
            title="Reset conversation session"
            className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Chat</span>
          </button>
        </div>
      </div>

      {/* Live Operational Status Ribbon */}
      <div className="bg-[#0b1322] border border-cyan-900/40 rounded-lg px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-300 font-semibold">Live Operational Grounding:</span>
          <span className="text-slate-400">26 HV Assets Streamed</span>
          <span className="text-slate-600">|</span>
          <span className="text-rose-400 font-medium">3 Critical & 5 High-Risk Assets</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-medium">East Storm Squall Active (48.5 mm/h)</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-400">Telemetry Stream Synchronized</span>
        </div>
      </div>

      {/* Suggested Diagnostic Prompts */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-3.5 shadow-lg">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          Recommended Operator Diagnostic Inquiries:
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-[#0b0f17] hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-slate-300 hover:text-cyan-300 transition-all text-left flex items-center gap-1.5 shadow-sm"
            >
              <span>{prompt}</span>
              <ChevronRight className="w-3 h-3 text-cyan-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Dialogue Message Stream */}
      <div className="space-y-4 min-h-[380px]">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="text-[10px] font-mono text-slate-500 mb-1 px-1 flex items-center gap-1.5">
                {isUser ? (
                  <>
                    <span className="text-cyan-400 font-bold">OPERATOR DISPATCHER</span>
                    <span>• {m.timestamp}</span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-400 font-bold">GRIDGUARD AI ADVISOR</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">IBM Bob AI</span>
                    <span>• {m.timestamp}</span>
                  </>
                )}
              </div>

              {isUser ? (
                /* Operator Chat Bubble */
                <div className="max-w-2xl bg-cyan-950/80 border border-cyan-700/70 text-cyan-100 rounded-xl rounded-tr-sm p-3.5 text-xs font-mono shadow-lg leading-relaxed">
                  {m.text}
                </div>
              ) : m.response ? (
                /* Structured Operational Response Format */
                <div className="max-w-3xl w-full bg-[#111827] border border-[#1f2d44] rounded-xl rounded-tl-sm p-5 shadow-xl space-y-4 font-mono text-xs">
                  {/* Summary & Priority Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-[#1f2d44] pb-3 gap-2">
                    <div className="flex items-start gap-2.5 flex-1">
                      <Bot className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div className="text-white font-bold text-sm leading-snug">
                        {m.response.answer}
                      </div>
                    </div>
                    <RiskBadge level={m.response.priority} size="sm" showPulse />
                  </div>

                  {/* Evidence Section */}
                  {m.response.evidence && m.response.evidence.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-[#0d1424] border border-slate-800 space-y-2">
                      <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-amber-400" />
                        Diagnostic Evidence & Telemetry Signals:
                      </span>
                      <ul className="space-y-1.5 text-slate-300 text-xs">
                        {m.response.evidence.map((ev, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-cyan-400 font-bold mt-0.5">•</span>
                            <span className="leading-snug">{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Actions */}
                  {m.response.recommended_actions && m.response.recommended_actions.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-800/60 space-y-2">
                      <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Recommended Grid Interventions:
                      </span>
                      <ol className="space-y-2 text-slate-200 text-xs list-decimal list-inside font-sans">
                        {m.response.recommended_actions.map((act, idx) => {
                          const promptInfo = parseActionPrompt(act);
                          return (
                            <li key={idx} className="leading-snug pl-1 font-mono">
                              <span>{act}</span>
                              {promptInfo.isPrompt && (
                                <button
                                  onClick={() => handleSend(promptInfo.cleanPrompt)}
                                  disabled={loading}
                                  className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800 text-[11px] text-cyan-300 transition-colors"
                                >
                                  <span>Ask this now</span>
                                  <ChevronRight className="w-3 h-3 text-cyan-400" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}

                  {/* Expected Impact */}
                  {m.response.expected_impact && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <strong className="text-cyan-400 font-bold uppercase tracking-wider block mb-0.5">
                        Outage Avoidance & Impact Estimation:
                      </strong>
                      <p className="font-sans text-xs text-slate-300 leading-relaxed">
                        {m.response.expected_impact}
                      </p>
                    </div>
                  )}

                  {/* Card Footer Metadata */}
                  <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Cpu className="w-3 h-3 text-cyan-400" />
                        {m.response.model_name || 'IBM Bob AI (fast)'}
                      </span>
                      {m.response.related_asset_id && m.response.related_asset_id.toUpperCase() !== 'GRID' && m.response.related_asset_id.toUpperCase() !== 'ALL' && m.response.related_asset_id.toUpperCase() !== 'SYSTEM' ? (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-900 font-bold">
                          Asset: {m.response.related_asset_id}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
                          Scope: Entire Grid Fleet (26 Assets)
                        </span>
                      )}
                    </div>
                    <span>Real-time Operational Inference</span>
                  </div>
                </div>
              ) : m.isError ? (
                <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-xs font-mono max-w-2xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{m.text}</span>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-[#111827] border border-[#1f2d44] text-slate-200 text-xs font-mono max-w-2xl leading-relaxed">
                  {m.text}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-300 p-3.5 bg-[#111827] border border-cyan-900/60 rounded-xl max-w-md animate-pulse shadow-lg">
            <Bot className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold text-white">IBM Bob AI Engine Reasoning...</span>
              <span className="text-[10px] text-slate-400">Analyzing SCADA streams, weather squall tracks, and risk matrices</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputQuestion);
        }}
        className="sticky bottom-4 bg-[#111827]/95 backdrop-blur border border-[#1f2d44] rounded-xl p-2.5 shadow-2xl flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Ask about grid stability, equipment risk, weather storm tracks, or crew staging..."
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          disabled={loading}
          className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
        />
        <button
          type="submit"
          disabled={loading || !inputQuestion.trim()}
          className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
