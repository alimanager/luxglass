/**
 * Prints the measurements of every form and every kit strip at size M: lens width (A), lens height (B),
 * bridge (DBL), total front width, rim range. Used to check the drawings against typical family dimensions.
 *
 *   npx tsx scripts/kit-measure.ts
 */
import { CONSTRUCTIONS, FORMS, SHAPES, make, type FormId, type Shape } from './kit-shapes';
import { aperture, drawFrame } from './kit-render';

export function measure(s: Shape, k = 1) {
  const ap = aperture(s, k);
  const xs = ap.map((p) => p[0]);
  const ys = ap.map((p) => p[1]);
  const d = drawFrame(s, k);
  const rims = s.rim ? ap.map(([x, y]) => s.rim!(x / k, y / k) * k) : [];
  return {
    A: Math.max(...xs) - Math.min(...xs),
    B: Math.max(...ys) - Math.min(...ys),
    DBL: s.gap * k,
    total: d.width,
    height: d.height,
    rim: rims.length ? [Math.min(...rims), Math.max(...rims)] : null,
  };
}

const r1 = (n: number) => n.toFixed(1);
const line = (name: string, s: Shape) => {
  const m = measure(s);
  return `${name.padEnd(34)} A ${r1(m.A).padStart(5)}  B ${r1(m.B).padStart(5)}  DBL ${r1(m.DBL).padStart(4)}  front ${r1(m.total).padStart(6)} × ${r1(m.height).padStart(5)}${m.rim ? `  rim ${r1(m.rim[0])}–${r1(m.rim[1])}` : ''}`;
};

if (process.argv[1]?.endsWith('kit-measure.ts')) {
  console.log('--- forms, acetate / metal, M');
  for (const f of Object.keys(FORMS) as FormId[]) {
    console.log(line(f + ' acetate', make({ form: f, construction: 'acetate' })));
    console.log(line(f + ' metal', make({ form: f, construction: 'metal' })));
  }
  console.log('--- kit, M');
  for (const s of SHAPES) console.log(line(s.id, s));
  void CONSTRUCTIONS;
}
