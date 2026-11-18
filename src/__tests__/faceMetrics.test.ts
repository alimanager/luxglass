import { describe, expect, it } from 'vitest';
import { averageLandmarks, classifyShape, computeMetrics, irisMmPerPx, skinFromRgb, symmetryScore } from '../lib/faceMetrics';
import { checkQuality } from '../lib/captureQuality';
import { syntheticFace } from './syntheticFace';

const neutralSkin = skinFromRgb(200, 160, 140);

describe('mesures en millimètres', () => {
  it('retrouve l’écart pupillaire et la largeur grâce à l’iris, quelle que soit la distance', () => {
    for (const pxPerMm of [2, 4, 7]) {
      const m = computeMetrics(syntheticFace({ pxPerMm }), neutralSkin);
      expect(m.pupillaryDistanceMm).toBeCloseTo(63, 0);
      expect(m.faceWidthMm).toBeCloseTo(136, 0);
    }
  });

  it('convertit les pixels avec un iris de 11,7 mm', () => {
    expect(1 / irisMmPerPx(syntheticFace({ pxPerMm: 5 }))).toBeCloseTo(5, 5);
  });

  it('choisit la taille de monture d’après la largeur du visage', () => {
    expect(computeMetrics(syntheticFace({ faceWidth: 124 }), neutralSkin).frameSize).toBe('S');
    expect(computeMetrics(syntheticFace({ faceWidth: 134 }), neutralSkin).frameSize).toBe('M');
    expect(computeMetrics(syntheticFace({ faceWidth: 146 }), neutralSkin).frameSize).toBe('L');
  });
});

describe('symétrie', () => {
  it('donne le score maximal à un visage parfaitement symétrique', () => {
    expect(symmetryScore(syntheticFace())).toBe(99);
  });

  it('baisse quand un côté est décalé', () => {
    const p = syntheticFace();
    // left eye, brow, mouth corner and cheekbone 6 mm higher
    for (const i of [263, 362, 300, 291, 280]) p[i] = { ...p[i], y: p[i].y - 24 };
    expect(symmetryScore(p)).toBeLessThan(93);
  });
});

describe('forme du visage', () => {
  it.each([
    [{ lengthRatio: 1.35, jawRatio: 0.75, foreheadRatio: 0.8, chin: 'rounded' as const }, 'oblong'],
    [{ lengthRatio: 1.15, jawRatio: 0.9, foreheadRatio: 0.85, chin: 'square' as const }, 'square'],
    [{ lengthRatio: 1.2, jawRatio: 0.7, foreheadRatio: 0.85, chin: 'pointed' as const }, 'heart'],
    [{ lengthRatio: 1.08, jawRatio: 0.78, foreheadRatio: 0.8, chin: 'rounded' as const }, 'round'],
    [{ lengthRatio: 1.2, jawRatio: 0.78, foreheadRatio: 0.82, chin: 'rounded' as const }, 'oval'],
  ])('%o → %s', (m, shape) => {
    expect(classifyShape(m)).toBe(shape);
  });

  it('classe un visage long et étroit comme allongé', () => {
    expect(computeMetrics(syntheticFace({ faceLength: 200, faceWidth: 130 }), neutralSkin).shape).toBe('oblong');
  });
});

describe('teint', () => {
  it('classe la profondeur avec l’angle ITA', () => {
    expect(skinFromRgb(245, 225, 210).depth).toMatch(/clair/);
    expect(skinFromRgb(60, 40, 32).depth).toBe('foncé');
    // darker skin, lower angle
    const itas = [[240, 215, 195], [205, 160, 130], [160, 110, 80], [100, 65, 45]].map(([r, g, b]) => skinFromRgb(r, g, b).ita);
    expect([...itas].sort((a, b) => b - a)).toEqual(itas);
  });
});

describe('outils', () => {
  it('prend la médiane de plusieurs captures (une image aberrante ne compte pas)', () => {
    const a = syntheticFace();
    const b = syntheticFace();
    const c = syntheticFace({ cx: 900 });
    expect(averageLandmarks([a, b, c])[1].x).toBe(a[1].x);
  });

  it('demande de se rapprocher quand le visage est trop petit', () => {
    const frame = { w: 1280, h: 960, visibleW: 720, visibleH: 960 };
    expect(checkQuality(syntheticFace({ pxPerMm: 1 }), frame, 140)).toContain('too-far');
    expect(checkQuality(syntheticFace({ pxPerMm: 3 }), frame, 140)).toEqual([]);
    expect(checkQuality(null, frame, null)).toEqual(['no-face']);
  });
});
