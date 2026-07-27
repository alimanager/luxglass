#!/usr/bin/env node
/**
 * Import de montures depuis AliExpress vers le catalogue LuxGlass.
 *
 * Deux modes :
 *
 * 1. API affiliée officielle (nécessite un compte sur https://openservice.aliexpress.com
 *    et les variables d'environnement ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET) :
 *
 *      ALIEXPRESS_APP_KEY=xxx ALIEXPRESS_APP_SECRET=yyy \
 *      node scripts/import-aliexpress.mjs --keywords "glasses frame" --pages 3
 *
 * 2. Import hors ligne d'un dump JSON (export d'une réponse API, d'un outil de
 *    scraping ou d'une liste construite à la main) :
 *
 *      node scripts/import-aliexpress.mjs --from-json scripts/sample-aliexpress.json
 *
 * Sortie : src/data/importedGlasses.json, chargé automatiquement par le catalogue.
 * Chaque produit est normalisé vers le type Glasses de l'app : forme de monture
 * déduite du titre, cotes d'opticien extraites quand elles sont présentes
 * (motifs « 52-18-140 », « 52□18 », « lens width 52mm »...).
 */

import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(ROOT, 'src/data/importedGlasses.json');
const API_URL = 'https://api-sg.aliexpress.com/sync';

// Les ids importés démarrent à 1000 pour ne jamais entrer en collision
// avec le catalogue éditorial.
const IMPORT_ID_BASE = 1000;

// --- Lecture des arguments ------------------------------------------------

function parseArgs(argv) {
  const args = { keywords: 'eyeglasses frame', pages: 1, out: DEFAULT_OUT, fromJson: null };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--keywords': args.keywords = argv[++i]; break;
      case '--pages': args.pages = Number(argv[++i]); break;
      case '--out': args.out = resolve(argv[++i]); break;
      case '--from-json': args.fromJson = resolve(argv[++i]); break;
      case '--help':
        console.log('Usage: import-aliexpress.mjs [--keywords "..."] [--pages N] [--from-json fichier.json] [--out fichier.json]');
        process.exit(0);
        break;
      default:
        console.error(`Argument inconnu : ${argv[i]}`);
        process.exit(1);
    }
  }
  return args;
}

// --- Appel API officielle (aliexpress.affiliate.product.query) -------------

function signRequest(params, appSecret) {
  // Signature HMAC-SHA256 du portail AliExpress Open Platform :
  // concaténation clé+valeur des paramètres triés, hex majuscule.
  const base = Object.keys(params)
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHmac('sha256', appSecret).update(base, 'utf8').digest('hex').toUpperCase();
}

async function fetchPage(appKey, appSecret, keywords, pageNo) {
  const params = {
    app_key: appKey,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    keywords,
    page_no: String(pageNo),
    page_size: '50',
    target_currency: 'EUR',
    target_language: 'FR',
    ship_to_country: 'FR',
  };
  params.sign = signRequest(params, appSecret);

  const res = await fetch(`${API_URL}?${new URLSearchParams(params)}`);
  if (!res.ok) {
    throw new Error(`API AliExpress : HTTP ${res.status}`);
  }
  const body = await res.json();
  const products =
    body?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;
  if (!products) {
    throw new Error(`Réponse inattendue de l'API : ${JSON.stringify(body).slice(0, 400)}`);
  }
  return products;
}

// --- Normalisation vers le type Glasses ------------------------------------

const SHAPE_KEYWORDS = [
  ['cat-eye', /cat[\s-]?eye|œil[\s-]?de[\s-]?chat|oeil de chat|papillon vintage/i],
  ['aviator', /aviator|aviateur|pilot(?!e\b\w)/i],
  ['browline', /browline|clubmaster|demi[\s-]?cercl/i],
  ['butterfly', /butterfly|papillon/i],
  ['geometric', /polygon|hexagon|geometr|octogon/i],
  ['oversize', /oversiz|surdimension|big frame|large frame/i],
  ['round', /\bround\b|\brond(es?)?\b|circle|circulaire/i],
  ['square', /\bsquare\b|carr[ée]/i],
  ['oval', /\boval(e)?\b/i],
  ['rectangular', /rectang|narrow frame/i],
];

function inferFrameShape(title) {
  for (const [shape, re] of SHAPE_KEYWORDS) {
    if (re.test(title)) return shape;
  }
  return 'rectangular';
}

function inferMaterial(title) {
  if (/titanium|titane/i.test(title)) return 'Titane';
  if (/\btr90\b/i.test(title)) return 'TR90';
  if (/metal|métal|alloy|acier|steel/i.test(title)) return 'Métal';
  if (/acetate|acétate/i.test(title)) return 'Acétate';
  if (/wood|bois|bambou|bamboo/i.test(title)) return 'Bois';
  return 'Plastique';
}

