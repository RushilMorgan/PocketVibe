/**
 * Tests for the Idea Board "tap-to-talk" inline AI:
 *  - getElementActions: contextual actions per kind/state
 *  - applyElementPatch: surgical merge, scalar/scores/linked, no mutation
 *  - buildElementEditPrompt: scoped prompt shape
 *  - ElementChatSheet: renders actions, busy/error states, fires callbacks
 *  - Renderer: tapping a card opens the sheet
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import type { IdeaThinkingBoardContent } from '../types';
import { getElementActions } from '../lib/ideaElementActions';
import { applyElementPatch } from '../lib/applyElementPatch';
import { buildElementEditPrompt } from '../services/aiService';
import { ElementChatSheet } from '../components/shared/ElementChatSheet';
import { IdeaThinkingBoardRenderer } from '../components/templates/IdeaThinkingBoardRenderer';

// Avoid real network / Gemini in the renderer's edit path
vi.mock('../services/worldCupService', () => ({
  getWorldCupData: vi.fn().mockResolvedValue({ teams: [], matches: [] }),
  isWorldCupDataAvailable: vi.fn().mockReturnValue(false),
}));

function makeBoard(overrides: Partial<IdeaThinkingBoardContent> = {}): IdeaThinkingBoardContent {
  return {
    type: 'idea_thinking_board',
    title: 'Chore App',
    ideaSummary: 'Helps families share chores.',
    problem: 'Chores cause arguments.',
    solution: 'A shared board with points.',
    targetUsers: [{ id: 'u1', name: 'Parents', need: 'Less arguments', whyTheyCare: 'Peace' }],
    risks: [
      { id: 'r1', title: 'WhatsApp already used', severity: 'high', note: 'Free habit' },
      { id: 'r2', title: 'Low engagement', severity: 'medium', note: 'Apps get abandoned' },
    ],
    opportunities: [{ id: 'o1', title: 'No mobile option', note: 'Desktop only competitors' }],
    moneyIdeas: [{ id: 'm1', model: 'Subscription', note: 'monthly', confidence: 6 }],
    scores: { clarity: 7, usefulness: 8, easeToBuild: 5, moneyPotential: 6, riskLevel: 7, confidence: 6 },
    nextSteps: [{ id: 'n1', label: 'Talk to 5 families', done: false }],
    visualMap: { center: 'Chore App', branches: [{ id: 'b1', label: 'Problem', items: ['Arguments'] }] },
    notes: '',
    ...overrides,
  };
}

// ── getElementActions ──────────────────────────────────────────────────────────

describe('getElementActions', () => {
  it('returns 2-3 actions for a high-severity risk including "Is it really that bad?"', () => {
    const board = makeBoard();
    const actions = getElementActions('risk', board.risks[0], board);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(actions.some(a => /really that bad/i.test(a.label))).toBe(true);
  });

  it('suggests a price for a money idea without a Rand amount in the note', () => {
    const board = makeBoard();
    const actions = getElementActions('moneyIdea', board.moneyIdeas[0], board);
    expect(actions.some(a => /price/i.test(a.label))).toBe(true);
  });

  it('returns rewrite actions for the summary scalar', () => {
    const board = makeBoard();
    const actions = getElementActions('summary', board.ideaSummary, board);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.every(a => typeof a.prompt === 'string')).toBe(true);
  });
});

// ── applyElementPatch ──────────────────────────────────────────────────────────

describe('applyElementPatch', () => {
  it('replaces an array element by id, preserving the id', () => {
    const board = makeBoard();
    const next = applyElementPatch(board, 'risk', 'r1', { element: { id: 'WRONG', title: 'Reframed', severity: 'low', note: 'handled' } });
    const r1 = next.risks.find(r => r.id === 'r1')!;
    expect(r1.title).toBe('Reframed');
    expect(r1.severity).toBe('low');
    expect(next.risks).toHaveLength(2); // other risk untouched
    expect(next.risks.find(r => r.id === 'r2')!.title).toBe('Low engagement');
  });

  it('updates a scalar field (problem)', () => {
    const board = makeBoard();
    const next = applyElementPatch(board, 'problem', null, { text: 'Sharper problem statement' });
    expect(next.problem).toBe('Sharper problem statement');
  });

  it('clamps scores into 1-10', () => {
    const board = makeBoard();
    const next = applyElementPatch(board, 'scores', null, { scores: { riskLevel: 99, clarity: -4 } });
    expect(next.scores.riskLevel).toBe(10);
    expect(next.scores.clarity).toBe(1);
    expect(next.scores.usefulness).toBe(8); // untouched
  });

  it('appends linked next steps', () => {
    const board = makeBoard();
    const next = applyElementPatch(board, 'risk', 'r1', { element: { id: 'r1' }, addNextSteps: [{ label: 'Validate with a poll' }] });
    expect(next.nextSteps.length).toBe(board.nextSteps.length + 1);
    expect(next.nextSteps.some(s => /Validate with a poll/.test(s.label))).toBe(true);
  });

  it('does not mutate the input content', () => {
    const board = makeBoard();
    const snapshot = JSON.stringify(board);
    applyElementPatch(board, 'risk', 'r1', { element: { id: 'r1', title: 'Changed' }, addNextSteps: [{ label: 'X' }] });
    expect(JSON.stringify(board)).toBe(snapshot);
  });
});

// ── buildElementEditPrompt ───────────────────────────────────────────────────

describe('buildElementEditPrompt', () => {
  it('asks for a text shape for scalar kinds', () => {
    const board = makeBoard();
    const prompt = buildElementEditPrompt('summary', board.ideaSummary, 'make it clearer', board);
    expect(prompt).toMatch(/"text"/);
    expect(prompt).toMatch(/make it clearer/);
  });

  it('asks for an element shape for collection kinds', () => {
    const board = makeBoard();
    const prompt = buildElementEditPrompt('risk', board.risks[0], 'how do I avoid this', board);
    expect(prompt).toMatch(/"element"/);
    expect(prompt).toMatch(/same id/i);
  });
});

// ── ElementChatSheet ───────────────────────────────────────────────────────────

describe('ElementChatSheet', () => {
  const baseProps = {
    open: true as const,
    kind: 'risk' as const,
    preview: 'WhatsApp already used',
    actions: [
      { id: 'avoid', label: 'How do I avoid this?', prompt: 'avoid it' },
      { id: 'safer', label: 'Make a safer plan', prompt: 'safer' },
    ],
    busy: false,
    onAction: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders the preview and action chips', () => {
    render(<ElementChatSheet {...baseProps} />);
    expect(screen.getByTestId('element-chat-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('element-action-avoid')).toBeInTheDocument();
    expect(screen.getByTestId('element-action-safer')).toBeInTheDocument();
  });

  it('fires onAction with the action prompt', () => {
    const onAction = vi.fn();
    render(<ElementChatSheet {...baseProps} onAction={onAction} />);
    fireEvent.click(screen.getByTestId('element-action-avoid'));
    expect(onAction).toHaveBeenCalledWith('avoid it');
  });

  it('shows a thinking state and hides chips when busy', () => {
    render(<ElementChatSheet {...baseProps} busy />);
    expect(screen.queryByTestId('element-action-avoid')).not.toBeInTheDocument();
    expect(screen.getByText(/reshaping this/i)).toBeInTheDocument();
  });

  it('shows an inline error when provided', () => {
    render(<ElementChatSheet {...baseProps} errorText="Daily limit reached" />);
    expect(screen.getByTestId('element-chat-error')).toHaveTextContent('Daily limit reached');
  });

  it('offers a Remove action when onLocalAction is provided', () => {
    const onLocalAction = vi.fn();
    render(<ElementChatSheet {...baseProps} onLocalAction={onLocalAction} />);
    fireEvent.click(screen.getByTestId('element-action-delete'));
    expect(onLocalAction).toHaveBeenCalledWith('delete');
  });
});

// ── Renderer tap ───────────────────────────────────────────────────────────────

describe('IdeaThinkingBoardRenderer — tap-to-talk', () => {
  it('tapping a risk card opens the element sheet', () => {
    render(<IdeaThinkingBoardRenderer content={makeBoard()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tab-risks'));
    fireEvent.click(screen.getByTestId('risk-card-r1'));
    expect(screen.getByTestId('element-chat-sheet')).toBeInTheDocument();
    // contextual actions for a high-severity risk are present
    expect(screen.getByTestId('element-action-avoid')).toBeInTheDocument();
  });

  it('does not open the sheet while in edit mode', () => {
    render(<IdeaThinkingBoardRenderer content={makeBoard()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('tab-risks'));
    fireEvent.click(screen.getByTestId('edit-idea-btn')); // enter edit mode
    fireEvent.click(screen.getByTestId('risk-card-r1'));
    expect(screen.queryByTestId('element-chat-sheet')).not.toBeInTheDocument();
  });
});
