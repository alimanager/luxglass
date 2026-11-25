import {
  FACE_FEATURE_KEYS,
  FACE_SHAPES,
  FEEDBACK_VERSION,
  FRAME_DESCRIPTORS,
  frameFeatureNames,
  type FaceVector,
  type FrameVocab,
} from './feedback';
import { createRng } from './rng';

/**
 * Learned taste model: a logistic regression on face ⊗ frame interactions, with L2.
 *
 *   logit = bias + a·f + b·g + fᵀ W g
 *
 * f = encoded face (standardised numeric features, a "features missing" flag, one-hot shape),
 * g = encoded frame (standardised descriptors, one-hot facets). The bilinear term W is the
 * interesting part: W[jawRatio][roundness] > 0 reads "strong jaws like rounder frames".
 * No dependency, plain arrays, small enough to ship to the browser (≈ 10 kB of JSON).
 */

export const MODEL_KIND = 'luxoptic-bilinear-logreg';

export interface LearnedModel {
  kind: typeof MODEL_KIND;
  modelVersion: 1;
  feedbackVersion: typeof FEEDBACK_VERSION;
  trainedAt: string;
  /** 'simulated' models are for development only: blend() must get nFeedback = 0 for them */
  source: 'simulated' | 'feedback';
  /** number of real feedback events the model was trained on (0 for a simulated model) */
  nFeedback: number;
  face: { keys: string[]; mean: number[]; sd: number[]; shapes: string[] };
  frame: { vocab: FrameVocab; names: string[]; mean: number[]; sd: number[] };
  bias: number;
  a: number[];
  b: number[];
  /** row-major, face dimension × frame dimension */
  W: number[];
  metrics?: Record<string, unknown>;
}

export interface TrainExample {
  face: FaceVector;
  /** from frameVector(template, vocab) */
  frame: number[];
  y: 0 | 1;
}

