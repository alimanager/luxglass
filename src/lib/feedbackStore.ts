/**
 * "Ça me va / pas pour moi" answers, kept on this device until the learning pipeline exists.
 * Nothing leaves the browser: no photo, no landmarks, only which template or frame, the answer,
 * where it was given and when. The face measurements are attached later, with consent, when
 * the answers are sent for learning.
 */

export type Label = 'like' | 'dislike';
export type Source = 'formes' | 'apercu' | 'essai' | 'kit';

export interface Answer {
  /** template id (public/gabarits) or product id (catalogue), prefixed: "g:" or "p:" */
  item: string;
  label: Label;
  source: Source;
  at: string;
}

const KEY = 'luxoptic.avis.v1';

function read(): Answer[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Answer[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: Answer[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-500)));
  } catch {
    // storage full or blocked: answers are a convenience, never an error
  }
}

/** the latest answer per item */
export function answers(): Map<string, Label> {
  const m = new Map<string, Label>();
  for (const a of read()) m.set(a.item, a.label);
  return m;
}

/** records an answer; giving the same answer again removes it (toggle) */
export function answer(item: string, label: Label, source: Source): Label | null {
  const current = answers().get(item);
  const list = read().filter((a) => a.item !== item);
  if (current === label) {
    write(list);
    return null;
  }
  list.push({ item, label, source, at: new Date().toISOString() });
  write(list);
  return label;
}

export function allAnswers(): Answer[] {
  return read();
}
