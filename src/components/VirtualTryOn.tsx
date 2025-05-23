import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { AlertCircle } from 'lucide-react';
import * as faceMesh from '@mediapipe/face_mesh';
import { Glasses } from '../types/glasses';

interface VirtualTryOnProps {
  glasses: Glasses;
  faceShape: string;
}

const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ glasses }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const glassesModelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    scene.add(directionalLight);

    // Load glasses model
    const loader = new GLTFLoader();
    setLoadingError(null);
    setIsLoading(true);

    loader.load(
      '/glasses.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1);
        glassesModelRef.current = model;
        scene.add(model);
        setIsLoading(false);

        // Start face tracking once model is loaded
        initFaceTracking();
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
        setLoadingError('Error loading 3D model');
        setIsLoading(false);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (glassesModelRef.current) {
        scene.remove(glassesModelRef.current);
      }
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const initFaceTracking = async () => {
    const faceMeshInstance = new faceMesh.FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMeshInstance.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMeshInstance.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Get eye positions (landmarks 33 and 133 are the centers of the eyes)
        const leftEye = landmarks[33];
        const rightEye = landmarks[133];
        
        if (glassesModelRef.current && sceneRef.current) {
          // Calculate glasses position and rotation
          const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) +
            Math.pow(rightEye.y - leftEye.y, 2) +
            Math.pow(rightEye.z - leftEye.z, 2)
          );

          // Position glasses
          glassesModelRef.current.position.set(
            (leftEye.x + rightEye.x) / 2,
            (leftEye.y + rightEye.y) / 2,
            (leftEye.z + rightEye.z) / 2
          );

          // Scale glasses based on eye distance
          const scale = eyeDistance * 8; // Adjust multiplier as needed
          glassesModelRef.current.scale.set(scale, scale, scale);

          // Rotate glasses to match face orientation
          const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
          glassesModelRef.current.rotation.z = angle;
        }
      }
    });

    if (videoRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };

      const processVideo = async () => {
        if (videoRef.current) {
          await faceMeshInstance.send({ image: videoRef.current });
        }
        requestAnimationFrame(processVideo);
      };

      processVideo();
    }
  };

  if (loadingError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">
          Model Loading Error
        </h3>
        <p className="text-red-600">{loadingError}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full h-auto"
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      <div 
        ref={containerRef}
        className="aspect-video bg-transparent rounded-lg overflow-hidden relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="text-gray-600">Loading model...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualTryOn;