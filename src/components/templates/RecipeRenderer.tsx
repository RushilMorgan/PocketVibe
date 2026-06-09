import React, { useState } from 'react';
import type {
  RecipeContent,
  RecipeIngredient,
  RecipeStep,
  RecipeShoppingItem,
  RecipeLayoutMode,
} from '../../types';

interface RecipeRendererProps {
  content: RecipeContent;
  onChange: (updated: RecipeContent) => void;
}

let _uid = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_uid}`;
}

function ingredientLabel(i: RecipeIngredient): string {
  return [i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim() || i.name;
}

export function RecipeRenderer({ content, onChange }: RecipeRendererProps) {
  const [editMode, setEditMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const layout: RecipeLayoutMode = content.layoutMode ?? 'card';
  const update = (patch: Partial<RecipeContent>) => onChange({ ...content, ...patch });

  // ── Ingredients ──────────────────────────────────────────────────────────
  function toggleHave(id: string) {
    update({ ingredients: content.ingredients.map(i => i.id === id ? { ...i, have: !i.have } : i) });
  }
  function updateIngredient(id: string, field: keyof RecipeIngredient, value: string) {
    update({ ingredients: content.ingredients.map(i => i.id === id ? { ...i, [field]: value } : i) });
  }
  function deleteIngredient(id: string) {
    update({ ingredients: content.ingredients.filter(i => i.id !== id) });
  }
  function addIngredient() {
    const item: RecipeIngredient = { id: uid('ing'), name: '', quantity: '', unit: '', have: false };
    update({ ingredients: [...content.ingredients, item] });
  }

  // ── Steps (keep number 1..n) ─────────────────────────────────────────────
  function renumber(steps: RecipeStep[]): RecipeStep[] {
    return steps.map((s, idx) => ({ ...s, number: idx + 1 }));
  }
  function updateStep(id: string, field: 'text' | 'time', value: string) {
    update({ steps: content.steps.map(s => s.id === id ? { ...s, [field]: value } : s) });
  }
  function deleteStep(id: string) {
    update({ steps: renumber(content.steps.filter(s => s.id !== id)) });
  }
  function addStep() {
    const step: RecipeStep = { id: uid('st'), number: content.steps.length + 1, text: '' };
    update({ steps: [...content.steps, step] });
  }

  // ── Shopping list (derived: ingredients not had + manual extras) ──────────
  function toggleExtra(id: string) {
    update({ extraShoppingItems: content.extraShoppingItems.map(x => x.id === id ? { ...x, checked: !x.checked } : x) });
  }
  function addExtra() {
    const item: RecipeShoppingItem = { id: uid('shp'), name: '', checked: false };
    update({ extraShoppingItems: [...content.extraShoppingItems, item] });
  }
  function updateExtra(id: string, name: string) {
    update({ extraShoppingItems: content.extraShoppingItems.map(x => x.id === id ? { ...x, name } : x) });
  }
  function deleteExtra(id: string) {
    update({ extraShoppingItems: content.extraShoppingItems.filter(x => x.id !== id) });
  }

  const needed = content.ingredients.filter(i => !i.have);

  async function copyShoppingList() {
    const lines = [
      `🛒 Shopping list — ${content.title}`,
      ...needed.map(i => `• ${ingredientLabel(i)}`),
      ...content.extraShoppingItems.map(x => `• ${x.name}`),
    ];
    const text = lines.join('\n');
    try {
      if (navigator.share) { await navigator.share({ title: content.title, text }); return; }
      await navigator.clipboard.writeText(text);
      setShareNote('Copied!');
      setTimeout(() => setShareNote(null), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setShareNote('Copied!');
        setTimeout(() => setShareNote(null), 2000);
      } catch { /* blocked */ }
    }
  }

  // ── Tags ─────────────────────────────────────────────────────────────────
  function addTag() {
    const t = tagDraft.trim().toLowerCase();
    if (!t) return;
    const tags = content.tags ?? [];
    if (!tags.includes(t)) update({ tags: [...tags, t] });
    setTagDraft('');
  }
  function removeTag(t: string) {
    update({ tags: (content.tags ?? []).filter(x => x !== t) });
  }

  const safeStepIndex = Math.min(stepIndex, Math.max(0, content.steps.length - 1));

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Edit toggle */}
      <div className="flex justify-end">
        <button
          data-testid="edit-recipe-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit recipe'}
        </button>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {content.thumbnailUrl && (
          <img src={content.thumbnailUrl} alt="" className="w-full h-40 object-cover" />
        )}
        <div className="p-4">
          {editMode ? (
            <input
              data-testid="recipe-title-input"
              value={content.title}
              onChange={e => update({ title: e.target.value })}
              className="w-full text-lg font-bold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          ) : (
            <h2 className="text-lg font-black text-gray-900 leading-tight">{content.title}</h2>
          )}

          {/* Attribution chain */}
          {(content.attribution?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
              {content.attribution!.map((a, idx) => (
                <span key={idx}>
                  {a.label}{' '}
                  {a.url
                    ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-violet-500 underline">link</a>
                    : null}
                  {idx < content.attribution!.length - 1 ? ' ·' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Stat row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Stat
              icon="🍽️"
              label="Servings"
              value={content.servings != null ? String(content.servings) : '—'}
              editMode={editMode}
              onStep={d => update({ servings: Math.max(1, (content.servings ?? 1) + d) })}
            />
            <StatText icon="⏱️" label="Prep" value={content.prepTime} editMode={editMode}
              onChange={v => update({ prepTime: v })} />
            <StatText icon="🔥" label="Cook" value={content.cookTime} editMode={editMode}
              onChange={v => update({ cookTime: v })} />
          </div>

          {content.sourceUrl && (
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full active:bg-violet-100"
            >
              ▶ Watch original
            </a>
          )}
        </div>
      </div>

      {/* ── Ingredients + shopping list ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Ingredients</h3>
          <span className="text-xs text-gray-400">Tick what you have</span>
        </div>
        <div className="divide-y divide-gray-50">
          {content.ingredients.map(i => (
            <div key={i.id} data-testid={`ingredient-${i.id}`} className="px-4 py-2.5">
              {editMode ? (
                <div className="flex items-center gap-2">
                  <input value={i.quantity ?? ''} placeholder="1" onChange={e => updateIngredient(i.id, 'quantity', e.target.value)}
                    className="w-12 text-sm border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <input value={i.unit ?? ''} placeholder="cup" onChange={e => updateIngredient(i.id, 'unit', e.target.value)}
                    className="w-16 text-sm border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <input value={i.name} placeholder="ingredient" onChange={e => updateIngredient(i.id, 'name', e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <button onClick={() => deleteIngredient(i.id)} className="text-red-400 hover:text-red-600 p-1" aria-label="Delete ingredient">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => toggleHave(i.id)} className="w-full flex items-center gap-3 active:bg-gray-50 text-left">
                  <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    i.have ? 'bg-violet-600 border-violet-600' : 'border-gray-300'
                  }`}>
                    {i.have && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </span>
                  <span className={`text-sm flex-1 ${i.have ? 'line-through text-gray-400' : 'text-gray-800'}`}>{ingredientLabel(i)}</span>
                </button>
              )}
            </div>
          ))}
        </div>
        {editMode && (
          <div className="px-4 pb-4 pt-2">
            <button data-testid="add-ingredient-btn" onClick={addIngredient}
              className="w-full text-sm text-violet-600 font-semibold border-2 border-dashed border-violet-200 rounded-xl py-2 active:bg-violet-50">
              + Add ingredient
            </button>
          </div>
        )}
        {content.ingredients.length === 0 && !editMode && (
          <p className="px-4 pb-4 text-center text-gray-400 text-sm">No ingredients yet — tap Edit recipe or ask Toolie.</p>
        )}

        {/* Shopping list */}
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Shopping list</h4>
            <button data-testid="copy-shopping-btn" onClick={copyShoppingList}
              className="text-xs font-semibold text-violet-600 active:opacity-70">
              {shareNote ?? 'Copy / share'}
            </button>
          </div>
          {needed.length === 0 && content.extraShoppingItems.length === 0 ? (
            <p className="text-xs text-gray-400">You have everything — nothing to buy. 🎉</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {needed.map(i => (
                <button key={i.id} onClick={() => toggleHave(i.id)} className="flex items-center gap-2 text-left active:opacity-70">
                  <span className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{ingredientLabel(i)}</span>
                </button>
              ))}
              {content.extraShoppingItems.map(x => (
                <div key={x.id} className="flex items-center gap-2">
                  <button onClick={() => toggleExtra(x.id)} className="flex items-center gap-2 flex-1 text-left active:opacity-70">
                    <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${x.checked ? 'bg-gray-400 border-gray-400' : 'border-gray-300'}`}>
                      {x.checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                    {editMode ? (
                      <input value={x.name} placeholder="item" onChange={e => updateExtra(x.id, e.target.value)} onClick={e => e.stopPropagation()}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    ) : (
                      <span className={`text-sm ${x.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{x.name}</span>
                    )}
                  </button>
                  {editMode && (
                    <button onClick={() => deleteExtra(x.id)} className="text-red-400 hover:text-red-600 p-1" aria-label="Remove item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button data-testid="add-shopping-item-btn" onClick={addExtra}
            className="mt-2 text-xs text-gray-500 font-medium active:opacity-70">+ Add item</button>
        </div>
      </div>

      {/* ── Steps ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Steps</h3>
          {/* Layout switcher */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            {(['card', 'list', 'step'] as RecipeLayoutMode[]).map(mode => (
              <button
                key={mode}
                data-testid={`recipe-layout-${mode}`}
                onClick={() => { update({ layoutMode: mode }); setStepIndex(0); }}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize transition-colors ${
                  layout === mode ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4 pt-1">
          {content.steps.length === 0 && !editMode && (
            <p className="text-center text-gray-400 text-sm py-4">No steps yet — tap Edit recipe or ask Toolie.</p>
          )}

          {editMode ? (
            <div className="flex flex-col gap-2">
              {content.steps.map(s => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">{s.number}</span>
                  <div className="flex-1">
                    <textarea value={s.text} placeholder="Describe this step…" onChange={e => updateStep(s.id, 'text', e.target.value)} rows={2}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                    <input value={s.time ?? ''} placeholder="time (optional, e.g. 5 min)" onChange={e => updateStep(s.id, 'time', e.target.value)}
                      className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <button onClick={() => deleteStep(s.id)} className="text-red-400 hover:text-red-600 p-1 mt-1" aria-label="Delete step">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
              <button data-testid="add-step-btn" onClick={addStep}
                className="w-full text-sm text-violet-600 font-semibold border-2 border-dashed border-violet-200 rounded-xl py-2 active:bg-violet-50">
                + Add step
              </button>
            </div>
          ) : layout === 'step' && content.steps.length > 0 ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <span className="text-xs font-bold text-violet-500 uppercase tracking-wide">
                Step {safeStepIndex + 1} of {content.steps.length}
              </span>
              <p className="text-base text-gray-800 leading-relaxed min-h-[4rem]">{content.steps[safeStepIndex]?.text}</p>
              {content.steps[safeStepIndex]?.time && (
                <span className="text-xs text-gray-400">⏱️ {content.steps[safeStepIndex].time}</span>
              )}
              <div className="flex items-center gap-3 mt-2">
                <button disabled={safeStepIndex === 0} onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 disabled:opacity-40 active:bg-gray-200">Prev</button>
                <button disabled={safeStepIndex >= content.steps.length - 1} onClick={() => setStepIndex(i => Math.min(content.steps.length - 1, i + 1))}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-sm font-semibold text-white disabled:opacity-40 active:bg-violet-700">Next</button>
              </div>
            </div>
          ) : (
            <ol className={layout === 'list' ? 'flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
              {content.steps.map(s => (
                <li key={s.id} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.number}</span>
                  <div className="flex-1">
                    <p className={`text-gray-800 ${layout === 'list' ? 'text-sm' : 'text-sm leading-relaxed'}`}>{s.text}</p>
                    {s.time && layout === 'card' && <span className="text-xs text-gray-400">⏱️ {s.time}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-2">My notes</h3>
        <textarea
          data-testid="recipe-notes"
          value={content.notes ?? ''}
          onChange={e => update({ notes: e.target.value })}
          placeholder="Add your own notes — tweaks, timings, what worked…"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        />
      </div>

      {/* ── Tags ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(content.tags ?? []).map(t => (
          <span key={t} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full">
            #{t}
            <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`} className="text-violet-400 hover:text-violet-700">×</button>
          </span>
        ))}
        <input
          data-testid="recipe-tag-input"
          value={tagDraft}
          onChange={e => setTagDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
          onBlur={addTag}
          placeholder="+ tag"
          className="text-xs w-20 border border-gray-200 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>
    </div>
  );
}

// ── Small stat helpers ────────────────────────────────────────────────────────

function Stat({ icon, label, value, editMode, onStep }: {
  icon: string; label: string; value: string; editMode: boolean; onStep: (d: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
      <span>{icon}</span>
      <span className="text-gray-400">{label}</span>
      {editMode ? (
        <span className="flex items-center gap-1">
          <button onClick={() => onStep(-1)} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 font-bold leading-none active:bg-gray-300">−</button>
          <span className="font-semibold text-gray-800 w-5 text-center">{value}</span>
          <button onClick={() => onStep(1)} className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 font-bold leading-none active:bg-gray-300">+</button>
        </span>
      ) : (
        <span className="font-semibold text-gray-800">{value}</span>
      )}
    </div>
  );
}

function StatText({ icon, label, value, editMode, onChange }: {
  icon: string; label: string; value?: string; editMode: boolean; onChange: (v: string) => void;
}) {
  if (!editMode && !value) return null;
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
      <span>{icon}</span>
      <span className="text-gray-400">{label}</span>
      {editMode ? (
        <input value={value ?? ''} placeholder="10 min" onChange={e => onChange(e.target.value)}
          className="w-16 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400" />
      ) : (
        <span className="font-semibold text-gray-800">{value}</span>
      )}
    </div>
  );
}
