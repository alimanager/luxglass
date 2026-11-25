/**
 * Which strips to try first, by face shape and by facial traits, and a map of the frames
 * from a principal component analysis (PCA) of their geometry.
 *
 * Frame descriptors are measured on the drawings. Face shapes and traits are placed with the
 * expert rules of src/lib/fit.ts (the frame each face calls for), not learned from data.
 */
import { SHAPES, type Mood, type Shape } from './kit-shapes';
import { aperture, drawFrame, fmt } from './kit-render';

export const SIZES = [
  { id: 'S', scale: 0.94, label: 'visage étroit, moins de 128 mm entre les tempes' },
  { id: 'M', scale: 1, label: 'visage moyen, de 128 à 140 mm' },
  { id: 'L', scale: 1.06, label: 'visage large, plus de 140 mm' },
];

export const code = (size: string, i: number) => `${size}${String(i + 1).padStart(2, '0')}`;

export function page(content: string, cls = '') {
  return `<section class="page ${cls}">${content}</section>`;
}

// ---------------------------------------------------------------- descriptors

const FEATURES = [
  { key: 'ratio', low: 'verres bas', high: 'verres hauts' },
  { key: 'roundness', low: 'anguleuse', high: 'ronde' },
  { key: 'presence', low: 'fine', high: 'épaisse' },
  { key: 'top', low: 'légère en haut', high: 'chargée en haut' },
  { key: 'lift', low: 'coins tombants', high: 'coins relevés' },
] as const;
type Key = (typeof FEATURES)[number]['key'];
export type Descriptor = Record<Key, number>;

export function describe(shape: Shape): Descriptor {
  const ap = aperture(shape, 1);
  const xs = ap.map((p) => p[0]);
  const ys = ap.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  let A = 0;
  let P = 0;
  for (let i = 0; i < ap.length; i++) {
    const [x1, y1] = ap[i];
    const [x2, y2] = ap[(i + 1) % ap.length];
    A += x1 * y2 - x2 * y1;
    P += Math.hypot(x2 - x1, y2 - y1);
  }
  A = Math.abs(A) / 2;
  // 1 for a circle, about 0.78 for a square
  const roundness = (4 * Math.PI * A) / (P * P);
  const top = Math.max(...ys);
  const bottom = Math.min(...ys);
  let presence: number;
  let topWeight: number;
  if (shape.kind === 'acetate' && shape.rim) {
    const rims = ap.map(([x, y]) => ({ y, r: shape.rim!(x, y) }));
    const avg = (xs: { r: number }[]) => xs.reduce((s, q) => s + q.r, 0) / Math.max(1, xs.length);
    presence = avg(rims);
    topWeight = avg(rims.filter((q) => q.y > top - h / 3)) - avg(rims.filter((q) => q.y < bottom + h / 3));
  } else if (shape.kind === 'browline') {
    presence = 3.2;
    topWeight = 5;
  } else {
    presence = (shape.wire ?? 1) * 0.9;
    topWeight = 0;
  }
  // height of the temple-side third of the lens, relative to its half height: high on a cat-eye, low on an aviator
  const cut = Math.max(...xs) - w / 3;
  const outer = ap.filter((p) => p[0] >= cut);
  const lift = outer.reduce((s, p) => s + p[1], 0) / outer.length / (h / 2);
  return { ratio: h / w, roundness, presence, top: topWeight, lift };
}

// ---------------------------------------------------------------- PCA

