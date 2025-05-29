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

  const calculateIrisDiameter = (points: any[]): number => {
    if (!points || points.length < 5) return NaN;

    // Calculate center point
    const centerX = points[0].x;
    const centerY = points[0].y;

    // Calculate average radius using the other 4 points
    const radii = points.slice(1).map(point => 
      Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
    );

    // Get average radius and multiply by 2 for diameter
    const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    return avgRadius * 2;
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
      !isNaN(point.y);

    const allPointsValid = [...leftIris, ...rightIris].every(isValidPoint);
    if (!allPointsValid) {
      console.log('Invalid iris points detected');
      return false;
    }

    return true;
  };

  const calculateFinalScalingFactor = (): number => {
    const validFrames = irisDataRef.current.filter(frame => 
      validateIrisData(frame.leftIris as any, frame.rightIris as any)
    );

    console.log(`Processing ${validFrames.length} valid frames out of ${irisDataRef.current.length} total frames`);

    if (validFrames.length < MIN_VALID_FRAMES) {
      console.error(`Insufficient valid frames: ${validFrames.length} < ${MIN_VALID_FRAMES}`);
      return NaN;
    }

    const diameters = validFrames.map(frame => {
      const leftDiameter = calculateIrisDiameter(frame.leftIris as any);
      const rightDiameter = calculateIrisDiameter(frame.rightIris as any);
      
      if (isNaN(leftDiameter) || isNaN(rightDiameter)) {
        return NaN;
      }

      return (leftDiameter + rightDiameter) / 2;
    }).filter(d => !isNaN(d) && d > 0);

    if (diameters.length < MIN_VALID_FRAMES) {
      console.error(`Insufficient valid diameter measurements: ${diameters.length} < ${MIN_VALID_FRAMES}`);
      return NaN;
    }

    // Sort diameters and take the middle 60% to remove outliers
    diameters.sort((a, b) => a - b);
    const startIndex = Math.floor(diameters.length * 0.2);
    const endIndex = Math.floor(diameters.length * 0.8);
    const trimmedDiameters = diameters.slice(startIndex, endIndex);

    const avgDiameter = trimmedDiameters.reduce((a, b) => a + b, 0) / trimmedDiameters.length;
    const scalingFactor = AVERAGE_IRIS_DIAMETER_MM / avgDiameter;

    console.log('Scaling factor calculation:', {
      avgDiameter,
      scalingFactor,
      validMeasurements: trimmedDiameters.length,
      minDiameter: Math.min(...trimmedDiameters),
      maxDiameter: Math.max(...trimmedDiameters)
    });

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
        if (!webcam || webcam.readyState !== 4) {
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        const landmarks = await landmarksDetector.estimateFaces(webcam);
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
            const scalingFactor = calculateFinalScalingFactor();
            
            if (isFinite(scalingFactor) && scalingFactor > 0) {
              console.log('Calibration successful:', { scalingFactor });
              onCalibrationComplete(scalingFactor);
            } else {
              console.error('Invalid scaling factor:', scalingFactor);
              // Retry calibration by resetting to first step
              setStep(0);
              setProgress(0);
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