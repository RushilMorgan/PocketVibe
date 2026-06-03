import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// ── Interactive mind map ──────────────────────────────────────────────────────

interface MapPan { x: number; y: number; scale: number; }

function IdeaMapSVG({ content, onTapBranch, changedKey, revealed }: {
  content: IdeaThinkingBoardContent;
  onTapBranch?: (branch: IdeaMapBranch) => void;
  changedKey?: string | null;
  revealed?: boolean;
}) {
  const branches = content.visualMap.branches.slice(0, 6);
  const cx = 160, cy = 160, r = 112, centerR = 52, nodeR = 31;

  // Pan / zoom state
  const [pan, setPan] = useState<MapPan>({ x: 0, y: 0, scale: 1 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastDist = useRef<number | null>(null);

  // Expanded branch (tap to reveal items on canvas)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointers.current.values());
    if (pts.length === 1) {
      // Single finger pan
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setPan(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    } else if (pts.length === 2) {
      // Pinch zoom
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastDist.current !== null) {
        const ratio = dist / lastDist.current;
        setPan(p => ({ ...p, scale: Math.min(2.5, Math.max(0.6, p.scale * ratio)) }));
      }
      lastDist.current = dist;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) lastDist.current = null;
  }, []);

  function resetView() { setPan({ x: 0, y: 0, scale: 1 }); }

  function handleNodeTap(branch: IdeaMapBranch) {
    if (expandedId === branch.id) {
      // Already expanded — open the AI sheet on second tap
      onTapBranch?.(branch);
    } else {
      setExpandedId(branch.id);
    }
  }

  return (
    <div data-testid="idea-visual-map" className="w-full select-none">
      {/* Hint */}
      <p className="text-[10px] text-gray-400 text-center mb-2">Drag to pan · Pinch to zoom · Tap a node to explore</p>

      {/* SVG canvas */}
      <div
        style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="overflow-hidden rounded-2xl bg-gray-50 border border-gray-100"
      >
        <svg viewBox="0 0 320 320" className="w-full" aria-label="Idea map">
          <g transform={`translate(${pan.x},${pan.y}) scale(${pan.scale})`} style={{ transformOrigin: '160px 160px' }}>
            {/* Curved branch lines */}
            {branches.map((branch, i) => {
              const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
              const angle = (i * 360) / branches.length - 90;
              const rad = (angle * Math.PI) / 180;
              const x2 = cx + r * Math.cos(rad);
              const y2 = cy + r * Math.sin(rad);
              const mx = (cx + x2) / 2 + 14 * Math.cos(rad + Math.PI / 2);
              const my = (cy + y2) / 2 + 14 * Math.sin(rad + Math.PI / 2);
              return (
                <path key={branch.id} d={`M ${cx} ${cy} Q ${mx} ${my} ${x2} ${y2}`}
                  stroke={color} strokeWidth="2" fill="none"
                  opacity={revealed ? 0.4 : 0}
                  style={{ transition: 'opacity 0.4s ease', transitionDelay: `${i * 80 + 200}ms` }}
                />
              );
            })}

            {/* Center halo + circle — pulses once on reveal */}
            <circle cx={cx} cy={cy} r={centerR + 6} fill="#7c3aed" opacity="0.12" />
            <circle cx={cx} cy={cy} r={centerR} fill="#7c3aed"
              style={{ cursor: 'pointer' }}
              onClick={resetView}
            />
            <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="800">
              {(content.visualMap.center || content.title).slice(0, 16)}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill="white" fontSize="7" opacity="0.7">
              tap to reset view
            </text>

            {/* Branch nodes — animated reveal */}
            {branches.map((branch, i) => {
              const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
              const angle = (i * 360) / branches.length - 90;
              const rad = (angle * Math.PI) / 180;
              const nx = cx + r * Math.cos(rad);
              const ny = cy + r * Math.sin(rad);
              const isExpanded = expandedId === branch.id;
              const isChanged = changedKey === `mapBranch:${branch.id}`;
              const scale = isExpanded ? 1.18 : 1;

              return (
                // Outer <g>: fixed position only — never animated so translate survives
                <g
                  key={branch.id}
                  style={{ transform: `translate(${nx}px,${ny}px)`, cursor: 'pointer' }}
                  onClick={() => handleNodeTap(branch)}
                >
                  {/* Inner <g>: animation + expand scale only — no translate here */}
                <g
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: '0px 0px',
                    transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    opacity: revealed ? 1 : 0,
                    animation: revealed ? `node-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 80 + 100}ms forwards` : undefined,
                  }}
                >
                  <circle cx={0} cy={0} r={nodeR} fill={isChanged ? color : '#fff'} stroke={color} strokeWidth={isExpanded ? 2.5 : 2} />
                  <circle cx={0} cy={0} r={nodeR} fill={color} opacity={isExpanded ? 0.18 : 0.08} />
                  {/* Label */}
                  <text x={0} y={-3} textAnchor="middle" fill={isChanged ? '#fff' : color}
                    fontSize="8" fontWeight="700">
                    {branch.label.length > 9 ? branch.label.slice(0, 8) + '…' : branch.label}
                  </text>
                  <text x={0} y={8} textAnchor="middle" fill={isChanged ? 'rgba(255,255,255,0.7)' : `${color}99`}
                    fontSize="6.5">
                    {branch.items.length} items
                  </text>

                  {/* Expanded items overlay */}
                  {isExpanded && (
                    <g>
                      {/* Backdrop */}
                      <rect
                        x={-58} y={nodeR + 4}
                        width={116} height={Math.min(branch.items.length, 3) * 16 + 10}
                        rx={6} fill="white" stroke={color} strokeWidth="1" opacity="0.97"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}
                      />
                      {branch.items.slice(0, 3).map((item, j) => (
                        <text key={j} x={-50} y={nodeR + 17 + j * 16}
                          fill="#374151" fontSize="7" fontWeight="500">
                          · {item.length > 20 ? item.slice(0, 19) + '…' : item}
                        </text>
                      ))}
                      {branch.items.length > 3 && (
                        <text x={0} y={nodeR + 17 + 3 * 16} textAnchor="middle"
                          fill={color} fontSize="6.5" fontWeight="600">
                          +{branch.items.length - 3} more · tap for AI
                        </text>
                      )}
                    </g>
                  )}
                </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Tap hint when a node is expanded */}
      {expandedId && (
        <p className="text-[10px] text-violet-500 text-center mt-1.5">
          Tap the node again to ask Toolie about it ✦
        </p>
      )}
    </div>
  );
}

