/**
 * Smart Guidance layer — pure logic, no React.
 * Computes context-aware setup steps, suggestions and quick actions
 * for each tool type based on current content state.
 */
import type { TournamentPoolTrackerContent, WorkoutTrackerContent } from '../types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface SetupStep {
  id: string;
  label: string;
  detail?: string;
  done: boolean;
}

export interface SmartSuggestion {
  id: string;
  icon: string;
  label: string;
  /** If set, clicking the suggestion triggers this action. */
  actionId?: string;
  variant?: 'tip' | 'info' | 'warning';
  /** Higher = shown first. Suggestions sorted desc by priority, capped at 5. */
  priority: number;
}

export interface QuickActionDef {
  id: string;
  label: string;
  icon: string;
  variant?: 'primary' | 'default';
}

export interface GuidanceState {
  setupTitle: string;
  setupSteps: SetupStep[];
  /** Already filtered to top ≤5 most relevant suggestions. */
  suggestions: SmartSuggestion[];
  quickActions: QuickActionDef[];
  /** true = all setup steps done → checklist collapses. */
  isSetupComplete: boolean;
}

// ── World Cup / Tournament Pool ───────────────────────────────────────────────

export function computePoolGuidance(
  content: TournamentPoolTrackerContent,
  hasShareLink: boolean,
): GuidanceState {
  const { participants, teams, drawLocked, teamsSource, prizeNote, colourTheme } = content;
  const unassigned = teams.filter(t => !t.assignedTo);
  const allAssigned = teams.length > 0 && unassigned.length === 0 && participants.length > 0;

  // ── Setup checklist ───────────────────────────────────────────────────────
  const setupSteps: SetupStep[] = [
    {
      id: 'add-people',
      label: 'Add people',
      detail: participants.length > 0
        ? `${participants.length} participant${participants.length !== 1 ? 's' : ''} added`
        : 'Tap "Edit pool" → Participants',
      done: participants.length > 0,
    },
    {
      id: 'teams-loaded',
      label: 'Teams loaded',
      detail: teams.length > 0
        ? `${teams.length} teams across ${new Set(teams.map(t => t.pot)).size} pots`
        : 'No teams — use Edit pool to add teams',
      done: teams.length > 0,
    },
    {
      id: 'run-draw',
      label: 'Run the draw',
      detail: allAssigned || drawLocked
        ? 'All teams assigned'
        : participants.length === 0
          ? 'Add people first'
          : `${unassigned.length} team${unassigned.length !== 1 ? 's' : ''} to assign`,
      done: allAssigned || drawLocked,
    },
    {
      id: 'lock-and-share',
      label: 'Lock draw & share',
      detail: drawLocked ? 'Draw is locked ✓' : 'Lock when everyone is happy',
      done: drawLocked,
    },
  ];

  // ── Smart suggestions (sorted by priority, top 5) ────────────────────────
  const raw: SmartSuggestion[] = [];

  if (participants.length === 0) {
    raw.push({ id: 'need-people', icon: '👥', label: 'Add people to get started', actionId: 'add-people', variant: 'tip', priority: 10 });
  }
  if (teams.length === 0) {
    raw.push({ id: 'no-teams', icon: '⚠️', label: 'No teams loaded — add teams in Edit pool', actionId: 'edit-scoring', variant: 'warning', priority: 9 });
  }
  if (participants.length > 0 && teams.length > 0 && !allAssigned && !drawLocked) {
    raw.push({ id: 'run-draw', icon: '🎲', label: `Run the draw — ${unassigned.length} team${unassigned.length !== 1 ? 's' : ''} to assign`, actionId: 'run-draw-all', variant: 'tip', priority: 8 });
  }
  if (allAssigned && !drawLocked) {
    raw.push({ id: 'lock-draw', icon: '🔒', label: 'All teams assigned — lock the draw when ready', actionId: 'lock-draw', variant: 'tip', priority: 7 });
  }
  if (drawLocked && !hasShareLink) {
    raw.push({ id: 'share-pool', icon: '📤', label: 'Share your pool — invite everyone!', actionId: 'share', variant: 'tip', priority: 6 });
  }
  if (drawLocked && hasShareLink) {
    raw.push({ id: 'send-links', icon: '🔗', label: 'Send invite links to all participants', actionId: 'share', variant: 'tip', priority: 5 });
  }
  if (teamsSource === 'local_fallback' && !drawLocked) {
    raw.push({ id: 'local-teams', icon: 'ℹ️', label: 'Using built-in team list — connect sync for live results', variant: 'info', priority: 2 });
  }
  if (!prizeNote && drawLocked) {
    raw.push({ id: 'add-prize', icon: '🏆', label: 'Add a prize note to make it official', actionId: 'add-people', variant: 'tip', priority: 3 });
  }
  if (!colourTheme) {
    raw.push({ id: 'pick-theme', icon: '🎨', label: 'Personalise with a colour theme', actionId: 'change-theme', variant: 'tip', priority: 1 });
  }

  const suggestions = raw.sort((a, b) => b.priority - a.priority).slice(0, 5);

  // ── Quick actions ─────────────────────────────────────────────────────────
  const quickActions: QuickActionDef[] = [
    { id: 'add-people', label: 'Add people', icon: '👥' },
    ...(!drawLocked && participants.length > 0 && teams.length > 0
      ? [
          { id: 'run-draw-all',   label: 'Draw all',    icon: '🎲', variant: 'primary' as const },
          { id: 'run-draw-by-pot', label: 'Draw by pot', icon: '🎯' },
        ]
      : []),
    ...(allAssigned && !drawLocked
      ? [{ id: 'lock-draw', label: 'Lock draw', icon: '🔒', variant: 'primary' as const }]
      : []),
    { id: 'edit-scoring', label: 'Scoring', icon: '📊' },
    { id: 'change-theme', label: 'Colours',  icon: '🎨' },
    { id: 'share',        label: 'Share',    icon: '📤' },
  ];

  return {
    setupTitle: 'Get your pool ready',
    setupSteps,
    suggestions,
    quickActions,
    isSetupComplete: drawLocked,
  };
}

