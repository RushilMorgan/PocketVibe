import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RecipeContent } from '../types';
import {
  parseDurationSeconds,
  stepTimerSeconds,
  formatCountdown,
  formatDurationShort,
} from '../lib/stepDuration';
import { RecipeSteps } from '../components/templates/RecipeSteps';

describe('parseDurationSeconds', () => {
  it('parses minutes, hours and seconds', () => {
    expect(parseDurationSeconds('Bake for 20 minutes until golden')).toBe(1200);
    expect(parseDurationSeconds('simmer 1 hour')).toBe(3600);
    expect(parseDurationSeconds('rest for 90 sec')).toBe(90);
    expect(parseDurationSeconds('5 min')).toBe(300);
  });

  it('uses the lower bound of a range (check early, cook longer)', () => {
    expect(parseDurationSeconds('Roast for 20–25 minutes')).toBe(1200);
    expect(parseDurationSeconds('bake 10 to 12 min')).toBe(600);
  });

  it('sums compound durations but not separate actions', () => {
    expect(parseDurationSeconds('slow-cook for 1 hour 30 minutes')).toBe(5400);
    // Two separate timed actions — only the first counts
    expect(parseDurationSeconds('boil 10 min, then rest 5 min')).toBe(600);
  });

  it('handles hyphenated and decimal forms, and returns null when timeless', () => {
    expect(parseDurationSeconds('set a 20-minute timer')).toBe(1200);
    expect(parseDurationSeconds('bake 1.5 hours')).toBe(5400);
    expect(parseDurationSeconds('season to taste')).toBeNull();
  });
});

describe('stepTimerSeconds + formatting', () => {
  it('prefers the explicit time field over the step text', () => {
    expect(stepTimerSeconds({ text: 'Bake for 40 minutes', time: '5 min' })).toBe(300);
    expect(stepTimerSeconds({ text: 'Bake for 40 minutes' })).toBe(2400);
    expect(stepTimerSeconds({ text: 'Plate up and serve' })).toBeNull();
  });

  it('formats countdowns and short durations', () => {
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(3725)).toBe('1:02:05');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatDurationShort(1200)).toBe('20 min');
    expect(formatDurationShort(5400)).toBe('1 h 30 min');
    expect(formatDurationShort(90)).toBe('1 min 30 sec');
  });
});

// ── Component behaviour ──────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    type: 'recipe',
    title: 'Timed Pasta',
    ingredients: [],
    steps: [
      { id: 's1', number: 1, text: 'Boil the pasta for 2 minutes.' },
      { id: 's2', number: 2, text: 'Stir in the sauce and serve.' },
    ],
    extraShoppingItems: [],
    layoutMode: 'card',
    ...overrides,
  };
}

function renderSteps(content: RecipeContent) {
  let latest = content;
  const onUpdate = (patch: Partial<RecipeContent>) => { latest = { ...latest, ...patch }; };
  const view = render(<RecipeSteps content={latest} editMode={false} onUpdate={onUpdate} />);
  return view;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RecipeSteps timers', () => {
  it('card view: tap to start, counts down, then nudges towards the next step', () => {
    vi.useFakeTimers();
    renderSteps(makeRecipe());

    fireEvent.click(screen.getByText(/Start 2 min timer/));
    expect(screen.getByTestId('step-timer-running')).toHaveTextContent('2:00');

    act(() => { vi.advanceTimersByTime(61_000); });
    expect(screen.getByTestId('step-timer-running')).toHaveTextContent('0:59');

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('step-timer-done')).toHaveTextContent("Time's up — on to step 2 👇");

    // Tapping the nudge dismisses it back to a fresh timer
    fireEvent.click(screen.getByTestId('step-timer-done'));
    expect(screen.getByText(/Start 2 min timer/)).toBeInTheDocument();
  });

  it('cancelling a running timer returns it to idle', () => {
    vi.useFakeTimers();
    renderSteps(makeRecipe());
    fireEvent.click(screen.getByText(/Start 2 min timer/));
    fireEvent.click(screen.getByLabelText('Cancel timer'));
    expect(screen.getByText(/Start 2 min timer/)).toBeInTheDocument();
  });

  it('step view: finished timer offers to advance to the next step', () => {
    vi.useFakeTimers();
    renderSteps(makeRecipe({ layoutMode: 'step' }));

    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Start 2 min timer/));
    act(() => { vi.advanceTimersByTime(121_000); });

    const nudge = screen.getByTestId('step-timer-next-nudge');
    expect(nudge).toHaveTextContent("Time's up — Next step →");
    fireEvent.click(nudge);
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
  });

  it('last step: timer end nudges "all done" instead of advancing', () => {
    vi.useFakeTimers();
    renderSteps(makeRecipe({
      layoutMode: 'step',
      steps: [{ id: 's1', number: 1, text: 'Bake for 1 minute.' }],
    }));
    fireEvent.click(screen.getByText(/Start 1 min timer/));
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(screen.getByTestId('step-timer-next-nudge')).toHaveTextContent("all done");
  });

  it('steps without a parseable duration get no timer chip', () => {
    renderSteps(makeRecipe({
      steps: [{ id: 's1', number: 1, text: 'Season to taste and serve.' }],
    }));
    expect(screen.queryByTestId('step-timer-start')).not.toBeInTheDocument();
  });
});
