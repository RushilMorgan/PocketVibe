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
  /** Visual colour theme for the header and cards. Does not affect data. */
  colourTheme?: ColourTheme;
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
  assignedTo?: string;      // participantId
  providerTeamId?: number;  // maps to world_cup_teams.provider_team_id
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
  /** Set by admin to mark a hand-entered result that overrides canonical data. */
  isManualOverride?: boolean;
  /** Links to world_cup_matches.provider_match_id for override resolution. */
  providerMatchId?: number;
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

// ── Colour themes ───────────────────────────────────────────────────────────

export type ColourTheme = 'classic' | 'bold' | 'fun' | 'dark' | 'team-colours';

// ── World Cup canonical data types ──────────────────────────────────────────
// Used on the client when loading canonical results for auto-leaderboard.

export interface WorldCupTeam {
  providerTeamId: number;
  name: string;
  code?: string;
  flagUrl?: string;
  group?: string;
  /** Furthest stage reached: active | round_of_32 | round_of_16 | quarter_final | semi_final | final | winner | eliminated */
  stage: string;
}

export interface WorldCupMatch {
  providerMatchId: number;
  homeTeamId: number;
  awayTeamId: number;
  scoreHome?: number;
  scoreAway?: number;
  matchDate?: string;
  stage?: string;
  round?: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  isManualOverride: boolean;
}

export interface TournamentAutoSettings {
  /** If true, leaderboard uses canonical world_cup_matches instead of pool matches. */
  autoResultsEnabled: boolean;
  resultProvider: 'api-football' | 'manual';
  /** If true, admin-entered pool matches override canonical data for the same match. */
  allowManualOverrides: boolean;
  requireAdminApprovalForSuggestedChanges: boolean;
}

// ── Change Requests ───────────────────────────────────────────────────────────

export type ChangeRequestStatus = 'pending' | 'approved' | 'declined';

export type ChangeRequestActionType =
  | 'free_text'
  | 'add_result'
  | 'edit_participant_name'
  | 'update_team_status'
  | 'correct_team_assignment';

export interface ChangeRequest {
  id: string;
  participantId: string;
  participantName: string;
  /** Free-form description supplied by the participant */
  description: string;
  /** Action type for structured requests */
  actionType?: ChangeRequestActionType;
  /** Typed payload for structured actions (e.g. add_result: { teamAId, teamBId, scoreA, scoreB }) */
  payload?: Record<string, unknown>;
  status: ChangeRequestStatus;
  createdAt: number;
  resolvedAt?: number;
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
  changeRequests?: ChangeRequest[];
  /** Settings for auto-updating results from canonical World Cup data. */
  autoSettings?: TournamentAutoSettings;
  /** Where the teams came from: 'api' = live DB, 'local_fallback' = hardcoded built-in list. */
  teamsSource?: 'api' | 'local_fallback';
  /** Visual colour theme for the header and cards. Does not affect data. */
  colourTheme?: ColourTheme;
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
  shareSlug?: string;      // set once the creation has been shared
  /** Supabase user ID of the owner. Set client-side after auth + share. */
  ownerUserId?: string;
}

// ── Sharing ───────────────────────────────────────────────────────────────────

export type AccessMode = 'admin' | 'participant' | 'viewer';

export interface SharedCreationData {
  shareSlug: string;
  title: string;
  creationType: CreationType;
  content: CreationContent;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface SharedCreationResponse {
  creation: SharedCreationData;
  accessMode: AccessMode;
  participantRef?: string;   // set when accessMode === 'participant'
}

export interface CreateSharedResult {
  shareSlug: string;
  viewUrl: string;
  adminUrl: string;
  adminToken: string;
  /** Whether the creation is publicly viewable without a token. */
  publicView: boolean;
}

export interface ParticipantLinkResult {
  participantUrl: string;
  participantToken: string;
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

export type AppView = 'home' | 'creation' | 'my-creations' | 'my-tools';

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