/**
 * Tests for the Idea Board guided intake flow:
 *  - buildIdeaBoardPrompt composes a rich, specific prompt
 *  - IdeaIntakeSheet: categories, validation, submit payload
 *  - HomeScreen idea card opens the intake (not the chat)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { buildIdeaBoardPrompt, IDEA_CATEGORIES, IDEA_INTENTS } from '../lib/ideaBoardPrompt';
import { IdeaIntakeSheet } from '../components/IdeaIntakeSheet';
import { HomeScreen } from '../components/HomeScreen';

// ── buildIdeaBoardPrompt ───────────────────────────────────────────────────────

describe('buildIdeaBoardPrompt', () => {
  it('validate intent: includes the idea and asks for business framing', () => {
    const prompt = buildIdeaBoardPrompt('Side hustle', 'Selling cakes from home', 'validate');
    expect(prompt).toMatch(/Selling cakes from home/);
    expect(prompt).toMatch(/Idea Thinking Board/i);
    expect(prompt).toMatch(/make money/i);
    expect(prompt).toMatch(/next steps/i);
  });

  it('learn intent: asks for learning exploration, NOT a business pitch', () => {
    const prompt = buildIdeaBoardPrompt('', 'LangGraph vs LangChain', 'learn');
    expect(prompt).toMatch(/LangGraph vs LangChain/);
    expect(prompt).toMatch(/NOT a business pitch/i);
    expect(prompt).toMatch(/understand/i);
    expect(prompt).toMatch(/misconceptions/i);
  });

  it('compare intent: asks for comparison board, NOT a business pitch', () => {
    const prompt = buildIdeaBoardPrompt('', 'REST vs GraphQL', 'compare');
    expect(prompt).toMatch(/REST vs GraphQL/);
    expect(prompt).toMatch(/NOT a business pitch/i);
    expect(prompt).toMatch(/when.*choose/i);
  });

  it('brainstorm intent: asks for open-ended creative exploration', () => {
    const prompt = buildIdeaBoardPrompt('', 'sustainable packaging', 'brainstorm');
    expect(prompt).toMatch(/sustainable packaging/);
    expect(prompt).toMatch(/possibilities/i);
    expect(prompt).toMatch(/creative/i);
  });

  it('decide intent: asks for honest decision-making framing', () => {
    const prompt = buildIdeaBoardPrompt('', 'freelance vs full-time', 'decide');
    expect(prompt).toMatch(/freelance vs full-time/);
    expect(prompt).toMatch(/trade-offs|giving up/i);
  });

  it('defaults to validate if no intent provided', () => {
    const prompt = buildIdeaBoardPrompt('', 'A dog-walking app');
    expect(prompt).toMatch(/A dog-walking app/);
    expect(prompt.length).toBeGreaterThan(50);
  });
});

describe('IDEA_INTENTS', () => {
  it('has 5 intent options including learn and compare', () => {
    expect(IDEA_INTENTS).toHaveLength(5);
    expect(IDEA_INTENTS.find(i => i.id === 'learn')).toBeDefined();
    expect(IDEA_INTENTS.find(i => i.id === 'compare')).toBeDefined();
  });
});

// ── IdeaIntakeSheet ────────────────────────────────────────────────────────────

describe('IdeaIntakeSheet — 2-step flow', () => {
  it('renders nothing when closed', () => {
    render(<IdeaIntakeSheet open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByTestId('idea-intake-sheet')).not.toBeInTheDocument();
  });

  it('step 1: renders all idea categories', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    for (const cat of IDEA_CATEGORIES) {
      expect(screen.getByTestId(`idea-category-${cat.id}`)).toBeInTheDocument();
    }
  });

  it('step 1: Next button is disabled until an idea is typed', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('idea-next-btn')).toBeDisabled();
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'A coffee cart' } });
    expect(screen.getByTestId('idea-next-btn')).not.toBeDisabled();
  });

  it('step 2: clicking Next shows intent choices', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'LangGraph vs LangChain' } });
    fireEvent.click(screen.getByTestId('idea-next-btn'));
    for (const intent of IDEA_INTENTS) {
      expect(screen.getByTestId(`idea-intent-${intent.id}`)).toBeInTheDocument();
    }
  });

  it('step 2: Build button is disabled until an intent is chosen', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'some idea' } });
    fireEvent.click(screen.getByTestId('idea-next-btn'));
    expect(screen.getByTestId('build-idea-board-btn')).toBeDisabled();
    fireEvent.click(screen.getByTestId('idea-intent-learn'));
    expect(screen.getByTestId('build-idea-board-btn')).not.toBeDisabled();
  });

  it('submits category, idea, and intent id', () => {
    const onSubmit = vi.fn();
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('idea-category-side-hustle'));
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'Weekend cakes' } });
    fireEvent.click(screen.getByTestId('idea-next-btn'));
    fireEvent.click(screen.getByTestId('idea-intent-validate'));
    fireEvent.click(screen.getByTestId('build-idea-board-btn'));
    expect(onSubmit).toHaveBeenCalledWith('Side hustle', 'Weekend cakes', 'validate');
  });

  it('submits learn intent for a comparison query', () => {
    const onSubmit = vi.fn();
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'LangGraph vs LangChain' } });
    fireEvent.click(screen.getByTestId('idea-next-btn'));
    fireEvent.click(screen.getByTestId('idea-intent-compare'));
    fireEvent.click(screen.getByTestId('build-idea-board-btn'));
    expect(onSubmit).toHaveBeenCalledWith('', 'LangGraph vs LangChain', 'compare');
  });
});

// ── HomeScreen wiring ──────────────────────────────────────────────────────────

describe('HomeScreen — idea card opens the intake', () => {
  it('idea board card calls onOpenIdeaBoard, not onOpenChat', () => {
    const onOpenIdeaBoard = vi.fn();
    const onOpenChat = vi.fn();
    render(
      <HomeScreen
        onPrompt={vi.fn()}
        isGenerating={false}
        onOpenChat={onOpenChat}
        onOpenIdeaBoard={onOpenIdeaBoard}
      />,
    );
    fireEvent.click(screen.getByTestId('flagship-idea-board'));
    expect(onOpenIdeaBoard).toHaveBeenCalledOnce();
    expect(onOpenChat).not.toHaveBeenCalled();
  });
});
