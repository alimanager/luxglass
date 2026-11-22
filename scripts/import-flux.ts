/**
 * Imports affiliate product feeds into the catalogue.
 *
 *   npm run flux -- feeds/awin-lunettes.csv [feeds/autre.csv ...]
 *
 * Writes src/data/flux.json: one product per frame (grouped by EAN, otherwise by
 * brand + reference), each with every merchant's offer, cheapest first.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseCsv, rowsToProducts, type FluxData } from '../src/lib/flux';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage : npm run flux -- <fichier.csv> [autres.csv ...]');
  process.exit(1);
}
const rows = (await Promise.all(files.map(async (f) => parseCsv(await readFile(f, 'utf8'))))).flat();
const produits = rowsToProducts(rows).filter((p) => p.image);
const data: FluxData = { maj: new Date().toISOString().slice(0, 10), produits };
await writeFile('src/data/flux.json', JSON.stringify(data, null, 1) + '\n');
// reference photos for the AI preview, read by the server (server/apercu.ts)
await writeFile('public/references/index.json', JSON.stringify(Object.fromEntries(produits.map((p) => [p.id, p.image])), null, 1) + '\n');
const offres = produits.reduce((n, p) => n + p.offres.length, 0);
console.log(`${rows.length} lignes → ${produits.length} montures, ${offres} offres (src/data/flux.json)`);
