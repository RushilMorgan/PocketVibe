import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisualBlock } from '../types';

// ── Structural agent-engineer system prompt ───────────────────────────────────

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

── Global rules ───────────────────────────────────────────────────────────────
- Return 1–3 blocks total. Never more.
- Every block must have a unique id (short alphanumeric: "b1", "b2").
- Prefer generative_html for any prompt that would benefit from visual richness.
- Do NOT include commentary, explanations, or text outside the JSON array.
- If the prompt is ambiguous, default to interactive_list.`;

// ── Gemini block generator ────────────────────────────────────────────────────

export async function generateBlocks(prompt: string): Promise<VisualBlock[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    throw new GeminiConfigError(
      'VITE_GEMINI_API_KEY is not set in .env.local — add it to enable live AI generation.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(prompt);
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
