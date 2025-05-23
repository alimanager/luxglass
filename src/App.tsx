import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';  // Import WebGL backend first
import * as faceDetection from '@tensorflow-models/face-detection';

function App() {
  const webcamRef = useRef<Webcam>(null);
  const [detector, setDetector] = useState<faceDetection.FaceDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDetector = async () => {
      try {
        setIsModelLoading(true);
        setError(null);
        
        // Explicitly set WebGL backend and ensure TF is ready
        await tf.setBackend('webgl');
        await tf.ready();
        
        const model = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs', // Changed to 'tfjs' runtime instead of 'mediapipe'
            modelType: 'short',
            maxFaces: 1
          }
        );
        
        setDetector(model);
      } catch (err) {
        console.error('Error loading face detection model:', err);
        setError('Error loading face detection model');
      } finally {
        setIsModelLoading(false);
      }
    };

    initializeDetector();

    return () => {
      if (detector) {
        detector.dispose();
      }
    };
  }, []);

  const detectFace = async () => {
    if (!detector || !webcamRef.current?.video) return;

    try {
      const video = webcamRef.current.video;
      const detections = await detector.estimateFaces(video);
      console.log('Face detections:', detections);
    } catch (err) {
      console.error('Error detecting face:', err);
      setError('Error detecting face');
    }
  };

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold mb-4">TensorFlow.js Face Detection Test</h1>
      
      <div className="mt-5">
        <Webcam
          ref={webcamRef}
          mirrored
          className="w-full max-w-2xl"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
        />
      </div>

      {error && (
        <div className="text-red-500 mt-3">
          {error}
        </div>
      )}

      <button
        onClick={detectFace}
        disabled={isModelLoading}
        className={`mt-5 px-5 py-2 rounded-md text-white ${
          isModelLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isModelLoading ? 'Loading model...' : 'Detect Face'}
      </button>
    </div>
  );
}

export default App;