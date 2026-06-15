import React, { useState, useRef, useEffect } from 'react';
import { useSpeechInput } from '../hooks/useSpeechInput';
import type { ChatMessage, Creation, TournamentPoolTrackerContent, WorkoutTrackerContent, IdeaThinkingBoardContent } from '../types';
import { getAIConnectionStatus } from '../services/aiService';
import { useUsage } from '../hooks/useUsage';
import { formatRemainingLabel, formatResetHint } from '../lib/quotaMessage';

interface CreationComposerProps {
  activeCreation: Creation | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  processingStatus: string | null;
  onNew: (request: string) => void;
  onImprove: (request: string) => void;
  onAdd: (request: string) => void;
  /** Fast chat path: Q&A or modification routing for an active creation. */
  onChat?: (request: string) => void;
  onToolAction?: (actionId: string) => void;
  /** Controlled open state — parent can force the sheet open (e.g. from a tile tap). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Whether the current user is signed in (drives the limit-reached upsell). */
  isSignedIn?: boolean;
  /** Opens the sign-in flow — shown to anonymous users who hit their limit. */
  onRequestSignIn?: () => void;
}

interface ContextSuggestion {
  id: string;
  label: string;
  prompt: string;
  localActionId?: string;
}

function buildPoolSuggestions(creation: Creation): ContextSuggestion[] {
  const content = creation.content as TournamentPoolTrackerContent;
  const unassignedTeams = content.teams.filter(team => !team.assignedTo).length;
  const hasParticipants = content.participants.length > 0;
  const hasMatches = content.matches.length > 0;
  const shared = Boolean(creation.shareSlug);

  if (!hasParticipants) {
    return [
      { id: 'add-people', label: 'Add people', prompt: 'Add people to this pool and make the setup feel smooth on mobile.' },
      { id: 'show-teams', label: 'Show me my teams', prompt: 'Show me my teams and explain how the draw will work.' },
    ];
  }

  if (!content.drawLocked || unassignedTeams > 0) {
    return [
      { id: 'run-draw', label: 'Run the draw', prompt: 'Run the draw and reveal the teams in a fun step-by-step way.', localActionId: 'run-draw-all' },
      { id: 'show-teams', label: 'Show me my teams', prompt: 'Show me my teams and the pots they came from.' },
      { id: 'share', label: shared ? 'Copy share link' : 'Share this pool', prompt: shared ? 'Copy share link for this pool.' : 'Share this pool with everyone.', localActionId: 'share' },
    ];
  }

  return [
    { id: 'show-teams', label: 'Show me my teams', prompt: 'Show me my teams and explain why I am in this position.' },
    { id: 'add-result', label: hasMatches ? 'Add another result' : 'Add a result', prompt: 'Add a result to this pool.', localActionId: 'add-result' },
    { id: 'scoring', label: 'Change scoring', prompt: 'Change scoring for this pool.', localActionId: 'edit-scoring' },
    { id: 'leaderboard', label: 'Explain the leaderboard', prompt: 'Explain the leaderboard for this pool.' },
    { id: 'share', label: shared ? 'Copy share link' : 'Share this pool', prompt: shared ? 'Copy share link for this pool.' : 'Share this pool with everyone.', localActionId: 'share' },
  ];
}

