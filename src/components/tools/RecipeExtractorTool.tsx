import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePocketVibe } from '../../hooks/usePocketVibe';
import { RecipeRenderer } from '../templates/RecipeRenderer';
import { templateCssVars } from '../../lib/templateIdentity';
import { recipeStageLabel } from '../../lib/recipeStages';
import { celebrate } from '../../lib/celebrate';
import { formatResetHint } from '../../lib/quotaMessage';
import type { RecipeContent, GenerationStageEvent } from '../../types';
import type { ToolChip, ToolAccent } from '../../lib/toolPages';
import { ToolCard, ToolButton, ToolChip as Chip, ToolInput, ToolProgress } from './ui';
import { PushNudge } from '../PushNudge';

/** A real, well-known cooking video — pre-filled so the page is never a blank box. */
const SAMPLE_URL = 'https://www.youtube.com/watch?v=PUP7U5vTMM0';

interface RecipeExtractorToolProps {
  /** Example "ask Toolie" prompts shown under the result. */
  chips: ToolChip[];
  /** Per-type accent (Velix soft-accent treatment) from the tool-page shell. */
  accent: ToolAccent;
}

/**
 * The live, anonymous Recipe Extractor. Reuses the deployed `extractRecipe` /
 * `chatAboutRecipe` generation paths via usePocketVibe, and the full
 * RecipeRenderer (in `frosted` mode) to display + customize the result. No
 * sign-in required to extract. Composed from the tools/ui.tsx primitives.
 */
