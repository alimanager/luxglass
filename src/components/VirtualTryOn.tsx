import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Glasses } from '../types/glasses';
import { Sliders, RotateCcw } from 'lucide-react';

interface VirtualTryOnProps {
  glasses: Glasses;
  faceShape: string;
}

const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ glasses, faceShape }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const glassesModelRef = useRef<THREE.Group | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [adjustments, setAdjustments] = useState({
    scale: 1,
    height: 0,
    depth: 0
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xf5f5f5);

    cameraRef.current = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );

    rendererRef.current = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    const container = containerRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Camera position
    camera.position.z = 5;
    camera.position.y = 1;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Controls
    controlsRef.current = new OrbitControls(camera, renderer.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.dampingFactor = 0.05;
    controlsRef.current.maxDistance = 10;
    controlsRef.current.minDistance = 2;

    // Load glasses model
    const loader = new GLTFLoader();
    setLoadingError(null);
    setIsLoading(true);

    loader.load(
      '/glasses.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(adjustments.scale, adjustments.scale, adjustments.scale);
        model.position.set(0, adjustments.height, adjustments.depth);
        glassesModelRef.current = model;
        scene.add(model);
        setIsLoading(false);
      },
      (progress) => {
        console.log((progress.loaded / progress.total * 100) + '% loaded');
      },
      (error) => {
        console.error('Error loading model:', error);
        setLoadingError('Erreur lors du chargement du modèle 3D. Veuillez réessayer.');
        setIsLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (glassesModelRef.current) {
        scene.remove(glassesModelRef.current);
      }
      renderer.dispose();
      controlsRef.current?.dispose();
    };
  }, [glasses]);

  const updateGlassesPosition = () => {
    if (glassesModelRef.current) {
      glassesModelRef.current.scale.set(
        adjustments.scale,
        adjustments.scale,
        adjustments.scale
      );
      glassesModelRef.current.position.set(
        0,
        adjustments.height,
        adjustments.depth
      );
    }
  };

  const resetAdjustments = () => {
    setAdjustments({
      scale: 1,
      height: 0,
      depth: 0
    });
    updateGlassesPosition();
  };

  useEffect(() => {
    updateGlassesPosition();
  }, [adjustments]);

  return (
    <div className="space-y-4">
      <div 
        ref={containerRef} 
        className="aspect-video bg-secondary-50 rounded-lg overflow-hidden shadow-inner relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="text-gray-600">
              Chargement du modèle...
            </div>
          </div>
        )}
      </div>

      {loadingError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {loadingError}
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium flex items-center">
            <Sliders className="h-5 w-5 mr-2" />
            Ajustements
          </h3>
          <button
            onClick={resetAdjustments}
            className="text-secondary-600 hover:text-secondary-900 transition-colors flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Réinitialiser
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm text-secondary-600 block mb-1">
              Taille
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={adjustments.scale}
              onChange={(e) => setAdjustments(prev => ({
                ...prev,
                scale: parseFloat(e.target.value)
              }))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm text-secondary-600 block mb-1">
              Hauteur
            </label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={adjustments.height}
              onChange={(e) => setAdjustments(prev => ({
                ...prev,
                height: parseFloat(e.target.value)
              }))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm text-secondary-600 block mb-1">
              Profondeur
            </label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={adjustments.depth}
              onChange={(e) => setAdjustments(prev => ({
                ...prev,
                depth: parseFloat(e.target.value)
              }))}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn;