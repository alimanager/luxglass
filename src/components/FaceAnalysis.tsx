import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertCircle, Move } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface FaceAnalysisProps {
  onAnalysisComplete: (faceShape: string) => void;
  onLandmarksDetected?: (landmarks: any) => void;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete, onLandmarksDetected }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detector, setDetector] = useState<faceDetection.FaceDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePosition, setFacePosition] = useState<'center' | 'off-center' | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const lastDetectionTimeRef = useRef(0);

  useEffect(() => {
    const initializeTF = async () => {
      try {
        setIsModelLoading(true);
        setError(null);
        
        await tf.setBackend('webgl');
        await tf.ready();
        
        const model = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            modelType: 'short',
            maxFaces: 1
          }
        );
        
        setDetector(model);
        setIsModelLoading(false);
        console.log('Face detection model loaded successfully');
      } catch (err) {
        console.error('Error loading face detection model:', err);
        setError('Erreur lors du chargement du modèle de détection faciale.');
        setIsModelLoading(false);
      }
    };

    initializeTF();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      tf.disposeVariables();
    };
  }, []);

  useEffect(() => {
    if (!webcamRef.current?.video || !detector) return;

    const video = webcamRef.current.video;
    
    const handleVideoReady = () => {
      if (video.readyState === 4) {
        setIsVideoReady(true);
        startDetection();
      }
    };

    video.addEventListener('loadeddata', handleVideoReady);
    
    if (video.readyState === 4) {
      handleVideoReady();
    }

    return () => {
      video.removeEventListener('loadeddata', handleVideoReady);
    };
  }, [detector]);

  const checkFacePosition = (face: faceDetection.Face, videoWidth: number, videoHeight: number) => {
    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;
    const faceX = face.box.xCenter;
    const faceY = face.box.yCenter;
    
    const threshold = 100; // Increased threshold for more forgiving detection
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - faceX, 2) + Math.pow(centerY - faceY, 2)
    );
    
    return distanceFromCenter < threshold ? 'center' : 'off-center';
  };

  const startDetection = () => {
    if (!detector || !webcamRef.current?.video) return;

    const detectFace = async () => {
      const now = Date.now();
      if (now - lastDetectionTimeRef.current < 100) return; // Throttle detection
      lastDetectionTimeRef.current = now;

      try {
        const video = webcamRef.current?.video;
        if (!video || !isVideoReady || !detector) return;

        const faces = await detector.estimateFaces(video);
        const hasFace = faces.length > 0;
        setFaceDetected(hasFace);

        if (hasFace) {
          const face = faces[0];
          const position = checkFacePosition(face, video.videoWidth, video.videoHeight);
          setFacePosition(position);
          setError(null);
        } else {
          setFacePosition(null);
          setError('Aucun visage détecté');
        }
      } catch (err) {
        console.error('Detection error:', err);
        setError('Erreur de détection');
      }
    };

    detectionIntervalRef.current = setInterval(detectFace, 100);
  };

  const analyzeFaceShape = async () => {
    if (!detector || !webcamRef.current?.video || !isVideoReady) {
      setError('La vidéo n\'est pas prête');
      return;
    }

    if (facePosition !== 'center') {
      setError('Centrez votre visage');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const faces = await detector.estimateFaces(webcamRef.current.video);

      if (faces && faces.length > 0) {
        const face = faces[0];
        const { width, height } = face.box;
        const ratio = height / width;

        let faceShape = 'oval';
        if (ratio > 1.5) {
          faceShape = 'oblong';
        } else if (ratio < 1.2) {
          faceShape = 'round';
        } else if (ratio >= 1.2 && ratio <= 1.3) {
          faceShape = 'square';
        } else if (ratio > 1.3 && ratio <= 1.5) {
          faceShape = 'heart';
        }

        onAnalysisComplete(faceShape);
      } else {
        setError('Aucun visage détecté');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Erreur d\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative space-y-4">
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
        <Webcam
          ref={webcamRef}
          mirrored
          className="w-full h-full object-cover"
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user"
          }}
          onUserMediaError={() => {
            setError('Impossible d\'accéder à la caméra');
          }}
        />
        
        <div className={`absolute inset-0 border-4 transition-colors duration-300 ${
          faceDetected ? (
            facePosition === 'center' ? 'border-green-500' : 'border-yellow-500'
          ) : 'border-gray-300'
        } rounded-lg`}>
          <div className="absolute inset-1/4 border-2 border-dashed border-white/50 rounded-lg"></div>
        </div>

        {faceDetected && facePosition === 'off-center' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-yellow-500/80 text-white px-4 py-2 rounded-full flex items-center">
              <Move className="h-5 w-5 mr-2" />
              Centrez votre visage
            </div>
          </div>
        )}

        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full transition-colors ${
          faceDetected ? (
            facePosition === 'center' ? 'bg-green-500' : 'bg-yellow-500'
          ) : 'bg-gray-500'
        } text-white text-sm flex items-center`}>
          {!isVideoReady ? 'Initialisation...' : (
            faceDetected ? (
              facePosition === 'center' ? 'Visage bien positionné' : 'Ajustez la position'
            ) : 'En attente de détection'
          )}
        </div>

        {isModelLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Chargement du modèle...</p>
            </div>
          </div>
        )}
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
          disabled={isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || facePosition !== 'center'}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || facePosition !== 'center'
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              {faceDetected ? (
                facePosition === 'center' ? 'Analyser' : 'Centrez votre visage'
              ) : 'En attente de détection'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;