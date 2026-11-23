/**
 * Printable try-on kit: every frame style drawn at real size (1 mm = 1 mm) on strips to cut out.
 * Print on A4 transparency film at 100 %, hold a strip in front of a face, and the frame sits
 * on it the way it will in the app. Three width classes (S, M, L) cover different faces.
 *
 *   npm run kit            writes kit/kit.html (open it, or print it to PDF at 100 %)
 *   npm run kit -- --pdf   also writes kit/kit.pdf with headless Chrome
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { SHAPES, type Shape, type V2 } from './kit-shapes';

const INK = '#15110f';
const SIZES = [
  { id: 'S', scale: 0.94, label: 'S, visage étroit (largeur mesurée sous 128 mm)' },
  { id: 'M', scale: 1, label: 'M, visage moyen (128 à 140 mm)' },
  { id: 'L', scale: 1.06, label: 'L, visage large (au-dessus de 140 mm)' },
];
/** pupillary distance used for the alignment marks */
const PD = 63;

const fmt = (n: number) => n.toFixed(2);
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

const area = (pts: V2[]) => pts.reduce((s, [x, y], i) => s + (x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y), 0) / 2;
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

const scaleShape = (pts: V2[], k: number): V2[] => pts.map(([x, y]) => [x * k, y * k] as V2);
const mirror = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y] as V2).reverse();
const shift = (pts: V2[], dx: number): V2[] => pts.map(([x, y]) => [x + dx, y] as V2);

interface Drawn {
  svg: string;
  width: number;
  height: number;
}

let uid = 0;
function drawFrame(shape: Shape, k: number): Drawn {
  const maskId = `m${uid++}`;
  const apRaw = ccw(shape.poly ?? spline(shape.lens!));
  const ap = scaleShape(apRaw, k);
  const rim = shape.rim ?? (() => 0);
  const rimK = (x: number, y: number) => rim(x / k, y / k) * k;
  const wire = (shape.wire ?? 1) * k;
  const minX = Math.min(...ap.map((p) => p[0]));
  const gap = shape.gap * k;
  const cx = gap / 2 - minX;
  const out: string[] = [];
  const bbox = { x: 0, yMin: 1e9, yMax: -1e9 };

  for (const side of [1, -1] as const) {
    const local = side === 1 ? ap : mirror(ap);
    const inner = shift(local, side * cx);
    out.push(`<path d="${path(inner)}" fill="${INK}" fill-opacity="0.07"/>`);
    if (shape.kind === 'acetate') {
      const outer = shift(offsetVar(local, (x, y) => rimK(side === 1 ? x : -x, y)), side * cx);
      out.push(`<path d="${path(outer)}${path([...inner].reverse())}" fill="${INK}" fill-rule="evenodd"/>`);
      for (const [x, y] of outer) {
        bbox.x = Math.max(bbox.x, Math.abs(x));
        bbox.yMin = Math.min(bbox.yMin, y);
        bbox.yMax = Math.max(bbox.yMax, y);
      }
    } else {
      out.push(`<path d="${path(inner)}" fill="none" stroke="${INK}" stroke-width="${fmt(wire)}" stroke-linejoin="round"/>`);
      for (const [x, y] of inner) {
        bbox.x = Math.max(bbox.x, Math.abs(x) + wire / 2);
        bbox.yMin = Math.min(bbox.yMin, y - wire / 2);
        bbox.yMax = Math.max(bbox.yMax, y + wire / 2);
      }
    }
    if (shape.kind === 'browline') {
      // acetate brow band over the top of the lens, thinning towards both ends
      const ymax = Math.max(...local.map((p) => p[1]));
      const top = inner
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p[1] > ymax * 0.15)
        .map(({ p }) => p)
        .sort((a, b) => a[0] - b[0]);
      const band = offsetVar(ccw([...top, ...top.slice().reverse().map(([x, y]) => [x, y - 0.01] as V2)]), () => 0);
      void band;
      const upper = top.map(([x, y]) => {
        const rel = (y - ymax * 0.15) / (ymax * 0.85);
        const t = (2 + 4.8 * smooth(rel * 1.6)) * k;
        return [x, y + t] as V2;
      });
      out.push(`<path d="${path([...upper, ...top.slice().reverse()])}" fill="${INK}"/>`);
      for (const [, y] of upper) bbox.yMax = Math.max(bbox.yMax, y);
    }
  }

  // bridge, centred on x = 0 and tied into the rims on both sides
  const g = gap / 2;
  const bt = (shape.bridgeTop ?? 12) * k;
  const right = shift(shape.kind === 'acetate' ? offsetVar(ap, (x, y) => rimK(x, y)) : ap, cx);
  /** x of the nose-side edge of the right lens at height y (mm), pushed slightly inside the rim */
  const edgeX = (y: number, inside: number) => {
    const xs = right.filter((p) => Math.abs(p[1] - y) < 1.4 * k).map((p) => p[0]);
    return (xs.length ? Math.min(...xs) : g) + inside;
  };
  const stroke = (d: string, w: number) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${fmt(w)}" stroke-linecap="round"/>`;
  const solid = (top: number, thick: number, lift: number) => {
    const xt = edgeX(top, 3.2 * k);
    const xb = edgeX(top - thick, 3.2 * k);
    // the bridge never covers a lens: both apertures are cut out of it
    const holes = [1, -1].map((s) => path(shift(s === 1 ? ap : mirror(ap), s * cx))).join('');
    const mask = `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="-100" y="-60" width="200" height="120"><rect x="-100" y="-60" width="200" height="120" fill="#fff"/><path d="${holes}" fill="#000"/></mask>`;
    return `${mask}<path mask="url(#${maskId})" d="M${fmt(-xt)} ${fmt(-top)}H${fmt(xt)}L${fmt(xb)} ${fmt(-(top - thick))}Q0 ${fmt(-(top - thick + lift))} ${fmt(-xb)} ${fmt(-(top - thick))}Z" fill="${INK}"/>`;
  };
  const wireArc = (yEnd: number, lift: number) => {
    const x = edgeX(yEnd, 0.2 * k);
    return stroke(`M${fmt(-x)} ${fmt(-yEnd)}Q0 ${fmt(-(yEnd + lift))} ${fmt(x)} ${fmt(-yEnd)}`, wire);
  };
  switch (shape.bridge) {
    case 'keyhole':
      out.push(solid(bt, 7 * k, 5.5 * k));
      break;
    case 'saddle':
      out.push(solid(bt, 7.5 * k, 3.5 * k));
      break;
    case 'arch':
      out.push(solid(bt, 9 * k, 5 * k));
      break;
    case 'wire-arch':
      out.push(wireArc(bt - 4 * k, 8 * k));
      break;
    case 'double':
      out.push(wireArc(-1 * k, 8 * k));
      out.push(stroke(`M${fmt(-edgeX(bt, 0.2 * k))} ${fmt(-bt)}Q0 ${fmt(-(bt + 2 * k))} ${fmt(edgeX(bt, 0.2 * k))} ${fmt(-bt)}`, wire));
      break;
    case 'browline': {
      out.push(wireArc(bt - 8 * k, 7 * k));
      const x = edgeX(bt, 0.5 * k);
      out.push(`<path d="M${fmt(-x)} ${fmt(-(bt + 2.2 * k))}H${fmt(x)}V${fmt(-(bt - 2.4 * k))}H${fmt(-x)}Z" fill="${INK}"/>`);
      break;
    }
  }

  // pupil marks: cross-hairs at the average pupillary distance, at the height pupils usually sit
  const lo = Math.min(...ap.map((p) => p[1]));
  const hi = Math.max(...ap.map((p) => p[1]));
  const py = -(lo + (hi - lo) * 0.56);
  for (const x of [-PD / 2, PD / 2]) {
    out.push(`<g stroke="${INK}" stroke-width="0.25" opacity="0.8"><path d="M${fmt(x - 2.4)} ${fmt(py)}h4.8M${fmt(x)} ${fmt(py - 2.4)}v4.8"/></g>`);
  }
  return { svg: out.join(''), width: bbox.x * 2, height: bbox.yMax - bbox.yMin };
}

