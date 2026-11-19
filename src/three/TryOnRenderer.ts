import * as THREE from 'three';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import type { BuiltFrame } from './buildFrame';
import { loadFrame, type FrameSource } from './loadModel';
import { setupStudio } from './studio';
import type { FacePose, LM } from './faceAnchor';
import type { SceneLight } from '../lib/lightProbe';

// 852 triangles of the MediaPipe face mesh (its edges come in triangle triples).
const FACE_INDEX: number[] = (() => {
  const t = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const idx: number[] = [];
  for (let i = 0; i + 2 < t.length; i += 3) idx.push(t[i].start, t[i + 1].start, t[i + 2].start);
  return idx;
})();
const MESH_POINTS = 468;

const coords = (p: LM): [number, number, number] => {
  if ('x' in (p as object)) {
    const q = p as { x: number; y: number; z?: number };
    return [q.x, q.y, q.z ?? 0];
  }
  const a = p as ArrayLike<number>;
  return [a[0], a[1], a[2] ?? 0];
};

/**
 * Renders a frame over an image or a video, in image-pixel space
 * (x right, y up, origin top-left, so y ∈ [-height, 0]).
 *
 * Realism layers:
 * - the frame is seated on the nose (bridge or pads on the nasal skin);
 * - the face mesh writes depth only, so the nose and cheeks hide what is behind them;
 * - an ellipsoid stands in for the back of the head (temples behind the ears);
 * - the same mesh catches the frame's shadow;
 * - lights follow the brightness, colour and direction measured on the skin.
 */
