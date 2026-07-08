import { FaceProfile, FrameShape, Glasses, SkinTone } from '../types/glasses';

export interface ScoredGlasses {
  glasses: Glasses;
  score: number;        // 0..100
  fitScore: number;     // 0..100 — ajustement physique (largeur, pont)
  styleScore: number;   // 0..100 — harmonie forme du visage / forme de monture
  colorScore: number;   // 0..100 — harmonie couleur / teint de peau
  reasons: string[];
}

// Affinité forme de visage → forme de monture (règles d'opticien classiques :
// on recherche le contraste — visage rond → monture angulaire, visage
// anguleux → monture douce — et l'équilibre des proportions).
const SHAPE_AFFINITY: Record<string, Partial<Record<FrameShape, number>>> = {
  oval: {
    rectangular: 0.9, square: 0.85, round: 0.85, oval: 0.8, aviator: 0.95,
    'cat-eye': 0.85, browline: 0.9, butterfly: 0.8, geometric: 0.85, oversize: 0.75
  },
  round: {
    rectangular: 1.0, square: 0.95, browline: 0.9, geometric: 0.9, 'cat-eye': 0.85,
    aviator: 0.7, butterfly: 0.65, oversize: 0.6, oval: 0.45, round: 0.25
  },
  square: {
    round: 1.0, oval: 0.95, aviator: 0.9, butterfly: 0.85, 'cat-eye': 0.8,
    oversize: 0.7, browline: 0.6, geometric: 0.5, rectangular: 0.35, square: 0.25
  },
  oblong: {
    oversize: 1.0, square: 0.9, butterfly: 0.85, round: 0.85, geometric: 0.8,
    aviator: 0.8, browline: 0.7, 'cat-eye': 0.65, oval: 0.6, rectangular: 0.4
  },
  heart: {
    aviator: 0.95, oval: 0.9, round: 0.85, browline: 0.5, rectangular: 0.75,
    'cat-eye': 0.6, butterfly: 0.55, geometric: 0.7, square: 0.6, oversize: 0.5
  },
  diamond: {
    'cat-eye': 0.95, oval: 0.95, browline: 0.85, round: 0.8, rectangular: 0.75,
    aviator: 0.7, butterfly: 0.7, geometric: 0.6, square: 0.5, oversize: 0.5
  }
};

const FRAME_SHAPE_LABELS: Record<FrameShape, string> = {
  rectangular: 'rectangulaire',
  square: 'carrée',
  round: 'ronde',
  oval: 'ovale',
  aviator: 'aviateur',
  'cat-eye': 'œil-de-chat',
  browline: 'browline',
  butterfly: 'papillon',
  geometric: 'géométrique',
  oversize: 'oversize'
};

const FACE_SHAPE_LABELS: Record<string, string> = {
  oval: 'ovale',
  round: 'rond',
  square: 'carré',
  oblong: 'allongé',
  heart: 'en cœur',
  diamond: 'diamant'
};

// Sous-tons recommandés par teint : chaque teint est associé à des familles
// de couleurs de monture qui le mettent en valeur.
const COLOR_HARMONY: Record<SkinTone, string[]> = {
  'Fair': ['écaille', 'havane', 'bordeaux', 'bleu', 'marron', 'rose'],
  'Light': ['écaille', 'havane', 'bordeaux', 'bleu', 'vert', 'marron'],
  'Medium Light': ['havane', 'écaille', 'vert', 'or', 'marron', 'bordeaux'],
  'Medium': ['or', 'havane', 'écaille', 'vert', 'ambre', 'marron'],
  'Medium Dark': ['or', 'ambre', 'écaille', 'ivoire', 'bleu', 'transparent'],
  'Dark': ['or', 'ivoire', 'transparent', 'ambre', 'bleu', 'blanc'],
  'Deep': ['or', 'ivoire', 'transparent', 'blanc', 'ambre', 'rouge']
};

