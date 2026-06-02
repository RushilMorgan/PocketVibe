import React, { useState } from 'react';
import type {
  IdeaThinkingBoardContent,
  IdeaRisk,
  IdeaTargetUser,
  IdeaMoneyModel,
  IdeaNextStep,
  IdeaOpportunity,
  IdeaMapBranch,
} from '../../types';
import { ElementChatSheet } from '../shared/ElementChatSheet';
import { editIdeaElement, QuotaExceededError } from '../../services/aiService';
import { applyElementPatch } from '../../lib/applyElementPatch';
import { getElementActions } from '../../lib/ideaElementActions';
import { COLLECTION_KINDS, type IdeaElementKind } from '../../lib/ideaElements';
import { trackElementEdit } from '../../lib/analytics';
import { formatQuotaMessage } from '../../lib/quotaMessage';

interface Props {
  content: IdeaThinkingBoardContent;
  onChange: (updated: IdeaThinkingBoardContent) => void;
}

interface ActiveElement {
  kind: IdeaElementKind;
  id: string | null;
  preview: string;
  element: unknown;
}

type Tab = 'overview' | 'map' | 'risks' | 'plan' | 'money';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'overview', label: 'Overview', emoji: '💡' },
  { id: 'map',      label: 'Map',      emoji: '🗺️' },
  { id: 'risks',    label: 'Risks',    emoji: '⚠️' },
  { id: 'plan',     label: 'Plan',     emoji: '📋' },
  { id: 'money',    label: 'Money',    emoji: '💰' },
];

