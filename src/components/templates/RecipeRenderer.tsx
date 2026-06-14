import React, { useState } from 'react';
import type {
  RecipeContent,
  RecipeIngredient,
  RecipeShoppingItem,
} from '../../types';
import { ingredientEmoji } from '../../lib/recipeIcons';
import { uid } from '../../lib/uid';
import { VideoThumb } from '../shared/VideoThumb';
import { RecipeSteps } from './RecipeSteps';

interface ChatMsg { role: 'user' | 'assistant'; text: string; }

interface RecipeRendererProps {
  content: RecipeContent;
  onChange: (updated: RecipeContent) => void;
  /** Tap-to-talk: ask Toolie about this recipe (it has full recipe context). */
  onChat?: (message: string) => Promise<{ answer?: string; updatedRecipe?: RecipeContent }>;
  /** Velix light/frosted card surface (standalone tool pages); default = app look. */
  frosted?: boolean;
}

function ingredientLabel(i: RecipeIngredient): string {
  return [i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim() || i.name;
}

const QUICK_PROMPTS = ['Make it dairy-free', 'Scale to 4 people', 'Simplify the steps', 'Suggest a side dish'];

export function RecipeRenderer({ content, onChange, onChat, frosted = false }: RecipeRendererProps) {
  const card = frosted ? 'tp-card overflow-hidden' : 'bg-white rounded-2xl border border-gray-100 overflow-hidden';
  const cardPad = frosted ? 'tp-card p-4' : 'bg-white rounded-2xl border border-gray-100 p-4';
  const [editMode, setEditMode] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  // ── Tap-to-talk chat state ─────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);

  function openChatWith(prefill: string) {
    setChatInput(prefill);
    setChatOpen(true);
  }

  async function sendChat(text: string) {
    if (!onChat || chatBusy) return;
    const msg = text.trim();
    if (!msg) return;
    setChatMsgs(m => [...m, { role: 'user', text: msg }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const { answer, updatedRecipe } = await onChat(msg);
      if (updatedRecipe) onChange(updatedRecipe);
      setChatMsgs(m => [...m, { role: 'assistant', text: answer ?? 'Done.' }]);
    } catch {
      setChatMsgs(m => [...m, { role: 'assistant', text: 'Sorry — something went wrong. Please try again.' }]);
    } finally {
      setChatBusy(false);
    }
  }

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

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Edit toggle */}
      <div className="flex justify-end">
        <button
          data-testid="edit-recipe-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : '✎ Edit by hand'}
        </button>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={card}>
        {content.thumbnailUrl && (
          <VideoThumb src={content.thumbnailUrl} className="w-full h-40 object-cover" />
        )}
        <div className="p-4">
          {editMode ? (
            <input
              data-testid="recipe-title-input"
              value={content.title}
              onChange={e => update({ title: e.target.value })}
              className="w-full text-lg font-bold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400"
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
                    ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-rose-500 underline">link</a>
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
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full active:bg-rose-100"
            >
              ▶ Watch original
            </a>
          )}
        </div>
      </div>

      {/* ── Ingredients + shopping list ─────────────────────────────────────── */}
      <div className={card}>
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
                    className="w-12 text-sm border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <input value={i.unit ?? ''} placeholder="cup" onChange={e => updateIngredient(i.id, 'unit', e.target.value)}
                    className="w-16 text-sm border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <input value={i.name} placeholder="ingredient" onChange={e => updateIngredient(i.id, 'name', e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <button onClick={() => deleteIngredient(i.id)} className="text-red-400 hover:text-red-600 p-1" aria-label="Delete ingredient">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleHave(i.id)} className="flex-1 flex items-center gap-2.5 active:bg-gray-50 text-left min-w-0">
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      i.have ? 'bg-rose-600 border-rose-600' : 'border-gray-300'
                    }`}>
                      {i.have && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                    <span className="text-lg leading-none flex-shrink-0">{i.emoji || ingredientEmoji(i.name)}</span>
                    <span className={`text-sm flex-1 min-w-0 ${i.have ? 'line-through text-gray-400' : 'text-gray-800'}`}>{ingredientLabel(i)}</span>
                  </button>
                  {onChat && (
                    <button
                      onClick={() => openChatWith(`About "${ingredientLabel(i)}": `)}
                      className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-xs hover:bg-rose-50 hover:border-rose-200 active:bg-rose-100"
                      aria-label="Ask Toolie about this ingredient"
                      title="Ask Toolie"
                    >💬</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {editMode && (
          <div className="px-4 pb-4 pt-2">
            <button data-testid="add-ingredient-btn" onClick={addIngredient}
              className="w-full text-sm text-rose-600 font-semibold border-2 border-dashed border-rose-200 rounded-xl py-2 active:bg-rose-50">
              + Add ingredient
            </button>
          </div>
        )}
        {content.ingredients.length === 0 && !editMode && (
          <p className="px-4 pb-4 text-center text-gray-400 text-sm">No ingredients yet — ask Toolie below, or edit by hand.</p>
        )}

        {/* Shopping list */}
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Shopping list</h4>
            <button data-testid="copy-shopping-btn" onClick={copyShoppingList}
              className="text-xs font-semibold text-rose-600 active:opacity-70">
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
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400" />
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

      {/* ── Steps (card/list/step layouts + per-step cooking timers) ────────── */}
      <RecipeSteps
        content={content}
        editMode={editMode}
        onUpdate={update}
        onAskAboutStep={onChat ? openChatWith : undefined}
        frosted={frosted}
      />

      {/* ── Notes ───────────────────────────────────────────────────────────── */}
      <div className={cardPad}>
        <h3 className="font-semibold text-gray-800 text-sm mb-2">My notes</h3>
        <textarea
          data-testid="recipe-notes"
          value={content.notes ?? ''}
          onChange={e => update({ notes: e.target.value })}
          placeholder="Add your own notes — tweaks, timings, what worked…"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
        />
      </div>

      {/* ── Tags ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(content.tags ?? []).map(t => (
          <span key={t} className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full">
            #{t}
            <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`} className="text-rose-400 hover:text-rose-700">×</button>
          </span>
        ))}
        <input
          data-testid="recipe-tag-input"
          value={tagDraft}
          onChange={e => setTagDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
          onBlur={addTag}
          placeholder="+ tag"
          className="text-xs w-20 border border-gray-200 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      {/* ── Ask Toolie (tap-to-talk) ─────────────────────────────────────────── */}
      {onChat && (
        <button
          data-testid="recipe-ask-toolie"
          onClick={() => setChatOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-950 active:bg-gray-900 text-left"
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)' }}>✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white leading-tight">Ask Toolie about this recipe</p>
            <p className="text-xs text-white/45 mt-0.5">Substitutions, scaling, tips — anything.</p>
          </div>
          <span className="text-white/30 text-sm flex-shrink-0">→</span>
        </button>
      )}

      {onChat && chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChatOpen(false)} />
          <div className="relative bg-gray-950 rounded-t-3xl shadow-2xl flex flex-col max-h-[85%] z-10 border-t border-rose-500/20">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="px-5 pb-2 pt-1 flex-shrink-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-rose-300 font-black">Ask Toolie</p>
              <p className="text-sm font-semibold text-white truncate">{content.title}</p>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0 flex flex-col gap-2">
              {chatMsgs.length === 0 && (
                <p className="text-xs text-white/40 py-2">
                  Ask anything about this recipe — "what can I swap for tahini?", "how long do leftovers keep?", "make step 3 simpler". I already know the whole recipe.
                </p>
              )}
              {chatMsgs.map((m, idx) => (
                <div key={idx} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'self-end bg-rose-600 text-white' : 'self-start bg-white/10 text-white/90'}`}>
                  {m.text}
                </div>
              ))}
              {chatBusy && <div className="self-start bg-white/10 text-white/60 rounded-2xl px-3.5 py-2 text-sm animate-pulse">Toolie is thinking…</div>}
            </div>

            {/* Quick prompts */}
            {chatMsgs.length === 0 && !chatBusy && (
              <div className="px-5 pb-2 flex flex-wrap gap-2 flex-shrink-0">
                {QUICK_PROMPTS.map(q => (
                  <button key={q} onClick={() => sendChat(q)} className="text-xs font-semibold text-rose-200 bg-rose-400/10 border border-rose-400/25 px-3 py-1.5 rounded-full active:bg-rose-400/20">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); sendChat(chatInput); }} className="flex gap-2 px-5 pb-6 pt-1 flex-shrink-0">
              <input
                data-testid="recipe-chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                autoFocus
                placeholder="Ask about an ingredient, a step, anything…"
                className="flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button type="submit" disabled={chatBusy || !chatInput.trim()}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-rose-500 text-white disabled:opacity-40 active:bg-rose-600 flex-shrink-0" aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </form>
          </div>
        </div>
      )}
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
          className="w-16 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-400" />
      ) : (
        <span className="font-semibold text-gray-800">{value}</span>
      )}
    </div>
  );
}