// ── Radar / spider chart ─────────────────────────────────────────────────────

function RadarChart({ scores, revealed, onTap }: {
  scores: IdeaThinkingBoardContent['scores'];
  revealed?: boolean;
  onTap?: () => void;
}) {
  const CX = 110, CY = 100, maxR = 78;
  const n = SCORE_META.length; // 6
  const axes = SCORE_META.map((m, i) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    return { ...m, angle, ax: Math.cos(angle), ay: Math.sin(angle) };
  });

  // Polygon points for the score shape
  const points = axes.map(({ key, ax, ay }) => {
    const val = scores[key] ?? 5;
    const d = (val / 10) * maxR;
    return `${CX + d * ax},${CY + d * ay}`;
  }).join(' ');

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0].map(pct =>
    axes.map(({ ax, ay }) => `${CX + pct * maxR * ax},${CY + pct * maxR * ay}`).join(' ')
  );

  return (
    <div
      data-testid="radar-chart"
      onClick={onTap}
      style={{ cursor: onTap ? 'pointer' : 'default' }}
    >
      <svg viewBox={`0 0 ${CX * 2 + 40} ${CY * 2 + 20}`} className="w-full" aria-label="Idea health radar">
        {/* Grid rings */}
        {rings.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="#e5e7eb" strokeWidth="0.8" />
        ))}

        {/* Axis spokes */}
        {axes.map(({ ax, ay, key }) => (
          <line key={key}
            x1={CX} y1={CY}
            x2={CX + maxR * ax} y2={CY + maxR * ay}
            stroke="#e5e7eb" strokeWidth="0.8"
          />
        ))}

        {/* Score polygon fill */}
        <polygon
          points={points}
          fill="rgba(124,58,237,0.12)"
          stroke="#7c3aed"
          strokeWidth="1.8"
          strokeLinejoin="round"
          style={{
            strokeDasharray: revealed ? undefined : '1000',
            strokeDashoffset: revealed ? 0 : 1000,
            transition: 'stroke-dashoffset 1.2s ease-out, fill-opacity 0.8s ease-out',
            fillOpacity: revealed ? 1 : 0,
          }}
        />

        {/* Score dots */}
        {axes.map(({ key, angle, ax, ay, color }, i) => {
          const val = scores[key] ?? 5;
          const d = (val / 10) * maxR;
          return (
            <circle
              key={key}
              cx={CX + d * ax} cy={CY + d * ay}
              r={4}
              fill={color}
              style={{
                opacity: revealed ? 1 : 0,
                animation: revealed ? `node-pop 0.3s ease-out ${i * 80 + 800}ms forwards` : undefined,
              }}
            />
          );
        })}

        {/* Axis labels */}
        {axes.map(({ key, label, ax, ay }) => {
          const lx = CX + (maxR + 14) * ax;
          const ly = CY + (maxR + 14) * ay;
          return (
            <text key={key} x={lx} y={ly + 3}
              textAnchor="middle" fontSize="7" fill="#6b7280" fontWeight="600">
              {label.split(' ')[0]}
            </text>
          );
        })}

        {/* Center score */}
        <text x={CX} y={CY + 3} textAnchor="middle" fontSize="10" fill="#7c3aed" fontWeight="900">
          {scores.confidence}/10
        </text>
      </svg>
    </div>
  );
}

