/**
 * Frame catalogue as facets: a frame is a FORM (the lens outline) built with a CONSTRUCTION
 * (how the lens is held), at a SIZE, with details (bridge, rivets) and a finish (colour, metal).
 * Any combination can be drawn, so named silhouettes ("Windsor", "Nylor", "oversize square")
 * are combinations, not separate drawings, and each facet is a clean feature for learning.
 *
 * Millimetres, size M, right lens centred on (0,0): +x towards the temple, +y up.
 * Only generic shapes, no brand names. No temples: a front view is what you judge on a face.
 */
export type V2 = [number, number];

/** polygon with rounded corners, each corner [x, y, radius]; counter-clockwise from the nose-side top */
export function roundedPoly(corners: [number, number, number][], steps = 9): V2[] {
  const n = corners.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y, r] = corners[i];
    const [px, py] = corners[(i - 1 + n) % n];
    const [nx, ny] = corners[(i + 1) % n];
    const d1 = Math.hypot(px - x, py - y);
    const d2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, d1 / 2, d2 / 2);
    const a: V2 = [x + ((px - x) / d1) * k, y + ((py - y) / d1) * k];
    const b: V2 = [x + ((nx - x) / d2) * k, y + ((ny - y) / d2) * k];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * x + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * y + t * t * b[1]]);
    }
  }
  return out;
}

export const ellipse = (a: number, b: number, n = 24): V2[] =>
  Array.from({ length: n }, (_, i) => {
    const t = Math.PI + (i / n) * Math.PI * 2;
    return [a * Math.cos(t), b * Math.sin(t)] as V2;
  });

const smooth = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

// ---------------------------------------------------------------- facets

export type FormId =
  | 'rond' | 'panto' | 'boston' | 'ovale'
  | 'carre' | 'carre-doux' | 'rectangle' | 'd-frame' | 'trapeze'
  | 'oeil-de-chat' | 'papillon'
  | 'aviateur' | 'pilote-carre'
  | 'hexagone' | 'octogone' | 'flat-top'
  | 'pentagone' | 'arlequin' | 'angulaire' | 'irreguliere' | 'upswept' | 'goutte' | 'rectangle-fin' | 'rond-ovale';

export interface Form {
  id: FormId;
  name: string;
  family: 'Rondes' | 'Carrées et rectangulaires' | 'Relevées' | 'Aviateurs' | 'Géométriques' | 'Créatives';
  lens?: V2[];
  poly?: V2[];
  /** rim profile when built in acetate, mm */
  rim: (x: number, y: number) => number;
  /** bridge when built in acetate */
  bridge: 'keyhole' | 'saddle' | 'arch';
}

const even = (w: number) => () => w;
const heavyTop = (lo: number, hi: number) => (_x: number, y: number) => lo + (hi - lo) * smooth((y + 8) / 24);

