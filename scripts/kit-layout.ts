/**
 * Shared layout of the printable kits: the strip (frame on the left, binding hole on the right),
 * the A4 landscape page, the sheets of strips with crop marks, the printer note, the scale check,
 * and the HTML to PDF step.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fmt, type Drawn } from './kit-render';

/** strip, mm: long enough to hold at one end and bind at the other, tall enough to cover brows to lip */
export const STRIP_W = 230;
export const STRIP_H = 64;
const HOLE_X = STRIP_W - 9;
const HOLE_R = 3;
const FRAME_LEFT = 12;
const LABEL_X = HOLE_X - HOLE_R - 4;

/** A4 landscape and where the strips sit on it: butted together, so neighbours share one cut */
export const PAGE_W = 297;
export const PAGE_H = 210;
const SHEET_X = (PAGE_W - STRIP_W) / 2;
const SHEET_Y = (PAGE_H - 3 * STRIP_H) / 2;

/** strips that do not fit (frame too wide for its labels, or too tall for the strip), filled by strip() */
export const overflows: string[] = [];

/** rough width of a Helvetica line, mm */
const textWidth = (t: string, size: number, bold = false) => t.length * size * (bold ? 0.58 : 0.52);

/** label lines of a strip: the first in bold, then up to three small lines */
function labels(lines: string[]) {
  const y0 = STRIP_H / 2 - 1.2 - (lines.length - 1) * 1.6;
  return lines.map((t, i) => {
    const size = i === 0 ? 3.4 : i === 1 ? 2.4 : 2.2;
    const y = i === 0 ? y0 : y0 + 1.2 + i * 3.2;
    return { t, size, y, bold: i === 0, w: textWidth(t, size, i === 0) };
  });
}

/** inner content of one strip, in strip coordinates (0..STRIP_W, 0..STRIP_H) */
function stripBody(d: Drawn, lines: string[]): string {
  const cx = FRAME_LEFT + d.width / 2;
  const cy = STRIP_H / 2 - d.centerY;
  const ls = labels(lines);
  const room = LABEL_X - Math.max(...ls.map((l) => l.w)) - (FRAME_LEFT + d.width);
  if (room < 4) overflows.push(`${lines[0]} ${lines[1] ?? ''} : monture trop large pour ses étiquettes (${room.toFixed(1)} mm)`);
  if (d.height > STRIP_H - 3) overflows.push(`${lines[0]} ${lines[1] ?? ''} : monture trop haute (${d.height.toFixed(1)} mm)`);
  const text = ls
    .map((l) =>
      l.bold
        ? `<text x="${LABEL_X}" y="${fmt(l.y)}" font-size="${l.size}" font-weight="700" fill="#6f6f6f">${l.t}</text>`
        : `<text x="${LABEL_X}" y="${fmt(l.y)}" font-size="${l.size}">${l.t}</text>`
    )
    .join('');
  return `
    <defs>${d.defs}</defs>
    <rect x="0" y="0" width="${STRIP_W}" height="${STRIP_H}" fill="none" stroke="#bdbdbd" stroke-width="0.12" stroke-dasharray="1.4 1"/>
    <circle cx="${HOLE_X}" cy="${STRIP_H / 2}" r="${HOLE_R}" fill="none" stroke="#9a9a9a" stroke-width="0.2"/>
    <path d="M${HOLE_X - 1} ${STRIP_H / 2}h2M${HOLE_X} ${STRIP_H / 2 - 1}v2" stroke="#9a9a9a" stroke-width="0.15"/>
    <g font-family="Helvetica, Arial, sans-serif" fill="#8d8d8d" text-anchor="end">${text}</g>
    <g transform="translate(${fmt(cx)} ${fmt(cy)})">${d.svg}</g>`;
}

/** one strip as a standalone SVG, the frame and up to four label lines (the first in bold) */
export function strip(d: Drawn, lines: string[]): string {
  return `
  <svg class="strip" xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}mm" height="${STRIP_H}mm" viewBox="0 0 ${STRIP_W} ${STRIP_H}">${stripBody(d, lines)}</svg>`;
}

