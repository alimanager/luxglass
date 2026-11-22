import type { Point } from './faceModel';

/**
 * Fine facial traits (eyebrows, eyes) read from the same 478 landmarks.
 * They feed the expert rules in fit.ts. All thresholds are provisional: they are
 * set from anatomy tables and must be calibrated on real faces with /labo (CSV export).
 */

export interface FaceFeatures {
  /** brow band height / eye width */
  browThicknessRatio: number;
  browThickness: 'fine' | 'medium' | 'thick';
  /** how far the brow peaks above the straight line head → tail, / brow length */
  browArchRatio: number;
  browArch: 'straight' | 'soft' | 'high';
  /** lower brow edge to upper eyelid, / eye width */
  browGapRatio: number;
  browGap: 'low' | 'average' | 'high';
  /** inner/outer corner tilt, degrees, >0 = outer corner higher */
  eyeTiltDeg: number;
  eyeSlant: 'down' | 'neutral' | 'up';
  eyeSet: 'close' | 'average' | 'wide';
  /** 0–1, how much darker the brows are than the skin (needs the image) */
  browContrast?: number;
  /** 0–1 overall strength of the features: heavy brows, strong jaw, contrast */
  intensity: number;
}

// brow landmarks, tail (outer) → head (inner)
const BROW = {
  R: { upper: [70, 63, 105, 66, 107], lower: [46, 53, 52, 65, 55], lid: 159, outer: 33, inner: 133 },
  L: { upper: [300, 293, 334, 296, 336], lower: [276, 283, 282, 295, 285], lid: 386, outer: 263, inner: 362 },
};

const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function browThickness(p: Point[], side: 'R' | 'L') {
  const b = BROW[side];
  return mean(b.upper.map((u, i) => d(p[u], p[b.lower[i]])));
}

function browArch(p: Point[], side: 'R' | 'L') {
  const b = BROW[side];
  const tail = p[b.upper[0]];
  const head = p[b.upper[4]];
  const len = d(tail, head);
  if (len < 1e-6) return 0;
  // distance of the three inner points from the tail → head chord, peak side only (above = smaller y)
  const dist = [1, 2, 3].map((i) => {
    const q = p[b.upper[i]];
    const t = ((q.x - tail.x) * (head.x - tail.x) + (q.y - tail.y) * (head.y - tail.y)) / (len * len);
    const fy = tail.y + t * (head.y - tail.y);
    return fy - q.y; // positive when the point is above the chord
  });
  return Math.max(0, Math.max(...dist)) / len;
}

function eyeTilt(p: Point[], side: 'R' | 'L') {
  const b = BROW[side];
  const o = p[b.outer];
  const i = p[b.inner];
  return (Math.atan2(i.y - o.y, Math.abs(i.x - o.x)) * 180) / Math.PI;
}

export function computeFeatures(p: Point[], extra: { eyeSpacingRatio: number; jawRatio: number }): FaceFeatures {
  const eyeWidth = (d(p[33], p[133]) + d(p[362], p[263])) / 2;
  const safe = eyeWidth > 1e-6 ? eyeWidth : 1;

  const browThicknessRatio = mean([browThickness(p, 'R'), browThickness(p, 'L')]) / safe;
  const browArchRatio = mean([browArch(p, 'R'), browArch(p, 'L')]);
  const gap = (side: 'R' | 'L') => {
    const b = BROW[side];
    const browBottom = mean(b.lower.slice(1, 4).map((i) => p[i].y));
    return Math.max(0, p[b.lid].y - browBottom);
  };
  const browGapRatio = mean([gap('R'), gap('L')]) / safe;
  const eyeTiltDeg = mean([eyeTilt(p, 'R'), eyeTilt(p, 'L')]);

  const f: FaceFeatures = {
    browThicknessRatio,
    browThickness: browThicknessRatio < 0.13 ? 'fine' : browThicknessRatio > 0.22 ? 'thick' : 'medium',
    browArchRatio,
    browArch: browArchRatio < 0.07 ? 'straight' : browArchRatio > 0.14 ? 'high' : 'soft',
    browGapRatio,
    browGap: browGapRatio < 0.3 ? 'low' : browGapRatio > 0.5 ? 'high' : 'average',
    eyeTiltDeg,
    eyeSlant: eyeTiltDeg < 2 ? 'down' : eyeTiltDeg > 7 ? 'up' : 'neutral',
    eyeSet: extra.eyeSpacingRatio < 0.92 ? 'close' : extra.eyeSpacingRatio > 1.1 ? 'wide' : 'average',
    intensity: 0,
  };
  f.intensity = featureIntensity(f, extra.jawRatio);
  return f;
}

/** 0 = delicate features, 1 = strong features. Decides how much presence a frame should have. */
export function featureIntensity(f: Pick<FaceFeatures, 'browThicknessRatio' | 'browContrast'>, jawRatio: number): number {
  const brows = clamp((f.browThicknessRatio - 0.1) / 0.16, 0, 1);
  const jaw = clamp((jawRatio - 0.74) / 0.16, 0, 1);
  const parts = [brows, jaw];
  if (f.browContrast !== undefined) parts.push(f.browContrast);
  return Math.round(mean(parts) * 100) / 100;
}

/**
 * How much darker the brows are than the cheeks, 0–1. Sampled on the brow body
 * (between the upper and lower landmarks) against the skin below the eyes.
 */
export function browContrast(ctx: CanvasRenderingContext2D, p: Point[]): number {
  const luma = (x: number, y: number, size: number) => {
    const data = ctx.getImageData(Math.round(x - size / 2), Math.round(y - size / 2), size, size).data;
    let s = 0;
    for (let k = 0; k < data.length; k += 4) s += 0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2];
    return s / (data.length / 4) / 255;
  };
  const size = Math.max(3, Math.round(d(p[234], p[454]) / 50));
  const brow = mean(
    (['R', 'L'] as const).flatMap((side) => {
      const b = BROW[side];
      return [1, 2, 3].map((i) => luma((p[b.upper[i]].x + p[b.lower[i]].x) / 2, (p[b.upper[i]].y + p[b.lower[i]].y) / 2, size));
    })
  );
  const skin = mean([50, 280].map((i) => luma(p[i].x, p[i].y, size)));
  return Math.round(clamp((skin - brow) / Math.max(skin, 0.05) / 0.6, 0, 1) * 100) / 100;
}

export const FEATURE_LABELS = {
  browThickness: { fine: 'fins', medium: 'moyens', thick: 'épais' },
  browArch: { straight: 'droits', soft: 'légèrement arqués', high: 'très arqués' },
  browGap: { low: 'bas sur les yeux', average: 'à bonne hauteur', high: 'haut perchés' },
  eyeSlant: { down: 'tombants', neutral: 'droits', up: 'relevés vers les tempes' },
  eyeSet: { close: 'rapprochés', average: 'écartés normalement', wide: 'écartés' },
} as const;
