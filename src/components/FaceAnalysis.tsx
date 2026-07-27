import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import FaceCalibration from './FaceCalibration';
import { loadFaceModels } from '../utils/modelLoader';
import { SkinTone } from '../types/glasses';

// Le diamètre de l'iris humain est quasi constant (~11,7 mm) : il sert
// d'étalon pour convertir les pixels en millimètres.
const IRIS_DIAMETER_MM = 11.7;

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
  skinTone: SkinTone;
}

interface Point3D {
  x: number;
  y: number;
  z?: number;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [calibrationStep, setCalibrationStep] = useState<'face' | 'complete'>('face');
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const landmarksDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadFaceModels()
      .then(models => {
        if (cancelled) return;
        detectorRef.current = models.faceDetector;
        landmarksDetectorRef.current = models.landmarksDetector;
        canvasRef.current = document.createElement('canvas');
        setIsModelLoading(false);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Impossible d'initialiser la détection de visage. Veuillez recharger la page.");
        setIsModelLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
        const video = webcamRef.current.video;

        if (video.readyState !== 4) {
          isDetecting = false;
          animationFrame = requestAnimationFrame(detectFace);
          return;
        }

        const faces = await detectorRef.current.estimateFaces(video);
        setFaceDetected(faces.length > 0);
        setError(faces.length === 0 ? 'Aucun visage détecté. Placez votre visage bien en face de la caméra.' : null);
      } catch (err) {
        console.error('Error detecting face:', err);
        setError('Une erreur est survenue pendant la détection du visage.');
      }

      isDetecting = false;
      animationFrame = requestAnimationFrame(detectFace);
    };