const SEVERITY_STYLES = {
  low:    { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
  medium: { badge: 'bg-amber-100 text-amber-700',     bar: 'bg-amber-400'   },
  high:   { badge: 'bg-red-100 text-red-600',         bar: 'bg-red-500'     },
};

const SCORE_META: { key: keyof IdeaThinkingBoardContent['scores']; label: string; color: string; invert?: boolean }[] = [
  { key: 'clarity',        label: 'Clarity',         color: '#7c3aed' },
  { key: 'usefulness',     label: 'Usefulness',      color: '#059669' },
  { key: 'easeToBuild',    label: 'Ease to build',   color: '#2563eb' },
  { key: 'moneyPotential', label: 'Money potential', color: '#d97706' },
  { key: 'riskLevel',      label: 'Risk level',      color: '#dc2626', invert: true },
  { key: 'confidence',     label: 'Confidence',      color: '#7c3aed' },
];

function scoreLabel(val: number, invert?: boolean): string {
  if (invert) return val <= 3 ? 'Low risk' : val <= 6 ? 'Medium risk' : 'High risk';
  return val <= 3 ? 'Low' : val <= 6 ? 'Medium' : 'High';
}

function overallHealth(scores: IdeaThinkingBoardContent['scores']): number {
  // Average of positive scores, inverted risk
  const positiveAvg = (scores.clarity + scores.usefulness + scores.easeToBuild + scores.moneyPotential + scores.confidence) / 5;
  const riskPenalty = (scores.riskLevel - 5) * 0.2; // penalise risk > 5
  return Math.max(1, Math.min(10, Math.round(positiveAvg - riskPenalty)));
}

// ── Visual map SVG ────────────────────────────────────────────────────────────

// A distinct colour per branch so the map reads like a real mind map.
const BRANCH_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777'];

function IdeaMapSVG({ content, onTapBranch, changedKey }: {
  content: IdeaThinkingBoardContent;
  onTapBranch?: (branch: IdeaMapBranch) => void;
  changedKey?: string | null;
}) {
  const branches = content.visualMap.branches.slice(0, 6);
  const cx = 160, cy = 160, r = 112;
  const centerR = 52;

  return (
    <div data-testid="idea-visual-map" className="w-full overflow-x-auto">
      <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto" aria-label="Idea map">
        {/* Curved branch lines */}
        {branches.map((branch, i) => {
          const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
          const angle = (i * 360) / branches.length - 90;
          const rad = (angle * Math.PI) / 180;
          const x2 = cx + r * Math.cos(rad);
          const y2 = cy + r * Math.sin(rad);
          // Control point bowed perpendicular to the spoke for a gentle curve.
          const mx = (cx + x2) / 2 + 14 * Math.cos(rad + Math.PI / 2);
          const my = (cy + y2) / 2 + 14 * Math.sin(rad + Math.PI / 2);
          return (
            <path
              key={branch.id}
              d={`M ${cx} ${cy} Q ${mx} ${my} ${x2} ${y2}`}
              stroke={color} strokeWidth="2" fill="none" opacity="0.4"
            />
          );
        })}

        {/* Center halo + circle */}
        <circle cx={cx} cy={cy} r={centerR + 6} fill="#7c3aed" opacity="0.12" />
        <circle cx={cx} cy={cy} r={centerR} fill="#7c3aed" />
        <foreignObject x={cx - centerR + 6} y={cy - 20} width={(centerR - 6) * 2} height={40}>
          <div style={{ fontSize: 10, color: 'white', textAlign: 'center', fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>
            {content.visualMap.center || content.title}
          </div>
        </foreignObject>

        {/* Branch nodes */}
        {branches.map((branch, i) => {
          const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
          const angle = (i * 360) / branches.length - 90;
          const rad = (angle * Math.PI) / 180;
          const nx = cx + r * Math.cos(rad);
          const ny = cy + r * Math.sin(rad);
          const nodeR = 31;
          return (
            <g key={branch.id}>
              <circle cx={nx} cy={ny} r={nodeR} fill="#fff" stroke={color} strokeWidth="2" />
              <circle cx={nx} cy={ny} r={nodeR} fill={color} opacity="0.08" />
              <foreignObject x={nx - nodeR + 4} y={ny - 14} width={(nodeR - 4) * 2} height={28}>
                <div style={{ fontSize: 8.5, color, textAlign: 'center', fontWeight: 700, lineHeight: 1.15, wordBreak: 'break-word' }}>
                  {branch.label}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* Branch items below map — colour-matched to the nodes */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {branches.map((branch, i) => {
          const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
          return (
            <div
              key={branch.id}
              onClick={onTapBranch ? () => onTapBranch(branch) : undefined}
              className={`bg-white rounded-xl p-3 border border-gray-100${onTapBranch ? ' cursor-pointer active:scale-[0.99] transition-transform' : ''}${changedKey === `mapBranch:${branch.id}` ? ' ring-2 ring-violet-400 ring-offset-1' : ''}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <p className="text-xs font-bold text-gray-700">{branch.label}</p>
              </div>
              <ul className="space-y-0.5">
                {branch.items.slice(0, 3).map((item, j) => (
                  <li key={j} className="text-xs text-gray-500 flex items-start gap-1">
                    <span className="mt-0.5 flex-shrink-0" style={{ color }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IdeaThinkingBoardRenderer({ content, onChange }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [editMode, setEditMode] = useState(false);

  // ── Tap-to-talk inline AI ─────────────────────────────────────────────────
  const [active, setActive] = useState<ActiveElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [changedKey, setChangedKey] = useState<string | null>(null);

  function update(patch: Partial<IdeaThinkingBoardContent>) {
    onChange({ ...content, ...patch });
  }

  /** Open the tap-to-talk sheet for an element (view mode only). */
  function openElement(kind: IdeaElementKind, id: string | null, preview: string, element: unknown) {
    if (editMode) return;
    setErrorText(null);
    setActive({ kind, id, preview, element });
  }

  /** Run an AI instruction against the active element and merge the patch in place. */
  async function runElementEdit(instruction: string) {
    if (!active) return;
    setBusy(true);
    setErrorText(null);
    try {
      const patch = await editIdeaElement(content, active.kind, active.element, instruction);
      onChange(applyElementPatch(content, active.kind, active.id, patch));
      trackElementEdit(active.kind);
      const key = `${active.kind}:${active.id ?? ''}`;
      setActive(null);
      setChangedKey(key);
      setTimeout(() => setChangedKey(k => (k === key ? null : k)), 1400);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setErrorText(formatQuotaMessage({ kind: err.kind, tier: err.tier, resetsAt: err.resetsAt, canSignIn: false }));
      } else {
        setErrorText("Couldn't update that — please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Deterministic delete for collection elements. */
  function deleteActive() {
    if (!active || !active.id) return;
    const id = active.id;
    switch (active.kind) {
      case 'risk':        update({ risks: content.risks.filter(r => r.id !== id) }); break;
      case 'moneyIdea':   update({ moneyIdeas: content.moneyIdeas.filter(m => m.id !== id) }); break;
      case 'targetUser':  update({ targetUsers: content.targetUsers.filter(u => u.id !== id) }); break;
      case 'nextStep':    update({ nextSteps: content.nextSteps.filter(s => s.id !== id) }); break;
      case 'opportunity': update({ opportunities: content.opportunities.filter(o => o.id !== id) }); break;
      default: break;
    }
    setActive(null);
  }

  /** Tappable card props for view mode: opens the sheet + highlights after a change. */
  function talkCard(base: string, kind: IdeaElementKind, id: string | null) {
    const tappable = !editMode ? ' cursor-pointer active:scale-[0.99] transition-transform' : '';
    const highlight = changedKey === `${kind}:${id ?? ''}` ? ' ring-2 ring-violet-400 ring-offset-1' : '';
    return base + tappable + highlight;
  }

  const health = overallHealth(content.scores);
  const healthColor = health >= 7 ? '#059669' : health >= 5 ? '#d97706' : '#dc2626';
  const healthLabel = health >= 7 ? 'Looking good!' : health >= 5 ? 'Promising' : 'Needs work';

  // ── Overview tab ────────────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <div className="flex flex-col gap-4">
        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-4 pb-3" style={{ background: 'linear-gradient(135deg, #7c3aed15, #a855f715)' }}>
            {editMode ? (
              <input
                data-testid="edit-idea-title"
                value={content.title}
                onChange={e => update({ title: e.target.value })}
                className="w-full text-base font-bold text-gray-900 border border-violet-200 rounded-lg px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            ) : (
              <h2 data-testid="idea-title" className="text-base font-bold text-gray-900 mb-2">{content.title}</h2>
            )}
            {editMode ? (
              <textarea
                data-testid="edit-idea-summary"
                value={content.ideaSummary}
                onChange={e => update({ ideaSummary: e.target.value })}
                rows={3}
                className="w-full text-sm text-gray-700 border border-violet-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            ) : (
              <p
                onClick={() => openElement('summary', null, content.ideaSummary, content.ideaSummary)}
                className={talkCard('text-sm text-gray-600 leading-relaxed rounded-lg', 'summary', null)}
              >{content.ideaSummary}</p>
            )}
          </div>

          {/* Problem / Solution */}
          <div className="divide-y divide-gray-50">
            <div className="px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">What problem does it solve?</p>
              {editMode ? (
                <textarea
                  data-testid="edit-idea-problem"
                  value={content.problem}
                  onChange={e => update({ problem: e.target.value })}
                  rows={2}
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              ) : (
                <p
                  onClick={() => openElement('problem', null, content.problem, content.problem)}
                  className={talkCard('text-sm text-gray-700 rounded-lg', 'problem', null)}
                >{content.problem}</p>
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">Your solution</p>
              {editMode ? (
                <textarea
                  data-testid="edit-idea-solution"
                  value={content.solution}
                  onChange={e => update({ solution: e.target.value })}
                  rows={2}
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              ) : (
                <p
                  onClick={() => openElement('solution', null, content.solution, content.solution)}
                  className={talkCard('text-sm text-gray-700 rounded-lg', 'solution', null)}
                >{content.solution}</p>
              )}
            </div>
          </div>
        </div>

        {/* Idea health score */}
        <div
          data-testid="idea-health-score"
          onClick={() => openElement('scores', null, 'Idea health scores', content.scores)}
          className={talkCard('bg-white rounded-2xl border border-gray-100 p-4', 'scores', null)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Idea health</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black" style={{ color: healthColor }}>{health}/10</span>
              <span className="text-xs font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {SCORE_META.map(({ key, label, color, invert }) => {
              const val = content.scores[key];
              const pct = (val / 10) * 100;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-600">{label}</span>
                    {editMode ? (
                      <input
                        data-testid={`score-input-${key}`}
                        type="number"
                        min={1} max={10}
                        value={val}
                        onChange={e => {
                          const v = Math.max(1, Math.min(10, Number(e.target.value)));
                          update({ scores: { ...content.scores, [key]: v } });
                        }}
                        className="w-12 text-xs text-right border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-gray-500">{val}/10 · {scoreLabel(val, invert)}</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target users */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Who is this for?</h3>
            {editMode && (
              <button
                data-testid="add-target-user-btn"
                onClick={() => update({
                  targetUsers: [...content.targetUsers, {
                    id: `u-${Date.now()}`, name: 'New user', need: 'Their need', whyTheyCare: 'Why they care',
                  }],
                })}
                className="text-xs text-violet-600 font-semibold"
              >
                + Add
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {content.targetUsers.map(user => (
              <div
                key={user.id}
                onClick={() => openElement('targetUser', user.id, user.name, user)}
                className={talkCard('bg-violet-50 rounded-xl p-3', 'targetUser', user.id)}
              >
                {editMode ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={user.name}
                        onChange={e => update({ targetUsers: content.targetUsers.map(u => u.id === user.id ? { ...u, name: e.target.value } : u) })}
                        className="flex-1 text-xs font-bold border border-violet-200 rounded px-2 py-1 focus:outline-none"
                        placeholder="Who they are"
                      />
                      <button
                        data-testid={`delete-user-${user.id}`}
                        onClick={() => update({ targetUsers: content.targetUsers.filter(u => u.id !== user.id) })}
                        className="text-red-400 text-xs"
                      >✕</button>
                    </div>
                    <input
                      value={user.need}
                      onChange={e => update({ targetUsers: content.targetUsers.map(u => u.id === user.id ? { ...u, need: e.target.value } : u) })}
                      className="w-full text-xs border border-violet-200 rounded px-2 py-1 focus:outline-none"
                      placeholder="What they need"
                    />
                    <input
                      value={user.whyTheyCare}
                      onChange={e => update({ targetUsers: content.targetUsers.map(u => u.id === user.id ? { ...u, whyTheyCare: e.target.value } : u) })}
                      className="w-full text-xs border border-violet-200 rounded px-2 py-1 focus:outline-none"
                      placeholder="Why they would care"
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-bold text-violet-800">{user.name}</p>
                    <p className="text-xs text-violet-700 mt-0.5">Needs: {user.need}</p>
                    <p className="text-xs text-violet-600 mt-0.5">Why they care: {user.whyTheyCare}</p>
                  </>
                )}
              </div>
            ))}
            {content.targetUsers.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No target users yet — ask Toolie to add some</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Notes</h3>
          <textarea
            data-testid="edit-notes"
            value={content.notes}
            onChange={e => update({ notes: e.target.value })}
            rows={4}
            placeholder="Any extra thoughts, ideas, or reminders…"
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>
    );
  }

  // ── Map tab ─────────────────────────────────────────────────────────────────

  function renderMap() {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Visual idea map</h3>
          <IdeaMapSVG
            content={content}
            changedKey={changedKey}
            onTapBranch={editMode ? undefined : (b) => openElement('mapBranch', b.id, b.label, b)}
          />
        </div>

        {content.whyNow && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Why now?</p>
            {editMode ? (
              <textarea
                value={content.whyNow}
                onChange={e => update({ whyNow: e.target.value })}
                rows={2}
                className="w-full text-sm text-amber-900 border border-amber-200 rounded-lg px-2 py-1.5 resize-none bg-white focus:outline-none"
              />
            ) : (
              <p className="text-sm text-amber-900">{content.whyNow}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Risks tab ───────────────────────────────────────────────────────────────

  function renderRisks() {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Honest concerns about this idea — good to know now.</p>
          {editMode && (
            <button
              data-testid="add-risk-btn"
              onClick={() => update({
                risks: [...content.risks, {
                  id: `r-${Date.now()}`, title: 'New risk', severity: 'medium', note: 'Add details here',
                }],
              })}
              className="text-xs text-violet-600 font-semibold flex-shrink-0"
            >
              + Add risk
            </button>
          )}
        </div>

        {content.risks.map(risk => {
          const styles = SEVERITY_STYLES[risk.severity];
          return (
            <div
              key={risk.id}
              data-testid={`risk-card-${risk.id}`}
              onClick={() => openElement('risk', risk.id, risk.title, risk)}
              className={talkCard('bg-white rounded-2xl border border-gray-100 p-4', 'risk', risk.id)}
            >
              {editMode ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={risk.title}
                      onChange={e => update({ risks: content.risks.map(r => r.id === risk.id ? { ...r, title: e.target.value } : r) })}
                      className="flex-1 text-sm font-semibold border border-gray-200 rounded px-2 py-1 focus:outline-none"
                      placeholder="Risk title"
                    />
                    <select
                      value={risk.severity}
                      onChange={e => update({ risks: content.risks.map(r => r.id === risk.id ? { ...r, severity: e.target.value as IdeaRisk['severity'] } : r) })}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <button
                      data-testid={`delete-risk-${risk.id}`}
                      onClick={() => update({ risks: content.risks.filter(r => r.id !== risk.id) })}
                      className="text-red-400 text-xs"
                    >✕</button>
                  </div>
                  <textarea
                    value={risk.note}
                    onChange={e => update({ risks: content.risks.map(r => r.id === risk.id ? { ...r, note: e.target.value } : r) })}
                    rows={2}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none"
                    placeholder="More detail…"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800">{risk.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${styles.badge}`}>
                      {risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)} risk
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{risk.note}</p>
                </>
              )}
            </div>
          );
        })}

        {content.risks.length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm text-gray-500">No risks identified yet. Ask Toolie to find the hard truths.</p>
          </div>
        )}

        {/* Opportunities */}
        {content.opportunities.length > 0 && (
          <div className="mt-2">
            <h3 className="text-sm font-bold text-gray-800 mb-2">What could go really well?</h3>
            <div className="flex flex-col gap-2">
              {content.opportunities.map(opp => (
                <div
                  key={opp.id}
                  onClick={() => openElement('opportunity', opp.id, opp.title, opp)}
                  className={talkCard('bg-emerald-50 rounded-xl p-3', 'opportunity', opp.id)}
                >
                  <p className="text-xs font-bold text-emerald-800">{opp.title}</p>
                  {opp.note && <p className="text-xs text-emerald-700 mt-0.5">{opp.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Plan tab ────────────────────────────────────────────────────────────────

  function renderPlan() {
    return (
      <div className="flex flex-col gap-4">
        {/* Next steps */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">What to do next</h3>
            <button
              data-testid="add-next-step-btn"
              onClick={() => update({
                nextSteps: [...content.nextSteps, { id: `ns-${Date.now()}`, label: 'New step', done: false }],
              })}
              className="text-xs text-violet-600 font-semibold"
            >
              + Add step
            </button>
          </div>

          {content.nextSteps.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Ask Toolie to create a 7-day test plan</p>
          )}

          <div className="space-y-2">
            {content.nextSteps.map((step, idx) => (
              <div key={step.id} className={talkCard('flex items-center gap-2', 'nextStep', step.id)}>
                <button
                  data-testid={`toggle-step-${step.id}`}
                  onClick={() => update({
                    nextSteps: content.nextSteps.map(s => s.id === step.id ? { ...s, done: !s.done } : s),
                  })}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    step.done ? 'bg-violet-600 border-violet-600' : 'border-gray-300'
                  }`}
                >
                  {step.done && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                {editMode ? (
                  <input
                    data-testid={`edit-step-${step.id}`}
                    value={step.label}
                    onChange={e => update({ nextSteps: content.nextSteps.map(s => s.id === step.id ? { ...s, label: e.target.value } : s) })}
                    className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none"
                  />
                ) : (
                  <span
                    onClick={() => openElement('nextStep', step.id, step.label, step)}
                    className={`text-sm flex-1 ${step.done ? 'line-through text-gray-400' : 'text-gray-800'}`}
                  >
                    {idx + 1}. {step.label}
                  </span>
                )}
                {editMode && (
                  <button
                    data-testid={`delete-step-${step.id}`}
                    onClick={() => update({ nextSteps: content.nextSteps.filter(s => s.id !== step.id) })}
                    className="text-red-400 text-xs"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Money tab ───────────────────────────────────────────────────────────────

  function renderMoney() {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">Ways this idea could make money — pick what fits your style.</p>
        {editMode && (
          <button
            data-testid="add-money-idea-btn"
            onClick={() => update({
              moneyIdeas: [...content.moneyIdeas, {
                id: `m-${Date.now()}`, model: 'New idea', note: 'How this would work', confidence: 5,
              }],
            })}
            className="text-xs text-violet-600 font-semibold text-left"
          >
            + Add money idea
          </button>
        )}

        {content.moneyIdeas.map(idea => (
          <div
            key={idea.id}
            data-testid={`money-card-${idea.id}`}
            onClick={() => openElement('moneyIdea', idea.id, idea.model, idea)}
            className={talkCard('bg-white rounded-2xl border border-gray-100 p-4', 'moneyIdea', idea.id)}
          >
            {editMode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={idea.model}
                    onChange={e => update({ moneyIdeas: content.moneyIdeas.map(m => m.id === idea.id ? { ...m, model: e.target.value } : m) })}
                    className="flex-1 text-sm font-bold border border-gray-200 rounded px-2 py-1 focus:outline-none"
                    placeholder="Business model"
                  />
                  <button
                    data-testid={`delete-money-${idea.id}`}
                    onClick={() => update({ moneyIdeas: content.moneyIdeas.filter(m => m.id !== idea.id) })}
                    className="text-red-400 text-xs"
                  >✕</button>
                </div>
                <textarea
                  value={idea.note}
                  onChange={e => update({ moneyIdeas: content.moneyIdeas.map(m => m.id === idea.id ? { ...m, note: e.target.value } : m) })}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none"
                  placeholder="How this would work…"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <input
                    type="number" min={1} max={10}
                    value={idea.confidence}
                    onChange={e => update({ moneyIdeas: content.moneyIdeas.map(m => m.id === idea.id ? { ...m, confidence: Math.max(1, Math.min(10, Number(e.target.value))) } : m) })}
                    className="w-12 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">/10</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-gray-800">💰 {idea.model}</p>
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                    {idea.confidence}/10 confidence
                  </span>
                </div>
                <p className="text-xs text-gray-500">{idea.note}</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${(idea.confidence / 10) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ))}

        {content.moneyIdeas.length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-2xl mb-2">💡</p>
            <p className="text-sm text-gray-500">No money ideas yet. Ask Toolie to suggest some.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const activeActions = active ? getElementActions(active.kind, active.element, content) : [];

  return (
    <>
    <div className="flex flex-col gap-0 pb-4">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">💡</span>
          <span className="text-xs font-bold text-gray-700 truncate">Idea Board</span>
          <span
            data-testid="health-badge"
            className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: `${healthColor}20`, color: healthColor }}
          >
            {health}/10
          </span>
        </div>
        <button
          data-testid="edit-idea-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ${
            editMode ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit idea'}
        </button>
      </div>

      {/* Tap-to-talk hint (view mode only) */}
      {!editMode && (
        <div className="px-4 py-1.5 bg-violet-50/60 border-b border-violet-100/60 flex items-center gap-1.5">
          <span className="text-violet-400 text-[11px]">✦</span>
          <p className="text-[11px] text-violet-600/80">Tap any card to talk to Toolie about it.</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex overflow-x-auto px-3 py-2 gap-1 bg-white border-b border-gray-100 no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-colors ${
              tab === t.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'overview' && renderOverview()}
        {tab === 'map'      && renderMap()}
        {tab === 'risks'    && renderRisks()}
        {tab === 'plan'     && renderPlan()}
        {tab === 'money'    && renderMoney()}
      </div>
    </div>

    {/* Tap-to-talk sheet */}
    {active && (
      <ElementChatSheet
        open
        kind={active.kind}
        preview={active.preview}
        actions={activeActions}
        busy={busy}
        errorText={errorText}
        onAction={runElementEdit}
        onLocalAction={active.id && COLLECTION_KINDS.includes(active.kind) ? () => deleteActive() : undefined}
        onClose={() => { if (!busy) { setActive(null); setErrorText(null); } }}
      />
    )}
    </>
  );
}
