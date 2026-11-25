import { describe, expect, it } from 'vitest';
import { computeMetrics, skinFromRgb } from '../../src/lib/faceMetrics';
import { syntheticFace } from '../../src/__tests__/syntheticFace';
import { loadTemplates } from '../data';
import {
  FACE_FEATURES,
  buildFrameVocab,
  createFeedbackEvent,
  faceGroupKey,
  faceVector,
  frameFeatureNames,
  frameVector,
  parseJsonl,
  toJsonl,
  validateFeedback,
} from '../feedback';

const metrics = computeMetrics(syntheticFace({ browThick: 8 }), skinFromRgb(225, 185, 150));
const now = new Date('2026-11-25T14:37:12Z');
const event = () => createFeedbackEvent({ templateId: 'panto-acetate', label: 'like', source: 'essai', metrics, consent: true, now })!;

describe('vecteur visage', () => {
  it('suit l’ordre documenté et arrondit', () => {
    const f = faceVector(metrics);
    expect(f.v).toHaveLength(FACE_FEATURES.length);
    expect(f.shape).toBe(metrics.shape);
    expect(f.v[FACE_FEATURES.findIndex((x) => x.key === 'faceWidthMm')]).toBe(136);
    expect(f.v[FACE_FEATURES.findIndex((x) => x.key === 'undertone')]).toBe(1);
    expect(f.v[FACE_FEATURES.findIndex((x) => x.key === 'browContrast')]).toBeNull();
  });
  it('tolère un rapport sans `features`', () => {
    const f = faceVector({ ...metrics, features: undefined });
    const firstFeature = FACE_FEATURES.findIndex((x) => x.key === 'browThicknessRatio');
    expect(f.v.slice(firstFeature).every((x) => x === null)).toBe(true);
    expect(f.v.slice(0, firstFeature).every((x) => typeof x === 'number')).toBe(true);
    expect(validateFeedback({ ...event(), face: f }).ok).toBe(true);
  });
});

describe('événement de feedback', () => {
  it('n’existe pas sans consentement', () => {
    expect(createFeedbackEvent({ templateId: 'x', label: 'like', source: 'kit', metrics, consent: false })).toBeNull();
  });
  it('arrondit la date à l’heure et se valide', () => {
    const e = event();
    expect(e.at).toBe('2026-11-25T14:00:00.000Z');
    expect(validateFeedback(e).ok).toBe(true);
    expect(validateFeedback(e, new Set(['autre'])).ok).toBe(false);
  });
  it('refuse les champs en trop et les valeurs aberrantes', () => {
    const bad = [
      { ...event(), email: 'a@b.c' },
      { ...event(), face: { ...event().face, landmarks: [] } },
      { ...event(), consent: false },
      { ...event(), version: 2 },
      { ...event(), label: 'bof' },
      { ...event(), source: 'web' },
      { ...event(), at: '2026-11-25T14:37:12Z' },
      { ...event(), templateId: '../etc' },
      { ...event(), face: { shape: 'oval', v: [1, 2] } },
      { ...event(), face: { ...event().face, v: event().face.v.map((x, i) => (i === 5 ? 900 : x)) } },
      null,
      'texte',
    ];
    for (const b of bad) expect(validateFeedback(b).ok).toBe(false);
  });
  it('fait l’aller-retour JSONL et signale les lignes invalides', () => {
    const text = toJsonl([event(), event()]) + '{oops\n' + JSON.stringify({ ...event(), image: 'data:' }) + '\n';
    const { events, errors } = parseJsonl(text);
    expect(events).toEqual([event(), event()]);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });
  it('groupe les avis d’une même analyse', () => {
    const a = createFeedbackEvent({ templateId: 'a', label: 'like', source: 'kit', metrics, consent: true })!;
    expect(faceGroupKey(a.face)).toBe(faceGroupKey(event().face));
  });
});

describe('vecteur monture', () => {
  const templates = loadTemplates();
  const vocab = buildFrameVocab(templates);
  it('a une taille fixe et un one-hot par facette', () => {
    const names = frameFeatureNames(vocab);
    for (const t of templates) {
      const v = frameVector(t, vocab);
      expect(v).toHaveLength(names.length);
      expect(v.slice(0, 5)).toEqual([t.descriptor.ratio, t.descriptor.roundness, t.descriptor.presence, t.descriptor.top, t.descriptor.lift]);
      expect(v[names.indexOf(`construction=${t.construction}`)]).toBe(1);
      expect(v[names.indexOf(`form=${t.form}`)]).toBe(1);
    }
  });
  it('ignore une valeur inconnue du vocabulaire', () => {
    const t = { ...templates[0], construction: 'titane', mood: ['inédit'] };
    const v = frameVector(t, vocab);
    expect(vocab.construction.every((_, i) => v[5 + i] === 0)).toBe(true);
  });
});
