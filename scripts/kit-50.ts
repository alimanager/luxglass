/**
 * The 50 silhouettes every eyewear catalogue should know, as kit strips in the format of the
 * reference video. Each one is a combination of facets (form, construction, size, finish), or a
 * one-piece lens. Brand models are named by their generic silhouette.
 *
 *   npm run kit:50            writes kit/kit-50-S.html, -M, -L
 *   npm run kit:50 -- --pdf   and the PDFs
 */
import { make, type Mono, type Shape, type Spec, type V2 } from './kit-shapes';
import { drawFrame, drawMono, type Drawn } from './kit-render';
import { countPages, document, page, pageRange, printerPage, publish, scalePage, stripPages } from './kit-layout';
import { SIZES } from './kit-faces';

type Entry = { group: string; name: string; note: string } & ({ spec: Spec } | { mono: Mono });

const s = (name: string, note: string, spec: Spec) => ({ name, note, spec });
const m = (name: string, note: string, mono: Mono) => ({ name, note, mono });

// one-piece lenses: right halves from the top centre round to the bottom centre
const SHIELD: V2[] = [[0, 22], [30, 23], [56, 20], [66, 10], [65, -6], [57, -20], [40, -26], [22, -24], [12, -16], [7, -8], [0, -6]];
const WRAP: V2[] = ([[0, 18], [28, 19], [52, 17], [68, 12], [72, 4], [68, -6], [56, -14], [38, -18], [20, -17], [11, -12], [6, -6], [0, -4]] as V2[]).map(([x, y]) => [x * 0.94, y] as V2);
const MASK: V2[] = ([[0, 26], [34, 28], [60, 24], [70, 12], [69, -8], [60, -24], [42, -31], [22, -28], [12, -19], [7, -10], [0, -8]] as V2[]).map(([x, y]) => [x, y * 0.86] as V2);
const VISOR: V2[] = [[0, 16], [36, 17], [62, 14], [70, 6], [66, -4], [52, -10], [30, -13], [16, -12], [9, -7], [0, -5]];

