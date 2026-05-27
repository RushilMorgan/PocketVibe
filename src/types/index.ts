// ─────────────────────────────────────────────────────────────────────────────
// PocketVibe — Core Type System
// ─────────────────────────────────────────────────────────────────────────────

// ── Legacy compat exports ────────────────────────────────────────────────────

export type ArchetypeId = string;

export interface AIArchetype {
  id: ArchetypeId;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  accentColor: string;
}

export interface CompanionState {
  archetype: AIArchetype | null;
  customName: string;
  phase: 'onboarding' | 'chat';
  messages: { id: string; role: 'user' | 'companion'; text: string }[];
}

// ── Legacy visual block types (kept for generative_html fallback renderer) ───

export type BlockType =
  | 'hero_banner'
  | 'interactive_list'
  | 'action_button'
  | 'metrics_row'
  | 'interactive_form'
  | 'generative_html';

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
  formula: string;
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
  tailwindMarkup: string;
}

export type VisualBlock =
  | HeroBannerBlock
  | InteractiveListBlock
  | ActionButtonBlock
  | MetricsRowBlock
  | InteractiveFormBlock
  | GenerativeHtmlBlock;

export interface AppConfig {
  blocks: VisualBlock[];
  accentColor: string;
  styleSlider: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creation domain model
// ─────────────────────────────────────────────────────────────────────────────

export type CreationType =
  | 'checklist'
  | 'habit_tracker'
  | 'budget_calculator'
  | 'savings_tracker'
  | 'landing_page'
  | 'event_planner'
  | 'meal_planner'
  | 'workout_tracker'
  | 'price_calculator'
  | 'task_planner'
  | 'tournament_pool_tracker';

export type CreationStatus = 'generating' | 'ready' | 'error';

// ── Checklist ─────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistContent {
  type: 'checklist';
  sections: ChecklistSection[];
}

// ── Habit tracker ─────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  name: string;
  icon: string;
  frequency: 'daily' | 'weekly';
  completions: Record<string, boolean>;
}

export interface HabitTrackerContent {
  type: 'habit_tracker';
  habits: Habit[];
  startDate: string;
}

// ── Budget calculator ─────────────────────────────────────────────────────────

export interface BudgetLine {
  id: string;
  label: string;
  amount: number;
  category?: string;
}

export interface BudgetCalculatorContent {
  type: 'budget_calculator';
  currency: string;
  income: BudgetLine[];
  expenses: BudgetLine[];
  notes?: string;
}

// ── Savings tracker ────────────────────────────────────────────────────────────

export interface SavingsContribution {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface SavingsTrackerContent {
  type: 'savings_tracker';
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
  contributions: SavingsContribution[];
}

// ── Landing page ───────────────────────────────────────────────────────────────

export interface LandingFeature {
  icon: string;
  title: string;
  description: string;
}

export interface LandingPageContent {
  type: 'landing_page';
  businessName: string;
  tagline: string;
  description: string;
  features: LandingFeature[];
  ctaLabel: string;
  ctaUrl?: string;
  contactEmail?: string;
}

// ── Event planner ──────────────────────────────────────────────────────────────

export interface EventTask {
  id: string;
  label: string;
  dueDate?: string;
  done: boolean;
}

export interface EventPlannerContent {
  type: 'event_planner';
  eventName: string;
  eventDate?: string;
  tasks: EventTask[];
  guestCount?: number;
  notes?: string;
}

// ── Meal planner ───────────────────────────────────────────────────────────────

export interface Meal {
  id: string;
  day: string;
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
}

export interface MealPlannerContent {
  type: 'meal_planner';
  weekLabel: string;
  meals: Meal[];
  groceryList: string[];
}

// ── Workout tracker ────────────────────────────────────────────────────────────

export interface WorkoutExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
}

export interface WorkoutDay {
  id: string;
  label: string;
  exercises: WorkoutExercise[];
  completed: boolean;
}

// ── Challenge Mode ─────────────────────────────────────────────────────────────

export interface ChallengeParticipant {
  id: string;
  name: string;
  emoji?: string;
}

export type ActivityType = 'walk' | 'run' | 'gym' | 'other';

export interface ActivityLog {
  id: string;
  participantId: string;
  date: string;           // ISO date e.g. '2026-05-27'
  activityType: ActivityType;
  duration?: string;      // e.g. '30 min'
  distance?: string;      // e.g. '5 km'
  note?: string;
}

export interface ChallengeScoringRules {
  pointsPerActivity: number;   // base points for any completed activity
  weeklyTargetBonus: number;   // bonus when weekly session target is met
  runningBonus: number;        // extra points for a 'run' activity
  streakBonus?: number;        // optional consecutive-day bonus
}

