import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

declare global {
  interface Window {
    __models?: {
      faceDetector?: faceDetection.FaceDetector;
      landmarksDetector?: faceLandmarksDetection.FaceLandmarksDetector;
    };
  }
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
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const landmarksDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const lastLandmarksRef = useRef<any>(null);

  useEffect(() => {
    const initializeDetectors = async () => {
      try {
        if (!window.__models?.faceDetector || !window.__models?.landmarksDetector) {
          throw new Error('Models not initialized in global context');
        }

        console.log('Using pre-initialized models:', {
          faceDetector: window.__models.faceDetector,
          landmarksDetector: window.__models.landmarksDetector
        });

        detectorRef.current = window.__models.faceDetector;
        landmarksDetectorRef.current = window.__models.landmarksDetector;

        // Initialize canvas with proper dimensions
        canvasRef.current = document.createElement('canvas');
        
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
        console.log('Video state:', {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState,
          timestamp: Date.now()
        });

        if (video.readyState !== 4) {
          console.log('Video not ready yet, waiting...');
          isDetecting = false;
          animationFrame = requestAnimationFrame(detectFace);
          return;
        }

        const faces = await detectorRef.current.estimateFaces(video);
        console.log('Face detection result:', faces);
        
        setFaceDetected(faces.length > 0);
        setError(faces.length === 0 ? 'No face detected. Please ensure your face is clearly visible in the frame.' : null);
      } catch (err) {
        console.error('Error detecting face:', err);
        setError('An error occurred during face detection.');
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

  const captureVideoFrame = (): HTMLCanvasElement | null => {
    if (!webcamRef.current?.video || !canvasRef.current) return null;

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    console.log('Canvas dimensions:', {
      width: canvas.width,
      height: canvas.height,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      timestamp: Date.now()
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Draw the full video frame onto the canvas
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    return canvas;
  };

  const calculateDistance = (point1: number[], point2: number[]) => {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) + 
      Math.pow(point2[1] - point1[1], 2)
    );
  };

  const analyzeFaceCharacteristics = async (face: faceDetection.Face, frameCanvas: HTMLCanvasElement): Promise<FaceCharacteristics> => {
    if (!landmarksDetectorRef.current) {
      throw new Error('Landmarks detector not ready');
    }

    console.log('Input to estimateFaces:', {
      canvas: frameCanvas,
      width: frameCanvas.width,
      height: frameCanvas.height,
      timestamp: Date.now()
    });

    const landmarks = await landmarksDetectorRef.current.estimateFaces(frameCanvas);
    console.log('Landmark detection result:', landmarks);

    // Store landmarks for comparison
    const previousLandmarks = lastLandmarksRef.current;
    lastLandmarksRef.current = landmarks;

    // Compare with previous landmarks to verify they're changing
    if (previousLandmarks) {
      console.log('Landmarks changed from previous detection:', 
        JSON.stringify(landmarks) !== JSON.stringify(previousLandmarks)
      );
    }

    if (!landmarks || landmarks.length === 0) {
      throw new Error('No face landmarks detected. Please ensure your face is well-lit and clearly visible.');
    }

    const faceMesh = landmarks[0].keypoints;
    console.log('Face mesh keypoints:', faceMesh);

    if (!faceMesh) {
      throw new Error('Face mesh data not available');
    }

    // MediaPipe Face Mesh landmark indices
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

    // Validate landmark indices
    const requiredPoints = [
      LEFT_EYE, RIGHT_EYE, NOSE_BRIDGE, NOSE_TIP, FOREHEAD, CHIN,
      LEFT_CHEEK, RIGHT_CHEEK, LEFT_TEMPLE, RIGHT_TEMPLE, LEFT_JAW, RIGHT_JAW
    ];

    for (const point of requiredPoints) {
      if (!faceMesh[point]) {
        console.error('Missing landmark point:', point);
        throw new Error(`Missing required facial landmark at index ${point}`);
      }
    }

    const box = face.box;
    const faceWidth = Math.round(box.width);
    const faceLength = Math.round(box.height);

    const interpupillaryDistance = Math.round(
      calculateDistance(
        [faceMesh[LEFT_EYE].x, faceMesh[LEFT_EYE].y],
        [faceMesh[RIGHT_EYE].x, faceMesh[RIGHT_EYE].y]
      )
    );

    const noseLength = Math.round(
      calculateDistance(
        [faceMesh[NOSE_BRIDGE].x, faceMesh[NOSE_BRIDGE].y],
        [faceMesh[NOSE_TIP].x, faceMesh[NOSE_TIP].y]
      )
    );
    const noseBridgeWidth = Math.round(faceWidth * 0.15);

    const templeLength = Math.round(
      calculateDistance(
        [faceMesh[LEFT_TEMPLE].x, faceMesh[LEFT_TEMPLE].y],
        [faceMesh[RIGHT_TEMPLE].x, faceMesh[RIGHT_TEMPLE].y]
      ) / 2
    );

    const foreheadToEyebrowDistance = Math.round(
      calculateDistance(
        [faceMesh[FOREHEAD].x, faceMesh[FOREHEAD].y],
        [faceMesh[NOSE_BRIDGE].x, faceMesh[NOSE_BRIDGE].y]
      )
    );
    const foreheadHeight = Math.round(
      calculateDistance(
        [faceMesh[FOREHEAD].x, faceMesh[FOREHEAD].y],
        [faceMesh[NOSE_BRIDGE].x, faceMesh[NOSE_BRIDGE].y]
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
    const jawlineStrength = Math.round((jawlineLength / faceWidth) * 100);

    const cheekboneWidth = calculateDistance(
      [faceMesh[LEFT_CHEEK].x, faceMesh[LEFT_CHEEK].y],
      [faceMesh[RIGHT_CHEEK].x, faceMesh[RIGHT_CHEEK].y]
    );
    const cheekboneProminence = Math.round((cheekboneWidth / faceWidth) * 100);

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
      console.log('Face detection result in analyzeFaceShape:', faces);
      
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
            width: 640,
            height: 480,
            facingMode: "user"
          }}
          onUserMediaError={() => {
            setError('Unable to access camera. Please check permissions.');
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
          {!isVideoReady ? 'Initializing camera...' : (
            faceDetected ? 'Face detected' : 'Waiting for face detection'
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