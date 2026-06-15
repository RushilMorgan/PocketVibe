import React, { useRef, useState } from 'react';
import { templateCssVars } from '../../lib/templateIdentity';
import { celebrate } from '../../lib/celebrate';
import { stageLabel } from '../../services/aiService';
import type { CreationContent, CreationType, GenerationStageEvent } from '../../types';
import type { ToolChip, ToolAccent } from '../../lib/toolPages';
import { ToolCard, ToolButton, ToolChip as Chip, ToolInput, ToolQuotaNotice, ToolProgress } from './ui';
import { useToolGenerator } from './useToolGenerator';
import { BudgetCalculatorRenderer } from '../templates/BudgetCalculatorRenderer';
import { SavingsTrackerRenderer } from '../templates/SavingsTrackerRenderer';
import { WorkoutTrackerRenderer } from '../templates/WorkoutTrackerRenderer';
import { EventPlannerRenderer } from '../templates/EventPlannerRenderer';
import { PriceCalculatorRenderer } from '../templates/PriceCalculatorRenderer';

/** A renderer that takes the standard content-in / onChange-out contract. */
type ToolRenderer = React.ComponentType<{ content: CreationContent; onChange: (updated: CreationContent) => void }>;

/** Per-tool engine for the "text in → generate → improve" tool pages. */
export interface ToolEngine {
  forcedType: CreationType;
  Renderer: ToolRenderer;
  heading: string;
  placeholder: string;
  buildPrompt: (text: string) => string;
  generateLabel: string;
  generatingLabel: string;
  emptyHint: string;
  saveTitle: string;
  saveBody: string;
}

/**
 * One live component for every "simple" tool page (budget, savings, workout,
 * event, price): a text input → generate (useToolGenerator) → the type's
 * renderer (themed via templateCssVars) → whole-creation customize chips. Bespoke
 * tools (recipe, idea, meal) keep their own components.
 */
export function GenericTool({ engine, chips, accent }: { engine: ToolEngine; chips: ToolChip[]; accent: ToolAccent }) {
  const { generate, customize, quotaNotice, dismissQuotaNotice } = useToolGenerator();
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stageEvents, setStageEvents] = useState<GenerationStageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<CreationContent | null>(null);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const celebratedRef = useRef(false);

  const canGenerate = !generating && text.trim().length > 2;

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setStageEvents([]);
    setError(null);
    try {
      const result = await generate(
        engine.forcedType,
        engine.buildPrompt(text.trim()),
        ev => setStageEvents(prev => [...prev, ev]),
      );
      if (!result) {
        setError("Couldn't make that one — try adding a little more detail.");
        return;
      }
      setContent(result);
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
    if (!content || busyChip) return;
    setBusyChip(chip.label);
    setError(null);
    try {
      const updated = await customize(engine.forcedType, content, engine.heading, chip.prompt);
      if (updated) {
        setContent(updated);
        celebrate({ intensity: 'small' });
      } else {
        setError("Couldn't do that one just now — try again, or edit by hand.");
      }
    } finally {
      setBusyChip(null);
    }
  }

  const Renderer = engine.Renderer;

  return (
    <section id="try-it" className="px-5 py-6 scroll-mt-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accent.accent }}>Try it now</span>
        <span className="tp-ink-3">·</span>
        <span className="text-[10px] tp-ink-3">No sign-up needed</span>
      </div>
      <h2 className="text-lg font-extrabold tp-ink tracking-tight mb-3">{engine.heading}</h2>

      <ToolCard>
        <ToolInput
          accent={accent}
          multiline
          data-testid="tool-input"
          value={text}
          onChange={e => setText(e.target.value.slice(0, 400))}
          rows={3}
          placeholder={engine.placeholder}
        />

        {error && <p data-testid="tool-error" className="text-xs text-red-600 mt-3">{error}</p>}

        {generating ? (
          <div className="mt-3.5">
            <ToolProgress
              stageEvents={stageEvents}
              accent={accent}
              heading="Toolie is on it"
              fallback={engine.generatingLabel}
              labelFor={stageLabel}
            />
          </div>
        ) : (
          <ToolButton
            shape="block"
            full
            onClick={handleGenerate}
            disabled={!canGenerate}
            testId="tool-generate-btn"
            className="mt-3.5 font-bold"
          >
            {engine.generateLabel}
          </ToolButton>
        )}
      </ToolCard>

      {content ? (
        <div className="mt-5" data-testid="tool-result" style={templateCssVars(engine.forcedType)}>
          <ToolCard className="mb-4">
            <p className="text-[13px] font-bold tp-ink mb-0.5">💬 Make it yours — ask Toolie</p>
            <p className="text-[11px] tp-ink-3 mb-3">Tap one to reshape it — or edit any field by hand below.</p>
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

          <Renderer content={content} onChange={setContent} />

          <a
            href="/"
            data-testid="tool-save-cta"
            className="mt-4 flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5 active:scale-[0.99] transition-transform"
          >
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0" style={{ background: accent.accentSoft }}>💾</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tp-ink leading-tight">{engine.saveTitle}</p>
              <p className="text-xs tp-ink-2 mt-0.5">{engine.saveBody}</p>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: accent.accent }}>→</span>
          </a>
        </div>
      ) : (
        <p className="text-center text-xs tp-ink-3 mt-5 px-6">{engine.emptyHint}</p>
      )}

      <ToolQuotaNotice notice={quotaNotice} onDismiss={dismissQuotaNotice} />
    </section>
  );
}

