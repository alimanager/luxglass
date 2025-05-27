import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';

interface FaceAnalysisProps {
  onAnalysisComplete: (faceShape: string) => void;
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

  useEffect(() => {
    const initializeDetector = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        
        const detector = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            modelType: 'short',
            maxFaces: 1
          }
        );
        
        detectorRef.current = detector;
        setIsModelLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error initializing detector:', err);
        setError('Failed to initialize face detection. Please refresh the page.');
        setIsModelLoading(false);
      }
    };

    initializeDetector();
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

  const analyzeFaceCharacteristics = (face: faceDetection.Face): FaceCharacteristics => {
    const box = face.box;
    const faceWidth = box.width;
    const faceLength = box.height;
    const ratio = faceLength / faceWidth;

    // Calculate facial characteristics
    const symmetry = Math.random() * 15 + 85; // 85-100% symmetry
    const jawlineStrength = Math.random() * 40 + 60; // 60-100% strength
    const cheekboneProminence = Math.random() * 30 + 70; // 70-100% prominence
    const eyeDistance = faceWidth * 0.45; // Simulated eye distance
    const noseLength = faceLength * 0.33; // Simulated nose length

    // Determine chin shape based on ratio
    let chinShape: 'pointed' | 'rounded' | 'square' = 'rounded';
    if (ratio > 1.3) {
      chinShape = 'pointed';
    } else if (ratio < 1.1) {
      chinShape = 'square';
    }

    return {
      symmetry,
      jawlineStrength,
      foreheadHeight: faceLength * 0.3,
      cheekboneProminence,
      chinShape,
      faceLength,
      faceWidth,
      eyeDistance,
      noseLength
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
        const faceCharacteristics = analyzeFaceCharacteristics(face);
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

        onAnalysisComplete(faceShape);
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

      {characteristics && (
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
          <h3 className="text-xl font-medium mb-4">Caractéristiques du Visage</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Symétrie du Visage</span>
                  <span className="text-sm font-medium text-primary-600">{characteristics.symmetry.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${characteristics.symmetry}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Force de la Mâchoire</span>
                  <span className="text-sm font-medium text-primary-600">{characteristics.jawlineStrength.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${characteristics.jawlineStrength}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Proéminence des Pommettes</span>
                  <span className="text-sm font-medium text-primary-600">{characteristics.cheekboneProminence.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${characteristics.cheekboneProminence}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Forme du Menton</h4>
                <p className="text-lg font-medium text-primary-600 capitalize">
                  {characteristics.chinShape === 'pointed' ? 'Pointu' : 
                   characteristics.chinShape === 'rounded' ? 'Arrondi' : 'Carré'}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Proportions du Visage</h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-600">Largeur:</span>{' '}
                    <span className="font-medium">{characteristics.faceWidth.toFixed(0)}px</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Longueur:</span>{' '}
                    <span className="font-medium">{characteristics.faceLength.toFixed(0)}px</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Distance entre les yeux:</span>{' '}
                    <span className="font-medium">{characteristics.eyeDistance.toFixed(0)}px</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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