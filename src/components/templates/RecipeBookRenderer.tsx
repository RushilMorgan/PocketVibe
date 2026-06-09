import React, { useState } from 'react';
import type {
  RecipeBookContent,
  RecipeContent,
  RecipeBookPreferences,
  RecipeUnits,
} from '../../types';
import type { RecipeIntakeInput } from '../../lib/recipePrompt';
import { RecipeRenderer } from './RecipeRenderer';

interface RecipeBookRendererProps {
  content: RecipeBookContent;
  onChange: (updated: RecipeBookContent) => void;
  /** Pulls a recipe from a link/text (respecting preferences). Absent for viewers. */
  onExtractRecipe?: (input: RecipeIntakeInput) => Promise<RecipeContent | null>;
  /** Chat about one recipe (AI has that recipe's context). Absent for viewers. */
  onRecipeChat?: (recipe: RecipeContent, message: string) => Promise<{ answer?: string; updatedRecipe?: RecipeContent }>;
}

const DIETARY = ['none', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;
const TYPE_EMOJI = '🍴';

function recipeMeta(r: RecipeContent): string {
  return [
    r.servings != null ? `Serves ${r.servings}` : '',
    r.prepTime ? `Prep ${r.prepTime}` : '',
    r.cookTime ? `Cook ${r.cookTime}` : '',
    `${r.ingredients.length} ingredients`,
  ].filter(Boolean).join(' · ');
}

export function RecipeBookRenderer({ content, onChange, onExtractRecipe, onRecipeChat }: RecipeBookRendererProps) {
  const [showPrefs, setShowPrefs] = useState(false);
  const [url, setUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const prefs = content.preferences;
  const update = (patch: Partial<RecipeBookContent>) => onChange({ ...content, ...patch });
  const updatePrefs = (patch: Partial<RecipeBookPreferences>) =>
    update({ preferences: { ...prefs, ...patch } });

  const canAdd = !!onExtractRecipe && (url.trim().length > 0 || manualText.trim().length > 0);

  async function addRecipe() {
    if (!onExtractRecipe || extracting) return;
    if (!url.trim() && !manualText.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const recipe = await onExtractRecipe({
        youtubeUrl: url.trim(),
        manualText: manualText.trim(),
        servings: prefs.servings,
        dietary: prefs.dietary,
      });
      if (!recipe) {
        setError("Couldn't read that one — try another link or paste the recipe text.");
        return;
      }
      update({ recipes: [recipe, ...content.recipes] });
      setUrl('');
      setManualText('');
      setShowManual(false);
      setExpandedId(null);
    } catch {
      setError('Something went wrong adding that recipe. Please try again.');
    } finally {
      setExtracting(false);
    }
  }

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
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-2">
          <input
            data-testid="cookbook-title-input"
            value={content.title}
            onChange={e => update({ title: e.target.value })}
            className="flex-1 text-lg font-black text-gray-900 bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1 -mx-1"
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
            {prefs.dietary && prefs.dietary !== 'none' && <Chip>{prefs.dietary}</Chip>}
            {prefs.servings != null && <Chip>Serves {prefs.servings}</Chip>}
            <Chip>{prefs.units === 'imperial' ? 'cups/oz' : 'g/ml'}</Chip>
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
        <div className="bg-rose-50/60 rounded-2xl border border-rose-100 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2">➕ Add a recipe</h3>
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
          <button
            data-testid="cookbook-add-recipe-btn"
            onClick={addRecipe}
            disabled={!canAdd || extracting}
            className="mt-3 w-full py-2.5 rounded-xl bg-rose-500 text-white text-sm font-black active:bg-rose-600 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {extracting ? <><span className="animate-pulse">🍳</span> Reading the recipe…</> : '✨ Add to cookbook'}
          </button>
        </div>
      )}

      {/* ── Recipe list ────────────────────────────────────────────────────── */}
      {content.recipes.length === 0 ? (
        <div className="text-center py-10 px-6">
          <p className="text-3xl mb-2">🍽️</p>
          <p className="text-sm font-semibold text-gray-600">No recipes yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {onExtractRecipe ? 'Paste a cooking video link above to add your first one.' : 'This cookbook is empty.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 px-1">{content.recipes.length} recipe{content.recipes.length !== 1 ? 's' : ''}</p>
          {content.recipes.map((r, i) => {
            const id = `${i}-${r.title}`;
            const expanded = expandedId === id;
            return (
              <div key={id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpandedId(expanded ? null : id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="text-2xl flex-shrink-0">{TYPE_EMOJI}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{recipeMeta(r)}</p>
                    </div>
                    <span className={`text-gray-300 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  <button onClick={() => removeRecipeAt(i)} className="text-gray-200 hover:text-red-500 p-1 flex-shrink-0" aria-label="Remove recipe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                  </button>
                </div>
                {expanded && (
                  <div className="border-t border-gray-100">
                    <RecipeRenderer
                      content={r}
                      onChange={updated => updateRecipeAt(i, updated)}
                      onChat={onRecipeChat ? (msg) => onRecipeChat(r, msg) : undefined}
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full capitalize">
      {children}
    </span>
  );
}
