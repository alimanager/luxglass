import type { FaceMetrics, FaceShape } from '../src/lib/faceMetrics';

/**
 * "Ça me va / ça ne me va pas" feedback, as it is stored for learning.
 *
 * Privacy by construction: an event holds no image, no landmark, no name, no account id,
 * no device id and no precise timestamp. The face is a short list of rounded ratios and
 * measurements (see FACE_FEATURES) from which the face cannot be redrawn.
 * Any change to the meaning or order of FACE_FEATURES must bump FEEDBACK_VERSION.
 */

export const FEEDBACK_VERSION = 1 as const;

export const FACE_SHAPES: readonly FaceShape[] = ['oval', 'round', 'square', 'heart', 'oblong'];
export const LABELS = ['like', 'dislike'] as const;
export const SOURCES = ['apercu', 'essai', 'kit'] as const;

export type FeedbackLabel = (typeof LABELS)[number];
export type FeedbackSource = (typeof SOURCES)[number];

/**
 * Fixed order of the numeric face vector (version 1).
 * `digits` is the rounding applied before storage; `range` is the plausible interval
 * used by validation (anything outside is rejected as corrupt).
 */
export const FACE_FEATURES = [
  { key: 'lengthRatio', digits: 3, range: [0.8, 1.8], doc: 'longueur / largeur aux pommettes' },
  { key: 'jawRatio', digits: 3, range: [0.5, 1.1], doc: 'largeur de mâchoire / largeur aux pommettes' },
  { key: 'foreheadRatio', digits: 3, range: [0.5, 1.2], doc: 'largeur du front / largeur aux pommettes' },
  { key: 'thirdsRatio', digits: 3, range: [0.4, 2.0], doc: 'tiers moyen / tiers inférieur' },
  { key: 'eyeSpacingRatio', digits: 3, range: [0.5, 1.8], doc: 'écart entre les yeux / largeur d’un œil' },
  { key: 'faceWidthMm', digits: 0, range: [90, 190], doc: 'largeur du visage, mm (arrondie au mm)' },
  { key: 'pupillaryDistanceMm', digits: 0, range: [40, 85], doc: 'écart pupillaire, mm (arrondi au mm)' },
  { key: 'skinIta', digits: 0, range: [-90, 90], doc: 'clarté de peau, angle ITA° (entier)' },
  { key: 'undertone', digits: 0, range: [-1, 1], doc: 'sous-ton : -1 froid, 0 neutre, +1 chaud' },
  { key: 'browThicknessRatio', digits: 3, range: [0, 1], doc: 'épaisseur des sourcils / largeur d’un œil' },
  { key: 'browArchRatio', digits: 3, range: [0, 1], doc: 'arc des sourcils / longueur du sourcil' },
  { key: 'browGapRatio', digits: 3, range: [0, 2], doc: 'hauteur sourcil–paupière / largeur d’un œil' },
  { key: 'eyeTiltDeg', digits: 1, range: [-30, 30], doc: 'inclinaison des yeux, degrés' },
  { key: 'intensity', digits: 2, range: [0, 1], doc: 'force des traits, 0–1' },
  { key: 'browContrast', digits: 2, range: [0, 1], doc: 'contraste sourcils / peau, 0–1' },
] as const;

export type FaceFeatureKey = (typeof FACE_FEATURES)[number]['key'];
export const FACE_FEATURE_KEYS: readonly FaceFeatureKey[] = FACE_FEATURES.map((f) => f.key);

/** Compact face description. `null` = not measured (old reports, no `features`, no image). */
export interface FaceVector {
  shape: FaceShape;
  v: (number | null)[];
}

export interface FeedbackEvent {
  version: typeof FEEDBACK_VERSION;
  /** ISO 8601, truncated to the hour (UTC) so events cannot be lined up with server logs */
  at: string;
  templateId: string;
  label: FeedbackLabel;
  source: FeedbackSource;
  face: FaceVector;
  /** recorded only after an explicit opt-in; an event without consent is never created */
  consent: true;
}

const round = (x: number, digits: number) => {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
};

