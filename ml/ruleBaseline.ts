import type { FaceMetrics } from '../src/lib/faceMetrics';
import { scoreFit, type FitInput } from '../src/lib/fit';
import type { FrameSpec } from '../src/three/frameSpec';
import type { GabaritTemplate } from './feedback';

/**
 * Bridge from a gabarits.json template to the hand-written rules of src/lib/fit.ts.
 * Templates are drawings, not parametric specs, so the FrameSpec below is an approximation
 * built from the measured descriptors (documented per field). It is the "rule baseline"
 * the learned model is compared with, and the rule score used by blend().
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Colour names understood by fit.ts (WARM / COOL lists), from the template finish. */
function colorName(finish: GabaritTemplate['finish']): string {
  const acetate = typeof finish.acetate === 'string' ? finish.acetate : undefined;
  const metal = typeof finish.metal === 'string' ? finish.metal : undefined;
  if (acetate === 'noir' && metal === 'or') return 'Noir/Or';
  if (acetate) {
    if (acetate.startsWith('ecaille')) return 'Écaille';
    if (acetate === 'miel') return 'Havane';
    if (acetate === 'brun') return 'Marron';
    if (acetate === 'noir') return 'Noir';
    return 'Autre';
  }
  if (metal === 'or') return 'Or';
  if (metal === 'noir') return 'Noir';
  if (metal === 'canon') return 'Noir Mat'; // gunmetal reads as a cool dark grey
  return 'Argent'; // neutral: in neither list
}

export function templateToFitInput(t: GabaritTemplate): FitInput {
  const d = t.descriptor;
  const w = t.size === 'fine' ? 48 : t.size === 'oversize' ? 56 : 52;
  const h = Math.round(w * d.ratio);
  const kind: FrameSpec['kind'] =
    t.construction === 'acetate' ? 'acetate' : t.construction === 'browline' || t.construction === 'semi' ? 'browline' : 'metal';
  const spec: FrameSpec = {
    kind,
    lens: {
      w,
      h,
      // roundness 1 → ellipse (n = 2); the squarest drawings (≈ 0.76) → n ≈ 4.6
      n: Math.round(clamp(2 + ((1 - d.roundness) / 0.24) * 2.6, 2, 4.6) * 10) / 10,
      // a heavy top line counts as top-heavy in fit.ts
      taper: d.top >= 3 ? 0.16 : 0,
      // descriptor lift is normalised by the half lens height
      lift: Math.round(Math.max(0, d.lift) * (h / 2) * 10) / 10,
      drop: t.family === 'Aviateurs' ? 5 : 0,
    },
    bridge: 19,
    temple: 145,
    // presence ≈ rim width in mm for acetate drawings
    rim: kind === 'acetate' ? clamp(d.presence, 3, 7) : 0.8,
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
  return { spec, color: colorName(t.finish), price: 0 };
}

/** Score 0–100 of the hand-written rules for a face and a template. */
export function ruleScore(m: FaceMetrics, t: GabaritTemplate): number {
  return scoreFit(m, templateToFitInput(t)).score;
}
