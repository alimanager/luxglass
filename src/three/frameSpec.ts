import type { Glasses } from '../types/glasses';

/**
 * Parametric description of a frame, in millimetres. One spec drives both the
 * catalogue renders and the try-on, so what you see in the shop is what you wear.
 */
export interface LensShape {
  /** lens width and height (the "52" in 52□18) */
  w: number;
  h: number;
  /** superellipse exponent: 2 = ellipse, higher = squarer */
  n: number;
  /** >0: top wider than bottom */
  taper: number;
  /** mm the outer-top corner is pulled up (cat-eye, butterfly) */
  lift: number;
  /** mm the nasal-bottom is pulled down (aviator teardrop) */
  drop: number;
  /** regular polygon instead of superellipse (geometric frames) */
  sides?: number;
}

export type FrameKind = 'acetate' | 'metal' | 'browline';
export type Finish = 'gloss' | 'matte' | 'tortoise';

export interface FrameSpec {
  kind: FrameKind;
  lens: LensShape;
  bridge: number;
  temple: number;
  /** acetate rim width, or wire radius for metal */
  rim: number;
  /** acetate thickness */
  depth: number;
  /** face-form angle in degrees */
  wrap: number;
  doubleBridge: boolean;
  frameColor: string;
  finish: Finish;
  metalColor: string;
  /** temples in metal even on an acetate front */
  metalTemples: boolean;
  lensTint: string;
  lensOpacity: number;
}

const BASE: Omit<FrameSpec, 'lens'> = {
  kind: 'acetate',
  bridge: 19,
  temple: 145,
  rim: 5,
  depth: 5,
  wrap: 5,
  doubleBridge: false,
  frameColor: '#151515',
  finish: 'gloss',
  metalColor: '#c9a24e',
  metalTemples: false,
  lensTint: '#1f2a22',
  lensOpacity: 0.88,
};

const STYLE: Record<string, Partial<FrameSpec> & { lens: LensShape }> = {
  Rectangulaire: { lens: { w: 50, h: 40, n: 3.4, taper: 0.14, lift: 2.5, drop: 0 }, bridge: 22, rim: 5.5, wrap: 7 },
  Aviateur: { kind: 'metal', lens: { w: 58, h: 50, n: 2.3, taper: 0.1, lift: 0, drop: 7 }, bridge: 14, rim: 0.75, doubleBridge: true, wrap: 3 },
  'Cat-eye': { lens: { w: 55, h: 42, n: 2.8, taper: 0.18, lift: 6, drop: 0 }, bridge: 18, rim: 5.5, metalTemples: true },
  Oversize: { lens: { w: 57, h: 50, n: 3.6, taper: 0.05, lift: 2, drop: 0 }, bridge: 18, rim: 6.5, depth: 5.5 },
  Browline: { kind: 'browline', lens: { w: 51, h: 42, n: 3, taper: 0.16, lift: 0, drop: 2 }, bridge: 21, rim: 0.7 },
  Rond: { kind: 'metal', lens: { w: 47, h: 47, n: 2, taper: 0, lift: 0, drop: 0 }, bridge: 21, rim: 0.8, wrap: 2 },
  Géométrique: { lens: { w: 52, h: 46, n: 2, taper: 0, lift: 0, drop: 0, sides: 6 }, bridge: 20, rim: 3.6, depth: 3.5, finish: 'matte' },
  Carré: { lens: { w: 54, h: 46, n: 4.6, taper: 0.04, lift: 0, drop: 0 }, bridge: 20, rim: 6.2, depth: 6.5 },
  Papillon: { lens: { w: 58, h: 51, n: 2.6, taper: 0.08, lift: 6, drop: 0 }, bridge: 17, rim: 5.5 },
  Pilot: { lens: { w: 55, h: 47, n: 2.6, taper: 0.1, lift: 0, drop: 5 }, bridge: 20, rim: 4.6 },
  'Aviateur Moderne': { kind: 'metal', lens: { w: 60, h: 50, n: 2.5, taper: 0.1, lift: 0, drop: 6 }, bridge: 15, rim: 0.85, doubleBridge: true, wrap: 4 },
};

const COLOR: Record<string, Partial<FrameSpec>> = {
  Noir: { frameColor: '#141414', metalColor: '#2a2a2a' },
  Or: { frameColor: '#c9a24e', metalColor: '#c9a24e', lensTint: '#2f3b2a' },
  Bordeaux: { frameColor: '#5a1622', lensTint: '#3a2320' },
  Écaille: { frameColor: '#3a2113', finish: 'tortoise', lensTint: '#3b2a1e' },
  Havane: { frameColor: '#4a2a14', finish: 'tortoise', lensTint: '#3b2a1e' },
  'Noir/Or': { frameColor: '#141414', metalColor: '#c9a24e' },
  'Noir Mat': { frameColor: '#202020', finish: 'matte', metalColor: '#202020', lensTint: '#222428' },
  Bleu: { frameColor: '#1d3658', lensTint: '#25303d' },
  Marron: { frameColor: '#4a2a1a', lensTint: '#3b2a1e' },
};

export function specForGlasses(g: Pick<Glasses, 'style' | 'color' | 'material'>): FrameSpec {
  const style = STYLE[g.style] ?? STYLE.Rectangulaire;
  const color = COLOR[g.color] ?? {};
  const spec: FrameSpec = { ...BASE, ...style, ...color, lens: { ...style.lens } };
  if (spec.kind === 'metal') {
    // a metal frame takes the colour as its metal
    spec.metalColor = color.metalColor ?? spec.metalColor;
    if (g.color === 'Noir') spec.metalColor = '#1c1c1c';
  }
  if (/m[ée]tal/i.test(g.material) && spec.kind === 'acetate') spec.metalTemples = true;
  return spec;
}

/** The size printed inside the temple by every manufacturer: lens □ bridge temple. */
export function sizeMarking(spec: FrameSpec): string {
  return `${spec.lens.w}□${spec.bridge} ${spec.temple}`;
}

/** Total frame width in mm (what has to match the face width). */
export function frameWidth(spec: FrameSpec): number {
  const rim = spec.kind === 'acetate' ? spec.rim : 2;
  return spec.lens.w * 2 + spec.bridge + rim * 2 + 4;
}
