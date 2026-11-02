/**
 * The models offered in Settings for the "smart" jobs — explainers, lessons,
 * diagrams and chat. Video watching, recipes and plumbing always use the fast
 * tier (GEMINI_MODEL_FAST). Client-safe: Settings renders this list and the
 * API validates against it.
 */
export const SMART_MODELS = [
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    blurb: 'Deepest and most opinionated — challenges claims, very personal. Most expensive.',
    cost: '≈ $0.05–0.25 per save',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    blurb: 'Thorough and measured, less opinionated. Can take a little longer.',
    cost: '≈ $0.03–0.12 per save',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    blurb: 'Fastest and cheapest. Concise, a little less depth.',
    cost: '≈ $0.01–0.05 per save',
  },
] as const;

export type SmartModelId = (typeof SMART_MODELS)[number]['id'];

export const SMART_MODEL_IDS = SMART_MODELS.map((m) => m.id) as [SmartModelId, ...SmartModelId[]];

export function isSmartModel(id: string | null | undefined): id is SmartModelId {
  return SMART_MODELS.some((m) => m.id === id);
}
