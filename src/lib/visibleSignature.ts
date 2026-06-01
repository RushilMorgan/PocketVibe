/**
 * Deterministic "visible signature" for each creation type.
 *
 * A visible signature captures only the fields a user can actually SEE —
 * not internal IDs, timestamps, or metadata that may differ between AI calls
 * without any real visible change.
 *
 * If oldSignature === newSignature after an improve/add call, the AI made
 * no meaningful change and the app must not claim success.
 */
import type {
  Creation,
  CreationContent,
  HabitTrackerContent,
  ChecklistContent,
  BudgetCalculatorContent,
  SavingsTrackerContent,
  LandingPageContent,
  PriceCalculatorContent,
  EventPlannerContent,
  MealPlannerContent,
  WorkoutTrackerContent,
  TaskPlannerContent,
  TournamentPoolTrackerContent,
  IdeaThinkingBoardContent,
} from '../types';

export function getCreationVisibleSignature(creation: Creation): string {
  return getContentVisibleSignature(creation.content);
}

export function getContentVisibleSignature(content: CreationContent): string {
  switch (content.type) {
    case 'habit_tracker':
      return habitSignature(content as HabitTrackerContent);
    case 'checklist':
      return checklistSignature(content as ChecklistContent);
    case 'budget_calculator':
      return budgetSignature(content as BudgetCalculatorContent);
    case 'savings_tracker':
      return savingsSignature(content as SavingsTrackerContent);
    case 'landing_page':
      return landingSignature(content as LandingPageContent);
    case 'price_calculator':
      return priceSignature(content as PriceCalculatorContent);
    case 'event_planner':
      return eventSignature(content as EventPlannerContent);
    case 'meal_planner':
      return mealSignature(content as MealPlannerContent);
    case 'workout_tracker':
      return workoutSignature(content as WorkoutTrackerContent);
    case 'task_planner':
      return taskSignature(content as TaskPlannerContent);
    case 'tournament_pool_tracker':
      return tournamentSignature(content as TournamentPoolTrackerContent);
    case 'idea_thinking_board':
      return ideaBoardSignature(content as IdeaThinkingBoardContent);
    default:
      // For all other types use full content serialization
      return JSON.stringify(content);
  }
}

// ── Per-type signature helpers ────────────────────────────────────────────────

function habitSignature(c: HabitTrackerContent): string {
  return JSON.stringify({
    habits: c.habits.map(h => ({ name: h.name, icon: h.icon, frequency: h.frequency })),
    startDate: c.startDate,
    // Summarise completion state — new ticks are a visible change but not the type of
    // change we track here (that happens directly in the renderer).
    completionCount: c.habits.reduce(
      (n, h) => n + Object.values(h.completions).filter(Boolean).length,
      0,
    ),
  });
}

function checklistSignature(c: ChecklistContent): string {
  return JSON.stringify({
    sections: c.sections.map(s => ({
      title: s.title,
      items: s.items.map(i => ({ label: i.label, checked: i.checked })),
    })),
  });
}

function budgetSignature(c: BudgetCalculatorContent): string {
  return JSON.stringify({
    currency: c.currency,
    income: c.income.map(l => ({ label: l.label, amount: l.amount, category: l.category ?? '' })),
    expenses: c.expenses.map(l => ({ label: l.label, amount: l.amount, category: l.category ?? '' })),
    notes: c.notes ?? '',
  });
}

function savingsSignature(c: SavingsTrackerContent): string {
  return JSON.stringify({
    goalName: c.goalName,
    targetAmount: c.targetAmount,
    currentAmount: c.currentAmount,
    currency: c.currency,
    deadline: c.deadline ?? '',
    contributions: c.contributions.map(con => ({ date: con.date, amount: con.amount, note: con.note ?? '' })),
  });
}

function landingSignature(c: LandingPageContent): string {
  return JSON.stringify({
    businessName: c.businessName,
    tagline: c.tagline,
    description: c.description,
    features: c.features.map(f => ({ icon: f.icon, title: f.title, description: f.description })),
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl ?? '',
    contactEmail: c.contactEmail ?? '',
  });
}

