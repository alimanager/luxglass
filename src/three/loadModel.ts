import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildFrame, type BuiltFrame } from './buildFrame';
import type { FrameSpec } from './frameSpec';

/** A real 3D model of a frame (glTF/GLB), with its true total width. */
export interface FrameModel {
  url: string;
  /** total frame width in mm, from the manufacturer's sizes */
  widthMm: number;
  credit?: { author: string; source: string; license: string };
}

/** What every renderer needs: a parametric spec, optionally replaced by a real model. */
export interface FrameSource {
  spec: FrameSpec;
  model?: FrameModel;
  /** merchant photo: shown as is, no 3D */
  photo?: string;
}

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

function loadScene(url: string): Promise<THREE.Group> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => g.scene);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

function worldVertices(root: THREE.Object3D, max = 40000): THREE.Vector3[] {
  root.updateMatrixWorld(true);
  const out: THREE.Vector3[] = [];
  let total = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) total += (m.geometry.attributes.position as THREE.BufferAttribute).count;
  });
  const step = Math.max(1, Math.floor(total / max));
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += step) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  });
  return out;
}

/**
 * Normalises any glasses model to our frame space (mm, +x across the face, +y up,
 * +z out of the front, origin at the lens centre between the lenses):
 * - up is glTF's +Y;
 * - the width axis is the horizontal axis on which the vertices are symmetric,
 *   the other is the depth axis, and the front is the heavier end (lenses, rims);
 * - the scale comes from the real total width in mm.
 */
export function normaliseModel(scene: THREE.Object3D, widthMm: number): BuiltFrame {
  const clone = scene.clone(true);
  // materials are shared with the cached scene: clone them so try-on tweaks stay local
  clone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
  });
  const holder = new THREE.Group();
  holder.add(clone);

  const pts = worldVertices(holder);
  const box = new THREE.Box3().setFromPoints(pts);
  const mid = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const centroid = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const asym = (axis: 'x' | 'z') => Math.abs(centroid[axis] - mid[axis]) / (size[axis] || 1);
  const depthAxis: 'x' | 'z' = asym('x') > asym('z') ? 'x' : 'z';
  const frontSign = centroid[depthAxis] > mid[depthAxis] ? 1 : -1;

  // rotate so that the depth axis becomes +z (front) and the width axis +x
  const rot = new THREE.Group();
  rot.add(holder);
  if (depthAxis === 'x') rot.rotation.y = frontSign > 0 ? -Math.PI / 2 : Math.PI / 2;
  else if (frontSign < 0) rot.rotation.y = Math.PI;
  const widthExtent = depthAxis === 'x' ? size.z : size.x;
  const scale = widthMm / widthExtent;
  rot.scale.setScalar(scale);
  rot.updateMatrixWorld(true);

  // front slice: lenses and rims, used to find the lens centre
  const p2 = worldVertices(rot);
  const b2 = new THREE.Box3().setFromPoints(p2);
  const depth = b2.max.z - b2.min.z;
  const front = p2.filter((p) => p.z > b2.max.z - depth * 0.12);
  const fb = new THREE.Box3().setFromPoints(front);
  const centre = new THREE.Vector3((b2.min.x + b2.max.x) / 2, (fb.min.y + fb.max.y) / 2, fb.max.z - 3);
  rot.position.sub(centre);

  const group = new THREE.Group();
  group.add(rot);
  group.updateMatrixWorld(true);

  // tag parts: temples (well behind the front) cast no shadow on the face; lenses get flagged
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    if (c.z < -depth * 0.25) m.userData.part = 'temple';
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.transparent || /glass|lens|verre/i.test(mat.name)) {
      m.userData.part = 'lens';
      mat.depthWrite = false;
      m.renderOrder = 2;
    }
  });

  const frontH = fb.max.y - fb.min.y;
  const hinge = p2.filter((p) => p.z < b2.max.z - depth * 0.15 && p.z > b2.max.z - depth * 0.3);
  const hingeY = hinge.length ? hinge.reduce((s, p) => s + p.y, 0) / hinge.length - centre.y : frontH * 0.3;

  return {
    group,
    width: widthMm,
    hingeY,
    // unknown bridge geometry: rest just above the lens centre; the pupil guard does the rest
    seat: { y: frontH * 0.18, z: -4, on: 'upper' },
    lensHeight: frontH * 0.8,
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
    },
  };
}

/** Real model when there is one, parametric frame otherwise. */
export async function loadFrame(source: FrameSource): Promise<BuiltFrame> {
  if (source.model) {
    try {
      return normaliseModel(await loadScene(source.model.url), source.model.widthMm);
    } catch (err) {
      console.error('Frame model failed to load, using the parametric frame', err);
    }
  }
  return buildFrame(source.spec);
}

export const sourceKey = (s: FrameSource) => s.model?.url ?? JSON.stringify(s.spec);
