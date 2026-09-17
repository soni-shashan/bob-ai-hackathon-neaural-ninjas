import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Activity,
  History,
  X,
  Trash2,
  Plus,
  MessageSquare,
  Clock,
  ChevronDown
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { askAdvisor, getDashboardSummary } from '../services/api';
import { AdvisorQueryResponse, ChatHistoryItem } from '../types';

// ── Constants ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "Give me today's recommended grid maintenance plan.",
  "What is the overall health and risk status across the entire grid?",
  "What areas and substations are most vulnerable to the storm?",
  "Which crews are deployed and where are they staged?",
  "What are the top priority critical assets requiring intervention?",
  "What is the failure impact and contingency plan for TR-104?"
];

const HISTORY_STORAGE_KEY = 'gridguard_advisor_chat_history';
const ACTIVE_SESSION_KEY = 'gridguard_advisor_active_session';

// ── Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  sender: 'user' | 'advisor';
  text?: string;
  response?: AdvisorQueryResponse;
  timestamp: string;
  isError?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// ── localStorage Helpers ─────────────────────────────────────────────

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // storage full — silently fail
  }
}

function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

function saveActiveSessionId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // silently fail
  }
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.sender === 'user');
  if (firstUserMsg?.text) {
    const text = firstUserMsg.text;
    return text.length > 55 ? text.slice(0, 52) + '...' : text;
  }
  return 'New Conversation';
}

function formatSessionDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Component ────────────────────────────────────────────────────────

