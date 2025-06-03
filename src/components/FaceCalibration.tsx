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
  const [ovalColor, setOvalColor] = useState('#3B82F6');
  const [stabilityScore, setStabilityScore] = useState(0);
  const [ellipseParams, setEllipseParams] = useState({ 
    centerX: 75, 
    centerY: 80, 
    width: 100, 
    height: 120,
    rotation: { x: 0, y: 0, z: 0 }
  });
  const faceHeightDataRef = useRef<number[]>([]);
  const frameBufferRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!frameBufferRef.current) {
      frameBufferRef.current = document.createElement('canvas');
      frameBufferRef.current.width = 1280;
      frameBufferRef.current.height = 720;
    }
  }, []);

  const validateVideoFrame = (video: HTMLVideoElement): boolean => {
    if (!video) return false;

    const isValid = (
      video.readyState === 4 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !video.paused &&
      !video.ended &&
      video.currentTime > 0
    );

    if (!isValid) {
      console.log('Video validation failed:', {
        readyState: video.readyState,
        width: video.videoWidth,
        height: video.videoHeight,
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime
      });
    }

    return isValid;
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

  const calculateFacePose = (landmarks: any[]) => {
    // Calculate face normal vector using three points:
    // nose bridge and two temple points
    const noseBridge = landmarks[168];
    const leftTemple = landmarks[234];
    const rightTemple = landmarks[454];

    // Calculate vectors
    const v1 = {
      x: rightTemple.x - leftTemple.x,
      y: rightTemple.y - leftTemple.y,
      z: rightTemple.z - leftTemple.z
    };

    const v2 = {
      x: noseBridge.x - leftTemple.x,
      y: noseBridge.y - leftTemple.y,
      z: noseBridge.z - leftTemple.z
    };

    // Calculate normal vector using cross product
    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };

    // Normalize the vector
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    normal.x /= length;
    normal.y /= length;
    normal.z /= length;

    // Calculate rotation angles
    const pitch = Math.asin(-normal.y);
    const yaw = Math.atan2(-normal.x, normal.z);
    const roll = Math.atan2(v1.y, v1.x);

    return {
      pitch: (pitch * 180) / Math.PI,
      yaw: (yaw * 180) / Math.PI,
      roll: (roll * 180) / Math.PI
    };
  };

  const calculateEllipseParams = (landmarks: any[]) => {
    const forehead = landmarks[10];
    const chin = landmarks[152];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];

    const centerX = (leftCheek.x + rightCheek.x) / 2;
    const centerY = (forehead.y + chin.y) / 2;
    const width = calculateDistance(leftCheek, rightCheek);
    const height = calculateDistance(forehead, chin);

    // Calculate face pose
    const rotation = calculateFacePose(landmarks);

    return { centerX, centerY, width, height, rotation };
  };

  const validateFaceHeight = (height: number, frameHeight: number): boolean => {
    if (isNaN(height) || height <= 0) return false;

    const minHeight = frameHeight * 0.3;
    const maxHeight = frameHeight * 0.8;
    const isValid = height > minHeight && height < maxHeight;

    if (!isValid) {
      console.log('Height validation failed:', {
        height,
        minHeight,
        maxHeight,
        frameHeight
      });
    }

    return isValid;
  };

  const calculateScalingFactor = (heights: number[]): number => {
    const validHeights = heights.filter(h => 
      validateFaceHeight(h, frameBufferRef.current?.height || 720)
    );

    if (validHeights.length < MIN_VALID_FRAMES) {
      throw new Error(`Insufficient measurements: ${validHeights.length}/${MIN_VALID_FRAMES}`);
    }

    validHeights.sort((a, b) => a - b);
    const medianHeight = validHeights[Math.floor(validHeights.length / 2)];
    const scalingFactor = AVERAGE_FACE_HEIGHT_MM / medianHeight;

    if (!isFinite(scalingFactor) || scalingFactor <= 0) {
      throw new Error(`Invalid scaling factor: ${scalingFactor}`);
    }

    return scalingFactor;
  };

  useEffect(() => {
    if (!isCalibrating || !webcam || !landmarksDetector) return;

    let animationFrame: number;
    const startTime = Date.now();
    const duration = steps[step].duration;
    faceHeightDataRef.current = [];

    const updateCalibration = async () => {
      try {
        const frameCanvas = captureVideoFrame(webcam);
        if (!frameCanvas) {
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        const landmarks = await landmarksDetector.estimateFaces(frameCanvas);
        
        if (landmarks?.[0]?.keypoints) {
          const faceMesh = landmarks[0].keypoints;
          onLandmarksUpdate(faceMesh);

          const params = calculateEllipseParams(faceMesh);
          setEllipseParams(params);

          const faceHeight = params.height;
          if (validateFaceHeight(faceHeight, frameCanvas.height)) {
            faceHeightDataRef.current.push(faceHeight);
            
            const idealHeight = frameCanvas.height * IDEAL_FACE_HEIGHT_RATIO;
            const scale = faceHeight / idealHeight;
            const newScale = Math.min(Math.max(scale, 0.8), 1.2);
            
            setOvalScale(newScale);
            
            // Update color based on face angle
            const angleThreshold = 15; // degrees
            const isAligned = 
              Math.abs(params.rotation.pitch) < angleThreshold &&
              Math.abs(params.rotation.yaw) < angleThreshold &&
              Math.abs(params.rotation.roll) < angleThreshold;

            setOvalColor(isAligned ? '#10B981' : '#F59E0B');
          }
        }

        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);

        if (newProgress < 100) {
          animationFrame = requestAnimationFrame(updateCalibration);
        } else {
          if (step < steps.length - 1) {
            setStep(step + 1);
            setProgress(0);
          } else {
            try {
              const scalingFactor = calculateScalingFactor(faceHeightDataRef.current);
              onCalibrationComplete(scalingFactor);
            } catch (error) {
              console.error('Calibration failed:', error);
              
              if (retryCount < MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                setStep(0);
                setProgress(0);
                faceHeightDataRef.current = [];
              } else {
                throw new Error('Maximum calibration retries exceeded');
              }
            }
          }
        }
      } catch (error) {
        console.error('Calibration error:', error);
        animationFrame = requestAnimationFrame(updateCalibration);
      }
    };

    animationFrame = requestAnimationFrame(updateCalibration);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [step, isCalibrating, webcam, landmarksDetector, onCalibrationComplete, onLandmarksUpdate, retryCount]);

  const steps = [
    {
      title: "Positionnez votre visage",
      instruction: "Rapprochez-vous de la caméra jusqu'à ce que votre visage s'aligne avec le guide",
      duration: 3000
    },
    {
      title: "Gardez la tête droite",
      instruction: "Alignez votre visage avec le guide et regardez droit devant vous",
      duration: 3000
    },
    {
      title: "Restez immobile",
      instruction: "Ne bougez pas pendant quelques secondes",
      duration: 3000
    }
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.svg
        className="absolute"
        style={{
          width: '80%',
          height: '90%',
          maxWidth: '600px',
          maxHeight: '700px',
        }}
        viewBox="0 0 150 160"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ 
          scale: ovalScale,
          opacity: 1
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.ellipse
          cx={ellipseParams.centerX}
          cy={ellipseParams.centerY}
          rx={ellipseParams.width / 2}
          ry={ellipseParams.height / 2}
          fill="none"
          strokeWidth="2"
          stroke={ovalColor}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          transform={`
            rotate(${ellipseParams.rotation.roll} ${ellipseParams.centerX} ${ellipseParams.centerY})
            skewX(${ellipseParams.rotation.yaw * 0.5})
            skewY(${ellipseParams.rotation.pitch * 0.5})
          `}
        />
      </motion.svg>

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
    </div>
  );
};

export default FaceCalibration;