function buildChallengeSuggestions(creation: Creation): ContextSuggestion[] {
  const content = creation.content as WorkoutTrackerContent;
  const participants = content.participants ?? [];
  const logs = content.logs ?? [];
  const shared = Boolean(creation.shareSlug);

  if (participants.length < 2) {
    return [
      { id: 'add-partner', label: 'Add my partner', prompt: 'Add my partner to this challenge.' },
      { id: 'target', label: 'Change weekly target', prompt: 'Change weekly target for this challenge.' },
    ];
  }

  if (logs.length === 0) {
    return [
      { id: 'first-log', label: 'Log first activity', prompt: 'Log a walk for me.' },
      { id: 'share', label: shared ? 'Copy share link' : 'Share with my partner', prompt: shared ? 'Copy share link for this challenge.' : 'Share with my partner.' },
      { id: 'progress', label: 'Show this week’s progress', prompt: 'Show this week’s progress for this challenge.' },
    ];
  }

  return [
    { id: 'log-walk', label: 'Log a walk for me', prompt: 'Log a walk for me.' },
    { id: 'target', label: 'Change weekly target', prompt: 'Change weekly target for this challenge.' },
    { id: 'scoring', label: 'Make runs worth more points', prompt: 'Make runs worth more points.' },
    { id: 'share', label: shared ? 'Copy share link' : 'Share with my partner', prompt: shared ? 'Copy share link for this challenge.' : 'Share with my partner.' },
    { id: 'progress', label: 'Show this week’s progress', prompt: 'Show this week’s progress for this challenge.' },
  ];
}

function buildIdeaBoardSuggestions(creation: Creation): ContextSuggestion[] {
  const content = creation.content as IdeaThinkingBoardContent;
  const hasRisks = content.risks.length > 0;
  const hasMoney = content.moneyIdeas.length > 0;
  const hasSteps = content.nextSteps.length > 0;
  const lowConfidence = content.scores.confidence <= 4;
  const highRisk = content.scores.riskLevel >= 7;
  const lowMoney = content.scores.moneyPotential <= 4;

  if (highRisk) {
    return [
      { id: 'safer-version', label: 'Make a safer first version', prompt: 'Make a safer, lower-risk first version of this idea.' },
      { id: 'find-risks', label: 'Show me the biggest risks', prompt: 'Show me the biggest risks with this idea and how to avoid them.' },
      { id: 'test-plan', label: 'Create a 7-day test plan', prompt: 'Create a 7-day test plan to quickly find out if this idea works.' },
    ];
  }

  if (lowMoney && !hasMoney) {
    return [
      { id: 'money-ideas', label: 'Find ways to make money', prompt: 'Find stronger ways this idea could make money.' },
      { id: 'make-simpler', label: 'Make it simpler', prompt: 'Make this idea simpler and more focused.' },
      { id: 'test-plan', label: 'Create a 7-day test plan', prompt: 'Create a 7-day test plan for this idea.' },
    ];
  }

  if (!hasSteps) {
    return [
      { id: 'test-plan', label: 'Create a 7-day test plan', prompt: 'Create a 7-day action plan to test this idea quickly.' },
      { id: 'first-version', label: 'What to build first', prompt: 'What is the simplest first version of this idea I could build this week?' },
      { id: 'make-realistic', label: 'Make it more realistic', prompt: 'Make this idea more realistic and practical.' },
    ];
  }

  if (lowConfidence) {
    return [
      { id: 'make-clearer', label: 'Make the idea clearer', prompt: 'Make this idea clearer and easier to explain to someone.' },
      { id: 'find-risks', label: 'Find the hard truths', prompt: 'What are the honest problems with this idea that I should know now?' },
      { id: 'simpler', label: 'Simpler version', prompt: 'Create a much simpler version of this idea I could start this weekend.' },
    ];
  }

  return [
    { id: 'improve-idea', label: 'Improve this idea', prompt: 'Improve this idea and make it stronger.' },
    { id: 'test-plan', label: 'Create a 7-day test plan', prompt: 'Create a 7-day test plan for this idea.' },
    !hasRisks
      ? { id: 'find-risks', label: 'Find the risks', prompt: 'Find the biggest risks and hard truths about this idea.' }
      : { id: 'compare', label: 'Compare two versions', prompt: 'Create two different versions of this idea and compare them.' },
    { id: 'launch-checklist', label: 'Turn into a launch plan', prompt: 'Turn this idea into a step-by-step launch checklist.' },
  ];
}

