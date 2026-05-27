/**
 * Local update handlers — process simple, pattern-matched user requests
 * directly without calling the AI service. Handles rename, add, and
 * change-scoring requests for tournament pool and workout challenge creations.
 */
import type {
  Creation,
  TournamentPoolTrackerContent,
  TournamentMatch,
  TournamentTeamStatus,
  TournamentScoringRules,
  WorkoutTrackerContent,
  ActivityLog,
  ActivityType,
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

  // ── Draw all — assign teams to participants (Fisher-Yates) ────────────────
  if (/\b(?:draw\s+all|run\s+(?:the\s+)?draw|do\s+(?:the\s+)?draw)\b/i.test(req)) {
    const unassigned = content.teams.filter(t => !t.assignedTo);
    if (unassigned.length === 0) {
      return { handled: true, updatedContent: content, message: 'All teams are already assigned.' };
    }
    const participants = content.participants;
    if (participants.length === 0) {
      return { handled: true, updatedContent: content, message: 'Add participants before running the draw.' };
    }
    // Fisher-Yates shuffle of unassigned teams
    const shuffled = [...unassigned];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const updatedTeams = content.teams.map(t => {
      if (t.assignedTo) return t;
      const idx = unassigned.indexOf(t);
      const p = participants[idx % participants.length];
      return { ...t, assignedTo: p.id };
    });
    return {
      handled: true,
      updatedContent: { ...content, teams: updatedTeams, drawLocked: true },
      message: `Draw complete — ${unassigned.length} teams assigned.`,
    };
  }

  // ── Reset draw ────────────────────────────────────────────────────────────
  if (/\b(?:reset|clear)\s+(?:the\s+)?draw\b/i.test(req)) {
    const updatedTeams = content.teams.map(t => {
      const { assignedTo: _, ...rest } = t;
      return { ...rest, status: 'active' as TournamentTeamStatus };
    });
    return {
      handled: true,
      updatedContent: { ...content, teams: updatedTeams, drawLocked: false },
      message: 'Draw reset.',
    };
  }

  // ── Match result: "Brazil beat Japan 2-1" ────────────────────────────────
  m = req.match(/^(.+?)\s+beat\s+(.+?)\s+(\d+)[–\-](\d+)$/i);
  if (m) {
    const [, teamAName, teamBName, scoreAStr, scoreBStr] = m;
    const teamA = content.teams.find(t => t.name.toLowerCase() === teamAName.trim().toLowerCase());
    const teamB = content.teams.find(t => t.name.toLowerCase() === teamBName.trim().toLowerCase());
    if (teamA && teamB) {
      const newMatch: TournamentMatch = {
        id: `match-${Date.now()}`,
        teamAId: teamA.id,
        teamBId: teamB.id,
        scoreA: parseInt(scoreAStr, 10),
        scoreB: parseInt(scoreBStr, 10),
        date: new Date().toISOString().slice(0, 10),
      };
      return {
        handled: true,
        updatedContent: { ...content, matches: [...content.matches, newMatch] },
        message: `Result recorded: ${teamA.name} ${scoreAStr}–${scoreBStr} ${teamB.name}.`,
      };
    }
  }

  // ── Mark team status: "mark Brazil as winner" / "mark France as eliminated" ──
  m =
    req.match(/\bmark\s+(.+?)\s+as\s+(winner|eliminated|active|runner.?up)\b/i) ??
    req.match(/^(.+?)\s+is\s+(eliminated|out)\b/i);
  if (m) {
    const teamName = m[1].trim();
    const rawStatus = m[2].toLowerCase().replace(/\s+|-/g, '_').replace('out', 'eliminated').replace('runner_up', 'winner');
    const validStatuses: TournamentTeamStatus[] = ['active', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'winner', 'eliminated'];
    const status = validStatuses.includes(rawStatus as TournamentTeamStatus)
      ? (rawStatus as TournamentTeamStatus)
      : 'active';
    const updatedTeams = content.teams.map(t =>
      t.name.toLowerCase() === teamName.toLowerCase() ? { ...t, status } : t,
    );
    const changed = updatedTeams.some((t, i) => t.status !== content.teams[i]?.status);
    if (changed) {
      return {
        handled: true,
        updatedContent: { ...content, teams: updatedTeams },
        message: `${teamName} marked as ${status.replace(/_/g, ' ')}.`,
      };
    }
  }

  // ── Remove participant ────────────────────────────────────────────────────
  m = req.match(/\bremove\s+(?:participant\s+)?(.+)$/i);
  if (m) {
    const name = m[1].trim();
    const before = content.participants.length;
    const participants = content.participants.filter(
      p => p.name.toLowerCase() !== name.toLowerCase(),
    );
    if (participants.length < before) {
      return {
        handled: true,
        updatedContent: { ...content, participants },
        message: `Removed participant ${name}.`,
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

  // ── Remove participant ────────────────────────────────────────────────────
  m = req.match(/\bremove\s+(?:participant\s+)?(.+)$/i);
  if (m) {
    const name = m[1].trim();
    const before = (content.participants ?? []).length;
    const participants = (content.participants ?? []).filter(
      p => p.name.toLowerCase() !== name.toLowerCase(),
    );
    if (participants.length < before) {
      return {
        handled: true,
        updatedContent: { ...content, participants },
        message: `Removed participant ${name}.`,
      };
    }
  }

  // ── Rename participant: "change Morgan to Mo" ────────────────────────────
  m = req.match(/\bchange\s+(.+?)\s+to\s+(.+)$/i);
  if (m) {
    const [, oldName, newName] = m;
    const participants = (content.participants ?? []).map(p =>
      p.name.toLowerCase() === oldName.trim().toLowerCase() ? { ...p, name: newName.trim() } : p,
    );
    const changed = participants.some((p, i) => p.name !== (content.participants ?? [])[i]?.name);
    if (changed) {
      return {
        handled: true,
        updatedContent: { ...content, participants },
        message: `Renamed ${oldName.trim()} to ${newName.trim()}.`,
      };
    }
  }

  // ── Log activity: "Morgan walked today" / "Sarah ran today" ─────────────
  // "log 5km run for Morgan"
  const today = new Date().toISOString().slice(0, 10);
  const activityWords: Record<string, ActivityType> = {
    walk: 'walk', walked: 'walk', walking: 'walk',
    run: 'run', ran: 'run', running: 'run', jog: 'run', jogged: 'run',
    gym: 'gym', workout: 'gym', exercised: 'gym', lifted: 'gym',
  };

  // "log [distance] [activity] for [name]"
  m = req.match(/\blog\s+(?:(\d+\s*km|\d+\s*mi(?:les?)?|\d+\s*min(?:utes?)?)?\s+)?(walk(?:ed)?|run|ran|jog(?:ged)?|gym|workout)\s+for\s+(.+)/i);
  if (!m) {
    // "[name] walked/ran today"
    m = req.match(/^(.+?)\s+(walk(?:ed)?|ran|run|jog(?:ged)?|gym(?:med)?|workout)\s+(?:today|just\s+now)?$/i);
    if (m) {
      // swap to match: group 3 = name, group 2 = activity
      const [, name, actWord] = m;
      const participant = (content.participants ?? []).find(
        p => p.name.toLowerCase() === name.trim().toLowerCase(),
      );
      const activityType = activityWords[actWord.toLowerCase()] ?? 'other';
      if (participant) {
        const newLog: ActivityLog = {
          id: `log-${Date.now()}`,
          participantId: participant.id,
          date: today,
          activityType,
        };
        return {
          handled: true,
          updatedContent: { ...content, logs: [...(content.logs ?? []), newLog] },
          message: `Logged ${activityType} for ${participant.name}.`,
        };
      }
    }
  } else {
    const [, distanceStr, actWord, name] = m;
    const participant = (content.participants ?? []).find(
      p => p.name.toLowerCase() === name.trim().toLowerCase(),
    );
    const activityType = activityWords[actWord.toLowerCase()] ?? 'other';
    if (participant) {
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        participantId: participant.id,
        date: today,
        activityType,
        distance: distanceStr?.trim(),
      };
      return {
        handled: true,
        updatedContent: { ...content, logs: [...(content.logs ?? []), newLog] },
        message: `Logged ${activityType}${distanceStr ? ` (${distanceStr.trim()})` : ''} for ${participant.name}.`,
      };
    }
  }

  // ── Undo last activity ────────────────────────────────────────────────────
  if (/\bundo\b.*(last|my\s+last).*\bactiv(?:ity|ities)\b/i.test(req) ||
      /\bundo\s+last\b/i.test(req) ||
      /\bremove\s+last\s+(?:log|activity|entry)\b/i.test(req)) {
    const logs = content.logs ?? [];
    if (logs.length === 0) {
      return { handled: true, updatedContent: content, message: 'No activities to undo.' };
    }
    const updatedLogs = logs.slice(0, -1);
    return {
      handled: true,
      updatedContent: { ...content, logs: updatedLogs },
      message: 'Last activity removed.',
    };
  }

  return { handled: false };
}
