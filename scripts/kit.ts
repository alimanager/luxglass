/**
 * Printable try-on kit: every frame style drawn at real size (1 mm = 1 mm) on strips to cut out.
 * Print on A4 transparency film at 100 %, hold a strip in front of a face, and the frame sits
 * on it the way it will in the app. Three width classes (S, M, L) cover different faces.
 *
 *   npm run kit            writes kit/kit.html (open it, or print it to PDF at 100 %)
 *   npm run kit -- --pdf   also writes kit/kit.pdf with headless Chrome
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { glasses } from '../src/data/mockData';
import { lensOutline, offsetOutline } from '../src/three/buildFrame';
import { frameWidth, sizeMarking, specForGlasses, type FrameSpec } from '../src/three/frameSpec';

type V2 = [number, number];

const INK = '#15110f';
const SIZES = [
  { id: 'S', scale: 0.94, label: 'S, visage étroit (largeur mesurée sous 128 mm)' },
  { id: 'M', scale: 1, label: 'M, visage moyen (128 à 140 mm)' },
  { id: 'L', scale: 1.06, label: 'L, visage large (au-dessus de 140 mm)' },
];
/** pupillary distance used for the alignment marks */
const PD = 63;

const mirrorX = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y] as V2).reverse();
const fmt = (n: number) => n.toFixed(2);
/** SVG path from points, y flipped (SVG grows downwards) */
const path = (pts: V2[]) => 'M' + pts.map(([x, y]) => `${fmt(x)} ${fmt(-y)}`).join('L') + 'Z';
const shift = (pts: V2[], dx: number): V2[] => pts.map(([x, y]) => [x + dx, y] as V2);

function scaled(spec: FrameSpec, k: number): FrameSpec {
  // sizes are whole millimetres, like the numbers printed inside a real temple
  const r = Math.round;
  return { ...spec, lens: { ...spec.lens, w: r(spec.lens.w * k), h: r(spec.lens.h * k), lift: spec.lens.lift * k, drop: spec.lens.drop * k }, bridge: r(spec.bridge * k) };
}

