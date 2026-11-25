import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GabaritTemplate } from './feedback';

/** Node-only helpers for the training scripts and tests (the app imports the JSON directly). */

export const ML_DIR = dirname(fileURLToPath(import.meta.url));
export const GABARITS_PATH = resolve(ML_DIR, '../src/data/gabarits.json');

/** Reads the current catalogue from disk (it may be regenerated, so never cache it at import). */
export function loadTemplates(path = GABARITS_PATH): GabaritTemplate[] {
  const data = JSON.parse(readFileSync(path, 'utf8')) as { templates?: GabaritTemplate[] };
  if (!Array.isArray(data.templates) || data.templates.length === 0) throw new Error(`${path}: no templates`);
  return data.templates;
}
