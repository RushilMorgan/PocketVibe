import React, { useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePocketVibe } from '../../hooks/usePocketVibe';
import { RecipeRenderer } from '../templates/RecipeRenderer';
import { templateCssVars } from '../../lib/templateIdentity';
import { celebrate } from '../../lib/celebrate';
import { formatResetHint } from '../../lib/quotaMessage';
import type { RecipeContent } from '../../types';
import type { ToolChip } from '../../lib/toolPages';

/** A real, well-known cooking video — pre-filled so the page is never a blank box. */
const SAMPLE_URL = 'https://www.youtube.com/watch?v=PUP7U5vTMM0';

interface RecipeExtractorToolProps {
  /** Example "ask Toolie" prompts shown under the result. */
  chips: ToolChip[];
}

/**
 * The live, anonymous Recipe Extractor. Reuses the deployed `extractRecipe` /
 * `chatAboutRecipe` generation paths via usePocketVibe, and the full
 * RecipeRenderer (ingredient checklist, steps, shopping list, Ask-Toolie sheet)
 * to display + customize the result. No sign-in required to extract.
 */
export function RecipeExtractorTool({ chips }: RecipeExtractorToolProps) {
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
    <section id="try-it" className="px-4 py-6 bg-gray-50 scroll-mt-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">Try it now</span>
        <span className="text-rose-300">·</span>
        <span className="text-[10px] text-gray-400">No sign-up needed</span>
      </div>
      <h2 className="text-lg font-black text-gray-900 mb-3">Paste a recipe to extract</h2>

      {/* ── Extract input ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4">
        <input
          data-testid="extract-url-input"
          value={url}
          onChange={e => setUrl(e.target.value)}
          inputMode="url"
          placeholder="Paste a cooking video link…"
          className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
        />

        <div className="flex items-center justify-between mt-2">
          <button
            data-testid="extract-sample-btn"
            onClick={() => { setUrl(SAMPLE_URL); setShowManual(false); setManualText(''); setError(null); }}
            className="text-xs text-rose-600 font-semibold active:opacity-70"
          >
            ✨ Try a sample video
          </button>
          <button
            onClick={() => setShowManual(s => !s)}
            className="text-xs text-gray-400 font-semibold active:opacity-70"
          >
            {showManual ? '− Hide text paste' : '✎ Paste recipe text'}
          </button>
        </div>

        {showManual && (
          <textarea
            data-testid="extract-manual-input"
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            rows={4}
            placeholder="Paste the recipe text here…"
            className="mt-2 w-full text-sm border border-rose-200 rounded-xl px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
        )}

        {error && <p data-testid="extract-error" className="text-xs text-red-600 mt-2">{error}</p>}

        <button
          data-testid="extract-btn"
          onClick={handleExtract}
          disabled={!canExtract}
          className="mt-3 w-full py-3 rounded-xl bg-rose-500 text-white text-sm font-black active:bg-rose-600 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {extracting
            ? <><span className="animate-pulse">🍳</span> Reading the recipe…</>
            : <>✨ Extract recipe</>}
        </button>
      </div>

      {/* ── Result ────────────────────────────────────────────────────────────── */}
      {recipe ? (
        <div className="mt-5" data-testid="extract-result" style={templateCssVars('recipe')}>
          {/* Customize-with-Toolie chips — live, operate on the result above/below */}
          <div className="bg-gray-950 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-white mb-0.5">💬 Make it yours — ask Toolie</p>
            <p className="text-[11px] text-white/45 mb-3">Tap one and watch the recipe update. You can undo by extracting again.</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(chip => (
                <button
                  key={chip.label}
                  data-testid={`customize-chip-${chip.label}`}
                  onClick={() => runChip(chip)}
                  disabled={!!busyChip}
                  className="text-xs font-semibold text-rose-200 bg-rose-400/10 border border-rose-400/25 px-3 py-1.5 rounded-full active:bg-rose-400/20 disabled:opacity-40"
                >
                  {busyChip === chip.label ? '…thinking' : chip.label}
                </button>
              ))}
            </div>
          </div>

          <RecipeRenderer
            content={recipe}
            onChange={setRecipe}
            onChat={(msg) => chatAboutRecipe(recipe, msg)}
          />

          {/* Gentle save nudge — extracting is free, saving prompts an account */}
          <a
            href="/"
            data-testid="extract-save-cta"
            className="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-100 active:bg-rose-100"
          >
            <span className="text-xl flex-shrink-0">📖</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-rose-900 leading-tight">Love it? Save to your cookbook</p>
              <p className="text-xs text-rose-700/70 mt-0.5">Create a free account to keep it on any device.</p>
            </div>
            <span className="text-rose-400 text-sm flex-shrink-0">→</span>
          </a>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-400 mt-5 px-6">
          Paste a link above (or tap <span className="font-semibold text-rose-500">Try a sample video</span>) and your
          editable recipe appears right here.
        </p>
      )}

      {/* ── Daily-limit notice ────────────────────────────────────────────────── */}
      {quotaNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismissQuotaNotice} />
          <div data-testid="quota-notice-modal" className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full text-center">
            <div className="text-4xl mb-2">⏳</div>
            <h3 className="font-bold text-gray-900 text-base mb-1">That's all for today</h3>
            <p className="text-sm text-gray-500 mb-5">
              You can extract more {formatResetHint(quotaNotice.resetsAt)}.
              {quotaNotice.tier === 'anonymous' && ' Sign in for a higher daily limit.'}
            </p>
            <button
              onClick={dismissQuotaNotice}
              className="w-full py-3 rounded-xl bg-rose-500 text-white text-sm font-bold active:bg-rose-600"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
