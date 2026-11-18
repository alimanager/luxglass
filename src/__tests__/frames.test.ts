import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { products } from '../lib/catalog';
import { lensOutline, offsetOutline } from '../three/buildFrame';
import { frameWidth, sizeMarking } from '../three/frameSpec';
import { facePose, OneEuro } from '../three/faceAnchor';
import { syntheticFace } from './syntheticFace';

describe('catalogue', () => {
  it('donne à chaque monture des cotes plausibles', () => {
    for (const p of products) {
      expect(p.marking).toMatch(/^\d{2}□\d{2} \d{3}$/);
      expect(frameWidth(p.spec)).toBeGreaterThan(118);
      expect(frameWidth(p.spec)).toBeLessThan(160);
      expect(sizeMarking(p.spec)).toBe(p.marking);
    }
  });
});

describe('verres', () => {
  it.each(products.map((p) => [p.name, p.spec] as const))('%s : contour à la bonne taille', (_, spec) => {
    const pts = lensOutline(spec.lens);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    expect(Math.abs(w - spec.lens.w) / spec.lens.w).toBeLessThan(0.25);
    expect(Math.abs(h - spec.lens.h) / spec.lens.h).toBeLessThan(0.3);
    // counter-clockwise (positive signed area), so offsets go outwards
    let area = 0;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      area += p[0] * q[1] - q[0] * p[1];
    });
    expect(area).toBeGreaterThan(0);
  });

  it('élargit le contour quand on le décale vers l’extérieur', () => {
    const pts = lensOutline(products[0].spec.lens);
    const out = offsetOutline(pts, 5);
    const width = (q: [number, number][]) => Math.max(...q.map((p) => p[0])) - Math.min(...q.map((p) => p[0]));
    expect(width(out)).toBeCloseTo(width(pts) + 10, 0);
  });
});

describe('pose de la tête', () => {
  it('visage de face : pas de rotation, échelle tirée de l’iris', () => {
    const pose = facePose(syntheticFace({ pxPerMm: 4 }));
    expect(pose.pxPerMm).toBeCloseTo(4, 5);
    expect(pose.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.15);
  });

  it('suit une tête penchée sur le côté', () => {
    const p = syntheticFace({ cx: 0, cy: 0 });
    const a = 0.3;
    const rolled = p.map((q) => ({ x: q.x * Math.cos(a) - q.y * Math.sin(a), y: q.x * Math.sin(a) + q.y * Math.cos(a), z: q.z }));
    const pose = facePose(rolled);
    const euler = new THREE.Euler().setFromQuaternion(pose.quaternion);
    // image y points down, scene y up: a clockwise roll in the image is negative around z
    expect(euler.z).toBeCloseTo(-a, 1);
  });

  it('ignore une matrice du modèle qui contredit les points', () => {
    const p = syntheticFace();
    const flipped = new THREE.Matrix4().makeRotationY(Math.PI / 2).toArray();
    expect(facePose(p, flipped).quaternion.angleTo(facePose(p).quaternion)).toBeLessThan(1e-6);
  });
});

describe('lissage One Euro', () => {
  it('converge vers une valeur stable', () => {
    const f = new OneEuro(1.5, 0.05);
    let v = 0;
    for (let t = 0; t < 2000; t += 33) v = f.filter(100, t);
    expect(v).toBeCloseTo(100, 3);
  });
});
