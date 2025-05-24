import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertCircle } from 'lucide-react';
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
  const [landmarksDetector, setLandmarksDetector] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initializeTF = async () => {
      try {
        setIsModelLoading(true);
        setError(null);
        
        await tf.setBackend('webgl');
        await tf.ready();
        
        // Initialize face detection model
        const faceModel = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            modelType: 'short',
            maxFaces: 1
          }
        );
        
        // Initialize face landmarks detection model
        const landmarksModel = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: 'tfjs',
            refineLandmarks: true,
            maxFaces: 1
          }
        );
        
        setDetector(faceModel);
        setLandmarksDetector(landmarksModel);
        
        // Wait for video to be ready before starting detection
        if (webcamRef.current?.video) {
          webcamRef.current.video.addEventListener('loadeddata', () => {
            startContinuousDetection(faceModel, landmarksModel);
          });
        }
      } catch (err) {
        console.error('Error loading face detection models:', err);
        setError('Erreur lors du chargement des modèles de détection faciale');
      } finally {
        setIsModelLoading(false);
      }
    };

    initializeTF();

    return () => {
      if (detector) {
        detector.dispose();
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const isVideoReady = (video: HTMLVideoElement): boolean => {
    return video.readyState === 4 && video.videoWidth > 0 && video.videoHeight > 0;
  };

  const startContinuousDetection = (
    faceModel: faceDetection.FaceDetector,
    landmarksModel: faceLandmarksDetection.FaceLandmarksDetector
  ) => {
    const detectFace = async () => {
      try {
        const video = webcamRef.current?.video;
        if (!video || !faceModel || !landmarksModel) return;

        // Check if video is ready and has valid dimensions
        if (!isVideoReady(video)) {
          console.log('Video not ready yet, skipping detection');
          animationFrameRef.current = requestAnimationFrame(detectFace);
          return;
        }

        // Detect face and landmarks
        const detections = await faceModel.estimateFaces(video);
        const hasFace = detections.length > 0;
        setFaceDetected(hasFace);

        if (hasFace) {
          // Get face landmarks
          const landmarks = await landmarksModel.estimateFaces(video);
          if (landmarks.length > 0 && onLandmarksDetected) {
            onLandmarksDetected(landmarks[0]);
          }
          
          if (error) {
            setError(null);
          }
        }

        animationFrameRef.current = requestAnimationFrame(detectFace);
      } catch (err) {
        console.error('Error in continuous detection:', err);
        setFaceDetected(false);
        // Retry detection after a short delay
        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(detectFace);
        }, 1000);
      }
    };

    animationFrameRef.current = requestAnimationFrame(detectFace);
  };

  const analyzeFaceShape = async () => {
    if (!detector || !webcamRef.current?.video) return;

    const video = webcamRef.current.video;
    if (!isVideoReady(video)) {
      setError('La vidéo n\'est pas encore prête. Veuillez patienter.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const detections = await detector.estimateFaces(video);

      if (detections && detections.length > 0) {
        const face = detections[0];
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
        setError('Aucun visage détecté. Veuillez vous assurer d\'être bien cadré et dans un endroit bien éclairé.');
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
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
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
        />
        
        {/* Face detection guide overlay */}
        <div className={`absolute inset-0 border-4 transition-colors duration-300 ${
          faceDetected ? 'border-green-500' : 'border-gray-300'
        } rounded-lg`}>
          <div className="absolute inset-1/4 border-2 border-dashed border-white/50 rounded-lg"></div>
        </div>

        {/* Face detection status indicator */}
        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full transition-colors ${
          faceDetected ? 'bg-green-500' : 'bg-gray-500'
        } text-white text-sm flex items-center`}>
          {faceDetected ? 'Visage détecté' : 'En attente de détection'}
        </div>

        {/* Loading overlay */}
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
          disabled={isAnalyzing || isModelLoading || !faceDetected}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !faceDetected
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {isModelLoading ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Chargement du modèle...
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