import React, { useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePocketVibe } from '../../hooks/usePocketVibe';
import { MealPlannerRenderer } from '../templates/MealPlannerRenderer';
import { templateCssVars } from '../../lib/templateIdentity';
import { celebrate } from '../../lib/celebrate';
import { formatResetHint } from '../../lib/quotaMessage';
import type { MealPlannerContent } from '../../types';
import type { ToolChip, ToolAccent } from '../../lib/toolPages';
import { ToolCard, ToolButton, ToolChip as Chip, ToolInput } from './ui';

const DIETARY = ['none', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;

interface MealPlannerToolProps {
  /** Example "ask Toolie" prompts shown under the result. */
  chips: ToolChip[];
  /** Per-type accent (Velix soft-accent treatment) from the tool-page shell. */
  accent: ToolAccent;
}

/**
 * The live, anonymous Meal Planner. Reuses the deployed `meal_planner`
 * generation (usePocketVibe.generateMealPlan) and MealPlannerRenderer. Meal
 * planner has no per-element edit, so customize chips run a whole-plan improve
 * (customizeMealPlan). No sign-in required. Composed from tools/ui.tsx primitives.
 */
export function MealPlannerTool({ chips, accent }: MealPlannerToolProps) {
  const auth = useAuth();
  const { generateMealPlan, customizeMealPlan, quotaNotice, dismissQuotaNotice } = usePocketVibe(auth.user?.id);

  const [request, setRequest] = useState('');
  const [dietary, setDietary] = useState<string>('none');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<MealPlannerContent | null>(null);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const celebratedRef = useRef(false);

  const canGenerate = !generating && request.trim().length > 2;

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateMealPlan({ request: request.trim(), dietary });
      if (!result) {
        setError("Couldn't plan that one — try adding a little more detail about who it's for.");
        return;
      }
      setPlan(result);
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
    if (!plan || busyChip) return;
    setBusyChip(chip.label);
    setError(null);
    try {
      const updated = await customizeMealPlan(plan, chip.prompt);
      if (updated) {
        setPlan(updated);
        celebrate({ intensity: 'small' });
      } else {
        setError("Couldn't do that one just now — try again, or edit the plan by hand.");
      }
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
      <h2 className="text-lg font-extrabold tp-ink tracking-tight mb-3">Plan your week</h2>

      {/* ── Input ─────────────────────────────────────────────────────────────── */}
      <ToolCard>
        <ToolInput
          accent={accent}
          multiline
          data-testid="meal-input"
          value={request}
          onChange={e => setRequest(e.target.value.slice(0, 400))}
          rows={3}
          placeholder="e.g. 2 adults + a toddler, quick weeknight dinners, we love Thai and Italian…"
        />

        <p className="text-[11px] tp-ink-3 mt-3 mb-1.5">Any dietary preference?</p>
        <div className="flex flex-wrap gap-2">
          {DIETARY.map(d => (
            <Chip
              key={d}
              accent={accent}
              active={dietary === d}
              onClick={() => setDietary(d)}
              testId={`meal-dietary-${d}`}
            >
              {d === 'none' ? 'No preference' : d}
            </Chip>
          ))}
        </div>

        {error && <p data-testid="meal-error" className="text-xs text-red-600 mt-3">{error}</p>}

        <ToolButton
          shape="block"
          full
          onClick={handleGenerate}
          disabled={!canGenerate}
          testId="meal-generate-btn"
          className="mt-3.5 font-bold"
        >
          {generating ? <><span className="animate-pulse">🍽️</span> Planning your week…</> : <>✨ Plan my week</>}
        </ToolButton>
      </ToolCard>

      {/* ── Result ────────────────────────────────────────────────────────────── */}
      {plan ? (
        <div className="mt-5" data-testid="meal-result" style={templateCssVars('meal_planner')}>
          {/* Customize-with-Toolie chips — live, reshape the whole week */}
          <ToolCard className="mb-4">
            <p className="text-[13px] font-bold tp-ink mb-0.5">💬 Make it yours — ask Toolie</p>
            <p className="text-[11px] tp-ink-3 mb-3">Tap one to reshape the whole week — or edit any meal by hand below.</p>
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

          <MealPlannerRenderer content={plan} onChange={setPlan} />

          {/* Gentle save nudge — using it is free, saving prompts an account */}
          <a
            href="/"
            data-testid="meal-save-cta"
            className="mt-4 flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5 active:scale-[0.99] transition-transform"
          >
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0" style={{ background: accent.accentSoft }}>💾</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tp-ink leading-tight">Keep this week's plan</p>
              <p className="text-xs tp-ink-2 mt-0.5">Create a free account to save it and the grocery list.</p>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: accent.accent }}>→</span>
          </a>
        </div>
      ) : (
        <p className="text-center text-xs tp-ink-3 mt-5 px-6">
          Describe who's eating above and your 7-day plan and grocery list appear right here.
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
