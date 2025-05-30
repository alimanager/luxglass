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
  const irisDataRef = useRef<{ leftIris: number[]; rightIris: number[] }[]>([]);
  const AVERAGE_IRIS_DIAMETER_MM = 11.7; // Average human iris diameter in millimeters
  const MIN_VALID_FRAMES = 10; // Minimum number of valid frames needed for calibration
  const frameBufferRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Initialize frame buffer canvas
    if (!frameBufferRef.current) {
      frameBufferRef.current = document.createElement('canvas');
      frameBufferRef.current.width = 1280; // Standard HD width
      frameBufferRef.current.height = 720; // Standard HD height
    }
  }, []);

  const validateVideoFrame = (video: HTMLVideoElement): boolean => {
    const videoState = {
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState,
      paused: video.paused,
      ended: video.ended
    };

    console.log('Video state:', videoState);

    return (
      video.readyState === 4 && // HAVE_ENOUGH_DATA
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !video.paused &&
      !video.ended
    );
  };

  const captureVideoFrame = (video: HTMLVideoElement): HTMLCanvasElement | null => {
    if (!frameBufferRef.current) return null;

    const canvas = frameBufferRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Update canvas dimensions if video dimensions have changed
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    try {
      ctx.drawImage(video, 0, 0);
      return canvas;
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  };

  const calculateIrisDiameter = (points: any[]): number => {
    if (!points || points.length < 5) {
      console.log('Invalid points array:', points);
      return NaN;
    }

    try {
      // Calculate center point (first point is center)
      const centerX = points[0].x;
      const centerY = points[0].y;

      // Calculate distances from center to each edge point
      const distances = points.slice(1).map(point => 
        Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
      );

      // Filter out any invalid distances
      const validDistances = distances.filter(d => !isNaN(d) && d > 0);

      if (validDistances.length < 2) {
        console.log('Not enough valid distances:', validDistances);
        return NaN;
      }

      // Calculate diameter as twice the average distance
      const avgRadius = validDistances.reduce((a, b) => a + b, 0) / validDistances.length;
      const diameter = avgRadius * 2;

      console.log('Calculated iris diameter:', diameter);
      return diameter;
    } catch (error) {
      console.error('Error calculating iris diameter:', error);
      return NaN;
    }
  };

  const validateIrisData = (leftIris: any[], rightIris: any[]): boolean => {
    if (!leftIris || !rightIris || leftIris.length !== 5 || rightIris.length !== 5) {
      console.log('Invalid iris array length:', { leftLength: leftIris?.length, rightLength: rightIris?.length });
      return false;
    }

    const isValidPoint = (point: any) => 
      point && 
      typeof point.x === 'number' && 
      typeof point.y === 'number' && 
      !isNaN(point.x) && 
      !isNaN(point.y) &&
      point.x > 0 &&
      point.y > 0;

    const allPointsValid = leftIris.every(isValidPoint) && rightIris.every(isValidPoint);
    if (!allPointsValid) {
      console.log('Invalid iris points detected');
      return false;
    }

    const leftDiameter = calculateIrisDiameter(leftIris);
    const rightDiameter = calculateIrisDiameter(rightIris);

    console.log('Iris diameters:', { left: leftDiameter, right: rightDiameter });

    if (isNaN(leftDiameter) || isNaN(rightDiameter)) {
      console.log('Invalid diameter calculation');
      return false;
    }

    // Check if diameters are within reasonable range (5-25 pixels)
    if (leftDiameter < 5 || leftDiameter > 25 || rightDiameter < 5 || rightDiameter > 25) {
      console.log('Iris diameters out of reasonable range');
      return false;
    }

    // Check if left and right iris diameters are similar (within 20%)
    const diameterDiff = Math.abs(leftDiameter - rightDiameter);
    const avgDiameter = (leftDiameter + rightDiameter) / 2;
    if (diameterDiff / avgDiameter > 0.2) {
      console.log('Iris diameters too different');
      return false;
    }

    return true;
  };

  const calculateFinalScalingFactor = (): number => {
    console.log('Starting scaling factor calculation...');
    console.log('Total frames collected:', irisDataRef.current.length);

    if (irisDataRef.current.length < MIN_VALID_FRAMES) {
      throw new Error(`Insufficient valid frames: ${irisDataRef.current.length} < ${MIN_VALID_FRAMES}`);
    }

    const validFrames = irisDataRef.current.filter(frame => 
      validateIrisData(frame.leftIris as any, frame.rightIris as any)
    );

    console.log('Valid frames:', validFrames.length);

    if (validFrames.length < MIN_VALID_FRAMES) {
      throw new Error(`Insufficient valid frames after validation: ${validFrames.length} < ${MIN_VALID_FRAMES}`);
    }

    const diameters = validFrames.map(frame => {
      const leftDiameter = calculateIrisDiameter(frame.leftIris as any);
      const rightDiameter = calculateIrisDiameter(frame.rightIris as any);
      return (leftDiameter + rightDiameter) / 2;
    }).filter(d => !isNaN(d) && d > 0);

    console.log('Valid diameter measurements:', diameters);

    if (diameters.length < MIN_VALID_FRAMES) {
      throw new Error(`Insufficient valid measurements: ${diameters.length} < ${MIN_VALID_FRAMES}`);
    }

    // Sort diameters and take the middle 60% to remove outliers
    diameters.sort((a, b) => a - b);
    const startIndex = Math.floor(diameters.length * 0.2);
    const endIndex = Math.ceil(diameters.length * 0.8);
    const trimmedDiameters = diameters.slice(startIndex, endIndex);

    console.log('Trimmed diameters:', trimmedDiameters);

    const avgDiameter = trimmedDiameters.reduce((a, b) => a + b, 0) / trimmedDiameters.length;
    const scalingFactor = AVERAGE_IRIS_DIAMETER_MM / avgDiameter;

    console.log('Final calculation:', {
      avgDiameter,
      scalingFactor,
      AVERAGE_IRIS_DIAMETER_MM
    });

    if (!isFinite(scalingFactor) || scalingFactor <= 0 || scalingFactor > 1) {
      throw new Error(`Invalid scaling factor calculated: ${scalingFactor}`);
    }

    return scalingFactor;
  };

  useEffect(() => {
    if (!isCalibrating || !webcam || !landmarksDetector) {
      console.log('Waiting for dependencies:', {
        isCalibrating,
        hasWebcam: !!webcam,
        hasDetector: !!landmarksDetector
      });
      return;
    }

    let animationFrame: number;
    const startTime = Date.now();
    const duration = steps[step].duration;
    irisDataRef.current = [];

    const updateCalibration = async () => {
      try {
        if (!webcam || !validateVideoFrame(webcam)) {
          console.log('Invalid video state, skipping frame');
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        const frameCanvas = captureVideoFrame(webcam);
        if (!frameCanvas) {
          console.log('Failed to capture video frame');
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        console.log('Processing frame:', {
          width: frameCanvas.width,
          height: frameCanvas.height
        });

        const landmarks = await landmarksDetector.estimateFaces(frameCanvas);
        console.log('Landmarks detection result:', landmarks);

        if (landmarks && landmarks.length > 0) {
          const faceMesh = landmarks[0].keypoints;
          onLandmarksUpdate(faceMesh);

          // Extract iris landmarks
          const leftIris = faceMesh.slice(468, 473);
          const rightIris = faceMesh.slice(473, 478);

          if (validateIrisData(leftIris, rightIris)) {
            irisDataRef.current.push({ leftIris, rightIris });
            console.log('Valid iris data collected:', irisDataRef.current.length);
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
              console.log('Calibration successful:', scalingFactor);
              onCalibrationComplete(scalingFactor);
            } catch (error) {
              console.error('Calibration failed:', error);
              setStep(0);
              setProgress(0);
              irisDataRef.current = [];
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
  }, [step, isCalibrating, webcam, landmarksDetector, onCalibrationComplete, onLandmarksUpdate]);

  const steps = [
    {
      title: "Centrez votre visage",
      instruction: "Positionnez votre visage dans l'ovale et regardez droit devant",
      duration: 3000
    },
    {
      title: "Tournez lentement la tête",
      instruction: "Tournez lentement la tête vers la gauche puis vers la droite",
      duration: 5000
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