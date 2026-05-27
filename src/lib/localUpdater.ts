/**
 * Local update handlers — process simple, pattern-matched user requests
 * directly without calling the AI service. Handles rename, add, and
 * change-scoring requests for tournament pool and workout challenge creations.
 */
import type {
  Creation,
  TournamentPoolTrackerContent,
  TournamentScoringRules,
  WorkoutTrackerContent,
} from '../types';

export interface LocalUpdateResult {
  handled: boolean;
  updatedContent?: Creation['content'];
  message?: string;
}

export function tryApplyLocalUpdate(userRequest: string, creation: Creation): LocalUpdateResult {
  const req = userRequest.trim();
  const { content, creationType } = creation;

  if (creationType === 'tournament_pool_tracker' && content.type === 'tournament_pool_tracker') {
    return handleTournamentUpdate(req, content);
  }

  if (creationType === 'workout_tracker' && content.type === 'workout_tracker') {
    return handleWorkoutUpdate(req, content);
  }

  return { handled: false };
}

// ── Tournament pool ───────────────────────────────────────────────────────────

function handleTournamentUpdate(
  req: string,
  content: TournamentPoolTrackerContent,
): LocalUpdateResult {
  // ── Rename pool ───────────────────────────────────────────────────────────
  let m =
    req.match(/rename\s+(?:this|it|the\s+pool)?\s*to\s+(.+)/i) ??
    req.match(/change\s+(?:the\s+)?pool\s*name\s+to\s+(.+)/i);
  if (m) {
    const newName = m[1].trim();
    return {
      handled: true,
      updatedContent: { ...content, poolName: newName },
      message: `Pool renamed to "${newName}".`,
    };
  }

  // ── Lock / unlock draw ────────────────────────────────────────────────────
  if (/\block\s+the\s+draw\b/i.test(req)) {
    return {
      handled: true,
      updatedContent: { ...content, drawLocked: true },
      message: 'Draw locked.',
    };
  }
  if (/\bunlock\s+the\s+draw\b/i.test(req)) {
    return {
      handled: true,
      updatedContent: { ...content, drawLocked: false },
      message: 'Draw unlocked.',
    };
  }

  // ── Add team to pot (must be checked BEFORE add-participant) ─────────────
  m = req.match(/\badd\s+(.+?)\s+to\s+pot\s+(\d+)\b/i);
  if (m) {
    const teamName = m[1].trim();
    const pot = parseInt(m[2], 10);
    const newTeam = {
      id: `t-${Date.now()}`,
      name: teamName,
      pot,
      status: 'active' as const,
    };
    return {
      handled: true,
      updatedContent: { ...content, teams: [...content.teams, newTeam] },
      message: `Added ${teamName} to pot ${pot}.`,
    };
  }

  // ── Add participant ───────────────────────────────────────────────────────
  m = req.match(/^add\s+(?:participant\s+)?(.+)$/i);
  if (m && !/\bto\s+pot\b/i.test(req)) {
    const name = m[1].trim();
    const newParticipant = { id: `p-${Date.now()}`, name, emoji: '👤' };
    return {
      handled: true,
      updatedContent: {
        ...content,
        participants: [...content.participants, newParticipant],
      },
      message: `Added participant ${name}.`,
    };
  }

  // ── Change scoring rules ──────────────────────────────────────────────────
  const scoringPatterns: Array<[RegExp, keyof TournamentScoringRules]> = [
    [/(?:change|make|set)\s+points\s+per\s+win\s+(?:to\s+)?(\d+)/i, 'pointsPerWin'],
    [/(?:change|make|set)\s+points\s+per\s+draw\s+(?:to\s+)?(\d+)/i, 'pointsPerDraw'],
    [/(?:change|make|set)\s+knockout\s+bonus\s+(?:to\s+)?(\d+)/i, 'knockoutBonus'],
    [/(?:change|make|set)\s+quarter.?final\s+bonus\s+(?:to\s+)?(\d+)/i, 'quarterFinalBonus'],
    [/(?:change|make|set)\s+semi.?final\s+bonus\s+(?:to\s+)?(\d+)/i, 'semiFinalBonus'],
    [/(?:change|make|set)\s+final\s+bonus\s+(?:to\s+)?(\d+)/i, 'finalBonus'],
    [/(?:change|make|set)\s+winner\s+bonus\s+(?:to\s+)?(\d+)/i, 'winnerBonus'],
  ];
  for (const [pattern, key] of scoringPatterns) {
    m = req.match(pattern);
    if (m) {
      const value = parseInt(m[1], 10);
      return {
        handled: true,
        updatedContent: {
          ...content,
          scoringRules: { ...content.scoringRules, [key]: value },
        },
        message: `Updated ${key} to ${value}.`,
      };
    }
  }

  return { handled: false };
}

// ── Workout challenge ─────────────────────────────────────────────────────────

function handleWorkoutUpdate(req: string, content: WorkoutTrackerContent): LocalUpdateResult {
  if (!content.challengeMode) return { handled: false };

  // ── Rename ────────────────────────────────────────────────────────────────
  let m = req.match(/rename\s+(?:this|it)?\s*to\s+(.+)/i);
  if (m) {
    const newName = m[1].trim();
    return {
      handled: true,
      updatedContent: { ...content, planName: newName },
      message: `Challenge renamed to "${newName}".`,
    };
  }

  // ── Points per activity ───────────────────────────────────────────────────
  m = req.match(/(?:change|make|set)\s+points\s+per\s+activity\s+(?:to\s+)?(\d+)/i);
  if (m) {
    const value = parseInt(m[1], 10);
    const scoringRules = {
      ...(content.scoringRules ?? { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 }),
      pointsPerActivity: value,
    };
    return {
      handled: true,
      updatedContent: { ...content, scoringRules },
      message: `Points per activity set to ${value}.`,
    };
  }

  // ── Weekly target ─────────────────────────────────────────────────────────
  m = req.match(/(?:change|make|set)\s+weekly\s+target\s+(?:to\s+)?(\d+)/i);
  if (m) {
    const value = parseInt(m[1], 10);
    return {
      handled: true,
      updatedContent: { ...content, weeklyTarget: value },
      message: `Weekly target set to ${value}.`,
    };
  }

  // ── Running bonus ─────────────────────────────────────────────────────────
  m = req.match(/(?:change|make|set)\s+running\s+bonus\s+(?:to\s+)?(\d+)/i);
  if (m) {
    const value = parseInt(m[1], 10);
    const scoringRules = {
      ...(content.scoringRules ?? { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 }),
      runningBonus: value,
    };
    return {
      handled: true,
      updatedContent: { ...content, scoringRules },
      message: `Running bonus set to ${value}.`,
    };
  }

  // ── Add participant ───────────────────────────────────────────────────────
  m = req.match(/^add\s+(?:participant\s+)?(.+)$/i);
  if (m) {
    const name = m[1].trim();
    const newParticipant = { id: `p-${Date.now()}`, name, emoji: '🏃' };
    return {
      handled: true,
      updatedContent: {
        ...content,
        participants: [...(content.participants ?? []), newParticipant],
      },
      message: `Added participant ${name}.`,
    };
  }

  return { handled: false };
}
