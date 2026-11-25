/**
 * Hand-drawn silhouettes of the classic frame families, for the printable kit.
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

/** surface of the frame: acetate colour, metal tone, rivets on the front */
export interface Finish {
  acetate?: 'noir' | 'brun' | 'ecaille' | 'miel' | 'ecaille-degrade';
  metal?: 'or' | 'argent' | 'noir' | 'canon';
  rivets?: boolean;
}

export type Mood = 'confiant' | 'créatif' | 'intellectuel' | 'professionnel' | 'glamour' | 'décontracté';

export interface Shape {
  id: string;
  name: string;
  kind: 'acetate' | 'metal' | 'browline' | 'rimless';
  /** lens aperture, counter-clockwise from the top of the nose side; closed spline through these points */
  lens?: V2[];
  /** or a polygon with rounded corners, sampled as is */
  poly?: V2[];
  /** rim width (acetate) at a point of the aperture, mm */
  rim?: (x: number, y: number) => number;
  /** wire diameter (metal), mm */
  wire?: number;
  /** distance between the two nose-side edges, mm */
  gap: number;
  bridge: 'arch' | 'keyhole' | 'saddle' | 'double' | 'wire-arch' | 'browline';
  /** y of the bridge top above lens centre, mm */
  bridgeTop?: number;
  pads?: boolean;
  finish: Finish;
  /** when the style was born or became an icon */
  era: string;
  /** the story behind the style, in a sentence (no brand names on the strips) */
  icon: string;
  /** the impression it gives, strongest first (stylist's judgement) */
  mood: Mood[];
  /** seen in the reference video */
  reference?: boolean;
}

const smooth = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