// ── Risk / Reward Matrix ──────────────────────────────────────────────────────

const SEVERITY_X: Record<string, number> = { low: 0.82, medium: 0.50, high: 0.18 };
const IMPACT_Y:   Record<string, number> = { low: 0.75, medium: 0.50, high: 0.20 };

function RiskMatrixChart({ content, onTapRisk, revealed }: {
  content: IdeaThinkingBoardContent;
  onTapRisk?: (risk: IdeaRisk) => void;
  revealed?: boolean;
}) {
  // Simple quadrant grid: no tiny SVG text — dots with numbers, legend below
  const W = 280, H = 220;
  const pad = 20;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const midX = pad + innerW / 2;
  const midY = pad + innerH / 2;

  function px(xFrac: number) { return pad + xFrac * innerW; }
  function py(yFrac: number) { return pad + yFrac * innerH; }

  // Jitter dots that land on the same cell
  const seen = new Map<string, number>();
  function jitter(key: string) {
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const spread = n * 16;
    const a = n * 2.4;
    return { dx: n === 0 ? 0 : Math.cos(a) * spread, dy: n === 0 ? 0 : Math.sin(a) * spread };
  }

  return (
    <div data-testid="risk-matrix-chart" className="bg-white rounded-2xl border border-gray-100 p-4">
      <h4 className="text-sm font-bold text-gray-800 mb-1">Risk vs Reward</h4>
      <p className="text-xs text-gray-400 mb-3">Where each risk sits — tap a dot to explore it with Toolie</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Risk reward matrix">
        {/* Quadrant backgrounds */}
        <rect x={pad}   y={pad}   width={innerW/2} height={innerH/2} fill="#dc2626" opacity="0.05" rx="4"/>
        <rect x={midX}  y={pad}   width={innerW/2} height={innerH/2} fill="#059669" opacity="0.08" rx="4"/>
        <rect x={pad}   y={midY}  width={innerW/2} height={innerH/2} fill="#9ca3af" opacity="0.05" rx="4"/>
        <rect x={midX}  y={midY}  width={innerW/2} height={innerH/2} fill="#d97706" opacity="0.06" rx="4"/>

        {/* Divider lines */}
        <line x1={midX} y1={pad} x2={midX} y2={pad+innerH} stroke="#e5e7eb" strokeWidth="1.5"/>
        <line x1={pad} y1={midY} x2={pad+innerW} y2={midY} stroke="#e5e7eb" strokeWidth="1.5"/>

        {/* Quadrant labels — readable size, corners only */}
        <text x={pad+6} y={pad+16} fontSize="10" fill="#dc2626" fontWeight="700">⚠️ Danger</text>
        <text x={midX+6} y={pad+16} fontSize="10" fill="#059669" fontWeight="700">✅ Sweet spot</text>
        <text x={pad+6} y={pad+innerH-6} fontSize="10" fill="#9ca3af" fontWeight="600">Low priority</text>
        <text x={midX+6} y={pad+innerH-6} fontSize="10" fill="#d97706" fontWeight="600">Worth it</text>

        {/* Axis labels */}
        <text x={pad} y={pad-5} fontSize="9" fill="#9ca3af">← High risk</text>
        <text x={pad+innerW} y={pad-5} fontSize="9" fill="#9ca3af" textAnchor="end">Low risk →</text>
        <text x={pad-6} y={midY-6} fontSize="9" fill="#9ca3af" textAnchor="middle"
          transform={`rotate(-90 ${pad-6} ${midY})`}>High reward</text>

        {/* Opportunity dots */}
        {content.opportunities.slice(0, 3).map((opp, i) => (
          <g key={opp.id} style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s ease ${i*80+300}ms` }}>
            <circle cx={px(0.68 + i*0.1)} cy={py(0.15 + i*0.1)} r={12} fill="#059669" opacity="0.15"/>
            <circle cx={px(0.68 + i*0.1)} cy={py(0.15 + i*0.1)} r={8} fill="#059669" opacity="0.75"/>
            <text x={px(0.68 + i*0.1)} y={py(0.15 + i*0.1)+3} textAnchor="middle" fontSize="9" fill="white" fontWeight="800">✦</text>
          </g>
        ))}

        {/* Risk dots — numbered, no text inside */}
        {content.risks.map((risk, i) => {
          const xF = SEVERITY_X[risk.severity] ?? 0.5;
          const yF = IMPACT_Y[risk.impact ?? 'medium'] ?? 0.5;
          const key = `${Math.round(xF*3)}_${Math.round(yF*3)}`;
          const { dx, dy } = jitter(key);
          const color = risk.severity === 'high' ? '#dc2626' : risk.severity === 'medium' ? '#d97706' : '#6b7280';
          return (
            <g key={risk.id}
              onClick={() => onTapRisk?.(risk)}
              style={{ cursor: onTapRisk ? 'pointer' : 'default', opacity: revealed ? 1 : 0, transition: `opacity 0.4s ease ${i*80+200}ms` }}
            >
              <circle cx={px(xF)+dx} cy={py(yF)+dy} r={18} fill={color} opacity="0.12"/>
              <circle cx={px(xF)+dx} cy={py(yF)+dy} r={12} fill={color} opacity="0.85"/>
              <text x={px(xF)+dx} y={py(yF)+dy+4} textAnchor="middle" fontSize="11" fill="white" fontWeight="900">{i+1}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend — readable list below the chart */}
      <div className="mt-3 space-y-2">
        {content.risks.map((risk, i) => {
          const color = risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-amber-500' : 'bg-gray-400';
          return (
            <button
              key={risk.id}
              onClick={() => onTapRisk?.(risk)}
              className="w-full flex items-start gap-2.5 text-left active:bg-gray-50 rounded-lg p-1 -mx-1"
            >
              <span className={`w-5 h-5 rounded-full ${color} text-white text-[10px] font-black flex-shrink-0 flex items-center justify-center mt-0.5`}>
                {i+1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 leading-snug">{risk.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{risk.note?.slice(0, 80)}{(risk.note?.length ?? 0) > 80 ? '…' : ''}</p>
              </div>
            </button>
          );
        })}
        {content.opportunities.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex-shrink-0 flex items-center justify-center">✦</span>
            <p className="text-[10px] text-gray-500">{content.opportunities.length} opportunit{content.opportunities.length === 1 ? 'y' : 'ies'} (top-right)</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IdeaThinkingBoardRenderer({ content, onChange }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [editMode, setEditMode] = useState(false);

  // ── Reveal animation — triggers stagger on first mount ────────────────────
  const [revealed, setRevealed] = useState(false);
  const [displayHealth, setDisplayHealth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Count up the health badge
  const health = overallHealth(content.scores);
  useEffect(() => {
    if (!revealed) return;
    setDisplayHealth(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setDisplayHealth(current);
      if (current >= health) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [revealed, health]);

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

  /** Staggered reveal class + style for a section card. n = 0,1,2,… */
  function revealSection(n: number): { className: string; style: React.CSSProperties } {
    return {
      className: revealed ? 'animate-fade-in' : 'opacity-0',
      style: { animationDelay: `${n * 80}ms` },
    };
  }

  /** Tappable card props for view mode: opens the sheet + highlights after a change. */
  function talkCard(base: string, kind: IdeaElementKind, id: string | null) {
    const tappable = !editMode ? ' cursor-pointer active:scale-[0.99] transition-transform' : '';
    const highlight = changedKey === `${kind}:${id ?? ''}` ? ' ring-2 ring-violet-400 ring-offset-1' : '';
    return base + tappable + highlight;
  }

  const healthColor = health >= 7 ? '#059669' : health >= 5 ? '#d97706' : '#dc2626';
  const healthLabel = health >= 7 ? 'Looking good!' : health >= 5 ? 'Promising' : 'Needs work';

  // ── Overview tab ────────────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <div className="flex flex-col gap-4">
        {/* Hero card */}
        <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${revealed ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '0ms' }}>
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
          className={`${talkCard('bg-white rounded-2xl border border-gray-100 p-4', 'scores', null)} ${revealed ? 'animate-fade-in' : 'opacity-0'}`}
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-800">Idea health</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black" style={{ color: healthColor }}>{health}/10</span>
              <span className="text-xs font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
            </div>
          </div>

          {/* Radar chart in view mode */}
          {!editMode && (
            <RadarChart
              scores={content.scores}
              revealed={revealed}
              onTap={() => openElement('scores', null, 'Idea health scores', content.scores)}
            />
          )}

          {/* Score bars — shown in edit mode for editing, and as compact list below radar */}
          <div className={`space-y-2 ${editMode ? '' : 'mt-2'}`}>
            {SCORE_META.map(({ key, label, color, invert }, idx) => {
              const val = content.scores[key];
              const pct = (val / 10) * 100;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-500">{label}</span>
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
                      <span className="text-[10px] font-semibold text-gray-400">{val}/10</span>
                    )}
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: color,
                        animation: revealed ? `bar-grow 0.8s ease-out forwards` : undefined,
                        animationDelay: `${idx * 100 + 200}ms`,
                        transition: 'width 0.5s ease-out',
                      }}
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
                className={talkCard('bg-violet-50 rounded-xl p-3 border-l-[3px] border-l-violet-300', 'targetUser', user.id)}
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
                    {/* Persona header */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-2xl leading-none flex-shrink-0">👤</span>
                      <p className="text-sm font-bold text-violet-900 leading-tight">{user.name}</p>
                    </div>
                    {/* Needs */}
                    <div className="mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-0.5">Needs</p>
                      <p className="text-xs text-violet-700 leading-relaxed">{user.need}</p>
                    </div>
                    <div className="h-px bg-violet-100 mb-2" />
                    {/* Why they care */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-0.5">Why they'd care</p>
                      <p className="text-xs text-violet-600 leading-relaxed">{user.whyTheyCare}</p>
                    </div>
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
            revealed={revealed}
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
        {/* Risk/Reward Matrix — only show when there are risks */}
        {content.risks.length > 0 && (
          <RiskMatrixChart
            content={content}
            revealed={revealed}
            onTapRisk={editMode ? undefined : (r) => openElement('risk', r.id, r.title, r)}
          />
        )}
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
            {displayHealth}/10
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
