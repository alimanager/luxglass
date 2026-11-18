import type { Point } from './faceModel';

export type QualityIssue = 'no-face' | 'too-far' | 'too-close' | 'off-center' | 'turned' | 'tilted' | 'dark' | 'bright';

export const ISSUE_HINT: Record<QualityIssue | 'ok', string> = {
  'no-face': 'Place ton visage dans l’ovale',
  'too-far': 'Rapproche-toi un peu',
  'too-close': 'Recule légèrement',
  'off-center': 'Centre ton visage dans l’ovale',
  turned: 'Regarde droit vers l’objectif',
  tilted: 'Garde la tête bien droite',
  dark: 'Trouve un endroit plus lumineux',
  bright: 'Évite la lumière directe dans le dos ou en face',
  ok: 'Parfait, ne bouge plus',
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Checks whether a frame is good enough for measurement. Returns the most important
 * issue first so the UI can show a single, actionable hint.
 */
export interface FrameBox {
  /** full frame size in pixels */
  w: number;
  h: number;
  /** size of the centred region actually visible to the user (object-cover crop) */
  visibleW: number;
  visibleH: number;
}

export function checkQuality(p: Point[] | null, frame: FrameBox, luma: number | null, strict = true): QualityIssue[] {
  if (!p) return ['no-face'];
  const issues: QualityIssue[] = [];

  const faceW = dist(p[234], p[454]);
  const widthShare = faceW / frame.visibleW;
  if (strict) {
    if (widthShare < 0.38) issues.push('too-far');
    if (widthShare > 0.72) issues.push('too-close');

    const cx = (p[234].x + p[454].x) / 2;
    const cy = (p[10].y + p[152].y) / 2;
    if (Math.abs(cx - frame.w / 2) > frame.visibleW * 0.1 || Math.abs(cy - frame.h / 2) > frame.visibleH * 0.1) {
      issues.push('off-center');
    }
  }

  // Yaw: nose tip offset from the cheek midpoint, relative to face width.
  const mid = (p[234].x + p[454].x) / 2;
  const yaw = Math.abs(p[1].x - mid) / faceW;
  if (yaw > (strict ? 0.05 : 0.09)) issues.push('turned');

  // Roll: angle of the line through the outer eye corners.
  const roll = Math.abs((Math.atan2(p[263].y - p[33].y, p[263].x - p[33].x) * 180) / Math.PI);
  if (roll > (strict ? 4 : 8)) issues.push('tilted');

  if (luma !== null) {
    if (luma < 70) issues.push('dark');
    if (luma > 215) issues.push('bright');
  }
  return issues;
}

/** Mean luma of the face bounding box, sampled on a small grid. */
export function faceLuma(ctx: CanvasRenderingContext2D, p: Point[]): number {
  const x0 = Math.max(0, Math.round(p[234].x));
  const x1 = Math.round(p[454].x);
  const y0 = Math.max(0, Math.round(p[10].y));
  const y1 = Math.round(p[152].y);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const data = ctx.getImageData(x0, y0, w, h).data;
  let sum = 0;
  let n = 0;
  const step = 4 * 7;
  for (let i = 0; i < data.length; i += step) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++;
  }
  return sum / n;
}