export class TryOnRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10000, 10000);
  private frame: BuiltFrame | null = null;
  private holder = new THREE.Group();
  private head: THREE.Mesh;
  private faceGeo = new THREE.BufferGeometry();
  private faceOccluder: THREE.Mesh;
  private faceShadow: THREE.Mesh;
  private key = new THREE.DirectionalLight('#ffffff', 1.4);
  private fill = new THREE.HemisphereLight('#ffffff', '#8a8f96', 0.7);
  private light: SceneLight = { luma: 140, tint: [1, 1, 1], side: 0 };
  private nudgeMm = 0;
  private disposeEnv: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.disposeEnv = setupStudio(this.renderer, this.scene, false);
    this.camera.position.set(0, 0, 5000);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.holder, this.fill, this.key, this.key.target);
    this.holder.visible = false;

    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 10;
    this.key.shadow.bias = -0.002;

    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    this.head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), depthOnly);
    this.head.renderOrder = -1;
    this.scene.add(this.head);

    this.faceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MESH_POINTS * 3), 3));
    this.faceGeo.setIndex(FACE_INDEX);
    this.faceOccluder = new THREE.Mesh(this.faceGeo, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
    this.faceOccluder.renderOrder = -1;
    this.faceOccluder.frustumCulled = false;
    this.faceShadow = new THREE.Mesh(
      this.faceGeo,
      new THREE.ShadowMaterial({
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    this.faceShadow.receiveShadow = true;
    this.faceShadow.renderOrder = 3;
    this.faceShadow.frustumCulled = false;
    this.scene.add(this.faceOccluder, this.faceShadow);
  }

  setSize(width: number, height: number) {
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1, 1920 / width));
    this.renderer.setSize(width, height, false);
    this.camera.left = 0;
    this.camera.right = width;
    this.camera.top = 0;
    this.camera.bottom = -height;
    this.camera.updateProjectionMatrix();
  }

  private frameToken = 0;
  /** Loads the frame (real model or parametric). Resolves once it is on the face. */
  async setFrame(source: FrameSource) {
    const token = ++this.frameToken;
    const next = await loadFrame(source);
    if (token !== this.frameToken) return next.dispose(); // a newer frame was picked meanwhile
    if (this.frame) {
      this.holder.remove(this.frame.group);
      this.frame.dispose();
    }
    this.frame = next;
    this.frame.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // only the front casts a shadow on the face; the temples run along the sides of the head
      if (mesh.userData.part === 'temple') mesh.castShadow = false;
      const mat = mesh.material as THREE.MeshPhysicalMaterial | undefined;
      if (!mat || !('envMapIntensity' in mat)) return;
      // On a face: softer reflections, and lenses you can see the eyes through.
      mat.envMapIntensity = (mat.envMapIntensity ?? 1) * 0.55;
      if (mesh.userData.part === 'lens' || (mat.transparent && mat.vertexColors)) {
        if (mat.vertexColors) mat.opacity = 0.62;
        mesh.castShadow = false; // tinted glass casts no hard shadow
      }
    });
    this.holder.add(this.frame.group);
  }

  /** Raise (+) or lower (−) the frame on the nose, in millimetres. */
  setNudge(mm: number) {
    this.nudgeMm = mm;
  }

  /** Lighting measured on the skin (see lightProbe). `ease` < 1 smooths it over frames. */
  setLight(l: SceneLight, ease = 0.15) {
    const k = ease;
    this.light = {
      luma: this.light.luma + (l.luma - this.light.luma) * k,
      side: this.light.side + (l.side - this.light.side) * k,
      tint: this.light.tint.map((c, i) => c + (l.tint[i] - c) * k) as [number, number, number],
    };
  }

  update(pose: FacePose | null, landmarks?: LM[]) {
    const visible = !!pose && !!this.frame;
    this.holder.visible = visible;
    this.head.visible = visible;
    this.faceOccluder.visible = visible && !!landmarks;
    this.faceShadow.visible = visible && !!landmarks;
    if (!pose || !this.frame) return;

    const s = pose.pxPerMm;
    const basis = new THREE.Matrix4().makeRotationFromQuaternion(pose.quaternion);
    const right = new THREE.Vector3().setFromMatrixColumn(basis, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(basis, 1);
    const forward = new THREE.Vector3().setFromMatrixColumn(basis, 2);

    // Seat the frame on the nose: its contact point lands on the nasal skin (+1 mm).
    const seat = this.frame.seat;
    const nose = seat.on === 'upper' ? pose.noseUpper : pose.noseMid;
    const origin = nose
      .clone()
      .addScaledVector(up, (-seat.y + this.nudgeMm) * s)
      .addScaledVector(forward, (-seat.z + 1) * s);

    // Keep the pupils inside the lenses whatever the nose shape.
    const pupilY = pose.pupils.clone().sub(origin).dot(up) / s;
    const h = this.frame.lensHeight;
    // opticians aim for pupils at 50–60 % of the lens height
    const lo = -h * 0.06;
    const hi = h * 0.1;
    if (pupilY < lo) origin.addScaledVector(up, (pupilY - lo) * s);
    if (pupilY > hi) origin.addScaledVector(up, (pupilY - hi) * s);

    this.holder.position.copy(origin);
    this.holder.quaternion.copy(pose.quaternion);
    this.holder.scale.setScalar(s);
    this.head.position.copy(pose.headCenter);
    this.head.quaternion.copy(pose.quaternion);
    this.head.scale.copy(pose.headRadii);

    if (landmarks) {
      // Face surface pushed back 1.5 mm so the pads and bridge are not swallowed by it.
      const pos = this.faceGeo.attributes.position as THREE.BufferAttribute;
      const back = forward.clone().multiplyScalar(-1.5 * s);
      for (let i = 0; i < MESH_POINTS; i++) {
        const [x, y, z] = coords(landmarks[i]);
        pos.setXYZ(i, x + back.x, -y + back.y, -z + back.z);
      }
      pos.needsUpdate = true;
      this.faceGeo.computeBoundingSphere();
      this.faceGeo.computeVertexNormals();
    }

    // Key light from above-front, pushed towards the brighter side of the face.
    const l = this.light;
    const brightness = THREE.MathUtils.clamp(l.luma / 140, 0.45, 1.35);
    const tint = new THREE.Color(l.tint[0], l.tint[1], l.tint[2]);
    // mostly frontal: the shadow stays a soft contact shadow just under the rims
    const dir = up.clone().multiplyScalar(0.45).addScaledVector(forward, 1.6).addScaledVector(right, l.side * 0.5).normalize();
    this.key.position.copy(origin).addScaledVector(dir, 600 * s);
    this.key.target.position.copy(origin);
    this.key.intensity = 1.5 * brightness;
    this.key.color.copy(tint);
    this.fill.intensity = 0.65 * brightness;
    this.fill.color.copy(tint);
    const cam = this.key.shadow.camera;
    const half = this.frame.width * 0.8 * s;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 1200 * s;
    cam.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.frame?.dispose();
    this.head.geometry.dispose();
    this.faceGeo.dispose();
    (this.head.material as THREE.Material).dispose();
    (this.faceOccluder.material as THREE.Material).dispose();
    (this.faceShadow.material as THREE.Material).dispose();
    this.disposeEnv();
    this.renderer.dispose();
  }
}