    if (isVideoReady && !isModelLoading && !isCalibrating) {
      detectFace();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVideoReady, isModelLoading, isCalibrating]);

  const handleFaceCalibrationComplete = () => {
    setCalibrationStep('complete');
    setIsCalibrating(false);
  };

  const distance3D = (p1: Point3D, p2: Point3D): number =>
    Math.sqrt(
      Math.pow(p2.x - p1.x, 2) +
      Math.pow(p2.y - p1.y, 2) +
      (p1.z !== undefined && p2.z !== undefined ? Math.pow(p2.z - p1.z, 2) : 0)
    );

  const centroid = (points: Point3D[]): Point3D => ({
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    z: points.reduce((sum, p) => sum + (p.z ?? 0), 0) / points.length
  });

  // Diamètre horizontal de l'iris (le vertical est faussé par les paupières)
  const irisHorizontalDiameter = (irisPoints: Point3D[]): number => {
    const left = irisPoints.reduce((min, p) => (p.x < min.x ? p : min));
    const right = irisPoints.reduce((max, p) => (p.x > max.x ? p : max));
    return distance3D(left, right);
  };

  const analyzeSkinTone = (canvas: HTMLCanvasElement, faceMesh: Point3D[]): SkinTone => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Points d'échantillonnage : front, joues, menton
    const samplePoints = [
      [faceMesh[151].x, faceMesh[151].y],
      [faceMesh[116].x, faceMesh[116].y],
      [faceMesh[345].x, faceMesh[345].y],
      [faceMesh[152].x, faceMesh[152].y]
    ];

    let totalR = 0, totalG = 0, totalB = 0;
    const samples = samplePoints.length;

    samplePoints.forEach(([x, y]) => {
      const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      totalR += pixel[0];
      totalG += pixel[1];
      totalB += pixel[2];
    });

    const avgR = totalR / samples;
    const avgG = totalG / samples;
    const avgB = totalB / samples;

    const max = Math.max(avgR, avgG, avgB);
    const min = Math.min(avgR, avgG, avgB);
    const v = max / 255;
    const s = max === 0 ? 0 : (max - min) / max;

    if (v > 0.8 && s < 0.3) return 'Fair';
    if (v > 0.7 && s < 0.35) return 'Light';
    if (v > 0.6 && s < 0.4) return 'Medium Light';
    if (v > 0.5 && s < 0.45) return 'Medium';
    if (v > 0.4 && s < 0.5) return 'Medium Dark';
    if (v > 0.3 && s < 0.55) return 'Dark';
    return 'Deep';
  };

  const captureVideoFrame = (): HTMLCanvasElement | null => {
    if (!webcamRef.current?.video || !canvasRef.current) return null;

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    return canvas;
  };

  const analyzeFaceCharacteristics = async (
    face: faceDetection.Face,
    frameCanvas: HTMLCanvasElement
  ): Promise<FaceCharacteristics> => {
    if (!landmarksDetectorRef.current) {
      throw new Error('Landmarks detector not ready');
    }

    const landmarks = await landmarksDetectorRef.current.estimateFaces(frameCanvas);

    if (!landmarks || landmarks.length === 0) {
      throw new Error('No face landmarks detected');
    }

    const faceMesh = landmarks[0].keypoints as (Point3D & { name?: string })[];
    if (!faceMesh) {
      throw new Error('Face mesh data not available');
    }

    // Étalonnage : l'iris sert de référence unique pour toutes les conversions px → mm
    const leftIris = faceMesh.filter(p => p.name?.includes('leftIris'));
    const rightIris = faceMesh.filter(p => p.name?.includes('rightIris'));

    if (leftIris.length === 0 || rightIris.length === 0) {
      throw new Error('Iris landmarks not available. Please retry with better lighting.');
    }

    const avgIrisDiameter = (irisHorizontalDiameter(leftIris) + irisHorizontalDiameter(rightIris)) / 2;
    const mmPerPixel = IRIS_DIAMETER_MM / avgIrisDiameter;
    const toMm = (pixels: number) => pixels * mmPerPixel;

    // Écart pupillaire : distance entre les centres des deux iris
    const ipdMm = toMm(distance3D(centroid(leftIris), centroid(rightIris)));

    // Mesures principales du visage
    const faceLengthMm = toMm(distance3D(faceMesh[10], faceMesh[152]));   // front → menton
    const faceWidthMm = toMm(distance3D(faceMesh[234], faceMesh[454]));   // tempe → tempe
    const noseBridgeWidthMm = toMm(distance3D(faceMesh[122], faceMesh[351])); // flancs du pont nasal
    const noseLengthMm = toMm(distance3D(faceMesh[168], faceMesh[1]));
    const foreheadMm = toMm(distance3D(faceMesh[10], faceMesh[168]));

    // Longueur de branche estimée depuis la largeur du visage (standard 135-150 mm)
    const templeLengthMm = Math.min(150, Math.max(135, Math.round(135 + (faceWidthMm - 130) * 0.75)));

    // Caractéristiques proportionnelles (sans unité)
    const noseTip = faceMesh[1];
    const leftSide = distance3D(faceMesh[123], noseTip);
    const rightSide = distance3D(faceMesh[352], noseTip);
    const symmetry = Math.round(100 - (Math.abs(leftSide - rightSide) / ((leftSide + rightSide) / 2)) * 100);

    const jawlineLength = (
      distance3D(faceMesh[172], faceMesh[152]) +
      distance3D(faceMesh[397], faceMesh[152])
    ) / 2;
    const jawlineStrength = Math.round((jawlineLength / face.box.width) * 100);

    const cheekboneWidth = distance3D(faceMesh[123], faceMesh[352]);
    const cheekboneProminence = Math.round((cheekboneWidth / face.box.width) * 100);

    const chinWidth = distance3D(faceMesh[172], faceMesh[397]);
    const chinHeight = distance3D(faceMesh[152], noseTip);
    const chinRatio = chinHeight / chinWidth;

    let chinShape: 'pointed' | 'rounded' | 'square';
    if (chinRatio > 1.3) {
      chinShape = 'pointed';
    } else if (chinRatio < 1.1) {
      chinShape = 'square';
    } else {
      chinShape = 'rounded';
    }

    const skinTone = analyzeSkinTone(frameCanvas, faceMesh);

    return {
      symmetry,
      jawlineStrength,
      foreheadHeight: foreheadMm,
      cheekboneProminence,
      chinShape,
      faceLength: faceLengthMm,
      faceWidth: faceWidthMm,
      eyeDistance: ipdMm,
      noseLength: noseLengthMm,
      noseBridgeWidth: noseBridgeWidthMm,
      templeLength: templeLengthMm,
      interpupillaryDistance: ipdMm,
      foreheadToEyebrowDistance: foreheadMm,
      skinTone
    };
  };

  const analyzeFaceShape = useCallback(async () => {
    if (!faceDetected) {
      setError('Veuillez attendre que votre visage soit détecté avant de lancer l’analyse.');
      return;
    }

    if (!detectorRef.current || !landmarksDetectorRef.current) {
      setError('Les modèles de détection ne sont pas prêts. Veuillez recharger la page.');
      return;
    }

    if (!webcamRef.current?.video) {
      setError("Caméra non disponible. Vérifiez que l'accès est autorisé.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const frameCanvas = captureVideoFrame();
      if (!frameCanvas) {
        throw new Error('Failed to capture video frame');
      }

      const faces = await detectorRef.current.estimateFaces(frameCanvas);

      if (!faces || faces.length === 0) {
        throw new Error('Visage non détecté. Placez-vous bien en face de la caméra.');
      }

      const face = faces[0];
      const faceCharacteristics = await analyzeFaceCharacteristics(face, frameCanvas);

      const ratio = faceCharacteristics.faceLength / faceCharacteristics.faceWidth;
      const cheekboneRatio = faceCharacteristics.cheekboneProminence / 100;

      let faceShape;
      if (ratio > 1.35) {
        faceShape = 'oblong';
      } else if (ratio < 1.15 && cheekboneRatio > 0.8) {
        faceShape = 'round';
      } else if (faceCharacteristics.jawlineStrength > 85 && ratio < 1.25) {
        faceShape = 'square';
      } else {
        faceShape = 'oval';
      }

      onAnalysisComplete(faceShape, faceCharacteristics);
    } catch (err) {
      console.error('Error analyzing face:', err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue pendant l'analyse");
    } finally {
      setIsAnalyzing(false);
    }
  }, [faceDetected, onAnalysisComplete]);

  const isButtonDisabled = isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || calibrationStep !== 'complete';

  return (
    <div className="relative space-y-4">
      <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden relative">
        <Webcam
          ref={webcamRef}
          mirrored={false}
          className="w-full h-full object-cover"
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user"
          }}
          onUserMediaError={() => {
            setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
          }}
          onLoadedData={() => setIsVideoReady(true)}
        />

        {calibrationStep === 'face' ? (
          <FaceCalibration
            onCalibrationComplete={handleFaceCalibrationComplete}
            isCalibrating={isCalibrating}
            onLandmarksUpdate={() => {}}
            webcam={webcamRef.current?.video ?? null}
            landmarksDetector={landmarksDetectorRef.current}
          />
        ) : (
          <>
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
          </>
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
              <RefreshCw className="h-5 w-5 animate-spin text-primary-600" />
              <span>Analyse du visage en cours...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={analyzeFaceShape}
          disabled={isButtonDisabled}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isButtonDisabled
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
          ) : calibrationStep !== 'complete' ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2" />
              Terminez d'abord la calibration
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              {faceDetected ? 'Analyser la forme du visage' : 'En attente de détection'}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default FaceAnalysis;