export const FORMS: Record<FormId, Form> = {
  rond: { id: 'rond', name: 'Rond', family: 'Rondes', poly: ellipse(23.5, 23, 96), rim: even(5), bridge: 'saddle' },
  panto: {
    id: 'panto', name: 'Panto', family: 'Rondes',
    lens: [[-21, 13], [-22, 0], [-18, -14], [-6, -21], [8, -21], [19, -14], [23, 0], [22, 13], [12, 18], [-5, 18]],
    rim: heavyTop(3.8, 4.6), bridge: 'keyhole',
  },
  boston: {
    id: 'boston', name: 'Boston', family: 'Rondes',
    lens: [[-22, 14], [-22, 0], [-17, -14], [-6, -21], [8, -20], [19, -12], [24, 2], [23, 14], [12, 19], [-6, 18]],
    rim: heavyTop(3.6, 5), bridge: 'keyhole',
  },
  ovale: { id: 'ovale', name: 'Ovale', family: 'Rondes', poly: ellipse(26, 19.5, 96), rim: even(4.4), bridge: 'keyhole' },
  carre: {
    id: 'carre', name: 'Carré', family: 'Carrées et rectangulaires',
    poly: roundedPoly([[-24, 19, 4], [-23, -19, 5], [25, -19, 5], [25, 19, 4]]), rim: heavyTop(6, 7), bridge: 'saddle',
  },
  'carre-doux': {
    id: 'carre-doux', name: 'Carré doux', family: 'Carrées et rectangulaires',
    poly: roundedPoly([[-24, 20, 11], [-23, -20, 12], [25, -20, 12], [25, 20, 11]]), rim: even(4.6), bridge: 'saddle',
  },
  rectangle: {
    id: 'rectangle', name: 'Rectangle', family: 'Carrées et rectangulaires',
    poly: roundedPoly([[-25, 15, 4], [-22, -16, 9], [26, -16, 9], [27, 16, 4]]), rim: heavyTop(3.4, 5.2), bridge: 'saddle',
  },
  'd-frame': {
    id: 'd-frame', name: 'D-frame', family: 'Carrées et rectangulaires',
    poly: roundedPoly([[-24, 18, 3], [-23, -14, 9], [-6, -21, 12], [25, -16, 16], [26, 18, 4]]), rim: heavyTop(4, 5.6), bridge: 'saddle',
  },
  trapeze: {
    id: 'trapeze', name: 'Trapèze', family: 'Carrées et rectangulaires',
    poly: roundedPoly([[-24, 15, 5], [-20, -20, 14], [26, -16, 14], [27, 20, 5]]), rim: (_x, y) => 3.2 + 3.8 * smooth((y + 12) / 26), bridge: 'keyhole',
  },
  'oeil-de-chat': {
    id: 'oeil-de-chat', name: 'Œil de chat', family: 'Relevées',
    lens: [[-23, 6], [-21, -5], [-13, -13], [2, -15], [17, -11], [27, -1], [31, 11], [31, 19], [22, 20], [8, 18], [-8, 15]],
    rim: (x, y) => 3.4 + 3.4 * smooth((x + 4) / 30) * smooth((y + 2) / 14), bridge: 'saddle',
  },
  papillon: {
    id: 'papillon', name: 'Papillon', family: 'Relevées',
    lens: ([[-21, 14], [-24, 2], [-19, -14], [-6, -24], [10, -25], [24, -18], [29, -4], [30, 12], [26, 24], [12, 26], [-6, 22]] as V2[]).map(
      ([x, y]) => [x * 0.94, y * 0.88] as V2
    ),
    rim: (x, y) => 3.2 + 3.4 * smooth((x + 6) / 34) * smooth((y + 6) / 18), bridge: 'arch',
  },
  aviateur: {
    id: 'aviateur', name: 'Aviateur', family: 'Aviateurs',
    lens: [[-27, 8], [-25, -6], [-17, -19], [-4, -26], [8, -25], [19, -17], [27, -4], [29, 9], [24, 19], [10, 24], [-10, 23], [-22, 18]],
    rim: even(4), bridge: 'keyhole',
  },
  'pilote-carre': {
    id: 'pilote-carre', name: 'Pilote carré', family: 'Aviateurs',
    poly: roundedPoly([[-23, 20, 9], [-18, -20, 16], [25, -18, 16], [27, 20, 9]]), rim: heavyTop(3.4, 5.6), bridge: 'keyhole',
  },
  hexagone: {
    id: 'hexagone', name: 'Hexagone', family: 'Géométriques',
    poly: roundedPoly([[-14, 22, 3], [-26, 0, 3], [-14, -22, 3], [14, -22, 3], [26, 0, 3], [14, 22, 3]]), rim: even(4), bridge: 'saddle',
  },
  octogone: {
    id: 'octogone', name: 'Octogone', family: 'Géométriques',
    poly: roundedPoly(
      Array.from({ length: 8 }, (_, i) => {
        const t = Math.PI - Math.PI / 8 - (i * Math.PI) / 4;
        return [25 * Math.cos(t), 22.5 * Math.sin(t), 2.5] as [number, number, number];
      }).reverse()
    ),
    rim: even(4), bridge: 'saddle',
  },
  'flat-top': {
    id: 'flat-top', name: 'Flat top', family: 'Géométriques',
    poly: roundedPoly([[-25, 17, 2], [-21, -14, 12], [24, -16, 15], [28, 17, 2]]), rim: heavyTop(3.4, 7.5), bridge: 'saddle',
  },
  pentagone: {
    id: 'pentagone', name: 'Pentagone', family: 'Géométriques',
    poly: roundedPoly([[-21, 19, 2.5], [-25, -3, 2.5], [0, -22, 3], [25, -3, 2.5], [21, 19, 2.5]]), rim: even(4), bridge: 'saddle',
  },
  arlequin: {
    id: 'arlequin', name: 'Arlequin', family: 'Relevées',
    lens: [[-22, 4], [-20, -6], [-11, -13], [4, -14], [18, -9], [28, 2], [35, 15], [33, 20], [22, 18], [8, 15], [-8, 12]],
    rim: (x, y) => 3 + 3.2 * smooth((x + 2) / 32) * smooth((y + 2) / 16), bridge: 'saddle',
  },
  angulaire: {
    id: 'angulaire', name: 'Angulaire', family: 'Géométriques',
    poly: roundedPoly([[-24, 16, 1.5], [-22, -14, 2], [-12, -20, 2], [22, -18, 2], [28, -6, 2], [29, 19, 1.5]]), rim: heavyTop(4, 6), bridge: 'saddle',
  },
  irreguliere: {
    id: 'irreguliere', name: 'Irrégulière', family: 'Créatives',
    lens: [[-22, 15], [-24, -3], [-15, -18], [2, -20], [18, -17], [27, -5], [25, 9], [29, 19], [14, 21], [-4, 18]],
    rim: (x, y) => 3.4 + 2.4 * smooth((x + 10) / 40) * smooth((y + 20) / 40), bridge: 'saddle',
  },
  upswept: {
    id: 'upswept', name: 'Upswept', family: 'Relevées',
    lens: [[-24, 12], [-24, -4], [-18, -15], [4, -17], [20, -13], [27, -2], [30, 14], [27, 20], [12, 17], [-6, 14]],
    rim: heavyTop(3.4, 5.4), bridge: 'saddle',
  },
  goutte: {
    id: 'goutte', name: 'Goutte', family: 'Aviateurs',
    lens: [[-25, 9], [-24, -6], [-17, -21], [-5, -29], [8, -28], [18, -19], [25, -5], [27, 9], [22, 18], [9, 21], [-9, 21], [-20, 17]],
    rim: even(3.6), bridge: 'keyhole',
  },
  'rectangle-fin': {
    id: 'rectangle-fin', name: 'Rectangle fin', family: 'Carrées et rectangulaires',
    poly: roundedPoly([[-25, 13, 4], [-24, -13, 5], [26, -13, 5], [27, 13, 4]]), rim: even(3.4), bridge: 'saddle',
  },
  'rond-ovale': { id: 'rond-ovale', name: 'Rond ovale', family: 'Rondes', poly: ellipse(24, 21, 96), rim: even(4.4), bridge: 'keyhole' },
};

