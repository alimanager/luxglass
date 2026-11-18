import type { Point } from './faceModel';

/**
 * Face metrics computed from MediaPipe FaceMesh landmarks (478 points with iris refinement).
 * Everything is a ratio of landmark distances, so results do not depend on camera distance.
 * Millimetre values use the human iris (~11.7 mm, very stable across adults) as a ruler.
 */

export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'oblong';

export interface FaceMetrics {
  shape: FaceShape;
  /** 0–100 */
  symmetryScore: number;
  /** 0–100, facial thirds + lower-face split + eye spacing */
  harmonyScore: number;
  /** length / cheek width */
  lengthRatio: number;
  /** jaw width / cheek width */
  jawRatio: number;
  /** forehead width / cheek width */
  foreheadRatio: number;
  /** middle third / lower third (ideal ≈ 1) */
  thirdsRatio: number;
  /** intercanthal distance / eye width (ideal ≈ 1) */
  eyeSpacingRatio: number;
  chin: 'pointed' | 'rounded' | 'square';
  pupillaryDistanceMm: number;
  faceWidthMm: number;
  frameSize: 'S' | 'M' | 'L';
  skin: SkinTone;
}

export interface SkinTone {
  /** Individual Typology Angle (ITA°) */
  ita: number;
  depth: 'très clair' | 'clair' | 'intermédiaire' | 'mat' | 'brun' | 'foncé';
  undertone: 'chaud' | 'neutre' | 'froid';
  hex: string;
}

// ---- landmark indices (MediaPipe canonical mesh) ----
const L = {
  top: 10,
  chin: 152,
  glabella: 9,
  subnasale: 2,
  stomion: 13,
  cheekR: 234,
  cheekL: 454,
  jawR: 172,
  jawL: 397,
  foreheadR: 103,
  foreheadL: 332,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeInnerL: 362,
  eyeOuterL: 263,
  irisR: [469, 470, 471, 472],
  irisL: [474, 475, 476, 477],
  irisCenterR: 468,
  irisCenterL: 473,
};

/** Mirrored left/right pairs used for symmetry. */
const SYMMETRY_PAIRS: [number, number][] = [
  [33, 263], // eye outer corners
  [133, 362], // eye inner corners
  [70, 300], // brow tails
  [107, 336], // brow heads
  [61, 291], // mouth corners
  [129, 358], // nose wings
  [234, 454], // cheeks
  [172, 397], // jaw
  [50, 280], // cheekbones
  [148, 377], // chin sides
];

const IRIS_DIAMETER_MM = 11.7;

const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function irisMmPerPx(p: Point[]): number {
  const diam = (ring: number[]) => (d(p[ring[0]], p[ring[2]]) + d(p[ring[1]], p[ring[3]])) / 2;
  const px = (diam(L.irisR) + diam(L.irisL)) / 2;
  return IRIS_DIAMETER_MM / px;
}

export function symmetryScore(p: Point[]): number {
  // Midline through forehead (10) and chin (152).
  const a = p[L.top];
  const b = p[L.chin];
  const len = d(a, b);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const width = d(p[L.cheekR], p[L.cheekL]);

  const asym = SYMMETRY_PAIRS.map(([r, l]) => {
    const proj = (q: Point) => {
      const vx = q.x - a.x;
      const vy = q.y - a.y;
      return { along: vx * ux + vy * uy, across: vx * uy - vy * ux };
    };
    const pr = proj(p[r]);
    const pl = proj(p[l]);
    const h = Math.abs(Math.abs(pr.across) - Math.abs(pl.across));
    const v = Math.abs(pr.along - pl.along);
    return Math.hypot(h, v) / width;
  });
  // Natural faces sit around 2–4 % average asymmetry → ~85–92.
  return Math.round(clamp(100 - mean(asym) * 100 * 4, 40, 99));
}

/** Score in 0–100 for how close a ratio is to its ideal, on a log scale. */
const ratioScore = (ratio: number, ideal: number, tolerance: number) =>
  clamp(100 - (Math.abs(Math.log(ratio / ideal)) / tolerance) * 100, 30, 100);

export function computeMetrics(p: Point[], skin: SkinTone): FaceMetrics {
  const width = d(p[L.cheekR], p[L.cheekL]);
  const length = d(p[L.top], p[L.chin]);
  const jaw = d(p[L.jawR], p[L.jawL]);
  const forehead = d(p[L.foreheadR], p[L.foreheadL]);

  const lengthRatio = length / width;
  const jawRatio = jaw / width;
  const foreheadRatio = forehead / width;

  const thirdsRatio = d(p[L.glabella], p[L.subnasale]) / d(p[L.subnasale], p[L.chin]);
  const lowerSplit = d(p[L.subnasale], p[L.stomion]) / d(p[L.stomion], p[L.chin]); // ideal ≈ 0.5
  const eyeWidth = (d(p[L.eyeOuterR], p[L.eyeInnerR]) + d(p[L.eyeInnerL], p[L.eyeOuterL])) / 2;
  const eyeSpacingRatio = d(p[L.eyeInnerR], p[L.eyeInnerL]) / eyeWidth;

  const harmonyScore = Math.round(
    mean([
      ratioScore(thirdsRatio, 1, 0.5),
      ratioScore(lowerSplit, 0.5, 0.6),
      ratioScore(eyeSpacingRatio, 1, 0.55),
    ])
  );

  // Chin: angle at the chin point between the two lower-jaw landmarks.
  const c = p[L.chin];
  const v1 = { x: p[L.jawR].x - c.x, y: p[L.jawR].y - c.y };
  const v2 = { x: p[L.jawL].x - c.x, y: p[L.jawL].y - c.y };
  const chinAngle =
    (Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y))) * 180) /
    Math.PI;
  const chin: FaceMetrics['chin'] = chinAngle < 95 ? 'pointed' : chinAngle > 115 ? 'square' : 'rounded';

  const shape = classifyShape({ lengthRatio, jawRatio, foreheadRatio, chin });

  const mmPerPx = irisMmPerPx(p);
  const pupillaryDistanceMm = d(p[L.irisCenterR], p[L.irisCenterL]) * mmPerPx;
  const faceWidthMm = width * mmPerPx;
  const frameSize = faceWidthMm < 128 ? 'S' : faceWidthMm > 140 ? 'L' : 'M';

  return {
    shape,
    symmetryScore: symmetryScore(p),
    harmonyScore,
    lengthRatio,
    jawRatio,
    foreheadRatio,
    thirdsRatio,
    eyeSpacingRatio,
    chin,
    pupillaryDistanceMm,
    faceWidthMm,
    frameSize,
    skin,
  };
}

export function classifyShape(m: {
  lengthRatio: number;
  jawRatio: number;
  foreheadRatio: number;
  chin: FaceMetrics['chin'];
}): FaceShape {
  // Landmark 10 sits below the hairline, so length ratios are lower than tape-measure ones.
  if (m.lengthRatio >= 1.3) return 'oblong';
  if (m.jawRatio >= 0.86 && m.lengthRatio < 1.22 && m.chin !== 'pointed') return 'square';
  if (m.foreheadRatio - m.jawRatio >= 0.1 && m.chin === 'pointed') return 'heart';
  if (m.lengthRatio <= 1.12) return 'round';
  return 'oval';
}

/** Average several captures (median per field) to remove frame-to-frame jitter. */
export function averageLandmarks(sets: Point[][]): Point[] {
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  return sets[0].map((_, i) => ({
    x: median(sets.map((s) => s[i].x)),
    y: median(sets.map((s) => s[i].y)),
    z: median(sets.map((s) => s[i].z ?? 0)),
  }));
}

// ---- skin tone ----

const SKIN_SAMPLES = [50, 280, 151, 101, 330];

export function analyzeSkin(ctx: CanvasRenderingContext2D, p: Point[]): SkinTone {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const size = Math.max(3, Math.round(d(p[L.cheekR], p[L.cheekL]) / 40));
  for (const i of SKIN_SAMPLES) {
    const x = Math.round(p[i].x - size / 2);
    const y = Math.round(p[i].y - size / 2);
    const data = ctx.getImageData(x, y, size, size).data;
    for (let k = 0; k < data.length; k += 4) {
      r += data[k];
      g += data[k + 1];
      b += data[k + 2];
      n++;
    }
  }
  return skinFromRgb(r / n, g / n, b / n);
}

export function skinFromRgb(r: number, g: number, b: number): SkinTone {
  const [L_, a, bb] = rgbToLab(r, g, b);
  const ita = (Math.atan((L_ - 50) / bb) * 180) / Math.PI;
  const depth: SkinTone['depth'] =
    ita > 55 ? 'très clair' : ita > 41 ? 'clair' : ita > 28 ? 'intermédiaire' : ita > 10 ? 'mat' : ita > -30 ? 'brun' : 'foncé';
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  const undertone: SkinTone['undertone'] = hue >= 58 ? 'chaud' : hue <= 48 ? 'froid' : 'neutre';
  const hex = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { ita: Math.round(ita), depth, undertone, hex };
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
