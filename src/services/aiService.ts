import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisualBlock } from '../types';

// ── Structural agent-engineer system prompt ───────────────────────────────────

const SYSTEM_PROMPT = `You are the user's custom companion application designer. You MUST interpret their sentence and return exclusively a valid JSON array matching the 'VisualBlock' TypeScript union types (hero_banner, interactive_list, action_button, metrics_row, interactive_form). Do not wrap the JSON in Markdown block ticks. Output purely the structured data tokens.

The exact TypeScript shapes you must match:

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

Rules:
- Return 1–3 blocks. Never more.
- Every block must have a unique id (use short alphanumeric strings like "b1", "b2").
- interactive_list items must use a single relevant emoji for the icon field.
- metrics_row values should be realistic numeric strings (e.g. "$4,200", "87%", "12 days").
- interactive_form: use type "number" for numeric inputs, "slider" for 0–100 range values, "text" for everything else. Pre-populate "value" with a sensible default (e.g. "0", "50", "").
- Use interactive_form when the user asks for a calculator, estimator, tracker, budget, game, or any prompt that requires typed input to produce a result.
- For every interactive_form used as a calculator, estimator, tracker, budget, or interactive game, you MUST include a "computedMetrics" array with at least one entry. Each entry has a "label" string and a "formula" string. Example: { "label": "Tax Owed", "formula": "($gross_income * $tax_rate) / 100" }. Never hardcode numeric literals inside formulas as substitutes for field values — always reference field ids by prepending them with the '$' symbol token (e.g. $field_id). Plain numeric constants used in the math itself (like 100 for a percentage) are allowed.
- Do NOT include any commentary, explanation, or text outside the JSON array.
- If the user's prompt is ambiguous, default to an interactive_list block.`;

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
