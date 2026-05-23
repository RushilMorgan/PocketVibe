export type ArchetypeId = 'lex' | 'ziggy' | 'nova';

export interface AIArchetype {
  id: ArchetypeId;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accentColor: string;
}

export type BlockType = 'hero_banner' | 'interactive_list' | 'action_button' | 'metrics_row' | 'interactive_form' | 'generative_html';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeroBannerBlock extends BaseBlock {
  type: 'hero_banner';
  title: string;
  subtitle: string;
  ctaLabel: string;
}

export interface InteractiveListItem {
  id: string;
  label: string;
  icon: string;
  state: string;
}

export interface InteractiveListBlock extends BaseBlock {
  type: 'interactive_list';
  title?: string;
  items: InteractiveListItem[];
}

export interface ActionButtonBlock extends BaseBlock {
  type: 'action_button';
  label: string;
  icon?: string;
}

export interface MetricsRowBlock extends BaseBlock {
  type: 'metrics_row';
  metrics: { label: string; value: string }[];
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'slider';
  placeholder?: string;
  value: string;
}

export interface ComputedMetric {
  label: string;
  /** Formula string referencing field ids prefixed with $. E.g. "($gross_income * $tax_rate) / 100" */
  formula: string;
  /** Live calculated result string, populated at runtime */
  value?: string;
}

export interface InteractiveFormBlock extends BaseBlock {
  type: 'interactive_form';
  title: string;
  submitLabel: string;
  fields: FormField[];
  computedMetrics?: ComputedMetric[];
}

export interface GenerativeHtmlBlock extends BaseBlock {
  type: 'generative_html';
  /** Raw semantic HTML string, fully styled with Tailwind utility classes */
  tailwindMarkup: string;
}

export type VisualBlock = HeroBannerBlock | InteractiveListBlock | ActionButtonBlock | MetricsRowBlock | InteractiveFormBlock | GenerativeHtmlBlock;

export interface AppConfig {
  blocks: VisualBlock[];
  accentColor: string;
  styleSlider: number; // 0 = Playful, 100 = Minimalist
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'companion';
  text: string;
}

export interface CompanionState {
  archetype: AIArchetype | null;
  customName: string;
  phase: 'onboarding' | 'chat';
  messages: ChatMessage[];
}

export interface PocketVibeState {
  appConfig: AppConfig;
  companion: CompanionState;
  simulatePartner: boolean;
  shimmeringBlockId: string | null;
}