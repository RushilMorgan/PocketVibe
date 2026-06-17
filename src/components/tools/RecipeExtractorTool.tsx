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
import {
  startRecipeJob,
  getRecipeJob,
  loadPendingRecipeJob,
  clearPendingRecipeJob,
  type PendingRecipeJob,
} from '../../lib/recipeJob';
import { getExistingPushEndpoint } from '../../lib/push';
import {
  trackRecipeExtractionStarted,
  trackRecipeExtractionResumed,
  type RecipeExtractionSource,
} from '../../lib/analytics';

/** Give up on a job that never resolves (well past the server's own ceiling). */
const MAX_JOB_MS = 240_000;

/**
 * How long a left-behind job is worth resuming on return. Inside this window we
 * pick the job back up (a finished one shows its recipe; one still cooking keeps
 * polling). Past it, a stale handle is cleared silently rather than greeting a
 * returning visitor with an old "couldn't finish" / "took too long" error.
 */
const RESUME_WINDOW_MS = 30 * 60_000;

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
  const { saveExtractedRecipe, chatAboutRecipe, quotaNotice, dismissQuotaNotice } = usePocketVibe(auth.user?.id);

  const [url, setUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [stageEvents, setStageEvents] = useState<GenerationStageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeContent | null>(null);
  const [busyChip, setBusyChip] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [cookbookName, setCookbookName] = useState('');
  const celebratedRef = useRef(false);

  function confirmSave() {
    if (!recipe) return;
    saveExtractedRecipe(recipe, cookbookName);
    window.location.href = '/';
  }

  const canExtract = !extracting && (url.trim().length > 0 || manualText.trim().length > 0);

  // ── Background extraction (server-side job) ─────────────────────────────────
  // The work runs on the server, not in this tab, so the user can leave and come
  // back to a finished recipe (and get a push). We just poll the job here.
  const pollRef = useRef<number | null>(null);
  function stopPolling() {
    if (pollRef.current !== null) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => () => stopPolling(), []);

  function finishWithError(msg: string) {
    stopPolling();
    clearPendingRecipeJob();
    setExtracting(false);
    setError(msg);
  }

  // Check a job once. Returns true when it has resolved (done or error).
  async function pollOnce(job: PendingRecipeJob): Promise<boolean> {
    const timedOut = Date.now() - job.startedAt > MAX_JOB_MS;
    const state = await getRecipeJob(job.jobId, job.token);
    if (!state) {
      // Transient fetch miss — keep waiting unless we've waited far too long.
      if (timedOut) { finishWithError('This took too long — please try again.'); return true; }
      return false;
    }
    if (state.status === 'running') {
      if (timedOut) { finishWithError('This took too long — please try again.'); return true; }
      return false;
    }
    if (state.status === 'done' && state.recipe) {
      stopPolling();
      clearPendingRecipeJob();
      setRecipe(state.recipe);
      setExtracting(false);
      if (!celebratedRef.current) { celebrate({ intensity: 'small' }); celebratedRef.current = true; }
      return true;
    }
    finishWithError(
      state.error === 'quota'
        ? "You've hit today's limit — please try again later."
        : "Couldn't read that one — try another link, or paste the recipe text instead.",
    );
    return true;
  }

  function startPolling(job: PendingRecipeJob) {
    stopPolling();
    setExtracting(true);
    void (async () => {
      if (await pollOnce(job)) return;
      pollRef.current = window.setInterval(async () => {
        if (await pollOnce(job)) stopPolling();
      }, 2500);
    })();
  }

  async function beginExtraction(youtubeUrl: string, manual: string, source: RecipeExtractionSource) {
    if (extracting) return;
    setError(null);
    setRecipe(null);
    setExtracting(true);
    trackRecipeExtractionStarted(source);
    // Anonymous users are notified by their device endpoint; signed-in users by
    // their user id (resolved server-side at completion).
    const notifyEndpoint = auth.user ? null : await getExistingPushEndpoint();
    const job = await startRecipeJob(
      { youtubeUrl, manualText: manual },
      { userId: auth.user?.id ?? null, notifyEndpoint, source },
    );
    if (!job) {
      setExtracting(false);
      setError('Something went wrong starting that. Please try again.');
      return;
    }
    startPolling(job);
  }

  function handleExtract() {
    if (!canExtract) return;
    const source: RecipeExtractionSource = url.trim() === SAMPLE_URL ? 'sample' : 'paste';
    void beginExtraction(url.trim(), manualText.trim(), source);
  }

  // On mount: either auto-run a shared link (/share → ?shared=), or resume a
  // job already in flight (the user left and came back, or tapped the push).
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const shared = new URLSearchParams(window.location.search).get('shared');
    if (shared && shared.trim()) {
      setUrl(shared.trim());
      void beginExtraction(shared.trim(), '', 'shared');
      return;
    }
    const pending = loadPendingRecipeJob();
    if (pending) {
      if (Date.now() - pending.startedAt > RESUME_WINDOW_MS) {
        // Ancient handle — don't resurface an old error/recipe on a fresh visit.
        clearPendingRecipeJob();
      } else {
        if (pending.label) setUrl(pending.label);
        trackRecipeExtractionResumed();
        startPolling(pending);
      }
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
    <section id="try-it" className="px-5 pt-2 pb-6 scroll-mt-4">
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

        {/* Sample video — prominent secondary button so it gets seen and tapped */}
        <button
          data-testid="extract-sample-btn"
          onClick={() => { setUrl(SAMPLE_URL); setShowManual(false); setManualText(''); setError(null); }}
          className="mt-2.5 w-full py-2.5 rounded-2xl text-[14px] font-bold text-center active:scale-[0.98] transition-transform border-2"
          style={{ borderColor: accent.accent, color: accent.accent }}
        >
          ✨ Try a sample video
        </button>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] tp-ink-3">No sign-up needed</span>
          <button onClick={() => setShowManual(s => !s)} className="text-[12px] font-semibold tp-ink-3 active:opacity-70">
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
              fallback="Pulling your recipe together — you can close this and carry on; we’ll have it waiting (and ping you) when it’s done."
              labelFor={ev => recipeStageLabel(ev, true)}
            />
            {/* Surface the push opt-in here so leaving actually gets you a ping */}
            <PushNudge userId={auth.user?.id} accentColor={accent.accent} />
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


          {/* Save into a named cookbook (recipe_book) so My Things opens the
              cookbook — where you can add more recipes — not a locked single
              recipe. Signed-in users get cloud backup on next load. */}
          <button
            type="button"
            data-testid="extract-save-cta"
            onClick={() => { if (recipe) { setCookbookName(''); setShowSave(true); } }}
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

      {/* ── Name-your-cookbook step (before saving) ───────────────────────────── */}
      {showSave && recipe && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSave(false)} />
          <div className="relative bg-white rounded-[24px] p-6 shadow-2xl max-w-xs w-full">
            <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl mb-3" style={{ background: accent.accentSoft }}>📖</div>
            <h3 className="font-extrabold tp-ink text-base mb-1">Name your cookbook</h3>
            <p className="text-sm tp-ink-2 mb-4 leading-snug">
              We'll save <span className="font-semibold tp-ink">“{recipe.title}”</span> into a cookbook — then you can paste more links to add recipes to it.
            </p>
            <input
              autoFocus
              data-testid="tool-cookbook-name"
              value={cookbookName}
              onChange={e => setCookbookName(e.target.value.slice(0, 100))}
              onKeyDown={e => { if (e.key === 'Enter') confirmSave(); }}
              placeholder="My Cookbook"
              className="tp-input w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 mb-3"
              style={{ ['--tw-ring-color' as string]: accent.accent }}
            />
            <ToolButton shape="block" full onClick={confirmSave} testId="tool-cookbook-save" className="font-bold">
              ✨ Save to cookbook
            </ToolButton>
            <button onClick={() => setShowSave(false)} className="w-full mt-2 text-xs font-semibold tp-ink-3 py-2 active:opacity-70">
              Maybe later
            </button>
          </div>
        </div>
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
