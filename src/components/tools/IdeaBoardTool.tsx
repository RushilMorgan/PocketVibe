import React, { useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePocketVibe } from '../../hooks/usePocketVibe';
import { IdeaThinkingBoardRenderer } from '../templates/IdeaThinkingBoardRenderer';
import { editIdeaElement } from '../../services/aiService';
import { applyElementPatch } from '../../lib/applyElementPatch';
import { IDEA_INTENTS } from '../../lib/ideaBoardPrompt';
import { celebrate } from '../../lib/celebrate';
import { formatResetHint } from '../../lib/quotaMessage';
import { stageLabel } from '../../services/aiService';
import type { IdeaThinkingBoardContent, GenerationStageEvent } from '../../types';
import type { ToolChip, ToolAccent } from '../../lib/toolPages';
import { ToolCard, ToolButton, ToolChip as Chip, ToolInput, ToolProgress } from './ui';

interface IdeaBoardToolProps {
  /** Example "ask Toolie" prompts shown under the result. */
  chips: ToolChip[];
  /** Per-type accent (Velix soft-accent treatment) from the tool-page shell. */
  accent: ToolAccent;
}

/**
 * The live, anonymous Idea / Brainstorm tool. Reuses the deployed
 * `idea_thinking_board` generation (via usePocketVibe.generateIdeaBoard) and the
 * full IdeaThinkingBoardRenderer — whose built-in element tap-to-talk works
 * standalone. Customize chips call the same scoped element-edit path. No sign-in
 * required. Composed from the tools/ui.tsx primitives.
 */
export function IdeaBoardTool({ chips, accent }: IdeaBoardToolProps) {
  const auth = useAuth();
  const { generateIdeaBoard, quotaNotice, dismissQuotaNotice } = usePocketVibe(auth.user?.id);

  const [idea, setIdea] = useState('');
  const [intentId, setIntentId] = useState('validate');
  const [generating, setGenerating] = useState(false);
  const [stageEvents, setStageEvents] = useState<GenerationStageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<IdeaThinkingBoardContent | null>(null);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const celebratedRef = useRef(false);

  const canGenerate = !generating && idea.trim().length > 2;

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setStageEvents([]);
    setError(null);
    try {
      const result = await generateIdeaBoard('', idea.trim(), intentId, ev => setStageEvents(prev => [...prev, ev]));
      if (!result) {
        setError("Couldn't map that one — try rephrasing your idea, or add a little more detail.");
        return;
      }
      setBoard(result);
      if (!celebratedRef.current) {
        celebrate({ intensity: 'small' });
        celebratedRef.current = true;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function runChip(chip: ToolChip) {
    if (!board || busyChip) return;
    setBusyChip(chip.label);
    setError(null);
    try {
      const patch = await editIdeaElement(board, 'summary', board.ideaSummary, chip.prompt);
      setBoard(applyElementPatch(board, 'summary', null, patch));
      celebrate({ intensity: 'small' });
    } catch {
      setError("Couldn't do that one just now — try again, or tap a card on the board to reshape it.");
    } finally {
      setBusyChip(null);
    }
  }

  return (
    <section id="try-it" className="px-5 py-6 scroll-mt-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accent.accent }}>Try it now</span>
        <span className="tp-ink-3">·</span>
        <span className="text-[10px] tp-ink-3">No sign-up needed</span>
      </div>
      <h2 className="text-lg font-extrabold tp-ink tracking-tight mb-3">What's your idea?</h2>

      {/* ── Idea input ────────────────────────────────────────────────────────── */}
      <ToolCard>
        <ToolInput
          accent={accent}
          multiline
          data-testid="idea-input"
          value={idea}
          onChange={e => setIdea(e.target.value.slice(0, 400))}
          rows={3}
          placeholder="e.g. An app that helps dog owners find last-minute sitters nearby…"
        />

        <p className="text-[11px] tp-ink-3 mt-3 mb-1.5">What do you want from it?</p>
        <div className="flex flex-wrap gap-2">
          {IDEA_INTENTS.map(it => (
            <Chip
              key={it.id}
              accent={accent}
              active={intentId === it.id}
              onClick={() => setIntentId(it.id)}
              testId={`idea-intent-${it.id}`}
            >
              {it.emoji} {it.label}
            </Chip>
          ))}
        </div>

        {error && <p data-testid="idea-error" className="text-xs text-red-600 mt-3">{error}</p>}

        {generating ? (
          <div className="mt-3.5">
            <ToolProgress
              stageEvents={stageEvents}
              accent={accent}
              heading="Toolie is thinking"
              fallback="Mapping your idea…"
              labelFor={stageLabel}
            />
          </div>
        ) : (
          <ToolButton
            shape="block"
            full
            onClick={handleGenerate}
            disabled={!canGenerate}
            testId="idea-generate-btn"
            className="mt-3.5 font-bold"
          >
            ✨ Map my idea
          </ToolButton>
        )}
      </ToolCard>

      {/* ── Result ────────────────────────────────────────────────────────────── */}
      {board ? (
        <div className="mt-5" data-testid="idea-result">
          {/* Customize-with-Toolie chips — live, reshape the board's summary */}
          <ToolCard className="mb-4">
            <p className="text-[13px] font-bold tp-ink mb-0.5">💬 Make it yours — ask Toolie</p>
            <p className="text-[11px] tp-ink-3 mb-3">Tap one to reshape the idea — or tap any card on the board below.</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(chip => (
                <Chip
                  key={chip.label}
                  accent={accent}
                  active={busyChip === chip.label}
                  disabled={!!busyChip}
                  onClick={() => runChip(chip)}
                  testId={`customize-chip-${chip.label}`}
                >
                  {busyChip === chip.label ? '…thinking' : chip.label}
                </Chip>
              ))}
            </div>
          </ToolCard>

          <IdeaThinkingBoardRenderer content={board} onChange={setBoard} />

          {/* Gentle save nudge — using it is free, saving prompts an account */}
          <a
            href="/"
            data-testid="idea-save-cta"
            className="mt-4 flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5 active:scale-[0.99] transition-transform"
          >
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0" style={{ background: accent.accentSoft }}>💾</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tp-ink leading-tight">Want to keep this board?</p>
              <p className="text-xs tp-ink-2 mt-0.5">Create a free account to save it and come back anytime.</p>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: accent.accent }}>→</span>
          </a>
        </div>
      ) : (
        <p className="text-center text-xs tp-ink-3 mt-5 px-6">
          Describe your idea above and your visual plan — users, risks, money ideas and a health
          score — appears right here.
        </p>
      )}

      {/* ── Daily-limit notice ────────────────────────────────────────────────── */}
      {quotaNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={dismissQuotaNotice} />
          <div data-testid="quota-notice-modal" className="relative bg-white rounded-[24px] p-6 shadow-2xl max-w-xs w-full text-center">
            <div className="text-4xl mb-2">⏳</div>
            <h3 className="font-extrabold tp-ink text-base mb-1">That's all for today</h3>
            <p className="text-sm tp-ink-2 mb-5">
              You can make more {formatResetHint(quotaNotice.resetsAt)}.
              {quotaNotice.tier === 'anonymous' && ' Sign in for a higher daily limit.'}
            </p>
            <ToolButton shape="block" full onClick={dismissQuotaNotice} className="font-bold">Got it</ToolButton>
          </div>
        </div>
      )}
    </section>
  );
}
