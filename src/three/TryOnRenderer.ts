import * as THREE from 'three';
import { buildFrame, type BuiltFrame } from './buildFrame';
import type { FrameSpec } from './frameSpec';
import { setupStudio } from './studio';
import type { FacePose } from './faceAnchor';

/**
 * Renders a frame over an image or a video, in image-pixel space
 * (x right, y up, origin top-left, so y ∈ [-height, 0]).
 */
export class TryOnRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10000, 10000);
  private frame: BuiltFrame | null = null;
  private holder = new THREE.Group();
  private occluder: THREE.Mesh;
  private disposeEnv: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.disposeEnv = setupStudio(this.renderer, this.scene);
    this.camera.position.set(0, 0, 5000);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.holder);
    this.holder.visible = false;

    // Invisible head volume that writes depth only: temples behind the head disappear.
    this.occluder = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.MeshBasicMaterial({ colorWrite: false })
    );
    this.occluder.renderOrder = -1;
    this.scene.add(this.occluder);
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

  setSpec(spec: FrameSpec) {
    if (this.frame) {
      this.holder.remove(this.frame.group);
      this.frame.dispose();
    }
    this.frame = buildFrame(spec);
    // On a face: softer reflections, and lenses you can see the eyes through.
    this.frame.group.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (!mat || !('envMapIntensity' in mat)) return;
      mat.envMapIntensity *= 0.55;
      if (mat.transparent && mat.vertexColors) mat.opacity = 0.62;
    });
    this.holder.add(this.frame.group);
  }

  update(pose: FacePose | null) {
    if (!pose) {
      this.holder.visible = false;
      this.occluder.visible = false;
      return;
    }
    this.holder.visible = true;
    this.occluder.visible = true;
    this.holder.position.copy(pose.position);
    this.holder.quaternion.copy(pose.quaternion);
    this.holder.scale.setScalar(pose.pxPerMm);
    this.occluder.position.copy(pose.headCenter);
    this.occluder.quaternion.copy(pose.quaternion);
    this.occluder.scale.copy(pose.headRadii);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.frame?.dispose();
    this.occluder.geometry.dispose();
    (this.occluder.material as THREE.Material).dispose();
    this.disposeEnv();
    this.renderer.dispose();
  }
}
