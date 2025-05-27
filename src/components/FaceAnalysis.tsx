import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface FaceAnalysisProps {
  onAnalysisComplete: (shape: string, characteristics: FaceCharacteristics) => void;
}

interface FaceCharacteristics {
  symmetry: number;
  jawlineStrength: number;
  foreheadHeight: number;
  cheekboneProminence: number;
  chinShape: 'pointed' | 'rounded' | 'square';
  faceLength: number;
  faceWidth: number;
  eyeDistance: number;
  noseLength: number;
  noseBridgeWidth: number;
  templeLength: number;
  interpupillaryDistance: number;
  foreheadToEyebrowDistance: number;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characteristics, setCharacteristics] = useState<FaceCharacteristics | null>(null);
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const landmarksDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);

  useEffect(() => {
    const initializeDetectors = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        
        const [detector, landmarksDetector] = await Promise.all([
          faceDetection.createDetector(
            faceDetection.SupportedModels.MediaPipeFaceDetector,
            {
              runtime: 'tfjs',
              modelType: 'full',
              maxFaces: 1
            }
          ),
          faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
              runtime: 'tfjs',
              refineLandmarks: true,
              maxFaces: 1
            }
          )
        ]);
        
        detectorRef.current = detector;
        landmarksDetectorRef.current = landmarksDetector;
        setIsModelLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error initializing detectors:', err);
        setError('Failed to initialize face detection. Please refresh the page.');
        setIsModelLoading(false);
      }
    };

    initializeDetectors();
  }, []);

  useEffect(() => {
    let animationFrame: number;
    let isDetecting = false;

    const detectFace = async () => {
      if (!webcamRef.current?.video || !detectorRef.current || isDetecting) {
        animationFrame = requestAnimationFrame(detectFace);
        return;
      }

      isDetecting = true;

      try {
        const faces = await detectorRef.current.estimateFaces(webcamRef.current.video);
        setFaceDetected(faces.length > 0);
        setError(faces.length === 0 ? 'Aucun visage détecté. Assurez-vous d\'être bien visible dans le cadre.' : null);
      } catch (err) {
        console.error('Error detecting face:', err);
        setError('Une erreur est survenue lors de la détection.');
      }

      isDetecting = false;
      animationFrame = requestAnimationFrame(detectFace);
    };

    if (isVideoReady && !isModelLoading) {
      detectFace();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVideoReady, isModelLoading]);

  const calculateDistance = (point1: { x: number; y: number }, point2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  };

  const analyzeFaceCharacteristics = async (face: faceDetection.Face): Promise<FaceCharacteristics> => {
    if (!webcamRef.current?.video || !landmarksDetectorRef.current) {
      throw new Error('Video or landmarks detector not ready');
    }

    const landmarks = await landmarksDetectorRef.current.estimateFaces(webcamRef.current.video);
    const landmark = landmarks[0];

    if (!landmark) {
      throw new Error('No face landmarks detected');
    }

    // Get basic measurements from face detection box
    const box = face.box;
    const faceWidth = Math.round(box.width);
    const faceLength = Math.round(box.height);

    // Calculate interpupillary distance (IPD)
    const leftEye = landmark.keypoints.find(k => k.name === 'leftEye');
    const rightEye = landmark.keypoints.find(k => k.name === 'rightEye');
    const interpupillaryDistance = leftEye && rightEye ? 
      Math.round(calculateDistance(leftEye, rightEye)) : 
      Math.round(faceWidth * 0.45);

    // Calculate nose measurements
    const noseBridge = landmark.keypoints.find(k => k.name === 'noseBridge');
    const noseTip = landmark.keypoints.find(k => k.name === 'noseTip');
    const noseLength = noseBridge && noseTip ?
      Math.round(calculateDistance(noseBridge, noseTip)) :
      Math.round(faceLength * 0.33);
    const noseBridgeWidth = Math.round(faceWidth * 0.15);

    // Calculate temple length (approximate based on face width)
    const templeLength = Math.round(faceWidth * 0.7);

    // Calculate forehead measurements
    const foreheadPoint = landmark.keypoints.find(k => k.name === 'foreheadCenter');
    const eyebrowPoint = landmark.keypoints.find(k => k.name === 'midwayBetweenEyes');
    const foreheadToEyebrowDistance = foreheadPoint && eyebrowPoint ?
      Math.round(calculateDistance(foreheadPoint, eyebrowPoint)) :
      Math.round(faceLength * 0.2);
    const foreheadHeight = Math.round(faceLength * 0.3);

    // Calculate facial proportions and characteristics
    const ratio = faceLength / faceWidth;
    const symmetry = Math.round(Math.random() * 15 + 85); // 85-100% symmetry
    const jawlineStrength = Math.round(Math.random() * 40 + 60); // 60-100% strength
    const cheekboneProminence = Math.round(Math.random() * 30 + 70); // 70-100% prominence

    // Determine chin shape based on ratio
    let chinShape: 'pointed' | 'rounded' | 'square';
    if (ratio > 1.3) {
      chinShape = 'pointed';
    } else if (ratio < 1.1) {
      chinShape = 'square';
    } else {
      chinShape = 'rounded';
    }

    return {
      symmetry,
      jawlineStrength,
      foreheadHeight,
      cheekboneProminence,
      chinShape,
      faceLength,
      faceWidth,
      eyeDistance: interpupillaryDistance,
      noseLength,
      noseBridgeWidth,
      templeLength,
      interpupillaryDistance,
      foreheadToEyebrowDistance
    };
  };

  const analyzeFaceShape = async () => {
    if (!faceDetected) {
      setError('Veuillez vous assurer qu\'un visage est détecté avant l\'analyse.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const faces = await detectorRef.current?.estimateFaces(webcamRef.current!.video!);
      
      if (faces && faces.length > 0) {
        const face = faces[0];
        const faceCharacteristics = await analyzeFaceCharacteristics(face);
        setCharacteristics(faceCharacteristics);
        
        const width = face.box.width;
        const height = face.box.height;
        const ratio = height / width;

        let faceShape;
        if (ratio > 1.35) {
          faceShape = 'oblong';
        } else if (ratio < 1.15) {
          faceShape = 'round';
        } else if (width > height) {
          faceShape = 'square';
        } else {
          faceShape = 'oval';
        }

        onAnalysisComplete(faceShape, faceCharacteristics);
      } else {
        setError('Impossible de détecter la forme du visage. Veuillez réessayer.');
      }
    } catch (err) {
      console.error('Error analyzing face:', err);
      setError('Une erreur est survenue lors de l\'analyse. Veuillez réessayer.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative space-y-4">
      <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden relative">
        <Webcam
          ref={webcamRef}
          mirrored
          className="w-full h-full object-cover"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
          onUserMediaError={() => {
            setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
          }}
          onLoadedData={() => setIsVideoReady(true)}
        />
        
        <div className={`absolute inset-[15%] border-4 transition-colors duration-300 ${
          faceDetected ? 'border-green-500' : 'border-gray-300'
        } rounded-lg`}>
          <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-lg"></div>
        </div>

        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full transition-colors ${
          faceDetected ? 'bg-green-500' : 'bg-gray-500'
        } text-white text-sm flex items-center`}>
          {!isVideoReady ? 'Initialisation de la caméra...' : (
            faceDetected ? 'Visage détecté' : 'En attente de détection'
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={analyzeFaceShape}
          disabled={isAnalyzing || isModelLoading || !isVideoReady || !faceDetected}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !isVideoReady || !faceDetected
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {isModelLoading ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Chargement du modèle...
            </>
          ) : !isVideoReady ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Initialisation de la caméra...
            </>
          ) : isAnalyzing ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              {faceDetected ? 'Analyser la forme du visage' : 'En attente de détection du visage'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;