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
  const [landmarksDetector, setLandmarksDetector] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePosition, setFacePosition] = useState<'center' | 'off-center' | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const frameCountRef = useRef(0);
  const lastProcessTimeRef = useRef(0);
  const processingRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const landmarksDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const isDisposingRef = useRef(false);

  useEffect(() => {
    const initializeTF = async () => {
      try {
        setIsModelLoading(true);
        setError(null);

        const faceDetector = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            modelType: 'short',
            maxFaces: 1
          }
        );

        const landmarksDetector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: 'tfjs',
            refineLandmarks: true,
            maxFaces: 1
          }
        );

        if (!isDisposingRef.current) {
          detectorRef.current = faceDetector;
          landmarksDetectorRef.current = landmarksDetector;
          setDetector(faceDetector);
          setLandmarksDetector(landmarksDetector);
          setIsModelLoading(false);
        }
      } catch (err) {
        console.error('Error loading face detection models:', err);
        setError('Erreur lors du chargement des modèles de détection faciale. Veuillez rafraîchir la page.');
        setIsModelLoading(false);
      }
    };

    initializeTF();

    return () => {
      isDisposingRef.current = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
      if (landmarksDetectorRef.current) {
        landmarksDetectorRef.current.dispose();
      }
      tf.disposeVariables();
    };
  }, []);

  const calculateFaceShape = (landmarks: any) => {
    // Extract facial measurements
    const faceWidth = landmarks.boundingBox.width;
    const faceHeight = landmarks.boundingBox.height;
    const ratio = faceHeight / faceWidth;

    // Get key facial points
    const jawLeft = landmarks.mesh[132];
    const jawRight = landmarks.mesh[361];
    const chin = landmarks.mesh[152];
    const foreheadLeft = landmarks.mesh[21];
    const foreheadRight = landmarks.mesh[251];
    const cheekLeft = landmarks.mesh[123];
    const cheekRight = landmarks.mesh[352];
    const templeLeft = landmarks.mesh[162];
    const templeRight = landmarks.mesh[389];

    // Calculate key measurements
    const jawAngle = Math.atan2(
      chin[1] - jawLeft[1],
      chin[0] - jawLeft[0]
    ) * (180 / Math.PI);
    
    const foreheadWidth = Math.abs(foreheadRight[0] - foreheadLeft[0]);
    const cheekboneWidth = Math.abs(cheekRight[0] - cheekLeft[0]);
    const jawWidth = Math.abs(jawRight[0] - jawLeft[0]);
    const templeWidth = Math.abs(templeRight[0] - templeLeft[0]);

    // Calculate face shape based on measurements and ratios
    if (ratio > 1.5) {
      return 'oblong';
    }

    if (ratio < 1.2) {
      if (jawAngle > 60 && Math.abs(cheekboneWidth - jawWidth) < 10) {
        return 'round';
      }
      return 'square';
    }

    if (foreheadWidth > cheekboneWidth && 
        cheekboneWidth > jawWidth && 
        jawAngle < 45) {
      return 'heart';
    }

    if (Math.abs(foreheadWidth - cheekboneWidth) < 10 && 
        ratio >= 1.3 && 
        ratio <= 1.4 && 
        templeWidth > jawWidth) {
      return 'oval';
    }

    // Default to oval if no clear match
    return 'oval';
  };

  useEffect(() => {
    if (webcamRef.current?.video) {
      const video = webcamRef.current.video;
      
      const handleVideoReady = () => {
        if (video.readyState === 4) {
          setIsVideoReady(true);
          if (detector && landmarksDetector && !isDisposingRef.current) {
            startContinuousDetection();
          }
        }
      };

      video.addEventListener('loadeddata', handleVideoReady);
      
      if (video.readyState === 4) {
        handleVideoReady();
      }

      return () => {
        video.removeEventListener('loadeddata', handleVideoReady);
      };
    }
  }, [detector, landmarksDetector]);

  const checkFacePosition = (face: faceDetection.Face, videoWidth: number, videoHeight: number) => {
    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;
    const faceX = face.box.xCenter;
    const faceY = face.box.yCenter;
    
    const threshold = 150;
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - faceX, 2) + Math.pow(centerY - faceY, 2)
    );
    
    return distanceFromCenter < threshold ? 'center' : 'off-center';
  };

  const startContinuousDetection = () => {
    const FRAME_INTERVAL = 3;
    const MIN_PROCESS_INTERVAL = 50;

    const detectFace = async () => {
      if (isDisposingRef.current) return;

      const currentTime = performance.now();
      frameCountRef.current++;

      if (
        frameCountRef.current % FRAME_INTERVAL !== 0 ||
        currentTime - lastProcessTimeRef.current < MIN_PROCESS_INTERVAL ||
        processingRef.current
      ) {
        animationFrameRef.current = requestAnimationFrame(detectFace);
        return;
      }

      try {
        const video = webcamRef.current?.video;
        if (!video || !isVideoReady || !detector || !landmarksDetector) {
          animationFrameRef.current = requestAnimationFrame(detectFace);
          return;
        }

        processingRef.current = true;
        lastProcessTimeRef.current = currentTime;

        let faces;
        await tf.tidy(async () => {
          const imageTensor = tf.browser.fromPixels(video);
          faces = await detector.estimateFaces(imageTensor);
        });

        if (isDisposingRef.current) return;

        const position = faces.length > 0 
          ? checkFacePosition(faces[0], video.videoWidth, video.videoHeight)
          : null;

        setFaceDetected(faces.length > 0);
        setFacePosition(position);
        setError(faces.length === 0 
          ? 'Aucun visage détecté. Assurez-vous d\'être bien visible dans le cadre.' 
          : null
        );

        if (faces.length > 0 && position === 'center') {
          let landmarks;
          await tf.tidy(async () => {
            const landmarksTensor = tf.browser.fromPixels(video);
            landmarks = await landmarksDetector.estimateFaces(landmarksTensor);
          });

          if (!isDisposingRef.current && landmarks.length > 0 && onLandmarksDetected) {
            onLandmarksDetected(landmarks[0]);
          }
        }
      } catch (err) {
        console.error('Error in continuous detection:', err);
        setFaceDetected(false);
        setFacePosition(null);
        setError('Une erreur est survenue lors de la détection. Veuillez vérifier votre caméra.');
      } finally {
        processingRef.current = false;
        if (!isDisposingRef.current) {
          animationFrameRef.current = requestAnimationFrame(detectFace);
        }
      }
    };

    detectFace();
  };

  const analyzeFaceShape = async () => {
    if (!landmarksDetector || !webcamRef.current?.video || !isVideoReady) {
      setError('La vidéo n\'est pas encore prête. Veuillez patienter.');
      return;
    }

    if (facePosition !== 'center') {
      setError('Veuillez centrer votre visage dans le cadre avant l\'analyse.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const video = webcamRef.current.video;
      let landmarks;
      
      await tf.tidy(async () => {
        const imageTensor = tf.browser.fromPixels(video);
        landmarks = await landmarksDetector.estimateFaces(imageTensor);
      });

      if (!landmarks || landmarks.length === 0) {
        setError('Aucun visage détecté. Veuillez vous assurer d\'être bien cadré et dans un endroit bien éclairé.');
        return;
      }

      const faceShape = calculateFaceShape(landmarks[0]);
      onAnalysisComplete(faceShape);
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
            width: 1280,
            height: 960,
            facingMode: "user"
          }}
          onUserMediaError={() => {
            setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
          }}
        />
        
        <div className={`absolute inset-[15%] border-4 transition-colors duration-300 ${
          faceDetected ? (
            facePosition === 'center' ? 'border-green-500' : 'border-yellow-500'
          ) : 'border-gray-300'
        } rounded-lg`}>
          <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-lg"></div>
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
          {!isVideoReady ? 'Initialisation de la caméra...' : (
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
              {faceDetected ? (
                facePosition === 'center' ? 'Analyser la forme du visage' : 'Centrez votre visage'
              ) : 'En attente de détection du visage'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;