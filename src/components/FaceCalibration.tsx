import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';

interface FaceCalibrationProps {
  onCalibrationComplete: () => void;
  isCalibrating: boolean;
}

const FaceCalibration: React.FC<FaceCalibrationProps> = ({ onCalibrationComplete, isCalibrating }) => {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [landmarks, setLandmarks] = useState<number[][]>([]);

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
    if (!isCalibrating) return;

    let timer: NodeJS.Timeout;
    const startTime = Date.now();
    const duration = steps[step].duration;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress < 100) {
        timer = setTimeout(updateProgress, 16);
      } else {
        if (step < steps.length - 1) {
          setStep(step + 1);
          setProgress(0);
        } else {
          onCalibrationComplete();
        }
      }
    };

    timer = setTimeout(updateProgress, 16);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, isCalibrating, onCalibrationComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Oval Guide */}
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

      {/* Instructions Panel */}
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