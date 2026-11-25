/**
 * Cover page and sleeve (étui) of the try-on kit. Sober line work: the strips fanned on their ring,
 * each frame drawn as a single outline; and a die line for a card sleeve that holds the deck,
 * ring outside, closed by a tuck flap at the other end.
 */
import { aperture, edgeAt, fmt } from './kit-render';
import type { Shape, V2 } from './kit-shapes';
import { PAGE_H, PAGE_W, STRIP_H, STRIP_W, page } from './kit-layout';

const pathOf = (pts: V2[]) => 'M' + pts.map(([x, y]) => `${fmt(x)} ${fmt(-y)}`).join('L') + 'Z';

/** a frame as a single-line drawing: both lenses, the bridge, the temple stubs; centred on (0, 0) */
export function outline(shape: Shape, k = 1): { d: string; width: number; height: number } {
  const ap = aperture(shape, k);
  const xs = ap.map((p) => p[0]);
  const ys = ap.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const g = (shape.gap * k) / 2;
  const cx = g - minX;
  const right = ap.map(([x, y]) => [x + cx, y] as V2);
  const left = right.map(([x, y]) => [-x, y] as V2).reverse();
  const hi = Math.max(...ys);
  const lo = Math.min(...ys);
  const yb = Math.min(hi - 4 * k, (shape.bridgeTop ?? 10) * k);
  const xb = edgeAt(right, yb, 'min') ?? g;
  const yh = hi * 0.6;
  const xh = edgeAt(right, yh, 'max') ?? cx + maxX;
  const bridge = `M${fmt(-xb)} ${fmt(-yb)}Q0 ${fmt(-(yb + 5 * k))} ${fmt(xb)} ${fmt(-yb)}`;
  const stubs = [1, -1].map((s) => `M${fmt(s * xh)} ${fmt(-yh)}l${fmt(s * 5 * k)} ${fmt(-0.8 * k)}`).join('');
  return { d: pathOf(right) + pathOf(left) + bridge + stubs, width: 2 * (xh + 5 * k), height: hi - lo };
}

/** the swatch book fanned on its ring, for the cover */
function fan(shapes: Shape[], scale: number): string {
  const n = shapes.length;
  const holeX = STRIP_W - 9;
  const holeY = STRIP_H / 2;
  return shapes
    .map((s, i) => {
      const angle = (n - 1 - i) * 7;
      const o = outline(s);
      const cx = 12 + o.width / 2;
      return `<g transform="rotate(${angle}) scale(${scale}) translate(${-holeX} ${-holeY})">
        <rect width="${STRIP_W}" height="${STRIP_H}" rx="1.2" fill="#fff" stroke="#9a9a9a" stroke-width="0.35"/>
        <circle cx="${holeX}" cy="${holeY}" r="3" fill="none" stroke="#9a9a9a" stroke-width="0.35"/>
        <path d="${o.d}" transform="translate(${fmt(cx)} ${holeY})" fill="none" stroke="#1a1a1a" stroke-width="0.55" stroke-linejoin="round" stroke-linecap="round"/>
      </g>`;
    })
    .join('');
}

