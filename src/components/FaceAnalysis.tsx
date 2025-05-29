import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import FaceCalibration from './FaceCalibration';

const IRIS_DIAMETER_MM = 11.7; // Average human iris diameter in millimeters

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
  const [calibrationStep, setCalibrationStep] = useState<'face' | 'complete'>('face');
  const [scalingFactor, setScalingFactor] = useState<number | null>(null);
  const [currentLandmarks, setCurrentLandmarks] = useState<any>(null);
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
        
        console.log('Detectors initialized:', {
          faceDetector: detectorRef.current,
          landmarksDetector: landmarksDetectorRef.current
        });
        
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

  const handleFaceCalibrationComplete = (newScalingFactor: number) => {
    console.log('Calibration complete with scaling factor:', newScalingFactor);
    setScalingFactor(newScalingFactor);
    setCalibrationStep('complete');
    setIsCalibrating(false);
  };

  const handleLandmarksUpdate = (landmarks: any) => {
    setCurrentLandmarks(landmarks);
  };

  const calculateDistance = (point1: number[], point2: number[]) => {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) + 
      Math.pow(point2[1] - point1[1], 2)
    );
  };

  const pixelsToMillimeters = (pixels: number): number => {
    if (!scalingFactor) {
      console.error('No scaling factor available');
      return pixels;
    }
    return pixels * scalingFactor;
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
      console.error('Dependencies not ready:', {
        landmarksDetector: !!landmarksDetectorRef.current,
        scalingFactor
      });
      throw new Error('Landmarks detector or calibration not ready');
    }

    const landmarks = await landmarksDetectorRef.current.estimateFaces(frameCanvas);
    console.log('Face landmarks detected:', landmarks);
    
    if (!landmarks || landmarks.length === 0) {
      throw new Error('No face landmarks detected');
    }

    const faceMesh = landmarks[0].keypoints;
    if (!faceMesh) {
      throw new Error('Face mesh data not available');
    }

    console.log('Processing face mesh with scaling factor:', scalingFactor);

    const box = face.box;
    const faceWidth = pixelsToMillimeters(Math.round(box.width));
    const faceLength = pixelsToMillimeters(Math.round(box.height));

    const interpupillaryDistance = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[468].x, faceMesh[468].y],
          [faceMesh[473].x, faceMesh[473].y]
        )
      )
    );

    console.log('Key measurements:', {
      faceWidth,
      faceLength,
      interpupillaryDistance
    });

    const noseBridgeWidth = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[168].x - 15, faceMesh[168].y],
          [faceMesh[168].x + 15, faceMesh[168].y]
        )
      )
    );

    const noseLength = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[168].x, faceMesh[168].y],
          [faceMesh[1].x, faceMesh[1].y]
        )
      )
    );

    const templeLength = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[234].x, faceMesh[234].y],
          [faceMesh[454].x, faceMesh[454].y]
        ) / 2
      )
    );

    const foreheadToEyebrowDistance = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[10].x, faceMesh[10].y],
          [faceMesh[168].x, faceMesh[168].y]
        )
      )
    );

    const foreheadHeight = pixelsToMillimeters(
      Math.round(
        calculateDistance(
          [faceMesh[10].x, faceMesh[10].y],
          [faceMesh[168].x, faceMesh[168].y]
        )
      )
    );

    const leftSide = calculateDistance(
      [faceMesh[123].x, faceMesh[123].y],
      [faceMesh[1].x, faceMesh[1].y]
    );
    const rightSide = calculateDistance(
      [faceMesh[352].x, faceMesh[352].y],
      [faceMesh[1].x, faceMesh[1].y]
    );
    const symmetry = Math.round(100 - (Math.abs(leftSide - rightSide) / ((leftSide + rightSide) / 2)) * 100);

    const jawlineLength = (
      calculateDistance(
        [faceMesh[172].x, faceMesh[172].y],
        [faceMesh[152].x, faceMesh[152].y]
      ) +
      calculateDistance(
        [faceMesh[397].x, faceMesh[397].y],
        [faceMesh[152].x, faceMesh[152].y]
      )
    ) / 2;
    const jawlineStrength = Math.round((jawlineLength / box.width) * 100);

    const cheekboneWidth = calculateDistance(
      [faceMesh[123].x, faceMesh[123].y],
      [faceMesh[352].x, faceMesh[352].y]
    );
    const cheekboneProminence = Math.round((cheekboneWidth / box.width) * 100);

    const chinWidth = calculateDistance(
      [faceMesh[172].x, faceMesh[172].y],
      [faceMesh[397].x, faceMesh[397].y]
    );
    const chinHeight = calculateDistance(
      [faceMesh[152].x, faceMesh[152].y],
      [faceMesh[1].x, faceMesh[1].y]
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
          [faceMesh[133].x, faceMesh[133].y],
          [faceMesh[362].x, faceMesh[362].y]
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

    if (!scalingFactor) {
      setError('Calibration not complete. Please wait for calibration to finish.');
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
        
        {calibrationStep === 'face' ? (
          <FaceCalibration
            onCalibrationComplete={handleFaceCalibrationComplete}
            isCalibrating={isCalibrating}
            onLandmarksUpdate={handleLandmarksUpdate}
            webcamRef={webcamRef.current?.video || null}
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
          disabled={isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || calibrationStep !== 'complete'}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || calibrationStep !== 'complete'
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
          ) : calibrationStep !== 'complete' ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2" />
              Complete calibration first
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