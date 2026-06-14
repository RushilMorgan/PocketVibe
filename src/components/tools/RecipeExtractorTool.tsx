import React, { useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePocketVibe } from '../../hooks/usePocketVibe';
import { RecipeRenderer } from '../templates/RecipeRenderer';
import { templateCssVars } from '../../lib/templateIdentity';
import { celebrate } from '../../lib/celebrate';
import { formatResetHint } from '../../lib/quotaMessage';
import type { RecipeContent } from '../../types';
import type { ToolChip } from '../../lib/toolPages';
import type { ToolAccent } from '../ToolPage';

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
 * RecipeRenderer to display + customize the result. No sign-in required to
 * extract. Velix-style light/frosted chrome (see the .tp-* layer in index.css).
 */
export function RecipeExtractorTool({ chips, accent }: RecipeExtractorToolProps) {
  const auth = useAuth();
  const { extractRecipe, chatAboutRecipe, quotaNotice, dismissQuotaNotice } = usePocketVibe(auth.user?.id);

  const [url, setUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeContent | null>(null);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const celebratedRef = useRef(false);

  const canExtract = !extracting && (url.trim().length > 0 || manualText.trim().length > 0);

  async function handleExtract() {
    if (!canExtract) return;
    setExtracting(true);
    setError(null);
    try {
      const result = await extractRecipe({ youtubeUrl: url.trim(), manualText: manualText.trim() });
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
      <div className="tp-card rounded-[24px] p-[18px]">
        <input
          data-testid="extract-url-input"
          value={url}
          onChange={e => setUrl(e.target.value)}
          inputMode="url"
          placeholder="Paste a cooking video link…"
          className="tp-input w-full text-sm rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2"
          style={{ ['--tw-ring-color' as string]: accent.accent }}
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
          <textarea
            data-testid="extract-manual-input"
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            rows={4}
            placeholder="Paste the recipe text here…"
            className="tp-input mt-2.5 w-full text-sm rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: accent.accent }}
          />
        )}

        {error && <p data-testid="extract-error" className="text-xs text-red-600 mt-2.5">{error}</p>}

        <button
          data-testid="extract-btn"
          onClick={handleExtract}
          disabled={!canExtract}
          className="tp-btn-dark mt-3.5 w-full py-3.5 rounded-2xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {extracting ? <><span className="animate-pulse">🍳</span> Reading the recipe…</> : <>✨ Extract recipe</>}
        </button>
      </div>

      {/* ── Result ────────────────────────────────────────────────────────────── */}
      {recipe ? (
        <div className="mt-5" data-testid="extract-result" style={templateCssVars('recipe')}>
          {/* Customize-with-Toolie chips — live, operate on the result */}
          <div className="tp-card rounded-[22px] p-4 mb-4">
            <p className="text-[13px] font-bold tp-ink mb-0.5">💬 Make it yours — ask Toolie</p>
            <p className="text-[11px] tp-ink-3 mb-3">Tap one and watch the recipe update. Re-extract to undo.</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(chip => {
                const busy = busyChip === chip.label;
                return (
                  <button
                    key={chip.label}
                    data-testid={`customize-chip-${chip.label}`}
                    onClick={() => runChip(chip)}
                    disabled={!!busyChip}
                    className="text-[13px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-40 transition-colors"
                    style={busy
                      ? { background: '#16150f', color: '#fff' }
                      : { background: accent.accentSoft, color: accent.accent }}
                  >
                    {busy ? '…thinking' : chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <RecipeRenderer
            content={recipe}
            onChange={setRecipe}
            onChat={(msg) => chatAboutRecipe(recipe, msg)}
            frosted
          />

          {/* Gentle save nudge — extracting is free, saving prompts an account */}
          <a
            href="/"
            data-testid="extract-save-cta"
            className="mt-4 flex items-center gap-3 tp-card rounded-[20px] px-4 py-3.5 active:scale-[0.99] transition-transform"
          >
            <span className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xl flex-shrink-0" style={{ background: accent.accentSoft }}>📖</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tp-ink leading-tight">Love it? Save to your cookbook</p>
              <p className="text-xs tp-ink-2 mt-0.5">Create a free account to keep it on any device.</p>
            </div>
            <span className="text-sm flex-shrink-0" style={{ color: accent.accent }}>→</span>
          </a>
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
            <button onClick={dismissQuotaNotice} className="tp-btn-dark w-full py-3 rounded-2xl text-sm font-bold">
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
