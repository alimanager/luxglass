/**
 * Printable try-on kit, in the format of a swatch book: long transparent strips, one frame each,
 * bound by a ring at one end. Every frame is drawn at real size (1 mm = 1 mm) with its material.
 * Print on A4 transparency film at 100 %, cut the strips, punch the hole, put them on a ring.
 *
 *   npm run kit            writes kit/kit.html
 *   npm run kit -- --pdf   also writes kit/kit.pdf with headless Chrome
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { SHAPES, type Shape } from './kit-shapes';
import { drawFrame, fmt } from './kit-render';
import { faceGuidePage, iconsPage, mapPage, SIZES, code, page } from './kit-faces';

/** strip, mm: long enough to hold at one end and bind at the other, tall enough to cover brows to lip */
const STRIP_W = 230;
const STRIP_H = 64;
const HOLE_X = STRIP_W - 9;
const HOLE_R = 3;
const FRAME_LEFT = 12;

function strip(shape: Shape, size: (typeof SIZES)[number], index: number): string {
  const d = drawFrame(shape, size.scale);
  const cx = FRAME_LEFT + d.width / 2;
  const cy = STRIP_H / 2 - d.centerY;
  const labelX = HOLE_X - HOLE_R - 4;
  return `
  <svg class="strip" xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}mm" height="${STRIP_H}mm" viewBox="0 0 ${STRIP_W} ${STRIP_H}">
    <defs>${d.defs}</defs>
    <rect x="0.15" y="0.15" width="${STRIP_W - 0.3}" height="${STRIP_H - 0.3}" rx="1.6" fill="none" stroke="#b9b9b9" stroke-width="0.18" stroke-dasharray="1.4 1"/>
    <circle cx="${HOLE_X}" cy="${STRIP_H / 2}" r="${HOLE_R}" fill="none" stroke="#9a9a9a" stroke-width="0.2"/>
    <path d="M${HOLE_X - 1} ${STRIP_H / 2}h2M${HOLE_X} ${STRIP_H / 2 - 1}v2" stroke="#9a9a9a" stroke-width="0.15"/>
    <g font-family="Helvetica, Arial, sans-serif" fill="#8d8d8d" text-anchor="end">
      <text x="${labelX}" y="${STRIP_H / 2 - 1.2}" font-size="3.4" font-weight="700" fill="#6f6f6f">${code(size.id, index)}</text>
      <text x="${labelX}" y="${STRIP_H / 2 + 3}" font-size="2.4">${shape.name}</text>
      <text x="${labelX}" y="${STRIP_H / 2 + 6.2}" font-size="2.2">${shape.era}, ${shape.mood.join(' et ')}</text>
      <text x="${labelX}" y="${STRIP_H / 2 + 9.4}" font-size="2.2">${d.marking}  ${Math.round(d.width)} mm</text>
    </g>
    <g transform="translate(${fmt(cx)} ${fmt(cy)})">${d.svg}</g>
  </svg>`;
}

