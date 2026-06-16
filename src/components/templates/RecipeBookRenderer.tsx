import React, { useState, useEffect, useRef } from 'react';
import type {
  RecipeBookContent,
  RecipeContent,
  RecipeBookPreferences,
  RecipeUnits,
  GenerationStageEvent,
} from '../../types';
import type { RecipeIntakeInput } from '../../lib/recipePrompt';
import { RecipeRenderer } from './RecipeRenderer';
import { RecipeExtractionTheater } from './RecipeExtractionTheater';
import { celebrate } from '../../lib/celebrate';
import { youtubeThumbnailUrl } from '../../lib/youtubeThumb';
import { dishEmoji } from '../../lib/recipeIcons';
import { VideoThumb } from '../shared/VideoThumb';
import { useAuth } from '../../hooks/useAuth';
import {
  startRecipeJob,
  getRecipeJob,
  loadPendingCookbookJob,
  clearPendingCookbookJob,
  type PendingRecipeJob,
} from '../../lib/recipeJob';
import { getExistingPushEndpoint } from '../../lib/push';

/** Keep polling a job this long before declaring it failed (server gives up sooner). */
const MAX_JOB_MS = 240_000;
/** Only resume a left-behind job within this window on a fresh mount. */
const RESUME_WINDOW_MS = 30 * 60_000;

interface RecipeBookRendererProps {
  content: RecipeBookContent;
  /** Stable creation id — keys the per-cookbook background job for resume. */
  cookbookId?: string;
  onChange: (updated: RecipeBookContent) => void;
  /** Pulls a recipe from a link/text (respecting preferences). Absent for viewers. */
  onExtractRecipe?: (input: RecipeIntakeInput, onStage?: (ev: GenerationStageEvent) => void) => Promise<RecipeContent | null>;
  /** Chat about one recipe (AI has that recipe's context). Absent for viewers. */
  onRecipeChat?: (recipe: RecipeContent, message: string) => Promise<{ answer?: string; updatedRecipe?: RecipeContent }>;
  /** Velix light/frosted card surface; default = legacy app look. */
  frosted?: boolean;
}

