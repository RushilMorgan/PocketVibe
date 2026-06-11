import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IdeaDecisionMatrix } from '../types';
import { normalizeFiveWhys, sanitizeMatrix, rankOptions } from '../lib/decisionMatrix';
import { coerceGenerateResponse } from '../lib/validator';
import { buildIdeaBoardPrompt } from '../lib/ideaBoardPrompt';
import { IdeaFiveWhys } from '../components/templates/IdeaFiveWhys';
import { IdeaDecisionMatrixCard } from '../components/templates/IdeaDecisionMatrixCard';

function makeMatrix(): IdeaDecisionMatrix {
  return {
    options: [
      { id: 'opt1', label: 'Formal degree', emoji: '🎓' },
      { id: 'opt2', label: 'Self-taught', emoji: '🛠️' },
    ],
    criteria: [
      { id: 'c1', label: 'Cost', weight: 5 },
      { id: 'c2', label: 'Depth', weight: 3 },
    ],
    scores: { opt1: { c1: 3, c2: 9 }, opt2: { c1: 9, c2: 6 } },
  };
}

describe('rankOptions', () => {
  it('ranks by weighted average, best first', () => {
    const ranked = rankOptions(makeMatrix());
    // opt2: (9*5 + 6*3)/8 = 7.9 beats opt1: (3*5 + 9*3)/8 = 5.3
    expect(ranked[0]).toMatchObject({ id: 'opt2', total: 7.9 });
    expect(ranked[1]).toMatchObject({ id: 'opt1', total: 5.3 });
  });
});

describe('sanitizeMatrix', () => {
  it('fills missing scores with neutral 5 and clamps weights', () => {
    const m = sanitizeMatrix({
      options: [{ label: 'A' }, { label: 'B' }],
      criteria: [{ label: 'Price', weight: 99 }, { label: 'Fun' }],
      scores: { opt1: { c1: 42 } },
    })!;
    expect(m.criteria[0].weight).toBe(5);
    expect(m.criteria[1].weight).toBe(3);
    expect(m.scores.opt1.c1).toBe(10);
    expect(m.scores.opt2.c2).toBe(5);
  });

  it('rejects matrices without at least 2 options and 2 criteria', () => {
    expect(sanitizeMatrix({ options: [{ label: 'A' }], criteria: [{ label: 'x' }, { label: 'y' }] })).toBeNull();
    expect(sanitizeMatrix('garbage')).toBeNull();
  });
});

describe('normalizeFiveWhys', () => {
  it('accepts strings or objects and assigns ids', () => {
    expect(normalizeFiveWhys(['surface', { text: 'deeper' }, { why: 'root' }])).toEqual([
      { id: 'w1', text: 'surface' },
      { id: 'w2', text: 'deeper' },
      { id: 'w3', text: 'root' },
    ]);
  });

  it('rejects chains shorter than 2', () => {
    expect(normalizeFiveWhys(['only one'])).toBeNull();
    expect(normalizeFiveWhys('nope')).toBeNull();
  });
});

describe('coerceGenerateResponse — framework fields', () => {
  it('keeps well-formed frameworks and drops malformed ones', () => {
    const raw: Record<string, unknown> = {
      content: {
        type: 'idea_thinking_board',
        ideaSummary: 'x', scores: {}, visualMap: { center: 'x', branches: [] },
        fiveWhys: ['too few'],
        decisionMatrix: makeMatrix(),
      },
    };
    coerceGenerateResponse(raw);
    const c = raw.content as Record<string, unknown>;
    expect(c.fiveWhys).toBeUndefined();
    expect(c.decisionMatrix).toBeDefined();
  });
});

describe('framework prompts', () => {
  it('decide and compare intents request the decisionMatrix shape', () => {
    expect(buildIdeaBoardPrompt('', 'freelance or stay', 'decide')).toContain('decisionMatrix');
    expect(buildIdeaBoardPrompt('', 'REST vs GraphQL', 'compare')).toContain('decisionMatrix');
  });

  it('validate intent requests fiveWhys; learn does not', () => {
    expect(buildIdeaBoardPrompt('', 'coffee cart', 'validate')).toContain('fiveWhys');
    expect(buildIdeaBoardPrompt('', 'solar power', 'learn')).not.toContain('fiveWhys');
  });
});

describe('client/edge framework spec parity', () => {
  it('the edge function system prompt documents both framework fields', () => {
    const edgeSrc = readFileSync(
      resolve(__dirname, '../../supabase/functions/pocketvibe-generate/index.ts'),
      'utf8',
    );
    expect(edgeSrc).toContain('"fiveWhys"');
    expect(edgeSrc).toContain('"decisionMatrix"');
    expect(edgeSrc).toMatch(/FRAMEWORKS \(optional fields, intent-dependent\)/);
  });
});

describe('IdeaFiveWhys', () => {
  it('renders the chain with the last step marked as root cause', () => {
    render(<IdeaFiveWhys steps={[
      { id: 'w1', text: 'Queues are long' },
      { id: 'w2', text: 'Only 2 busy hours a day' },
      { id: 'w3', text: 'Fixed cafes cannot serve commuter bursts' },
    ]} />);
    expect(screen.getByText('Queues are long')).toBeInTheDocument();
    expect(screen.getByText('Root cause')).toBeInTheDocument();
    expect(screen.getByText('Fixed cafes cannot serve commuter bursts')).toBeInTheDocument();
    expect(screen.getAllByText('why?')).toHaveLength(2);
  });
});

describe('IdeaDecisionMatrixCard', () => {
  it('crowns the winner and expands a per-criterion breakdown on tap', () => {
    render(<IdeaDecisionMatrixCard matrix={makeMatrix()} />);
    const winner = screen.getByTestId('matrix-option-opt2');
    expect(winner).toHaveTextContent('🏆');
    expect(winner).toHaveTextContent('7.9');
    expect(screen.queryByText('Cost')).not.toBeInTheDocument();
    fireEvent.click(winner);
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Depth')).toBeInTheDocument();
  });
});