// Le noir et l'argenté vont à tous les teints.
const UNIVERSAL_COLORS = ['noir', 'argent', 'gris', 'gunmetal'];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Score gaussien : 1 quand value === ideal, décroît avec l'écart (tolerance = écart-type).
const gaussian = (value: number, ideal: number, tolerance: number) =>
  Math.exp(-0.5 * Math.pow((value - ideal) / tolerance, 2));

function styleAffinity(faceShape: string, frameShape: FrameShape): number {
  const row = SHAPE_AFFINITY[faceShape] ?? SHAPE_AFFINITY.oval;
  return row[frameShape] ?? 0.6;
}

function fitAffinity(profile: FaceProfile, glasses: Glasses): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const { dimensions } = glasses;

  // La face de la monture doit approcher la largeur du visage aux tempes.
  const widthScore = gaussian(dimensions.totalWidth, profile.faceWidth, 8);
  if (widthScore > 0.75) {
    reasons.push(`Largeur de face (${dimensions.totalWidth} mm) parfaitement proportionnée à votre visage (${Math.round(profile.faceWidth)} mm)`);
  }

  // Le pont doit correspondre à la largeur du pont nasal.
  const bridgeScore = gaussian(dimensions.bridgeWidth, clamp(profile.noseBridgeWidth, 14, 24), 3);
  if (bridgeScore > 0.75) {
    reasons.push(`Pont de ${dimensions.bridgeWidth} mm adapté à votre nez`);
  }

  // Les centres optiques doivent être proches des pupilles :
  // distance entre centres des verres = calibre + pont.
  const opticalCenters = dimensions.lensWidth + dimensions.bridgeWidth;
  const ipdScore = gaussian(opticalCenters, profile.interpupillaryDistance, 6);

  const score = 100 * (0.5 * widthScore + 0.25 * bridgeScore + 0.25 * ipdScore);
  return { score, reasons };
}

function colorAffinity(profile: FaceProfile, glasses: Glasses): { score: number; reasons: string[] } {
  const color = glasses.color.toLowerCase();
  const harmonious = COLOR_HARMONY[profile.skinTone] ?? [];

  if (UNIVERSAL_COLORS.some(c => color.includes(c))) {
    return { score: 80, reasons: [] };
  }
  if (harmonious.some(c => color.includes(c))) {
    return {
      score: 100,
      reasons: [`La teinte ${glasses.color.toLowerCase()} met en valeur votre carnation`]
    };
  }
  return { score: 55, reasons: [] };
}

export function scoreGlasses(profile: FaceProfile, glasses: Glasses): ScoredGlasses {
  const style = styleAffinity(profile.faceShape, glasses.frameShape) * 100;
  const fit = fitAffinity(profile, glasses);
  const color = colorAffinity(profile, glasses);

  const reasons: string[] = [];
  if (style >= 85) {
    reasons.push(
      `La forme ${FRAME_SHAPE_LABELS[glasses.frameShape]} est idéale pour un visage ${FACE_SHAPE_LABELS[profile.faceShape] ?? profile.faceShape}`
    );
  } else if (style >= 70) {
    reasons.push(
      `La forme ${FRAME_SHAPE_LABELS[glasses.frameShape]} s'accorde bien avec un visage ${FACE_SHAPE_LABELS[profile.faceShape] ?? profile.faceShape}`
    );
  }
  reasons.push(...fit.reasons, ...color.reasons);

  const score = Math.round(0.5 * style + 0.3 * fit.score + 0.2 * color.score);

  return {
    glasses,
    score,
    styleScore: Math.round(style),
    fitScore: Math.round(fit.score),
    colorScore: Math.round(color.score),
    reasons
  };
}

export function recommendGlasses(profile: FaceProfile, catalog: Glasses[]): ScoredGlasses[] {
  return catalog
    .map(g => scoreGlasses(profile, g))
    .sort((a, b) => b.score - a.score);
}

export { FRAME_SHAPE_LABELS, FACE_SHAPE_LABELS };