const CELL_W = 190;
const CELL_H = 66;
const TAB_W = 26;

function strip(shape: Shape, size: (typeof SIZES)[number], index: number): string {
  const d = drawFrame(shape, size.scale);
  const x = TAB_W + (CELL_W - TAB_W) / 2;
  const y = CELL_H / 2 + 1;
  return `
  <svg class="strip" xmlns="http://www.w3.org/2000/svg" width="${CELL_W}mm" height="${CELL_H}mm" viewBox="0 0 ${CELL_W} ${CELL_H}">
    <rect x="0.4" y="0.4" width="${CELL_W - 0.8}" height="${CELL_H - 0.8}" rx="2.5" fill="none" stroke="#999" stroke-width="0.2" stroke-dasharray="1.2 1.2"/>
    <line x1="${TAB_W}" y1="1" x2="${TAB_W}" y2="${CELL_H - 1}" stroke="#bbb" stroke-width="0.15" stroke-dasharray="0.8 1.2"/>
    <g font-family="Helvetica, Arial, sans-serif" fill="#222">
      <text x="4" y="12" font-size="9" font-weight="700">${size.id}${index + 1}</text>
      <text x="4" y="21" font-size="3.1">${shape.name}</text>
      <text x="4" y="26" font-size="2.6" fill="#666">${Math.round(d.width)} × ${Math.round(d.height)} mm</text>
      <text x="4" y="${CELL_H - 6}" font-size="2.4" fill="#888">Tiens ici</text>
    </g>
    <g transform="translate(${fmt(x)} ${fmt(y)})">${d.svg}</g>
  </svg>`;
}

function page(content: string, cls = '') {
  return `<section class="page ${cls}">${content}</section>`;
}

