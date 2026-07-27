import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { AlertCircle, RefreshCw, ScanFace, Sparkles, Sun, Eye } from 'lucide-react';
import { loadFaceModels } from '../utils/modelLoader';
import { estimateFacePose, MeasureStabilizer, PoseSmoother } from '../utils/facePose';
import {
  ATELIER_COLORS,
  ATELIER_SHAPE_LABELS,
  AtelierShape,
  buildGlassesModel,
  CustomFrameSpec,
  deriveFrameSpec,
  disposeGlassesModel
} from '../utils/parametricGlasses';
import { FaceProfile } from '../types/glasses';

// Distance verre-œil standard (distance au vertex) : la monture se place
// quelques millimètres devant le plan des pupilles.
const VERTEX_DISTANCE_MM = 12;

const SHAPES = Object.keys(ATELIER_SHAPE_LABELS) as AtelierShape[];

type Status = 'loading' | 'camera-error' | 'model-error' | 'ready';

function guessFaceShape(faceLengthMm: number, faceWidthMm: number): string {
  const ratio = faceLengthMm / faceWidthMm;
  if (ratio > 1.35) return 'oblong';
  if (ratio < 1.15) return 'round';
  return 'oval';
}

const Miroir: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const occluderRef = useRef<THREE.Mesh | null>(null);
  const specRef = useRef<CustomFrameSpec | null>(null);

  const [status, setStatus] = useState<Status>('loading');
  const [faceVisible, setFaceVisible] = useState(false);
  const [measures, setMeasures] = useState<{ ipd: number; bridge: number; width: number } | null>(null);
  const [measuredProfile, setMeasuredProfile] = useState<FaceProfile | null>(null);
  const [spec, setSpec] = useState<CustomFrameSpec>(() =>
    deriveFrameSpec({
      faceShape: 'oval',
      faceWidth: 140,
      faceLength: 185,
      interpupillaryDistance: 63,
      noseBridgeWidth: 18,
      skinTone: 'Medium'
    })
  );
  specRef.current = spec;

  // Scène AR : caméra vidéo + rendu transparent superposé, une seule montée
  useEffect(() => {
    const video = videoRef.current;
    const host = canvasHostRef.current;
    const wrapper = wrapperRef.current;
    if (!video || !host || !wrapper) return;

    let disposed = false;
    let frameId = 0;
    let stream: MediaStream | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    let envTexture: THREE.Texture | null = null;
    let detecting = false;

    const smoother = new PoseSmoother();
    const stabilizer = new MeasureStabilizer();
    let lastFaceVisible: boolean | null = null;
    let lastMeasureUpdate = 0;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Occulteur : ellipsoïde invisible qui écrit la profondeur — les branches
    // disparaissent derrière les tempes, comme avec de vraies lunettes.
    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({ colorWrite: false })
    );
    occluder.renderOrder = -1;
    occluder.visible = false;
    scene.add(occluder);
    occluderRef.current = occluder;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(0.5, 1, 1.5);
    scene.add(key);

    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
      } catch {
        if (!disposed) setStatus('camera-error');
        return;
      }
      if (disposed) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => {});

      const models = await loadFaceModels().catch(() => null);
      if (disposed) return;
      if (!models) {
        setStatus('model-error');
        return;
      }

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      wrapper.style.aspectRatio = `${vw} / ${vh}`;

      camera.right = vw;
      camera.bottom = -vh;
      camera.updateProjectionMatrix();

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(vw, vh, false);
      renderer.domElement.className = 'absolute inset-0 w-full h-full';
      host.appendChild(renderer.domElement);

      pmrem = new THREE.PMREMGenerator(renderer);
      envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;

      setStatus('ready');

      const loop = async () => {
        if (disposed) return;
        frameId = requestAnimationFrame(loop);
        if (detecting || video.readyState !== 4 || !renderer) return;
        detecting = true;

        try {
          const faces = await models.landmarksDetector.estimateFaces(video);
          const pose = faces.length > 0
            ? estimateFacePose(faces[0].keypoints as never, vw, true)
            : null;

          if (pose) {
            const smoothed = smoother.update(pose);
            stabilizer.push(pose);

            const model = modelRef.current;
            if (model) {
              model.visible = true;
              const s = smoothed.pixelsPerMm;
              const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(smoothed.quaternion);
              model.position.copy(smoothed.position)
                .addScaledVector(zAxis, VERTEX_DISTANCE_MM * s);
              model.quaternion.copy(smoothed.quaternion);
              model.scale.setScalar(s);
            }

            occluder.visible = true;
            occluder.position.copy(smoothed.position)
              .addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(smoothed.quaternion), -45 * smoothed.pixelsPerMm);
            occluder.quaternion.copy(smoothed.quaternion);
            occluder.scale.set(
              (pose.faceWidthMm / 2 + 4) * smoothed.pixelsPerMm,
              (pose.faceLengthMm / 2 + 12) * smoothed.pixelsPerMm,
              70 * smoothed.pixelsPerMm
            );

            if (lastFaceVisible !== true) {
              lastFaceVisible = true;
              setFaceVisible(true);
            }

            // Fiche mesures + regénération de la monture aux cotes stabilisées
            const now = performance.now();
            if (stabilizer.ready && now - lastMeasureUpdate > 500) {
              lastMeasureUpdate = now;
              const m = stabilizer.read();
              setMeasures({ ipd: m.ipdMm, bridge: m.noseBridgeMm, width: m.faceWidthMm });

              const profile: FaceProfile = {
                faceShape: guessFaceShape(m.faceLengthMm, m.faceWidthMm),
                faceWidth: m.faceWidthMm,
                faceLength: m.faceLengthMm,
                interpupillaryDistance: m.ipdMm,
                noseBridgeWidth: m.noseBridgeMm,
                skinTone: 'Medium'
              };
              setMeasuredProfile(profile);

              const current = specRef.current;
              if (current) {
                const fitted = deriveFrameSpec(profile, current.shape);
                if (
                  Math.abs(fitted.lensWidth - current.lensWidth) >= 1 ||
                  Math.abs(fitted.bridgeWidth - current.bridgeWidth) >= 1
                ) {
                  setSpec({ ...fitted, color: current.color, sunLenses: current.sunLenses });
                }
              }
            }
          } else {
            if (modelRef.current) modelRef.current.visible = false;
            occluder.visible = false;
            smoother.reset();
            if (lastFaceVisible !== false) {
              lastFaceVisible = false;
              setFaceVisible(false);
            }
          }

          renderer.render(scene, camera);
        } catch {
          // Une frame ratée ne doit jamais casser la boucle
        }
        detecting = false;
      };
      loop();
    };

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach(t => t.stop());
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeGlassesModel(modelRef.current);
        modelRef.current = null;
      }
      occluder.geometry.dispose();
      (occluder.material as THREE.Material).dispose();
      envTexture?.dispose();
      pmrem?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconstruction de la monture à chaque changement de spécification
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeGlassesModel(modelRef.current);
    }
    const model = buildGlassesModel(spec);
    model.visible = false;
    modelRef.current = model;
    scene.add(model);
  }, [spec]);

  return (
    <div className="min-h-screen pt-28">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <ScanFace className="h-7 w-7 text-primary-600" />
          <h1 className="text-3xl font-serif">Le Miroir</h1>
        </div>
        <p className="text-secondary-600 mb-8 max-w-3xl">
          La cabine d'essayage du numéro : votre monture sur mesure, générée à vos
          cotes et posée sur votre visage en direct. Tournez la tête — elle suit.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Miroir AR */}
          <div className="lg:col-span-2 space-y-6">
            <div
              ref={wrapperRef}
              className="relative overflow-hidden border-2 border-ink shadow-hard bg-ink"
              style={{ aspectRatio: '16 / 9' }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-fill"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div ref={canvasHostRef} className="absolute inset-0" />

              {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/80 text-cream">
                  <RefreshCw className="h-5 w-5 mr-3 animate-spin" />
                  <span className="text-sm uppercase tracking-[0.2em]">Préparation du miroir...</span>
                </div>
              )}

              {status === 'ready' && !faceVisible && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-ink text-cream text-[11px] uppercase tracking-[0.25em] px-4 py-2">
                  Placez votre visage face au miroir
                </div>
              )}

              {status === 'ready' && faceVisible && measures && (
                <div className="absolute bottom-4 left-4 bg-cream/95 border-2 border-ink px-4 py-2 font-mono text-xs text-ink">
                  IPD {measures.ipd.toFixed(0)} mm · pont {measures.bridge.toFixed(0)} mm · visage {measures.width.toFixed(0)} mm
                </div>
              )}
            </div>

            {status === 'camera-error' && (
              <div className="bg-red-50 border-2 border-ink text-red-800 px-4 py-3 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <p>
                  Le miroir a besoin de la caméra. Vérifiez les permissions de votre
                  navigateur puis rechargez la page.
                </p>
              </div>
            )}

            {status === 'model-error' && (
              <div className="bg-red-50 border-2 border-ink text-red-800 px-4 py-3 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <p>
                  Les modèles de détection n'ont pas pu être téléchargés. Vérifiez
                  votre connexion internet puis rechargez la page.
                </p>
              </div>
            )}

            <div className="paper-panel p-6">
              <p className="kicker mb-2">Votre monture, en direct</p>
              <p className="font-mono text-2xl font-bold text-primary-700">
                {spec.lensWidth} □ {spec.bridgeWidth} <span className="text-secondary-500 text-lg">— {spec.templeLength}</span>
              </p>
              <p className="text-xs text-secondary-500 mt-2">
                Le calibre et le pont se recalculent en continu sur vos mesures.
                {measuredProfile && ' Mesures acquises — la monture est à vos cotes.'}
              </p>
            </div>
          </div>

          {/* Personnalisation */}
          <div className="space-y-6">
            <div className="paper-panel p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-4">Forme</h3>
              <div className="grid grid-cols-2 gap-2">
                {SHAPES.map(shape => (
                  <button
                    key={shape}
                    onClick={() => setSpec(prev => {
                      const base = measuredProfile ?? {
                        faceShape: 'oval',
                        faceWidth: 140,
                        faceLength: 185,
                        interpupillaryDistance: 63,
                        noseBridgeWidth: 18,
                        skinTone: 'Medium' as const
                      };
                      return { ...deriveFrameSpec(base, shape), color: prev.color, sunLenses: prev.sunLenses };
                    })}
                    className={`px-3 py-2.5 border text-sm font-medium transition-colors ${
                      spec.shape === shape
                        ? 'border-primary-600 bg-primary-50 text-primary-800'
                        : 'border-secondary-200 hover:border-primary-300 text-secondary-700'
                    }`}
                  >
                    {ATELIER_SHAPE_LABELS[shape]}
                  </button>
                ))}
              </div>
            </div>

            <div className="paper-panel p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-4">Couleur</h3>
              <div className="grid grid-cols-5 gap-3">
                {ATELIER_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => setSpec(prev => ({ ...prev, color }))}
                    title={`${color.name} (${color.finish === 'metal' ? 'métal' : 'acétate'})`}
                    className={`aspect-square rounded-full border-2 transition-transform hover:scale-110 ${
                      spec.color.name === color.name ? 'border-primary-600 ring-2 ring-primary-200' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>

            <div className="paper-panel p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-4">Verres</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSpec(prev => ({ ...prev, sunLenses: false }))}
                  className={`px-3 py-2.5 border text-sm font-medium flex items-center justify-center transition-colors ${
                    !spec.sunLenses
                      ? 'border-primary-600 bg-primary-50 text-primary-800'
                      : 'border-secondary-200 hover:border-primary-300 text-secondary-700'
                  }`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Optique
                </button>
                <button
                  onClick={() => setSpec(prev => ({ ...prev, sunLenses: true }))}
                  className={`px-3 py-2.5 border text-sm font-medium flex items-center justify-center transition-colors ${
                    spec.sunLenses
                      ? 'border-primary-600 bg-primary-50 text-primary-800'
                      : 'border-secondary-200 hover:border-primary-300 text-secondary-700'
                  }`}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Solaire
                </button>
              </div>
            </div>

            <Link
              to="/atelier"
              state={measuredProfile ? {
                faceShape: measuredProfile.faceShape,
                characteristics: {
                  faceWidth: measuredProfile.faceWidth,
                  faceLength: measuredProfile.faceLength,
                  interpupillaryDistance: measuredProfile.interpupillaryDistance,
                  noseBridgeWidth: measuredProfile.noseBridgeWidth,
                  skinTone: measuredProfile.skinTone
                }
              } : undefined}
              className="btn btn-accent w-full text-sm"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Affiner dans l'Atelier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Miroir;
