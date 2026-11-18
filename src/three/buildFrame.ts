import * as THREE from 'three';
import type { FrameSpec, LensShape } from './frameSpec';

/**
 * Builds a pair of glasses from a FrameSpec. Units are millimetres.
 * Origin: centre of the bridge, at lens-centre height. +x = wearer's left on screen
 * (we build symmetric anyway), +y up, +z towards the viewer; temples go to -z.
 */

type V2 = [number, number];

const smooth = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

/** Lens outline, CCW, centred on (0,0), x>0 = temple side, x<0 = nose side. */
export function lensOutline(l: LensShape, segments = 160): V2[] {
  const a = l.w / 2;
  const b = l.h / 2;
  const pts: V2[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let x: number;
    let y: number;
    if (l.sides) {
      const k = l.sides;
      const seg = (Math.PI * 2) / k;
      const local = ((t + seg / 2) % seg) - seg / 2;
      const r = Math.cos(seg / 2) / Math.cos(local);
      const rr = 0.82 * r + 0.18; // rounded corners
      x = a * rr * c;
      y = b * rr * s;
    } else {
      x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / l.n);
      y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / l.n);
    }
    x *= 1 + l.taper * (y / b);
    y += l.lift * smooth(x / a) * smooth(y / b + 0.35);
    if (y < 0) y -= l.drop * smooth(0.5 - x / l.w) * (-y / b);
    pts.push([x, y]);
  }
  // re-centre vertically on the bounding box
  const ys = pts.map((p) => p[1]);
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const xs = pts.map((p) => p[0]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  return pts.map(([x, y]) => [x - cx, y - cy]);
}

/** Offsets a CCW closed outline outwards by d (approximate, fine for convex-ish lenses). */
export function offsetOutline(pts: V2[], d: number): V2[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    return [p[0] + (ty / len) * d, p[1] - (tx / len) * d];
  });
}

const mirrorX = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y] as V2).reverse();

// ---------- materials ----------

let tortoiseCache: THREE.Texture | null = null;
function tortoiseTexture(): THREE.Texture {
  if (tortoiseCache) return tortoiseCache;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a170c';
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (color: string, count: number, rMin: number, rMax: number, alpha: number) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = rMin + rnd() * (rMax - rMin);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha;
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, y, r * (0.6 + rnd()), r, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  };
  blob('#6b3814', 40, 50, 120, 0.85);
  blob('#a9672a', 45, 25, 70, 0.75);
  blob('#d49a4c', 30, 12, 34, 0.55);
  blob('#120804', 50, 20, 60, 0.85);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 80, 1 / 80);
  tex.anisotropy = 4;
  tortoiseCache = tex;
  return tex;
}

function acetateMaterial(spec: FrameSpec): THREE.Material {
  if (spec.finish === 'tortoise') {
    return new THREE.MeshPhysicalMaterial({
      map: tortoiseTexture(),
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: spec.frameColor,
    roughness: spec.finish === 'matte' ? 0.75 : 0.2,
    clearcoat: spec.finish === 'matte' ? 0 : 1,
    clearcoatRoughness: 0.06,
  });
}

const metalMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22, envMapIntensity: 1.3 });

const lensMaterial = (spec: FrameSpec) =>
  new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: spec.lensOpacity,
    clearcoat: 1,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

// ---------- geometry helpers ----------

function shapeFrom(pts: V2[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.7): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.1, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 4,
    curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2 + bevel);
  geo.computeVertexNormals();
  return geo;
}

function tube(points: THREE.Vector3[], radius: number, closed = false, segments = 160): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, 12, closed);
}

/** Curved lens surface (spherical base curve) from an outline. */
function lensGeometry(pts: V2[], tint: string): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(shapeFrom(pts), 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const R = 110;
  const ys = pts.map((p) => p[1]);
  const top = Math.max(...ys);
  const bottom = Math.min(...ys);
  const dark = new THREE.Color(tint);
  const light = dark.clone().lerp(new THREE.Color('#ffffff'), 0.22);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -(x * x + y * y) / (2 * R) + 1.2);
    // gradient lens: darker at the top, lighter at the bottom
    c.copy(dark).lerp(light, Math.pow((top - y) / (top - bottom), 1.6));
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---------- assembly ----------

