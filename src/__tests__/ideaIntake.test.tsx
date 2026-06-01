/**
 * Tests for the Idea Board guided intake flow:
 *  - buildIdeaBoardPrompt composes a rich, specific prompt
 *  - IdeaIntakeSheet: categories, validation, submit payload
 *  - HomeScreen idea card opens the intake (not the chat)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { buildIdeaBoardPrompt, IDEA_CATEGORIES } from '../lib/ideaBoardPrompt';
import { IdeaIntakeSheet } from '../components/IdeaIntakeSheet';
import { HomeScreen } from '../components/HomeScreen';

// ── buildIdeaBoardPrompt ───────────────────────────────────────────────────────

describe('buildIdeaBoardPrompt', () => {
  it('includes both the category and the idea text', () => {
    const prompt = buildIdeaBoardPrompt('Side hustle', 'Selling cakes from home');
    expect(prompt).toMatch(/side hustle/i);
    expect(prompt).toMatch(/Selling cakes from home/);
  });

  it('asks for the rich board sections, not a to-do list', () => {
    const prompt = buildIdeaBoardPrompt('Business idea', 'A coffee cart');
    expect(prompt).toMatch(/Idea Thinking Board/i);
    expect(prompt).toMatch(/not a to-do list/i);
    expect(prompt).toMatch(/risks/i);
    expect(prompt).toMatch(/make money/i);
    expect(prompt).toMatch(/mind map/i);
    expect(prompt).toMatch(/next steps/i);
  });

  it('degrades gracefully with only an idea', () => {
    const prompt = buildIdeaBoardPrompt('', 'A dog-walking app');
    expect(prompt).toMatch(/A dog-walking app/);
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('degrades gracefully with nothing', () => {
    const prompt = buildIdeaBoardPrompt('', '');
    expect(prompt).toMatch(/idea/i);
  });
});

// ── IdeaIntakeSheet ────────────────────────────────────────────────────────────

describe('IdeaIntakeSheet', () => {
  it('renders nothing when closed', () => {
    render(<IdeaIntakeSheet open={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByTestId('idea-intake-sheet')).not.toBeInTheDocument();
  });

  it('renders all idea categories when open', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    for (const cat of IDEA_CATEGORIES) {
      expect(screen.getByTestId(`idea-category-${cat.id}`)).toBeInTheDocument();
    }
  });

  it('disables Build until an idea is typed', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('build-idea-board-btn')).toBeDisabled();
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'A coffee cart' } });
    expect(screen.getByTestId('build-idea-board-btn')).not.toBeDisabled();
  });

  it('submits the chosen category label and idea text', () => {
    const onSubmit = vi.fn();
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('idea-category-side-hustle'));
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'Weekend cakes' } });
    fireEvent.click(screen.getByTestId('build-idea-board-btn'));
    expect(onSubmit).toHaveBeenCalledWith('Side hustle', 'Weekend cakes');
  });

  it('submits with an empty category label when none chosen', () => {
    const onSubmit = vi.fn();
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'An app idea' } });
    fireEvent.click(screen.getByTestId('build-idea-board-btn'));
    expect(onSubmit).toHaveBeenCalledWith('', 'An app idea');
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