export interface TrainOptions {
  vocab: FrameVocab;
  l2?: number;
  epochs?: number;
  lr?: number;
  batch?: number;
  seed?: number;
  source?: LearnedModel['source'];
  nFeedback?: number;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const NUMERIC = FACE_FEATURE_KEYS.length;
/** numeric features + "features missing" flag + one-hot shape */
export const FACE_DIM = NUMERIC + 1 + FACE_SHAPES.length;
/** index of browThicknessRatio: the first field that only exists with `features` */
const FEATURES_START = FACE_FEATURE_KEYS.indexOf('browThicknessRatio');

// ---------------------------------------------------------------- encoding

export function encodeFace(face: FaceVector, m: Pick<LearnedModel, 'face'>): Float64Array {
  const out = new Float64Array(FACE_DIM);
  for (let i = 0; i < NUMERIC; i++) {
    const x = face.v[i];
    // a missing value sits at the training mean (0 after standardisation)
    out[i] = x === null || x === undefined ? 0 : Math.max(-4, Math.min(4, (x - m.face.mean[i]) / m.face.sd[i]));
  }
  out[NUMERIC] = face.v[FEATURES_START] === null ? 1 : 0;
  const s = m.face.shapes.indexOf(face.shape);
  if (s >= 0) out[NUMERIC + 1 + s] = 1;
  return out;
}

export function encodeFrame(frame: readonly number[], m: Pick<LearnedModel, 'frame'>): Float64Array {
  const n = m.frame.names.length;
  if (frame.length !== n) throw new Error(`frame vector: ${frame.length} values, model expects ${n} (rebuild it with model.frame.vocab)`);
  const out = Float64Array.from(frame);
  for (let i = 0; i < FRAME_DESCRIPTORS.length; i++) out[i] = Math.max(-4, Math.min(4, (frame[i] - m.frame.mean[i]) / m.frame.sd[i]));
  return out;
}

function logitEncoded(m: LearnedModel, f: ArrayLike<number>, g: ArrayLike<number>): number {
  const G = g.length;
  let z = m.bias;
  for (let j = 0; j < G; j++) z += m.b[j] * g[j];
  for (let i = 0; i < f.length; i++) {
    const fi = f[i];
    if (fi === 0) continue;
    let row = m.a[i];
    const off = i * G;
    for (let j = 0; j < G; j++) row += m.W[off + j] * g[j];
    z += fi * row;
  }
  return z;
}

/** Like probability in [0, 1]. */
export function predictProba(m: LearnedModel, face: FaceVector, frame: readonly number[]): number {
  return sigmoid(logitEncoded(m, encodeFace(face, m), encodeFrame(frame, m)));
}

/**
 * Learned score 0–100 (the probability that this face says "ça me va", ×100),
 * on the same scale as scoreFit().score.
 */
export function scoreLearned(face: FaceVector, frame: readonly number[], model: LearnedModel): number {
  return Math.round(100 * predictProba(model, face, frame));
}

/**
 * Weight of the learned score: 0 without feedback, `maxWeight` / 2 at `halfAt` events,
 * tending to `maxWeight` (the rules always keep a say, and keep explaining the choice).
 */
export function learnedWeight(nFeedback: number, opts: { halfAt?: number; maxWeight?: number } = {}): number {
  const halfAt = opts.halfAt ?? 2000;
  const maxWeight = opts.maxWeight ?? 0.7;
  const n = Math.max(0, Number.isFinite(nFeedback) ? nFeedback : 0);
  return (maxWeight * n) / (n + halfAt);
}

/** Final score 0–100: the rules, then more and more the model as real feedback accumulates. */
export function blend(ruleScore: number, learnedScore: number, nFeedback: number, opts: { halfAt?: number; maxWeight?: number } = {}): number {
  const w = learnedWeight(nFeedback, opts);
  return Math.max(0, Math.min(100, Math.round((1 - w) * ruleScore + w * learnedScore)));
}

// ---------------------------------------------------------------- training

function meanSd(rows: (number | null)[][], dim: number): { mean: number[]; sd: number[] } {
  const mean: number[] = [];
  const sd: number[] = [];
  for (let i = 0; i < dim; i++) {
    const xs = rows.map((r) => r[i]).filter((x): x is number => typeof x === 'number');
    const mu = xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
    const v = xs.length ? xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length : 1;
    mean.push(mu);
    sd.push(Math.sqrt(v) > 1e-9 ? Math.sqrt(v) : 1);
  }
  return { mean, sd };
}

/** Full model trained with mini-batch Adam on the logistic loss + L2 (bias not penalised). */
export function trainModel(data: readonly TrainExample[], opts: TrainOptions): LearnedModel {
  const names = frameFeatureNames(opts.vocab);
  const G = names.length;
  const F = FACE_DIM;
  const faceStats = meanSd(data.map((d) => d.face.v), NUMERIC);
  const frameStats = meanSd(data.map((d) => d.frame), FRAME_DESCRIPTORS.length);

  const m: LearnedModel = {
    kind: MODEL_KIND,
    modelVersion: 1,
    feedbackVersion: FEEDBACK_VERSION,
    trainedAt: new Date().toISOString().slice(0, 10),
    source: opts.source ?? 'feedback',
    nFeedback: opts.nFeedback ?? data.length,
    face: { keys: [...FACE_FEATURE_KEYS], ...faceStats, shapes: [...FACE_SHAPES] },
    frame: { vocab: opts.vocab, names, ...frameStats },
    bias: 0,
    a: new Array(F).fill(0),
    b: new Array(G).fill(0),
    W: new Array(F * G).fill(0),
  };
  if (data.length === 0) return m;

  const fs = data.map((d) => encodeFace(d.face, m));
  const gs = data.map((d) => encodeFrame(d.frame, m));
  const ys = data.map((d) => d.y);
  const base = ys.reduce<number>((s, y) => s + y, 0) / ys.length;
  m.bias = Math.log(Math.max(1e-3, base) / Math.max(1e-3, 1 - base));

  // parameters as one flat vector: [bias, a, b, W]
  const P = 1 + F + G + F * G;
  const theta = new Float64Array(P);
  theta[0] = m.bias;
  const grad = new Float64Array(P);
  const m1 = new Float64Array(P);
  const m2 = new Float64Array(P);
  const l2 = opts.l2 ?? 1e-3;
  const lr = opts.lr ?? 0.01;
  const epochs = opts.epochs ?? 30;
  const batch = opts.batch ?? 128;
  const rng = createRng(opts.seed ?? 1);
  const order = data.map((_, i) => i);
  const A0 = 1;
  const B0 = 1 + F;
  const W0 = 1 + F + G;
  let step = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    rng.shuffle(order);
    for (let start = 0; start < order.length; start += batch) {
      const end = Math.min(order.length, start + batch);
      grad.fill(0);
      for (let k = start; k < end; k++) {
        const n = order[k];
        const f = fs[n];
        const g = gs[n];
        let z = theta[0];
        for (let j = 0; j < G; j++) z += theta[B0 + j] * g[j];
        for (let i = 0; i < F; i++) {
          if (f[i] === 0) continue;
          let row = theta[A0 + i];
          const off = W0 + i * G;
          for (let j = 0; j < G; j++) row += theta[off + j] * g[j];
          z += f[i] * row;
        }
        const err = sigmoid(z) - ys[n];
        grad[0] += err;
        for (let j = 0; j < G; j++) grad[B0 + j] += err * g[j];
        for (let i = 0; i < F; i++) {
          const e = err * f[i];
          if (e === 0) continue;
          grad[A0 + i] += e;
          const off = W0 + i * G;
          for (let j = 0; j < G; j++) grad[off + j] += e * g[j];
        }
      }
      const inv = 1 / (end - start);
      step++;
      const c1 = 1 - 0.9 ** step;
      const c2 = 1 - 0.999 ** step;
      for (let p = 0; p < P; p++) {
        const gp = grad[p] * inv + (p === 0 ? 0 : l2 * theta[p]);
        m1[p] = 0.9 * m1[p] + 0.1 * gp;
        m2[p] = 0.999 * m2[p] + 0.001 * gp * gp;
        theta[p] -= (lr * (m1[p] / c1)) / (Math.sqrt(m2[p] / c2) + 1e-8);
      }
    }
  }