/** One frame, centred on (0,0) at the bridge, in millimetres. */
function frameSvg(spec: FrameSpec): string {
  const half = spec.bridge / 2;
  const lens = lensOutline(spec.lens);
  const out: string[] = [];
  const acetate = spec.kind === 'acetate';

  for (const side of [1, -1] as const) {
    const cx = side * (half + spec.lens.w / 2);
    const local = side === 1 ? lens : mirrorX(lens);
    const inner = shift(local, cx);
    out.push(`<path d="${path(inner)}" fill="${INK}" fill-opacity="0.07"/>`);
    if (acetate) {
      const outer = shift(offsetOutline(local, spec.rim), cx);
      out.push(`<path d="${path(outer)}${path([...inner].reverse())}" fill="${INK}" fill-rule="evenodd"/>`);
    } else {
      const wire = shift(offsetOutline(local, 0.5), cx);
      out.push(`<path d="${path(wire)}" fill="none" stroke="${INK}" stroke-width="${fmt(Math.max(0.7, spec.rim * 2))}" stroke-linejoin="round"/>`);
    }
    if (spec.kind === 'browline') {
      const upper = shift(offsetOutline(local, 5.5), cx)
        .filter(([, y]) => y > spec.lens.h * 0.08)
        .sort((p, q) => p[0] - q[0]);
      const lower = shift(local, cx)
        .filter(([, y]) => y > spec.lens.h * 0.08)
        .sort((p, q) => q[0] - p[0])
        .map(([x, y]) => [x, y - 0.6] as V2);
      out.push(`<path d="${path([...upper, ...lower])}" fill="${INK}"/>`);
    }
    // hinge stub: where the temple leaves the front, on the rim at about 55 % of the lens height
    const top = Math.max(...local.map((p) => p[1]));
    const hy = top * 0.55;
    const edge = inner
      .filter(([, y]) => Math.abs(y - hy) < spec.lens.h * 0.06)
      .reduce((m, [x]) => (side * x > side * m ? x : m), side * -1e9);
    const hingeX = edge + side * (acetate ? spec.rim - 1 : 0);
    out.push(`<rect x="${fmt(Math.min(hingeX, hingeX + side * 9))}" y="${fmt(-hy - 1.4)}" width="9" height="2.8" rx="1.2" fill="${INK}"/>`);
  }

  // bridge
  const h = spec.lens.h;
  if (acetate || spec.kind === 'browline') {
    const top = h * 0.26;
    const bottom = h * (acetate ? 0.1 : 0.14);
    const r = spec.rim * (acetate ? 1 : 0);
    out.push(`<rect x="${fmt(-half - r)}" y="${fmt(-top)}" width="${fmt(spec.bridge + r * 2)}" height="${fmt(top - bottom)}" fill="${INK}"/>`);
  } else {
    const arc = (y: number, lift: number) =>
      `<path d="M${fmt(-half - 0.5)} ${fmt(-y)}Q0 ${fmt(-y - lift)} ${fmt(half + 0.5)} ${fmt(-y)}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
    out.push(arc(h * 0.14, h * 0.18));
    if (spec.doubleBridge) out.push(`<path d="M${fmt(-half - 0.5)} ${fmt(-h * 0.36)}H${fmt(half + 0.5)}" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`);
  }

  // pupil marks: cross-hairs at the average pupillary distance
  const py = -h * 0.05;
  for (const x of [-PD / 2, PD / 2]) {
    out.push(
      `<g stroke="${INK}" stroke-width="0.25" opacity="0.8"><path d="M${fmt(x - 2.4)} ${fmt(py)}h4.8M${fmt(x)} ${fmt(py - 2.4)}v4.8"/></g>`
    );
  }
  return out.join('');
}

const CELL_W = 190;
const CELL_H = 66;
const TAB_W = 26;

function strip(style: string, size: (typeof SIZES)[number], index: number): string {
  const base = specForGlasses({ style, color: 'Noir', material: style === 'Aviateur' || style === 'Rond' ? 'Métal' : 'Acétate' });
  const spec = scaled(base, size.scale);
  const width = Math.round(frameWidth(spec));
  const x = TAB_W + (CELL_W - TAB_W) / 2;
  const y = CELL_H / 2 + 1;
  return `
  <svg class="strip" xmlns="http://www.w3.org/2000/svg" width="${CELL_W}mm" height="${CELL_H}mm" viewBox="0 0 ${CELL_W} ${CELL_H}">
    <rect x="0.4" y="0.4" width="${CELL_W - 0.8}" height="${CELL_H - 0.8}" rx="2.5" fill="none" stroke="#999" stroke-width="0.2" stroke-dasharray="1.2 1.2"/>
    <line x1="${TAB_W}" y1="1" x2="${TAB_W}" y2="${CELL_H - 1}" stroke="#bbb" stroke-width="0.15" stroke-dasharray="0.8 1.2"/>
    <g font-family="Helvetica, Arial, sans-serif" fill="#222">
      <text x="4" y="12" font-size="9" font-weight="700">${size.id}${index + 1}</text>
      <text x="4" y="21" font-size="3.1">${style}</text>
      <text x="4" y="26" font-size="2.6" fill="#666">${sizeMarking(spec)}</text>
      <text x="4" y="31" font-size="2.6" fill="#666">${width} mm</text>
      <text x="4" y="${CELL_H - 6}" font-size="2.4" fill="#888">Tiens ici</text>
    </g>
    <g transform="translate(${fmt(x)} ${fmt(y)})">${frameSvg(spec)}</g>
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

const styles = Array.from(new Set(glasses.map((g) => g.style)));
const glassesCount = () => styles.length;

function sizePages(size: (typeof SIZES)[number]): string {
  const perPage = 4;
  const pages: string[] = [];
  for (let i = 0; i < styles.length; i += perPage) {
    const chunk = styles.slice(i, i + perPage);
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
console.log('kit/kit.html écrit :', styles.length, 'formes x', SIZES.length, 'largeurs');

if (process.argv.includes('--pdf')) {
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.goto('file://' + process.cwd() + '/kit/kit.html');
  await p.pdf({ path: 'kit/kit.pdf', preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('kit/kit.pdf écrit');
}
