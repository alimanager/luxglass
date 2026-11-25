/**
 * Printable try-on kit, in the format of a swatch book: long transparent strips, one frame each,
 * bound by a ring at one end. Every frame is drawn at real size (1 mm = 1 mm) with its material.
 * Print on A4 transparency film at 100 %, cut the strips, punch the hole, put them on a ring.
 *
 *   npm run kit            writes kit/kit.html
 *   npm run kit -- --pdf   also writes kit/kit.pdf with headless Chrome
 */
import { writeFile } from 'node:fs/promises';
import { SHAPES, type Shape } from './kit-shapes';
import { drawFrame } from './kit-render';
import { document, publish, strip, stripPages } from './kit-layout';
import { atlasPages, catalogueJson, faceGuidePage, iconsPage, mapPage, SIZES, code, page } from './kit-faces';

function kitStrip(shape: Shape, size: (typeof SIZES)[number], index: number): string {
  const d = drawFrame(shape, size.scale);
  return strip(d, [code(size.id, index), shape.name, `${shape.era}, ${shape.mood.join(' et ')}`, `${d.marking}  ${Math.round(d.width)} mm`]);
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
  return stripPages(SHAPES.map((s, i) => kitStrip(s, size, i)), `Taille ${size.id}, ${size.label}`);
}

const html = (size: (typeof SIZES)[number]) =>
  document(`Kit d’essayage, taille ${size.id}`, `
${guide(size)}
${calibration()}
${iconsPage()}
${faceGuidePage()}
${mapPage()}
${atlasPages()}
${sizePages(size)}
`);

await writeFile('src/data/gabarits.json', JSON.stringify(catalogueJson(), null, 1) + '\n');
console.log('src/data/gabarits.json écrit,', SHAPES.length, 'montures au kit');
await publish(SIZES.map((s) => ({ name: `kit-${s.id}`, html: html(s) })), process.argv.includes('--pdf'));