/** Face vector in FACE_FEATURES order. Missing `features` (or brow contrast) become null. */
export function faceVector(m: FaceMetrics): FaceVector {
  const f = m.features;
  const undertone = m.skin.undertone === 'chaud' ? 1 : m.skin.undertone === 'froid' ? -1 : 0;
  const raw: Record<FaceFeatureKey, number | undefined> = {
    lengthRatio: m.lengthRatio,
    jawRatio: m.jawRatio,
    foreheadRatio: m.foreheadRatio,
    thirdsRatio: m.thirdsRatio,
    eyeSpacingRatio: m.eyeSpacingRatio,
    faceWidthMm: m.faceWidthMm,
    pupillaryDistanceMm: m.pupillaryDistanceMm,
    skinIta: m.skin.ita,
    undertone,
    browThicknessRatio: f?.browThicknessRatio,
    browArchRatio: f?.browArchRatio,
    browGapRatio: f?.browGapRatio,
    eyeTiltDeg: f?.eyeTiltDeg,
    intensity: f?.intensity,
    browContrast: f?.browContrast,
  };
  return {
    shape: m.shape,
    v: FACE_FEATURES.map(({ key, digits, range }) => {
      const x = raw[key];
      if (x === undefined || !Number.isFinite(x)) return null;
      // clamp into the plausible range so a measuring glitch never invalidates the event
      return round(Math.min(range[1], Math.max(range[0], x)), digits);
    }),
  };
}

export function createFeedbackEvent(input: {
  templateId: string;
  label: FeedbackLabel;
  source: FeedbackSource;
  metrics: FaceMetrics;
  consent: boolean;
  now?: Date;
}): FeedbackEvent | null {
  if (input.consent !== true) return null;
  const at = new Date(input.now ?? Date.now());
  at.setUTCMinutes(0, 0, 0);
  return {
    version: FEEDBACK_VERSION,
    at: at.toISOString(),
    templateId: input.templateId,
    label: input.label,
    source: input.source,
    face: faceVector(input.metrics),
    consent: true,
  };
}

// ---------------------------------------------------------------- validation

export type Validation = { ok: true; event: FeedbackEvent } | { ok: false; errors: string[] };

const EVENT_KEYS = ['version', 'at', 'templateId', 'label', 'source', 'face', 'consent'];
const ISO_HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00(\.000)?Z$/;
const TEMPLATE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Strict validation: unknown keys are rejected, so nothing extra (image, landmarks, e-mail…)
 * can slip into the dataset. `knownTemplateIds` optionally checks the id against the catalogue.
 */
export function validateFeedback(x: unknown, knownTemplateIds?: ReadonlySet<string>): Validation {
  const errors: string[] = [];
  if (!isObject(x)) return { ok: false, errors: ['event: objet attendu'] };
  for (const k of Object.keys(x)) if (!EVENT_KEYS.includes(k)) errors.push(`clé inconnue : ${k}`);
  if (x.version !== FEEDBACK_VERSION) errors.push(`version : ${FEEDBACK_VERSION} attendu`);
  if (typeof x.at !== 'string' || !ISO_HOUR.test(x.at) || Number.isNaN(Date.parse(x.at))) {
    errors.push('at : date ISO arrondie à l’heure attendue');
  }
  if (typeof x.templateId !== 'string' || !TEMPLATE_ID.test(x.templateId)) errors.push('templateId : identifiant invalide');
  else if (knownTemplateIds && !knownTemplateIds.has(x.templateId)) errors.push(`templateId : gabarit inconnu (${x.templateId})`);
  if (!LABELS.includes(x.label as FeedbackLabel)) errors.push('label : like | dislike');
  if (!SOURCES.includes(x.source as FeedbackSource)) errors.push('source : apercu | essai | kit');
  if (x.consent !== true) errors.push('consent : true obligatoire');

  const face = x.face;
  if (!isObject(face)) errors.push('face : objet attendu');
  else {
    for (const k of Object.keys(face)) if (k !== 'shape' && k !== 'v') errors.push(`face : clé inconnue ${k}`);
    if (!FACE_SHAPES.includes(face.shape as FaceShape)) errors.push('face.shape : forme inconnue');
    if (!Array.isArray(face.v) || face.v.length !== FACE_FEATURES.length) {
      errors.push(`face.v : ${FACE_FEATURES.length} valeurs attendues`);
    } else {
      face.v.forEach((val, i) => {
        if (val === null) return;
        const { key, range } = FACE_FEATURES[i];
        if (typeof val !== 'number' || !Number.isFinite(val)) errors.push(`face.v[${i}] (${key}) : nombre ou null attendu`);
        else if (val < range[0] || val > range[1]) errors.push(`face.v[${i}] (${key}) : hors plage ${range[0]}–${range[1]}`);
      });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, event: x as unknown as FeedbackEvent };
}

// ---------------------------------------------------------------- JSONL

/** One event per line, keys in a stable order. */
export function toJsonl(events: readonly FeedbackEvent[]): string {
  return events
    .map((e) =>
      JSON.stringify({
        version: e.version,
        at: e.at,
        templateId: e.templateId,
        label: e.label,
        source: e.source,
        face: { shape: e.face.shape, v: e.face.v },
        consent: e.consent,
      })
    )
    .map((l) => l + '\n')
    .join('');
}

/** Parses JSONL; invalid lines are reported (1-based line numbers) and skipped. */
export function parseJsonl(text: string, knownTemplateIds?: ReadonlySet<string>): { events: FeedbackEvent[]; errors: { line: number; errors: string[] }[] } {
  const events: FeedbackEvent[] = [];
  const errors: { line: number; errors: string[] }[] = [];
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      errors.push({ line: i + 1, errors: ['JSON invalide'] });
      return;
    }
    const r = validateFeedback(parsed, knownTemplateIds);
    if (r.ok) events.push(r.event);
    else errors.push({ line: i + 1, errors: r.errors });
  });
  return { events, errors };
}