function jacobi(a: number[][]): { values: number[]; vectors: number[][] } {
  const n = a.length;
  const m = a.map((r) => [...r]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += m[i][j] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(m[p][q]) < 1e-15) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - s * mkq;
          m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - s * mqk;
          m[q][k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const values = m.map((r, i) => r[i]);
  const order = values.map((_, i) => i).sort((x, y) => values[y] - values[x]);
  return { values: order.map((i) => values[i]), vectors: order.map((i) => v.map((r) => r[i])) };
}

export interface Pca {
  mean: number[];
  sd: number[];
  axes: number[][];
  explained: number[];
  project: (d: Descriptor) => [number, number];
  z: (d: Descriptor) => number[];
}

export function pca(descriptors: Descriptor[]): Pca {
  const keys = FEATURES.map((f) => f.key);
  const X = descriptors.map((d) => keys.map((k) => d[k]));
  const n = X.length;
  const mean = keys.map((_, j) => X.reduce((s, r) => s + r[j], 0) / n);
  const sd = keys.map((_, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / (n - 1)) || 1);
  const Z = X.map((r) => r.map((x, j) => (x - mean[j]) / sd[j]));
  const C = keys.map((_, i) => keys.map((_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) / (n - 1)));
  const { values, vectors } = jacobi(C);
  const total = values.reduce((s, x) => s + x, 0);
  const z = (d: Descriptor) => keys.map((k, j) => (d[k] - mean[j]) / sd[j]);
  return {
    mean,
    sd,
    axes: vectors,
    explained: values.map((x) => x / total),
    z,
    project: (d) => {
      const zz = z(d);
      return [0, 1].map((a) => vectors[a].reduce((s, w, j) => s + w * zz[j], 0)) as [number, number];
    },
  };
}

// ---------------------------------------------------------------- what each face calls for

/** the frame each face shape calls for, in descriptor units (rules of src/lib/fit.ts) */
const FACE_TARGETS: { id: string; name: string; why: string; target: Partial<Descriptor> }[] = [
  { id: 'round', name: 'Rond', why: 'des angles et des verres plus larges que hauts structurent les joues', target: { roundness: 0.8, ratio: 0.68, presence: 4 } },
  { id: 'square', name: 'Carré', why: 'des courbes et une monture fine adoucissent la mâchoire', target: { roundness: 0.97, presence: 1.2, top: 0 } },
  { id: 'heart', name: 'Cœur', why: 'un haut léger et du volume en bas équilibrent un front large', target: { top: 0, lift: -0.15, presence: 1, roundness: 0.9 } },
  { id: 'oblong', name: 'Allongé', why: 'des verres hauts et une monture marquée raccourcissent le visage', target: { ratio: 0.92, presence: 5.5, top: 1 } },
  { id: 'oval', name: 'Ovale', why: 'presque tout te va : choisis selon tes traits et l’impression voulue', target: {} },
];

const TRAIT_TARGETS: { name: string; why: string; target: Partial<Descriptor> }[] = [
  { name: 'Sourcils épais', why: 'une barre supérieure marquée les prolonge', target: { presence: 6, top: 3 } },
  { name: 'Sourcils fins', why: 'une monture légère ne les écrase pas', target: { presence: 1, top: 0 } },
  { name: 'Yeux tombants', why: 'des coins relevés remontent le regard', target: { lift: 0.75, top: 2 } },
  { name: 'Traits délicats', why: 'peu de matière, des lignes douces', target: { presence: 1, roundness: 0.95 } },
  { name: 'Traits marqués', why: 'il faut de la présence pour tenir face à eux', target: { presence: 6.5 } },
];

function rank(descs: Descriptor[], p: Pca, target: Partial<Descriptor>, count = 4): number[] {
  const keys = FEATURES.map((f) => f.key);
  const dist = descs.map((d, i) => {
    let s = 0;
    keys.forEach((k, j) => {
      const t = target[k];
      if (t === undefined) return;
      s += ((d[k] - t) / p.sd[j]) ** 2;
    });
    return { i, s };
  });
  return dist
    .sort((a, b) => a.s - b.s)
    .slice(0, count)
    .map((x) => x.i);
}

const descs = SHAPES.map(describe);
const model = pca(descs);

/** centre of the frames a face calls for, on the map */
function facePoint(target: Partial<Descriptor>): [number, number] {
  const keys = FEATURES.map((f) => f.key);
  const d = Object.fromEntries(keys.map((k, j) => [k, target[k] ?? model.mean[j]])) as Descriptor;
  return model.project(d);
}

const codesM = (ids: number[]) => ids.map((i) => `<b>${code('M', i).slice(1)}</b> ${SHAPES[i].name}`).join('<br>');

const MOODS: { id: Mood; name: string; why: string }[] = [
  { id: 'confiant', name: 'Confiant', why: 'de la matière et des lignes nettes' },
  { id: 'créatif', name: 'Créatif', why: 'une forme qu’on ne voit pas partout' },
  { id: 'intellectuel', name: 'Intellectuel', why: 'des ronds, du fin, de l’histoire' },
  { id: 'professionnel', name: 'Professionnel', why: 'des lignes horizontales et sobres' },
  { id: 'glamour', name: 'Glamour', why: 'des coins relevés, du volume' },
  { id: 'décontracté', name: 'Décontracté', why: 'des formes de plein air, sans effort' },
];

function moodRows(): string {
  return MOODS.map((m) => {
    const ids = SHAPES.map((s, i) => ({ i, r: s.mood.indexOf(m.id) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r)
      .slice(0, 4)
      .map((x) => x.i);
    return `<tr><th>${m.name}</th><td>${codesM(ids)}</td></tr>`;
  }).join('');
}

export function iconsPage(): string {
  const rows = SHAPES.map(
    (s, i) => `<tr><th>${String(i + 1).padStart(2, '0')}</th><td><b>${s.name}</b><br><span class="small">${s.era}</span></td><td>${s.icon}</td></tr>`
  ).join('');
  return page(`
    <h1>${SHAPES.length} icônes, un siècle de regards</h1>
    <p class="small">Chaque monture de ce kit a marqué son époque et n’a jamais disparu. Elles sont dessinées d’après les proportions
    de leur famille, sans reproduire le modèle d’une marque.</p>
    <table class="icons">${rows}</table>
  `);
}

export function faceGuidePage(): string {
  const faceRows = FACE_TARGETS.map((f) => {
    const ids = f.id === 'oval' ? ['panto', 'browline', 'trapeze', 'rectangle-ecaille'].map((x) => SHAPES.findIndex((s) => s.id === x)) : rank(descs, model, f.target);
    return `<tr><th>${f.name}</th><td>${codesM(ids)}</td><td>${f.why[0].toUpperCase() + f.why.slice(1)}.</td></tr>`;
  }).join('');
  const traitRows = TRAIT_TARGETS.map(
    (t) => `<tr><th>${t.name}</th><td>${codesM(rank(descs, model, t.target, 3))}</td><td>${t.why[0].toUpperCase() + t.why.slice(1)}.</td></tr>`
  ).join('');
  return page(`
    <h1>Par où commencer</h1>
    <p class="small">Les numéros valent pour les trois largeurs : 05 est la bande S05, M05 ou L05. L’application reconnaît ta forme
    de visage et tes traits à partir d’une photo.</p>
    <div class="cols3">
      <div><h2>Par forme de visage</h2><table>${faceRows}</table></div>
      <div><h2>Par trait</h2><table>${traitRows}</table></div>
      <div><h2>Par impression</h2><table>${moodRows()}</table></div>
    </div>
  `);
}

export function mapPage(): string {
  const pts = descs.map((d) => model.project(d));
  const faces = FACE_TARGETS.map((f) => ({ ...f, p: facePoint(f.target) }));
  const all = [...pts, ...faces.map((f) => f.p)];
  const xr = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
  const yr = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
  const W = 250;
  const H = 140;
  const pad = 20;
  const sx = (x: number) => pad + ((x - xr[0]) / (xr[1] - xr[0] || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - yr[0]) / (yr[1] - yr[0] || 1)) * (H - 2 * pad);

  const axisName = (a: number) => {
    const w = model.axes[a];
    const order = w.map((v, j) => ({ v, j })).sort((p, q) => Math.abs(q.v) - Math.abs(p.v));
    const top = order.slice(0, 2);
    const neg = top.map(({ v, j }) => (v > 0 ? FEATURES[j].low : FEATURES[j].high)).join(', ');
    const pos = top.map(({ v, j }) => (v > 0 ? FEATURES[j].high : FEATURES[j].low)).join(', ');
    return { neg, pos, share: Math.round(model.explained[a] * 100) };
  };
  const ax = axisName(0);
  const ay = axisName(1);

  const thumbs = SHAPES.map((s, i) => {
    const d = drawFrame(s, 1);
    const [x, y] = pts[i];
    return `<defs>${d.defs}</defs><g transform="translate(${fmt(sx(x))} ${fmt(sy(y))})"><g transform="scale(0.2)">${d.svg}</g>
      <text y="7.4" font-size="2.6" text-anchor="middle" fill="#333">${String(i + 1).padStart(2, '0')}</text></g>`;
  }).join('');
  const faceMarks = faces
    .map(
      (f) => `<g transform="translate(${fmt(sx(f.p[0]))} ${fmt(sy(f.p[1]))})"><circle r="9" fill="#2f6f8f" fill-opacity=".08" stroke="#2f6f8f" stroke-width=".25" stroke-dasharray="1 .8"/>
      <text y="12.6" font-size="3" font-weight="700" text-anchor="middle" fill="#2f6f8f" stroke="#fff" stroke-width=".9" paint-order="stroke">${f.name}</text></g>`
    )
    .join('');

  return page(`
    <h1>La carte des montures</h1>
    <p class="small">Une analyse en composantes principales (ACP) des ${SHAPES.length} dessins, sur cinq mesures : hauteur des verres, rondeur,
    épaisseur, poids du haut et relevé des coins. Deux montures proches se ressemblent sur un visage. En bleu, la zone que chaque forme
    de visage appelle selon nos règles de stylisme.</p>
    <svg width="${W}mm" height="${H + 12}mm" viewBox="0 0 ${W} ${H + 12}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
      <line x1="${pad / 2}" y1="${H - pad / 2}" x2="${W - pad / 2}" y2="${H - pad / 2}" stroke="#bbb" stroke-width=".2"/>
      <line x1="${pad / 2}" y1="${pad / 2}" x2="${pad / 2}" y2="${H - pad / 2}" stroke="#bbb" stroke-width=".2"/>
      <text x="${pad / 2}" y="${H - pad / 2 + 5}" font-size="2.8" fill="#777">${ax.neg}</text>
      <text x="${W - pad / 2}" y="${H - pad / 2 + 5}" font-size="2.8" fill="#777" text-anchor="end">${ax.pos} (axe 1, ${ax.share} %)</text>
      <text x="${pad / 2 + 2}" y="${H - pad / 2 - 2}" font-size="2.8" fill="#777">↓ ${ay.neg}</text>
      <text x="${pad / 2 + 2}" y="${pad / 2 - 2}" font-size="2.8" fill="#777">↑ ${ay.pos} (axe 2, ${ay.share} %)</text>
      ${thumbs}
      ${faceMarks}
    </svg>
  `);
}
