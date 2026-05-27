import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { HabitTrackerContent } from '../types';
import { HabitTrackerRenderer } from '../components/templates/HabitTrackerRenderer';
import AppShell from '../components/AppShell';
import PVHeader from '../components/PVHeader';
import { HomeScreen } from '../components/HomeScreen';
import type { Creation } from '../types';

const noop = vi.fn();

// ── AppShell ────────────────────────────────────────────────────────────────

describe('AppShell', () => {
  it('renders children inside the phone frame', () => {
    render(<AppShell><span data-testid="child">hello</span></AppShell>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

// ── PVHeader ─────────────────────────────────────────────────────────────────

describe('PVHeader', () => {
  it('shows PocketVibe brand on home view', () => {
    render(
      <PVHeader
        view="home"
        activeCreation={null}
        creationsCount={0}
        accentColor="#7c3aed"
        onBack={noop}
        onGoMyCreations={noop}
      />
    );
    expect(screen.getByText('PocketVibe')).toBeInTheDocument();
  });

  it('shows creation title in creation view', () => {
    const creation: Creation = {
      id: 'c-1', title: 'My Budget', creationType: 'budget_calculator',
      description: '', summary: '', originalRequest: '', status: 'ready',
      version: 1, createdAt: 0, updatedAt: 0,
      content: { type: 'budget_calculator', currency: 'R', income: [], expenses: [] },
    };
    render(
      <PVHeader
        view="creation"
        activeCreation={creation}
        creationsCount={1}
        accentColor="#7c3aed"
        onBack={noop}
        onGoMyCreations={noop}
      />
    );
    expect(screen.getByText('My Budget')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked in creation view', () => {
    const onBack = vi.fn();
    render(
      <PVHeader
        view="creation"
        activeCreation={null}
        creationsCount={0}
        accentColor="#7c3aed"
        onBack={onBack}
        onGoMyCreations={noop}
      />
    );
    fireEvent.click(screen.getByLabelText('Back to home'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows My things button when there are creations', () => {
    render(
      <PVHeader
        view="home"
        activeCreation={null}
        creationsCount={3}
        accentColor="#7c3aed"
        onBack={noop}
        onGoMyCreations={noop}
      />
    );
    expect(screen.getByText('My things')).toBeInTheDocument();
  });

  it('calls onGoMyCreations when My things is clicked', () => {
    const onGoMy = vi.fn();
    render(
      <PVHeader
        view="home"
        activeCreation={null}
        creationsCount={2}
        accentColor="#7c3aed"
        onBack={noop}
        onGoMyCreations={onGoMy}
      />
    );
    fireEvent.click(screen.getByText('My things'));
    expect(onGoMy).toHaveBeenCalledOnce();
  });
});

// ── HomeScreen ────────────────────────────────────────────────────────────────

describe('HomeScreen', () => {
  it('renders the headline', () => {
    render(<HomeScreen onPrompt={noop} isGenerating={false} />);
    expect(screen.getByText(/what do you want/i)).toBeInTheDocument();
  });

  it('calls onPrompt when a starter card is clicked after selecting a category', () => {
    const onPrompt = vi.fn();
    render(<HomeScreen onPrompt={onPrompt} isGenerating={false} />);
    // Click the first category card to navigate into it
    const categoryButtons = screen.getAllByRole('button');
    fireEvent.click(categoryButtons[0]);
    // Now in category detail — click first starter card
    const starterButtons = screen.getAllByRole('button');
    fireEvent.click(starterButtons[1]); // index 0 is Back, 1 is first starter
    expect(onPrompt).toHaveBeenCalled();
  });

  it('calls onPrompt when form is submitted with text', () => {
    const onPrompt = vi.fn();
    render(<HomeScreen onPrompt={onPrompt} isGenerating={false} />);
    const input = screen.getByPlaceholderText(/describe what you want/i);
    fireEvent.change(input, { target: { value: 'make a checklist' } });
    fireEvent.submit(input.closest('form')!);
    expect(onPrompt).toHaveBeenCalledWith('make a checklist');
  });

  it('disables input and buttons when isGenerating is true', () => {
    render(<HomeScreen onPrompt={noop} isGenerating={true} />);
    const input = screen.getByPlaceholderText(/describe what you want/i);
    expect(input).toBeDisabled();
  });
});

// ── HabitTrackerRenderer ──────────────────────────────────────────────────────

function makeHabitContent(overrides?: Partial<HabitTrackerContent>): HabitTrackerContent {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: 'habit_tracker',
    habits: [
      { id: 'h1', name: 'Morning Run', icon: '🏃', frequency: 'daily', completions: {} },
      { id: 'h2', name: 'Read', icon: '📚', frequency: 'daily', completions: { [today]: true } },
    ],
    startDate: today,
    ...overrides,
  };
}

describe('HabitTrackerRenderer', () => {
  // vi.fn typed to match the HabitTrackerRenderer onChange prop
  let onChange: Mock<(updated: HabitTrackerContent) => void>;

  beforeEach(() => {
    onChange = vi.fn<(updated: HabitTrackerContent) => void>();
  });

  // ── Task 2: Mobile card layout with labelled day chips ───────────────────

  it('renders "Edit habits" button', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /edit habits/i })).toBeInTheDocument();
  });

  it('renders habit names', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('renders 7 day chips per habit with labelled day names (Mon, Tue …)', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    // Each of the 7 day-of-week labels should appear at least twice (once per habit)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayElements = screen.getAllByText(new RegExp(`^(${dayNames.join('|')})$`));
    // 2 habits × 7 days = 14 day-name spans
    expect(dayElements.length).toBeGreaterThanOrEqual(14);
  });

  it('day chips show numeric date labels like "24"', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    const today = new Date();
    // The current date should appear (as a number string) in the chip labels
    const dateNumber = String(today.getDate());
    const dateLabels = screen.getAllByText(dateNumber);
    // Should appear once per habit (2 habits)
    expect(dateLabels.length).toBeGreaterThanOrEqual(2);
  });

  // ── Task 1: Direct editing ───────────────────────────────────────────────

  it('clicking "Edit habits" shows per-habit Edit and Delete buttons', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit habits/i }));
    // Should show two Edit buttons (one per habit)
    const editBtns = screen.getAllByRole('button', { name: /^edit /i });
    expect(editBtns.length).toBe(2);
    // Should show two Delete buttons
    const deleteBtns = screen.getAllByRole('button', { name: /^delete /i });
    expect(deleteBtns.length).toBe(2);
  });

  it('clicking Edit for a habit shows name and icon inputs', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit habits/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit morning run/i }));
    expect(screen.getByLabelText('Habit name')).toBeInTheDocument();
    expect(screen.getByLabelText('Habit icon')).toBeInTheDocument();
  });

  it('saving a renamed habit calls onChange with the new name', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit habits/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit morning run/i }));

    const nameInput = screen.getByLabelText('Habit name');
    fireEvent.change(nameInput, { target: { value: 'Evening Walk' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onChange).toHaveBeenCalledOnce();
    const updated: HabitTrackerContent = onChange.mock.calls[0][0];
    const renamed = updated.habits.find(h => h.id === 'h1');
    expect(renamed?.name).toBe('Evening Walk');
    // Other habit must be untouched
    expect(updated.habits.find(h => h.id === 'h2')?.name).toBe('Read');
  });

  it('deleting a habit calls onChange without that habit', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit habits/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete morning run/i }));

    expect(onChange).toHaveBeenCalledOnce();
    const updated: HabitTrackerContent = onChange.mock.calls[0][0];
    expect(updated.habits.find(h => h.id === 'h1')).toBeUndefined();
    expect(updated.habits.find(h => h.id === 'h2')).toBeDefined();
  });

  it('"Add habit" button appears in edit mode and calls onChange with a new habit', () => {
    render(<HabitTrackerRenderer content={makeHabitContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit habits/i }));
    const addBtn = screen.getByTestId('add-habit-btn');
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledOnce();
    const updated: HabitTrackerContent = onChange.mock.calls[0][0];
    expect(updated.habits.length).toBe(3);
  });

  it('toggling a day chip calls onChange with updated completions', () => {
    const today = new Date().toISOString().slice(0, 10);
    const content = makeHabitContent({
      habits: [{ id: 'h1', name: 'Run', icon: '🏃', frequency: 'daily', completions: {} }],
    });
    render(<HabitTrackerRenderer content={content} onChange={onChange} />);

    // Click today's chip for h1
    const chip = screen.getByTestId(`day-chip-h1-${today}`);
    fireEvent.click(chip);

    expect(onChange).toHaveBeenCalledOnce();
    const updated: HabitTrackerContent = onChange.mock.calls[0][0];
    expect(updated.habits[0].completions[today]).toBe(true);
  });
});

