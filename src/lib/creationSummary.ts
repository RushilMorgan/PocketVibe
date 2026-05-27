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

function formatWorkoutTracker(c: WorkoutTrackerContent): string {
  if (c.challengeMode || (c.participants && c.participants.length > 0)) {
    const names = (c.participants ?? []).map(p => p.name).join(', ');
    const lines = [`Challenge: ${c.planName}`, `Participants: ${names}`];
    if (c.weeklyTarget) lines.push(`Weekly target: ${c.weeklyTarget} sessions`);
    if (c.logs && c.logs.length > 0) lines.push(`Total logs: ${c.logs.length}`);
    return lines.join('\n');
  }
  return (c.days ?? [])
    .map(d => {
      const exs = d.exercises.map(e => `${e.name} ${e.sets}×${e.reps}`).join(', ');
      return `${d.label}: ${exs}`;
    })
    .join('\n');
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
    default:
      body = creation.description;
  }

  return `${title}\n\n${body}`;
}
