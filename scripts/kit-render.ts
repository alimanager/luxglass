/**
 * Front view of a frame as SVG, in millimetres, with material rendering:
 * tortoiseshell from fractal noise, acetate highlight, brushed metal gradients,
 * rivets, nose pads and the stubs left where the temples were cut off.
 * The frame is centred on (0, 0) at the middle of the bridge; SVG y grows downwards.
 */
import type { Finish, Shape, V2 } from './kit-shapes';

export const fmt = (n: number) => n.toFixed(2);
const path = (pts: V2[]) => 'M' + pts.map(([x, y]) => `${fmt(x)} ${fmt(-y)}`).join('L') + 'Z';
const smooth = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

/** closed Catmull-Rom spline through the points, sampled */
function spline(pts: V2[], per = 12): V2[] {
  const n = pts.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

const area = (pts: V2[]) =>
  pts.reduce((s, [x, y], i) => s + (x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y), 0) / 2;
const ccw = (pts: V2[]) => (area(pts) < 0 ? [...pts].reverse() : pts);

/** offset a CCW outline outwards by d(x, y) mm */
function offsetVar(pts: V2[], d: (x: number, y: number) => number): V2[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    const k = d(p[0], p[1]);
    return [p[0] + (ty / len) * k, p[1] - (tx / len) * k] as V2;
  });
}

/** x where the horizontal line at height y crosses a closed outline: the smallest or the largest */
export function edgeAt(pts: V2[], y: number, which: 'min' | 'max'): number | null {
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue;
    xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
  }
  if (!xs.length) return null;
  return which === 'min' ? Math.min(...xs) : Math.max(...xs);
}

const scaleShape = (pts: V2[], k: number): V2[] => pts.map(([x, y]) => [x * k, y * k] as V2);
const mirror = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y] as V2).reverse();
const shift = (pts: V2[], dx: number): V2[] => pts.map(([x, y]) => [x + dx, y] as V2);

/** aperture of one lens (right side, centred), CCW, in mm at size factor k */
export function aperture(shape: Shape, k: number): V2[] {
  return scaleShape(ccw(shape.poly ?? spline(shape.lens!)), k);
}

const METAL: Record<NonNullable<Finish['metal']>, string[]> = {
  or: ['#6b4f1d', '#e6cb86', '#a37c33', '#f4e3ae', '#7a5a22'],
  argent: ['#5f6368', '#eceef0', '#979ca2', '#f7f8f9', '#6a6e73'],
  noir: ['#0d0d0e', '#4a4a4d', '#161617', '#5d5d61', '#0f0f10'],
  canon: ['#2e2f31', '#9d9fa3', '#4b4d50', '#b6b8bb', '#333436'],
};

const ACETATE_BASE: Record<NonNullable<Finish['acetate']>, string> = {
  noir: '#121011',
  brun: '#3a2418',
  ecaille: '#000',
  miel: '#000',
  'ecaille-degrade': '#000',
};

/** tortoiseshell colour tables, indexed by fractal noise */
const TORTOISE = {
  ecaille: {
    r: '0.07 0.08 0.10 0.17 0.44 0.66 0.76',
    g: '0.04 0.05 0.06 0.09 0.23 0.38 0.46',
    b: '0.03 0.03 0.04 0.05 0.08 0.13 0.16',
  },
  miel: {
    r: '0.18 0.26 0.42 0.62 0.78 0.86 0.90',
    g: '0.09 0.14 0.25 0.40 0.53 0.61 0.66',
    b: '0.04 0.05 0.08 0.12 0.19 0.25 0.30',
  },
};

export interface Drawn {
  svg: string;
  defs: string;
  /** overall size of the front, mm */
  width: number;
  height: number;
  /** vertical centre of the drawing, svg units (y down) */
  centerY: number;
  /** lens width and bridge, rounded like the numbers printed in a temple */
  marking: string;
}

let uid = 0;

