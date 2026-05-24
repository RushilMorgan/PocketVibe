import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