export interface WorkoutTrackerContent {
  type: 'workout_tracker';
  planName: string;
  // Challenge Mode fields (optional — absent means basic/legacy mode)
  challengeMode?: boolean;
  participants?: ChallengeParticipant[];
  activityTypes?: string[];
  weeklyTarget?: number;
  logs?: ActivityLog[];
  scoringRules?: ChallengeScoringRules;
  // Legacy basic mode
  days?: WorkoutDay[];
}

// ── Price calculator ──────────────────────────────────────────────────────────

export interface PriceLineItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

export interface PriceCalculatorContent {
  type: 'price_calculator';
  title: string;
  currency: string;
  description?: string;
  lineItems: PriceLineItem[];
  taxRate?: number;
  notes?: string;
}

// ── Task planner ───────────────────────────────────────────────────────────────

export interface TaskItem {
  id: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
  dueDate?: string;
}

export interface TaskSection {
  id: string;
  title: string;
  tasks: TaskItem[];
}

export interface TaskPlannerContent {
  type: 'task_planner';
  planTitle: string;
  sections: TaskSection[];
}

// ── Tournament Pool Tracker ──────────────────────────────────────────────────

export type TournamentTeamStatus = 'active' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final' | 'winner' | 'eliminated';

export interface TournamentTeam {
  id: string;
  name: string;
  pot: number;
  group?: string;
  flagEmoji?: string;
  status: TournamentTeamStatus;
  assignedTo?: string;  // participantId
}

export interface TournamentParticipant {
  id: string;
  name: string;
  emoji?: string;
}

export interface TournamentMatch {
  id: string;
  teamAId: string;
  teamBId: string;
  scoreA?: number;
  scoreB?: number;
  date?: string;
  stage?: string;
}

export interface TournamentScoringRules {
  pointsPerWin: number;
  pointsPerDraw: number;
  knockoutBonus: number;
  quarterFinalBonus: number;
  semiFinalBonus: number;
  finalBonus: number;
  winnerBonus: number;
}

export interface TournamentPoolTrackerContent {
  type: 'tournament_pool_tracker';
  poolName: string;
  tournamentName: string;
  prizeNote?: string;
  adminName?: string;
  rulesNote?: string;
  participants: TournamentParticipant[];
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  drawLocked: boolean;
  scoringRules: TournamentScoringRules;
}

// ── Content union ─────────────────────────────────────────────────────────────

export type CreationContent =
  | ChecklistContent
  | HabitTrackerContent
  | BudgetCalculatorContent
  | SavingsTrackerContent
  | LandingPageContent
  | EventPlannerContent
  | MealPlannerContent
  | WorkoutTrackerContent
  | PriceCalculatorContent
  | TaskPlannerContent
  | TournamentPoolTrackerContent;

// ── Creation entity ────────────────────────────────────────────────────────────

export interface Creation {
  id: string;
  title: string;
  creationType: CreationType;
  description: string;
  summary: string;
  originalRequest: string;
  status: CreationStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
  content: CreationContent;
  isFavorite?: boolean;
  sourceTemplate?: string;
}

// ── Generation ────────────────────────────────────────────────────────────────

export type GenerationMode = 'new' | 'improve' | 'add';

export interface GenerateRequest {
  userRequest: string;
  mode: GenerationMode;
  currentCreation?: Pick<Creation, 'id' | 'title' | 'creationType' | 'content' | 'originalRequest' | 'version'>;
  locale?: { date: string; timezone: string };
}

// Trust metadata returned by the server (or computed by the client) for improve/add flows
export interface ChangeReport {
  changed: boolean;
  changes: string[];      // human-readable list of what visibly changed
  unsupported: string[];  // capabilities that could not be applied
}

export interface GenerateResponse {
  title: string;
  creationType: CreationType;
  description: string;
  summary: string;
  content: CreationContent;
  changeReport?: ChangeReport; // optional — added by server QA or client verification
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ── App navigation ────────────────────────────────────────────────────────────

export type AppView = 'home' | 'creation' | 'my-creations';

// ── Chat message ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// ── Pending action (for confirmation dialogs) ─────────────────────────────────

export type PendingAction =
  | { type: 'new-creation'; request: string }
  | { type: 'open-creation'; id: string };

// ── App state ─────────────────────────────────────────────────────────────────

export interface PocketVibeState {
  view: AppView;
  creations: Creation[];
  activeCreationId: string | null;
  isGenerating: boolean;
  processingStatus: string | null;
  pendingAction: PendingAction | null;
  messages: ChatMessage[];
  accentColor: string;
}