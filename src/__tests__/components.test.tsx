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

  it('calls onPrompt when an idea card is clicked', () => {
    const onPrompt = vi.fn();
    render(<HomeScreen onPrompt={onPrompt} isGenerating={false} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
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
