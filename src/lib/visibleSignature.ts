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
    income: c.income.map(l => ({ label: l.label, amount: l.amount })),
    expenses: c.expenses.map(l => ({ label: l.label, amount: l.amount })),
  });
}

function savingsSignature(c: SavingsTrackerContent): string {
  return JSON.stringify({
    goalName: c.goalName,
    targetAmount: c.targetAmount,
    currentAmount: c.currentAmount,
    contributionCount: c.contributions.length,
  });
}

function landingSignature(c: LandingPageContent): string {
  return JSON.stringify({
    businessName: c.businessName,
    tagline: c.tagline,
    description: c.description,
    featureTitles: c.features.map(f => f.title),
    ctaLabel: c.ctaLabel,
  });
}

function priceSignature(c: PriceCalculatorContent): string {
  return JSON.stringify({
    currency: c.currency,
    taxRate: c.taxRate ?? 0,
    lineItems: c.lineItems.map(l => ({ label: l.label, quantity: l.quantity, unitPrice: l.unitPrice })),
  });
}