function priceSignature(c: PriceCalculatorContent): string {
  return JSON.stringify({
    title: c.title,
    currency: c.currency,
    description: c.description ?? '',
    lineItems: c.lineItems.map(l => ({ label: l.label, quantity: l.quantity, unitPrice: l.unitPrice, category: l.category ?? '' })),
    taxRate: c.taxRate ?? 0,
    notes: c.notes ?? '',
  });
}

function eventSignature(c: EventPlannerContent): string {
  return JSON.stringify({
    eventName: c.eventName,
    eventDate: c.eventDate ?? '',
    guestCount: c.guestCount ?? 0,
    notes: c.notes ?? '',
    tasks: c.tasks.map(t => ({ label: t.label, dueDate: t.dueDate ?? '', done: t.done })),
  });
}

function mealSignature(c: MealPlannerContent): string {
  return JSON.stringify({
    weekLabel: c.weekLabel,
    meals: c.meals.map(m => ({ day: m.day, slot: m.slot, name: m.name })),
    groceryList: c.groceryList,
  });
}

function workoutSignature(c: WorkoutTrackerContent): string {
  if (c.challengeMode || (c.participants && c.participants.length > 0)) {
    return JSON.stringify({
      planName: c.planName,
      participants: (c.participants ?? []).map(p => ({ name: p.name, emoji: p.emoji ?? '' })),
      activityTypes: c.activityTypes ?? [],
      weeklyTarget: c.weeklyTarget ?? 3,
      scoringRules: c.scoringRules,
      logs: (c.logs ?? []).map(l => ({
        participantId: l.participantId,
        date: l.date,
        activityType: l.activityType,
        duration: l.duration ?? '',
        distance: l.distance ?? '',
        note: l.note ?? '',
      })),
    });
  }
  return JSON.stringify({
    planName: c.planName,
    days: (c.days ?? []).map(d => ({
      label: d.label,
      completed: d.completed,
      exercises: d.exercises.map(e => ({ name: e.name, sets: e.sets ?? 0, reps: e.reps ?? '', duration: e.duration ?? '' })),
    })),
  });
}

function taskSignature(c: TaskPlannerContent): string {
  return JSON.stringify({
    planTitle: c.planTitle,
    sections: c.sections.map(s => ({
      title: s.title,
      tasks: s.tasks.map(t => ({ label: t.label, priority: t.priority, done: t.done, dueDate: t.dueDate ?? '' })),
    })),
  });
}

function ideaBoardSignature(c: IdeaThinkingBoardContent): string {
  return JSON.stringify({
    title: c.title,
    ideaSummary: c.ideaSummary,
    problem: c.problem,
    solution: c.solution,
    scores: c.scores,
    risks: c.risks.map(r => ({ title: r.title, severity: r.severity, note: r.note })),
    moneyIdeas: c.moneyIdeas.map(m => ({ model: m.model, note: m.note, confidence: m.confidence })),
    targetUsers: c.targetUsers.map(u => ({ name: u.name, need: u.need })),
    nextSteps: c.nextSteps.map(s => ({ label: s.label, done: s.done })),
    notes: c.notes,
  });
}

function tournamentSignature(c: TournamentPoolTrackerContent): string {
  return JSON.stringify({
    poolName: c.poolName,
    tournamentName: c.tournamentName,
    participants: c.participants.map(p => ({ name: p.name, emoji: p.emoji ?? '' })),
    teams: c.teams.map(t => ({ name: t.name, pot: t.pot, status: t.status, assignedTo: t.assignedTo ?? '' })),
    matches: c.matches.map(m => ({ teamAId: m.teamAId, teamBId: m.teamBId, scoreA: m.scoreA ?? '', scoreB: m.scoreB ?? '' })),
    drawLocked: c.drawLocked,
    scoringRules: c.scoringRules,
  });
}