  m.bias = theta[0];
  m.a = Array.from(theta.subarray(A0, B0));
  m.b = Array.from(theta.subarray(B0, W0));
  m.W = Array.from(theta.subarray(W0));
  return m;
}

// ---------------------------------------------------------------- (de)serialisation

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Compact JSON: weights rounded to 4 decimals (no measurable loss, ~10 kB). */
export function serializeModel(m: LearnedModel): string {
  return JSON.stringify({
    ...m,
    face: { ...m.face, mean: m.face.mean.map(r4), sd: m.face.sd.map(r4) },
    frame: { ...m.frame, mean: m.frame.mean.map(r4), sd: m.frame.sd.map(r4) },
    bias: r4(m.bias),
    a: m.a.map(r4),
    b: m.b.map(r4),
    W: m.W.map(r4),
  });
}

/** Checks a parsed model.json before use; throws with a readable message. */
export function loadModel(json: unknown): LearnedModel {
  const m = json as LearnedModel;
  if (!m || m.kind !== MODEL_KIND) throw new Error('model.json: unknown model kind');
  if (m.feedbackVersion !== FEEDBACK_VERSION) throw new Error(`model.json: feedback version ${m.feedbackVersion}, expected ${FEEDBACK_VERSION}`);
  const F = FACE_DIM;
  const G = m.frame?.names?.length ?? 0;
  if (m.a?.length !== F || m.b?.length !== G || m.W?.length !== F * G) throw new Error('model.json: weight dimensions do not match');
  if (m.face.keys.join() !== FACE_FEATURE_KEYS.join()) throw new Error('model.json: face feature order differs');
  return m;
}

/** The strongest face × frame interactions, for reading what the model learned. */
export function topInteractions(m: LearnedModel, k = 10): { face: string; frame: string; w: number }[] {
  const faceNames = [...m.face.keys, 'featuresMissing', ...m.face.shapes.map((s) => `shape=${s}`)];
  const G = m.frame.names.length;
  return m.W.map((w, idx) => ({ face: faceNames[Math.floor(idx / G)], frame: m.frame.names[idx % G], w }))
    .sort((x, y) => Math.abs(y.w) - Math.abs(x.w))
    .slice(0, k)
    .map((x) => ({ ...x, w: r4(x.w) }));
}
