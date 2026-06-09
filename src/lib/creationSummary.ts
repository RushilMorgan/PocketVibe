import type {
  Creation,
  ChecklistContent,
  HabitTrackerContent,
  BudgetCalculatorContent,
  SavingsTrackerContent,
  LandingPageContent,
  EventPlannerContent,
  MealPlannerContent,
  WorkoutTrackerContent,
  PriceCalculatorContent,
  TaskPlannerContent,
  TournamentPoolTrackerContent,
  RecipeContent,
  RecipeBookContent,
} from '../types';

function fmtCurrency(currency: string, amount: number): string {
  return `${currency}${new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

function formatChecklist(c: ChecklistContent): string {
  const lines: string[] = [];
  for (const section of c.sections) {
    const items = section.items.map(i => i.label).join(', ');
    lines.push(`${section.title}: ${items}`);
  }
  return lines.join('\n');
}

function formatHabitTracker(c: HabitTrackerContent): string {
  return c.habits.map(h => `${h.icon} ${h.name} (${h.frequency})`).join('\n');
}

function formatBudgetCalculator(c: BudgetCalculatorContent): string {
  const totalIncome = c.income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = c.expenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpenses;
  return [
    `Income: ${fmtCurrency(c.currency, totalIncome)}`,
    `Expenses: ${fmtCurrency(c.currency, totalExpenses)}`,
    `Balance: ${fmtCurrency(c.currency, balance)}`,
  ].join('\n');
}

function formatSavingsTracker(c: SavingsTrackerContent): string {
  const pct = c.targetAmount > 0 ? Math.round((c.currentAmount / c.targetAmount) * 100) : 0;
  const lines = [
    `Goal: ${c.goalName}`,
    `Saved: ${fmtCurrency(c.currency, c.currentAmount)} of ${fmtCurrency(c.currency, c.targetAmount)} (${pct}%)`,
  ];
  if (c.deadline) lines.push(`Deadline: ${c.deadline}`);
  return lines.join('\n');
}

function formatLandingPage(c: LandingPageContent): string {
  const lines = [
    c.businessName,
    c.tagline,
    c.description,
  ];
  if (c.features.length > 0) {
    lines.push('Features: ' + c.features.map(f => f.title).join(', '));
  }
  if (c.contactEmail) lines.push(`Contact: ${c.contactEmail}`);
  return lines.filter(Boolean).join('\n');
}

function formatEventPlanner(c: EventPlannerContent): string {
  const lines = [`Event: ${c.eventName}`];
  if (c.eventDate) lines.push(`Date: ${c.eventDate}`);
  if (c.guestCount) lines.push(`Guests: ${c.guestCount}`);
  const pending = c.tasks.filter(t => !t.done);
  if (pending.length > 0) lines.push(`To do: ${pending.map(t => t.label).join(', ')}`);
  return lines.join('\n');
}

function formatMealPlanner(c: MealPlannerContent): string {
  const lines: string[] = [];
  const byDay: Record<string, string[]> = {};
  for (const m of c.meals) {
    byDay[m.day] = byDay[m.day] ?? [];
    byDay[m.day].push(`${m.slot}: ${m.name}`);
  }
  for (const [day, meals] of Object.entries(byDay)) {
    lines.push(`${day} — ${meals.join(', ')}`);
  }
  if (c.groceryList.length > 0) {
    lines.push(`Shopping: ${c.groceryList.slice(0, 5).join(', ')}${c.groceryList.length > 5 ? '…' : ''}`);
  }
  return lines.join('\n');
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(dateStr: string): string {
  return getMonday(new Date(dateStr + 'T12:00:00')).toISOString().slice(0, 10);
}

function formatWorkoutTracker(c: WorkoutTrackerContent): string {
  if (c.challengeMode || (c.participants && c.participants.length > 0)) {
    const participants = c.participants ?? [];
    const logs = c.logs ?? [];
    const rules = c.scoringRules ?? { pointsPerActivity: 10, weeklyTargetBonus: 20, runningBonus: 5 };
    const weeklyTarget = c.weeklyTarget ?? 3;

    // Calculate scores
    const thisWeekKey = weekKey(new Date().toISOString().slice(0, 10));

    type Score = { participant: { id: string; name: string; emoji?: string }; points: number; sessionsThisWeek: number };
    const scores: Score[] = participants.map(p => {
      const pLogs = logs.filter(l => l.participantId === p.id);
      const points = pLogs.reduce((sum, l) => {
        let pts = rules.pointsPerActivity;
        if (l.activityType === 'run') pts += rules.runningBonus;
        return sum + pts;
      }, 0);
      // Weekly target bonus
      const weekCounts: Record<string, number> = {};
      for (const l of pLogs) {
        const wk = weekKey(l.date);
        weekCounts[wk] = (weekCounts[wk] ?? 0) + 1;
      }
      let bonusPoints = 0;
      for (const count of Object.values(weekCounts)) {
        if (count >= weeklyTarget) bonusPoints += rules.weeklyTargetBonus;
      }
      const sessionsThisWeek = weekCounts[thisWeekKey] ?? 0;
      return { participant: p, points: points + bonusPoints, sessionsThisWeek };
    });
    scores.sort((a, b) => b.points - a.points);

    const lines = [`${c.planName}`, '', 'Leaderboard:'];
    scores.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.participant.emoji ?? '🏃'} ${s.participant.name} — ${s.points} pts — ${s.sessionsThisWeek}/${weeklyTarget} this week`);
    });

    // Recent logs (last 3)
    const recent = [...logs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    if (recent.length > 0) {
      lines.push('', 'Recent:');
      for (const l of recent) {
        const p = participants.find(p => p.id === l.participantId);
        const name = p?.name ?? 'Someone';
        const when = l.date === new Date().toISOString().slice(0, 10) ? 'today' : l.date;
        lines.push(`- ${name} logged ${l.activityType} ${when}`);
      }
    }

    return lines.join('\n');
  }

  return (c.days ?? [])
    .map(d => {
      const exs = d.exercises.map(e => `${e.name} ${e.sets}×${e.reps}`).join(', ');
      return `${d.label}: ${exs}`;
    })
    .join('\n');
}