/** 1 mm = 1 mm checks: a card-size outline and a millimetre ruler. */
function calibration(): string {
  const ticks: string[] = [];
  for (let mm = 0; mm <= 100; mm++) {
    const len = mm % 10 === 0 ? 6 : mm % 5 === 0 ? 4 : 2.4;
    ticks.push(`<line x1="${mm}" y1="0" x2="${mm}" y2="${len}" stroke="#111" stroke-width="0.2"/>`);
    if (mm % 10 === 0) ticks.push(`<text x="${mm}" y="10" font-size="3" text-anchor="middle">${mm}</text>`);
  }
  // pupillary distance ruler, 50 to 80 mm
  const pd: string[] = [];
  for (let mm = 50; mm <= 80; mm++) {
    const x = mm - 50;
    const len = mm % 5 === 0 ? 6 : 3.2;
    pd.push(`<line x1="${x * 2}" y1="0" x2="${x * 2}" y2="${len}" stroke="#111" stroke-width="0.2"/>`);
    if (mm % 5 === 0) pd.push(`<text x="${x * 2}" y="10" font-size="3" text-anchor="middle">${mm}</text>`);
  }
  return page(`
    <h1>Vérifie l’échelle avant de découper</h1>
    <p>Pose une carte bancaire sur le rectangle ci-dessous. Elle doit le recouvrir exactement. Sinon, ré-imprime à <b>100 %</b>
    (« taille réelle », sans « ajuster à la page »).</p>
    <svg width="190mm" height="78mm" viewBox="0 0 190 78" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
      <rect x="2" y="2" width="85.6" height="53.98" rx="3.2" fill="none" stroke="#111" stroke-width="0.4"/>
      <text x="44.8" y="31" font-size="4" text-anchor="middle">Carte bancaire 85,6 × 54 mm</text>
      <g transform="translate(2 62)">${ticks.join('')}</g>
    </svg>
    <h2>Mesurer l’écart de tes pupilles</h2>
    <p>Place la règle sous tes yeux devant un miroir, regarde droit devant toi, et lis la graduation sous chaque pupille. Une
    autre personne peut le faire pour toi. Sinon, l’application le mesure à ta place.</p>
    <svg width="190mm" height="24mm" viewBox="0 0 190 24" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
      <g transform="translate(2 4)">${pd.join('')}</g>
      <text x="2" y="20" font-size="3">mm (50 à 80)</text>
    </svg>
  `);
}

function guide(): string {
  return page(`
    <h1>Kit d’essayage</h1>
    <p>${glassesCount()} formes de montures dessinées à leur taille réelle, en trois largeurs. Elles te montrent, sur ton visage et
    sans écran, l’effet d’une forme avant de l’essayer en vrai.</p>
    <h2>Pour imprimer</h2>
    <ol>
      <li>Imprime sur du <b>film transparent pour imprimante</b> (jet d’encre ou laser selon ton imprimante), format A4.</li>
      <li>Choisis <b>100 %</b>, pas « ajuster à la page ». Vérifie l’échelle avec la page suivante.</li>
      <li>Découpe chaque bande suivant les pointillés, en gardant la languette à gauche pour la tenir.</li>
    </ol>
    <h2>Pour choisir ta largeur</h2>
    <ul>${SIZES.map((s) => `<li><b>${s.id}</b> : ${s.label}</li>`).join('')}</ul>
    <h2>Pour essayer</h2>
    <ol>
      <li>Tiens la bande devant tes yeux, de face, devant un miroir.</li>
      <li>Aligne les deux petites croix sur tes pupilles.</li>
      <li>Compare deux ou trois formes : regarde ce que chacune change à ton visage, à ton regard.</li>
    </ol>
    <p class="small">Sur du papier ordinaire, le kit marche aussi pour comparer les formes sur une photo imprimée, mais tu ne verras pas à travers.</p>
  `);
}

const glassesCount = () => SHAPES.length;

function sizePages(size: (typeof SIZES)[number]): string {
  const perPage = 4;
  const pages: string[] = [];
  for (let i = 0; i < SHAPES.length; i += perPage) {
    const chunk = SHAPES.slice(i, i + perPage);
    pages.push(page(chunk.map((s, j) => strip(s, size, i + j)).join(''), 'strips'));
  }
  return pages.join('');
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Kit d’essayage</title>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #fff; }
  .page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 10mm 10mm; page-break-after: always; font-family: Helvetica, Arial, sans-serif; color: #111; position: relative; overflow: hidden; }
  .page h1 { font-size: 22pt; margin: 6mm 0 4mm; }
  .page h2 { font-size: 12pt; margin: 8mm 0 2mm; }
  .page p, .page li { font-size: 10.5pt; line-height: 1.5; max-width: 150mm; }
  .page .small { font-size: 9pt; color: #555; }
  .strips { display: flex; flex-direction: column; gap: 4mm; padding-top: 10mm; }
  .strip { display: block; }
</style></head><body>
${guide()}
${calibration()}
${SIZES.map(sizePages).join('')}
</body></html>`;

await mkdir('kit', { recursive: true });
await writeFile('kit/kit.html', html);
console.log('kit/kit.html écrit :', SHAPES.length, 'formes x', SIZES.length, 'largeurs');

if (process.argv.includes('--pdf')) {
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.goto('file://' + process.cwd() + '/kit/kit.html');
  await p.pdf({ path: 'kit/kit.pdf', preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('kit/kit.pdf écrit');
}
