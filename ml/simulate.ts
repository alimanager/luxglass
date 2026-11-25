import { computeMetrics, skinFromRgb, type FaceMetrics } from '../src/lib/faceMetrics';
import { syntheticFace } from '../src/__tests__/syntheticFace';
import { createFeedbackEvent, faceVector, type FaceVector, type FeedbackEvent, type FeedbackSource, type GabaritTemplate } from './feedback';
import { createRng, type Rng } from './rng';

/**
 * Simulated feedback, to build and test the learning pipeline before real users exist.
 *
 * Faces come from syntheticFace + computeMetrics (the same code path as the app). Labels come
 * from a hidden "ground truth" utility: population preferences that look like the expert rules
 * (round faces like angles, thick brows like presence, droopy eyes like lifted corners…) with
 * strengths the rules do not know, a per-template popularity, a personal taste per user and
 * Bernoulli noise. Everything is seeded and deterministic.
 */

export interface SimOptions {
  users: number;
  /** ratings per user (templates drawn without replacement) */
  perUser: number;
  seed: number;
  /** multiplies the whole utility: higher = less label noise */
  sharpness?: number;
  /** spread of the per-user taste */
  tasteSd?: number;
}

export interface SimUser {
  id: number;
  metrics: FaceMetrics;
  face: FaceVector;
}

export interface SimRating {
  user: number;
  templateId: string;
  like: boolean;
  /** true like probability under the hidden model (for the oracle ceiling) */
  p: number;
  source: FeedbackSource;
}

