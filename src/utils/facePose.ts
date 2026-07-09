import * as THREE from 'three';

// Estimation de pose 3D de la tête depuis les landmarks MediaPipe FaceMesh,
// pour ancrer une monture en réalité augmentée.
//
// Convention monde : x vers la droite, y vers le haut, z vers la caméra.
// Les landmarks arrivent en coordonnées image (x droite, y bas, z négatif
// vers la caméra) ; on les convertit, avec miroir optionnel pour l'affichage
// « miroir de salle de bain » attendu par l'utilisateur.

export interface Keypoint {
  x: number;
  y: number;
  z?: number;
  name?: string;
}

export interface FacePose {
  // Point d'ancrage de la monture : milieu des deux iris, en pixels monde
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  pixelsPerMm: number;
  ipdMm: number;
  noseBridgeMm: number;
  faceWidthMm: number;
  faceLengthMm: number;
}

const IRIS_DIAMETER_MM = 11.7;

// Landmarks de référence (topologie MediaPipe FaceMesh)
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_TEMPLE = 234;
const RIGHT_TEMPLE = 454;
const BRIDGE_LEFT = 122;
const BRIDGE_RIGHT = 351;

function toWorld(p: Keypoint, mirror: boolean, videoWidth: number): THREE.Vector3 {
  return new THREE.Vector3(
    mirror ? videoWidth - p.x : p.x,
    -p.y,
    -(p.z ?? 0)
  );
}

function centroid(points: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  points.forEach(p => c.add(p));
  return c.divideScalar(points.length);
}

function irisHorizontalDiameterPx(irisWorld: THREE.Vector3[]): number {
  let min = irisWorld[0], max = irisWorld[0];
  for (const p of irisWorld) {
    if (p.x < min.x) min = p;
    if (p.x > max.x) max = p;
  }
  return min.distanceTo(max);
}

export function estimateFacePose(
  keypoints: Keypoint[],
  videoWidth: number,
  mirror = true
): FacePose | null {
  const leftIris = keypoints.filter(p => p.name?.includes('leftIris'));
  const rightIris = keypoints.filter(p => p.name?.includes('rightIris'));
  if (leftIris.length === 0 || rightIris.length === 0) return null;

  const w = (i: number) => toWorld(keypoints[i], mirror, videoWidth);
  const leftIrisW = leftIris.map(p => toWorld(p, mirror, videoWidth));
  const rightIrisW = rightIris.map(p => toWorld(p, mirror, videoWidth));

  // Échelle absolue : le diamètre d'iris humain est quasi constant (11,7 mm)
  const irisPx = (irisHorizontalDiameterPx(leftIrisW) + irisHorizontalDiameterPx(rightIrisW)) / 2;
  if (irisPx < 2) return null;
  const pixelsPerMm = irisPx / IRIS_DIAMETER_MM;

  // Base orthonormée de la tête (Gram-Schmidt sur tempes et axe front-menton).
  // En mode miroir la chiralité s'inverse : on échange les extrémités de
  // l'axe des tempes pour rester en base directe (roll et yaw compris).
  const xAxis = (mirror
    ? w(LEFT_TEMPLE).sub(w(RIGHT_TEMPLE))
    : w(RIGHT_TEMPLE).sub(w(LEFT_TEMPLE))
  ).normalize();
  const yRaw = w(FOREHEAD).sub(w(CHIN)).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yRaw).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
  );

  const leftCenter = centroid(leftIrisW);
  const rightCenter = centroid(rightIrisW);
  const position = leftCenter.clone().add(rightCenter).multiplyScalar(0.5);

  return {
    position,
    quaternion,
    pixelsPerMm,
    ipdMm: leftCenter.distanceTo(rightCenter) / pixelsPerMm,
    noseBridgeMm: w(BRIDGE_LEFT).distanceTo(w(BRIDGE_RIGHT)) / pixelsPerMm,
    faceWidthMm: w(LEFT_TEMPLE).distanceTo(w(RIGHT_TEMPLE)) / pixelsPerMm,
    faceLengthMm: w(FOREHEAD).distanceTo(w(CHIN)) / pixelsPerMm
  };
}

// Lissage adaptatif façon One-Euro : très réactif quand la tête bouge vite,
// très stable quand elle est immobile — c'est ce qui fait la différence entre
// une monture « collée au visage » et une monture qui flotte.
export class PoseSmoother {
  private position = new THREE.Vector3();
  private quaternion = new THREE.Quaternion();
  private scale = 0;
  private initialized = false;

  constructor(
    private minAlpha = 0.15,
    private maxAlpha = 0.85,
    private speedGain = 0.08
  ) {}

  update(target: FacePose): { position: THREE.Vector3; quaternion: THREE.Quaternion; pixelsPerMm: number } {
    if (!this.initialized) {
      this.position.copy(target.position);
      this.quaternion.copy(target.quaternion);
      this.scale = target.pixelsPerMm;
      this.initialized = true;
    } else {
      const speed = this.position.distanceTo(target.position);
      const alpha = Math.min(this.maxAlpha, this.minAlpha + speed * this.speedGain);
      this.position.lerp(target.position, alpha);
      this.quaternion.slerp(target.quaternion, alpha);
      this.scale += (target.pixelsPerMm - this.scale) * alpha;
    }
    return { position: this.position, quaternion: this.quaternion, pixelsPerMm: this.scale };
  }

  reset() {
    this.initialized = false;
  }
}

// Stabilisateur de mesures : médiane glissante, pour dériver une fiche
// technique qui ne tremble pas pendant que l'utilisateur bouge.
export class MeasureStabilizer {
  private samples: { ipd: number; bridge: number; width: number; length: number }[] = [];

  constructor(private windowSize = 45) {}

  push(pose: FacePose) {
    this.samples.push({
      ipd: pose.ipdMm,
      bridge: pose.noseBridgeMm,
      width: pose.faceWidthMm,
      length: pose.faceLengthMm
    });
    if (this.samples.length > this.windowSize) this.samples.shift();
  }

  get ready(): boolean {
    return this.samples.length >= Math.min(15, this.windowSize);
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  read() {
    return {
      ipdMm: this.median(this.samples.map(s => s.ipd)),
      noseBridgeMm: this.median(this.samples.map(s => s.bridge)),
      faceWidthMm: this.median(this.samples.map(s => s.width)),
      faceLengthMm: this.median(this.samples.map(s => s.length))
    };
  }
}