export function page(content: string, cls = '') {
  return `<section class="page ${cls}">${content}</section>`;
}

/** crop marks for the strips of one sheet: every horizontal cut, and both ends, outside the strips */
function cropMarks(n: number): string {
  const out: string[] = [];
  const x0 = SHEET_X;
  const x1 = SHEET_X + STRIP_W;
  const off = 2.5;
  const len = 7;
  for (let i = 0; i <= n; i++) {
    const y = SHEET_Y + i * STRIP_H;
    out.push(`M${fmt(x0 - off - len)} ${fmt(y)}h${len}M${fmt(x1 + off)} ${fmt(y)}h${len}`);
  }
  const yb = SHEET_Y + n * STRIP_H;
  for (const x of [x0, x1]) out.push(`M${fmt(x)} ${fmt(SHEET_Y - off - 4)}v4M${fmt(x)} ${fmt(yb + off)}v4`);
  return `<path d="${out.join('')}" stroke="#000" stroke-width="0.2" fill="none"/>`;
}

/** 50 mm bar printed on every sheet of strips: the scale can be checked on the film itself */
function scaleBar(y: number): string {
  const x = SHEET_X + 8;
  const ticks = Array.from({ length: 11 }, (_, i) => `M${fmt(x + i * 5)} ${fmt(y)}v${i % 5 === 0 ? 2.2 : 1.2}`).join('');
  return `<path d="M${fmt(x)} ${fmt(y)}h50${ticks}" stroke="#555" stroke-width="0.2" fill="none"/>
    <text x="${fmt(x + 52)}" y="${fmt(y + 2)}" font-size="2.3" fill="#777">50 mm : si ce trait ne mesure pas 5 cm à la règle, l’impression n’est pas à 100 %</text>`;
}