export type Construction = 'acetate' | 'metal' | 'browline' | 'semi' | 'rimless';
export const CONSTRUCTIONS: { id: Construction; name: string; note: string }[] = [
  { id: 'acetate', name: 'Acétate cerclé', note: 'cerclage plein en acétate' },
  { id: 'metal', name: 'Métal cerclé', note: 'fil de métal autour du verre' },
  { id: 'browline', name: 'Mixte (browline, Windsor)', note: 'sourcil d’acétate sur cerclage métal' },
  { id: 'semi', name: 'Semi-cerclé (Nylor)', note: 'barre en haut, fil de nylon en bas' },
  { id: 'rimless', name: 'Sans cercle', note: 'verres percés, rien autour' },
];

export type SizeFacet = 'fine' | 'standard' | 'oversize';
/** lens scale of each size facet (on top of the S, M, L face widths of the kit) */
export const SIZE_FACTOR: Record<SizeFacet, number> = { fine: 0.9, standard: 1, oversize: 1.13 };

/** surface of the frame: acetate colour, metal tone, rivets on the front */
export interface Finish {
  acetate?: 'noir' | 'brun' | 'ecaille' | 'miel' | 'ecaille-degrade';
  metal?: 'or' | 'argent' | 'noir' | 'canon';
  rivets?: boolean;
}

export type Mood = 'confiant' | 'créatif' | 'intellectuel' | 'professionnel' | 'glamour' | 'décontracté';

