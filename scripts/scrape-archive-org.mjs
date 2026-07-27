#!/usr/bin/env node
/**
 * Agent 1 — Recherche de lunettes dans les magazines numérisés d'Internet Archive.
 *
 * Internet Archive héberge des millions de magazines scannés (Vogue, LIFE,
 * Esquire, Popular Mechanics...) avec recherche plein texte OCR sur le
 * contenu des pages. On interroge son API de recherche publique, on repère
 * les pages qui mentionnent des lunettes ou une marque connue, et on
 * reconstruit l'URL de l'image de page correspondante.
 *
 * Deux modes :
 *
 *   node scripts/scrape-archive-org.mjs --query "lunettes de soleil" --brands "Ray-Ban,Persol" --limit 20
 *   node scripts/scrape-archive-org.mjs --from-json scripts/sample-archive-org.json
 *
 * Sortie : JSON de fiches classifiées (voir lib/vintage-classifier.mjs).
 * Réseau requis : archive.org et *.us.archive.org (souvent bloqués par les
 * politiques réseau restrictives — lancez depuis un environnement ouvert).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVintageRecord, KNOWN_BRANDS, looksLikeEyewear } from './lib/vintage-classifier.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(ROOT, 'src/data/vintageArchiveOrg.json');
const SEARCH_URL = 'https://archive.org/advancedsearch.php';

function parseArgs(argv) {
  const args = {
    query: 'lunettes de soleil OR eyeglasses OR sunglasses',
    brands: KNOWN_BRANDS.join(','),
    limit: 20,
    yearMin: 1930,
    yearMax: 2005,
    out: DEFAULT_OUT,
    fromJson: null
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--query': args.query = argv[++i]; break;
      case '--brands': args.brands = argv[++i]; break;
      case '--limit': args.limit = Number(argv[++i]); break;
      case '--year-min': args.yearMin = Number(argv[++i]); break;
      case '--year-max': args.yearMax = Number(argv[++i]); break;
      case '--out': args.out = resolve(argv[++i]); break;
      case '--from-json': args.fromJson = resolve(argv[++i]); break;
      case '--help':
        console.log('Usage: scrape-archive-org.mjs [--query "..."] [--brands "A,B"] [--limit N] [--year-min Y] [--year-max Y] [--from-json fichier.json] [--out fichier.json]');
        process.exit(0);
        break;
      default:
        console.error(`Argument inconnu : ${argv[i]}`);
        process.exit(1);
    }
  }
  return args;
}

// Recherche les items (numéros de magazine) dont les métadonnées ou le
// texte plein correspondent à la requête, dans la collection des magazines.
async function searchItems({ query, yearMin, yearMax, limit }) {
  const q = [
    `(${query})`,
    'mediatype:(texts)',
    '(collection:(magazine_rack) OR collection:(pulpmagazinearchive) OR subject:(magazine))',
    `year:[${yearMin} TO ${yearMax}]`
  ].join(' AND ');

  const params = new URLSearchParams({
    q,
    output: 'json',
    rows: String(limit),
    'fl[]': 'identifier',
  });
  ['title', 'year', 'date', 'publisher', 'subject'].forEach(f => params.append('fl[]', f));

  const res = await fetch(`${SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`Internet Archive : HTTP ${res.status}`);
  const body = await res.json();
  return body?.response?.docs ?? [];
}

// Recherche plein texte DANS un item pour trouver la page qui correspond,
// via le service "search inside" du lecteur de livres d'Internet Archive.
async function findMatchingPage(identifier, term) {
  const url = `https://ia601504.us.archive.org/fulltext/inside.php?item_id=${identifier}&doc=${identifier}&q=${encodeURIComponent(term)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = await res.json();
    const hit = body?.matches?.[0];
    if (!hit) return null;
    return { page: hit.par?.[0]?.page ?? hit.page, text: hit.text ?? term };
  } catch {
    return null;
  }
}

// URL d'image de page reconstruite via le service BookReader (mécanisme
// standard et documenté d'Internet Archive pour les livres/magazines scannés).
function pageImageUrl(identifier, page) {
  return `https://ia601504.us.archive.org/BookReader/BookReaderImages.php?id=${identifier}&itemPath=%2F&server=ia601504.us.archive.org&format=jpg&page=${page}`;
}

async function runLive(args) {
  const brandList = args.brands.split(',').map(b => b.trim()).filter(Boolean);
  const items = await searchItems(args);
  console.log(`${items.length} numéro(s) de magazine trouvé(s) pour « ${args.query} ».`);

  const records = [];
  for (const item of items) {
    const searchTerm = brandList.find(b => (item.subject ?? []).join(' ').includes(b)) ?? 'lunettes';
    const match = await findMatchingPage(item.identifier, searchTerm);
    if (!match) continue;

    records.push(buildVintageRecord({
      source: 'archive.org',
      sourceUrl: `https://archive.org/details/${item.identifier}`,
      magazine: item.title ?? item.identifier,
      issueDate: item.date ?? String(item.year ?? ''),
      imageUrl: pageImageUrl(item.identifier, match.page),
      matchedText: match.text,
      hasKnownBrandMatch: brandList.includes(searchTerm)
    }));
  }
  return records;
}

function runFromJson(path) {
  const dump = JSON.parse(readFileSync(path, 'utf8'));
  const items = Array.isArray(dump) ? dump : dump.items ?? [];
  return items
    .filter(i => looksLikeEyewear(i.matchedText) || looksLikeEyewear(i.title))
    .map(i => buildVintageRecord({
      source: 'archive.org',
      sourceUrl: `https://archive.org/details/${i.identifier}`,
      magazine: i.title ?? i.identifier,
      issueDate: i.date ?? String(i.year ?? ''),
      imageUrl: i.imageUrl ?? pageImageUrl(i.identifier, i.page ?? 1),
      matchedText: i.matchedText,
      hasKnownBrandMatch: false
    }));
}

async function main() {
  const args = parseArgs(process.argv);
  const records = args.fromJson ? runFromJson(args.fromJson) : await runLive(args);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(records, null, 2) + '\n');
  console.log(`${records.length} fiche(s) classifiée(s) → ${args.out}`);
  records.slice(0, 5).forEach(r => {
    console.log(`  · [${r.confidence}] ${r.magazine} (${r.year ?? '?'}) — marque : ${r.brandGuess ?? 'inconnue'}`);
  });
  if (records.length > 0) {
    console.log('\nRappel : ces fiches sont issues d\'une correspondance textuelle (OCR/métadonnées),');
    console.log('pas d\'une détection visuelle. Chaque image doit être validée à l\'œil avant publication.');
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