export interface SimData {
  users: SimUser[];
  ratings: SimRating[];
  /** the same ratings as schema events (what the app would have sent) */
  events: FeedbackEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// ---------------------------------------------------------------- faces

/** Archetypes keep face shapes balanced; the shape stored is the one the app measures. */
const ARCHETYPES = [
  (r: Rng) => { const W = r.uniform(128, 144); return { W, L: r.uniform(158, 172), J: r.uniform(90, 112) }; }, // oval
  (r: Rng) => { const W = r.uniform(132, 148); return { W, L: W * r.uniform(1.0, 1.1), J: r.uniform(96, 112) }; }, // round
  (r: Rng) => { const W = r.uniform(128, 144); return { W, L: W * r.uniform(1.1, 1.2), J: W * r.uniform(0.87, 0.95) }; }, // square
  (r: Rng) => { const W = r.uniform(128, 142); return { W, L: r.uniform(158, 172), J: r.uniform(62, 72) }; }, // heart
  (r: Rng) => { const W = r.uniform(124, 138); return { W, L: W * r.uniform(1.32, 1.45), J: r.uniform(90, 110) }; }, // oblong
];

const SKIN_BASES = [
  [230, 190, 160], [225, 185, 150], [210, 170, 120], // warm-ish
  [200, 150, 140], [240, 200, 190], [190, 140, 130], // cool-ish
  [205, 160, 135], [180, 130, 100], [120, 80, 60], // neutral-ish
];

export function simulateFace(rng: Rng): FaceMetrics {
  const { W, L, J } = rng.pick(ARCHETYPES)(rng);
  const landmarks = syntheticFace({
    faceWidth: W,
    faceLength: L,
    jaw: J,
    browThick: rng.uniform(2.8, 9),
    browArch: rng.uniform(0, 7),
    eyeTilt: rng.uniform(-3, 11),
  });
  const base = rng.pick(SKIN_BASES);
  const k = rng.uniform(0.6, 1.06);
  const [r, g, b] = base.map((c) => clamp(Math.round(c * k + rng.normal(0, 4)), 0, 255));
  return computeMetrics(landmarks, skinFromRgb(r, g, b));
}

// ---------------------------------------------------------------- hidden preferences

/** Frame traits in rough "standard units" from the descriptors and facets. */
function frameTraits(t: GabaritTemplate) {
  const d = t.descriptor;
  const tokens = Object.entries(t.finish).map(([k, v]) => `${k}:${v}`);
  const warm = tokens.some((x) => /ecaille|miel|brun|metal:or/.test(x)) ? 1 : 0;
  const cool = tokens.some((x) => /noir|canon|argent/.test(x)) ? 1 : 0;
  return {
    ang: clamp((0.95 - d.roundness) / 0.1, -1, 2),
    tall: clamp((d.ratio - 0.75) / 0.12, -2, 2),
    pres: clamp((d.presence - 2.8) / 1.6, -1.5, 2),
    top: clamp((d.top - 1.5) / 1.8, -1, 2),
    lift: clamp(d.lift / 0.2, -0.5, 3),
    warmth: warm - cool,
  };
}
type Traits = ReturnType<typeof frameTraits>;
const TRAIT_KEYS: (keyof Traits)[] = ['ang', 'tall', 'pres', 'top', 'lift', 'warmth'];

/** Face traits in standard units, from the metrics the app computes. */
function faceTraits(m: FaceMetrics) {
  const f = m.features;
  const z = (x: number, c: number, s: number) => clamp((x - c) / s, -2, 2);
  return {
    round: z(1.17 - m.lengthRatio, 0, 0.06),
    long: z(m.lengthRatio, 1.28, 0.06),
    jaw: z(m.jawRatio, 0.8, 0.06),
    heart: z(m.foreheadRatio - m.jawRatio, 0.12, 0.08),
    brow: f ? z(f.browThicknessRatio, 0.18, 0.06) : 0,
    arch: f ? z(f.browArchRatio, 0.1, 0.05) : 0,
    droop: f ? z(-f.eyeTiltDeg, -4, 3.5) : 0,
    intensity: f ? z(f.intensity, 0.5, 0.25) : 0,
    width: z(m.faceWidthMm, 136, 6),
    warm: m.skin.undertone === 'chaud' ? 1 : m.skin.undertone === 'froid' ? -1 : 0,
  };
}

function populationUtility(face: ReturnType<typeof faceTraits>, t: Traits, sizeFacet: string): number {
  let u = 0;
  u += 0.7 * face.round * t.ang; // angles structure round faces
  u += face.jaw * (-0.6 * t.ang - 0.25 * t.pres); // curves and lightness soften a strong jaw
  u += face.long * (0.6 * t.tall + 0.25 * t.pres); // tall lenses shorten a long face
  u += face.heart * (-0.5 * t.top - 0.3 * t.lift); // light top for a wide forehead
  u += face.brow * (0.45 * t.pres + 0.35 * t.top); // thick brows want a marked top line
  u += 0.55 * face.droop * t.lift; // lifted corners raise droopy eyes
  u += -0.25 * face.arch * t.ang; // arched brows like rounded tops
  u += -0.35 * Math.abs(face.intensity - t.pres); // presence matches the features (non-linear)
  u += 0.35 * face.warm * t.warmth; // warm finishes on warm undertones
  if (sizeFacet === 'oversize') u += 0.3 * face.width;
  if (sizeFacet === 'fine') u -= 0.3 * face.width;
  return u;
}

/** Stable per-template popularity from the id (independent of catalogue order). */
function popularity(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return createRng(h >>> 0).normal(0, 0.35);
}

// ---------------------------------------------------------------- simulation

const DATE = new Date('2026-11-01T10:00:00Z');

export function simulate(templates: readonly GabaritTemplate[], opts: SimOptions): SimData {
  const rng = createRng(opts.seed);
  const sharp = opts.sharpness ?? 1.6;
  const tasteSd = opts.tasteSd ?? 0.35;
  const sorted = [...templates].sort((a, b) => (a.id < b.id ? -1 : 1));
  const traits = new Map(sorted.map((t) => [t.id, frameTraits(t)]));
  const constructions = [...new Set(sorted.map((t) => t.construction))].sort();
  const perUser = Math.min(opts.perUser, sorted.length);

  const users: SimUser[] = [];
  const ratings: SimRating[] = [];
  const events: FeedbackEvent[] = [];
  for (let id = 0; id < opts.users; id++) {
    const metrics = simulateFace(rng);
    const face = faceTraits(metrics);
    users.push({ id, metrics, face: faceVector(metrics) });
    // personal taste: a bias, a weight per trait and a weight per construction
    const bias = rng.normal(0, 0.4);
    const taste = Object.fromEntries(TRAIT_KEYS.map((k) => [k, rng.normal(0, tasteSd)])) as Record<keyof Traits, number>;
    const tasteConstruction = new Map(constructions.map((c) => [c, rng.normal(0, tasteSd)]));

    const order = rng.shuffle(sorted.map((_, i) => i)).slice(0, perUser);
    for (const i of order) {
      const t = sorted[i];
      const tr = traits.get(t.id)!;
      let u = bias + popularity(t.id) + populationUtility(face, tr, t.size);
      for (const k of TRAIT_KEYS) u += taste[k] * tr[k];
      u += tasteConstruction.get(t.construction) ?? 0;
      const p = sigmoid(sharp * u);
      const like = rng.next() < p;
      const r = rng.next();
      const source: FeedbackSource = r < 0.5 ? 'apercu' : r < 0.8 ? 'essai' : 'kit';
      ratings.push({ user: id, templateId: t.id, like, p, source });
      events.push(createFeedbackEvent({ templateId: t.id, label: like ? 'like' : 'dislike', source, metrics, consent: true, now: DATE })!);
    }
  }
  return { users, ratings, events };
}
