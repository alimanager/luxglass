import { beforeEach, describe, expect, it } from 'vitest';
import { computeMetrics, skinFromRgb } from '../lib/faceMetrics';
import { GABARITS, filterGabarits, matchFace } from '../lib/gabarits';
import { answer, answers } from '../lib/feedbackStore';
import { syntheticFace } from './syntheticFace';

const skin = skinFromRgb(205, 160, 135);
const face = (o: Parameters<typeof syntheticFace>[0] = {}, shape?: 'round' | 'square') => {
  const m = computeMetrics(syntheticFace(o), skin);
  return shape ? { ...m, shape } : m;
};

describe('gabarits', () => {
  it('contient les icônes du kit et l’atlas, avec des mesures', () => {
    expect(GABARITS.filter((g) => g.kit).length).toBeGreaterThanOrEqual(21);
    expect(GABARITS.length).toBeGreaterThan(100);
    for (const g of GABARITS) expect(Number.isFinite(g.descriptor.roundness)).toBe(true);
  });

  it('filtre par facette', () => {
    const metal = filterGabarits(GABARITS, { construction: 'metal' });
    expect(metal.length).toBeGreaterThan(0);
    expect(metal.every((g) => g.construction === 'metal')).toBe(true);
    expect(filterGabarits(GABARITS, { kitOnly: true, mood: 'glamour' }).every((g) => g.kit && g.mood.includes('glamour'))).toBe(true);
  });

  it('propose des formes anguleuses à un visage rond et rondes à un visage carré', () => {
    const mean = (l: ReturnType<typeof matchFace>) => l.slice(0, 8).reduce((s, x) => s + x.gabarit.descriptor.roundness, 0) / 8;
    expect(mean(matchFace(face({}, 'square')))).toBeGreaterThan(mean(matchFace(face({}, 'round'))));
  });

  it('donne de la présence à des sourcils épais', () => {
    const top = (o: Parameters<typeof syntheticFace>[0]) =>
      matchFace(face(o)).slice(0, 8).reduce((s, x) => s + x.gabarit.descriptor.presence, 0) / 8;
    expect(top({ browThick: 8 })).toBeGreaterThan(top({ browThick: 3 }));
  });
});

describe('avis', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      clear: () => store.clear(),
    };
  });
  it('enregistre, remplace et annule un avis', () => {
    expect(answer('g:aviateur', 'like', 'formes')).toBe('like');
    expect(answers().get('g:aviateur')).toBe('like');
    expect(answer('g:aviateur', 'dislike', 'formes')).toBe('dislike');
    expect(answer('g:aviateur', 'dislike', 'formes')).toBeNull();
    expect(answers().has('g:aviateur')).toBe(false);
  });
});
