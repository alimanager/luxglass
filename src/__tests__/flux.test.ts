import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { guessStyle, parseCotes, parseCsv, rowsToProducts, sortOffres, toNumber } from '../lib/flux';

const csv = readFileSync(new URL('./fixtures/flux-demo.csv', import.meta.url), 'utf8');

describe('import des flux d’affiliation', () => {
  it('lit un CSV Awin, avec guillemets et virgules dans les champs', () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(8);
    expect(rows[2].product_name).toBe('Aviateur métal or, verres G15');
  });

  it('détecte le séparateur point-virgule', () => {
    const rows = parseCsv('product_name;search_price\nRonde;49,90\n');
    expect(rows[0].search_price).toBe('49,90');
    expect(toNumber(rows[0].search_price)).toBe(49.9);
  });

  it('regroupe la même monture vendue par plusieurs marchands (même EAN)', () => {
    const produits = rowsToProducts(parseCsv(csv));
    expect(produits).toHaveLength(4);
    const aviateur = produits.find((p) => p.style === 'Aviateur')!;
    expect(aviateur.offres.map((o) => o.marchand)).toEqual(['Boutique démo B', 'Boutique démo A', 'Boutique démo C']);
  });

  it('classe d’abord les offres en stock, puis par prix livré', () => {
    const o = (marchand: string, prix: number, livraison: number, dispo = true) => ({ marchand, prix, livraison, url: '#', dispo });
    const sorted = sortOffres([o('A', 90, 0), o('B', 80, 15), o('C', 50, 0, false), o('D', 85, 0)]);
    expect(sorted.map((x) => x.marchand)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('ignore les lignes sans prix ou sans lien', () => {
    expect(rowsToProducts([{ product_name: 'X', search_price: '' }, { aw_deep_link: '#', product_name: 'Y', search_price: '0' }])).toEqual([]);
  });
});

describe('lecture des cotes et de la forme dans le texte', () => {
  it.each([
    ['Monture 52□18 145', [52, 18, 145]],
    ['taille 52-18-140', [52, 18, 140]],
    ['Calibre 49/20/145 mm', [49, 20, 145]],
    ['54 17 140', [54, 17, 140]],
  ])('%s', (text, cotes) => {
    expect(parseCotes(text)).toEqual(cotes);
  });

  it('ne confond pas un prix ou une référence avec des cotes', () => {
    expect(parseCotes('Référence 2140 901 à 129 €')).toBeUndefined();
  });

  it.each([
    ['Ray-Ban Aviator Classic', 'Aviateur'],
    ['Lunettes cat eye écaille', 'Cat-eye'],
    ['Monture ronde panto', 'Rond'],
    ['Clubmaster', 'Browline'],
    ['Wayfarer', 'Rectangulaire'],
  ])('%s → %s', (text, style) => {
    expect(guessStyle(text)).toBe(style);
  });
});
