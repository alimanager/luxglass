import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadFrame, type FrameSource } from '../../three/loadModel';
import type { BuiltFrame } from '../../three/buildFrame';
import { frameWidth } from '../../three/frameSpec';
import { contactShadow, setupStudio } from '../../three/studio';

/** Interactive 3D frame: drag to turn it, slow turntable until touched. */
export default function FrameViewer({ frame, className = '', label }: { frame: FrameSource; className?: string; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.setAttribute('aria-label', label);
    renderer.domElement.setAttribute('role', 'img');

    const scene = new THREE.Scene();
    const disposeEnv = setupStudio(renderer, scene);
    const camera = new THREE.PerspectiveCamera(24, 1, 10, 3000);

    const lensH = frame.spec.lens.h;
    let built: BuiltFrame | null = null;
    let disposed = false;
    const pivot = new THREE.Group();
    scene.add(pivot);
    const shadow = contactShadow(frame.model?.widthMm ?? frameWidth(frame.spec));
    shadow.position.set(0, -lensH / 2 - 22, -40);
    scene.add(shadow);
    loadFrame(frame).then((b) => {
      if (disposed) return b.dispose();
      built = b;
      b.group.position.z = 45; // turn around the middle of the frame, not the lenses
      pivot.add(b.group);
    });

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const span = Math.max((frame.model?.widthMm ?? frameWidth(frame.spec)) * 1.55, (lensH + 70) * camera.aspect);
      camera.position.set(0, 30, (span / 2 / Math.tan((24 * Math.PI) / 360)) / camera.aspect + 40);
      camera.lookAt(0, -4, 0);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.58;
    controls.target.set(0, -4, 0);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let touched = false;
    controls.addEventListener('start', () => (touched = true));
    pivot.rotation.y = -0.35;

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(host);
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      if (!visible) return;
      if (!touched && !reduce) pivot.rotation.y = -0.35 + Math.sin(t * 0.45) * 0.45;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      disposed = true;
      built?.dispose();
      disposeEnv();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [frame, label]);

  return <div ref={hostRef} className={`relative cursor-grab active:cursor-grabbing ${className}`} />;
}
