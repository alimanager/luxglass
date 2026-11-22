import type { Point } from '../lib/faceModel';

/**
 * A frontal, perfectly symmetric synthetic face in image pixels, built from
 * millimetre measurements of an average adult (1 px = `pxPerMm` mm⁻¹).
 * Only the landmarks used by the app are placed; the rest sit on the nose.
 */
export function syntheticFace(opts: { pxPerMm?: number; cx?: number; cy?: number; faceWidth?: number; faceLength?: number; jaw?: number; browThick?: number; browArch?: number; eyeTilt?: number } = {}): Point[] {
  const s = opts.pxPerMm ?? 4;
  const cx = opts.cx ?? 640;
  const cy = opts.cy ?? 480;
  const W = opts.faceWidth ?? 136; // cheek to cheek, mm
  const Lh = opts.faceLength ?? 165; // landmark 10 to chin, mm
  const J = opts.jaw ?? 104;
  const pts: Point[] = Array.from({ length: 478 }, () => ({ x: cx, y: cy, z: 0 }));
  // mm coordinates: x to the image right, y down, origin between the pupils
  const set = (i: number, x: number, y: number, z = 0) => (pts[i] = { x: cx + x * s, y: cy + y * s, z: z * s });
  const pair = (r: number, l: number, x: number, y: number, z = 0) => {
    set(r, -x, y, z);
    set(l, x, y, z);
  };
  set(10, 0, -Lh * 0.42, 10);
  set(152, 0, Lh * 0.58, 0);
  set(9, 0, -18, -2);
  set(168, 0, -2, -6);
  set(6, 0, 8, -10);
  set(197, 0, 18, -14);
  set(1, 0, 42, -22);
  set(4, 0, 38, -20);
  set(2, 0, 48, -14);
  set(13, 0, 66, -10);
  set(151, 0, -40, 4);
  pair(234, 454, W / 2, 10, 40);
  pair(172, 397, J / 2, 62, 30);
  pair(103, 332, W * 0.4, -45, 15);
  pair(33, 263, 46, 0, 8);
  pair(133, 362, 16, 0, 6);
  pair(70, 300, 48, -14, 4);
  pair(107, 336, 14, -16, 0);
  pair(61, 291, 24, 66, -4);
  pair(129, 358, 15, 42, -12);
  pair(50, 280, 42, 28, 8);
  pair(148, 377, 18, 88, 2);
  // eyebrows: thickness and arch in mm, eye tilt in degrees (outer corner higher when > 0)
  const browThick = opts.browThick ?? 5.5;
  const browArch = opts.browArch ?? 3;
  const bump = [0.3, 0.8, 1, 0.7, 0.2];
  const xs = [48, 40, 31, 22, 14];
  const upperR = [70, 63, 105, 66, 107];
  const lowerR = [46, 53, 52, 65, 55];
  const upperL = [300, 293, 334, 296, 336];
  const lowerL = [276, 283, 282, 295, 285];
  xs.forEach((x, i) => {
    const y = -16 - browArch * bump[i];
    set(upperR[i], -x, y);
    set(upperL[i], x, y);
    set(lowerR[i], -x, y + browThick);
    set(lowerL[i], x, y + browThick);
  });
  // eye corners carry the tilt; upper eyelid sits 11 mm below the brow's lower edge
  const tilt = Math.tan(((opts.eyeTilt ?? 5) * Math.PI) / 180) * 30;
  set(33, -46, -tilt / 2);
  set(263, 46, -tilt / 2);
  set(133, -16, tilt / 2);
  set(362, 16, tilt / 2);
  set(159, -31.5, -16 + browThick + 11);
  set(386, 31.5, -16 + browThick + 11);
  // pupils (PD 63 mm) and iris rings (11.7 mm)
  const iris = (center: number, ring: number[], x: number) => {
    set(center, x, 0, 2);
    const r = 11.7 / 2;
    set(ring[0], x + r, 0, 2);
    set(ring[1], x, -r, 2);
    set(ring[2], x - r, 0, 2);
    set(ring[3], x, r, 2);
  };
  iris(468, [469, 470, 471, 472], -31.5);
  iris(473, [474, 475, 476, 477], 31.5);
  return pts;
}