function formatTournamentPool(c: TournamentPoolTrackerContent): string {
  const participants = c.participants;
  const teams = c.teams;
  const matches = c.matches;
  const rules = c.scoringRules;

  // Calculate leaderboard
  type LBEntry = { participant: { id: string; name: string; emoji?: string }; points: number; teamNames: string[] };
  const leaderboard: LBEntry[] = participants.map(p => {
    const myTeams = teams.filter(t => t.assignedTo === p.id);
    let points = 0;
    for (const team of myTeams) {
      // Points from matches won
      for (const match of matches) {
        const isA = match.teamAId === team.id;
        const isB = match.teamBId === team.id;
        if (!isA && !isB) continue;
        const sa = match.scoreA ?? 0;
        const sb = match.scoreB ?? 0;
        if (sa === sb) points += rules.pointsPerDraw;
        else if ((isA && sa > sb) || (isB && sb > sa)) points += rules.pointsPerWin;
      }
      // Status bonuses
      const statusBonus: Partial<Record<string, number>> = {
        round_of_16: rules.knockoutBonus,
        quarter_final: rules.quarterFinalBonus,
        semi_final: rules.semiFinalBonus,
        final: rules.finalBonus,
        winner: rules.winnerBonus,
      };
      points += statusBonus[team.status] ?? 0;
    }
    return { participant: p, points, teamNames: myTeams.map(t => t.name) };
  });
  leaderboard.sort((a, b) => b.points - a.points);

  const lines = [`${c.poolName}`, ''];

  if (leaderboard.length > 0) {
    lines.push('Leaderboard:');
    leaderboard.forEach((e, i) => {
      const teamStr = e.teamNames.length > 0 ? ` — ${e.teamNames.join(', ')}` : '';
      lines.push(`${i + 1}. ${e.participant.emoji ?? '👤'} ${e.participant.name} — ${e.points} pts${teamStr}`);
    });
    lines.push('');
  }

  const assigned = teams.filter(t => t.assignedTo).length;
  const drawStatus = c.drawLocked
    ? `Draw locked — ${assigned}/${teams.length} teams assigned`
    : assigned > 0
      ? `Draw in progress — ${assigned}/${teams.length} teams assigned`
      : 'Draw not started';
  lines.push(drawStatus);

  // Latest results (last 2 matches)
  const latestMatches = [...matches]
    .filter(m => m.scoreA !== undefined)
    .slice(-2)
    .reverse();
  if (latestMatches.length > 0) {
    const resultLines = latestMatches.map(m => {
      const tA = teams.find(t => t.id === m.teamAId)?.name ?? '?';
      const tB = teams.find(t => t.id === m.teamBId)?.name ?? '?';
      return `${tA} ${m.scoreA}–${m.scoreB} ${tB}`;
    });
    lines.push(`Latest results: ${resultLines.join(', ')}`);
  }

  if (c.prizeNote) lines.push(`Prize: ${c.prizeNote}`);

  return lines.join('\n');
}

