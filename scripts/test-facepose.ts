// Banc de test de l'estimation de pose : visages synthétiques dont la
// géométrie est connue, assertions sur l'échelle, les mesures et la rotation.
// Lancer avec : npx tsx scripts/test-facepose.ts

import * as THREE from 'three';
import { estimateFacePose, Keypoint, MeasureStabilizer, PoseSmoother } from '../src/utils/facePose';

const VIDEO_W = 640;

let failures = 0;
function assertClose(label: string, actual: number, expected: number, tol: number) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${actual.toFixed(3)} (attendu ${expected.toFixed(3)} ± ${tol})`);
}

// Construit un visage synthétique : points 3D en millimètres dans le repère
// tête (x droite du sujet vu en miroir, y haut, z vers la caméra), tournés
// par (yaw, pitch, roll), puis projetés en coordonnées image non-miroir
// (x image = -x monde + centre, car la caméra voit le sujet non inversé).
function syntheticFace(opts: { yawDeg?: number; rollDeg?: number; pxPerMm?: number }): Keypoint[] {
  const { yawDeg = 0, rollDeg = 0, pxPerMm = 3 } = opts;
  const rot = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, THREE.MathUtils.degToRad(yawDeg), THREE.MathUtils.degToRad(rollDeg), 'YXZ')
  );

  // Points en mm, repère monde-miroir (x vers la droite de l'écran)
  const mm: Record<number, THREE.Vector3> = {
    10: new THREE.Vector3(0, 60, 0),      // front
    152: new THREE.Vector3(0, -120, 0),   // menton
    234: new THREE.Vector3(70, 0, -20),   // tempe côté droit de l'écran (miroir)
    454: new THREE.Vector3(-70, 0, -20),  // tempe côté gauche de l'écran
    122: new THREE.Vector3(9, -5, 8),
    351: new THREE.Vector3(-9, -5, 8),
  };

  const keypoints: Keypoint[] = [];
  const place = (idx: number, v: THREE.Vector3, name?: string) => {
    const r = v.clone().applyQuaternion(rot);
    // monde → image : x image inversé (le flux caméra brut n'est pas en miroir)
    keypoints[idx] = {
      x: VIDEO_W / 2 - r.x * pxPerMm,
      y: 240 - r.y * pxPerMm,
      z: -r.z * pxPerMm,
      ...(name ? { name } : {})
    };
    return keypoints[idx];
  };

  Object.entries(mm).forEach(([idx, v]) => place(Number(idx), v));

  // Iris : centres à ±31,5 mm (IPD 63 mm), 5 points chacun, diamètre 11,7 mm
  const irisOffsets = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(5.85, 0, 0),
    new THREE.Vector3(-5.85, 0, 0),
    new THREE.Vector3(0, 5.85, 0),
    new THREE.Vector3(0, -5.85, 0),
  ];
  let cursor = 468;
  for (const [name, cx] of [['rightIris', 31.5], ['leftIris', -31.5]] as const) {
    for (const off of irisOffsets) {
      place(cursor++, new THREE.Vector3(cx, 8, 10).add(off), name);
    }
  }

  // Remplissage des trous pour ressembler à un vrai tableau de keypoints
  for (let i = 0; i < cursor; i++) {
    if (!keypoints[i]) keypoints[i] = { x: 0, y: 0, z: 0 };
  }
  return keypoints;
}

console.log('— Visage frontal, 3 px/mm —');
{
  const pose = estimateFacePose(syntheticFace({ pxPerMm: 3 }), VIDEO_W, true);
  if (!pose) throw new Error('pose null');
  assertClose('pixelsPerMm', pose.pixelsPerMm, 3, 0.05);
  assertClose('IPD (mm)', pose.ipdMm, 63, 1);
  assertClose('pont nasal (mm)', pose.noseBridgeMm, 18, 1);
  assertClose('largeur visage (mm)', pose.faceWidthMm, 140, 2);
  assertClose('longueur visage (mm)', pose.faceLengthMm, 180, 2);

  const e = new THREE.Euler().setFromQuaternion(pose.quaternion, 'YXZ');
  assertClose('yaw frontal (°)', THREE.MathUtils.radToDeg(e.y), 0, 2);
  assertClose('roll frontal (°)', THREE.MathUtils.radToDeg(e.z), 0, 2);
  // L'axe z de la base doit pointer vers la caméra (+z monde)
  const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
  assertClose('axe z vers caméra', zAxis.z, 1, 0.05);
}

console.log('— Rotation de 20° en yaw —');
{
  const pose = estimateFacePose(syntheticFace({ yawDeg: 20 }), VIDEO_W, true);
  if (!pose) throw new Error('pose null');
  const e = new THREE.Euler().setFromQuaternion(pose.quaternion, 'YXZ');
  assertClose('yaw mesuré (°)', THREE.MathUtils.radToDeg(e.y), 20, 4);
}

console.log('— Inclinaison de 15° en roll —');
{
  const pose = estimateFacePose(syntheticFace({ rollDeg: 15 }), VIDEO_W, true);
  if (!pose) throw new Error('pose null');
  const e = new THREE.Euler().setFromQuaternion(pose.quaternion, 'YXZ');
  assertClose('roll mesuré (°)', THREE.MathUtils.radToDeg(e.z), 15, 3);
}

console.log('— Échelle : sujet deux fois plus proche (6 px/mm) —');
{
  const pose = estimateFacePose(syntheticFace({ pxPerMm: 6 }), VIDEO_W, true);
  if (!pose) throw new Error('pose null');
  assertClose('pixelsPerMm', pose.pixelsPerMm, 6, 0.1);
  assertClose('IPD stable (mm)', pose.ipdMm, 63, 1);
}

console.log('— Lissage : convergence et stabilité —');
{
  const smoother = new PoseSmoother();
  const still = estimateFacePose(syntheticFace({}), VIDEO_W, true)!;
  let out = smoother.update(still);
  for (let i = 0; i < 60; i++) out = smoother.update(still);
  assertClose('position lissée convergée', out.position.distanceTo(still.position), 0, 0.01);

  const stab = new MeasureStabilizer();
  for (let i = 0; i < 30; i++) stab.push(still);
  const m = stab.read();
  assertClose('IPD stabilisée (mm)', m.ipdMm, 63, 1);
}

console.log(failures === 0 ? '\nTous les tests passent.' : `\n${failures} test(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
