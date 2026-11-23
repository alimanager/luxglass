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

export interface Shape {
  id: string;
  name: string;
  kind: 'acetate' | 'metal' | 'browline';
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
}

const smooth = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

export const SHAPES: Shape[] = [
  {
    id: 'trapeze',
    name: 'Trapèze acétate',
    kind: 'acetate',
    poly: roundedPoly([[-24, 15, 5], [-20, -20, 14], [26, -16, 14], [27, 20, 5]]),
    rim: (_x, y) => 3.2 + 3.8 * smooth((y + 12) / 26),
    gap: 18,
    bridge: 'keyhole',
    bridgeTop: 14,
  },
  {
    id: 'browline',
    name: 'Browline',
    kind: 'browline',
    poly: roundedPoly([[-24, 17, 5], [-22, -14, 13], [25, -14, 13], [25, 17, 5]]),
    wire: 0.9,
    gap: 20,
    bridge: 'browline',
    bridgeTop: 16,
    pads: true,
  },
  {
    id: 'aviateur',
    name: 'Aviateur',
    kind: 'metal',
    lens: [[-27, 8], [-25, -6], [-17, -19], [-4, -26], [8, -25], [19, -17], [27, -4], [29, 9], [24, 19], [10, 24], [-10, 23], [-22, 18]],
    wire: 1.1,
    gap: 15,
    bridge: 'double',
    bridgeTop: 21,
    pads: true,
  },
  {
    id: 'panto',
    name: 'Panto rond',
    kind: 'metal',
    poly: ellipse(24, 24, 32),
    wire: 1,
    gap: 20,
    bridge: 'wire-arch',
    bridgeTop: 9,
    pads: true,
  },
  {
    id: 'oeil-de-chat',
    name: 'Œil de chat',
    kind: 'acetate',
    lens: [[-23, 6], [-21, -5], [-13, -13], [2, -15], [17, -11], [27, -1], [31, 11], [31, 19], [22, 20], [8, 18], [-8, 15]],
    rim: (x, y) => 3.4 + 3.4 * smooth((x + 4) / 30) * smooth((y + 2) / 14),
    gap: 18,
    bridge: 'saddle',
    bridgeTop: 12,
  },
  {
    id: 'carre-epais',
    name: 'Carré épais',
    kind: 'acetate',
    poly: roundedPoly([[-24, 21, 7], [-24, -21, 7], [25, -21, 7], [25, 21, 7]]),
    rim: () => 6.8,
    gap: 17,
    bridge: 'saddle',
    bridgeTop: 13,
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
  },
  {
    id: 'papillon',
    name: 'Papillon',
    kind: 'acetate',
    lens: [[-21, 14], [-24, 2], [-19, -14], [-6, -24], [10, -25], [24, -18], [29, -4], [30, 12], [26, 24], [12, 26], [-6, 22]],
    rim: (x, y) => 3.2 + 3.4 * smooth((x + 6) / 34) * smooth((y + 6) / 18),
    gap: 16,
    bridge: 'arch',
    bridgeTop: 16,
  },
  {
    id: 'navigator',
    name: 'Navigator double pont',
    kind: 'metal',
    poly: roundedPoly([[-24, 19, 6], [-22, -18, 14], [26, -18, 14], [27, 19, 7]]),
    wire: 1.1,
    gap: 15,
    bridge: 'double',
    bridgeTop: 19,
    pads: true,
  },
  {
    id: 'rectangle-fin',
    name: 'Rectangle fin',
    kind: 'metal',
    poly: roundedPoly([[-25, 15, 5], [-24, -15, 5], [25, -15, 5], [26, 15, 5]]),
    wire: 1,
    gap: 20,
    bridge: 'wire-arch',
    bridgeTop: 11,
    pads: true,
  },
  {
    id: 'ovale-retro',
    name: 'Ovale rétro',
    kind: 'acetate',
    poly: ellipse(26, 21),
    rim: () => 4.6,
    gap: 19,
    bridge: 'keyhole',
    bridgeTop: 13,
  },
  {
    id: 'pilote-carre',
    name: 'Pilote arrondi',
    kind: 'acetate',
    poly: roundedPoly([[-23, 20, 9], [-18, -20, 16], [25, -18, 16], [27, 20, 9]]),
    rim: (_x, y) => 3.4 + 2.2 * smooth((y + 4) / 22),
    gap: 17,
    bridge: 'keyhole',
    bridgeTop: 13,
  },
];