export interface BuiltFrame {
  group: THREE.Group;
  /** total width in mm, for sizing on a face */
  width: number;
  /** y of the hinges, z of the front face */
  hingeY: number;
  /**
   * Where the frame touches the nose, in frame mm: the bridge underside for acetate,
   * the pads for metal. `on` says which nose landmark that point rests on.
   */
  seat: { y: number; z: number; on: 'upper' | 'mid' };
  lensHeight: number;
  dispose: () => void;
}

export function buildFrame(spec: FrameSpec): BuiltFrame {
  const group = new THREE.Group();
  const toDispose: { dispose: () => void }[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    parent.add(m);
    toDispose.push(geo);
    return m;
  };

  const acetate = acetateMaterial(spec);
  const metal = metalMaterial(spec.metalColor);
  const glass = lensMaterial(spec);
  toDispose.push(acetate, metal, glass);

  const lens = lensOutline(spec.lens);
  const halfBridge = spec.bridge / 2;
  const isAcetate = spec.kind === 'acetate';

  let hingeX = 0;
  let hingeY = 0;

  for (const side of [1, -1] as const) {
    // pivot at the bridge edge so the face-form wrap bends the outer side backwards
    const pivot = new THREE.Group();
    pivot.position.set(side * halfBridge, 0, 0);
    pivot.rotation.y = (side * spec.wrap * Math.PI) / 180;
    group.add(pivot);
    const holder = new THREE.Group();
    holder.position.set(side * (spec.lens.w / 2), 0, 0);
    pivot.add(holder);

    const local = side === 1 ? lens : mirrorX(lens);
    const lensPts = offsetOutline(local, isAcetate ? 0.8 : 0.3);
    add(lensGeometry(lensPts, spec.lensTint), glass, holder).renderOrder = 2;

    if (isAcetate) {
      const outer = offsetOutline(local, spec.rim);
      const shape = shapeFrom(outer);
      shape.holes.push(shapeFrom([...local].reverse()));
      add(extrude(shape, spec.depth), acetate, holder);
    } else {
      // metal wire rim
      const wire = offsetOutline(local, 0.5).map(([x, y]) => new THREE.Vector3(x, y, 0));
      add(tube(wire, spec.rim, true, 220), metal, holder);
      if (spec.kind === 'browline') {
        // acetate brow over the upper part of the lens
        const top = local.filter(([, y]) => y > spec.lens.h * 0.08);
        const sorted = [...top].sort((p, q) => p[0] - q[0]);
        const upper = offsetOutline(local, 5.5).filter(([, y]) => y > spec.lens.h * 0.08).sort((p, q) => p[0] - q[0]);
        const band: V2[] = [...upper, ...sorted.reverse().map(([x, y]) => [x, y - 0.6] as V2)];
        add(extrude(shapeFrom(band), 5.5), acetate, holder);
      } else {
        // nose pads on the nasal side
        const pad = new THREE.SphereGeometry(1, 16, 12);
        pad.scale(3.2, 5.5, 1.2);
        const padMat = new THREE.MeshPhysicalMaterial({ color: '#e8ecec', roughness: 0.3, transparent: true, opacity: 0.7 });
        toDispose.push(padMat);
        const p = add(pad, padMat, holder);
        p.position.set(-side * (spec.lens.w / 2 - 4), -spec.lens.h * 0.12, -6);
        p.rotation.y = side * 0.5;
        const arm = [
          new THREE.Vector3(-side * (spec.lens.w / 2 - 1), spec.lens.h * 0.08, -0.5),
          new THREE.Vector3(-side * (spec.lens.w / 2 - 3), -spec.lens.h * 0.02, -3.5),
          new THREE.Vector3(-side * (spec.lens.w / 2 - 4), -spec.lens.h * 0.1, -5.5),
        ];
        add(tube(arm, 0.4, false, 20), metal, holder);
      }
    }

    // hinge: outermost point of the upper half
    const outerPts = offsetOutline(local, isAcetate ? spec.rim : 1);
    let best: V2 = outerPts[0];
    for (const p of outerPts) if (side * p[0] > side * best[0] && p[1] > spec.lens.h * 0.05) best = p;
    group.updateMatrixWorld(true);
    const hw = holder.localToWorld(new THREE.Vector3(best[0], best[1] - 2, 0));
    hingeX = Math.abs(hw.x);
    hingeY = hw.y;

    // end piece
    const endGeo = new THREE.BoxGeometry(isAcetate ? spec.rim * 0.9 : 2.2, isAcetate ? spec.rim * 1.4 : 4, 9);
    const end = add(endGeo, isAcetate ? acetate : metal, group);
    end.position.set(side * (hingeX - (isAcetate ? spec.rim * 0.45 : 1)), hingeY, hw.z - 5);
    end.rotation.y = (side * spec.wrap * Math.PI) / 180;

    // temple
    const tx = side * (hingeX - 0.8);
    const z0 = hw.z - 9;
    // temples drop slightly towards the ears (pantoscopic tilt ~8°), then bend down behind them
    const tilt = Math.tan((8 * Math.PI) / 180);
    const at = (dx: number, dz: number, dy = 0) => new THREE.Vector3(tx + side * dx, hingeY + dy - tilt * dz, z0 - dz);
    const L = spec.temple;
    const path = [at(0, 0), at(2, 35), at(3.5, 80, -0.5), at(4, L * 0.78, -1), at(3.5, L * 0.95, -12), at(3, L * 1.02, -22)];
    if (isAcetate && !spec.metalTemples) {
      // flat acetate temple: wide tube squashed sideways around its own axis
      const geo = tube(path.map((v) => new THREE.Vector3(0, v.y, v.z)), 2.3, false, 80);
      geo.scale(0.45, 1, 1);
      geo.translate(tx, 0, 0);
      add(geo, acetate, group).userData.part = 'temple';
    } else {
      add(tube(path.slice(0, 4), spec.kind === 'metal' ? 0.75 : 0.9, false, 60), metal, group).userData.part = 'temple';
      const tip = tube(path.slice(3), 1.7, false, 40);
      add(tip, isAcetate || spec.kind === 'browline' ? acetate : new THREE.MeshPhysicalMaterial({ color: '#1a1a1a', roughness: 0.4 }), group).userData.part = 'temple';
    }
  }

  // bridge
  const yTop = spec.lens.h * 0.32;
  if (isAcetate) {
    // keyhole bridge: flush with the top of the rims, arching up over the nose
    const bw = halfBridge - spec.rim * 0.35;
    const yT = spec.lens.h * 0.36 + spec.rim * 0.7;
    const pts: V2[] = [];
    for (let i = 0; i <= 32; i++) {
      const x = bw - (2 * bw * i) / 32;
      pts.push([x, yT - spec.rim * 1.5 - (1 - Math.cos((x / bw) * (Math.PI / 2))) * spec.lens.h * 0.2]);
    }
    add(extrude(shapeFrom([[-bw, yT], [bw, yT], ...pts]), spec.depth), acetate, group);
  } else {
    const r = spec.kind === 'browline' ? 1 : spec.rim;
    const arc = [-1, -0.5, 0, 0.5, 1].map(
      (u) => new THREE.Vector3(u * (halfBridge + 1.5), yTop - 2 + 5 * (1 - u * u), 0.6 * (1 - u * u))
    );
    add(tube(arc, r, false, 40), metal, group);
    if (spec.doubleBridge) {
      const bar = [-1, 0, 1].map((u) => new THREE.Vector3(u * (halfBridge + spec.lens.w * 0.42), spec.lens.h * 0.48, 0.4 * (1 - u * u)));
      add(tube(bar, r * 0.9, false, 40), metal, group);
    }
    if (spec.kind === 'browline') {
      const bw = halfBridge + 2;
      add(extrude(shapeFrom([[-bw, yTop + 4.5], [bw, yTop + 4.5], [bw, yTop + 0.5], [-bw, yTop + 0.5]]), 5), acetate, group);
    }
  }

  const seat: BuiltFrame['seat'] =
    spec.kind === 'acetate'
      ? { y: spec.lens.h * 0.36 - spec.rim * 0.8, z: -spec.depth / 2, on: 'upper' }
      : spec.kind === 'browline'
      ? { y: spec.lens.h * 0.32 - 3, z: -1, on: 'upper' }
      : { y: -spec.lens.h * 0.12, z: -2, on: 'mid' };

  return {
    group,
    width: hingeX * 2,
    hingeY,
    seat,
    lensHeight: spec.lens.h,
    dispose: () => toDispose.forEach((d) => d.dispose()),
  };
}
