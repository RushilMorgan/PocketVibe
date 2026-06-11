import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { suggestIntent } from '../lib/ideaIntentSuggest';
import { composeIdeaDescription } from '../lib/ideaShape';
import { IdeaIntakeSheet } from '../components/IdeaIntakeSheet';

describe('suggestIntent', () => {
  it('reads a personal fork in the road as a decision', () => {
    expect(suggestIntent('Should I leave my job to freelance full-time, or keep both going?')).toBe('decide');
    expect(suggestIntent("I'm torn between studying further and working")).toBe('decide');
  });

  it('reads two named things side by side as a comparison', () => {
    expect(suggestIntent('LangGraph vs LangChain')).toBe('compare');
    expect(suggestIntent('The difference between building a mobile app and a web app')).toBe('compare');
  });

  it('reads questions about how things work as learning', () => {
    expect(suggestIntent('How does compound interest actually work')).toBe('learn');
    expect(suggestIntent('I want to understand solar power for my home')).toBe('learn');
  });

  it('reads open prompts as brainstorm, defaults to validate', () => {
    expect(suggestIntent('Ideas for my mom\'s 60th birthday')).toBe('brainstorm');
    expect(suggestIntent('A coffee cart outside office parks in the mornings')).toBe('validate');
  });
});

describe('composeIdeaDescription', () => {
  it('stitches all three answers into natural sentences', () => {
    expect(composeIdeaDescription({
      what: 'selling my banana bread',
      who: 'people at the Saturday market',
      why: 'friends keep asking me to make it',
    })).toBe(
      "selling my banana bread. It's for people at the Saturday market. What got me thinking about it: friends keep asking me to make it.",
    );
  });

  it('skipped answers are simply left out', () => {
    expect(composeIdeaDescription({ what: 'A dog-walking service.' })).toBe('A dog-walking service.');
  });

  it('preserves the user\'s casing (proper nouns survive)', () => {
    expect(composeIdeaDescription({ what: 'a cleaning service', who: 'Airbnb hosts' }))
      .toContain("It's for Airbnb hosts.");
  });
});

describe('IdeaIntakeSheet — shape guide flow', () => {
  it('walks the three questions and lands the composed description in the textarea', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByTestId('idea-guide-btn'));
    expect(screen.getByText("What's it about, roughly?")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('idea-guide-input'), { target: { value: 'selling my banana bread' } });
    fireEvent.click(screen.getByTestId('idea-guide-next'));

    expect(screen.getByText(/Who is it for/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('idea-guide-skip'));

    expect(screen.getByText(/What made you think about this now/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('idea-guide-input'), { target: { value: 'friends keep asking for it' } });
    fireEvent.click(screen.getByTestId('idea-guide-next'));

    // Back on the describe step with the stitched, editable description
    const textarea = screen.getByTestId('idea-description-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('selling my banana bread. What got me thinking about it: friends keep asking for it.');
    expect(screen.getByTestId('idea-next-btn')).not.toBeDisabled();
  });

  it('first guide question cannot be skipped, the rest can', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByTestId('idea-guide-btn'));
    expect(screen.queryByTestId('idea-guide-skip')).not.toBeInTheDocument();
    expect(screen.getByTestId('idea-guide-next')).toBeDisabled();
  });

  it('category pills filter the starter examples and stay optional', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    // Default mix shows the freelance question starter
    expect(screen.getByText(/leave my job to freelance/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('idea-category-creative'));
    expect(screen.getByText(/podcast about hidden gems/)).toBeInTheDocument();
    expect(screen.queryByText(/leave my job to freelance/)).not.toBeInTheDocument();
    // Tapping again deselects — no category is ever required
    fireEvent.click(screen.getByTestId('idea-category-creative'));
    expect(screen.getByText(/leave my job to freelance/)).toBeInTheDocument();
  });

  it('guide entry and starters hide once an idea is typed', () => {
    render(<IdeaIntakeSheet open onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('idea-description-input'), { target: { value: 'My idea' } });
    expect(screen.queryByTestId('idea-guide-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('idea-starter-0')).not.toBeInTheDocument();
  });
});
