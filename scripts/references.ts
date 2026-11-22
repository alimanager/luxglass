/**
 * Writes public/references/catalogue.json: how to describe each catalogue frame to the
 * image model (brand, model and look, in English). For these frames the AI preview asks
 * for the real product by name instead of copying our stylised 3D render.
 *
 *   npm run references
 */
import { writeFile } from 'node:fs/promises';
import { glasses } from '../src/data/mockData';

const STYLE: Record<string, string> = {
  Rectangulaire: 'rectangular, slightly trapezoid',
  Aviateur: 'teardrop aviator, thin metal double bridge',
  'Aviateur Moderne': 'modern aviator, metal frame with acetate details',
  'Cat-eye': 'cat-eye, upswept outer corners',
  Oversize: 'oversized, large square-ish lenses',
  Browline: 'browline, thick acetate brow bar over a thin metal lower rim',
  Rond: 'perfectly round, thin metal wire rims',
  Géométrique: 'geometric hexagonal, slim matte rims',
  Carré: 'square, thick bold rims',
  Papillon: 'butterfly, wide lenses dropping at the outer edges',
  Pilot: 'pilot, rounded square with a keyhole bridge',
};
const COLOR: Record<string, string> = {
  Noir: 'black',
  Or: 'gold',
  Bordeaux: 'burgundy',
  Écaille: 'tortoiseshell',
  Havane: 'havana tortoiseshell',
  'Noir/Or': 'black and gold',
  'Noir Mat': 'matte black',
  Bleu: 'navy blue',
  Marron: 'brown',
};
const MATERIAL: Record<string, string> = {
  Acétate: 'acetate',
  Métal: 'metal',
  'Acétate et Métal': 'acetate and metal',
  'Métal et Acétate': 'metal and acetate',
  Mylon: 'lightweight 3D-printed polyamide',
};

const out = Object.fromEntries(
  glasses.map((g) => [
    g.id,
    {
      name: g.name.toLowerCase().includes(g.brand.toLowerCase()) ? g.name : `${g.brand} ${g.name}`,
      look: [STYLE[g.style] ?? g.style, `${COLOR[g.color] ?? g.color} ${MATERIAL[g.material] ?? g.material} frame`, 'tinted sun lenses']
        .filter(Boolean)
        .join(', '),
    },
  ])
);
await writeFile('public/references/catalogue.json', JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length} montures décrites (public/references/catalogue.json)`);