function formatPriceCalculator(c: PriceCalculatorContent): string {
  const subtotal = c.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxRate = c.taxRate ?? 0;
  const tax = subtotal * (taxRate / 100);
  const lines = c.lineItems.map(li => `${li.label}: ${fmtCurrency(c.currency, li.quantity * li.unitPrice)}`);
  lines.push(`Subtotal: ${fmtCurrency(c.currency, subtotal)}`);
  if (taxRate > 0) lines.push(`Tax (${taxRate}%): ${fmtCurrency(c.currency, tax)}`);
  lines.push(`Total: ${fmtCurrency(c.currency, subtotal + tax)}`);
  return lines.join('\n');
}

function formatTaskPlanner(c: TaskPlannerContent): string {
  return c.sections
    .map(s => {
      const tasks = s.tasks.map(t => (t.done ? `✓ ${t.label}` : t.label)).join(', ');
      return `${s.title}: ${tasks}`;
    })
    .join('\n');
}

function formatRecipe(c: RecipeContent): string {
  const lines: string[] = [];
  const meta = [
    c.servings != null ? `Serves ${c.servings}` : '',
    c.prepTime ? `Prep ${c.prepTime}` : '',
    c.cookTime ? `Cook ${c.cookTime}` : '',
  ].filter(Boolean).join(' · ');
  if (meta) lines.push(meta);
  if (c.ingredients.length > 0) {
    lines.push('', 'Ingredients:');
    for (const i of c.ingredients) {
      lines.push(`- ${[i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim() || i.name}`);
    }
  }
  if (c.steps.length > 0) {
    lines.push('', 'Steps:');
    c.steps.forEach(s => lines.push(`${s.number}. ${s.text}`));
  }
  return lines.join('\n');
}

function formatRecipeBook(c: RecipeBookContent): string {
  if (c.recipes.length === 0) return 'An empty cookbook — add recipes by pasting cooking-video links.';
  return [`${c.recipes.length} recipe${c.recipes.length !== 1 ? 's' : ''}:`, ...c.recipes.map(r => `• ${r.title}`)].join('\n');
}

export function formatCreationSummary(creation: Creation): string {
  const { title, creationType, content } = creation;
  let body = '';

  switch (creationType) {
    case 'checklist':
      body = formatChecklist(content as ChecklistContent);
      break;
    case 'habit_tracker':
      body = formatHabitTracker(content as HabitTrackerContent);
      break;
    case 'budget_calculator':
      body = formatBudgetCalculator(content as BudgetCalculatorContent);
      break;
    case 'savings_tracker':
      body = formatSavingsTracker(content as SavingsTrackerContent);
      break;
    case 'landing_page':
      body = formatLandingPage(content as LandingPageContent);
      break;
    case 'event_planner':
      body = formatEventPlanner(content as EventPlannerContent);
      break;
    case 'meal_planner':
      body = formatMealPlanner(content as MealPlannerContent);
      break;
    case 'workout_tracker':
      body = formatWorkoutTracker(content as WorkoutTrackerContent);
      break;
    case 'price_calculator':
      body = formatPriceCalculator(content as PriceCalculatorContent);
      break;
    case 'task_planner':
      body = formatTaskPlanner(content as TaskPlannerContent);
      break;
    case 'tournament_pool_tracker':
      body = formatTournamentPool(content as TournamentPoolTrackerContent);
      break;
    case 'recipe':
      body = formatRecipe(content as RecipeContent);
      break;
    case 'recipe_book':
      body = formatRecipeBook(content as RecipeBookContent);
      break;
    default:
      body = creation.description;
  }

  return `${title}\n\n${body}`;
}