export function coverPage(o: { size: { id: string; label: string }; count: number; shapes: Shape[] }): string {
  const ringR = 9;
  return page(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${PAGE_H}mm" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Helvetica, Arial, sans-serif" fill="#111">
      <text x="22" y="26" font-size="4" letter-spacing="1.6" fill="#555">LUXOPTIC</text>
      <line x1="22" y1="30" x2="275" y2="30" stroke="#111" stroke-width="0.3"/>
      <text x="22" y="56" font-size="15" font-weight="700" letter-spacing="-0.3">Kit d’essayage</text>
      <text x="22" y="68" font-size="5.4" fill="#444">${o.count} montures iconiques, à taille réelle</text>
      <text x="22" y="76" font-size="5.4" fill="#444">à tenir devant les yeux</text>
      <g transform="translate(22 128)">
        <rect width="30" height="30" fill="none" stroke="#111" stroke-width="0.5"/>
        <text x="15" y="22" font-size="20" font-weight="700" text-anchor="middle">${o.size.id}</text>
        <text x="36" y="12" font-size="4" font-weight="700">Taille ${o.size.id}</text>
        <text x="36" y="18.5" font-size="3.4" fill="#555">${o.size.label}</text>
      </g>
      <g transform="translate(255 160)">
        ${fan(o.shapes, 0.62)}
        <circle r="${ringR}" cx="${ringR}" fill="none" stroke="#111" stroke-width="0.9"/>
      </g>
      <line x1="22" y1="184" x2="275" y2="184" stroke="#111" stroke-width="0.3"/>
      <text x="22" y="191" font-size="3.2" fill="#555">Bandes transparentes de 230 × 64 mm, à imprimer sur film à 100 %, découper et relier sur un anneau.</text>
      <text x="275" y="191" font-size="3.2" fill="#555" text-anchor="end">Dessins originaux, sans marque</text>
    </svg>`,
    'bare'
  );
}

/** die line of a card sleeve for the strip deck: cut (solid), fold (dashed), glue (hatched) */
export function sleevePage(o: { size: { id: string }; count: number }): string {
  const W = STRIP_H + 3; // panel height: strip height and play
  const D = 6; // depth: the deck of film strips, with room to slide
  const L = STRIP_W - 18; // sleeve length: covers the strips up to 9 mm before the hole, the ring stays out
  const G = 12; // glue flap
  const T = 14; // tuck flap
  const F = 10; // dust flaps
  const y1 = G;
  const y2 = y1 + W;
  const y3 = y2 + D;
  const y4 = y3 + W;
  const y5 = y4 + D;
  const notch = (yc: number) => `L0 ${fmt(yc + 10)}A10 10 0 0 0 0 ${fmt(yc - 10)}`;
  const outline = [
    `M4 0L${L - 4} 0L${L} ${y1}`, // glue flap, tapered
    `L${L} ${y2}`, // front: plain edge at the closed end
    `L${L + F} ${y2 + 1.5}L${L + F} ${y3 - 0.8}L${L + 0.8} ${y3}`, // dust flap
    `L${L + D} ${y3}L${L + D} ${y3 + 1}L${L + D + T - 4} ${y3 + 1}Q${L + D + T} ${y3 + 1} ${L + D + T} ${y3 + 5}`, // end panel, tuck flap
    `L${L + D + T} ${y4 - 5}Q${L + D + T} ${y4 - 1} ${L + D + T - 4} ${y4 - 1}L${L + D} ${y4 - 1}L${L + D} ${y4}`,
    `L${L + 0.8} ${y4}L${L + F} ${y4 + 0.8}L${L + F} ${y5 - 1.5}L${L} ${y5}`, // dust flap
    `L0 ${y5}L0 ${y4}`,
    notch((y3 + y4) / 2), // thumb notch, back
    `L0 ${y2}`,
    notch((y1 + y2) / 2), // thumb notch, front
    `L0 ${y1}Z`,
  ].join('');
  const folds = [
    `M0 ${y1}H${L}`,
    `M0 ${y2}H${L}`,
    `M0 ${y3}H${L}`,
    `M0 ${y4}H${L}`,
    `M${L} ${y2}V${y5}`,
    `M${L + D} ${y3 + 1}V${y4 - 1}`,
  ].join('');
  const hatch = Array.from({ length: Math.ceil(L / 4) }, (_, i) => `M${fmt(6 + i * 4)} ${y1 - 1}l${-(G - 2) * 0.5} ${-(G - 2)}`)
    .filter((_, i) => 6 + i * 4 < L - 4)
    .join('');
  const ox = 26;
  const oy = 34;
  const front = (y1 + y2) / 2;
  return page(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${PAGE_H}mm" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Helvetica, Arial, sans-serif" fill="#111">
      <text x="${ox}" y="16" font-size="7" font-weight="700">Étui du carnet</text>
      <text x="${ox}" y="23" font-size="3.2" fill="#444">Imprime cette page sur une carte de 250 à 300 g/m², à 100 %. Coupe les traits pleins, marque les pointillés
        au dos d’un couteau et plie-les vers l’intérieur,</text>
      <text x="${ox}" y="27.5" font-size="3.2" fill="#444">colle la patte hachurée à l’intérieur du dernier flanc. Glisse les bandes par le bout libre : l’anneau reste dehors.
        Le rabat rentre dans l’étui pour le fermer.</text>
      <g transform="translate(${ox} ${oy})">
        <path d="${hatch}" stroke="#bbb" stroke-width="0.25"/>
        <text x="${L / 2}" y="${y1 - 4}" font-size="3" fill="#777" text-anchor="middle">colle</text>
        <g transform="translate(14 ${front})">
          <text y="-8" font-size="3" letter-spacing="1.2" fill="#555">LUXOPTIC</text>
          <text y="4" font-size="8" font-weight="700">Kit d’essayage</text>
          <text y="12" font-size="3.6" fill="#444">${o.count} montures à taille réelle</text>
        </g>
        <g transform="translate(${L - 34} ${front - 12})">
          <rect width="24" height="24" fill="none" stroke="#111" stroke-width="0.45"/>
          <text x="12" y="17.5" font-size="16" font-weight="700" text-anchor="middle">${o.size.id}</text>
        </g>
        <text x="${L / 2}" y="${(y2 + y3) / 2 + 1}" font-size="2.6" fill="#777" text-anchor="middle">Kit d’essayage, taille ${o.size.id}</text>
        <text x="${L / 2}" y="${(y4 + y5) / 2 + 1}" font-size="2.6" fill="#777" text-anchor="middle">Kit d’essayage, taille ${o.size.id}</text>
        <text x="16" y="${(y3 + y4) / 2 - 2}" font-size="3.4" fill="#555">Côté ouvert : glisse le carnet, anneau à l’extérieur.</text>
        <text x="16" y="${(y3 + y4) / 2 + 4}" font-size="3" fill="#888">Une main tient l’anneau, l’autre tire les bandes une à une.</text>
        <text x="${L + D + T / 2}" y="${(y3 + y4) / 2}" font-size="2.6" fill="#777" text-anchor="middle" transform="rotate(90 ${L + D + T / 2} ${(y3 + y4) / 2})">rabat</text>
        <path d="${outline}" fill="none" stroke="#000" stroke-width="0.3" stroke-linejoin="round"/>
        <path d="${folds}" fill="none" stroke="#000" stroke-width="0.25" stroke-dasharray="2 1.4"/>
      </g>
      <g transform="translate(${ox} ${PAGE_H - 10})" font-size="3" fill="#444">
        <line x1="0" y1="-1" x2="10" y2="-1" stroke="#000" stroke-width="0.3"/><text x="13">couper</text>
        <line x1="34" y1="-1" x2="44" y2="-1" stroke="#000" stroke-width="0.25" stroke-dasharray="2 1.4"/><text x="47">plier</text>
        <rect x="64" y="-3" width="8" height="4" fill="none" stroke="#bbb" stroke-width="0.25"/><text x="75">coller</text>
        <text x="${L + D + T}" text-anchor="end">Étui fermé : ${L} × ${W} × ${D} mm, pour ${o.count} bandes de ${STRIP_W} × ${STRIP_H} mm</text>
      </g>
    </svg>`,
    'bare'
  );
}
