import {
  MAX_ENTRIES,
  drawIndex,
  landingAngle,
  nextWheelState,
  normaliseEntries,
  rollDice,
  tossCoin,
  weightedIndex,
} from '../draw';

/** A deterministic generator, so a fairness test is about the algorithm and not luck. */
const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('drawIndex — the winner is chosen, then the wheel is animated to it', () => {
  it('picks the first entry at the bottom of the range', () => {
    expect(drawIndex(4, () => 0)).toBe(0);
  });

  it('picks the last entry just below the top of the range', () => {
    expect(drawIndex(4, () => 0.9999999)).toBe(3);
  });

  it('never returns the count itself, even at exactly 1', () => {
    // Math.random() is documented as [0, 1) but a supplied generator may not be.
    expect(drawIndex(4, () => 1)).toBe(3);
  });

  it('returns -1 for an empty wheel rather than 0, which would be a phantom winner', () => {
    expect(drawIndex(0, () => 0.5)).toBe(-1);
  });

  it('is uniform across entries', () => {
    // 6 entries, 60 000 draws: each should land near 10 000. A wheel biased by segment
    // geometry — spin a random angle and read off what it stops on — fails this.
    const counts = new Array(6).fill(0);
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 60000; i += 1) counts[drawIndex(6, rng)]! += 1;
    for (const count of counts) {
      expect(count).toBeGreaterThan(9000);
      expect(count).toBeLessThan(11000);
    }
  });
});

describe('weightedIndex', () => {
  it('honours the weights', () => {
    // [1, 3]: the second entry owns 75% of the range.
    expect(weightedIndex([1, 3], () => 0.1)).toBe(0);
    expect(weightedIndex([1, 3], () => 0.3)).toBe(1);
    expect(weightedIndex([1, 3], () => 0.99)).toBe(1);
  });

  it('falls back to uniform when every weight is zero, rather than never returning', () => {
    expect(weightedIndex([0, 0, 0], () => 0.5)).toBe(1);
  });

  it('ignores a negative weight instead of reversing the range', () => {
    expect(weightedIndex([-5, 1], () => 0.5)).toBe(1);
  });

  it('is -1 for no entries', () => {
    expect(weightedIndex([], () => 0.5)).toBe(-1);
  });

  it('is uniform when all weights are equal', () => {
    const counts = [0, 0, 0, 0];
    let seed = 999;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 40000; i += 1) counts[weightedIndex([1, 1, 1, 1], rng)]! += 1;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(800);
  });
});

describe('landingAngle — the wheel is animated to the winner, not the other way round', () => {
  it.each([0, 1, 2, 3])('puts entry %i under the pointer', (index) => {
    // The invariant, rather than a hand-computed number: rotating the wheel by this angle
    // must bring that segment's CENTRE to the pointer at the top, i.e. to 0 degrees.
    const count = 4;
    const segment = 360 / count;
    const centreAfterRotation = (landingAngle(index, count, 5) + index * segment + segment / 2) % 360;
    expect(centreAfterRotation).toBeCloseTo(0, 6);
  });

  it('always spins at least the requested number of full turns', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(landingAngle(i, 4, 5)).toBeGreaterThanOrEqual(5 * 360);
    }
  });

  it('gives a different angle for each entry', () => {
    const angles = [0, 1, 2, 3].map((i) => landingAngle(i, 4, 5) % 360);
    expect(new Set(angles).size).toBe(4);
  });

  it('is zero for an empty wheel rather than NaN', () => {
    expect(landingAngle(-1, 0, 5)).toBe(0);
  });
});

describe('normaliseEntries', () => {
  it('drops blanks and trims', () => {
    expect(normaliseEntries(['  Pizza ', '', '   ', 'Sushi'])).toEqual(['Pizza', 'Sushi']);
  });

  it('removes duplicates, which would double a choice\'s odds without saying so', () => {
    expect(normaliseEntries(['Pizza', 'pizza', 'Sushi'])).toEqual(['Pizza', 'Sushi']);
  });

  it('caps the count so the wheel stays readable', () => {
    const many = Array.from({ length: MAX_ENTRIES + 10 }, (_, i) => `Entry ${i}`);
    expect(normaliseEntries(many)).toHaveLength(MAX_ENTRIES);
  });
});

describe('nextWheelState — draw without replacement', () => {
  it('removes the winner when asked', () => {
    expect(nextWheelState(['a', 'b', 'c'], 1, true)).toEqual(['a', 'c']);
  });

  it('leaves the wheel alone when not', () => {
    expect(nextWheelState(['a', 'b', 'c'], 1, false)).toEqual(['a', 'b', 'c']);
  });

  it('ignores an out-of-range winner rather than corrupting the list', () => {
    expect(nextWheelState(['a', 'b'], 5, true)).toEqual(['a', 'b']);
  });
});

describe('coin and dice', () => {
  it('a coin is one of two faces', () => {
    expect(tossCoin(() => 0.1)).toBe('heads');
    expect(tossCoin(() => 0.9)).toBe('tails');
  });

  it('a coin is fair', () => {
    let heads = 0;
    let seed = 7;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 20000; i += 1) if (tossCoin(rng) === 'heads') heads += 1;
    expect(Math.abs(heads - 10000)).toBeLessThan(400);
  });

  it('rolls dice within range', () => {
    expect(rollDice(2, 6, sequence([0, 0.999999]))).toEqual([1, 6]);
  });

  it('never rolls a zero or above the number of sides', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 5000; i += 1) {
      for (const value of rollDice(3, 20, rng)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(20);
      }
    }
  });

  it('refuses a nonsensical die rather than returning junk', () => {
    expect(rollDice(0, 6, () => 0.5)).toEqual([]);
    expect(rollDice(2, 0, () => 0.5)).toEqual([]);
  });
});