const GROUPS: { group: string; items: ReturnType<typeof s | typeof m>[] }[] = [
  {
    group: 'A. Rondes',
    items: [
      s('Rond', 'le cercle parfait en métal fin', { form: 'rond', construction: 'metal', finish: { metal: 'noir' }, wire: 1.2 }),
      s('Panto', 'haut aplati, bas arrondi', { form: 'panto', construction: 'acetate', finish: { acetate: 'ecaille', rivets: true }, gap: 22 }),
      s('Boston', 'rond qui s’élargit vers le haut', { form: 'boston', construction: 'acetate', finish: { acetate: 'miel' }, gap: 21 }),
      s('Windsor', 'petit rond cerclé d’un anneau d’acétate', { form: 'rond', construction: 'browline', size: 'fine', ring: true, bridge: 'wire-arch', bridgeTop: 9, gap: 21, finish: { acetate: 'ecaille', metal: 'or' } }),
      s('Rond ovale', 'entre le cercle et l’ovale', { form: 'rond-ovale', construction: 'acetate', finish: { acetate: 'noir' } }),
    ],
  },
  {
    group: 'B. Carrées et rectangulaires',
    items: [
      s('Carré', 'angles nets, acétate épais', { form: 'carre', construction: 'acetate', finish: { acetate: 'noir', rivets: true } }),
      s('Carré doux', 'carré aux coins très arrondis', { form: 'carre-doux', construction: 'acetate', finish: { acetate: 'ecaille' } }),
      s('Rectangle', 'plus large que haut', { form: 'rectangle', construction: 'acetate', finish: { acetate: 'brun' } }),
      s('Rectangle fin', 'verres bas, métal léger', { form: 'rectangle-fin', construction: 'metal', finish: { metal: 'argent' } }),
      s('D-frame', 'haut droit, bas arrondi', { form: 'd-frame', construction: 'acetate', finish: { acetate: 'ecaille-degrade' } }),
    ],
  },
  {
    group: 'C. Papillon et relevées',
    items: [
      s('Œil de chat', 'coins relevés vers les tempes', { form: 'oeil-de-chat', construction: 'acetate', finish: { acetate: 'ecaille' } }),
      s('Papillon', 'grands verres évasés', { form: 'papillon', construction: 'acetate', finish: { acetate: 'noir' } }),
      s('Arlequin', 'pointes très relevées', { form: 'arlequin', construction: 'acetate', finish: { acetate: 'noir', rivets: true } }),
      s('Ailée', 'œil de chat à ailes sculptées', { form: 'oeil-de-chat', construction: 'acetate', finish: { acetate: 'brun' }, rim: (x, y) => 3.2 + 5.2 * Math.max(0, Math.min(1, (x + 2) / 30)) ** 2 * Math.max(0, Math.min(1, (y + 4) / 18)) }),
      s('Upswept', 'rectangle au coin extérieur remonté', { form: 'upswept', construction: 'acetate', finish: { acetate: 'ecaille' } }),
    ],
  },
  {
    group: 'D. Aviateurs',
    items: [
      s('Aviateur', 'goutte métal, double pont', { form: 'aviateur', construction: 'metal', finish: { metal: 'or' }, wire: 0.95 }),
      s('Goutte', 'goutte plus profonde, pont simple', { form: 'goutte', construction: 'metal', bridge: 'wire-arch', bridgeTop: 12, finish: { metal: 'argent' } }),
      s('Navigator', 'aviateur aux verres carrés', { form: 'pilote-carre', construction: 'metal', finish: { metal: 'canon' }, wire: 1.1 }),
      s('Pilote carré', 'la forme pilote en acétate', { form: 'pilote-carre', construction: 'acetate', finish: { acetate: 'miel' } }),
      s('Double pont', 'barre haute sur un panto métal', { form: 'panto', construction: 'metal', bridge: 'double', bridgeTop: 16, gap: 18, finish: { metal: 'or' } }),
    ],
  },
  {
    group: 'E. Géométriques',
    items: [
      s('Hexagonale', 'six pans', { form: 'hexagone', construction: 'metal', finish: { metal: 'or' }, wire: 1.2, bridgeTop: 14 }),
      s('Octogonale', 'huit pans', { form: 'octogone', construction: 'metal', finish: { metal: 'argent' }, bridgeTop: 13 }),
      s('Pentagone', 'cinq pans, pointe en bas', { form: 'pentagone', construction: 'metal', finish: { metal: 'noir' }, bridgeTop: 14 }),
      s('Irrégulière', 'contour libre, asymétrique', { form: 'irreguliere', construction: 'acetate', finish: { acetate: 'miel' } }),
      s('Angulaire', 'arêtes vives', { form: 'angulaire', construction: 'acetate', finish: { acetate: 'noir' } }),
    ],
  },
  {
    group: 'F. Rétro',
    items: [
      s('Trapèze moulé', 'le trapèze acétate des années 1950', { form: 'trapeze', construction: 'acetate', finish: { acetate: 'noir', rivets: true } }),
      s('Browline à rivets', 'sourcil sur cerclage arrondi', { form: 'panto', construction: 'browline', gap: 21, finish: { acetate: 'ecaille', metal: 'argent', rivets: true } }),
      s('Browline', 'sourcil sur cerclage rectangle', { form: 'rectangle', construction: 'browline', finish: { acetate: 'noir', metal: 'or', rivets: true } }),
      s('Corne', 'haut épais façon corne, bas fin', { form: 'carre-doux', construction: 'acetate', finish: { acetate: 'brun' }, rim: (_x, y) => 2.6 + 5.4 * Math.max(0, Math.min(1, (y + 4) / 22)) }),
      s('Acétate épais', 'cerclage massif tout autour', { form: 'carre', construction: 'acetate', finish: { acetate: 'noir' }, rim: () => 6.5 }),
    ],
  },
  {
    group: 'G. Oversize',
    items: [
      s('Carré oversize', '', { form: 'carre-doux', construction: 'acetate', size: 'oversize', scale: 1.11, finish: { acetate: 'noir' } }),
      s('Rond oversize', '', { form: 'rond', construction: 'acetate', size: 'oversize', scale: 1.07, rim: () => 3.8, finish: { acetate: 'ecaille' } }),
      s('Papillon oversize', '', { form: 'papillon', construction: 'acetate', size: 'oversize', finish: { acetate: 'brun' }, scale: 1.04, rim: (x, y) => 3 + 1.8 * Math.max(0, Math.min(1, (x + 6) / 34)) * Math.max(0, Math.min(1, (y + 6) / 18)) }),
      s('Ovale oversize', '', { form: 'ovale', construction: 'acetate', size: 'oversize', finish: { acetate: 'miel' } }),
      s('Rectangle oversize', '', { form: 'rectangle', construction: 'acetate', size: 'oversize', finish: { acetate: 'ecaille-degrade' } }),
    ],
  },
  {
    group: 'H. Techniques et contemporaines',
    items: [
      s('Sans cercle', 'verres percés, rien autour', { form: 'rectangle', construction: 'rimless', finish: { metal: 'argent' } }),
      s('Semi-cerclée', 'barre d’acétate en haut', { form: 'rectangle', construction: 'semi', finish: { acetate: 'noir', metal: 'canon' } }),
      s('Nylor', 'barre métal et fil de nylon', { form: 'rectangle-fin', construction: 'semi', finish: { metal: 'argent' } }),
      m('Shield', 'un seul verre, barre métal', { id: 'shield', name: 'Shield', half: SHIELD, bar: 'metal', finish: { metal: 'argent' }, tint: 0.45 }),
      m('Enveloppante', 'verre unique très large', { id: 'wrap', name: 'Enveloppante', half: WRAP, bar: 'none', finish: { metal: 'noir' }, tint: 0.55 }),
    ],
  },
  {
    group: 'I. Vintage et créatives',
    items: [
      s('Teashade', 'tout petit rond métal', { form: 'rond', construction: 'metal', scale: 0.87, gap: 23, finish: { metal: 'or' }, bridgeTop: 8 }),
      s('Mod', 'carré graphique des années 1960', { form: 'flat-top', construction: 'acetate', finish: { acetate: 'noir' }, rim: (_x, y) => 4 + 4 * Math.max(0, Math.min(1, (y + 2) / 20)) }),
      s('Ovale vintage', 'petit ovale métal', { form: 'ovale', construction: 'metal', size: 'fine', finish: { metal: 'or' } }),
      s('Œil de chat sculpté', 'acétate massif, ailes taillées', { form: 'arlequin', construction: 'acetate', size: 'oversize', scale: 1.06, finish: { acetate: 'ecaille' }, rim: (x, y) => 4 + 5 * Math.max(0, Math.min(1, (x + 4) / 34)) * Math.max(0, Math.min(1, (y + 6) / 20)) }),
      s('Avant-garde', 'angles et volumes exagérés', { form: 'angulaire', construction: 'acetate', size: 'oversize', finish: { acetate: 'ecaille-degrade' }, rim: (x) => 4 + 4 * Math.max(0, Math.min(1, (x + 10) / 40)) }),
    ],
  },
  {
    group: 'J. Modernes et expérimentales',
    items: [
      s('Flat top', 'barre supérieure parfaitement droite', { form: 'flat-top', construction: 'acetate', finish: { acetate: 'noir' } }),
      m('Masque', 'verre unique géant', { id: 'mask', name: 'Masque', half: MASK, bar: 'acetate', finish: { acetate: 'noir', metal: 'noir' }, tint: 0.5 }),
      s('Pliante', 'charnière au milieu du pont', { form: 'panto', construction: 'metal', extras: ['charniere'], bridgeTop: 10, finish: { metal: 'argent' } }),
      m('Futuriste', 'visière étroite d’un seul tenant', { id: 'visor', name: 'Futuriste', half: VISOR, bar: 'metal', finish: { metal: 'canon' }, tint: 0.4 }),
      s('Connectée', 'face épaisse, caméra et voyant', { form: 'rectangle', construction: 'acetate', extras: ['capteurs'], finish: { acetate: 'noir' }, rim: () => 6 }),
    ],
  },
];