export function RecipeExtractorTool({ chips, accent }: RecipeExtractorToolProps) {
  const auth = useAuth();
  const { extractRecipe, saveExtractedRecipe, chatAboutRecipe, quotaNotice, dismissQuotaNotice } = usePocketVibe(auth.user?.id);

  const [url, setUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [stageEvents, setStageEvents] = useState<GenerationStageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeContent | null>(null);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const celebratedRef = useRef(false);

  const canExtract = !extracting && (url.trim().length > 0 || manualText.trim().length > 0);

  // Core extraction, callable with explicit values (used both by the button and
  // by the shared-link auto-run below, where React state hasn't flushed yet).
  async function extractWith(youtubeUrl: string, manual: string) {
    if (extracting) return;
    setExtracting(true);
    setStageEvents([]);
    setError(null);
    try {
      const result = await extractRecipe(
        { youtubeUrl, manualText: manual },
        ev => setStageEvents(prev => [...prev, ev]),
      );
      if (!result) {
        setError("Couldn't read that one — try another link, or paste the recipe text instead.");
        return;
      }
      setRecipe(result);
      if (!celebratedRef.current) {
        celebrate({ intensity: 'small' });
        celebratedRef.current = true;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setExtracting(false);
    }
  }

  function handleExtract() {
    if (!canExtract) return;
    void extractWith(url.trim(), manualText.trim());
  }

  // Shared-link auto-run: when reached from the share sheet (/share → here with
  // ?shared=<link>), prefill the URL and extract immediately so the user lands
  // straight in the "kitchen theater" without a second tap.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    const shared = new URLSearchParams(window.location.search).get('shared');
    if (shared && shared.trim()) {
      autoRanRef.current = true;
      setUrl(shared.trim());
      void extractWith(shared.trim(), '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runChip(chip: ToolChip) {
    if (!recipe || busyChip) return;
    setBusyChip(chip.label);
    try {
      const { updatedRecipe } = await chatAboutRecipe(recipe, chip.prompt);
      if (updatedRecipe) {
        setRecipe(updatedRecipe);
        celebrate({ intensity: 'small' });
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
      <h2 className="text-lg font-extrabold tp-ink tracking-tight mb-3">Paste a recipe to extract</h2>

      {/* ── Extract input ─────────────────────────────────────────────────────── */}
      <ToolCard>
        <ToolInput
          accent={accent}
          data-testid="extract-url-input"
          value={url}
          onChange={e => setUrl(e.target.value)}
          inputMode="url"
          placeholder="Paste a cooking video link…"
        />

        <div className="flex items-center justify-between mt-2.5">
          <button
            data-testid="extract-sample-btn"
            onClick={() => { setUrl(SAMPLE_URL); setShowManual(false); setManualText(''); setError(null); }}
            className="text-[13px] font-semibold active:opacity-70"
            style={{ color: accent.accent }}
          >
            ✨ Try a sample video
          </button>
          <button onClick={() => setShowManual(s => !s)} className="text-[13px] font-semibold tp-ink-3 active:opacity-70">
            {showManual ? '− Hide text' : '✎ Paste text'}
          </button>
        </div>

        {showManual && (
          <ToolInput
            accent={accent}
            multiline
            data-testid="extract-manual-input"
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            rows={4}
            placeholder="Paste the recipe text here…"
            className="mt-2.5"
          />
        )}

        {error && <p data-testid="extract-error" className="text-xs text-red-600 mt-2.5">{error}</p>}

        {extracting ? (
          <div className="mt-3.5">
            <ToolProgress
              stageEvents={stageEvents}
              accent={accent}
              heading="Toolie is in the kitchen"
              fallback={url.trim().length > 0 ? 'Pulling the recipe out of your video…' : 'Pulling your recipe together…'}
              labelFor={ev => recipeStageLabel(ev, url.trim().length > 0)}
            />
          </div>
        ) : (
          <ToolButton
            shape="block"
            full
            onClick={handleExtract}
            disabled={!canExtract}
            testId="extract-btn"
            className="mt-3.5 font-bold"
          >
            ✨ Extract recipe
          </ToolButton>
        )}
      </ToolCard>

      {/* ── Result ────────────────────────────────────────────────────────────── */}
      {recipe ? (
        <div className="mt-5" data-testid="extract-result" style={templateCssVars('recipe')}>
          {/* Customize-with-Toolie chips — live, operate on the result */}
          <ToolCard className="mb-4">
            <p className="text-[13px] font-bold tp-ink mb-0.5">💬 Make it yours — ask Toolie</p>
            <p className="text-[11px] tp-ink-3 mb-3">Tap one and watch the recipe update. Re-extract to undo.</p>
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

          <RecipeRenderer
            content={recipe}
            onChange={setRecipe}
            onChat={(msg) => chatAboutRecipe(recipe, msg)}
            frosted
          />

          {/* Opt-in push nudge — only after a successful extract (self-gating) */}
          <PushNudge userId={auth.user?.id} accentColor={accent.accent} />


          {/* Save the extracted recipe, then open it in the app. Signed-in users
              get cloud backup on next load; anonymous saves persist locally and
              the app's save-nudge then prompts an account. */}
          <button
            type="button"
            data-testid="extract-save-cta"
            onClick={() => {
              if (!recipe) return;
              saveExtractedRecipe(recipe);
              window.location.href = '/';
            }}
            className="mt-4 w-full text-left flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5 active:scale-[0.99] transition-transform"
          >
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0" style={{ background: accent.accentSoft }}>📖</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tp-ink leading-tight">
                {auth.user ? 'Save to your cookbook' : 'Love it? Save it'}
              </p>
              <p className="text-xs tp-ink-2 mt-0.5">
                {auth.user ? 'Keep it in My Things, synced to every device.' : 'We’ll keep it — sign in to sync it across devices.'}
              </p>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: accent.accent }}>→</span>
          </button>
        </div>
      ) : (
        <p className="text-center text-xs tp-ink-3 mt-5 px-6">
          Paste a link above (or tap <span className="font-semibold" style={{ color: accent.accent }}>Try a sample video</span>) and your
          editable recipe appears right here.
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
              You can extract more {formatResetHint(quotaNotice.resetsAt)}.
              {quotaNotice.tier === 'anonymous' && ' Sign in for a higher daily limit.'}
            </p>
            <ToolButton shape="block" full onClick={dismissQuotaNotice} className="font-bold">Got it</ToolButton>
          </div>
        </div>
      )}
    </section>
  );
}