/** a frame ready to draw: its facets plus the geometry they resolve to */
export interface Shape {
  id: string;
  name: string;
  form: FormId;
  construction: Construction;
  size: SizeFacet;
  kind: Construction;
  lens?: V2[];
  poly?: V2[];
  rim?: (x: number, y: number) => number;
  wire?: number;
  gap: number;
  bridge: 'arch' | 'keyhole' | 'saddle' | 'double' | 'wire-arch' | 'browline';
  bridgeTop?: number;
  pads?: boolean;
  /** mixed construction with a thin acetate ring all around the lens (Windsor) instead of a brow */
  ring?: boolean;
  extras?: Extra[];
  finish: Finish;
  era?: string;
  icon?: string;
  mood: Mood[];
  reference?: boolean;
}

export interface Spec {
  id?: string;
  name?: string;
  form: FormId;
  construction: Construction;
  size?: SizeFacet;
  finish?: Finish;
  /** overrides */
  rim?: (x: number, y: number) => number;
  wire?: number;
  gap?: number;
  bridge?: Shape['bridge'];
  bridgeTop?: number;
  ring?: boolean;
  /** lens scale, replaces the size facet's */
  scale?: number;
  extras?: Extra[];
  era?: string;
  icon?: string;
  mood?: Mood[];
  reference?: boolean;
}

/** details drawn on top: hinge in the middle of the bridge (folding), camera and light (smart glasses) */
export type Extra = 'charniere' | 'capteurs';

const DEFAULT_FINISH: Record<Construction, Finish> = {
  acetate: { acetate: 'noir' },
  metal: { metal: 'canon' },
  browline: { acetate: 'noir', metal: 'or', rivets: true },
  semi: { metal: 'argent' },
  rimless: { metal: 'argent' },
};

/** resolve facets into a drawable frame */
export function make(spec: Spec): Shape {
  const f = FORMS[spec.form];
  const c = spec.construction;
  const size = spec.size ?? 'standard';
  const k = spec.scale ?? SIZE_FACTOR[size];
  const scale = (pts?: V2[]) => pts?.map(([x, y]) => [x * k, y * k] as V2);
  const metalLike = c !== 'acetate';
  const doubleBridge = spec.form === 'aviateur' || spec.form === 'pilote-carre';
  const bridge: Shape['bridge'] =
    spec.bridge ?? (c === 'acetate' ? f.bridge : c === 'browline' ? 'browline' : doubleBridge && c === 'metal' ? 'double' : 'wire-arch');
  const ys = (f.poly ?? f.lens!).map((p) => p[1]);
  const top = Math.max(...ys) * k;
  const name = spec.name ?? [f.name, c === 'acetate' ? '' : CONSTRUCTIONS.find((x) => x.id === c)!.name.toLowerCase(), size === 'standard' ? '' : size].filter(Boolean).join(' ');
  return {
    id: spec.id ?? `${spec.form}-${c}-${size}`,
    name,
    form: spec.form,
    construction: c,
    size,
    kind: c,
    lens: scale(f.lens),
    poly: scale(f.poly),
    rim: spec.rim ?? (c === 'acetate' ? (x, y) => f.rim(x / k, y / k) * (size === 'oversize' ? 1.1 : size === 'fine' ? 0.85 : 1) : undefined),
    wire: spec.wire ?? (c === 'rimless' ? 0.9 : 1.05),
    gap: spec.gap ?? (doubleBridge ? 15 : c === 'acetate' ? 18 : 20),
    bridge,
    bridgeTop: spec.bridgeTop ?? (bridge === 'double' ? top - 2 : bridge === 'browline' ? top - 1 : Math.min(12, top - 8)),
    pads: metalLike,
    ring: spec.ring,
    extras: spec.extras,
    finish: spec.finish ?? DEFAULT_FINISH[c],
    era: spec.era,
    icon: spec.icon,
    mood: spec.mood ?? [],
    reference: spec.reference,
  };
}

// ---------------------------------------------------------------- the kit: 21 timeless frames

