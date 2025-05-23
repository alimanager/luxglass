import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
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

  useEffect(() => {
    const initializeTF = async () => {
      try {
        setIsModelLoading(true);
        setError(null);
        
        await tf.ready();
        
        const model = await faceDetection.load(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection',
            modelType: 'short',
            maxFaces: 1
          }
        );
        
        setDetector(model);
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
    };
  }, []);

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
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
        <Webcam
          ref={webcamRef}
          mirrored
          className="w-full h-full object-cover"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={analyzeFaceShape}
          disabled={isAnalyzing || isModelLoading}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading
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
              Analyser la forme du visage
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;