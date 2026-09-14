import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  Database,
  Terminal
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { askAdvisor } from '../services/api';
import { AdvisorQueryResponse } from '../types';

const SUGGESTED_PROMPTS = [
  'Which asset requires immediate attention?',
  'Why is TR-104 considered critical?',
  'What areas are most vulnerable to the upcoming storm?',
  'Which crew should be pre-positioned?',
  'What happens if TR-104 fails?',
  "Give me today's recommended maintenance plan."
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'advisor';
  text?: string;
  response?: AdvisorQueryResponse;
  timestamp: string;
}

export const AdvisorPage: React.FC = () => {
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      sender: 'advisor',
      response: {
        answer: 'GridGuard AI Decision-Support Advisor online. I am actively analyzing SCADA telemetry, predictive transformer fault models, Doppler weather radar cells, and field crew deployment logs.',
        priority: 'CRITICAL',
        evidence: [
          'Transformer TR-104 (Naroda Substation) evaluated at 82% failure probability',
          'East Grid corridor facing 48.5 mm/h torrential rain squalls within 24 hours',
          'Crew 2 staged at East Depot with specialized 400kV thermal and SF6 diagnostic gear'
        ],
        recommended_actions: [
          'Select a suggested operator inquiry below or enter a custom operational query.'
        ],
        expected_impact: 'Continuous multi-modal risk scoring reduces unexpected catastrophic outage risk by up to 74%.'
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const handleSend = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await askAdvisor(q);
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
        text: `Error contacting reasoning service: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <Bot className="w-3.5 h-3.5" />
            Operator AI Reasoning Engine
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            GridGuard AI Advisor
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ask questions about grid risk, equipment health, weather impact, and maintenance priorities.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>IBM Hackathon Isolated Model Boundary Active</span>
        </div>
      </div>

      {/* Suggested Prompt Pills */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-3 shadow-lg">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          Recommended Operator Diagnostic Inquiries:
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="px-3 py-1 rounded bg-[#0b0f17] hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-cyan-300 transition-colors text-left flex items-center gap-1.5"
            >
              <span>{prompt}</span>
              <ChevronRight className="w-3 h-3 text-cyan-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Decision Support Dialogue Container */}
      <div className="space-y-4">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="text-[10px] font-mono text-slate-500 mb-1 px-1">
                {isUser ? 'OPERATOR' : 'GRIDGUARD AI ADVISOR'} • {m.timestamp}
              </div>

              {isUser ? (
                <div className="max-w-2xl bg-cyan-950/80 border border-cyan-800 text-cyan-200 rounded-lg p-3.5 text-xs font-mono shadow-md">
                  {m.text}
                </div>
              ) : m.response ? (
                /* Structured Operational Response Format */
                <div className="max-w-3xl w-full bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl space-y-4 font-mono text-xs">
                  {/* Summary & Priority Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-[#1f2d44] pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span className="text-white font-bold text-sm">
                        {m.response.answer}
                      </span>
                    </div>
                    <RiskBadge level={m.response.priority} size="sm" showPulse />
                  </div>

                  {/* Evidence Section */}
                  {m.response.evidence && m.response.evidence.length > 0 && (
                    <div className="p-3.5 rounded bg-[#0d1424] border border-slate-800 space-y-2">
                      <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-amber-400" />
                        Diagnostic Evidence & Telemetry Signals:
                      </span>
                      <ul className="space-y-1.5 text-slate-300 text-xs">
                        {m.response.evidence.map((ev, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span className="leading-snug">{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Actions */}
                  {m.response.recommended_actions && m.response.recommended_actions.length > 0 && (
                    <div className="p-3.5 rounded bg-emerald-950/20 border border-emerald-800/60 space-y-2">
                      <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Recommended Grid Interventions:
                      </span>
                      <ol className="space-y-1.5 text-slate-200 text-xs list-decimal list-inside font-sans">
                        {m.response.recommended_actions.map((act, idx) => (
                          <li key={idx} className="leading-snug pl-1 font-mono">
                            {act}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Expected Impact */}
                  {m.response.expected_impact && (
                    <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <strong className="text-cyan-400 font-bold uppercase tracking-wider block mb-0.5">
                        Outage Avoidance & Impact Estimation:
                      </strong>
                      <p className="font-sans text-xs text-slate-300">{m.response.expected_impact}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded bg-red-950/40 border border-red-800 text-red-200 text-xs font-mono">
                  {m.text}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 p-3 bg-[#111827] border border-cyan-900/40 rounded-lg w-72 animate-pulse">
            <Bot className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Consulting risk engine & weather signals...</span>
          </div>
        )}
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputQuestion);
        }}
        className="sticky bottom-4 bg-[#111827] border border-[#1f2d44] rounded-lg p-2 shadow-2xl flex items-center gap-2"
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
          className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