// ── Home-screen nudges ────────────────────────────────────────────────────────
// Shown inside the Toolie sheet when no creation is active yet.
// Ordered from flagship → broad, so users see the best examples first.
const HOME_SUGGESTIONS: ContextSuggestion[] = [
  {
    id: 'home-world-cup',
    label: '🏆 World Cup Pool',
    prompt: 'Create a friendly World Cup pool for my family. Add participants, draw teams from seeded pots, track results, and show a leaderboard.',
  },
  {
    id: 'home-partner',
    label: '🏃 Partner Challenge',
    prompt: 'Create a walking and running challenge for me and my partner. We want to do 3 sessions per week, earn points, and see a leaderboard.',
  },
  {
    id: 'home-idea-board',
    label: '💡 Think through an idea',
    prompt: 'I have a business idea I want to think through. Help me create an idea thinking board to explore risks, money ideas, who it\'s for, and what to do first.',
  },
  {
    id: 'home-event',
    label: '🎉 Plan an event',
    prompt: 'Create an event planner with tasks, a timeline, and a checklist.',
  },
  {
    id: 'home-budget',
    label: '💰 Budget tracker',
    prompt: 'Create a simple monthly budget tracker for me.',
  },
  {
    id: 'home-checklist',
    label: '✅ Checklist',
    prompt: 'Create a checklist for me.',
  },
  {
    id: 'home-meals',
    label: '🍽️ Meal planner',
    prompt: 'Create a weekly meal planner for me.',
  },
];

function getContext(activeCreation: Creation | null): {
  title: string;
  subtitle: string;
  placeholder: string;
  suggestions: ContextSuggestion[];
} {
  if (!activeCreation) {
    return {
      title: 'What would you like to make?',
      subtitle: 'Describe anything — Toolie will build it.',
      placeholder: 'A pool, a challenge, a budget tracker…',
      suggestions: HOME_SUGGESTIONS,
    };
  }

  if (activeCreation.content.type === 'tournament_pool_tracker') {
    return {
      title: 'Ask Toolie about this pool',
      subtitle: 'Run the draw, add results, change scoring…',
      placeholder: 'Ask about the pool, draw, scoring, or sharing…',
      suggestions: buildPoolSuggestions(activeCreation),
    };
  }

  if (activeCreation.content.type === 'workout_tracker') {
    return {
      title: 'Ask Toolie about this challenge',
      subtitle: 'Log activity, check progress, adjust scoring…',
      placeholder: 'Ask about logging, scoring, sharing, or progress…',
      suggestions: buildChallengeSuggestions(activeCreation),
    };
  }

  if (activeCreation.content.type === 'idea_thinking_board') {
    return {
      title: 'Reshape the whole board',
      subtitle: 'Tap any card to change just that part — or ask for a board-wide change here.',
      placeholder: 'Turn this into a launch plan, compare two versions…',
      suggestions: buildIdeaBoardSuggestions(activeCreation),
    };
  }

  return {
    title: 'Ask Toolie about this tool',
    subtitle: 'Make changes or ask questions.',
    placeholder: 'What should change?',
    suggestions: [],
  };
}