export const SHAPES: Shape[] = [
  make({
    id: 'panto-acetate', name: 'Panto à pont trou de serrure', form: 'panto', construction: 'acetate', gap: 22,
    finish: { acetate: 'ecaille', rivets: true }, era: 'années 1910',
    icon: 'La monture des intellectuels new-yorkais, revenue dans les années 2000 sur les acteurs et les créatifs.',
    mood: ['intellectuel', 'créatif'],
  }),
  make({
    id: 'rond-epais', name: 'Rond épais', form: 'rond', construction: 'acetate', rim: () => 6.2,
    finish: { acetate: 'noir' }, era: 'années 1930',
    icon: 'Les grands cercles noirs des architectes modernistes : une signature plus qu’un accessoire.',
    mood: ['créatif', 'confiant'],
  }),
  make({
    id: 'rond-metal', name: 'Rond métal', form: 'rond', construction: 'metal', wire: 1.25, bridgeTop: 10,
    finish: { metal: 'noir' }, era: 'années 1930',
    icon: 'Le rond fin des étudiants d’avant-guerre, devenu celui des musiciens et des poètes dans les années 1960.',
    mood: ['créatif', 'intellectuel'], reference: true,
  }),
  make({
    id: 'windsor', name: 'Windsor', form: 'rond', construction: 'browline', size: 'fine', gap: 21, ring: true, bridge: 'wire-arch', bridgeTop: 9,
    finish: { acetate: 'ecaille', metal: 'or' }, era: 'années 1920',
    icon: 'Un petit rond métal cerclé d’un fin bourrelet d’acétate : l’élégance des années folles.',
    mood: ['intellectuel', 'glamour'],
  }),
  make({
    id: 'boston', name: 'Boston', form: 'boston', construction: 'acetate', gap: 21,
    finish: { acetate: 'miel' }, era: 'années 1930',
    icon: 'Entre rond et carré, le haut plus large que le bas : la forme douce préférée des créatifs japonais et européens.',
    mood: ['créatif', 'décontracté'],
  }),
  make({
    id: 'aviateur', name: 'Aviateur', form: 'aviateur', construction: 'metal', wire: 0.95,
    finish: { metal: 'canon' }, era: '1937',
    icon: 'Dessinée pour les pilotes, adoptée par le cinéma : la goutte protège tout le champ de vision.',
    mood: ['confiant', 'décontracté'], reference: true,
  }),
  make({
    id: 'browline', name: 'Browline bicolore', form: 'rectangle', construction: 'browline',
    finish: { acetate: 'noir', metal: 'or', rivets: true }, era: '1947',
    icon: 'Un sourcil d’acétate sur un cerclage métal : la monture des leaders et des hommes d’affaires des années 1950.',
    mood: ['professionnel', 'confiant'], reference: true,
  }),
  make({
    id: 'trapeze', name: 'Trapèze acétate', form: 'trapeze', construction: 'acetate',
    finish: { acetate: 'noir', rivets: true }, era: '1952',
    icon: 'Le premier grand succès du plastique moulé : la forme du rock, des années 1950 aux musiciens d’aujourd’hui.',
    mood: ['confiant', 'décontracté'],
  }),
  make({
    id: 'carre-rivets', name: 'Carré épais à rivets', form: 'carre', construction: 'acetate',
    finish: { acetate: 'brun', rivets: true }, era: 'années 1950',
    icon: 'L’acétate épais des ingénieurs et des écrivains, remis à la mode par les créateurs indépendants.',
    mood: ['confiant', 'créatif'], reference: true,
  }),
  make({
    id: 'oeil-de-chat', name: 'Œil de chat', form: 'oeil-de-chat', construction: 'acetate',
    finish: { acetate: 'ecaille' }, era: 'années 1950',
    icon: 'Les coins relevés des stars d’Hollywood : un regard qui remonte vers les tempes.',
    mood: ['glamour', 'créatif'],
  }),
  make({
    id: 'd-frame', name: 'D-frame', form: 'd-frame', construction: 'acetate',
    finish: { acetate: 'ecaille-degrade' }, era: 'années 1950',
    icon: 'Le haut droit et le bas arrondi des montures de cinéma d’après-guerre, très prisé des stylistes aujourd’hui.',
    mood: ['confiant', 'créatif'],
  }),
  make({
    id: 'pilote-acetate', name: 'Pilote acétate', form: 'pilote-carre', construction: 'acetate',
    finish: { acetate: 'miel' }, era: '1957',
    icon: 'La forme des pilotes en acétate, portée par les acteurs italiens et les dandys de la Riviera.',
    mood: ['décontracté', 'glamour'],
  }),
  make({
    id: 'pilote-metal', name: 'Aviateur carré', form: 'pilote-carre', construction: 'metal', wire: 1.1,
    finish: { metal: 'or' }, era: '1957',
    icon: 'L’aviateur aux verres carrés, plus graphique, des photographes et des voyageurs.',
    mood: ['confiant', 'décontracté'],
  }),
  make({
    id: 'nylor', name: 'Rectangle semi-cerclé', form: 'rectangle', construction: 'semi',
    finish: { metal: 'argent' }, era: 'années 1960',
    icon: 'Le fil de nylon invisible sous le verre : une monture légère qui laisse le regard dégagé.',
    mood: ['professionnel', 'intellectuel'],
  }),
  make({
    id: 'papillon', name: 'Papillon', form: 'papillon', construction: 'acetate',
    finish: { acetate: 'noir' }, era: 'années 1960',
    icon: 'Les grands verres des premières dames et des icônes de mode : élégance et mystère.',
    mood: ['glamour', 'confiant'],
  }),
  make({
    id: 'hexagone', name: 'Hexagone fin', form: 'hexagone', construction: 'metal', wire: 1.2, bridgeTop: 14,
    finish: { metal: 'or' }, era: 'années 1970',
    icon: 'Une géométrie inattendue née avec la contre-culture, reprise par les créateurs des années 2010.',
    mood: ['créatif', 'glamour'],
  }),
  make({
    id: 'carre-oversize', name: 'Carré oversize', form: 'carre-doux', construction: 'acetate', size: 'oversize',
    finish: { acetate: 'ecaille' }, era: 'années 1970',
    icon: 'Les grands carrés adoucis des années disco, qui reviennent à chaque génération.',
    mood: ['glamour', 'confiant'],
  }),
  make({
    id: 'octogone', name: 'Octogone', form: 'octogone', construction: 'metal', wire: 1.15, bridgeTop: 13,
    finish: { metal: 'argent' }, era: 'années 1980',
    icon: 'Huit pans nets : une forme d’architecte, entre le rond et le carré.',
    mood: ['créatif', 'intellectuel'],
  }),
  make({
    id: 'sans-cercle', name: 'Rond sans cercle', form: 'ovale', construction: 'rimless', size: 'fine', bridgeTop: 9,
    finish: { metal: 'argent' }, era: 'années 1990',
    icon: 'Des verres percés sans monture autour : la discrétion absolue des inventeurs et des minimalistes.',
    mood: ['intellectuel', 'professionnel'],
  }),
  make({
    id: 'rectangle-ecaille', name: 'Rectangle écaille', form: 'rectangle', construction: 'acetate',
    finish: { acetate: 'ecaille-degrade' }, era: 'années 1990',
    icon: 'Le rectangle de la mode et des affaires : foncé en haut pour l’autorité, écaille en bas pour la chaleur.',
    mood: ['professionnel', 'confiant'], reference: true,
  }),
  make({
    id: 'flat-top', name: 'Flat top', form: 'flat-top', construction: 'acetate',
    finish: { acetate: 'noir' }, era: 'années 2010',
    icon: 'Une barre supérieure parfaitement droite : la monture la plus graphique, née sur les podiums.',
    mood: ['confiant', 'créatif'],
  }),
];

/** every form in every construction, for the atlas and for the app catalogue */
export function atlas(): Shape[] {
  const out: Shape[] = [];
  for (const form of Object.keys(FORMS) as FormId[]) for (const c of CONSTRUCTIONS) out.push(make({ form, construction: c.id }));
  return out;
}

// ---------------------------------------------------------------- one-piece lenses

/** a single lens across both eyes (shield, wraparound, mask, visor), drawn as its right half */
export interface Mono {
  id: string;
  name: string;
  /** right half of the outline, from the top centre round to the bottom centre (nose notch included), x >= 0 */
  half: V2[];
  bar: 'metal' | 'acetate' | 'none';
  finish: Finish;
  /** lens tint, 0 to 1 */
  tint: number;
}