/** 14 timeless frames, in the order they entered the history of eyewear */
export const SHAPES: Shape[] = [
  {
    id: 'panto-acetate',
    name: 'Panto à pont trou de serrure',
    kind: 'acetate',
    lens: [[-21, 13], [-22, 0], [-18, -14], [-6, -21], [8, -21], [19, -14], [23, 0], [22, 13], [12, 18], [-5, 18]],
    rim: (_x, y) => 3.8 + 0.8 * smooth((y + 4) / 20),
    gap: 22,
    bridge: 'keyhole',
    finish: { acetate: 'ecaille', rivets: true },
    era: 'années 1910',
    icon: 'La monture des intellectuels new-yorkais, revenue dans les années 2000 sur les acteurs et les créatifs.',
    mood: ['intellectuel', 'créatif'],
  },
  {
    id: 'rond-epais',
    name: 'Rond épais',
    kind: 'acetate',
    poly: ellipse(22, 22.5, 96),
    rim: () => 6.2,
    gap: 18,
    bridge: 'saddle',
    finish: { acetate: 'noir' },
    era: 'années 1930',
    icon: 'Les grands cercles noirs des architectes modernistes : une signature plus qu’un accessoire.',
    mood: ['créatif', 'confiant'],
  },
  {
    id: 'panto',
    name: 'Rond métal',
    kind: 'metal',
    poly: ellipse(23.5, 23, 96),
    wire: 1.25,
    gap: 20,
    bridge: 'wire-arch',
    bridgeTop: 10,
    pads: true,
    finish: { metal: 'noir' },
    era: 'années 1930',
    icon: 'Le rond fin des étudiants d’avant-guerre, devenu celui des musiciens et des poètes dans les années 1960.',
    mood: ['créatif', 'intellectuel'],
    reference: true,
  },
  {
    id: 'aviateur',
    name: 'Aviateur',
    kind: 'metal',
    lens: [[-27, 8], [-25, -6], [-17, -19], [-4, -26], [8, -25], [19, -17], [27, -4], [29, 9], [24, 19], [10, 24], [-10, 23], [-22, 18]],
    wire: 0.95,
    gap: 15,
    bridge: 'double',
    bridgeTop: 21,
    pads: true,
    finish: { metal: 'canon' },
    era: '1937',
    icon: 'Dessinée pour les pilotes, adoptée par le cinéma : la goutte protège tout le champ de vision.',
    mood: ['confiant', 'décontracté'],
    reference: true,
  },
  {
    id: 'browline',
    name: 'Browline bicolore',
    kind: 'browline',
    poly: roundedPoly([[-24, 17, 5], [-22, -15, 13], [25, -15, 13], [25, 17, 5]]),
    wire: 0.9,
    gap: 20,
    bridge: 'browline',
    bridgeTop: 16,
    pads: true,
    finish: { acetate: 'noir', metal: 'or', rivets: true },
    era: '1947',
    icon: 'Un sourcil d’acétate sur un cerclage métal : la monture des leaders et des hommes d’affaires des années 1950.',
    mood: ['professionnel', 'confiant'],
    reference: true,
  },
  {
    id: 'trapeze',
    name: 'Trapèze acétate',
    kind: 'acetate',
    poly: roundedPoly([[-24, 15, 5], [-20, -20, 14], [26, -16, 14], [27, 20, 5]]),
    rim: (_x, y) => 3.2 + 3.8 * smooth((y + 12) / 26),
    gap: 18,
    bridge: 'keyhole',
    finish: { acetate: 'noir', rivets: true },
    era: '1952',
    icon: 'Le premier grand succès du plastique moulé : la forme du rock, des Blues Brothers aux musiciens d’aujourd’hui.',
    mood: ['confiant', 'décontracté'],
  },
  {
    id: 'carre-rivets',
    name: 'Carré épais à rivets',
    kind: 'acetate',
    poly: roundedPoly([[-24, 18, 4], [-23, -18, 5], [26, -18, 5], [26, 18, 4]]),
    rim: (_x, y) => 6.4 + 1.2 * smooth((y + 4) / 20),
    gap: 17,
    bridge: 'saddle',
    finish: { acetate: 'brun', rivets: true },
    era: 'années 1950',
    icon: 'L’acétate épais des ingénieurs et des écrivains, remis à la mode par les créateurs indépendants.',
    mood: ['confiant', 'créatif'],
    reference: true,
  },
  {
    id: 'oeil-de-chat',
    name: 'Œil de chat',
    kind: 'acetate',
    lens: [[-23, 6], [-21, -5], [-13, -13], [2, -15], [17, -11], [27, -1], [31, 11], [31, 19], [22, 20], [8, 18], [-8, 15]],
    rim: (x, y) => 3.4 + 3.4 * smooth((x + 4) / 30) * smooth((y + 2) / 14),
    gap: 18,
    bridge: 'saddle',
    finish: { acetate: 'ecaille' },
    era: 'années 1950',
    icon: 'Les coins relevés des stars d’Hollywood : un regard qui remonte vers les tempes.',
    mood: ['glamour', 'créatif'],
  },
  {
    id: 'pilote-carre',
    name: 'Pilote acétate',
    kind: 'acetate',
    poly: roundedPoly([[-23, 20, 9], [-18, -20, 16], [25, -18, 16], [27, 20, 9]]),
    rim: (_x, y) => 3.4 + 2.2 * smooth((y + 4) / 22),
    gap: 17,
    bridge: 'keyhole',
    finish: { acetate: 'miel' },
    era: '1957',
    icon: 'La forme des pilotes en acétate, portée par les acteurs italiens et les dandys de la Riviera.',
    mood: ['décontracté', 'glamour'],
  },
  {
    id: 'navigator',
    name: 'Aviateur carré',
    kind: 'metal',
    poly: roundedPoly([[-24, 19, 6], [-22, -18, 14], [26, -18, 14], [27, 19, 7]]),
    wire: 1.1,
    gap: 15,
    bridge: 'double',
    bridgeTop: 19,
    pads: true,
    finish: { metal: 'or' },
    era: '1957',
    icon: 'L’aviateur aux verres carrés, plus graphique, des photographes et des voyageurs.',
    mood: ['confiant', 'décontracté'],
  },
  {
    id: 'papillon',
    name: 'Papillon',
    kind: 'acetate',
    lens: ([[-21, 14], [-24, 2], [-19, -14], [-6, -24], [10, -25], [24, -18], [29, -4], [30, 12], [26, 24], [12, 26], [-6, 22]] as V2[]).map(
      ([x, y]) => [x * 0.94, y * 0.88] as V2
    ),
    rim: (x, y) => 3.2 + 3.4 * smooth((x + 6) / 34) * smooth((y + 6) / 18),
    gap: 16,
    bridge: 'arch',
    finish: { acetate: 'noir' },
    era: 'années 1960',
    icon: 'Les grands verres des premières dames et des icônes de mode : élégance et mystère.',
    mood: ['glamour', 'confiant'],
  },
  {
    id: 'hexagonale',
    name: 'Hexagonale fine',
    kind: 'metal',
    poly: roundedPoly([[-14, 22, 3], [-26, 0, 3], [-14, -22, 3], [14, -22, 3], [26, 0, 3], [14, 22, 3]]),
    wire: 1.2,
    gap: 18,
    bridge: 'wire-arch',
    bridgeTop: 14,
    pads: true,
    finish: { metal: 'or' },
    era: 'années 1970',
    icon: 'Une géométrie inattendue née avec la contre-culture, reprise par les créateurs des années 2010.',
    mood: ['créatif', 'glamour'],
  },
  {
    id: 'sans-cercle',
    name: 'Rond sans cercle',
    kind: 'rimless',
    poly: ellipse(22.5, 20.5, 96),
    wire: 0.9,
    gap: 20,
    bridge: 'wire-arch',
    bridgeTop: 9,
    pads: true,
    finish: { metal: 'argent' },
    era: 'années 1990',
    icon: 'Des verres percés sans monture autour : la discrétion absolue des inventeurs et des minimalistes.',
    mood: ['intellectuel', 'professionnel'],
  },
  {
    id: 'rectangle-ecaille',
    name: 'Rectangle écaille',
    kind: 'acetate',
    poly: roundedPoly([[-24, 15, 4], [-21, -16, 9], [26, -16, 9], [27, 16, 4]]),
    rim: (_x, y) => 3.4 + 1.8 * smooth((y + 6) / 20),
    gap: 17,
    bridge: 'saddle',
    finish: { acetate: 'ecaille-degrade' },
    era: 'années 1990',
    icon: 'Le rectangle de la mode et des affaires : foncé en haut pour l’autorité, écaille en bas pour la chaleur.',
    mood: ['professionnel', 'confiant'],
    reference: true,
  },
];