const ENTRIES: Entry[] = GROUPS.flatMap((g) => g.items.map((it) => ({ group: g.group, ...it }) as Entry));

function draw(e: Entry, k: number): Drawn {
  return 'mono' in e ? drawMono(e.mono, k) : drawFrame(make({ id: e.name, name: e.name, ...e.spec }) as Shape, k);
}

function indexPage(): string {
  const cols = GROUPS.map(
    (g, gi) => `<div><h2>${g.group}</h2><ol start="${gi * 5 + 1}">${g.items.map((it) => `<li><b>${it.name}</b>${it.note ? `, ${it.note}` : ''}</li>`).join('')}</ol></div>`
  ).join('');
  return page(`
    <h1>Les 50 silhouettes</h1>
    <p class="small">Les formes à connaître et à reconnaître, quelle que soit la marque qui les fabrique. Dessins originaux d’après les
    proportions de chaque famille ; les modèles de marque sont nommés par leur silhouette générique.</p>
    <div class="grid5">${cols}</div>
  `);
}

const html = (size: (typeof SIZES)[number]) => {
  const strips = ENTRIES.map((e, i) => {
    const d = draw(e, size.scale);
    const n = String(i + 1).padStart(2, '0');
    const dims = 'mono' in e ? `${Math.round(d.width)} mm` : `${d.marking}  ${Math.round(d.width)} mm`;
    return { d, lines: [`${size.id}-${n}`, e.name, e.group.replace(/^[A-J]\. /, ''), dims] };
  });
  const sheets = stripPages(strips, `Les 50 silhouettes, taille ${size.id}, ${size.label}`);
  const reading = indexPage() + scalePage(SIZES);
  const note = printerPage({
    paper: `${pageRange(1, 1 + countPages(reading))} (conseils, index, échelle)`,
    film: pageRange(2 + countPages(reading), countPages(sheets)),
    strips: ENTRIES.length,
  });
  return document(`Les 50 silhouettes, taille ${size.id}`, note + reading + sheets);
};

console.log(ENTRIES.length, 'silhouettes');
await publish(SIZES.map((sz) => ({ name: `kit-50-${sz.id}`, html: html(sz) })), process.argv.includes('--pdf'));