/** sheets of strips, three per A4 landscape page, butted together, with crop marks and a running head */
export function stripPages(strips: string[], runner: string): string;
export function stripPages(strips: { d: Drawn; lines: string[] }[], runner: string): string;
export function stripPages(strips: (string | { d: Drawn; lines: string[] })[], runner: string): string {
  const out: string[] = [];
  const total = Math.ceil(strips.length / 3);
  for (let i = 0; i < strips.length; i += 3) {
    const group = strips.slice(i, i + 3);
    const body = group
      .map((s, j) => {
        const y = SHEET_Y + j * STRIP_H;
        if (typeof s === 'string') {
          // a standalone strip SVG: place it as a nested viewport
          return s.replace('<svg class="strip"', `<svg x="${SHEET_X}" y="${fmt(y)}" width="${STRIP_W}" height="${STRIP_H}" class="strip-in"`).replace(/ width="230mm" height="64mm"/, '');
        }
        return `<svg x="${SHEET_X}" y="${fmt(y)}" width="${STRIP_W}" height="${STRIP_H}" viewBox="0 0 ${STRIP_W} ${STRIP_H}">${stripBody(s.d, s.lines)}</svg>`;
      })
      .join('');
    const sheet = i / 3 + 1;
    out.push(
      page(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${PAGE_H}mm" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Helvetica, Arial, sans-serif">
          <text x="${SHEET_X + 8}" y="5.6" font-size="2.6" fill="#999">${runner}, planche ${sheet} sur ${total}. Imprimer sur film transparent, à 100 %.</text>
          ${body}
          ${cropMarks(group.length)}
          ${scaleBar(SHEET_Y + group.length * STRIP_H + 3)}
        </svg>`,
        'strips'
      )
    );
  }
  return out.join('');
}

/** number of A4 pages in a chunk of HTML made of page() sections */
export const countPages = (html: string) => (html.match(/<section class="page/g) ?? []).length;

export const pageRange = (from: number, count: number) => (count <= 1 ? `page ${from}` : `pages ${from} à ${from + count - 1}`);

/** what to print on what: printed before anything else */
export function printerPage(o: { film: string; paper: string; card?: string; strips: number }): string {
  return page(`
    <div class="cols">
      <div>
        <h1>Avant d’imprimer</h1>
        <p>Ce fichier mélange des pages à lire et des planches à découper. Imprime chaque partie sur le bon support.</p>
        <table class="print">
          <tr><th>Papier ordinaire</th><td>${o.paper}</td></tr>
          <tr><th>Film transparent A4</th><td>${o.film} (${o.strips} bandes)</td></tr>
          ${o.card ? `<tr><th>Carte 250 à 300 g/m²</th><td>${o.card}</td></tr>` : ''}
        </table>
        <h2>Le film</h2>
        <ul>
          <li><b>Jet d’encre</b> : film transparent « pour jet d’encre », avec une face traitée (légèrement rugueuse ou collante au doigt). Imprime sur cette face.</li>
          <li><b>Laser</b> : uniquement un film « pour laser » ou « pour copieur », qui résiste à la chaleur. Un film jet d’encre fondrait dans l’imprimante.</li>
          <li>Épaisseur conseillée : 100 à 125 microns, assez rigide pour tenir à plat devant les yeux.</li>
        </ul>
      </div>
      <div>
        <h2>Réglages de l’imprimante</h2>
        <ul>
          <li><b>Échelle 100 %</b>, « taille réelle ». Jamais « ajuster à la page » ni « réduire » : un réglage de 97 % suffit à fausser une monture de 4 mm.</li>
          <li>Format A4, orientation <b>paysage</b>, sans impression « sans marges ».</li>
          <li><b>Couleur</b>, qualité élevée ; type de support « transparent » ou « film » s’il existe.</li>
          <li>Imprime d’abord la page « Vérifie l’échelle » sur papier et contrôle-la avec une carte bancaire. Chaque planche porte aussi un trait de 50 mm.</li>
        </ul>
        <h2>Découper</h2>
        <ul>
          <li>Laisse sécher l’encre dix minutes, sans toucher la face imprimée.</li>
          <li>Coupe au cutter et à la règle métallique, d’un repère de coupe à l’autre (les petits traits noirs autour de chaque planche). Les bandes sont accolées : une coupe sépare deux bandes.</li>
          <li>Perce le rond au bout de chaque bande avec une perforatrice simple (trou de 6 mm).</li>
        </ul>
        <p class="small">Sur le film, les couleurs paraissent plus claires et l’écaille laisse passer la lumière : c’est normal, seule la forme compte.
        Pour juger une couleur, glisse une feuille blanche derrière la bande.</p>
      </div>
    </div>
  `);
}

/** scale check: a credit card outline and a ruler, plus the pupil and face width rulers */
export function scalePage(sizes: { id: string; label: string }[]): string {
  const ticks: string[] = [];
  for (let mm = 0; mm <= 100; mm++) {
    const len = mm % 10 === 0 ? 6 : mm % 5 === 0 ? 4 : 2.4;
    ticks.push(`<line x1="${mm}" y1="0" x2="${mm}" y2="${len}" stroke="#111" stroke-width="0.2"/>`);
    if (mm % 10 === 0) ticks.push(`<text x="${mm}" y="10" font-size="3" text-anchor="middle">${mm}</text>`);
  }
  const pd: string[] = [];
  for (let mm = 50; mm <= 80; mm++) {
    const x = (mm - 50) * 2;
    pd.push(`<line x1="${x}" y1="0" x2="${x}" y2="${mm % 5 === 0 ? 6 : 3.2}" stroke="#111" stroke-width="0.2"/>`);
    if (mm % 5 === 0) pd.push(`<text x="${x}" y="10" font-size="3" text-anchor="middle">${mm}</text>`);
  }
  return page(`
    <div class="cols">
      <div>
        <h1>Vérifie l’échelle</h1>
        <p>Pose une carte bancaire sur le rectangle. Elle doit le recouvrir exactement. Sinon, ré-imprime à <b>100 %</b>
        (« taille réelle », jamais « ajuster à la page ») : une monture trop petite ou trop grande ne dit plus rien de ton visage.</p>
        <svg width="110mm" height="74mm" viewBox="0 0 110 74" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
          <rect x="2" y="2" width="85.6" height="53.98" rx="3.2" fill="none" stroke="#111" stroke-width="0.4"/>
          <text x="44.8" y="31" font-size="4" text-anchor="middle">Carte bancaire 85,6 × 54 mm</text>
          <g transform="translate(2 60)">${ticks.join('')}</g>
        </svg>
      </div>
      <div>
        <h2>Écart de tes pupilles</h2>
        <p>Devant un miroir, regarde droit devant toi, pose la règle sous tes yeux et lis la graduation sous chaque pupille.
        L’application le mesure aussi, au millimètre près.</p>
        <svg width="70mm" height="16mm" viewBox="0 0 70 16" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
          <g transform="translate(4 2)">${pd.join('')}</g>
        </svg>
        <h2>Ta largeur de visage</h2>
        <ul>${sizes.map((s) => `<li><b>${s.id}</b> : ${s.label}.</li>`).join('')}</ul>
        <p class="small">Mesure à la règle, de tempe à tempe, à hauteur des yeux. Entre deux tailles, prends la plus petite pour les
        montures épaisses, la plus grande pour les fines.</p>
        <h2>Lire une bande</h2>
        <p class="small">Sous le nom, « 47□22 » donne la largeur d’un verre et l’écart entre les verres (le pont), comme sur la branche
        d’une vraie monture ; le dernier nombre est la largeur totale de la face. Compare-les à tes lunettes actuelles.</p>
      </div>
    </div>
  `);
}

export const CSS = `
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; background: #fff; }
  .page { width: 297mm; height: 210mm; box-sizing: border-box; padding: 12mm 14mm; page-break-after: always; font-family: Helvetica, Arial, sans-serif; color: #111; position: relative; overflow: hidden; }
  .page h1 { font-size: 22pt; margin: 0 0 4mm; letter-spacing: -0.01em; }
  .page h2 { font-size: 12pt; margin: 6mm 0 2mm; }
  .page p, .page li { font-size: 10.5pt; line-height: 1.5; max-width: 120mm; }
  .page .small { font-size: 9pt; color: #555; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; }
  .grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm 6mm; }
  .grid5 h2 { font-size: 10pt; margin: 3mm 0 1mm; }
  .grid5 ol { margin: 0; padding-left: 5mm; }
  .grid5 li { font-size: 8pt; line-height: 1.35; }
  .cols3 { display: grid; grid-template-columns: 1.15fr 1fr 0.8fr; gap: 8mm; }
  .cols3 h2 { margin-top: 3mm; }
  table.icons td, table.icons th { padding: 1mm 3mm 1mm 0; font-size: 8.4pt; line-height: 1.3; }
  table.icons td:last-child { max-width: 150mm; }
  table.print th { width: 42mm; }
  table.print td, table.print th { font-size: 10pt; }
  .page ul li, .page ol li { margin-bottom: 1mm; }
  .page.strips { padding: 0; }
  .page.strips > svg { display: block; }
  .page.bare { padding: 0; }
  .page.bare > svg { display: block; }
  .strip { display: block; }
  table { border-collapse: collapse; font-size: 9.5pt; }
  td, th { text-align: left; padding: 1.6mm 3mm 1.6mm 0; vertical-align: top; border-bottom: 0.2mm solid #ddd; }
  th { font-weight: 700; }
`;

export function document(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** writes kit/<name>.html for each document, and the PDFs with headless Chrome when asked */
export async function publish(docs: { name: string; html: string }[], pdf: boolean) {
  if (overflows.length) console.warn('Bandes à revoir :\n  ' + [...new Set(overflows)].join('\n  '));
  await mkdir('kit', { recursive: true });
  for (const d of docs) await writeFile(`kit/${d.name}.html`, d.html);
  if (!pdf) return;
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  for (const d of docs) {
    await p.goto('file://' + process.cwd() + `/kit/${d.name}.html`);
    await p.pdf({ path: `kit/${d.name}.pdf`, preferCSSPageSize: true, printBackground: true });
  }
  await browser.close();
  console.log(docs.map((d) => `kit/${d.name}.pdf`).join(', '), 'écrits');
}
