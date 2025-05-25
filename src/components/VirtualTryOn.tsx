import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Glasses } from '../types/glasses';
import { Sliders, RotateCcw, AlertCircle } from 'lucide-react';

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
  const animationFrameRef = useRef<number>();
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
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    camera.position.y = 1;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 10;
    controls.minDistance = 2;
    controlsRef.current = controls;

    // Load glasses model
    const loader = new GLTFLoader();
    setLoadingError(null);
    setIsLoading(true);

    console.log('Loading model from:', '/glasses.glb'); // Debug path

    loader.load(
      '/glasses.glb',
      (gltf) => {
        console.log('Model loaded successfully:', gltf); // Debug loaded model

        const model = gltf.scene;
        model.scale.set(adjustments.scale, adjustments.scale, adjustments.scale);
        model.position.set(0, adjustments.height, adjustments.depth);
        
        // Remove any existing model
        if (glassesModelRef.current) {
          scene.remove(glassesModelRef.current);
        }
        
        glassesModelRef.current = model;
        scene.add(model);
        
        console.log('Model added to scene'); // Debug scene addition
        setIsLoading(false);
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading model:', error);
        setLoadingError('Le modèle 3D n\'a pas pu être chargé. Veuillez vérifier que le fichier glasses.glb est présent dans le dossier public.');
        setIsLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (glassesModelRef.current) {
        scene.remove(glassesModelRef.current);
        glassesModelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            } else if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            }
          }
        });
      }
      
      controlsRef.current?.dispose();
      rendererRef.current?.dispose();
      
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  useEffect(() => {
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
  }, [adjustments]);

  const resetAdjustments = () => {
    setAdjustments({
      scale: 1,
      height: 0,
      depth: 0
    });
  };

  if (loadingError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">
          Erreur de chargement du modèle
        </h3>
        <p className="text-red-600 mb-4">
          {loadingError}
        </p>
        <div className="text-sm text-red-700">
          <p className="mb-2">Pour résoudre ce problème :</p>
          <ol className="text-left list-decimal list-inside space-y-1">
            <li>Téléchargez un modèle 3D de lunettes au format .glb</li>
            <li>Renommez le fichier en "glasses.glb"</li>
            <li>Placez le fichier dans le dossier "public" du projet</li>
            <li>Redémarrez le serveur de développement</li>
          </ol>
        </div>
      </div>
    );
  }

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