/**
 * Grouping key for train/validation splits on real data. Events carry no user id, but all the
 * feedback given after one analysis shares the same face vector, so it stands in for "one person".
 */
export function faceGroupKey(face: FaceVector): string {
  return face.shape + ':' + face.v.map((x) => (x === null ? '_' : String(x))).join(',');
}

// ---------------------------------------------------------------- frames

/** One entry of src/data/gabarits.json (only the fields used here). */
export interface GabaritTemplate {
  id: string;
  form: string;
  family: string;
  construction: string;
  size: string;
  finish: Record<string, string | boolean>;
  mood: string[];
  descriptor: { ratio: number; roundness: number; presence: number; top: number; lift: number };
}

export const FRAME_DESCRIPTORS = ['ratio', 'roundness', 'presence', 'top', 'lift'] as const;

/**
 * Categorical values seen in the catalogue, sorted. Built from the templates (the catalogue
 * may be regenerated) and saved with the model so that a vector always means the same thing.
 */
export interface FrameVocab {
  construction: string[];
  family: string[];
  size: string[];
  form: string[];
  /** "acetate:ecaille", "metal:or", "rivets"… */
  finish: string[];
  mood: string[];
}

const finishTokens = (finish: GabaritTemplate['finish']) =>
  Object.entries(finish).flatMap(([k, v]) => (v === true ? [k] : typeof v === 'string' ? [`${k}:${v}`] : []));

export function buildFrameVocab(templates: readonly GabaritTemplate[]): FrameVocab {
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return {
    construction: uniq(templates.map((t) => t.construction)),
    family: uniq(templates.map((t) => t.family)),
    size: uniq(templates.map((t) => t.size)),
    form: uniq(templates.map((t) => t.form)),
    finish: uniq(templates.flatMap((t) => finishTokens(t.finish))),
    mood: uniq(templates.flatMap((t) => t.mood)),
  };
}

/** Names of the frame vector entries, in order. */
export function frameFeatureNames(vocab: FrameVocab): string[] {
  return [
    ...FRAME_DESCRIPTORS,
    ...vocab.construction.map((x) => `construction=${x}`),
    ...vocab.family.map((x) => `family=${x}`),
    ...vocab.size.map((x) => `size=${x}`),
    ...vocab.form.map((x) => `form=${x}`),
    ...vocab.finish.map((x) => `finish=${x}`),
    ...vocab.mood.map((x) => `mood=${x}`),
  ];
}

/**
 * Frame vector: the 5 raw descriptors, then one-hot facets (multi-hot for finish and mood).
 * A value missing from the vocabulary (new template) simply gets no one-hot.
 */
export function frameVector(t: GabaritTemplate, vocab: FrameVocab): number[] {
  const oneHot = (values: string[], v: string | string[]) => {
    const set = new Set(Array.isArray(v) ? v : [v]);
    return values.map((x) => (set.has(x) ? 1 : 0));
  };
  return [
    ...FRAME_DESCRIPTORS.map((k) => t.descriptor[k]),
    ...oneHot(vocab.construction, t.construction),
    ...oneHot(vocab.family, t.family),
    ...oneHot(vocab.size, t.size),
    ...oneHot(vocab.form, t.form),
    ...oneHot(vocab.finish, finishTokens(t.finish)),
    ...oneHot(vocab.mood, t.mood ?? []),
  ];
}
