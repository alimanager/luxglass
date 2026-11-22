/**
 * Import of affiliate product feeds (Awin CSV and similar) into catalogue products
 * with price offers. Pure functions, shared by scripts/import-flux.ts and the tests.
 */

export interface Offre {
  marchand: string;
  prix: number;
  livraison: number;
  url: string;
  dispo: boolean;
}

export interface ProduitFlux {
  id: number;
  nom: string;
  marque: string;
  /** product photo from the merchant feed (used for display and as the AI reference) */
  image: string;
  style: string;
  couleur: string;
  /** lens □ bridge temple, when found in the name or description */
  cotes?: [number, number, number];
  ean?: string;
  offres: Offre[];
}

export interface FluxData {
  maj: string;
  produits: ProduitFlux[];
}

// ---- CSV ----

export function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
  const sep = [',', ';', '\t', '|'].map((s) => [s, firstLine.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  const [head, ...body] = rows;
  const keys = head.map((h) => h.trim().replace(/^﻿/, '').toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// ---- field mapping (Awin names first, then common alternatives) ----

const FIELDS = {
  url: ['aw_deep_link', 'deep_link', 'link', 'url', 'product_url'],
  nom: ['product_name', 'name', 'title', 'titre'],
  marchand: ['merchant_name', 'merchant', 'shop', 'boutique'],
  prix: ['search_price', 'price', 'prix', 'store_price'],
  livraison: ['delivery_cost', 'shipping', 'shipping_cost', 'frais_de_port'],
  image: ['merchant_image_url', 'aw_image_url', 'large_image', 'image_url', 'image_link', 'image'],
  marque: ['brand_name', 'brand', 'marque'],
  ean: ['ean', 'product_gtin', 'gtin', 'upc'],
  mpn: ['mpn', 'model_number', 'merchant_product_id', 'reference'],
  description: ['description', 'product_short_description', 'merchant_product_category_path'],
  couleur: ['colour', 'color', 'couleur'],
  dispo: ['in_stock', 'stock_status', 'availability', 'disponibilite'],
};

const pick = (r: Record<string, string>, k: keyof typeof FIELDS) => {
  for (const f of FIELDS[k]) if (r[f]) return r[f];
  return '';
};

export const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// ---- guessing from text ----

const STYLE_WORDS: [RegExp, string][] = [
  [/aviat|pilote?\b/i, 'Aviateur'],
  [/cat[\s-]?eye|papillon|butterfly/i, 'Cat-eye'],
  [/round|ronde?s?\b|panto/i, 'Rond'],
  [/clubmaster|browline/i, 'Browline'],
  [/hexag|octog|g[ée]om[ée]tri/i, 'Géométrique'],
  [/oversize|xxl/i, 'Oversize'],
  [/wayfarer|rectang/i, 'Rectangulaire'],
  [/carr[ée]|square/i, 'Carré'],
];

export function guessStyle(text: string): string {
  for (const [re, style] of STYLE_WORDS) if (re.test(text)) return style;
  return 'Rectangulaire';
}

/** Finds a frame size marking such as 52□18 145, 52-18-145, 52 18 140 or 52/18/145. */
export function parseCotes(text: string): [number, number, number] | undefined {
  const m = /\b([3-6]\d)\s*(?:□|\[\]|x|-|\/|\s)\s*(1\d|2[0-6])\s*(?:-|\/|\s|x)?\s*(1[2-5]\d)\b/i.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

const COLORS: [RegExp, string][] = [
  [/noir|black/i, 'Noir'],
  [/[ée]caille|tortoise|havana|havane/i, 'Écaille'],
  [/\bor\b|gold/i, 'Or'],
  [/argent|silver/i, 'Argent'],
  [/bleu|blue|navy/i, 'Bleu'],
  [/marron|brown/i, 'Marron'],
  [/rouge|red|bordeaux/i, 'Bordeaux'],
  [/transparent|crystal|clear/i, 'Transparent'],
];
const guessColor = (text: string) => COLORS.find(([re]) => re.test(text))?.[1] ?? 'Noir';

// ---- grouping into products ----

/**
 * Groups feed rows describing the same frame (same EAN, otherwise same brand + reference
 * or name) and keeps one offer per merchant, the cheapest.
 */
export function rowsToProducts(rows: Record<string, string>[], firstId = 1000): ProduitFlux[] {
  const groups = new Map<string, ProduitFlux>();
  let nextId = firstId;
  for (const r of rows) {
    const url = pick(r, 'url');
    const nom = pick(r, 'nom');
    const prix = toNumber(pick(r, 'prix'));
    if (!url || !nom || !Number.isFinite(prix) || prix <= 0) continue;
    const marque = pick(r, 'marque');
    const ean = pick(r, 'ean').replace(/\D/g, '');
    const key = ean.length >= 8 ? `ean:${ean}` : `ref:${marque}|${pick(r, 'mpn') || nom}`.toLowerCase();
    const text = `${nom} ${pick(r, 'description')}`;
    let p = groups.get(key);
    if (!p) {
      p = {
        id: nextId++,
        nom,
        marque,
        image: pick(r, 'image'),
        style: guessStyle(text),
        couleur: pick(r, 'couleur') || guessColor(text),
        cotes: parseCotes(text),
        ean: ean || undefined,
        offres: [],
      };
      groups.set(key, p);
    }
    if (!p.image) p.image = pick(r, 'image');
    if (!p.cotes) p.cotes = parseCotes(text);
    const dispoRaw = pick(r, 'dispo').toLowerCase();
    const offre: Offre = {
      marchand: pick(r, 'marchand') || 'Marchand',
      prix,
      livraison: toNumber(pick(r, 'livraison')) || 0,
      url,
      dispo: !/^(0|false|no|non|out)/.test(dispoRaw),
    };
    const same = p.offres.findIndex((o) => o.marchand === offre.marchand);
    if (same === -1) p.offres.push(offre);
    else if (total(offre) < total(p.offres[same])) p.offres[same] = offre;
  }
  return [...groups.values()].map((p) => ({ ...p, offres: sortOffres(p.offres) }));
}

export const total = (o: Pick<Offre, 'prix' | 'livraison'>) => o.prix + (o.livraison || 0);

/** In stock first, then cheapest delivered price. */
export const sortOffres = (offres: Offre[]) =>
  [...offres].sort((a, b) => Number(b.dispo) - Number(a.dispo) || total(a) - total(b));