export const AdvisorPage: React.FC = () => {
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [totalAssets, setTotalAssets] = useState<number>(0);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(loadActiveSessionId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch real fleet count from dashboard API
  useEffect(() => {
    getDashboardSummary()
      .then((s) => setTotalAssets(s.total_assets))
      .catch(() => setTotalAssets(0));
  }, []);

  // Build initial message with dynamic asset count
  const INITIAL_MESSAGE: ChatMessage = useMemo(() => ({
    id: 'msg-0',
    sender: 'advisor',
    response: {
      answer: 'GridGuard AI Decision-Support Advisor online, powered by IBM Bob AI. Actively analyzing real-time SCADA telemetry, multi-zone risk matrices, Doppler storm radar, and field crew logistics across the entire regional grid.',
      priority: 'HIGH',
      evidence: [
        `Fleet Telemetry: ${totalAssets || '...'} high-voltage assets monitored across East, North, Central, South, and West grid zones`,
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
  }), [totalAssets]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize messages from active session or initial message
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find((s) => s.id === activeSessionId);
      if (session && session.messages.length > 0) {
        setMessages(session.messages);
        return;
      }
    }
    setMessages([INITIAL_MESSAGE]);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Update initial message when totalAssets loads (only if on welcome screen)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0) return [INITIAL_MESSAGE];
      if (prev.length === 1 && prev[0].id === 'msg-0') return [INITIAL_MESSAGE];
      if (prev[0]?.id === 'msg-0') return [INITIAL_MESSAGE, ...prev.slice(1)];
      return prev;
    });
  }, [INITIAL_MESSAGE]);

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Session Persistence ──────────────────────────────────────────

  const persistCurrentSession = useCallback((updatedMessages: ChatMessage[]) => {
    // Only save if there are user messages (not just the initial message)
    const hasUserMessages = updatedMessages.some((m) => m.sender === 'user');
    if (!hasUserMessages) return;

    const now = new Date().toISOString();
    const userMsgCount = updatedMessages.filter((m) => m.sender === 'user').length;

    setSessions((prev) => {
      let updated: ChatSession[];
      const existingIdx = activeSessionId ? prev.findIndex((s) => s.id === activeSessionId) : -1;

      if (existingIdx >= 0) {
        // Update existing session
        updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          messages: updatedMessages,
          title: deriveTitle(updatedMessages),
          updatedAt: now,
          messageCount: userMsgCount
        };
      } else {
        // Create new session
        const newId = generateSessionId();
        setActiveSessionId(newId);
        saveActiveSessionId(newId);
        const newSession: ChatSession = {
          id: newId,
          title: deriveTitle(updatedMessages),
          messages: updatedMessages,
          createdAt: now,
          updatedAt: now,
          messageCount: userMsgCount
        };
        updated = [newSession, ...prev];
      }

      saveSessions(updated);
      return updated;
    });
  }, [activeSessionId]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    const newId = generateSessionId();
    setActiveSessionId(newId);
    saveActiveSessionId(newId);
    setMessages([{
      ...INITIAL_MESSAGE,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setShowHistory(false);
  }, [INITIAL_MESSAGE]);

  const handleReset = useCallback(() => {
    handleNewChat();
  }, [handleNewChat]);

  const handleLoadSession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      saveActiveSessionId(sessionId);
      setMessages(session.messages);
      setShowHistory(false);
    }
  }, [sessions]);

  const handleDeleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId === sessionId) {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== sessionId);
        saveSessions(updated);
        return updated;
      });
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(sessionId);
      // Auto-reset confirm state after 3s
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  }, [confirmDeleteId, activeSessionId, handleNewChat]);

  const handleClearAllHistory = useCallback(() => {
    setSessions([]);
    saveSessions([]);
    handleNewChat();
  }, [handleNewChat]);

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

    const messagesWithUser = [...messages, userMsg];
    setMessages(messagesWithUser);
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
      const finalMessages = [...messagesWithUser, advisorMsg];
      setMessages(finalMessages);
      persistCurrentSession(finalMessages);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'advisor',
        text: `Reasoning communication error: ${err.message || 'Unable to connect to AI engine.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      const finalMessages = [...messagesWithUser, errorMsg];
      setMessages(finalMessages);
      persistCurrentSession(finalMessages);
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
    <div className="space-y-4 sm:space-y-6 relative">
      {/* ── History Sidebar Overlay ─────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sidebar Panel */}
          <div
            className="relative w-full max-w-sm bg-[#0a0f1c] border-l border-cyan-900/50 shadow-2xl flex flex-col animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideInRight 0.25s ease-out' }}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2d44]">
              <div className="flex items-center gap-2.5">
                <History className="w-4.5 h-4.5 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-bold text-white font-mono tracking-tight">
                    Chat History
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {sessions.length} saved session{sessions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="px-4 pt-3 pb-2">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-700/60 hover:border-cyan-500/70 text-cyan-300 hover:text-cyan-200 text-xs font-mono font-bold transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Conversation
              </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-700 mb-3" />
                  <p className="text-xs text-slate-500 font-mono">No saved conversations yet</p>
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    Start chatting and your sessions will appear here
                  </p>
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isConfirmingDelete = confirmDeleteId === session.id;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleLoadSession(session.id)}
                      className={`group relative flex flex-col gap-1.5 px-3.5 py-3 rounded-lg cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-cyan-950/40 border-cyan-800/60 shadow-md'
                          : 'bg-[#111827]/60 border-transparent hover:bg-slate-800/60 hover:border-slate-700/60'
                      }`}
                    >
                      {/* Session Title */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Bot className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <span className={`text-xs font-mono leading-snug truncate ${isActive ? 'text-white font-semibold' : 'text-slate-300'}`}>
                            {session.title}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className={`flex-shrink-0 p-1 rounded transition-all ${
                            isConfirmingDelete
                              ? 'bg-red-900/60 text-red-400 border border-red-700/60'
                              : 'opacity-0 group-hover:opacity-100 hover:bg-red-950/50 text-slate-500 hover:text-red-400'
                          }`}
                          title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete session'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Session Meta */}
                      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 pl-5.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatSessionDate(session.updatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5" />
                          {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Active Indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-cyan-400 rounded-r" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            {sessions.length > 0 && (
              <div className="px-4 py-3 border-t border-[#1f2d44]">
                <button
                  onClick={handleClearAllHistory}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/30 hover:bg-red-950/50 border border-red-900/40 hover:border-red-800/60 text-red-400/70 hover:text-red-300 text-[11px] font-mono transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Inline Style for Sidebar Animation ──────────────────────── */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.8; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

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
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
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
            onClick={() => setShowHistory(true)}
            title="View chat history"
            className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-800/50 hover:border-cyan-700/60 px-3 py-1.5 rounded transition-all shadow-sm"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
            {sessions.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-cyan-800/60 text-[10px] text-cyan-300 font-bold min-w-[18px] text-center">
                {sessions.length}
              </span>
            )}
          </button>

          <button
            onClick={handleReset}
            title="Start new conversation"
            className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-slate-400" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Live Operational Status Ribbon */}
      <div className="bg-[#0b1322] border border-cyan-900/40 rounded-lg px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono overflow-hidden">
        <div className="flex items-center gap-2 text-slate-300">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-300 font-semibold">Live Operational Grounding:</span>
          <span className="text-slate-400">{totalAssets || '...'} HV Assets Streamed</span>
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
      <div className="space-y-3 sm:space-y-4 min-h-[300px] sm:min-h-[380px]">
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
                <div className="max-w-[85vw] sm:max-w-xl md:max-w-2xl bg-cyan-950/80 border border-cyan-700/70 text-cyan-100 rounded-xl rounded-tr-sm p-2.5 sm:p-3.5 text-xs font-mono shadow-lg leading-relaxed">
                  {m.text}
                </div>
              ) : m.response ? (
                /* Structured Operational Response Format */
                <div className="max-w-[90vw] sm:max-w-2xl md:max-w-3xl w-full bg-[#111827] border border-[#1f2d44] rounded-xl rounded-tl-sm p-3 sm:p-5 shadow-xl space-y-3 sm:space-y-4 font-mono text-xs">
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
                          Scope: Entire Grid Fleet ({totalAssets || '...'} Assets)
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