// ── BudgetCalculatorRenderer ──────────────────────────────────────────────────

import { BudgetCalculatorRenderer } from '../components/templates/BudgetCalculatorRenderer';
import type { BudgetCalculatorContent } from '../types';

function makeBudgetContent(overrides?: Partial<BudgetCalculatorContent>): BudgetCalculatorContent {
  return {
    type: 'budget_calculator',
    currency: 'R',
    income: [
      { id: 'inc1', label: 'Main income', amount: 20000 },
    ],
    expenses: [
      { id: 'exp1', label: 'Rent', category: 'Housing', amount: 5000 },
    ],
    notes: '',
    ...overrides,
  };
}

describe('BudgetCalculatorRenderer', () => {
  let onChange: Mock<(updated: BudgetCalculatorContent) => void>;

  beforeEach(() => {
    onChange = vi.fn<(updated: BudgetCalculatorContent) => void>();
  });

  it('shows "Edit budget" button in view mode', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /edit budget/i })).toBeInTheDocument();
  });

  it('clicking "Edit budget" shows editable inputs for income label and amount', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    expect(screen.getByTestId('income-label-inc1')).toBeInTheDocument();
    expect(screen.getByTestId('income-amount-inc1')).toBeInTheDocument();
  });

  it('clicking "Edit budget" shows editable inputs for expense label, category, and amount', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    expect(screen.getByTestId('expense-label-exp1')).toBeInTheDocument();
    expect(screen.getByTestId('expense-category-exp1')).toBeInTheDocument();
    expect(screen.getByTestId('expense-amount-exp1')).toBeInTheDocument();
  });

  it('add income row calls onChange with a new income entry', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    fireEvent.click(screen.getByTestId('add-income-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.income.length).toBe(2);
  });

  it('delete income row calls onChange without that entry', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    fireEvent.click(screen.getByTestId('delete-income-inc1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.income.find(i => i.id === 'inc1')).toBeUndefined();
  });

  it('add expense row calls onChange with a new expense entry', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    fireEvent.click(screen.getByTestId('add-expense-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.expenses.length).toBe(2);
  });

  it('delete expense row calls onChange without that entry', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    fireEvent.click(screen.getByTestId('delete-expense-exp1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.expenses.find(e => e.id === 'exp1')).toBeUndefined();
  });

  it('editing income label calls onChange with updated label', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    const labelInput = screen.getByTestId('income-label-inc1');
    fireEvent.change(labelInput, { target: { value: 'Freelance' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.income.find(i => i.id === 'inc1')?.label).toBe('Freelance');
  });

  it('editing income amount calls onChange with updated amount', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    const amountInput = screen.getByTestId('income-amount-inc1');
    fireEvent.change(amountInput, { target: { value: '25000' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.income.find(i => i.id === 'inc1')?.amount).toBe(25000);
  });

  it('notes textarea is visible in edit mode and calls onChange on change', () => {
    render(<BudgetCalculatorRenderer content={makeBudgetContent({ notes: 'Pay rent 1st' })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /edit budget/i }));
    const notesInput = screen.getByTestId('notes-input');
    expect(notesInput).toBeInTheDocument();
    fireEvent.change(notesInput, { target: { value: 'Pay rent on 3rd' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: BudgetCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.notes).toBe('Pay rent on 3rd');
  });
});

// ── ChecklistRenderer (CRUD) ──────────────────────────────────────────────────

import { ChecklistRenderer } from '../components/templates/ChecklistRenderer';
import type { ChecklistContent } from '../types';

function makeChecklistContent(): ChecklistContent {
  return {
    type: 'checklist',
    sections: [
      { id: 's1', title: 'Tasks', items: [{ id: 'i1', label: 'First item', checked: false }] },
    ],
  };
}

describe('ChecklistRenderer', () => {
  let onChange: Mock;
  beforeEach(() => { onChange = vi.fn(); });

  it('renders checklist items', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    expect(screen.getByText('First item')).toBeInTheDocument();
  });

  it('shows "Edit list" button', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    expect(screen.getByTestId('edit-checklist-btn')).toBeInTheDocument();
  });

  it('clicking "Edit list" shows item label input', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-checklist-btn'));
    expect(screen.getByTestId('item-label-i1')).toBeInTheDocument();
  });

  it('editing item label calls onChange with updated label', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-checklist-btn'));
    fireEvent.change(screen.getByTestId('item-label-i1'), { target: { value: 'Updated item' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: ChecklistContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].items[0].label).toBe('Updated item');
  });

  it('delete item calls onChange without that item', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-checklist-btn'));
    fireEvent.click(screen.getByTestId('delete-item-i1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: ChecklistContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].items).toHaveLength(0);
  });

  it('add item button calls onChange with a new item', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-checklist-btn'));
    fireEvent.click(screen.getByTestId('add-item-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: ChecklistContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].items).toHaveLength(2);
  });

  it('toggling item in view mode calls onChange', () => {
    render(<ChecklistRenderer content={makeChecklistContent()} onChange={onChange} />);
    // View mode: items are rendered as buttons with the item label as accessible name
    fireEvent.click(screen.getByRole('button', { name: 'First item' }));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: ChecklistContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].items[0].checked).toBe(true);
  });
});

// ── PriceCalculatorRenderer ───────────────────────────────────────────────────

import { PriceCalculatorRenderer } from '../components/templates/PriceCalculatorRenderer';
import type { PriceCalculatorContent } from '../types';

function makePriceContent(): PriceCalculatorContent {
  return {
    type: 'price_calculator',
    title: 'Service Quote',
    currency: 'R',
    description: 'Quote for services',
    lineItems: [{ id: 'li1', label: 'Consultation', quantity: 1, unitPrice: 500, category: 'Services' }],
    taxRate: 15,
    notes: '',
  };
}

describe('PriceCalculatorRenderer', () => {
  let onChange: Mock;
  beforeEach(() => { onChange = vi.fn(); });

  it('renders line item label', () => {
    render(<PriceCalculatorRenderer content={makePriceContent()} onChange={onChange} />);
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  it('shows "Edit prices" button', () => {
    render(<PriceCalculatorRenderer content={makePriceContent()} onChange={onChange} />);
    expect(screen.getByTestId('edit-price-btn')).toBeInTheDocument();
  });

  it('clicking "Edit prices" shows item label input', () => {
    render(<PriceCalculatorRenderer content={makePriceContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-price-btn'));
    expect(screen.getByTestId('item-label-li1')).toBeInTheDocument();
  });

  it('editing item label calls onChange', () => {
    render(<PriceCalculatorRenderer content={makePriceContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-price-btn'));
    fireEvent.change(screen.getByTestId('item-label-li1'), { target: { value: 'Strategy Session' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: PriceCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.lineItems[0].label).toBe('Strategy Session');
  });

  it('add item button appends a new line item', () => {
    render(<PriceCalculatorRenderer content={makePriceContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-price-btn'));
    fireEvent.click(screen.getByTestId('add-item-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: PriceCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.lineItems).toHaveLength(2);
  });

  it('delete item removes the line item', () => {
    render(<PriceCalculatorRenderer content={makePriceContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-price-btn'));
    fireEvent.click(screen.getByTestId('delete-item-li1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: PriceCalculatorContent = onChange.mock.calls[0][0];
    expect(updated.lineItems).toHaveLength(0);
  });
});

// ── TaskPlannerRenderer ───────────────────────────────────────────────────────

import { TaskPlannerRenderer } from '../components/templates/TaskPlannerRenderer';
import type { TaskPlannerContent } from '../types';

function makeTaskContent(): TaskPlannerContent {
  return {
    type: 'task_planner',
    planTitle: 'My Plan',
    sections: [
      { id: 'sec1', title: 'This week', tasks: [{ id: 't1', label: 'Write report', priority: 'high', done: false, dueDate: '' }] },
    ],
  };
}

describe('TaskPlannerRenderer', () => {
  let onChange: Mock;
  beforeEach(() => { onChange = vi.fn(); });

  it('renders task label', () => {
    render(<TaskPlannerRenderer content={makeTaskContent()} onChange={onChange} />);
    expect(screen.getByText('Write report')).toBeInTheDocument();
  });

  it('shows "Edit tasks" button', () => {
    render(<TaskPlannerRenderer content={makeTaskContent()} onChange={onChange} />);
    expect(screen.getByTestId('edit-tasks-btn')).toBeInTheDocument();
  });

  it('clicking "Edit tasks" shows task label input', () => {
    render(<TaskPlannerRenderer content={makeTaskContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-tasks-btn'));
    expect(screen.getByTestId('task-label-t1')).toBeInTheDocument();
  });

  it('editing task label calls onChange', () => {
    render(<TaskPlannerRenderer content={makeTaskContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-tasks-btn'));
    fireEvent.change(screen.getByTestId('task-label-t1'), { target: { value: 'Review slides' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: TaskPlannerContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].tasks[0].label).toBe('Review slides');
  });

  it('toggle task done state calls onChange', () => {
    render(<TaskPlannerRenderer content={makeTaskContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('toggle-task-t1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: TaskPlannerContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].tasks[0].done).toBe(true);
  });

  it('add task button appends a new task', () => {
    render(<TaskPlannerRenderer content={makeTaskContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-tasks-btn'));
    fireEvent.click(screen.getByTestId('add-task-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: TaskPlannerContent = onChange.mock.calls[0][0];
    expect(updated.sections[0].tasks).toHaveLength(2);
  });
});

// ── LandingPageRenderer ───────────────────────────────────────────────────────

import { LandingPageRenderer } from '../components/templates/LandingPageRenderer';
import type { LandingPageContent } from '../types';

function makeLandingContent(): LandingPageContent {
  return {
    type: 'landing_page',
    businessName: 'My Business',
    tagline: 'We do great things',
    description: 'A short description',
    features: [{ icon: '⭐', title: 'Quality', description: 'We care about quality' }],
    ctaLabel: 'Contact us',
    ctaUrl: '',
    contactEmail: 'hello@example.com',
  };
}

describe('LandingPageRenderer', () => {
  let onChange: Mock;
  beforeEach(() => { onChange = vi.fn(); });

  it('renders business name', () => {
    render(<LandingPageRenderer content={makeLandingContent()} onChange={onChange} />);
    expect(screen.getByText('My Business')).toBeInTheDocument();
  });

  it('shows "Edit page" button', () => {
    render(<LandingPageRenderer content={makeLandingContent()} onChange={onChange} />);
    expect(screen.getByTestId('edit-landing-btn')).toBeInTheDocument();
  });

  it('clicking "Edit page" shows business name input', () => {
    render(<LandingPageRenderer content={makeLandingContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-landing-btn'));
    expect(screen.getByTestId('business-name-input')).toBeInTheDocument();
  });

  it('editing business name calls onChange', () => {
    render(<LandingPageRenderer content={makeLandingContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-landing-btn'));
    fireEvent.change(screen.getByTestId('business-name-input'), { target: { value: 'New Name' } });
    expect(onChange).toHaveBeenCalledOnce();
    const updated: LandingPageContent = onChange.mock.calls[0][0];
    expect(updated.businessName).toBe('New Name');
  });
});

// ── EventPlannerRenderer ──────────────────────────────────────────────────────

import { EventPlannerRenderer } from '../components/templates/EventPlannerRenderer';
import type { EventPlannerContent } from '../types';

function makeEventContent(): EventPlannerContent {
  return {
    type: 'event_planner',
    eventName: 'Birthday Party',
    eventDate: '2025-08-01',
    guestCount: 20,
    tasks: [{ id: 't1', label: 'Book venue', done: false, dueDate: '' }],
    notes: '',
  };
}

describe('EventPlannerRenderer', () => {
  let onChange: Mock;
  beforeEach(() => { onChange = vi.fn(); });

  it('renders event name', () => {
    render(<EventPlannerRenderer content={makeEventContent()} onChange={onChange} />);
    expect(screen.getByText('Birthday Party')).toBeInTheDocument();
  });

  it('shows "Edit event" button', () => {
    render(<EventPlannerRenderer content={makeEventContent()} onChange={onChange} />);
    expect(screen.getByTestId('edit-event-btn')).toBeInTheDocument();
  });

  it('clicking "Edit event" shows task label input', () => {
    render(<EventPlannerRenderer content={makeEventContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-event-btn'));
    expect(screen.getByTestId('task-label-t1')).toBeInTheDocument();
  });

  it('toggle task done state calls onChange', () => {
    render(<EventPlannerRenderer content={makeEventContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('toggle-task-t1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: EventPlannerContent = onChange.mock.calls[0][0];
    expect(updated.tasks[0].done).toBe(true);
  });
});

// ── Reducer tests — TOGGLE_FAVORITE ──────────────────────────────────────────

import { act, renderHook } from '@testing-library/react';
import { usePocketVibe } from '../hooks/usePocketVibe';

describe('TOGGLE_FAVORITE', () => {
  it('toggleFavorite sets isFavorite to true then false', () => {
    const creation: Creation = {
      id: 'fav-1', title: 'Fav test', creationType: 'checklist',
      description: '', summary: '', originalRequest: '', status: 'ready',
      version: 1, createdAt: 0, updatedAt: 0,
      content: { type: 'checklist', sections: [] },
    };

    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: creation }); });

    // Initially not favorited
    expect(result.current.state.creations.find(c => c.id === 'fav-1')?.isFavorite).toBeFalsy();

    act(() => { result.current.toggleFavorite('fav-1'); });
    expect(result.current.state.creations.find(c => c.id === 'fav-1')?.isFavorite).toBe(true);

    act(() => { result.current.toggleFavorite('fav-1'); });
    expect(result.current.state.creations.find(c => c.id === 'fav-1')?.isFavorite).toBe(false);
  });
});

describe('duplicateCreation — sourceTemplate', () => {
  it('sets sourceTemplate on duplicated creation', () => {
    const original: Creation = {
      id: 'orig-1', title: 'Original', creationType: 'checklist',
      description: '', summary: '', originalRequest: '', status: 'ready',
      version: 1, createdAt: 0, updatedAt: 0,
      content: { type: 'checklist', sections: [] },
    };

    const { result } = renderHook(() => usePocketVibe());
    act(() => { result.current.dispatch({ type: 'UPSERT_CREATION', payload: original }); });
    act(() => { result.current.duplicateCreation('orig-1'); });

    const copy = result.current.state.creations.find(c => c.id !== 'orig-1');
    expect(copy?.sourceTemplate).toBe('orig-1');
    expect(copy?.isFavorite).toBe(false);
  });
});

// ── SavingsTrackerRenderer ────────────────────────────────────────────────────

import { SavingsTrackerRenderer } from '../components/templates/SavingsTrackerRenderer';
import type { SavingsTrackerContent } from '../types';

function makeSavingsContent(): SavingsTrackerContent {
  return {
    type: 'savings_tracker',
    goalName: 'Holiday Fund',
    targetAmount: 10000,
    currentAmount: 3000,
    currency: 'R',
    deadline: '',
    contributions: [
      { id: 'con1', date: '2025-01-01', amount: 3000, note: 'First deposit' },
    ],
  };
}

describe('SavingsTrackerRenderer', () => {
  let onChange: Mock;
  beforeEach(() => { onChange = vi.fn(); });

  it('shows "Edit savings goal" button', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    expect(screen.getByTestId('edit-savings-btn')).toBeInTheDocument();
  });

  it('clicking "Edit savings goal" shows goal name input', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-savings-btn'));
    expect(screen.getByTestId('edit-goal-name-input')).toBeInTheDocument();
  });

  it('user can edit goal name', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-savings-btn'));
    fireEvent.change(screen.getByTestId('edit-goal-name-input'), { target: { value: 'Car Fund' } });
    fireEvent.click(screen.getByTestId('done-editing-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: SavingsTrackerContent = onChange.mock.calls[0][0];
    expect(updated.goalName).toBe('Car Fund');
  });

  it('user can edit target amount', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-savings-btn'));
    fireEvent.change(screen.getByTestId('edit-target-amount-input'), { target: { value: '20000' } });
    fireEvent.click(screen.getByTestId('done-editing-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: SavingsTrackerContent = onChange.mock.calls[0][0];
    expect(updated.targetAmount).toBe(20000);
  });

  it('user can edit current amount', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-savings-btn'));
    fireEvent.change(screen.getByTestId('edit-current-amount-input'), { target: { value: '5000' } });
    fireEvent.click(screen.getByTestId('done-editing-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: SavingsTrackerContent = onChange.mock.calls[0][0];
    expect(updated.currentAmount).toBe(5000);
  });

  it('user can edit currency', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edit-savings-btn'));
    fireEvent.change(screen.getByTestId('edit-currency-input'), { target: { value: '$' } });
    fireEvent.click(screen.getByTestId('done-editing-btn'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: SavingsTrackerContent = onChange.mock.calls[0][0];
    expect(updated.currency).toBe('$');
  });

  it('user can delete a contribution', () => {
    render(<SavingsTrackerRenderer content={makeSavingsContent()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('delete-contribution-con1'));
    expect(onChange).toHaveBeenCalledOnce();
    const updated: SavingsTrackerContent = onChange.mock.calls[0][0];
    expect(updated.contributions).toHaveLength(0);
    expect(updated.currentAmount).toBe(0);
  });
});

// ── formatCreationSummary ─────────────────────────────────────────────────────

import { formatCreationSummary } from '../lib/creationSummary';

describe('formatCreationSummary', () => {
  it('produces human-readable text with no JSON or technical terms', () => {
    const creation: Creation = {
      id: 'c1', title: 'Holiday Fund', creationType: 'savings_tracker',
      description: 'Savings goal', summary: '', originalRequest: '', status: 'ready',
      version: 1, createdAt: 0, updatedAt: 0,
      content: {
        type: 'savings_tracker',
        goalName: 'Holiday Fund',
        targetAmount: 10000,
        currentAmount: 3000,
        currency: 'R',
        deadline: '',
        contributions: [],
      },
    };
    const text = formatCreationSummary(creation);
    expect(text).toContain('Holiday Fund');
    expect(text).toMatch(/R3/);
    expect(text).not.toMatch(/\{"type"/);
    expect(text).not.toMatch(/schema|render/i);
  });
});

// ── Edge function file integrity ──────────────────────────────────────────────

import { readFileSync } from 'fs';
import { join } from 'path';

describe('edge function file integrity', () => {
  const edgeFnPath = join(process.cwd(), 'supabase/functions/pocketvibe-generate/index.ts');
  let content: string;

  beforeEach(() => {
    content = readFileSync(edgeFnPath, 'utf8');
  });

  it('has exactly one Deno.serve() call', () => {
    const matches = content.match(/Deno\.serve\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('does not contain survey_form in the server file', () => {
    expect(content).not.toContain('survey_form');
  });

  it('does not contain generative_html in the server file', () => {
    expect(content).not.toContain('generative_html');
  });
});

