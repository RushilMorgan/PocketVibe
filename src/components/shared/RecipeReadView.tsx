/**
 * Read-only view of a shared Recipe (viewers / non-owners).
 * Owners use the full editable RecipeRenderer instead.
 *
 * Viewers can tick ingredients locally (to use it as a live shopping checklist),
 * copy/share the shopping list, and either save a copy to their cookbook or make
 * their own editable version.
 */
import React, { useState } from 'react';
import type { RecipeContent, RecipeIngredient } from '../../types';
import { VideoThumb } from './VideoThumb';

interface Props {
  content: RecipeContent;
  onSave: () => boolean;       // save a copy to the viewer's cookbook
  onMakeMine: () => void;      // create an editable copy and open it
}

function ingredientLabel(i: RecipeIngredient): string {
  return [i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim() || i.name;
}

export function RecipeReadView({ content, onSave, onMakeMine }: Props) {
  const [have, setHave] = useState<Record<string, boolean>>(
    () => Object.fromEntries(content.ingredients.map(i => [i.id, i.have])),
  );
  const [saved, setSaved] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const layout = content.layoutMode ?? 'card';
  const needed = content.ingredients.filter(i => !have[i.id]);

  async function copyShoppingList() {
    const text = [
      `🛒 Shopping list — ${content.title}`,
      ...needed.map(i => `• ${ingredientLabel(i)}`),
      ...content.extraShoppingItems.map(x => `• ${x.name}`),
    ].join('\n');
    try {
      if (navigator.share) { await navigator.share({ title: content.title, text }); return; }
      await navigator.clipboard.writeText(text);
      setCopyNote('Copied!');
      setTimeout(() => setCopyNote(null), 2000);
    } catch { /* blocked */ }
  }

  function handleSave() {
    if (onSave()) setSaved(true);
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="tp-card rounded-2xl overflow-hidden">
        {content.thumbnailUrl && <VideoThumb src={content.thumbnailUrl} className="w-full h-44 object-cover" />}
        <div className="p-4">
          <h1 className="text-xl font-extrabold tp-ink tracking-tight leading-tight">{content.title}</h1>
          {(content.attribution?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] tp-ink-3">
              {content.attribution!.map((a, idx) => (
                <span key={idx}>{a.label}{a.url ? <> <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">link</a></> : null}</span>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {content.servings != null && <Stat icon="🍽️" value={`Serves ${content.servings}`} />}
            {content.prepTime && <Stat icon="⏱️" value={`Prep ${content.prepTime}`} />}
            {content.cookTime && <Stat icon="🔥" value={`Cook ${content.cookTime}`} />}
          </div>
          {content.sourceUrl && (
            <a href={content.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full active:bg-rose-100">
              ▶ Watch original
            </a>
          )}
        </div>
      </div>

      {/* Ingredients + shopping list */}
      <div className="tp-card rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-bold tp-ink text-sm">Ingredients</h3>
          <span className="text-xs tp-ink-3">Tick what you have</span>
        </div>
        <div className="divide-y divide-black/5">
          {content.ingredients.map(i => (
            <button key={i.id} onClick={() => setHave(h => ({ ...h, [i.id]: !h[i.id] }))}
              className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-black/5 text-left">
              <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${have[i.id] ? 'bg-rose-500 border-rose-500' : 'border-gray-300'}`}>
                {have[i.id] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </span>
              <span className={`text-sm flex-1 ${have[i.id] ? 'line-through tp-ink-3' : 'tp-ink'}`}>{ingredientLabel(i)}</span>
            </button>
          ))}
          {content.ingredients.length === 0 && <p className="px-4 py-4 text-center tp-ink-3 text-sm">No ingredients listed.</p>}
        </div>
        <div className="border-t border-black/5 px-4 py-3" style={{ background: 'rgba(22,21,15,0.02)' }}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold tp-ink-2 uppercase tracking-wide">Shopping list ({needed.length + content.extraShoppingItems.length})</h4>
            <button onClick={copyShoppingList} className="text-xs font-semibold text-rose-600 active:opacity-70">{copyNote ?? 'Copy / share'}</button>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="tp-card rounded-2xl p-4">
        <h3 className="font-bold tp-ink text-sm mb-3">Steps</h3>
        <ol className={layout === 'list' ? 'flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
          {content.steps.map(s => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.number}</span>
              <div className="flex-1">
                <p className="text-sm tp-ink leading-relaxed">{s.text}</p>
                {s.time && <span className="text-xs tp-ink-3">⏱️ {s.time}</span>}
              </div>
            </li>
          ))}
          {content.steps.length === 0 && <p className="text-center tp-ink-3 text-sm">No steps listed.</p>}
        </ol>
      </div>

      {/* Notes */}
      {content.notes && (
        <div className="tp-card rounded-2xl p-4">
          <h3 className="font-bold tp-ink text-sm mb-1">Notes</h3>
          <p className="text-sm tp-ink-2 whitespace-pre-wrap">{content.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pb-4">
        <button
          data-testid="recipe-save-btn"
          onClick={handleSave}
          disabled={saved}
          className="tp-btn-dark w-full py-3 rounded-2xl text-sm font-black active:scale-[0.99] transition-transform disabled:opacity-60"
        >
          {saved ? '✓ Saved to your cookbook' : '🔖 Save to my cookbook'}
        </button>
        <button
          data-testid="recipe-make-mine-btn"
          onClick={onMakeMine}
          className="w-full py-3 rounded-2xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 active:bg-rose-100"
        >
          ✨ Edit my own copy
        </button>
        <p className="text-center text-[11px] tp-ink-3">
          You get your own version to change — the original stays theirs.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(22,21,15,0.04)' }}>
      <span>{icon}</span>
      <span className="font-semibold tp-ink">{value}</span>
    </span>
  );
}
