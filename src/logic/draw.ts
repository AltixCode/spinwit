/**
 * Choosing a winner, and the angle the wheel has to land on to show it. Pure and
 * dependency-free, and the random source is injected so fairness is testable.
 *
 * The order matters and is the whole point. The winner is drawn **first**, by a uniform draw
 * over the entries, and the wheel is then animated to land on it. The tempting alternative —
 * spin by a random angle and read off whatever segment stops under the pointer — is biased by
 * segment geometry and by where the pointer sits, and the bias is completely invisible: the
 * animation looks identical and some entries simply come up more often forever.
 */

/** Entries beyond this and the wheel is unreadable, so it stops accepting them. */
export const MAX_ENTRIES = 24;

type Rng = () => number;

/** Clamps a supplied generator into [0, 1); `Math.random` is already there, others may not be. */
const unit = (rng: Rng): number => {
  const value = rng();
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 0.9999999999);
};

/** A uniform winner, or -1 when there is nothing to draw from. */
export function drawIndex(count: number, rng: Rng = Math.random): number {
  if (!Number.isFinite(count) || count < 1) return -1;
  return Math.floor(unit(rng) * count);
}

/**
 * A weighted winner. Weights are the paid variant of the same draw — they change the odds
 * deliberately, and the UI says so rather than quietly biasing an apparently fair wheel.
 */
export function weightedIndex(weights: readonly number[], rng: Rng = Math.random): number {
  if (weights.length === 0) return -1;
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  // Every weight zero or invalid: fall back to uniform rather than looping or always
  // returning the first entry.
  if (total <= 0) return drawIndex(weights.length, rng);

  let ticket = unit(rng) * total;
  for (let i = 0; i < safe.length; i += 1) {
    ticket -= safe[i]!;
    if (ticket < 0) return i;
  }
  return safe.length - 1;
}

/**
 * The absolute rotation, in degrees, that brings `index`'s segment under the pointer at the
 * top, after at least `turns` whole revolutions so the spin reads as a spin.
 */
export function landingAngle(index: number, count: number, turns: number): number {
  if (index < 0 || count < 1) return 0;
  const segment = 360 / count;
  // Rotate so the *centre* of the segment, not its edge, arrives under the pointer.
  const offset = 360 - index * segment - segment / 2;
  return turns * 360 + offset;
}

/**
 * Trims, drops blanks, removes case-insensitive duplicates and caps the count.
 *
 * Duplicates are removed rather than kept because two identical entries double that choice's
 * odds, which is a weighting the user did not ask for and cannot see.
 */
export function normaliseEntries(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    if (entry === '') continue;
    const key = entry.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length === MAX_ENTRIES) break;
  }
  return out;
}

/** The wheel after a spin: unchanged, or with the winner removed for a draw without replacement. */
export function nextWheelState(
  entries: readonly string[],
  winner: number,
  removeOnWin: boolean,
): string[] {
  if (!removeOnWin || winner < 0 || winner >= entries.length) return [...entries];
  return entries.filter((_, i) => i !== winner);
}

export type CoinFace = 'heads' | 'tails';

export function tossCoin(rng: Rng = Math.random): CoinFace {
  return unit(rng) < 0.5 ? 'heads' : 'tails';
}

/** `count` dice of `sides` each. Empty for a die that cannot exist. */
export function rollDice(count: number, sides: number, rng: Rng = Math.random): number[] {
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count < 1 || sides < 2) return [];
  return Array.from({ length: Math.floor(count) }, () => Math.floor(unit(rng) * Math.floor(sides)) + 1);
}
