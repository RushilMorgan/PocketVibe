import React, { useState } from 'react';
import type { ElementAction, IdeaElementKind } from '../../lib/ideaElements';
import { kindLabel } from '../../lib/ideaElements';

interface ElementChatSheetProps {
  open: boolean;
  kind: IdeaElementKind;
  /** Short human preview of the element, e.g. the risk title. */
  preview: string;
  actions: ElementAction[];
  /** True while the AI is reshaping the element. */
  busy: boolean;
  /** Inline error/quota message shown under the header. */
  errorText?: string | null;
  /** Run an AI instruction against this element. */
  onAction: (instruction: string) => void;
  /** Deterministic local action (e.g. delete). */
  onLocalAction?: (action: 'delete') => void;
  onClose: () => void;
}

/**
 * The "tap-to-talk" sheet — summoned by tapping any element on the Idea Board.
 * Shows the element, 2–3 AI-chosen actions, and a free-text line. Single-shot:
 * the result lands back on the canvas, not in a chat thread. Dark Toolie styling
 * matches IdeaIntakeSheet / CreationComposer.
 */
export function ElementChatSheet({
  open, kind, preview, actions, busy, errorText, onAction, onLocalAction, onClose,
}: ElementChatSheetProps) {
  const [input, setInput] = useState('');

  if (!open) return null;

  function run(instruction: string) {
    if (!instruction.trim() || busy) return;
    onAction(instruction.trim());
    setInput('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(input);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />

      {/* Sheet */}
      <div
        data-testid="element-chat-sheet"
        className="relative bg-gray-950 rounded-t-3xl shadow-2xl flex flex-col z-10 border-t border-violet-500/20 max-h-[80%]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 pt-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-violet-400 text-xs">✦</span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Ask Toolie about {kindLabel(kind)}</p>
          </div>
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{preview}</p>
        </div>

        {/* Inline error / quota message */}
        {errorText && !busy && (
          <div data-testid="element-chat-error" className="mx-5 mb-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex-shrink-0">
            <span className="text-sm text-amber-300">{errorText}</span>
          </div>
        )}

        {/* Thinking state */}
        {busy && (
          <div className="mx-5 mb-3 px-4 py-2.5 bg-violet-600/20 border border-violet-500/25 rounded-xl flex items-center gap-2 flex-shrink-0">
            <span className="text-sm animate-spin">⚙️</span>
            <span className="text-sm text-violet-300 font-medium">Toolie is reshaping this…</span>
          </div>
        )}

        {/* Action chips */}
        {!busy && (
          <div className="px-5 pb-2 flex flex-wrap gap-2 flex-shrink-0">
            {actions.map(action => (
              <button
                key={action.id}
                data-testid={`element-action-${action.id}`}
                onClick={() => {
                  if (action.localAction) onLocalAction?.(action.localAction);
                  else if (action.prompt) run(action.prompt);
                }}
                className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/75 active:bg-white/12"
              >
                {action.label}
              </button>
            ))}
            {onLocalAction && (
              <button
                data-testid="element-action-delete"
                onClick={() => onLocalAction('delete')}
                className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 active:bg-red-500/20"
              >
                Remove
              </button>
            )}
          </div>
        )}

        {/* Free-text input */}
        <form onSubmit={handleSubmit} className="flex gap-2 items-center px-5 pb-6 pt-2 flex-shrink-0">
          <input
            data-testid="element-chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={busy ? 'Working on it…' : 'Or tell Toolie what to change…'}
            disabled={busy}
            maxLength={500}
            className="flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-600 text-white disabled:opacity-40 active:bg-violet-700 transition-colors flex-shrink-0"
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