// ── Per-tool engines ──────────────────────────────────────────────────────────

const R = (c: unknown) => c as ToolRenderer;

export const TOOL_ENGINES: Record<string, ToolEngine> = {
  budget: {
    forcedType: 'budget_calculator',
    Renderer: R(BudgetCalculatorRenderer),
    heading: 'Build your budget',
    placeholder: 'e.g. I take home £2,400/month. Rent £950, groceries ~£300, transport £120, plus subscriptions…',
    buildPrompt: t => `Make a simple, realistic monthly budget from this: "${t}". List income and expense lines each with an amount, infer a sensible currency, and add a short note with one tip.`,
    generateLabel: '✨ Build my budget',
    generatingLabel: '💰 Crunching the numbers…',
    emptyHint: 'Describe your income and main expenses above and your budget appears right here.',
    saveTitle: 'Keep this budget',
    saveBody: 'Create a free account to save it and track it over time.',
  },
  savings: {
    forcedType: 'savings_tracker',
    Renderer: R(SavingsTrackerRenderer),
    heading: "What are you saving for?",
    placeholder: 'e.g. Save £3,000 for a trip to Japan by next December…',
    buildPrompt: t => `Make a savings tracker for this goal: "${t}". Set a clear goalName, a sensible targetAmount and currency, an optional deadline, start currentAmount at 0 with an empty contributions list.`,
    generateLabel: '✨ Set up my goal',
    generatingLabel: '🎯 Setting your goal…',
    emptyHint: 'Describe your savings goal above and your tracker appears right here.',
    saveTitle: 'Keep this goal',
    saveBody: 'Create a free account to save it and log your progress.',
  },
  workout: {
    forcedType: 'workout_tracker',
    Renderer: R(WorkoutTrackerRenderer),
    heading: 'Plan your workouts',
    placeholder: 'e.g. Get stronger, 3 days a week, dumbbells at home, beginner…',
    buildPrompt: t => `Make a personal weekly workout PLAN (not a shared challenge) from this: "${t}". Set challengeMode to false, give it a planName, and a realistic weekly structure for their level and equipment.`,
    generateLabel: '✨ Build my plan',
    generatingLabel: '💪 Building your plan…',
    emptyHint: 'Describe your goal, days and equipment above and your plan appears right here.',
    saveTitle: 'Keep this plan',
    saveBody: 'Create a free account to save it and log your sessions.',
  },
  'event-planner': {
    forcedType: 'event_planner',
    Renderer: R(EventPlannerRenderer),
    heading: 'Plan your event',
    placeholder: "e.g. A 6th birthday party for 15 kids at home, three weeks from now…",
    buildPrompt: t => `Make an event plan from this: "${t}". Set an eventName, an optional eventDate and guestCount, and a clear checklist of tasks to get everything ready in good time.`,
    generateLabel: '✨ Plan my event',
    generatingLabel: '🎉 Planning your event…',
    emptyHint: 'Describe your event above and your plan and checklist appear right here.',
    saveTitle: 'Keep this plan',
    saveBody: 'Create a free account to save it and tick tasks off.',
  },
  price: {
    forcedType: 'price_calculator',
    Renderer: R(PriceCalculatorRenderer),
    heading: 'Price your work',
    placeholder: 'e.g. I do garden clearance — call-out, labour per hour, green-waste disposal…',
    buildPrompt: t => `Make a price/quote calculator from this: "${t}". Give it a title, infer a sensible currency, list the line items each with an amount, and an optional tax rate.`,
    generateLabel: '✨ Build my quote',
    generatingLabel: '🧮 Working out the price…',
    emptyHint: 'Describe what you charge for above and your quote calculator appears right here.',
    saveTitle: 'Keep this calculator',
    saveBody: 'Create a free account to save it and reuse it for every quote.',
  },
};
