#!/usr/bin/env node
/**
 * Generates a labelled set of synthetic test faces with FLUX.1 [schnell]
 * (Apache 2.0, commercial use allowed) through the Replicate API.
 *
 *   REPLICATE_API_TOKEN=r8_... node scripts/generate-faces.mjs [count] [outDir]
 *
 * Writes outDir/*.jpg and outDir/manifest.json ({ file, shape, prompt, seed }).
 * Drop the whole folder (images + manifest.json) on /labo to run the pipeline on it.
 * Note: the generator follows "face shape" loosely; treat the labels as hints.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error('Set REPLICATE_API_TOKEN (https://replicate.com/account/api-tokens).');
  process.exit(1);
}
const count = Number(process.argv[2] ?? 40);
const outDir = process.argv[3] ?? 'test-faces/generated';

const AGES = ['22-year-old', '30-year-old', '45-year-old', '60-year-old', '72-year-old'];
const PEOPLE = [
  'woman of West African descent',
  'man of West African descent',
  'woman of North African descent',
  'man of North African descent',
  'woman of East Asian descent',
  'man of East Asian descent',
  'woman of South Asian descent',
  'man of South Asian descent',
  'woman of European descent',
  'man of European descent',
  'woman of Latin American descent',
  'man of Latin American descent',
];
const SHAPES = {
  oval: 'oval face, balanced proportions',
  round: 'round face, full cheeks, soft jawline',
  square: 'square face, strong wide jaw, angular jawline',
  heart: 'heart-shaped face, wide forehead, narrow pointed chin',
  oblong: 'long narrow face, oblong face',
};
const LIGHTS = ['soft window light', 'even studio light', 'warm indoor light', 'overcast daylight'];

let seed = 1000;
const pick = (arr) => arr[seed % arr.length];

async function generate(prompt, s) {
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      input: { prompt, seed: s, aspect_ratio: '3:4', output_format: 'jpg', output_quality: 90, num_outputs: 1 },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const url = Array.isArray(json.output) ? json.output[0] : json.output;
  if (!url) throw new Error(`no output: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

await mkdir(outDir, { recursive: true });
const manifest = [];
const shapes = Object.keys(SHAPES);
for (let i = 0; i < count; i++) {
  seed = 1000 + i * 7;
  const shape = shapes[i % shapes.length];
  const person = PEOPLE[(i * 5) % PEOPLE.length];
  const age = AGES[(i * 3) % AGES.length];
  const prompt =
    `Frontal passport-style portrait photo of a ${age} ${person}, ${SHAPES[shape]}, ` +
    `neutral expression, looking straight into the camera, head level, hair away from the face, ` +
    `no glasses, ${pick(LIGHTS)}, plain light grey background, realistic skin texture, sharp focus, 85mm lens`;
  const file = `face-${String(i + 1).padStart(3, '0')}-${shape}.jpg`;
  try {
    await writeFile(join(outDir, file), await generate(prompt, seed));
    manifest.push({ file, shape, prompt, seed });
    console.log(`✓ ${file}`);
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} visages dans ${outDir}. Dépose le dossier sur /labo.`);
