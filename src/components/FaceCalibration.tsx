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
  const irisDataRef = useRef<{ leftIris: number[]; rightIris: number[] }[]>([]);
  const AVERAGE_IRIS_DIAMETER_MM = 11.7;
  const MIN_VALID_FRAMES = 5; // Reduced from 10 to make calibration more forgiving
  const MAX_RETRIES = 3;
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

    // Log video properties for debugging
    console.log('Video state:', {
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState,
      paused: video.paused,
      ended: video.ended,
      currentTime: video.currentTime
    });

    // Add a small delay to ensure video is actually playing
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

    // Wait for valid video state
    if (!validateVideoFrame(video)) {
      console.log('Video not ready for capture');
      return null;
    }

    const canvas = frameBufferRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
      // Update canvas dimensions if needed
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Clear canvas before drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0);

      // Verify the frame was captured
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

  const calculateIrisDiameter = (points: any[]): number => {
    if (!points || points.length < 5) return NaN;

    try {
      const centerX = points[0].x;
      const centerY = points[0].y;

      // Calculate distances from center to edge points
      const distances = points.slice(1).map(point => 
        Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
      );

      // More lenient validation
      const validDistances = distances.filter(d => 
        !isNaN(d) && 
        d > 0 && 
        d < Math.max(frameBufferRef.current?.width || 1280) / 8
      );

      if (validDistances.length < 2) return NaN;

      // Use median instead of mean for more stability
      validDistances.sort((a, b) => a - b);
      const medianRadius = validDistances[Math.floor(validDistances.length / 2)];
      return medianRadius * 2;
    } catch (error) {
      console.error('Error calculating iris diameter:', error);
      return NaN;
    }
  };

  const validateIrisData = (leftIris: any[], rightIris: any[]): boolean => {
    if (!leftIris || !rightIris || leftIris.length < 5 || rightIris.length < 5) {
      return false;
    }

    const isValidPoint = (point: any) => 
      point && 
      typeof point.x === 'number' && 
      typeof point.y === 'number' && 
      !isNaN(point.x) && 
      !isNaN(point.y) &&
      point.x >= 0 &&
      point.y >= 0;

    if (!leftIris.every(isValidPoint) || !rightIris.every(isValidPoint)) {
      return false;
    }

    const leftDiameter = calculateIrisDiameter(leftIris);
    const rightDiameter = calculateIrisDiameter(rightIris);

    if (isNaN(leftDiameter) || isNaN(rightDiameter)) {
      return false;
    }

    // More lenient range check (6-25 pixels)
    if (leftDiameter < 6 || leftDiameter > 25 || rightDiameter < 6 || rightDiameter > 25) {
      return false;
    }

    // More lenient symmetry check (within 25%)
    const diameterDiff = Math.abs(leftDiameter - rightDiameter);
    const avgDiameter = (leftDiameter + rightDiameter) / 2;
    return (diameterDiff / avgDiameter) <= 0.25;
  };

  const calculateFinalScalingFactor = (): number => {
    const validFrames = irisDataRef.current.filter(frame => 
      validateIrisData(frame.leftIris as any, frame.rightIris as any)
    );

    console.log(`Valid frames: ${validFrames.length}/${MIN_VALID_FRAMES} required`);

    if (validFrames.length < MIN_VALID_FRAMES) {
      throw new Error(`Insufficient valid frames: ${validFrames.length} < ${MIN_VALID_FRAMES}`);
    }

    const diameters = validFrames.map(frame => {
      const leftDiameter = calculateIrisDiameter(frame.leftIris as any);
      const rightDiameter = calculateIrisDiameter(frame.rightIris as any);
      return (leftDiameter + rightDiameter) / 2;
    }).filter(d => !isNaN(d) && d > 0);

    if (diameters.length < MIN_VALID_FRAMES) {
      throw new Error('Insufficient valid measurements');
    }

    // Use median for more stable results
    diameters.sort((a, b) => a - b);
    const medianDiameter = diameters[Math.floor(diameters.length / 2)];
    const scalingFactor = AVERAGE_IRIS_DIAMETER_MM / medianDiameter;

    console.log('Scaling factor calculated:', {
      medianDiameter,
      scalingFactor,
      AVERAGE_IRIS_DIAMETER_MM
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
    irisDataRef.current = [];

    const updateCalibration = async () => {
      try {
        // Ensure video is ready
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

          const leftIris = faceMesh.slice(468, 473);
          const rightIris = faceMesh.slice(473, 478);

          if (validateIrisData(leftIris, rightIris)) {
            irisDataRef.current.push({ leftIris, rightIris });
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
                irisDataRef.current = [];
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
      title: "Centrez votre visage",
      instruction: "Positionnez votre visage dans l'ovale et regardez droit devant",
      duration: 3000
    },
    {
      title: "Gardez les yeux ouverts",
      instruction: "Gardez vos yeux bien ouverts et évitez de cligner",
      duration: 3000
    },
    {
      title: "Restez immobile",
      instruction: "Gardez la tête immobile pendant quelques secondes",
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
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
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