function inferGender(title) {
  const women = /\bwomen\b|\bfemmes?\b|\blady\b|\bfemale\b/i.test(title);
  const men = /\bmen\b|\bhommes?\b|\bmale\b/i.test(title);
  if (women && !men) return 'women';
  if (men && !women) return 'men';
  return 'unisex';
}

function inferColor(title) {
  const colors = [
    ['Noir', /black|noir/i], ['Écaille', /tortoise|écaille|leopard/i],
    ['Or', /\bgold\b|dor[ée]/i], ['Argent', /silver|argent/i],
    ['Marron', /brown|marron/i], ['Bleu', /blue|bleu/i],
    ['Rose', /pink|rose/i], ['Rouge', /\bred\b|rouge/i],
    ['Vert', /green|vert/i], ['Transparent', /clear|transparent/i],
  ];
  for (const [name, re] of colors) {
    if (re.test(title)) return name;
  }
  return 'Noir';
}

// Extrait les cotes « 52-18-140 », « 52□18-140 », « 52 18 140 » ou
// « lens width: 52mm » ; sinon estime depuis la forme.
function extractDimensions(text, shape) {
  const triple = text.match(/(\d{2})\s*[-□‑x]\s*(\d{2})\s*[-—x]\s*(1[2-5]\d)/);
  if (triple) {
    const lensWidth = Number(triple[1]);
    const bridgeWidth = Number(triple[2]);
    const templeLength = Number(triple[3]);
    if (lensWidth >= 40 && lensWidth <= 65 && bridgeWidth >= 12 && bridgeWidth <= 28) {
      return {
        lensWidth,
        bridgeWidth,
        templeLength,
        lensHeight: Math.round(lensWidth * heightRatio(shape)),
        totalWidth: 2 * lensWidth + bridgeWidth + 10,
      };
    }
  }

  const lens = text.match(/lens\s*width\s*:?\s*(\d{2})/i);
  const bridge = text.match(/bridge\s*:?\s*(\d{2})/i);
  const lensWidth = lens ? Number(lens[1]) : 52;
  const bridgeWidth = bridge ? Number(bridge[1]) : 18;
  return {
    lensWidth,
    bridgeWidth,
    templeLength: 142,
    lensHeight: Math.round(lensWidth * heightRatio(shape)),
    totalWidth: 2 * lensWidth + bridgeWidth + 10,
  };
}

function heightRatio(shape) {
  return { round: 0.95, aviator: 0.88, oval: 0.82, 'cat-eye': 0.72, oversize: 0.85 }[shape] ?? 0.75;
}

function normalizeProduct(raw, index) {
  const title = raw.product_title ?? raw.title ?? 'Monture sans nom';
  const shape = inferFrameShape(title);
  const price = Number(
    raw.target_sale_price ?? raw.sale_price ?? raw.price ?? 0
  );

  return {
    id: IMPORT_ID_BASE + index,
    name: title.length > 60 ? `${title.slice(0, 57)}...` : title,
    brand: raw.shop_name ?? raw.brand ?? 'AliExpress',
    price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 9.99,
    description: title,
    color: inferColor(title),
    style: shape,
    material: inferMaterial(title),
    gender: inferGender(title),
    imageUrl: raw.product_main_image_url ?? raw.image ?? '',
    magazineFeatures: [],
    productUrl: raw.promotion_link ?? raw.product_detail_url ?? raw.url ?? '',
    frameShape: shape,
    dimensions: extractDimensions(
      `${title} ${raw.specs ?? ''}`,
      shape
    ),
  };
}

// --- Point d'entrée ---------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  let rawProducts;

  if (args.fromJson) {
    const parsed = JSON.parse(readFileSync(args.fromJson, 'utf8'));
    rawProducts = Array.isArray(parsed) ? parsed : parsed.products ?? [];
    console.log(`Dump chargé : ${rawProducts.length} produits depuis ${args.fromJson}`);
  } else {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    if (!appKey || !appSecret) {
      console.error(
        'ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET manquants.\n' +
        'Créez une app sur https://openservice.aliexpress.com puis relancez, ou utilisez --from-json.'
      );
      process.exit(1);
    }
    rawProducts = [];
    for (let page = 1; page <= args.pages; page++) {
      console.log(`Requête API page ${page}/${args.pages} (« ${args.keywords} »)...`);
      const products = await fetchPage(appKey, appSecret, args.keywords, page);
      rawProducts.push(...products);
    }
    console.log(`${rawProducts.length} produits reçus de l'API.`);
  }

  const normalized = rawProducts
    .map((p, i) => normalizeProduct(p, i))
    .filter(p => p.imageUrl && p.productUrl);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(normalized, null, 2) + '\n');
  console.log(`${normalized.length} montures normalisées → ${args.out}`);

  for (const p of normalized.slice(0, 5)) {
    console.log(
      `  · [${p.frameShape}] ${p.name} — ${p.price} € — ` +
      `${p.dimensions.lensWidth} □ ${p.dimensions.bridgeWidth} — ${p.dimensions.templeLength}`
    );
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
