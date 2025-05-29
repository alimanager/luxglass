import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';

interface FaceCalibrationProps {
  onCalibrationComplete: (scalingFactor: number) => void;
  isCalibrating: boolean;
  onLandmarksUpdate: (landmarks: any) => void;
  webcamRef: HTMLVideoElement | null;
  landmarksDetector: any;
}

const FaceCalibration: React.FC<FaceCalibrationProps> = ({ 
  onCalibrationComplete, 
  isCalibrating, 
  onLandmarksUpdate,
  webcamRef,
  landmarksDetector 
}) => {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [calibrationData, setCalibrationData] = useState<{
    leftIris: number;
    rightIris: number;
  } | null>(null);

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

  useEffect(() => {
    if (!isCalibrating || !webcamRef || !landmarksDetector) return;

    let animationFrame: number;
    const startTime = Date.now();
    const duration = steps[step].duration;
    let irisData: { leftIris: number[]; rightIris: number[] }[] = [];

    const updateCalibration = async () => {
      try {
        if (!webcamRef || webcamRef.readyState !== 4) {
          animationFrame = requestAnimationFrame(updateCalibration);
          return;
        }

        const landmarks = await landmarksDetector.estimateFaces(webcamRef);
        if (landmarks && landmarks.length > 0) {
          const faceMesh = landmarks[0].keypoints;
          onLandmarksUpdate(faceMesh);

          // Collect iris measurements during calibration
          const leftIris = faceMesh.slice(468, 473);
          const rightIris = faceMesh.slice(473, 478);
          irisData.push({ leftIris, rightIris });
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
            const avgLeftIris = calculateAverageIrisDiameter(irisData.map(d => d.leftIris));
            const avgRightIris = calculateAverageIrisDiameter(irisData.map(d => d.rightIris));
            const avgIrisDiameter = (avgLeftIris + avgRightIris) / 2;
            const scalingFactor = 11.7 / avgIrisDiameter; // 11.7mm is average human iris diameter

            console.log('Calibration complete:', {
              avgLeftIris,
              avgRightIris,
              avgIrisDiameter,
              scalingFactor
            });

            onCalibrationComplete(scalingFactor);
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
  }, [step, isCalibrating, webcamRef, landmarksDetector, onCalibrationComplete, onLandmarksUpdate]);

  const calculateAverageIrisDiameter = (irisPoints: number[][]) => {
    const diameters = irisPoints.map(points => {
      let maxDiameter = 0;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const distance = Math.sqrt(
            Math.pow(points[j].x - points[i].x, 2) + 
            Math.pow(points[j].y - points[i].y, 2)
          );
          maxDiameter = Math.max(maxDiameter, distance);
        }
      }
      return maxDiameter;
    });

    return diameters.reduce((a, b) => a + b, 0) / diameters.length;
  };

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