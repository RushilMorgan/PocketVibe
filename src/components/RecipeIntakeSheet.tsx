import React, { useState } from 'react';
import type { RecipeIntakeInput } from '../lib/recipePrompt';

interface RecipeIntakeSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RecipeIntakeInput) => void;
}

const DIETARY = ['none', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;

const URL_RE = /youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/watch|tiktok\.com|instagram\.com/i;

/**
 * Guided intake for the Recipe tool.
 * Paste a YouTube Shorts URL (preferred) or the recipe text, optionally set
 * servings + a dietary preference, then build.
 */
export function RecipeIntakeSheet({ open, onClose, onSubmit }: RecipeIntakeSheetProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [servings, setServings] = useState<number | undefined>(undefined);
  const [dietary, setDietary] = useState<string>('none');

  if (!open) return null;

  const urlLooksOff = youtubeUrl.trim().length > 0 && !URL_RE.test(youtubeUrl.trim());
  const canBuild = youtubeUrl.trim().length > 0 || manualText.trim().length > 0;

  function handleBuild() {
    if (!canBuild) return;
    onSubmit({ youtubeUrl: youtubeUrl.trim(), manualText: manualText.trim(), servings, dietary });
    setYoutubeUrl('');
    setManualText('');
    setShowManual(false);
    setServings(undefined);
    setDietary('none');
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        data-testid="recipe-intake-sheet"
        className="relative bg-gray-950 rounded-t-3xl shadow-2xl flex flex-col max-h-[88%] z-10 border-t border-rose-500/20"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 pt-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🍳</span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">Recipe</p>
          </div>
          <h3 className="text-lg font-bold text-white leading-tight">Save a recipe</h3>
          <p className="text-xs text-white/45 mt-0.5">
            Paste a cooking video link and Toolie writes it up — ingredients, steps and a shopping list.
          </p>
        </div>

        <div className="overflow-y-auto px-5 pb-2 min-h-0">
          {/* YouTube URL */}
          <label className="block text-xs font-semibold text-white/50 mb-1.5 px-1">Cooking video link</label>
          <input
            data-testid="recipe-url-input"
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            inputMode="url"
            placeholder="https://youtube.com/shorts/…"
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          {urlLooksOff && (
            <p data-testid="recipe-url-warning" className="text-[11px] text-amber-300/80 mt-1.5 px-1">
              That doesn't look like a video link — you can still build, or paste the recipe text below.
            </p>
          )}

          {/* Manual paste toggle */}
          <button
            data-testid="recipe-manual-toggle"
            onClick={() => setShowManual(s => !s)}
            className="text-xs text-rose-300 font-semibold mt-3 active:opacity-70"
          >
            {showManual ? '− Hide manual paste' : '✎ Paste recipe text instead'}
          </button>
          {showManual && (
            <textarea
              data-testid="recipe-manual-input"
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              rows={4}
              placeholder="Paste or type the recipe here…"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          )}

          {/* Servings */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-xs font-semibold text-white/50">Servings (optional)</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setServings(s => Math.max(1, (s ?? 2) - 1))}
                className="w-7 h-7 rounded-full bg-white/10 text-white font-bold leading-none active:bg-white/20"
              >−</button>
              <span className="text-sm font-semibold text-white w-6 text-center">{servings ?? '—'}</span>
              <button
                onClick={() => setServings(s => Math.min(50, (s ?? 1) + 1))}
                className="w-7 h-7 rounded-full bg-white/10 text-white font-bold leading-none active:bg-white/20"
              >+</button>
            </div>
          </div>

          {/* Dietary chips */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-white/50 mb-2 px-1">Dietary preference (optional)</p>
            <div className="flex flex-wrap gap-2">
              {DIETARY.map(d => (
                <button
                  key={d}
                  data-testid={`recipe-dietary-${d}`}
                  onClick={() => setDietary(d)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize transition-colors ${
                    dietary === d
                      ? 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 active:bg-white/10'
                  }`}
                >
                  {d === 'none' ? 'No preference' : d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Build button */}
        <div className="px-5 pt-3 pb-6 flex-shrink-0">
          <button
            data-testid="build-recipe-btn"
            onClick={handleBuild}
            disabled={!canBuild}
            className="w-full py-3.5 rounded-2xl bg-rose-500 text-white text-sm font-black active:bg-rose-600 disabled:opacity-40 disabled:active:bg-rose-500 transition-colors flex items-center justify-center gap-2"
          >
            ✨ Build my recipe
          </button>
        </div>
      </div>
    </div>
  );
}
