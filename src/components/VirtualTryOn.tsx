import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Glasses } from '../types/glasses';
import { AlertCircle } from 'lucide-react';

interface VirtualTryOnProps {
  glasses: Glasses;
  faceShape: string;
  characteristics?: {
    symmetry: number;
    jawlineStrength: number;
    cheekboneProminence: number;
    chinShape: 'pointed' | 'rounded' | 'square';
    faceWidth: number;
    faceLength: number;
    eyeDistance: number;
  };
}

const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ glasses, faceShape, characteristics }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const glassesModelRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number>();
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    const modelPath = '/glasses.glb';
    const loader = new GLTFLoader();
    setLoadingError(null);
    setIsLoading(true);

    // Create a test cube to verify scene rendering
    const testCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    testCube.position.set(0, 0, 0);
    scene.add(testCube);

    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        
        // Remove test cube
        scene.remove(testCube);
        
        // Remove any existing model
        if (glassesModelRef.current) {
          scene.remove(glassesModelRef.current);
        }
        
        glassesModelRef.current = model;
        scene.add(model);
        
        setIsLoading(false);
      },
      (progress) => {
        const percentComplete = (progress.loaded / progress.total) * 100;
        console.log('Loading progress:', percentComplete.toFixed(2) + '%');
      },
      (error) => {
        console.warn('Model load error:', error);
        console.error('Full error details:', {
          message: error.message,
          stack: error.stack,
          type: error.type
        });
        setLoadingError(`
          Error loading 3D model:
          - Path attempted: ${modelPath}
          - Error message: ${error.message}
          - Error type: ${error.type || 'Unknown'}
        `);
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
      
      scene.remove(testCube);
      testCube.geometry.dispose();
      (testCube.material as THREE.Material).dispose();
      
      controlsRef.current?.dispose();
      rendererRef.current?.dispose();
      
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  if (loadingError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">
          Error Loading Model
        </h3>
        <p className="text-red-600 mb-4 whitespace-pre-line">
          {loadingError}
        </p>
        <div className="text-sm text-red-700">
          <p className="mb-2">Verification steps:</p>
          <ol className="text-left list-decimal list-inside space-y-1">
            <li>glasses.glb exists in the public directory</li>
            <li>The file is a valid GLB model</li>
            <li>The file is accessible via /glasses.glb</li>
            <li>Check browser console for more details</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div 
        ref={containerRef} 
        className="aspect-video bg-secondary-50 rounded-lg overflow-hidden shadow-inner relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="text-gray-600">
              Loading model...
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium mb-6">Caractéristiques du Visage</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Progress Bars */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Symétrie du Visage</span>
                <span className="text-sm font-medium text-primary-600">92%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-500" style={{ width: '92%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Force de la Mâchoire</span>
                <span className="text-sm font-medium text-primary-600">78%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-500" style={{ width: '78%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Proéminence des Pommettes</span>
                <span className="text-sm font-medium text-primary-600">85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-500" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>

          {/* Right Column - Measurements and Shape */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Forme du Menton</h4>
              <p className="text-lg font-medium text-primary-600">Arrondi</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Proportions du Visage</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Largeur</span>
                  <span className="text-sm font-medium">320px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Longueur</span>
                  <span className="text-sm font-medium">420px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Distance entre les yeux</span>
                  <span className="text-sm font-medium">145px</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Face Shape Recommendations */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-lg mb-4">Recommandations pour votre forme de visage {faceShape}</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            {faceShape === 'round' && (
              <>
                <li>• Optez pour des montures angulaires</li>
                <li>• Privilégiez les formes rectangulaires</li>
                <li>• Évitez les montures rondes</li>
              </>
            )}
            {faceShape === 'square' && (
              <>
                <li>• Choisissez des montures arrondies</li>
                <li>• Les formes ovales adouciront vos traits</li>
                <li>• Évitez les montures carrées</li>
              </>
            )}
            {faceShape === 'oval' && (
              <>
                <li>• La plupart des styles vous iront bien</li>
                <li>• Gardez des proportions équilibrées</li>
                <li>• Évitez les montures trop grandes</li>
              </>
            )}
            {faceShape === 'heart' && (
              <>
                <li>• Optez pour des montures plus larges en bas</li>
                <li>• Les formes papillon vous avantageront</li>
                <li>• Évitez les montures trop larges en haut</li>
              </>
            )}
            {faceShape === 'oblong' && (
              <>
                <li>• Choisissez des montures larges</li>
                <li>• Les formes oversize vous iront bien</li>
                <li>• Évitez les montures étroites</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOn;