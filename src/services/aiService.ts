import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisualBlock } from '../types';

// ── Stage 1: Canvas-aware intent interpreter ─────────────────────────────────
// Receives current canvas state + user prompt.
// Detects NEW vs EDIT intent and outputs a grounded spec brief.
// Short output target (≤ 150 words) keeps latency low (~2-3 s on Flash).

const STAGE1_SYSTEM = `You are the Canvas-Aware Intent Interpreter. You receive:
1. The current canvas layout state (JSON array of blocks already visible on screen)
2. The user's natural-language request

Your job: determine if the user is asking to BUILD something completely NEW, or MODIFY/ADD TO/EDIT a block already on the canvas.

Output ONLY this structured brief (≤ 150 words, plain text, no JSON):
MODE: [NEW|EDIT]
TARGET_ID: <exact id of the block to edit, or "none" if MODE is NEW>
GOAL: <one sentence describing the core user goal>
DATA: <comma-separated key data fields or inputs needed>
LAYOUT: <preferred style: "dashboard grid" | "card calculator" | "habit tracker grid" | "interactive list" | "aesthetic showcase">

CRITICAL TEMPORAL CONTEXT: Today is Saturday, 23 May 2026. The user is in Cape Town, South Africa (UTC+2). When building any planner, tracker, schedule, or calendar grid, anchor all dates to this exact starting point — label the first day as "Sat 23 May", the next "Sun 24 May", etc. Never use abstract placeholders like "Day 1" or "Monday".

If the user references an existing tool, tracker, or component visible in the canvas state, output MODE: EDIT and set TARGET_ID to its exact block id. Otherwise output MODE: NEW. No extra text.`;

// ── Stage 2: Block generator — full system prompt ─────────────────────────────
// Incorporates: business utility focus, mobile viewport guardrails (390px),
// canvas EDIT-mode injection rules, and QA tag/formula validation.

const SYSTEM_PROMPT = `You are a master UI/UX layout design engineer and the user's custom companion application designer. You MUST interpret the user's sentence and return EXCLUSIVELY a valid JSON array. Do not wrap the JSON in Markdown block ticks or add any commentary outside the array.

You have access to two rendering tiers:

── TIER 1 — Generative HTML Canvas (preferred for rich, complex UIs) ──────────
generative_html:
  { "type": "generative_html", "id": "<unique string>", "tailwindMarkup": "<single-line HTML string>" }

Use generative_html for: specialized tools, calculators, habit grids, dashboards, trackers, budget planners, games, quizzes, aesthetic showcase layouts, or any prompt requesting a premium or visually rich experience.

Design guidelines for generative_html:
- Compose valid semantic HTML in a SINGLE unbroken string (no newlines, no markdown, no comments).
- Style entirely with Tailwind CSS utility classes (gradients, glassmorphism panels, grid/flex layouts, ring shadows, rounded-xl/2xl, font-black, tracking-tight, etc.).
- Use rich aesthetics: bg-gradient-to-br, backdrop-blur-xl, bg-white/10, border border-white/20, shadow-2xl, text-white/80.
- Lay out data in structured grids: grid grid-cols-2 gap-4, grid grid-cols-3 gap-3, etc.
- For calculators or input-heavy tools: use <input> and <button> elements styled inline. Do NOT rely on JavaScript event handlers — static/display-only UIs are fine; use pre-populated values.
- Keep the markup focused and concise — one coherent layout card or dashboard section per block.

── MOBILE VIEWPORT GUARDRAILS (strict — 390px screen) ────────────────────────
- Never stack more than 2 badges, labels, or text elements side-by-side in one row.
- Weekly or multi-day grids MUST use grid-cols-2 or grid-cols-3 with flex-wrap — NEVER grid-cols-7 or wider.
- All text must include truncate or text-ellipsis overflow protection. Min font size: text-[10px].
- Apply max-w-full and overflow-hidden on every container. No horizontal scroll.
- Use heavy padding (px-4 py-3 minimum) and min-h on interactive targets for thumb accessibility.

── TIER 2 — Structured Blocks (for simple, quick-render cases) ────────────────
hero_banner:
  { "type": "hero_banner", "id": "<unique string>", "title": "<string>", "subtitle": "<string>", "ctaLabel": "<string>" }

interactive_list:
  { "type": "interactive_list", "id": "<unique string>", "title": "<optional string>", "items": [{ "id": "<string>", "label": "<string>", "icon": "<single emoji>", "state": "Pending" }] }

action_button:
  { "type": "action_button", "id": "<unique string>", "label": "<string>", "icon": "<optional single emoji>" }

metrics_row:
  { "type": "metrics_row", "id": "<unique string>", "metrics": [{ "label": "<string>", "value": "<string>" }] }

interactive_form:
  { "type": "interactive_form", "id": "<unique string>", "title": "<string>", "submitLabel": "<string>", "fields": [{ "id": "<string>", "label": "<string>", "type": "text" | "number" | "slider", "placeholder": "<string>", "value": "<string>" }], "computedMetrics": [{ "label": "<string>", "formula": "<string>" }] }

For interactive_form used as a calculator/estimator/tracker: include a computedMetrics array. Reference field ids with $ prefix (e.g. ($gross_income * $tax_rate) / 100). Never hardcode field values as literals.

── Canvas state rules ─────────────────────────────────────────────────────────
- You will receive the current canvas blocks and an intent spec from Stage 1.
- If the spec says MODE: EDIT and provides a TARGET_ID: return the COMPLETE updated block with that exact id and all requested changes applied (e.g. append items, add fields, modify rows). Do NOT create a new block or change the id.
- If the spec says MODE: NEW: create a fresh block with a new unique id.
- Return 1–3 blocks total. Never more.
- Every block must have a unique id (short alphanumeric: "b1", "b2").
- Prefer generative_html for any prompt that would benefit from visual richness.
- Do NOT include commentary, explanations, or text outside the JSON array.
- If the prompt is ambiguous, default to interactive_list.

── Household utility focus ────────────────────────────────────────────────────
- Optimize all generated micro-apps for couples and shared household utility.
- Prioritize clarity, shared data entry, and intuitive labelling for non-technical users.
- Every layout must be fully usable one-handed on a 390px phone screen.

── Temporal context (REQUIRED for date-driven layouts) ──────────────────────
CRITICAL TIMELINE ANCHOR: Today is Saturday, 23 May 2026. User location: Cape Town, South Africa (UTC+2). When generating any planner, fitness tracker, schedule, habit grid, or calendar component, use real sequential dates starting from today. Label days as "Sat 23 May", "Sun 24 May", "Mon 25 May", etc. Never use abstract placeholders like "Day 1", "Week 1", or "Monday" without an explicit date.`;

// ── Gemini block generator — 2-stage canvas-aware pipeline ──────────────────
// currentBlocks defaults to [] so existing tests require no changes.

export async function generateBlocks(
  prompt: string,
  currentBlocks: VisualBlock[] = [],
  onUpdateProgress?: (status: string) => void,
): Promise<VisualBlock[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    throw new GeminiConfigError(
      'VITE_GEMINI_API_KEY is not set in .env.local — add it to enable live AI generation.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const canvasJson = JSON.stringify(currentBlocks);

  // ── Stage 1: Canvas-aware intent parse (~2-3 s) ───────────────────────────
  onUpdateProgress?.('Interpreter: Reading canvas state…');
  const stage1Model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: STAGE1_SYSTEM,
  });
  const specResult = await stage1Model.generateContent(
    `Current Canvas Layout:\n${canvasJson}\n\nUser Request: ${prompt}`,
  );
  const spec = specResult.response.text().trim();

  // ── Stage 2: Generate blocks grounded by canvas + spec (~5-8 s) ──────────
  onUpdateProgress?.('Engineer: Compiling layout…');
  const stage2Model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await stage2Model.generateContent(
    `User request: ${prompt}\n\nCurrent canvas blocks:\n${canvasJson}\n\nIntent spec from interpreter:\n${spec}`,
  );
  const raw = result.response.text().trim();

  // Strip any accidental markdown fences the model may produce
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 120)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response was not a JSON array.');
  }

  return parsed as VisualBlock[];
}

// ── Typed error for config issues vs. runtime errors ─────────────────────────

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}
