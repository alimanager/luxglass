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
import { countPages, document, pageRange, printerPage, publish, scalePage, stripPages } from './kit-layout';
import { atlasPages, catalogueJson, faceGuidePage, iconsPage, mapPage, SIZES, code, page } from './kit-faces';
import { coverPage, sleevePage } from './kit-cover';

function kitStrip(shape: Shape, size: (typeof SIZES)[number], index: number) {
  const d = drawFrame(shape, size.scale);
  return { d, lines: [code(size.id, index), shape.name, `${shape.era}, ${shape.mood.join(' et ')}`, `${d.marking}  ${Math.round(d.width)} mm`] };
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
          <li>Ce fichier est en taille ${size.id} (${size.label}). Imprime ses planches de bandes sur du <b>film transparent A4</b> adapté à ton imprimante (jet d’encre ou laser), à 100 % : voir « Avant d’imprimer ».</li>
          <li>Laisse sécher l’encre dix minutes, puis coupe chaque planche d’un repère de coupe à l’autre, au cutter et à la règle.</li>
          <li>Perce le rond à droite de chaque bande avec une perforatrice simple.</li>
          <li>Enfile toutes les bandes sur un anneau de reliure de 25 à 30 mm, puis range le carnet dans son étui (dernière page).</li>
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

const html = (size: (typeof SIZES)[number]) => {
  const reading = [guide(size), scalePage(SIZES), iconsPage(), faceGuidePage(), mapPage(), atlasPages()].join('');
  const strips = sizePages(size);
  const cover = coverPage({ size, count: SHAPES.length, shapes: ['rond-metal', 'browline', 'oeil-de-chat', 'aviateur', 'panto-acetate'].map((id) => SHAPES.find((s) => s.id === id)!) });
  const sleeve = sleevePage({ size, count: SHAPES.length });
  // cover and printer note first, then the reading pages, the sheets of strips and the sleeve
  const first = countPages(cover) + 1;
  const nRead = countPages(reading);
  const nStrips = countPages(strips);
  const note = printerPage({
    paper: `${pageRange(1, first + nRead)} (couverture, conseils, échelle, guides)`,
    film: pageRange(first + 1 + nRead, nStrips),
    card: `${pageRange(first + 1 + nRead + nStrips, countPages(sleeve))} (étui)`,
    strips: SHAPES.length,
  });
  return document(`Kit d’essayage, taille ${size.id}`, cover + note + reading + strips + sleeve);
};

await writeFile('src/data/gabarits.json', JSON.stringify(catalogueJson(), null, 1) + '\n');
console.log('src/data/gabarits.json écrit,', SHAPES.length, 'montures au kit');
await publish(SIZES.map((s) => ({ name: `kit-${s.id}`, html: html(s) })), process.argv.includes('--pdf'));
