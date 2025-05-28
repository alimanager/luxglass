import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle, Camera, RefreshCw, CreditCard } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

// Credit card dimensions in millimeters (standard size)
const CREDIT_CARD_WIDTH_MM = 85.60;
const CREDIT_CARD_HEIGHT_MM = 53.98;

interface CalibrationBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  skinTone: 'Fair' | 'Light' | 'Medium Light' | 'Medium' | 'Medium Dark' | 'Dark' | 'Deep';
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [calibrationBox, setCalibrationBox] = useState<CalibrationBox>({
    x: 0,
    y: 0,
    width: 200,
    height: 125
  });
  const [scalingFactor, setScalingFactor] = useState<number | null>(null);
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const landmarksDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);

  useEffect(() => {
    const initializeDetectors = async () => {
      try {
        if (!window.__models?.faceDetector || !window.__models?.landmarksDetector) {
          throw new Error('Models not initialized in global context');
        }

        detectorRef.current = window.__models.faceDetector;
        landmarksDetectorRef.current = window.__models.landmarksDetector;
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.willReadFrequently = true;
        
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
        const video = webcamRef.current.video;
        
        if (video.readyState !== 4) {
          isDetecting = false;
          animationFrame = requestAnimationFrame(detectFace);
          return;
        }

        const faces = await detectorRef.current.estimateFaces(video);
        setFaceDetected(faces.length > 0);
        setError(faces.length === 0 ? 'No face detected. Please ensure your face is clearly visible in the frame.' : null);
      } catch (err) {
        console.error('Error detecting face:', err);
        setError('An error occurred during face detection.');
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

  const handleCalibration = () => {
    if (!webcamRef.current?.video) return;

    const video = webcamRef.current.video;
    const pixelWidth = calibrationBox.width;
    
    // Calculate scaling factor (mm/pixel)
    const newScalingFactor = CREDIT_CARD_WIDTH_MM / pixelWidth;
    console.log('Calibration Data:', {
      creditCardWidthMM: CREDIT_CARD_WIDTH_MM,
      pixelWidth,
      scalingFactor: newScalingFactor
    });

    setScalingFactor(newScalingFactor);
    setIsCalibrating(false);
  };

  const pixelsToMillimeters = (pixels: number): number => {
    if (!scalingFactor) {
      console.error('No scaling factor available');
      return pixels;
    }
    return pixels * scalingFactor;
  };

  const calculateDistance = (point1: number[], point2: number[]) => {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) + 
      Math.pow(point2[1] - point1[1], 2)
    );
  };

  const analyzeSkinTone = (canvas: HTMLCanvasElement, faceMesh: any): FaceCharacteristics['skinTone'] => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const samplePoints = [
      [faceMesh[10].x, faceMesh[10].y],
      [faceMesh[123].x, faceMesh[123].y],
      [faceMesh[352].x, faceMesh[352].y],
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

  const analyzeFaceCharacteristics = async (face: faceDetection.Face, frameCanvas: HTMLCanvasElement): Promise<FaceCharacteristics> => {
    if (!landmarksDetectorRef.current || !scalingFactor) {
      throw new Error('Landmarks detector or calibration not ready');
    }

    const landmarks = await landmarksDetectorRef.current.estimateFaces(frameCanvas);

    if (!landmarks || landmarks.length === 0) {
      throw new Error('No face landmarks detected');
    }

    const faceMesh = landmarks[0].keypoints;
    if (!faceMesh) {
      throw new Error('Face mesh data not available');
    }

    const LEFT_EYE = 133;
    const RIGHT_EYE = 362;
    const NOSE_BRIDGE = 168;
    const NOSE_TIP = 1;
    const FOREHEAD = 10;
    const CHIN = 152;
    const LEFT_CHEEK = 123;
    const RIGHT_CHEEK = 352;
    const LEFT_TEMPLE = 234;
    const RIGHT_TEMPLE = 454;
    const LEFT_JAW = 172;
    const RIGHT_JAW = 397;
    const LEFT_NOSE_BRIDGE = 102;
    const RIGHT_NOSE_BRIDGE = 331;
    const LEFT_PUPIL = 468;
    const RIGHT_PUPIL = 473;

    const box = face.box;
    const faceWidth = pixelsToMillimeters(Math.round(box.width));
    const faceLength = pixelsToMillimeters(Math.round(box.height));

    const interpupillaryDistance = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[LEFT_PUPIL].x, faceMesh[LEFT_PUPIL].y],
          [faceMesh[RIGHT_PUPIL].x, faceMesh[RIGHT_PUPIL].y]
        )
      )
    );

    const noseBridgeWidth = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[LEFT_NOSE_BRIDGE].x, faceMesh[LEFT_NOSE_BRIDGE].y],
          [faceMesh[RIGHT_NOSE_BRIDGE].x, faceMesh[RIGHT_NOSE_BRIDGE].y]
        )
      )
    );

    const noseLength = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[NOSE_BRIDGE].x, faceMesh[NOSE_BRIDGE].y],
          [faceMesh[NOSE_TIP].x, faceMesh[NOSE_TIP].y]
        )
      )
    );

    const templeLength = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[LEFT_TEMPLE].x, faceMesh[LEFT_TEMPLE].y],
          [faceMesh[RIGHT_TEMPLE].x, faceMesh[RIGHT_TEMPLE].y]
        ) / 2
      )
    );

    const foreheadToEyebrowDistance = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[FOREHEAD].x, faceMesh[FOREHEAD].y],
          [faceMesh[NOSE_BRIDGE].x, faceMesh[NOSE_BRIDGE].y]
        )
      )
    );

    const foreheadHeight = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[FOREHEAD].x, faceMesh[FOREHEAD].y],
          [faceMesh[NOSE_BRIDGE].x, faceMesh[NOSE_BRIDGE].y]
        )
      )
    );

    const leftSide = calculateDistance(
      [faceMesh[LEFT_CHEEK].x, faceMesh[LEFT_CHEEK].y],
      [faceMesh[NOSE_TIP].x, faceMesh[NOSE_TIP].y]
    );
    const rightSide = calculateDistance(
      [faceMesh[RIGHT_CHEEK].x, faceMesh[RIGHT_CHEEK].y],
      [faceMesh[NOSE_TIP].x, faceMesh[NOSE_TIP].y]
    );
    const symmetry = Math.round(100 - (Math.abs(leftSide - rightSide) / ((leftSide + rightSide) / 2)) * 100);

    const jawlineLength = (
      calculateDistance(
        [faceMesh[LEFT_JAW].x, faceMesh[LEFT_JAW].y],
        [faceMesh[CHIN].x, faceMesh[CHIN].y]
      ) +
      calculateDistance(
        [faceMesh[RIGHT_JAW].x, faceMesh[RIGHT_JAW].y],
        [faceMesh[CHIN].x, faceMesh[CHIN].y]
      )
    ) / 2;
    const jawlineStrength = Math.round((jawlineLength / box.width) * 100);

    const cheekboneWidth = calculateDistance(
      [faceMesh[LEFT_CHEEK].x, faceMesh[LEFT_CHEEK].y],
      [faceMesh[RIGHT_CHEEK].x, faceMesh[RIGHT_CHEEK].y]
    );
    const cheekboneProminence = Math.round((cheekboneWidth / box.width) * 100);

    const chinWidth = calculateDistance(
      [faceMesh[LEFT_JAW].x, faceMesh[LEFT_JAW].y],
      [faceMesh[RIGHT_JAW].x, faceMesh[RIGHT_JAW].y]
    );
    const chinHeight = calculateDistance(
      [faceMesh[CHIN].x, faceMesh[CHIN].y],
      [faceMesh[NOSE_TIP].x, faceMesh[NOSE_TIP].y]
    );
    
    const chinRatio = chinHeight / chinWidth;
    let chinShape: 'pointed' | 'rounded' | 'square';
    
    if (chinRatio > 1.3) {
      chinShape = 'pointed';
    } else if (chinRatio < 1.1) {
      chinShape = 'square';
    } else {
      chinShape = 'rounded';
    }

    const eyeDistance = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[LEFT_EYE].x, faceMesh[LEFT_EYE].y],
          [faceMesh[RIGHT_EYE].x, faceMesh[RIGHT_EYE].y]
        )
      )
    );

    const skinTone = analyzeSkinTone(frameCanvas, faceMesh);

    return {
      symmetry,
      jawlineStrength,
      foreheadHeight,
      cheekboneProminence,
      chinShape,
      faceLength,
      faceWidth,
      eyeDistance,
      noseLength,
      noseBridgeWidth,
      templeLength,
      interpupillaryDistance,
      foreheadToEyebrowDistance,
      skinTone
    };
  };

  const analyzeFaceShape = async () => {
    if (!faceDetected) {
      setError('Please ensure a face is detected before analysis.');
      return;
    }

    if (!detectorRef.current || !landmarksDetectorRef.current) {
      setError('Face detection models are not ready. Please refresh the page.');
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
        throw new Error('Unable to detect face. Please ensure your face is clearly visible.');
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
      setError(err instanceof Error ? err.message : 'An error occurred during analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

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
            setError('Unable to access camera. Please check permissions.');
          }}
          onLoadedData={() => setIsVideoReady(true)}
        />
        
        {isCalibrating ? (
          <>
            <div 
              className="absolute border-2 border-primary-500 border-dashed"
              style={{
                left: `${calibrationBox.x}px`,
                top: `${calibrationBox.y}px`,
                width: `${calibrationBox.width}px`,
                height: `${calibrationBox.height}px`
              }}
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <CreditCard className="h-6 w-6 text-primary-600 mr-2" />
                <span>Alignez une carte bancaire avec le rectangle</span>
              </div>
              <button
                onClick={handleCalibration}
                className="btn btn-primary"
              >
                Calibrer
              </button>
            </div>
          </>
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
              {!isVideoReady ? 'Initializing camera...' : (
                faceDetected ? 'Face detected' : 'Waiting for face detection'
              )}
            </div>
          </>
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
              <RefreshCw className="h-5 w-5 animate-spin text-primary-600" />
              <span>Analyzing face shape...</span>
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
          disabled={isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || isCalibrating}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || isCalibrating
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {isModelLoading ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Loading model...
            </>
          ) : !isVideoReady ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Initializing camera...
            </>
          ) : isAnalyzing ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : isCalibrating ? (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Please calibrate first
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              {faceDetected ? 'Analyze face shape' : 'Waiting for face detection'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;