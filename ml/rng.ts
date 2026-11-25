/** Small seeded RNG (mulberry32) so simulations and training are reproducible. */
export interface Rng {
  /** uniform in [0, 1) */
  next(): number;
  uniform(lo: number, hi: number): number;
  normal(mean?: number, sd?: number): number;
  int(n: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    normal: (mean = 0, sd = 1) => {
      // Box–Muller, one value per call (keeps the stream simple and deterministic)
      const u = Math.max(next(), 1e-12);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    int: (n) => Math.floor(next() * n),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    shuffle: (xs) => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [xs[i], xs[j]] = [xs[j], xs[i]];
      }
      return xs;
    },
  };
  return rng;
}
