/**
 * Shared layout of the printable kits: the strip (frame on the left, binding hole on the right),
 * the A4 landscape page, and the HTML to PDF step.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fmt, type Drawn } from './kit-render';

/** strip, mm: long enough to hold at one end and bind at the other, tall enough to cover brows to lip */
export const STRIP_W = 230;
export const STRIP_H = 64;
const HOLE_X = STRIP_W - 9;
const HOLE_R = 3;
const FRAME_LEFT = 12;

/** one strip: the drawn frame and up to four label lines (the first in bold) */
export function strip(d: Drawn, lines: string[]): string {
  const cx = FRAME_LEFT + d.width / 2;
  const cy = STRIP_H / 2 - d.centerY;
  const labelX = HOLE_X - HOLE_R - 4;
  const y0 = STRIP_H / 2 - 1.2 - (lines.length - 1) * 1.6;
  const text = lines
    .map((t, i) =>
      i === 0
        ? `<text x="${labelX}" y="${fmt(y0)}" font-size="3.4" font-weight="700" fill="#6f6f6f">${t}</text>`
        : `<text x="${labelX}" y="${fmt(y0 + 1.2 + i * 3.2)}" font-size="${i === 1 ? 2.4 : 2.2}">${t}</text>`
    )
    .join('');
  return `
  <svg class="strip" xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}mm" height="${STRIP_H}mm" viewBox="0 0 ${STRIP_W} ${STRIP_H}">
    <defs>${d.defs}</defs>
    <rect x="0.15" y="0.15" width="${STRIP_W - 0.3}" height="${STRIP_H - 0.3}" rx="1.6" fill="none" stroke="#b9b9b9" stroke-width="0.18" stroke-dasharray="1.4 1"/>
    <circle cx="${HOLE_X}" cy="${STRIP_H / 2}" r="${HOLE_R}" fill="none" stroke="#9a9a9a" stroke-width="0.2"/>
    <path d="M${HOLE_X - 1} ${STRIP_H / 2}h2M${HOLE_X} ${STRIP_H / 2 - 1}v2" stroke="#9a9a9a" stroke-width="0.15"/>
    <g font-family="Helvetica, Arial, sans-serif" fill="#8d8d8d" text-anchor="end">${text}</g>
    <g transform="translate(${fmt(cx)} ${fmt(cy)})">${d.svg}</g>
  </svg>`;
}

export function page(content: string, cls = '') {
  return `<section class="page ${cls}">${content}</section>`;
}

/** pages of strips, three per A4 landscape page, with a running head */
export function stripPages(strips: string[], runner: string): string {
  const out: string[] = [];
  for (let i = 0; i < strips.length; i += 3) out.push(page(`<p class="runner">${runner}</p>` + strips.slice(i, i + 3).join(''), 'strips'));
  return out.join('');
}

export const CSS = `
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; background: #fff; }
  .page { width: 297mm; height: 210mm; box-sizing: border-box; padding: 12mm 14mm; page-break-after: always; font-family: Helvetica, Arial, sans-serif; color: #111; position: relative; overflow: hidden; }
  .page h1 { font-size: 22pt; margin: 0 0 4mm; letter-spacing: -0.01em; }
  .page h2 { font-size: 12pt; margin: 6mm 0 2mm; }
  .page p, .page li { font-size: 10.5pt; line-height: 1.5; max-width: 120mm; }
  .page .small { font-size: 9pt; color: #555; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; }
  .grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm 6mm; }
  .grid5 h2 { font-size: 10pt; margin: 3mm 0 1mm; }
  .grid5 ol { margin: 0; padding-left: 5mm; }
  .grid5 li { font-size: 8pt; line-height: 1.35; }
  .cols3 { display: grid; grid-template-columns: 1.15fr 1fr 0.8fr; gap: 8mm; }
  .cols3 h2 { margin-top: 3mm; }
  table.icons td, table.icons th { padding: 1mm 3mm 1mm 0; font-size: 8.4pt; line-height: 1.3; }
  table.icons td:last-child { max-width: 150mm; }
  .page.strips { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.5mm; padding: 6mm 14mm; }
  .strips .runner { position: absolute; top: 1.5mm; left: 14mm; margin: 0; font-size: 8pt; color: #999; }
  .strip { display: block; }
  table { border-collapse: collapse; font-size: 9.5pt; }
  td, th { text-align: left; padding: 1.6mm 3mm 1.6mm 0; vertical-align: top; border-bottom: 0.2mm solid #ddd; }
  th { font-weight: 700; }
`;

export function document(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** writes kit/<name>.html for each document, and the PDFs with headless Chrome when asked */
export async function publish(docs: { name: string; html: string }[], pdf: boolean) {
  await mkdir('kit', { recursive: true });
  for (const d of docs) await writeFile(`kit/${d.name}.html`, d.html);
  if (!pdf) return;
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  for (const d of docs) {
    await p.goto('file://' + process.cwd() + `/kit/${d.name}.html`);
    await p.pdf({ path: `kit/${d.name}.pdf`, preferCSSPageSize: true, printBackground: true });
  }
  await browser.close();
  console.log(docs.map((d) => `kit/${d.name}.pdf`).join(', '), 'écrits');
}
