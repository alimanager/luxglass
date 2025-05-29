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
    irisDataRef.current = []; // Reset iris data at the start of each step

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

          // Extract iris keypoints
          const leftIris = faceMesh.slice(468, 473);
          const rightIris = faceMesh.slice(473, 478);

          // Validate iris data before adding
          if (leftIris.length === 5 && rightIris.length === 5 && 
              leftIris.every(point => point && typeof point.x === 'number' && typeof point.y === 'number') &&
              rightIris.every(point => point && typeof point.x === 'number' && typeof point.y === 'number')) {
            irisDataRef.current.push({ leftIris, rightIris });
            console.log('Collected iris data:', { 
              leftIrisPoints: leftIris,
              rightIrisPoints: rightIris,
              totalFrames: irisDataRef.current.length 
            });
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
            // Calculate final scaling factor from collected iris data
            const avgLeftIris = calculateAverageIrisDiameter(irisDataRef.current.map(d => d.leftIris));
            const avgRightIris = calculateAverageIrisDiameter(irisDataRef.current.map(d => d.rightIris));
            
            console.log('Final iris measurements:', {
              avgLeftIris,
              avgRightIris,
              totalFrames: irisDataRef.current.length
            });

            if (isNaN(avgLeftIris) || isNaN(avgRightIris) || avgLeftIris <= 0 || avgRightIris <= 0) {
              console.error('Invalid iris measurements detected');
              onCalibrationComplete(NaN);
              return;
            }

            const avgIrisDiameter = (avgLeftIris + avgRightIris) / 2;
            const AVERAGE_IRIS_DIAMETER_MM = 11.7; // Average human iris diameter in millimeters
            const scalingFactor = AVERAGE_IRIS_DIAMETER_MM / avgIrisDiameter;

            console.log('Calibration complete:', {
              avgLeftIris,
              avgRightIris,
              avgIrisDiameter,
              scalingFactor,
              totalValidFrames: irisDataRef.current.length
            });

            if (scalingFactor > 0 && isFinite(scalingFactor)) {
              onCalibrationComplete(scalingFactor);
            } else {
              console.error('Invalid scaling factor calculated:', scalingFactor);
              onCalibrationComplete(NaN);
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

  const calculateAverageIrisDiameter = (irisPoints: any[]): number => {
    if (!irisPoints.length) return NaN;

    const validDiameters = irisPoints.map(points => {
      if (!points || points.length < 2) return NaN;

      let maxDiameter = 0;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          if (!points[i] || !points[j]) continue;
          
          const distance = Math.sqrt(
            Math.pow(points[j].x - points[i].x, 2) + 
            Math.pow(points[j].y - points[i].y, 2)
          );
          maxDiameter = Math.max(maxDiameter, distance);
        }
      }
      return maxDiameter > 0 ? maxDiameter : NaN;
    }).filter(d => !isNaN(d) && d > 0);

    if (validDiameters.length === 0) return NaN;
    return validDiameters.reduce((a, b) => a + b, 0) / validDiameters.length;
  };

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