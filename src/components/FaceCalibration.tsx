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

const AVERAGE_FACE_HEIGHT_MM = 200; // Average face height from forehead to chin
const MIN_VALID_FRAMES = 5;
const MAX_RETRIES = 3;

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
  const faceHeightDataRef = useRef<number[]>([]);
  const frameBufferRef = useRef<HTMLCanvasElement | null>(null);
  const [ovalScale, setOvalScale] = useState(1);

  useEffect(() => {
    if (!frameBufferRef.current) {
      frameBufferRef.current = document.createElement('canvas');
      frameBufferRef.current.width = 1280;
      frameBufferRef.current.height = 720;
    }
  }, []);

  const validateVideoFrame = (video: HTMLVideoElement): boolean => {
    console.log('Video state:', {
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState,
      paused: video.paused,
      ended: video.ended,
      currentTime: video.currentTime
    });

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
    if (!frameBufferRef.current) return null;

    if (!validateVideoFrame(video)) {
      console.log('Video not ready for capture');
      return null;
    }

    const canvas = frameBufferRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0);

      try {
        ctx.getImageData(0, 0, 1, 1);
      } catch (e) {
        console.error('Invalid frame capture:', e);
        return null;
      }

      return canvas;
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  };

  const calculateFaceHeight = (landmarks: any[]): number => {
    if (!landmarks || landmarks.length < 468) return NaN;

    try {
      // Use forehead (10) to chin (152) for face height
      const forehead = landmarks[10];
      const chin = landmarks[152];

      if (!forehead || !chin) return NaN;

      const height = Math.sqrt(
        Math.pow(chin.x - forehead.x, 2) + 
        Math.pow(chin.y - forehead.y, 2)
      );

      return height;
    } catch (error) {
      console.error('Error calculating face height:', error);
      return NaN;
    }
  };

  const validateFaceHeight = (height: number): boolean => {
    if (isNaN(height) || height <= 0) return false;

    // Face height should be between 20% and 80% of frame height
    const frameHeight = frameBufferRef.current?.height || 720;
    return height > frameHeight * 0.2 && height < frameHeight * 0.8;
  };

  const calculateFinalScalingFactor = (): number => {
    const validHeights = faceHeightDataRef.current.filter(height => 
      validateFaceHeight(height)
    );

    console.log(`Valid measurements: ${validHeights.length}/${MIN_VALID_FRAMES} required`);

    if (validHeights.length < MIN_VALID_FRAMES) {
      throw new Error(`Insufficient valid measurements: ${validHeights.length} < ${MIN_VALID_FRAMES}`);
    }

    // Use median for stability
    validHeights.sort((a, b) => a - b);
    const medianHeight = validHeights[Math.floor(validHeights.length / 2)];
    const scalingFactor = AVERAGE_FACE_HEIGHT_MM / medianHeight;

    console.log('Scaling factor calculated:', {
      medianHeight,
      scalingFactor,
      AVERAGE_FACE_HEIGHT_MM
    });

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
        if (!validateVideoFrame(webcam)) {
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        const frameCanvas = captureVideoFrame(webcam);
        if (!frameCanvas) {
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        const landmarks = await landmarksDetector.estimateFaces(frameCanvas);
        console.log('Landmarks detected:', landmarks?.length > 0);

        if (landmarks && landmarks.length > 0) {
          const faceMesh = landmarks[0].keypoints;
          onLandmarksUpdate(faceMesh);

          const faceHeight = calculateFaceHeight(faceMesh);
          if (validateFaceHeight(faceHeight)) {
            faceHeightDataRef.current.push(faceHeight);
            
            // Adjust oval scale based on face height
            const idealHeight = frameCanvas.height * 0.6;
            const scale = faceHeight / idealHeight;
            setOvalScale(Math.min(Math.max(scale, 0.8), 1.2));
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
              const scalingFactor = calculateFinalScalingFactor();
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
        console.error('Error during calibration:', error);
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
      instruction: "Ajustez votre position pour que votre visage remplisse l'ovale",
      duration: 3000
    },
    {
      title: "Gardez la tête droite",
      instruction: "Regardez droit devant vous, du front jusqu'au menton",
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
      <motion.div
        className="absolute border-4 border-primary-500 rounded-full"
        style={{
          width: '60%',
          height: '80%',
          maxWidth: '400px',
          maxHeight: '500px'
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ 
          scale: ovalScale,
          opacity: 1,
          borderColor: faceHeightDataRef.current.length >= MIN_VALID_FRAMES ? '#10B981' : '#3B82F6'
        }}
        transition={{ duration: 0.3 }}
      />

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