// ── Partner Challenge / Workout Tracker ───────────────────────────────────────

export function computeWorkoutGuidance(
  content: WorkoutTrackerContent,
  hasShareLink: boolean,
): GuidanceState {
  const participants = content.participants ?? [];
  const logs = content.logs ?? [];
  const hasPartner = participants.length >= 2;
  const hasLogs = logs.length > 0;
  const { colourTheme } = content;

  // ── Setup checklist ───────────────────────────────────────────────────────
  const setupSteps: SetupStep[] = [
    {
      id: 'add-partner',
      label: 'Add your partner',
      detail: hasPartner
        ? `${participants.length} participants`
        : participants.length === 1
          ? `${participants[0].name} added — add your partner too`
          : 'Add at least 2 people',
      done: hasPartner,
    },
    {
      id: 'first-log',
      label: 'Log first activity',
      detail: hasLogs
        ? `${logs.length} activit${logs.length !== 1 ? 'ies' : 'y'} logged`
        : 'Tap "+ Log activity"',
      done: hasLogs,
    },
    {
      id: 'share-partner',
      label: 'Share with your partner',
      detail: hasShareLink ? 'Shared!' : 'Tap Share when ready',
      done: hasShareLink,
    },
  ];

  // ── Smart suggestions ────────────────────────────────────────────────────
  const raw: SmartSuggestion[] = [];

  if (!hasPartner) {
    raw.push({
      id: 'add-partner',
      icon: '🤝',
      label: participants.length === 0 ? 'Add people to get started' : 'Add your partner to compete',
      actionId: 'add-partner',
      variant: 'tip',
      priority: 10,
    });
  }
  if (hasPartner && !hasLogs) {
    raw.push({ id: 'first-log', icon: '🏃', label: 'Log your first activity!', actionId: 'log-activity', variant: 'tip', priority: 8 });
  }
  if (hasPartner && hasLogs && !hasShareLink) {
    raw.push({ id: 'share', icon: '📤', label: 'Share with your partner so they can log too', actionId: 'share', variant: 'tip', priority: 6 });
  }
  if (hasPartner && hasLogs && hasShareLink) {
    raw.push({ id: 'keep-going', icon: '🔥', label: 'Keep logging to stay on top!', actionId: 'log-activity', variant: 'tip', priority: 4 });
  }
  if (!colourTheme) {
    raw.push({ id: 'pick-theme', icon: '🎨', label: 'Personalise with a colour theme', actionId: 'change-theme', variant: 'tip', priority: 1 });
  }

  const suggestions = raw.sort((a, b) => b.priority - a.priority).slice(0, 5);

  // ── Quick actions ─────────────────────────────────────────────────────────
  const quickActions: QuickActionDef[] = [
    { id: 'add-partner',  label: 'Add partner',  icon: '👥' },
    { id: 'log-activity', label: 'Log activity', icon: '🏃', variant: hasPartner ? 'primary' : 'default' },
    { id: 'set-target',   label: 'Set target',   icon: '🎯' },
    { id: 'edit-points',  label: 'Edit points',  icon: '📊' },
    { id: 'change-theme', label: 'Colours',      icon: '🎨' },
    { id: 'share',        label: 'Share',        icon: '📤' },
  ];

  return {
    setupTitle: 'Get your challenge ready',
    setupSteps,
    suggestions,
    quickActions,
    isSetupComplete: hasPartner && hasLogs && hasShareLink,
  };
}
