import * as THREE from 'three';

/** Landmark as [x, y, z] in image pixels (z on the same scale as x, smaller = closer). */
export type LM = ArrayLike<number> | { x: number; y: number; z?: number };

const IRIS_MM = 11.7;

const v = (p: LM): THREE.Vector3 => {
  if ('x' in (p as object)) {
    const q = p as { x: number; y: number; z?: number };
    return new THREE.Vector3(q.x, -q.y, -(q.z ?? 0));
  }
  const a = p as ArrayLike<number>;
  return new THREE.Vector3(a[0], -a[1], -(a[2] ?? 0));
};

export interface FacePose {
  /** lens-centre anchor in scene units (image pixels, y up) */
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** pixels per millimetre at the face */
  pxPerMm: number;
  /** head occluder */
  headCenter: THREE.Vector3;
  headRadii: THREE.Vector3;
  /** skin points where a frame rests: nasal bridge (168) and mid nose (197) */
  noseUpper: THREE.Vector3;
  noseMid: THREE.Vector3;
  /** midpoint between the pupils */
  pupils: THREE.Vector3;
}

/**
 * Head pose from FaceMesh landmarks. Scale comes from the iris (11.7 mm), so the frame
 * is shown at its real size on the face.
 */
export function facePose(lm: LM[], matrix?: number[] | null): FacePose {
  const right = v(lm[454]).sub(v(lm[234]));
  const faceWidthPx = right.length();
  right.normalize();
  const upRaw = v(lm[10]).sub(v(lm[152])).normalize();
  const forward = new THREE.Vector3().crossVectors(right, upRaw).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, forward);
  let quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);

  // Prefer the model's own head-pose matrix (fitted on the whole mesh): steadier,
  // and correct in profile where landmark depth gets noisy. Ignore it if it
  // disagrees wildly with the landmarks (bad frame).
  if (matrix && matrix.length === 16) {
    const m = new THREE.Matrix4().fromArray(matrix);
    const q = new THREE.Quaternion();
    m.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    if (q.angleTo(quaternion) < 0.6) quaternion = q;
  }
  const qBasis = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  right.setFromMatrixColumn(qBasis, 0);
  up.setFromMatrixColumn(qBasis, 1);
  forward.setFromMatrixColumn(qBasis, 2);

  const irisPx = (ring: number[]) => {
    const p = ring.map((i) => v(lm[i]));
    return (p[0].distanceTo(p[2]) + p[1].distanceTo(p[3])) / 2;
  };
  const iris = (irisPx([469, 470, 471, 472]) + irisPx([474, 475, 476, 477])) / 2;
  const pxPerMm = iris / IRIS_MM;

  // Fallback lens centre: between the pupils, ~13 mm in front of the eyes, 2 mm up.
  // (The renderer seats the frame on the nose instead, see TryOnRenderer.)
  const pupils = v(lm[468]).add(v(lm[473])).multiplyScalar(0.5);
  const position = pupils.clone().addScaledVector(forward, 13 * pxPerMm).addScaledVector(up, 2 * pxPerMm);

  // Head volume: hides the far temple when the head turns.
  const half = faceWidthPx / 2;
  // The skull above the ears is wider than the cheek landmarks: temples run inside it.
  const headRadii = new THREE.Vector3(half * 1.18, half * 1.45, half * 1.5);
  const headCenter = v(lm[234]).add(v(lm[454])).multiplyScalar(0.5).addScaledVector(forward, -headRadii.z * 0.8);

  return { position, quaternion, pxPerMm, headCenter, headRadii, noseUpper: v(lm[168]), noseMid: v(lm[197]), pupils };
}

/** One Euro filter: smooth when still, responsive when moving. */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(private minCutoff = 1.2, private beta = 0.02, private dCutoff = 1) {}
  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, time: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = time;
      return value;
    }
    const dt = Math.max(1e-3, (time - this.t) / 1000);
    this.t = time;
    const dxRaw = (value - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (dxRaw - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
  reset() {
    this.x = null;
  }
}

export class PoseSmoother {
  // position/scale react fast (beta high); rotation is smoothed harder, jitter shows most there
  private f = [...Array.from({ length: 4 }, () => new OneEuro(1.5, 0.05)), ...Array.from({ length: 4 }, () => new OneEuro(1.0, 0.3))];
  private points = Array.from({ length: 9 }, () => new OneEuro(1.5, 0.05));
  private vec(v: THREE.Vector3, k: number, time: number) {
    return new THREE.Vector3(
      this.points[k].filter(v.x, time),
      this.points[k + 1].filter(v.y, time),
      this.points[k + 2].filter(v.z, time)
    );
  }
  private last = new THREE.Quaternion();
  smooth(p: FacePose, time: number): FacePose {
    const [px, py, pz, s] = [p.position.x, p.position.y, p.position.z, p.pxPerMm].map((x, i) => this.f[i].filter(x, time));
    const q = p.quaternion.clone();
    if (q.dot(this.last) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // keep the same hemisphere
    const qs = [q.x, q.y, q.z, q.w].map((x, i) => this.f[4 + i].filter(x, time));
    const quaternion = new THREE.Quaternion(qs[0], qs[1], qs[2], qs[3]).normalize();
    this.last.copy(quaternion);
    return {
      ...p,
      position: new THREE.Vector3(px, py, pz),
      pxPerMm: s,
      quaternion,
      noseUpper: this.vec(p.noseUpper, 0, time),
      noseMid: this.vec(p.noseMid, 3, time),
      pupils: this.vec(p.pupils, 6, time),
    };
  }
  reset() {
    this.f.forEach((f) => f.reset());
    this.points.forEach((f) => f.reset());
  }
}
