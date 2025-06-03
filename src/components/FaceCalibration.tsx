import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';

interface FaceCalibrationProps {
  onCalibrationComplete: (scalingFactor: number) => void;
  isCalibrating: boolean;
  onLandmarksUpdate: (landmarks: any) => void;
  webcam: HTMLVideoElement | null;
  landmarksDetector: any;
}

const AVERAGE_FACE_HEIGHT_MM = 200;
const MIN_VALID_FRAMES = 10;
const MAX_RETRIES = 3;
const IDEAL_FACE_HEIGHT_RATIO = 0.6;

const FaceCalibration: React.FC<FaceCalibrationProps> = ({ 
  onCalibrationComplete, 
  isCalibrating, 
  onLandmarksUpdate,
  webcam,
  landmarksDetector 
}) => {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [ovalScale, setOvalScale] = useState(1);
  const [ovalColor, setOvalColor] = useState('#3B82F6');
  const [stabilityScore, setStabilityScore] = useState(0);
  const [ellipseParams, setEllipseParams] = useState({
    centerX: 50,
    centerY: 50,
    width: 30,
    height: 40,
    rotation: 0
  });
  
  const faceHeightDataRef = useRef<number[]>([]);
  const frameBufferRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const previousParamsRef = useRef(ellipseParams);
  const smoothingFactorRef = useRef(0.3);
  const lastUpdateTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsRef = useRef(0);

  useEffect(() => {
    if (!frameBufferRef.current) {
      frameBufferRef.current = document.createElement('canvas');
      frameBufferRef.current.width = 1280;
      frameBufferRef.current.height = 720;
    }
  }, []);

  const validateVideoFrame = (video: HTMLVideoElement): boolean => {
    return (
      video.readyState === 4 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !video.paused &&
      !video.ended &&
      video.currentTime > 0
    );
  };

  const captureVideoFrame = (video: HTMLVideoElement): HTMLCanvasElement | null => {
    if (!frameBufferRef.current || !validateVideoFrame(video)) return null;

    const canvas = frameBufferRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      return canvas;
    } catch (error) {
      console.error('Frame capture error:', error);
      return null;
    }
  };

  const calculateDistance = (point1: any, point2: any): number => {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2) +
      Math.pow(point2.z - point1.z, 2)
    );
  };

  const smoothValue = (current: number, target: number, factor: number): number => {
    return current + (target - current) * factor;
  };

  const updateEllipsePosition = (faceMesh: any[]) => {
    if (!faceMesh || faceMesh.length < 468) return;

    const now = performance.now();
    frameCountRef.current++;
    
    if (now - lastUpdateTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastUpdateTimeRef.current = now;
    }

    // Key facial landmarks
    const leftEye = faceMesh[33];    // Left eye outer corner
    const rightEye = faceMesh[263];  // Right eye outer corner
    const forehead = faceMesh[10];   // Forehead center
    const chin = faceMesh[152];      // Chin center
    const leftCheek = faceMesh[234]; // Left cheek
    const rightCheek = faceMesh[454];// Right cheek

    if (!leftEye || !rightEye || !forehead || !chin || !leftCheek || !rightCheek) return;

    // Calculate face dimensions
    const faceWidth = calculateDistance(leftCheek, rightCheek);
    const faceHeight = calculateDistance(forehead, chin);
    const eyeDistance = calculateDistance(leftEye, rightEye);

    // Calculate center point
    const centerX = ((leftCheek.x + rightCheek.x) / 2) * 100;
    const centerY = ((forehead.y + chin.y) / 2) * 100;

    // Calculate rotation based on eye line
    const rotation = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

    // Adjust smoothing factor based on stability
    const movement = Math.abs(centerX - previousParamsRef.current.centerX) +
                    Math.abs(centerY - previousParamsRef.current.centerY);
    
    const stability = Math.max(0, 1 - movement / 10);
    smoothingFactorRef.current = 0.2 + (stability * 0.3); // 0.2 to 0.5

    // Update ellipse parameters with dynamic smoothing
    const newParams = {
      centerX: smoothValue(previousParamsRef.current.centerX, centerX, smoothingFactorRef.current),
      centerY: smoothValue(previousParamsRef.current.centerY, centerY, smoothingFactorRef.current),
      width: smoothValue(previousParamsRef.current.width, faceWidth * 120, smoothingFactorRef.current),
      height: smoothValue(previousParamsRef.current.height, faceHeight * 120, smoothingFactorRef.current),
      rotation: smoothValue(previousParamsRef.current.rotation, rotation, smoothingFactorRef.current)
    };

    setEllipseParams(newParams);
    previousParamsRef.current = newParams;

    // Update stability score
    setStabilityScore(stability);
    
    // Update oval color based on stability
    setOvalColor(
      stability > 0.8 ? '#10B981' :  // Green
      stability > 0.6 ? '#3B82F6' :  // Blue
      '#F59E0B'                      // Yellow
    );

    // Update oval scale based on face size
    const idealWidth = 30;  // Ideal face width percentage
    const currentWidth = faceWidth * 100;
    const scale = currentWidth / idealWidth;
    setOvalScale(Math.min(Math.max(scale, 0.8), 1.2));
  };

  useEffect(() => {
    if (!isCalibrating || !webcam || !landmarksDetector) return;

    const startTime = Date.now();
    const duration = steps[step].duration;
    faceHeightDataRef.current = [];

    const updateCalibration = async (timestamp: number) => {
      try {
        const frameCanvas = captureVideoFrame(webcam);
        if (!frameCanvas) {
          animationFrameRef.current = requestAnimationFrame(updateCalibration);
          return;
        }

        const faces = await landmarksDetector.estimateFaces(frameCanvas);
        
        if (faces?.[0]?.keypoints) {
          const faceMesh = faces[0].keypoints;
          onLandmarksUpdate(faceMesh);
          updateEllipsePosition(faceMesh);
        }

        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);

        if (newProgress < 100) {
          animationFrameRef.current = requestAnimationFrame(updateCalibration);
        } else {
          if (step < steps.length - 1) {
            setStep(step + 1);
            setProgress(0);
          } else {
            const scalingFactor = 1; // We'll use iris-based scaling instead
            onCalibrationComplete(scalingFactor);
          }
        }
      } catch (error) {
        console.error('Calibration error:', error);
        animationFrameRef.current = requestAnimationFrame(updateCalibration);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateCalibration);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [step, isCalibrating, webcam, landmarksDetector, onCalibrationComplete, onLandmarksUpdate, retryCount]);

  const steps = [
    {
      title: "Positionnez votre visage",
      instruction: "Ajustez votre position pour que votre visage remplisse l'ovale",
      duration: 3000
    },
    {
      title: "Gardez la tête droite",
      instruction: "Regardez droit devant vous, visage bien centré",
      duration: 3000
    },
    {
      title: "Restez immobile",
      instruction: "Maintenez votre position pendant quelques secondes",
      duration: 3000
    }
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 pointer-events-none z-20">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          <motion.ellipse
            cx={ellipseParams.centerX}
            cy={ellipseParams.centerY}
            rx={ellipseParams.width / 2}
            ry={ellipseParams.height / 2}
            transform={`rotate(${ellipseParams.rotation * (180 / Math.PI)} ${ellipseParams.centerX} ${ellipseParams.centerY})`}
            fill="none"
            stroke={ovalColor}
            strokeWidth="0.5"
            strokeDasharray="2 2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </svg>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">{steps[step].title}</h3>
          <p className="text-gray-600 mb-4">{steps[step].instruction}</p>
          
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
            <motion.div
              className="absolute top-0 left-0 h-full bg-primary-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          <div className="flex items-center justify-center space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === step ? 'bg-primary-600' : 
                  index < step ? 'bg-primary-300' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded text-xs font-mono z-30">
          <div>FPS: {fpsRef.current}</div>
          <div>Stability: {(stabilityScore * 100).toFixed(1)}%</div>
          <div>Smoothing: {smoothingFactorRef.current.toFixed(2)}</div>
          <div>Scale: {ovalScale.toFixed(2)}</div>
          <div>Position: ({ellipseParams.centerX.toFixed(1)}, {ellipseParams.centerY.toFixed(1)})</div>
          <div>Size: {ellipseParams.width.toFixed(1)} × {ellipseParams.height.toFixed(1)}</div>
          <div>Rotation: {(ellipseParams.rotation * (180 / Math.PI)).toFixed(1)}°</div>
        </div>
      )}
    </div>
  );
};

export default FaceCalibration;