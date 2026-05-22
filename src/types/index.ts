// ── PocketVibe Core Types ──────────────────────────────────────────────────────

export type BlueprintId = 'grocery' | 'chore';
export type ArchetypeId = 'lex' | 'ziggy' | 'nova';

export interface AIArchetype {
  id: ArchetypeId;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accentColor: string;
}

export type GroceryStatus = 'stocked' | 'low' | 'out';

export interface GroceryItem {
  id: string;
  name: string;
  emoji: string;
  status: GroceryStatus;
}

export interface ChoreItem {
  id: string;
  name: string;
  emoji: string;
  assignee: string | null;
}

export interface AppConfig {
  blueprint: BlueprintId;
  accentColor: string;
  styleSlider: number; // 0 = Playful, 100 = Minimalist
  groceryItems: GroceryItem[];
  choreItems: ChoreItem[];
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

// ── Legacy EverySite types (kept for backward compat) ─────────────────────────

// ── Core domain types ─────────────────────────────────────────────────────────

export type ThemeName = 'default' | 'soft-pink' | 'sage-green' | 'ocean-blue';

export interface ThemeColors {
  canvasBg: string;
  cardBg: string;
  primaryBtn: string;
  primaryBtnText: string;
  headline: string;
  body: string;
  accent: string;
  fontFamily: string;
}

export interface SiteConfig {
  businessName: string;
  businessDescription: string;
  theme: ThemeName;
  colors: ThemeColors;
  headline: string;
  subheadline: string;
  ctaText: string;
  subdomain: string;
  isPublished: boolean;
  extraBlocks?: ExtraBlock[];
}

// ── State machine types ───────────────────────────────────────────────────────

export type OnboardingStep = 'input' | 'animating' | 'interactive';

export type BottomSheetContext = 'idle' | 'nudge' | 'palette' | 'launch';

export type CanvasComponent = 'background' | 'headline' | 'cta' | 'image' | 'service';

// ── Dashboard editor types ────────────────────────────────────────────────────

/** Which canvas section is actively focused in the dashboard editor */
export type DashboardFocus = 'background' | 'headline' | 'subheadline' | null;

/** Which panel the dashboard ThumbZone currently shows */
export type DashboardThumbPanel = 'master' | 'text-edit' | 'palette';

export type ExtraBlockType = 'testimonials' | 'services-pricing' | 'contact';

export interface ExtraBlock {
  type: ExtraBlockType;
  id: string;
}

// ── Reducer action types ──────────────────────────────────────────────────────

export type SiteBuilderAction =
  | { type: 'SET_BUSINESS_INFO'; payload: { businessName: string; businessDescription: string } }
  | { type: 'START_ANIMATION' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'TAP_CANVAS_ELEMENT'; payload: CanvasComponent }
  | { type: 'SELECT_PALETTE'; payload: ThemeName }
  | { type: 'SHOW_LAUNCH' }
  | { type: 'CLOSE_MODAL' };

export interface SiteBuilderState {
  siteConfig: SiteConfig;
  onboardingStep: OnboardingStep;
  bottomSheetContext: BottomSheetContext;
  activeComponent: CanvasComponent | null;
  showLaunchModal: boolean;
}
