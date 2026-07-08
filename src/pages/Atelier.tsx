import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { Ruler, ScanFace, Sparkles, Sun, Eye } from 'lucide-react';
import { FaceProfile, SkinTone } from '../types/glasses';
import { FACE_SHAPE_LABELS } from '../utils/recommendation';
import {
  ATELIER_COLORS,
  ATELIER_SHAPE_LABELS,
  AtelierShape,
  buildGlassesModel,
  CustomFrameSpec,
  deriveFrameSpec,
  disposeGlassesModel,
  recommendedColorsFor,
  recommendedShapeFor
} from '../utils/parametricGlasses';

interface LocationState {
  faceShape?: string;
  characteristics?: {
    faceWidth: number;
    faceLength: number;
    interpupillaryDistance: number;
    noseBridgeWidth: number;
    skinTone: SkinTone;
  };
}

// Profil moyen utilisé tant que l'analyse du visage n'a pas été faite
const DEFAULT_PROFILE: FaceProfile = {
  faceShape: 'oval',
  faceWidth: 140,
  faceLength: 185,
  interpupillaryDistance: 63,
  noseBridgeWidth: 18,
  skinTone: 'Medium'
};

const SHAPES = Object.keys(ATELIER_SHAPE_LABELS) as AtelierShape[];