export function CreationComposer({
  activeCreation,
  messages,
  isGenerating,
  processingStatus,
  onNew,
  onImprove,
  onAdd: _onAdd,
  onChat,
  onToolAction,
  open: controlledOpen,
  onOpenChange,
  isSignedIn,
  onRequestSignIn,
}: CreationComposerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  function setIsOpen(val: boolean) {
    setInternalOpen(val);
    onOpenChange?.(val);
  }
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Tap-to-talk ─────────────────────────────────────────────────────────────
  // Speech streams into the input live; the user reviews and taps send.
  const speechBaseRef = useRef('');
  const speech = useSpeechInput({
    onTranscript: (text) => {
      const base = speechBaseRef.current;
      setInput(base ? `${base} ${text}` : text);
    },
  });
  function toggleMic() {
    if (speech.listening) {
      speech.stop();
    } else {
      speechBaseRef.current = input.trim();
      speech.start();
    }
  }

  const hasActive = Boolean(activeCreation);
  const aiStatus = getAIConnectionStatus();
  const context = getContext(activeCreation);

  // ── FAB collapse-on-scroll ──────────────────────────────────────────────────
  // The extended "Ask Toolie" pill shrinks to a circle while the user scrolls,
  // then re-expands shortly after they stop — bold on arrival, never in the way.
  // Capture-phase listener so it catches scroll from any nested scroll container.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (isOpen) return;
    let idle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setCollapsed(true);
      clearTimeout(idle);
      idle = setTimeout(() => setCollapsed(false), 1100);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('scroll', onScroll, true); clearTimeout(idle); };
  }, [isOpen]);

  // ── Daily usage hints ───────────────────────────────────────────────────────
  // When there's an active tool, the next message is usually a chat turn; on the
  // home screen it's a new generation. Show the relevant remaining count.
  const usage = useUsage();
  const usageKind = hasActive ? 'chat' : 'generation';
  const usageSnap = usage[usageKind];
  const remaining = usageSnap?.remaining ?? null;
  const limitReached = remaining !== null && remaining <= 0;
  const showLowHint = remaining !== null && remaining > 0 && remaining <= 5;
  if (isOpen && !aiStatus.connected) {
    console.log('[HeyToolie] AI not connected:', aiStatus.reason);
  }

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  function sendPrompt(prompt: string) {
    if (!prompt.trim() || isGenerating || limitReached) return;
    if (speech.listening) speech.stop();
    if (hasActive) {
      // Use the smart chat path when available: the AI decides whether this is
      // a Q&A question (gets a direct answer) or a modification (full pipeline).
      if (onChat) onChat(prompt.trim());
      else onImprove(prompt.trim());
    } else {
      onNew(prompt.trim());
      // Close the sheet so the live build narration on the canvas is visible
      setIsOpen(false);
    }
    setInput('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendPrompt(input);
  }

  return (
    <>
      {/* FAB trigger — Velix extended pill; collapses to a circle on scroll */}
      {!isOpen && (
        <button
          data-testid="toolie-fab"
          onClick={() => setIsOpen(true)}
          className="absolute bottom-6 right-5 z-20 flex items-center h-14 rounded-full bg-[#16150f] text-white active:scale-95 transition-transform"
          style={{ boxShadow: '0 12px 30px rgba(22,21,15,0.32)' }}
          aria-label={hasActive ? context.title : 'Ask Toolie'}
        >
          <span className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            {/* Stardust — tiny particles twinkling around the sparkle */}
            <span aria-hidden="true" className="absolute w-[3px] h-[3px] rounded-full bg-white animate-twinkle" style={{ top: '14px', right: '15px', animationDelay: '0s' }} />
            <span aria-hidden="true" className="absolute w-[2px] h-[2px] rounded-full bg-white animate-twinkle" style={{ bottom: '15px', left: '16px', animationDelay: '.6s' }} />
            <span aria-hidden="true" className="absolute w-[2px] h-[2px] rounded-full bg-white animate-twinkle" style={{ top: '17px', left: '15px', animationDelay: '1.1s' }} />
            <span aria-hidden="true" className="absolute w-[1.5px] h-[1.5px] rounded-full bg-white animate-twinkle" style={{ bottom: '16px', right: '17px', animationDelay: '1.5s' }} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 L13.8 10.2 L22 12 L13.8 13.8 L12 22 L10.2 13.8 L2 12 L10.2 10.2 Z" />
            </svg>
          </span>
          <span
            className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ease-out ${
              collapsed ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100 pr-5'
            }`}
          >
            Ask Toolie
          </span>
        </button>
      )}

      {/* Sheet overlay — Velix light/frosted */}
      {isOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[82%] z-10"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(22,21,15,0.15)' }} />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 pt-1 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="tp-ink text-xs">✦</span>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] tp-ink-3">Toolie</p>
              </div>
              <h3 className="text-base font-extrabold tp-ink tracking-tight">{context.title}</h3>
              <p className="text-xs tp-ink-3 mt-0.5">{context.subtitle}</p>
            </div>

            {isGenerating && processingStatus && (
              <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0" style={{ background: 'rgba(22,21,15,0.04)' }}>
                <span className="text-sm animate-spin">⚙️</span>
                <span className="text-sm tp-ink-2 font-medium">{processingStatus}</span>
              </div>
            )}

            {/* AI status banner */}
            {!aiStatus.connected && (
              <div
                data-testid="ai-status-banner"
                className="mx-4 mb-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 flex-shrink-0"
              >
                <span className="text-sm">⚠️</span>
                <span className="text-sm text-amber-700">
                  AI updates are not connected yet. You can still edit this tool directly.
                </span>
              </div>
            )}

            {/* Context suggestions */}
            {context.suggestions.length > 0 && !isGenerating && (
              <div
                data-testid="contextual-chat-suggestions"
                className="flex gap-2 overflow-x-auto px-4 pb-3 flex-shrink-0"
                style={{ scrollbarWidth: 'none' }}
              >
                {context.suggestions.map(suggestion => (
                  <button
                    key={suggestion.id}
                    data-testid={`context-suggestion-${suggestion.id}`}
                    onClick={() => {
                      if (suggestion.localActionId) {
                        onToolAction?.(suggestion.localActionId);
                        setIsOpen(false);
                      } else {
                        sendPrompt(suggestion.prompt);
                      }
                    }}
                    className="tp-glass flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold tp-ink active:scale-95 transition-transform"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}

            {/* Chat history */}
            {messages.length > 0 && (
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'tp-ink rounded-bl-sm'
                      }`}
                      style={msg.role === 'user'
                        ? { background: '#16150f' }
                        : { background: 'rgba(22,21,15,0.05)' }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Limit-reached panel */}
            {limitReached ? (
              <div
                data-testid="quota-limit-panel"
                className="mx-4 mb-6 mt-2 px-4 py-3.5 rounded-2xl flex-shrink-0"
                style={{ background: 'rgba(22,21,15,0.03)', border: '1px solid rgba(22,21,15,0.08)' }}
              >
                <p className="text-sm font-bold tp-ink">
                  {usageKind === 'chat' ? "That's all your questions for today" : "That's all your creations for today"}
                </p>
                <p className="text-xs tp-ink-3 mt-0.5">
                  You can make more {formatResetHint(usageSnap?.resetsAt ?? '')}.
                  {!isSignedIn && onRequestSignIn && ' Sign in for a higher daily limit.'}
                </p>
                {!isSignedIn && onRequestSignIn && (
                  <button
                    data-testid="quota-signin-btn"
                    onClick={onRequestSignIn}
                    className="tp-btn-dark mt-2.5 text-xs font-bold px-4 py-2 rounded-full"
                  >
                    Sign in for more →
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Low-stock hint */}
                {showLowHint && !isGenerating && (
                  <p data-testid="quota-remaining-hint" className="px-5 pb-1 pt-1 text-[11px] tp-ink-3 flex-shrink-0">
                    {formatRemainingLabel(usageKind, remaining as number)}
                  </p>
                )}

                {/* Input bar */}
                <form onSubmit={handleSubmit} className="flex gap-2 items-center px-4 pb-6 pt-2 flex-shrink-0">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={
                      isGenerating ? 'Working on it…'
                        : speech.listening ? 'Listening… speak now'
                        : context.placeholder
                    }
                    disabled={isGenerating}
                    className="tp-input flex-1 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
                    style={{ ['--tw-ring-color' as string]: 'rgba(22,21,15,0.18)' }}
                  />
                  {speech.supported && (
                    <button
                      type="button"
                      data-testid="mic-btn"
                      onClick={toggleMic}
                      disabled={isGenerating}
                      aria-label={speech.listening ? 'Stop listening' : 'Speak instead of typing'}
                      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-transform disabled:opacity-40 active:scale-95 ${
                        speech.listening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'tp-glass tp-ink'
                      }`}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isGenerating || !input.trim()}
                    className="tp-btn-dark w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 transition-transform active:scale-95 flex-shrink-0"
                    aria-label="Send"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
