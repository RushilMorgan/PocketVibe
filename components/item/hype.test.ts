import { describe, expect, it } from 'vitest';
import { splitHype } from './hype';

describe('splitHype', () => {
  it('splits hype from established', () => {
    expect(splitHype('Hype: Giant snakes are waking up. Established: Sandstone cracks into scale-like patterns.')).toEqual([
      { label: 'Hype', text: 'Giant snakes are waking up.' },
      { label: 'Established', text: 'Sandstone cracks into scale-like patterns.' },
    ]);
  });

  it('keeps any lead-in and handles either order and case', () => {
    expect(splitHype('Mixed. established: a is true. HYPE: b is not.')).toEqual([
      { label: null, text: 'Mixed.' },
      { label: 'Established', text: 'a is true.' },
      { label: 'Hype', text: 'b is not.' },
    ]);
  });

  it('returns plain text when there are no labels', () => {
    expect(splitHype(' Mostly solid, one claim is a stretch. ')).toEqual([{ label: null, text: 'Mostly solid, one claim is a stretch.' }]);
  });
});