function calibration(): string {
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
        <ul>${SIZES.map((s) => `<li><b>${s.id}</b> : ${s.label}.</li>`).join('')}</ul>
        <p class="small">Mesure à la règle, de tempe à tempe, à hauteur des yeux. Entre deux tailles, prends la plus petite pour les
        montures épaisses, la plus grande pour les fines.</p>
      </div>
    </div>
  `);
}

function guide(size: (typeof SIZES)[number]): string {
  return page(`
    <div class="cols">
      <div>
        <h1>Kit d’essayage</h1>
        <p>${SHAPES.length} montures qui ont traversé le siècle, de 1910 à aujourd’hui, à leur taille réelle et en trois largeurs.
        Même visage, autre impression : en quelques secondes tu vois ce que chaque forme change à ton regard, et ce qu’elle
        raconte de toi, avant d’essayer en magasin.</p>
        <h2>Fabriquer ton carnet</h2>
        <ol>
          <li>Ce fichier est en taille ${size.id} (${size.label}). Imprime ses pages de bandes sur du <b>film transparent A4</b> adapté à ton imprimante (jet d’encre ou laser), à 100 %.</li>
          <li>Laisse sécher l’encre dix minutes, puis découpe chaque bande en suivant les pointillés.</li>
          <li>Perce le rond à droite de chaque bande avec une perforatrice simple.</li>
          <li>Enfile toutes les bandes sur un anneau de reliure de 25 à 30 mm.</li>
        </ol>
      </div>
      <div>
        <h2>Essayer</h2>
        <ol>
          <li>Tiens le carnet par l’anneau d’une main. De l’autre, pince la bande du dessus par son bout libre.</li>
          <li>Plaque-la à plat devant tes yeux, face à un miroir ou à un ami, les pupilles au centre des verres.</li>
          <li>Passe à la bande suivante et compare : quelle forme te donne l’air sûr de toi, créatif, sérieux ?</li>
          <li>Note les deux ou trois codes qui te vont. Commence par ceux que la page « Par forme de visage » te conseille.</li>
        </ol>
        <h2>Aller plus loin</h2>
        <p>L’application mesure ton visage, te dit quelles montures te vont et pourquoi, et te montre en photo réaliste avec
        de vraies montures, avec les meilleurs prix pour les acheter.</p>
      </div>
    </div>
  `);
}

function sizePages(size: (typeof SIZES)[number]): string {
  const perPage = 3;
  const pages: string[] = [];
  for (let i = 0; i < SHAPES.length; i += perPage) {
    const chunk = SHAPES.slice(i, i + perPage);
    pages.push(
      page(`<p class="runner">Taille ${size.id}, ${size.label}</p>` + chunk.map((s, j) => strip(s, size, i + j)).join(''), 'strips')
    );
  }
  return pages.join('');
}

const html = (size: (typeof SIZES)[number]) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Kit d’essayage, taille ${size.id}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; background: #fff; }
  .page { width: 297mm; height: 210mm; box-sizing: border-box; padding: 12mm 14mm; page-break-after: always; font-family: Helvetica, Arial, sans-serif; color: #111; position: relative; overflow: hidden; }
  .page h1 { font-size: 22pt; margin: 0 0 4mm; letter-spacing: -0.01em; }
  .page h2 { font-size: 12pt; margin: 6mm 0 2mm; }
  .page p, .page li { font-size: 10.5pt; line-height: 1.5; max-width: 120mm; }
  .page .small { font-size: 9pt; color: #555; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; }
  .cols3 { display: grid; grid-template-columns: 1.15fr 1fr 0.8fr; gap: 8mm; }
  .cols3 h2 { margin-top: 3mm; }
  table.icons td, table.icons th { padding: 1.1mm 4mm 1.1mm 0; font-size: 9pt; }
  table.icons td:last-child { max-width: 150mm; }
  .page.strips { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.5mm; padding: 6mm 14mm; }
  .strips .runner { position: absolute; top: 1.5mm; left: 14mm; margin: 0; font-size: 8pt; color: #999; }
  .strip { display: block; }
  table { border-collapse: collapse; font-size: 9.5pt; }
  td, th { text-align: left; padding: 1.6mm 3mm 1.6mm 0; vertical-align: top; border-bottom: 0.2mm solid #ddd; }
  th { font-weight: 700; }
</style></head><body>
${guide(size)}
${calibration()}
${iconsPage()}
${faceGuidePage()}
${mapPage()}
${sizePages(size)}
</body></html>`;

await mkdir('kit', { recursive: true });
for (const size of SIZES) await writeFile(`kit/kit-${size.id}.html`, html(size));
console.log('kit écrit :', SHAPES.length, 'montures, un fichier par largeur (S, M, L)');

if (process.argv.includes('--pdf')) {
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  for (const size of SIZES) {
    await p.goto('file://' + process.cwd() + `/kit/kit-${size.id}.html`);
    await p.pdf({ path: `kit/kit-${size.id}.pdf`, preferCSSPageSize: true, printBackground: true });
  }
  await browser.close();
  console.log('kit/kit-S.pdf, kit/kit-M.pdf, kit/kit-L.pdf écrits');
}
