import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { IdeaThinkingBoardContent, IdeaScores } from '../types';
import { buildSwot, iceScore } from '../lib/ideaFrameworks';
import { IdeaSnapshot } from '../components/templates/IdeaSnapshot';
import { CreationSummaryBanner } from '../components/CreationSummaryBanner';

function makeScores(overrides: Partial<IdeaScores> = {}): IdeaScores {
  return { clarity: 5, usefulness: 5, easeToBuild: 5, moneyPotential: 5, riskLevel: 5, confidence: 5, ...overrides };
}

function makeBoard(overrides: Partial<IdeaThinkingBoardContent> = {}): IdeaThinkingBoardContent {
  return {
    type: 'idea_thinking_board',
    title: 'Coffee Cart',
    ideaSummary: 'A coffee cart outside office parks.',
    problem: 'No good coffee near offices.',
    solution: 'A mobile cart.',
    targetUsers: [],
    risks: [],
    opportunities: [],
    moneyIdeas: [],
    scores: makeScores(),
    nextSteps: [],
    visualMap: { center: 'Coffee Cart', branches: [] },
    notes: '',
    ...overrides,
  };
}

describe('buildSwot', () => {
  it('maps opportunities and severity-sorted risks one-to-one', () => {
    const swot = buildSwot(makeBoard({
      opportunities: [{ id: 'o1', title: 'No mobile-first option exists', note: '' }],
      risks: [
        { id: 'r1', title: 'Low margins', severity: 'low', note: '' },
        { id: 'r2', title: 'Office parks may refuse permits', severity: 'high', note: '' },
      ],
    }));
    expect(swot.opportunities).toEqual(['No mobile-first option exists']);
    expect(swot.threats[0]).toBe('Office parks may refuse permits');
  });

  it('reads strengths from high scores and weaknesses from low ones', () => {
    const swot = buildSwot(makeBoard({ scores: makeScores({ usefulness: 9, moneyPotential: 3 }) }));
    expect(swot.strengths).toContain('Solves a real, felt need');
    expect(swot.weaknesses).toContain('No obvious way to make money yet');
  });

  it('treats high riskLevel as a weakness (it is the inverted score)', () => {
    const swot = buildSwot(makeBoard({ scores: makeScores({ riskLevel: 8 }) }));
    expect(swot.weaknesses.join(' ')).toMatch(/risk runs high/i);
  });

  it('caps each quadrant at three items', () => {
    const risks = ['a', 'b', 'c', 'd'].map((t, i) => ({ id: String(i), title: t, severity: 'medium' as const, note: '' }));
    expect(buildSwot(makeBoard({ risks })).threats).toHaveLength(3);
  });
});

describe('iceScore', () => {
  it('averages impact (usefulness), confidence and ease to one decimal', () => {
    const ice = iceScore(makeScores({ usefulness: 8, confidence: 7, easeToBuild: 6 }));
    expect(ice).toMatchObject({ impact: 8, confidence: 7, ease: 6, total: 7 });
  });

  it('verdict bands match the total', () => {
    expect(iceScore(makeScores({ usefulness: 9, confidence: 9, easeToBuild: 9 })).verdict).toMatch(/worth testing/i);
    expect(iceScore(makeScores({ usefulness: 2, confidence: 2, easeToBuild: 2 })).verdict).toMatch(/caution/i);
  });

  it('survives missing scores with neutral defaults', () => {
    expect(iceScore(undefined).total).toBe(5);
  });
});

describe('IdeaSnapshot', () => {
  it('renders the ICE verdict and all four SWOT quadrants', () => {
    render(<IdeaSnapshot content={makeBoard({
      scores: makeScores({ usefulness: 9, confidence: 9, easeToBuild: 7 }),
      opportunities: [{ id: 'o1', title: 'First mover in the area', note: '' }],
      risks: [{ id: 'r1', title: 'Rainy season kills foot traffic', severity: 'medium', note: '' }],
    })} />);
    expect(screen.getByText(/worth testing/i)).toBeInTheDocument();
    expect(screen.getByText('8.3')).toBeInTheDocument(); // ICE dial total (9+9+7)/3
    for (const q of ['strengths', 'weaknesses', 'opportunities', 'threats']) {
      expect(screen.getByTestId(`swot-${q}`)).toBeInTheDocument();
    }
    expect(screen.getByText('First mover in the area')).toBeInTheDocument();
    expect(screen.getByText('Rainy season kills foot traffic')).toBeInTheDocument();
  });
});

describe('CreationSummaryBanner', () => {
  it('starts clamped, expands on tap, and can be dismissed', () => {
    render(<CreationSummaryBanner text="A long summary about the freshly built tool." />);
    const expand = screen.getByTestId('summary-expand');
    expect(expand.querySelector('p')!.className).toContain('line-clamp-1');
    fireEvent.click(expand);
    expect(expand.querySelector('p')!.className).not.toContain('line-clamp-1');
    fireEvent.click(screen.getByTestId('summary-dismiss'));
    expect(screen.queryByTestId('creation-summary-banner')).not.toBeInTheDocument();
  });
});
