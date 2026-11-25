/**
 * One SVG per template of src/data/gabarits.json, for the app's shape explorer.
 * Front views drawn by the kit renderer at real proportions, tight viewBox, transparent background.
 *
 *   npx tsx scripts/gabarits-svg.ts   writes public/gabarits/<id>.svg
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { SHAPES, atlas } from './kit-shapes';
import { drawFrame } from './kit-render';

const out = 'public/gabarits';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const all = [...SHAPES, ...atlas()];
for (const shape of all) {
  const d = drawFrame(shape, 1);
  const pad = 3;
  const w = d.width + pad * 2;
  const h = d.height + pad * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(-w / 2).toFixed(2)} ${(d.centerY - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" width="${(w * 4).toFixed(0)}" height="${(h * 4).toFixed(0)}"><defs>${d.defs}</defs>${d.svg}</svg>`;
  await writeFile(`${out}/${shape.id}.svg`, svg);
}
console.log(all.length, 'vignettes écrites dans', out);