export function drawFrame(shape: Shape, k: number): Drawn {
  const id = `f${uid++}`;
  const ap = aperture(shape, k);
  const rimK = (x: number, y: number) => (shape.rim ? shape.rim(x / k, y / k) * k : 0);
  const wire = (shape.wire ?? 1) * k;
  const minX = Math.min(...ap.map((p) => p[0]));
  const maxX = Math.max(...ap.map((p) => p[0]));
  const lo = Math.min(...ap.map((p) => p[1]));
  const hi = Math.max(...ap.map((p) => p[1]));
  const gap = shape.gap * k;
  const cx = gap / 2 - minX;
  const g = gap / 2;
  const fin = shape.finish;
  const acetate = shape.kind === 'acetate';
  const metalTone = fin.metal ?? 'noir';

  const defs: string[] = [];
  const back: string[] = []; // acetate silhouettes, filled together then masked by the lenses
  const front: string[] = []; // metal, rivets, pads, edges
  const bbox = { x: 0, yMin: 1e9, yMax: -1e9 };
  const grow = (pts: V2[], pad = 0) => {
    for (const [x, y] of pts) {
      bbox.x = Math.max(bbox.x, Math.abs(x) + pad);
      bbox.yMin = Math.min(bbox.yMin, y - pad);
      bbox.yMax = Math.max(bbox.yMax, y + pad);
    }
  };

  const lenses = [1, -1].map((side) => shift(side === 1 ? ap : mirror(ap), side * cx));
  const outerOf = (side: 1 | -1) => {
    const local = side === 1 ? ap : mirror(ap);
    return shift(offsetVar(local, (x, y) => rimK(side === 1 ? x : -x, y)), side * cx);
  };

  // ---- materials
  const [m0, m1, m2, m3, m4] = METAL[metalTone];
  defs.push(
    `<linearGradient id="${id}met" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m0}"/><stop offset=".22" stop-color="${m1}"/><stop offset=".5" stop-color="${m2}"/><stop offset=".72" stop-color="${m3}"/><stop offset="1" stop-color="${m4}"/></linearGradient>`,
    `<radialGradient id="${id}riv" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#fbfbfb"/><stop offset=".45" stop-color="#b9bcc0"/><stop offset="1" stop-color="#55585c"/></radialGradient>`
  );
  const yTop = -(hi + 9 * k);
  const yBot = -(lo - 9 * k);
  defs.push(
    `<linearGradient id="${id}hl" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(yTop)}" x2="0" y2="${fmt(yBot)}"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".16" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>`
  );
  const ac = fin.acetate ?? 'noir';
  const tortoise = ac === 'ecaille' || ac === 'ecaille-degrade' ? TORTOISE.ecaille : ac === 'miel' ? TORTOISE.miel : null;
  if (tortoise) {
    defs.push(
      `<filter id="${id}tort" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="-130" y="-70" width="260" height="140" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.10 0.24" numOctaves="3" seed="${(uid * 7) % 97}" result="n"/>` +
        `<feColorMatrix in="n" type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" result="g"/>` +
        `<feComponentTransfer in="g" result="c"><feFuncR type="table" tableValues="${tortoise.r}"/><feFuncG type="table" tableValues="${tortoise.g}"/><feFuncB type="table" tableValues="${tortoise.b}"/></feComponentTransfer>` +
        `<feComposite in="c" in2="SourceGraphic" operator="in"/></filter>`
    );
  }
  if (ac === 'ecaille-degrade') {
    defs.push(
      `<linearGradient id="${id}dg" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(yTop)}" x2="0" y2="${fmt(yBot)}"><stop offset="0" stop-color="#140c09" stop-opacity=".97"/><stop offset=".28" stop-color="#140c09" stop-opacity=".9"/><stop offset=".62" stop-color="#140c09" stop-opacity="0"/></linearGradient>`
    );
  }
  // lenses are cut out of everything drawn in acetate
  defs.push(
    `<mask id="${id}lens" maskUnits="userSpaceOnUse" x="-130" y="-70" width="260" height="140"><rect x="-130" y="-70" width="260" height="140" fill="#fff"/><path d="${lenses.map(path).join('')}" fill="#000"/></mask>`
  );

  /** x of the nose-side edge of a contour at height y, pushed inside by `inside` */
  const right = shift(acetate ? offsetVar(ap, (x, y) => rimK(x, y)) : ap, cx);
  const edgeX = (y: number, inside: number) => (edgeAt(right, y, 'min') ?? g) + inside;
  /** temple-side edge of a contour at height y */
  const outerEdge = (pts: V2[], y: number) => edgeAt(pts, y, 'max') ?? Math.max(...pts.map((p) => p[0]));

  const metalStroke = (d: string, w: number, cap = 'round') =>
    `<path d="${d}" fill="none" stroke="url(#${id}met)" stroke-width="${fmt(w)}" stroke-linecap="${cap}" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="${fmt(w * 0.22)}" stroke-linecap="round" transform="translate(0 ${fmt(-w * 0.22)})"/>`;

  // ---- rims
  const hingeY = hi * (acetate ? 0.72 : 0.6);
  for (const side of [1, -1] as const) {
    const inner = lenses[side === 1 ? 0 : 1];
    if (acetate) {
      const outer = outerOf(side);
      back.push(path(outer));
      grow(outer);
      // temple stub cut at the hinge
      const ox = outerEdge(outer.map(([x, y]) => [side * x, y] as V2), hingeY);
      const x0 = side * (ox - 1.5 * k);
      const x1 = side * (ox + 3.2 * k);
      const h = 3.4 * k;
      back.push(`M${fmt(Math.min(x0, x1))} ${fmt(-hingeY - h / 2)}H${fmt(Math.max(x0, x1))}V${fmt(-hingeY + h / 2)}H${fmt(Math.min(x0, x1))}Z`);
      bbox.x = Math.max(bbox.x, Math.abs(x1));
      front.push(`<path d="${path(outer)}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".28"/>`);
      front.push(`<path d="${path(inner)}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width=".32"/>`);
      front.push(`<path d="${path(offsetVar(inner, () => 0.45 * k))}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".35"/>`);
      if (fin.rivets) {
        const ix = side * outerEdge(inner.map(([x, y]) => [side * x, y] as V2), hingeY);
        const mx = (ix + side * ox) / 2;
        for (const dx of [-1.25, 1.25]) {
          front.push(`<circle cx="${fmt(mx + dx * k)}" cy="${fmt(-hingeY)}" r="${fmt(0.72 * k)}" fill="url(#${id}riv)"/>`);
        }
      }
    } else {
      front.push(metalStroke(path(inner), wire));
      grow(inner, wire / 2);
      // end piece and hinge block where the temple was
      const ex = side * outerEdge(inner.map(([x, y]) => [side * x, y] as V2), hingeY * 0.9);
      const y = -hingeY * 0.9;
      front.push(metalStroke(`M${fmt(ex)} ${fmt(y)}L${fmt(ex + side * 3.4 * k)} ${fmt(y - 0.6 * k)}`, wire * 1.15));
      front.push(`<rect x="${fmt(Math.min(ex + side * 2.4 * k, ex + side * 4.6 * k))}" y="${fmt(y - 1.6 * k)}" width="${fmt(2.2 * k)}" height="${fmt(2 * k)}" rx="${fmt(0.5 * k)}" fill="url(#${id}met)"/>`);
      bbox.x = Math.max(bbox.x, Math.abs(ex) + 4.8 * k);
    }
    if (shape.kind === 'browline') {
      // acetate brow over the top of the lens, thicker towards the temple
      const local = side === 1 ? ap : mirror(ap);
      const ymax = Math.max(...local.map((p) => p[1]));
      const top = shift(local, side * cx)
        .filter(([, y]) => y > ymax * 0.12)
        .sort((a, b) => a[0] - b[0]);
      const upper = top.map(([x, y]) => {
        const rel = (y - ymax * 0.12) / (ymax * 0.88);
        const towardTemple = smooth((side * x - g) / (maxX - minX));
        const t = (2.2 + 3.2 * smooth(rel * 1.6) + 1.6 * towardTemple) * k;
        return [x, y + t] as V2;
      });
      const lower = top.slice().reverse().map(([x, y]) => [x, y - 0.9 * k] as V2);
      back.push(path([...upper, ...lower]));
      grow(upper);
      // stub
      const ox = Math.max(...upper.map((p) => side * p[0]));
      const sy = ymax * 0.82;
      back.push(`M${fmt(side * (ox - 2 * k))} ${fmt(-sy - 1.8 * k)}H${fmt(side * (ox + 3 * k))}V${fmt(-sy + 1.8 * k)}H${fmt(side * (ox - 2 * k))}Z`);
      bbox.x = Math.max(bbox.x, ox + 3 * k);
      front.push(`<path d="${path([...upper, ...lower])}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".25"/>`);
      if (fin.rivets) {
        for (const dx of [-1.3, 1.3]) {
          front.push(`<circle cx="${fmt(side * (ox - 5 * k) + dx * k)}" cy="${fmt(-(ymax + 2.6 * k))}" r="${fmt(0.7 * k)}" fill="url(#${id}riv)"/>`);
        }
      }
    }
    if (shape.pads) {
      const px = side * (g + 0.4 * k);
      const py = 6 * k; // svg y, below the lens centre
      front.push(
        `<path d="M${fmt(side * (g + 1.2 * k))} ${fmt(-2 * k)}Q${fmt(side * (g - 0.8 * k))} ${fmt(1 * k)} ${fmt(px)} ${fmt(py - 3 * k)}" fill="none" stroke="url(#${id}met)" stroke-width="${fmt(0.55 * k)}"/>`,
        `<ellipse cx="${fmt(px)}" cy="${fmt(py)}" rx="${fmt(1.7 * k)}" ry="${fmt(3.5 * k)}" transform="rotate(${side * -16} ${fmt(px)} ${fmt(py)})" fill="#9aa0a6" fill-opacity=".22" stroke="#6b7076" stroke-width=".2"/>`
      );
    }
  }

  // ---- bridge
  const bt = (shape.bridgeTop ?? 12) * k;
  // a solid bridge starts flush with the top of the rims on the nose side
  const noseTop = Math.max(...right.filter((p) => p[0] < Math.min(...right.map((q) => q[0])) + 7 * k).map((p) => p[1]));
  const solid = (_top: number, thick: number, lift: number) => {
    const top = noseTop - 0.8 * k;
    const xt = edgeX(top, 3.2 * k);
    const xb = edgeX(top - thick, 3.2 * k);
    return `M${fmt(-xt)} ${fmt(-top)}H${fmt(xt)}L${fmt(xb)} ${fmt(-(top - thick))}Q0 ${fmt(-(top - thick + lift))} ${fmt(-xb)} ${fmt(-(top - thick))}Z`;
  };
  const wireArc = (yEnd: number, lift: number) => {
    const x = edgeX(yEnd, 0.2 * k);
    return `M${fmt(-x)} ${fmt(-yEnd)}Q0 ${fmt(-(yEnd + lift))} ${fmt(x)} ${fmt(-yEnd)}`;
  };
  switch (shape.bridge) {
    case 'keyhole':
      back.push(solid(bt, 7.5 * k, 5.5 * k));
      break;
    case 'saddle':
      back.push(solid(bt, 8.5 * k, 3.5 * k));
      break;
    case 'arch':
      back.push(solid(bt, 9 * k, 5 * k));
      break;
    case 'wire-arch':
      front.push(metalStroke(wireArc(bt - 4 * k, 8 * k), wire * 1.1));
      break;
    case 'double': {
      front.push(metalStroke(wireArc(-1 * k, 8 * k), wire));
      const x = edgeX(bt, 0.2 * k);
      front.push(metalStroke(`M${fmt(-x)} ${fmt(-bt)}Q0 ${fmt(-(bt + 2 * k))} ${fmt(x)} ${fmt(-bt)}`, wire));
      break;
    }
    case 'browline': {
      front.push(metalStroke(wireArc(bt - 8 * k, 7 * k), wire * 1.2));
      const x = edgeX(bt, 0.5 * k);
      back.push(`M${fmt(-x)} ${fmt(-(bt + 2.2 * k))}H${fmt(x)}V${fmt(-(bt - 2.4 * k))}H${fmt(-x)}Z`);
      break;
    }
  }

  // ---- assemble
  const lensTint = `<path d="${lenses.map(path).join('')}" fill="#5b6670" fill-opacity=".05"/>`;
  let acetateLayer = '';
  if (back.length) {
    // the pieces overlap (rims, bridge, stubs): their union is built as a mask, then the material fills it
    defs.push(
      `<mask id="${id}back" maskUnits="userSpaceOnUse" x="-130" y="-70" width="260" height="140"><g fill="#fff">${back.map((d) => `<path d="${d}"/>`).join('')}</g></mask>`
    );
    const bx = bbox.x + 2;
    const box = `x="${fmt(-bx)}" y="${fmt(-bbox.yMax - 2)}" width="${fmt(2 * bx)}" height="${fmt(bbox.yMax - bbox.yMin + 4)}"`;
    const base = tortoise ? `<rect ${box} fill="#000" filter="url(#${id}tort)"/>` : `<rect ${box} fill="${ACETATE_BASE[ac]}"/>`;
    const fade = ac === 'ecaille-degrade' ? `<rect ${box} fill="url(#${id}dg)"/>` : '';
    acetateLayer = `<g mask="url(#${id}lens)"><g mask="url(#${id}back)">${base}${fade}<rect ${box} fill="url(#${id}hl)"/></g></g>`;
  }
  const lensW = Math.round(maxX - minX + 1);
  return {
    defs: defs.join(''),
    svg: lensTint + acetateLayer + front.join(''),
    width: bbox.x * 2,
    height: bbox.yMax - bbox.yMin,
    centerY: -(bbox.yMax + bbox.yMin) / 2,
    marking: `${lensW}□${Math.round(gap)}`,
  };
}
