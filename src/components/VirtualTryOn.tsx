import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Glasses } from '../types/glasses';

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
    skinTone: string;
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
  const [modelLoadingProgress, setModelLoadingProgress] = useState(0);

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

    loader.load(
      '/glasses.glb',
      (gltf) => {
        console.log('Model loaded successfully:', gltf);
        const model = gltf.scene;

        // Initial model positioning
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

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
        setModelLoadingProgress(percentComplete);
        console.log('Loading progress:', percentComplete.toFixed(2) + '%');
      },
      (error) => {
        console.error('Error loading model:', error);
        setLoadingError(`Failed to load 3D model: ${error.message}`);
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
      
      if (glassesModelRef.current) {
        // Add any model animations here if needed
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

  if (loadingError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">
          Error Loading Model
        </h3>
        <p className="text-red-600 mb-4">
          {loadingError}
        </p>
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
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-2" />
              <p className="text-primary-600">Loading 3D Model... {modelLoadingProgress.toFixed(0)}%</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium mb-4">Model Controls</h3>
        <p className="text-gray-600 mb-4">
          Use your mouse to rotate and zoom the model. Click and drag to rotate, scroll to zoom.
        </p>
      </div>
    </div>
  );
};

export default VirtualTryOn;