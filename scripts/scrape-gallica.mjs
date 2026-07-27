#!/usr/bin/env node
/**
 * Agent 2 — Recherche de lunettes dans les magazines français numérisés par
 * Gallica (Bibliothèque nationale de France) : Vogue Paris, L'Illustration,
 * Femina, Marie Claire d'époque, etc. Cohérent avec le thème « magazine
 * français » du site.
 *
 * Gallica expose une recherche SRU (protocole standard des bibliothèques,
 * notices Dublin Core) et un service de recherche plein texte par document
 * (ContentSearch, façon IIIF) qui renvoie le numéro de page correspondant.
 *
 * Deux modes :
 *
 *   node scripts/scrape-gallica.mjs --query "lunettes de soleil" --limit 20
 *   node scripts/scrape-gallica.mjs --from-xml scripts/sample-gallica.xml
 *
 * Sortie : JSON de fiches classifiées (voir lib/vintage-classifier.mjs).
 * Réseau requis : gallica.bnf.fr (souvent bloqué par les politiques réseau
 * restrictives — lancez depuis un environnement ouvert).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVintageRecord, looksLikeEyewear } from './lib/vintage-classifier.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(ROOT, 'src/data/vintageGallica.json');
const SRU_URL = 'https://gallica.bnf.fr/SRU';

function parseArgs(argv) {
  const args = { query: 'lunettes de soleil', limit: 20, out: DEFAULT_OUT, fromXml: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--query': args.query = argv[++i]; break;
      case '--limit': args.limit = Number(argv[++i]); break;
      case '--out': args.out = resolve(argv[++i]); break;
      case '--from-xml': args.fromXml = resolve(argv[++i]); break;
      case '--help':
        console.log('Usage: scrape-gallica.mjs [--query "..."] [--limit N] [--from-xml fichier.xml] [--out fichier.json]');
        process.exit(0);
        break;
      default:
        console.error(`Argument inconnu : ${argv[i]}`);
        process.exit(1);
    }
  }
  return args;
}

// Extraction XML minimaliste (sans dépendance) — les notices Gallica/SRU ont
// une structure Dublin Core régulière, suffisante pour un parsing par regex.
function extractAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g');
  return [...xml.matchAll(re)].map(m => m[1].trim());
}

function parseRecords(xml) {
  const records = xml.split('<srw:record>').slice(1);
  return records.map(chunk => ({
    ark: (chunk.match(/ark:\/12148\/(\w+)/) ?? [])[1] ?? null,
    title: extractAll(chunk, 'dc:title')[0] ?? null,
    publisher: extractAll(chunk, 'dc:publisher')[0] ?? null,
    date: extractAll(chunk, 'dc:date')[0] ?? null,
    description: extractAll(chunk, 'dc:description').join(' ')
  })).filter(r => r.ark);
}

async function searchSru({ query, limit }) {
  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    version: '1.2',
    query: `gallica all "${query}" and dc.type all "fascicule"`,
    maximumRecords: String(limit)
  });
  const res = await fetch(`${SRU_URL}?${params}`);
  if (!res.ok) throw new Error(`Gallica SRU : HTTP ${res.status}`);
  const xml = await res.text();
  return parseRecords(xml);
}

// Recherche plein texte dans un document précis (service ContentSearch, façon
// IIIF) pour trouver la page qui mentionne le terme recherché.
async function findMatchingPage(ark, term) {
  const url = `https://gallica.bnf.fr/services/ContentSearch?ark=ark:/12148/${ark}&query=${encodeURIComponent(term)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();
    const page = (xml.match(/<startPage>(\d+)<\/startPage>/) ?? [])[1];
    const snippet = (xml.match(/<fragment>([^<]*)<\/fragment>/) ?? [])[1];
    if (!page) return null;
    return { page: Number(page), text: snippet ?? term };
  } catch {
    return null;
  }
}

// Vignette de page via le service image de Gallica (URL stable et documentée).
function pageImageUrl(ark, page) {
  return `https://gallica.bnf.fr/ark:/12148/${ark}/f${page}.thumbnail`;
}

async function runLive(args) {
  const items = await searchSru(args);
  console.log(`${items.length} numéro(s) de magazine trouvé(s) pour « ${args.query} ».`);

  const records = [];
  for (const item of items) {
    const match = await findMatchingPage(item.ark, args.query);
    if (!match) continue;

    records.push(buildVintageRecord({
      source: 'gallica',
      sourceUrl: `https://gallica.bnf.fr/ark:/12148/${item.ark}`,
      magazine: item.publisher ?? item.title ?? item.ark,
      issueDate: item.date,
      imageUrl: pageImageUrl(item.ark, match.page),
      matchedText: `${match.text} ${item.description ?? ''}`.trim(),
      hasKnownBrandMatch: false
    }));
  }
  return records;
}

function runFromXml(path) {
  const xml = readFileSync(path, 'utf8');
  const items = parseRecords(xml);
  return items
    .filter(i => looksLikeEyewear(i.description) || looksLikeEyewear(i.title))
    .map(i => buildVintageRecord({
      source: 'gallica',
      sourceUrl: `https://gallica.bnf.fr/ark:/12148/${i.ark}`,
      magazine: i.publisher ?? i.title ?? i.ark,
      issueDate: i.date,
      imageUrl: pageImageUrl(i.ark, 1),
      matchedText: i.description,
      hasKnownBrandMatch: false
    }));
}

async function main() {
  const args = parseArgs(process.argv);
  const records = args.fromXml ? runFromXml(args.fromXml) : await runLive(args);

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
