import React, { useState } from 'react';
import { BottomSheet } from './shared/BottomSheet';
import type { RecipeUnits } from '../types';

export interface CookbookSetupInput {
  title?: string;
  dietary: string;
  servings?: number;
  units: RecipeUnits;
  likes?: string;
  avoids?: string;
}

interface RecipeIntakeSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CookbookSetupInput) => void;
}

const DIETARY = ['none', 'vegetarian', 'vegan', 'gluten-free', 'dairy-free'] as const;

/**
 * Setup for the Recipe tool. First you build a personal Cookbook by answering a
 * few quick preferences (all editable later inside the tool); THEN, inside the
 * cookbook, you paste cooking-video links to pull recipes in.
 */
export function RecipeIntakeSheet({ open, onClose, onSubmit }: RecipeIntakeSheetProps) {
  const [title, setTitle] = useState('');
  const [dietary, setDietary] = useState<string>('none');
  const [servings, setServings] = useState<number | undefined>(undefined);
  const [units, setUnits] = useState<RecipeUnits>('metric');

  function handleBuild() {
    onSubmit({ title: title.trim() || undefined, dietary, servings, units });
    setTitle('');
    setDietary('none');
    setServings(undefined);
    setUnits('metric');
  }

  return (
    <BottomSheet open={open} onClose={onClose} testId="recipe-intake-sheet" accent="rose">

        {/* Header */}
        <div className="px-5 pb-3 pt-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🍳</span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] tp-ink-3">Cookbook</p>
          </div>
          <h3 className="text-lg font-extrabold tp-ink tracking-tight leading-tight">Set up your cookbook</h3>
          <p className="text-xs tp-ink-3 mt-0.5">
            A couple of quick questions so recipes come out the way you like. You can change all of this later inside the tool — then paste cooking-video links to fill it.
          </p>
        </div>

        <div className="overflow-y-auto px-5 pb-2 min-h-0">
          {/* Name */}
          <label className="block text-xs font-semibold tp-ink-2 mb-1.5 px-1">Cookbook name (optional)</label>
          <input
            data-testid="cookbook-name-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="My Cookbook"
            className="tp-input w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: 'rgba(22,21,15,0.18)' }}
          />

          {/* Dietary */}
          <p className="text-xs font-semibold tp-ink-2 mb-2 mt-4 px-1">Any dietary preference?</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY.map(d => (
              <button
                key={d}
                data-testid={`cookbook-dietary-${d}`}
                onClick={() => setDietary(d)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-transform active:scale-95 ${
                  dietary === d ? 'tp-btn-dark' : 'tp-glass tp-ink'
                }`}
              >
                {d === 'none' ? 'No preference' : d}
              </button>
            ))}
          </div>

          {/* Servings */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-xs font-semibold tp-ink-2">Usual servings (optional)</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setServings(s => Math.max(1, (s ?? 2) - 1))} className="w-7 h-7 rounded-full tp-glass tp-ink font-bold leading-none active:scale-95 transition-transform">−</button>
              <span className="text-sm font-semibold tp-ink w-6 text-center">{servings ?? '—'}</span>
              <button onClick={() => setServings(s => Math.min(50, (s ?? 1) + 1))} className="w-7 h-7 rounded-full tp-glass tp-ink font-bold leading-none active:scale-95 transition-transform">+</button>
            </div>
          </div>

          {/* Units */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-xs font-semibold tp-ink-2">Measurements</span>
            <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: 'rgba(22,21,15,0.05)' }}>
              {(['metric', 'imperial'] as RecipeUnits[]).map(u => (
                <button
                  key={u}
                  data-testid={`cookbook-units-${u}`}
                  onClick={() => setUnits(u)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${units === u ? 'bg-white tp-ink shadow-sm' : 'tp-ink-3'}`}
                >
                  {u === 'metric' ? 'Metric' : 'Imperial'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Build */}
        <div className="px-5 pt-3 pb-6 flex-shrink-0">
          <button
            data-testid="build-cookbook-btn"
            onClick={handleBuild}
            className="tp-btn-dark w-full py-3.5 rounded-2xl text-sm font-black active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
          >
            ✨ Build my cookbook
          </button>
        </div>
    </BottomSheet>
  );
}