const DIETARY = ['none', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;

function recipeMeta(r: RecipeContent): string {
  return [
    r.servings != null ? `Serves ${r.servings}` : '',
    r.prepTime ? `Prep ${r.prepTime}` : '',
    r.cookTime ? `Cook ${r.cookTime}` : '',
    `${r.ingredients.length} ingredients`,
  ].filter(Boolean).join(' · ');
}

export function RecipeBookRenderer({ content, cookbookId, onChange, onExtractRecipe, onRecipeChat, frosted = false }: RecipeBookRendererProps) {
  const auth = useAuth();
  const cardP4 = frosted ? 'tp-card rounded-2xl p-4' : 'bg-white rounded-2xl border border-gray-100 p-4';
  const cardFlush = frosted ? 'tp-card rounded-2xl overflow-hidden' : 'bg-white rounded-2xl border border-gray-100 overflow-hidden';
  const ink = frosted ? 'tp-ink' : 'text-gray-900';
  const ink3 = frosted ? 'tp-ink-3' : 'text-gray-400';
  const [showPrefs, setShowPrefs] = useState(false);
  const [url, setUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [extracting, setExtracting] = useState(false);
  // Background jobs don't stream stages, so the theater shows its generic
  // "in the kitchen" state (empty timeline) — kept for the shimmer/animation.
  const [stageEvents] = useState<GenerationStageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const prefs = content.preferences;
  const update = (patch: Partial<RecipeBookContent>) => onChange({ ...content, ...patch });
  const updatePrefs = (patch: Partial<RecipeBookPreferences>) =>
    update({ preferences: { ...prefs, ...patch } });

  // Latest content for async appends — the poll callback closes over the content
  // at start time, but the user may have edited the cookbook meanwhile.
  const contentRef = useRef(content);
  contentRef.current = content;

  const canAdd = !!onExtractRecipe && !!cookbookId && (url.trim().length > 0 || manualText.trim().length > 0);

  // ── Background extraction (server-side job) ───────────────────────────────
  // The extraction runs on the server, not in this tab, so adding a recipe
  // survives backgrounding the app and never loses the recipe (or a credit) if
  // you step away — we poll the job, then append the finished recipe. The pasted
  // link is ground truth for the thumbnail (the AI's echoed sourceUrl often
  // mangles the video id).
  const pollRef = useRef<number | null>(null);
  function stopPolling() {
    if (pollRef.current !== null) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => () => stopPolling(), []);

  function appendRecipe(recipe: RecipeContent, pastedUrl: string) {
    const sourceUrl = pastedUrl || recipe.sourceUrl?.trim() || undefined;
    const enriched: RecipeContent = {
      ...recipe,
      sourceUrl,
      thumbnailUrl: (sourceUrl ? youtubeThumbnailUrl(sourceUrl) : null) ?? undefined,
    };
    const latest = contentRef.current;
    const firstRecipe = latest.recipes.length === 0;
    onChange({ ...latest, recipes: [enriched, ...latest.recipes] });
    celebrate(firstRecipe
      ? { intensity: 'big', message: 'First recipe in your cookbook! 🍳' }
      : { intensity: 'small' });
    setUrl('');
    setManualText('');
    setShowManual(false);
    setExpandedId(null);
  }

  function finishAddError(msg: string) {
    stopPolling();
    if (cookbookId) clearPendingCookbookJob(cookbookId);
    setExtracting(false);
    setError(msg);
  }

  async function pollOnce(job: PendingRecipeJob): Promise<boolean> {
    const timedOut = Date.now() - job.startedAt > MAX_JOB_MS;
    const state = await getRecipeJob(job.jobId, job.token);
    if (!state) {
      if (timedOut) { finishAddError('This took too long — please try again.'); return true; }
      return false;
    }
    if (state.status === 'running') {
      if (timedOut) { finishAddError('This took too long — please try again.'); return true; }
      return false;
    }
    if (state.status === 'done' && state.recipe) {
      stopPolling();
      if (cookbookId) clearPendingCookbookJob(cookbookId);
      appendRecipe(state.recipe, job.label ?? '');
      setExtracting(false);
      return true;
    }
    finishAddError(
      state.error === 'quota'
        ? "You've hit today's limit — please try again later."
        : "Couldn't read that one — try another link or paste the recipe text.",
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

  async function addRecipe() {
    if (!onExtractRecipe || !cookbookId || extracting) return;
    if (!url.trim() && !manualText.trim()) return;
    setError(null);
    setExtracting(true);
    const notifyEndpoint = auth.user ? null : await getExistingPushEndpoint();
    const job = await startRecipeJob(
      {
        youtubeUrl: url.trim(),
        manualText: manualText.trim(),
        servings: prefs.servings,
        dietary: prefs.dietary,
      },
      { userId: auth.user?.id ?? null, notifyEndpoint, source: 'paste', cookbookId },
    );
    if (!job) {
      setExtracting(false);
      setError('Something went wrong adding that recipe. Please try again.');
      return;
    }
    startPolling(job);
  }

  // Resume a left-behind add on a fresh mount (left the app and came back, or
  // the OS killed the PWA mid-extraction). A finished job appends its recipe; a
  // still-running one keeps polling; an ancient handle is cleared silently.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !cookbookId || !onExtractRecipe) return;
    resumedRef.current = true;
    const pending = loadPendingCookbookJob(cookbookId);
    if (!pending) return;
    if (Date.now() - pending.startedAt > RESUME_WINDOW_MS) {
      clearPendingCookbookJob(cookbookId);
      return;
    }
    startPolling(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookbookId]);

  function updateRecipeAt(index: number, updated: RecipeContent) {
    update({ recipes: content.recipes.map((r, i) => (i === index ? updated : r)) });
  }
  function removeRecipeAt(index: number) {
    update({ recipes: content.recipes.filter((_, i) => i !== index) });
    setExpandedId(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* ── Cookbook header + preferences ──────────────────────────────────── */}
      <div className={cardP4}>
        <div className="flex items-center justify-between gap-2">
          <input
            data-testid="cookbook-title-input"
            value={content.title}
            onChange={e => update({ title: e.target.value })}
            className={`flex-1 min-w-0 text-lg font-black bg-transparent focus:outline-none focus:bg-black/5 rounded px-1 -mx-1 ${ink}`}
          />
          <button
            data-testid="cookbook-prefs-toggle"
            onClick={() => setShowPrefs(s => !s)}
            className="flex-shrink-0 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full active:bg-rose-100"
          >
            {showPrefs ? 'Done' : 'Preferences'}
          </button>
        </div>

        {/* Preference summary chips */}
        {!showPrefs && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {prefs.dietary && prefs.dietary !== 'none' && <Chip className="capitalize">{prefs.dietary}</Chip>}
            {prefs.servings != null && <Chip>Serves {prefs.servings}</Chip>}
            <Chip>⚖️ {prefs.units === 'imperial' ? 'Imperial — cups & oz' : 'Metric — g & ml'}</Chip>
            {prefs.likes && <Chip>♥ {prefs.likes}</Chip>}
            {prefs.avoids && <Chip>⊘ {prefs.avoids}</Chip>}
          </div>
        )}

        {/* Editable preferences */}
        {showPrefs && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Dietary</p>
              <div className="flex flex-wrap gap-1.5">
                {DIETARY.map(d => (
                  <button key={d} onClick={() => updatePrefs({ dietary: d })}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${prefs.dietary === d ? 'bg-rose-600 border-rose-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {d === 'none' ? 'No preference' : d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Default servings</span>
              <div className="flex items-center gap-3">
                <button onClick={() => updatePrefs({ servings: Math.max(1, (prefs.servings ?? 2) - 1) })} className="w-7 h-7 rounded-full bg-gray-100 font-bold active:bg-gray-200">−</button>
                <span className="text-sm font-semibold w-6 text-center">{prefs.servings ?? '—'}</span>
                <button onClick={() => updatePrefs({ servings: Math.min(50, (prefs.servings ?? 1) + 1) })} className="w-7 h-7 rounded-full bg-gray-100 font-bold active:bg-gray-200">+</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Units</span>
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                {(['metric', 'imperial'] as RecipeUnits[]).map(u => (
                  <button key={u} onClick={() => updatePrefs({ units: u })}
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${prefs.units === u ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-500'}`}>
                    {u === 'metric' ? 'Metric (g/ml)' : 'Imperial (cups/oz)'}
                  </button>
                ))}
              </div>
            </div>
            <input value={prefs.likes ?? ''} placeholder="Likes (e.g. Thai, garlic, quick meals)" onChange={e => updatePrefs({ likes: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" />
            <input value={prefs.avoids ?? ''} placeholder="Avoid (allergies / dislikes)" onChange={e => updatePrefs({ avoids: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </div>
        )}
      </div>

      {/* ── Add a recipe from a link ───────────────────────────────────────── */}
      {onExtractRecipe && (
        <div className={frosted ? 'tp-card rounded-2xl p-4' : 'bg-rose-50/60 rounded-2xl border border-rose-100 p-4'}>
          <h3 className={`text-sm font-bold mb-2 ${frosted ? 'tp-ink' : 'text-gray-800'}`}>➕ Add a recipe</h3>
          <input
            data-testid="cookbook-url-input"
            value={url}
            onChange={e => setUrl(e.target.value)}
            inputMode="url"
            placeholder="Paste a cooking video link…"
            className="w-full text-sm border border-rose-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
          <button onClick={() => setShowManual(s => !s)} className="text-xs text-rose-600 font-semibold mt-2 active:opacity-70">
            {showManual ? '− Hide manual paste' : '✎ Paste recipe text instead'}
          </button>
          {showManual && (
            <textarea value={manualText} onChange={e => setManualText(e.target.value)} rows={3}
              placeholder="Paste the recipe text here…"
              className="mt-2 w-full text-sm border border-rose-200 rounded-xl px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-400" />
          )}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          {extracting ? (
            <div className="mt-3">
              <RecipeExtractionTheater stageEvents={stageEvents} hasVideo={url.trim().length > 0} />
              <p className={`text-xs mt-2 text-center ${frosted ? 'tp-ink-3' : 'text-gray-500'}`}>
                You can close this — it’ll be in your cookbook when you’re back.
              </p>
            </div>
          ) : (
            <button
              data-testid="cookbook-add-recipe-btn"
              onClick={addRecipe}
              disabled={!canAdd}
              className={`mt-3 w-full py-2.5 rounded-xl text-sm font-black disabled:opacity-40 flex items-center justify-center gap-2 ${frosted ? 'tp-btn-dark active:scale-[0.99] transition-transform' : 'bg-rose-500 text-white active:bg-rose-600'}`}
            >
              ✨ Add to cookbook
            </button>
          )}
        </div>
      )}

      {/* ── Recipe list ────────────────────────────────────────────────────── */}
      {content.recipes.length === 0 ? (
        <div className="text-center py-10 px-6">
          <p className="text-3xl mb-2">🍽️</p>
          <p className={`text-sm font-semibold ${frosted ? 'tp-ink-2' : 'text-gray-600'}`}>No recipes yet</p>
          <p className={`text-xs mt-1 ${ink3}`}>
            {onExtractRecipe ? 'Paste a cooking video link above to add your first one.' : 'This cookbook is empty.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className={`text-xs px-1 ${ink3}`}>{content.recipes.length} recipe{content.recipes.length !== 1 ? 's' : ''}</p>
          {content.recipes.map((r, i) => {
            const id = `${i}-${r.title}`;
            const expanded = expandedId === id;
            return (
              <div key={id} className={cardFlush}>
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpandedId(expanded ? null : id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <RecipeThumb recipe={r} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${ink}`}>{r.title}</p>
                      <p className={`text-xs mt-0.5 truncate ${ink3}`}>{recipeMeta(r)}</p>
                    </div>
                    <span className={`flex-shrink-0 transition-transform ${ink3} ${expanded ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  <button onClick={() => removeRecipeAt(i)} className={`p-1 flex-shrink-0 hover:text-red-500 ${frosted ? 'tp-ink-3' : 'text-gray-200'}`} aria-label="Remove recipe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                  </button>
                </div>
                {expanded && (
                  <div className={frosted ? 'border-t border-black/5' : 'border-t border-gray-100'}>
                    <RecipeRenderer
                      content={r}
                      onChange={updated => updateRecipeAt(i, updated)}
                      onChat={onRecipeChat ? (msg) => onRecipeChat(r, msg) : undefined}
                      frosted={frosted}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Video thumbnail when the recipe came from a link; dish emoji tile otherwise. */
function RecipeThumb({ recipe }: { recipe: RecipeContent }) {
  const fallback = (
    <span className="w-14 h-14 rounded-xl bg-rose-50 flex items-center justify-center text-2xl flex-shrink-0" aria-hidden="true">
      {dishEmoji(recipe.title)}
    </span>
  );
  if (!recipe.thumbnailUrl) return fallback;
  return (
    <VideoThumb
      src={recipe.thumbnailUrl}
      className="w-14 h-14 rounded-xl object-cover bg-rose-50 flex-shrink-0"
      fallback={fallback}
    />
  );
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full ${className}`}>
      {children}
    </span>
  );
}
