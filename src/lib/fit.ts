import type { FaceMetrics, FaceShape } from './faceMetrics';
import { frameWidth, type FrameSpec } from '../three/frameSpec';

/**
 * Expert rules of eyewear styling, turned into a score per frame.
 * Each rule looks at one trait of the face and one trait of the frame, and explains itself:
 * the reasons are shown to the person ("pourquoi cette monture").
 */

export interface Reason {
  /** points added to (or removed from) the base score */
  delta: number;
  text: string;
}

export interface Fit {
  /** 0–100 */
  score: number;
  reasons: Reason[];
}

export interface FrameTraits {
  /** 0 = wire, 1 = massive acetate */
  boldness: number;
  /** 0 = round, 1 = angular */
  angularity: number;
  /** top rim heavier than the bottom (browline, cat-eye, butterfly) */
  topHeavy: boolean;
  /** extra weight under the eye (aviator drop) */
  bottomHeavy: boolean;
  width: number;
  lensHeight: number;
  lift: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function frameTraits(spec: FrameSpec): FrameTraits {
  const { lens } = spec;
  const boldness =
    spec.kind === 'metal' ? 0.12 : spec.kind === 'browline' ? 0.55 : clamp((spec.rim - 3) / 4 + (spec.depth - 4) / 8, 0.2, 1);
  const angularity = lens.sides ? 0.5 : clamp((lens.n - 2) / 2.6, 0, 1);
  return {
    boldness: Math.round(boldness * 100) / 100,
    angularity: Math.round(angularity * 100) / 100,
    topHeavy: spec.kind === 'browline' || lens.lift >= 5 || lens.taper >= 0.16,
    bottomHeavy: lens.drop >= 5,
    width: frameWidth(spec),
    lensHeight: lens.h,
    lift: lens.lift,
  };
}

const WARM = ['Or', 'Écaille', 'Havane', 'Marron', 'Noir/Or'];
const COOL = ['Noir', 'Noir Mat', 'Bleu', 'Bordeaux'];

export interface FitInput {
  spec: FrameSpec;
  color: string;
  price: number;
}

export function scoreFit(m: FaceMetrics, frame: FitInput): Fit {
  const t = frameTraits(frame.spec);
  const f = m.features;
  const reasons: Reason[] = [];
  const add = (delta: number, text: string) => reasons.push({ delta, text });

  shapeRules(m.shape, t, add);

  // width: a frame about as wide as the face reads as balanced
  const diff = t.width - m.faceWidthMm;
  if (Math.abs(diff) <= 5) add(6, 'Sa largeur suit celle de ton visage.');
  else if (diff > 9) add(-clamp((diff - 9) * 0.8, 0, 14), 'Elle déborde de ton visage : l’équilibre se perd.');
  else if (diff < -9) add(-clamp((-diff - 9) * 0.8, 0, 14), 'Elle est étroite pour ton visage et l’élargit.');

  if (f) {
    // eyebrows: the top line of the frame frames them, or fights them
    if (f.browThickness === 'thick') {
      if (t.boldness >= 0.5 || t.topHeavy) add(6, 'Tes sourcils épais ont besoin d’une barre supérieure marquée pour s’équilibrer.');
      else if (t.boldness < 0.2) add(-5, 'Une monture aussi fine disparaît sous des sourcils épais.');
    } else if (f.browThickness === 'fine') {
      if (t.boldness >= 0.85) add(-5, 'Cette monture massive écrase des sourcils fins.');
      else if (t.boldness <= 0.45) add(3, 'Sa finesse respecte tes sourcils fins.');
    }
    if (f.browGap === 'low' && (t.lensHeight > 47 || t.topHeavy)) {
      add(-5, 'Tes sourcils sont bas : une monture haute ou chargée en haut les touche.');
    }
    if (f.browArch === 'high' && frame.spec.lens.n <= 2.6) add(3, 'Le haut arrondi suit l’arc de tes sourcils.');
    if (f.browArch === 'straight' && frame.spec.lens.n >= 3) add(3, 'Sa ligne droite répond à tes sourcils droits.');

    // eyes
    if (f.eyeSlant === 'down' && t.lift >= 4) add(5, 'Les coins relevés de la monture remontent ton regard.');
    if (f.eyeSlant === 'up' && t.lift >= 5) add(2, 'Elle prolonge le relevé naturel de tes yeux.');
    if (f.eyeSet === 'close') {
      if (frame.spec.bridge >= 20) add(4, 'Un pont large écarte visuellement tes yeux rapprochés.');
      else if (frame.spec.bridge <= 15) add(-4, 'Un pont fin rapproche encore tes yeux.');
    }
    if (f.eyeSet === 'wide') {
      if (frame.spec.bridge <= 17) add(4, 'Un pont fin rapproche visuellement tes yeux écartés.');
      else if (frame.spec.bridge >= 22) add(-3, 'Un pont large accentue l’écart de tes yeux.');
    }

    // presence: delicate features want light frames, strong features want presence
    const gap = Math.abs(f.intensity - t.boldness);
    if (gap <= 0.2) add(6, 'Elle a autant de présence que tes traits.');
    else if (f.intensity - t.boldness > 0.4) add(-6, 'Elle est trop discrète pour des traits marqués.');
    else if (t.boldness - f.intensity > 0.4) add(-6, 'Elle est trop imposante pour des traits délicats.');
  }

  // colour against the undertone
  if (m.skin.undertone === 'chaud') {
    if (WARM.includes(frame.color)) add(4, 'Sa teinte chaude va avec ton sous-ton.');
    else if (COOL.includes(frame.color)) add(-2, 'Sa teinte froide contraste avec ton sous-ton chaud.');
  } else if (m.skin.undertone === 'froid') {
    if (COOL.includes(frame.color)) add(4, 'Sa teinte froide va avec ton sous-ton.');
    else if (WARM.includes(frame.color)) add(-2, 'Sa teinte chaude contraste avec ton sous-ton froid.');
  }

  const score = clamp(Math.round(50 + reasons.reduce((s, r) => s + r.delta, 0)), 0, 100);
  return { score, reasons: reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) };
}

function shapeRules(shape: FaceShape, t: FrameTraits, add: (delta: number, text: string) => void) {
  switch (shape) {
    case 'round':
      if (t.angularity >= 0.5) add(12, 'Ses angles structurent ton visage rond.');
      else if (t.angularity <= 0.15) add(-8, 'Des verres trop ronds accentuent la rondeur.');
      break;
    case 'square':
      if (t.angularity <= 0.3) add(12, 'Ses courbes adoucissent ta mâchoire marquée.');
      else if (t.angularity >= 0.8) add(-8, 'Des angles sur une mâchoire carrée durcissent les traits.');
      break;
    case 'heart':
      if (t.bottomHeavy || (!t.topHeavy && t.angularity <= 0.5)) add(10, 'Elle donne du poids au bas de ton visage, plus étroit.');
      if (t.topHeavy) add(-8, 'Un haut chargé alourdit ton front déjà large.');
      break;
    case 'oblong':
      if (t.lensHeight >= 46) add(10, 'Ses verres hauts raccourcissent visuellement ton visage.');
      else if (t.lensHeight <= 40) add(-8, 'Des verres bas allongent encore ton visage.');
      break;
    case 'oval':
      // accepts nearly every shape: no rule, the other traits decide
      break;
  }
}
