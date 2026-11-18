import type { LM } from '../three/faceAnchor';

/** Lighting of the scene, measured on the skin. */
export interface SceneLight {
  /** mean luma of the skin, 0–255 */
  luma: number;
  /** light colour as RGB multipliers around 1 (skin colour removed) */
  tint: [number, number, number];
  /** −1 = light from image-left, +1 = from image-right */
  side: number;
}

const xy = (p: LM): [number, number] =>
  'x' in (p as object) ? [(p as { x: number }).x, (p as { y: number }).y] : [(p as ArrayLike<number>)[0], (p as ArrayLike<number>)[1]];

// Average skin under neutral light: we divide by it to keep only the light's colour.
const SKIN_REF: [number, number, number] = [1, 0.78, 0.66];

function patch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): [number, number, number] {
  const size = Math.max(2, Math.round(r * 2));
  const d = ctx.getImageData(Math.round(x - r), Math.round(y - r), size, size).data;
  let R = 0;
  let G = 0;
  let B = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    R += d[i];
    G += d[i + 1];
    B += d[i + 2];
  }
  return [R / n, G / n, B / n];
}

const luma = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Reads brightness, colour and left/right balance on forehead and cheeks.
 * Cheap: five small patches per call.
 */
export function probeLight(ctx: CanvasRenderingContext2D, lm: LM[]): SceneLight {
  const [lx] = xy(lm[234]);
  const [rx] = xy(lm[454]);
  const r = Math.max(2, Math.abs(rx - lx) / 30);
  const at = (i: number) => {
    const [x, y] = xy(lm[i]);
    return patch(ctx, x, y, r);
  };
  const forehead = at(151);
  const left = at(50); // subject's right cheek, on the image's left
  const right = at(280);
  const nose = at(4);
  const all = [forehead, left, right, nose];
  const mean: [number, number, number] = [0, 1, 2].map((k) => all.reduce((s, c) => s + c[k], 0) / all.length) as [
    number,
    number,
    number,
  ];
  const Y = luma(mean);
  const lL = luma(left);
  const lR = luma(right);
  const side = Math.max(-1, Math.min(1, ((lR - lL) / Math.max(1, lR + lL)) * 4));

  // light colour = observed skin / reference skin, normalised to green
  const raw = mean.map((c, k) => c / SKIN_REF[k]) as [number, number, number];
  const g = raw[1] || 1;
  const tint = raw.map((c) => Math.max(0.75, Math.min(1.25, c / g))) as [number, number, number];
  return { luma: Y, tint, side };
}