const Atelier: React.FC = () => {
  const location = useLocation();
  const state = location.state as LocationState | null;

  const hasMeasurements = Boolean(state?.characteristics && state?.faceShape);

  const profile: FaceProfile = useMemo(() => {
    if (!hasMeasurements) return DEFAULT_PROFILE;
    const c = state!.characteristics!;
    return {
      faceShape: state!.faceShape!,
      faceWidth: c.faceWidth,
      faceLength: c.faceLength,
      interpupillaryDistance: c.interpupillaryDistance,
      noseBridgeWidth: c.noseBridgeWidth,
      skinTone: c.skinTone
    };
  }, [state, hasMeasurements]);

  const recommendedShape = recommendedShapeFor(profile.faceShape);
  const recommendedColors = recommendedColorsFor(profile.skinTone);

  const [spec, setSpec] = useState<CustomFrameSpec>(() => deriveFrameSpec(profile));

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  const selectShape = (shape: AtelierShape) => {
    setSpec(prev => ({
      ...deriveFrameSpec(profile, shape),
      color: prev.color,
      sunLenses: prev.sunLenses
    }));
  };

  // Scène : montée une seule fois
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f1ec);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      32,
      container.clientWidth / container.clientHeight,
      1,
      2000
    );
    camera.position.set(0, 35, 260);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Environnement studio : indispensable pour les reflets du métal et de l'acétate
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    // Éclairage studio : dôme doux + lumière principale + contre-jour
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(80, 120, 160);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff4e0, 0.5);
    fill.position.set(-120, 40, 80);
    scene.add(fill);
    const back = new THREE.DirectionalLight(0xe0ecff, 0.7);
    back.position.set(0, 60, -180);
    scene.add(back);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.4;
    controls.minDistance = 120;
    controls.maxDistance = 500;
    controls.target.set(0, 0, -20);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeGlassesModel(modelRef.current);
        modelRef.current = null;
      }
      controls.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Reconstruction du modèle à chaque changement de spécification
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (modelRef.current) {
      scene.remove(modelRef.current);
      disposeGlassesModel(modelRef.current);
    }
    const model = buildGlassesModel(spec);
    modelRef.current = model;
    scene.add(model);
  }, [spec]);

  return (
    <div className="min-h-screen pt-20 bg-secondary-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-7 w-7 text-primary-600" />
          <h1 className="text-3xl font-serif">L'Atelier Sur Mesure</h1>
        </div>
        <p className="text-secondary-600 mb-8 max-w-3xl">
          Une monture unique, dessinée en direct à partir des mesures de votre visage :
          calibre calculé sur votre écart pupillaire, pont ajusté à votre nez,
          forme choisie pour équilibrer votre morphologie.
        </p>

        {!hasMeasurements && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 flex items-center justify-between flex-wrap gap-3">
            <span className="flex items-center">
              <ScanFace className="h-5 w-5 mr-2 flex-shrink-0" />
              Cette monture utilise des mesures moyennes. Analysez votre visage pour un vrai sur-mesure.
            </span>
            <Link to="/try-on" className="btn btn-primary whitespace-nowrap">
              Analyser mon visage
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Viewport 3D */}
          <div className="lg:col-span-2 space-y-6">
            <div
              ref={containerRef}
              className="aspect-[4/3] rounded-xl overflow-hidden shadow-md bg-[#f4f1ec]"
            />

            {/* Fiche technique */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Ruler className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-medium">Fiche technique de votre monture</h3>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-serif text-primary-700">
                  {spec.lensWidth} □ {spec.bridgeWidth}
                </span>
                <span className="text-xl text-secondary-500">— {spec.templeLength}</span>
                <span className="text-sm text-secondary-500 ml-2">(calibre □ pont — branches, en mm)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-secondary-500">Calibre (A)</p>
                  <p className="font-medium">{spec.lensWidth} mm</p>
                </div>
                <div>
                  <p className="text-secondary-500">Hauteur verre (B)</p>
                  <p className="font-medium">{spec.lensHeight} mm</p>
                </div>
                <div>
                  <p className="text-secondary-500">Pont (DBL)</p>
                  <p className="font-medium">{spec.bridgeWidth} mm</p>
                </div>
                <div>
                  <p className="text-secondary-500">Largeur totale</p>
                  <p className="font-medium">{spec.totalWidth} mm</p>
                </div>
              </div>
              <p className="text-xs text-secondary-500 mt-4">
                Calculée depuis {hasMeasurements ? 'vos mesures' : 'des mesures moyennes'} :
                écart pupillaire {profile.interpupillaryDistance.toFixed(0)} mm,
                pont nasal {profile.noseBridgeWidth.toFixed(0)} mm,
                largeur de visage {profile.faceWidth.toFixed(0)} mm.
              </p>
            </div>
          </div>

          {/* Panneau de personnalisation */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-1">
                Votre morphologie
              </h3>
              <p className="text-xl font-serif capitalize mb-1">
                Visage {FACE_SHAPE_LABELS[profile.faceShape] ?? profile.faceShape}
              </p>
              <p className="text-sm text-secondary-600">
                Forme conseillée : <span className="font-medium text-primary-700">{ATELIER_SHAPE_LABELS[recommendedShape]}</span>
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-4">Forme</h3>
              <div className="grid grid-cols-2 gap-2">
                {SHAPES.map(shape => (
                  <button
                    key={shape}
                    onClick={() => selectShape(shape)}
                    className={`relative px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      spec.shape === shape
                        ? 'border-primary-600 bg-primary-50 text-primary-800'
                        : 'border-secondary-200 hover:border-primary-300 text-secondary-700'
                    }`}
                  >
                    {ATELIER_SHAPE_LABELS[shape]}
                    {shape === recommendedShape && (
                      <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        conseillé
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-4">
                Couleur & matière
              </h3>
              <div className="grid grid-cols-5 gap-3 mb-3">
                {ATELIER_COLORS.map(color => (
                  <button
                    key={color.name}
                    onClick={() => setSpec(prev => ({ ...prev, color }))}
                    title={`${color.name} (${color.finish === 'metal' ? 'métal' : 'acétate'})`}
                    className={`relative aspect-square rounded-full border-2 transition-transform hover:scale-110 ${
                      spec.color.name === color.name ? 'border-primary-600 ring-2 ring-primary-200' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {recommendedColors.includes(color.name) && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary-600 rounded-full border-2 border-white" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-sm text-secondary-600">
                <span className="font-medium">{spec.color.name}</span>
                {' · '}{spec.color.finish === 'metal' ? 'monture métal' : 'monture acétate'}
              </p>
              <p className="text-xs text-secondary-500 mt-1">
                Les pastilles marquées d'un point s'accordent à votre teint ({profile.skinTone}).
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-secondary-500 uppercase tracking-wide mb-4">Verres</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSpec(prev => ({ ...prev, sunLenses: false }))}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center transition-colors ${
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
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center transition-colors ${
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Atelier;
