import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildFrame } from './buildFrame';
import type { FrameSpec } from './frameSpec';

/** Soft studio lighting: room environment for reflections + a key and a rim light. */
export function setupStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = env;
  pmrem.dispose();

  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(120, 200, 260);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#dfe9ff', 0.9);
  rim.position.set(-200, 80, -200);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d1cf', 0.5));
  return () => env.dispose();
}

/** Blurred ellipse used as a contact shadow under the frame. */
export function contactShadow(width: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(20,28,40,0.38)');
  grad.addColorStop(0.6, 'rgba(20,28,40,0.12)');
  grad.addColorStop(1, 'rgba(20,28,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.1, width * 0.9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// ---------- shared thumbnail renderer ----------

let thumbRenderer: THREE.WebGLRenderer | null = null;
let thumbScene: THREE.Scene | null = null;
const thumbCache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

export type ThumbView = 'front' | 'three-quarter';

/** Renders a frame to a transparent PNG once, then serves it from cache. */
export function renderThumbnail(spec: FrameSpec, view: ThumbView = 'three-quarter', size = 640): Promise<string> {
  const key = JSON.stringify([spec, view, size]);
  const cached = thumbCache.get(key);
  if (cached) return cached;
  const job = queue.then(
    () =>
      new Promise<string>((resolve) => {
        if (!thumbRenderer) {
          thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
          thumbScene = new THREE.Scene();
          setupStudio(thumbRenderer, thumbScene);
        }
        const renderer = thumbRenderer;
        const scene = thumbScene!;
        renderer.setPixelRatio(1);
        renderer.setSize(size, Math.round(size * 0.62), false);
        const camera = new THREE.PerspectiveCamera(22, 1 / 0.62, 10, 2000);
        const built = buildFrame(spec);
        const holder = new THREE.Group();
        holder.add(built.group);
        if (view === 'three-quarter') {
          holder.rotation.y = -0.55;
          holder.rotation.x = 0.12;
        }
        scene.add(holder);
        holder.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(holder);
        const center = box.getCenter(new THREE.Vector3());
        holder.position.sub(center);
        const w = box.max.x - box.min.x;
        const dist = (w * (view === 'front' ? 0.37 : 0.29)) / Math.tan((22 * Math.PI) / 360);
        const front = box.max.z - center.z;
        camera.position.set(0, w * 0.04, front + dist);
        camera.lookAt(0, 0, view === 'front' ? front : 0);
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        scene.remove(holder);
        built.dispose();
        resolve(url);
      })
  );
  queue = job;
  thumbCache.set(key, job);
  return job;
}
