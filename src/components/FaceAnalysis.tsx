import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertCircle } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';

interface FaceAnalysisProps {
  onAnalysisComplete: (faceShape: string) => void;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detector, setDetector] = useState<faceDetection.FaceDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const animationFrameRef = useRef<number>();
  const detectionIntervalRef = useRef<NodeJS.Timeout>();

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
        startContinuousDetection();
      } catch (err) {
        console.error('Error loading face detection model:', err);
        setError('Erreur lors du chargement du modèle de détection faciale');
      } finally {
        setIsModelLoading(false);
      }
    };

    initializeTF();

    return () => {
      if (detector) {
        detector.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const startContinuousDetection = () => {
    if (!detector || !webcamRef.current?.video) return;

    const detectFace = async () => {
      try {
        const video = webcamRef.current?.video;
        if (!video) return;

        const detections = await detector.estimateFaces(video);
        setFaceDetected(detections.length > 0);
      } catch (err) {
        console.error('Error in continuous detection:', err);
      }
    };

    // Run detection every 500ms
    detectionIntervalRef.current = setInterval(detectFace, 500);
  };

  const analyzeFaceShape = async () => {
    if (!detector || !webcamRef.current?.video) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const video = webcamRef.current?.video;
      if (!video) return;

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

      {!isModelLoading && !error && !faceDetected && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <p>Placez votre visage dans le cadre pour commencer l'analyse</p>
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
          aria-label={
            isModelLoading ? "Chargement du modèle" :
            isAnalyzing ? "Analyse en cours" :
            !faceDetected ? "Visage non détecté" :
            "Analyser la forme du visage"
          }
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
              Analyser la forme du visage
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;