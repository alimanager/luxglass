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
  const [detections, setDetections] = useState<faceDetection.Face[]>([]);

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
            runtime: 'tfjs',
            modelType: 'short'
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
    if (!detector || !webcamRef.current?.video) {
      console.log('Detector or video not ready');
      return;
    }

    try {
      console.log('Starting face detection...');
      const video = webcamRef.current.video;
      const faces = await detector.estimateFaces(video, {
        flipHorizontal: false
      });
      console.log('Face detections:', faces);
      setDetections(faces);
    } catch (err) {
      console.error('Error detecting face:', err);
      setError('Error detecting face');
    }
  };

  // Draw face detections
  useEffect(() => {
    if (detections.length > 0) {
      const canvas = document.createElement('canvas');
      const video = webcamRef.current?.video;
      if (!video) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw the detections
      detections.forEach(face => {
        const { box } = face;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);
      });
    }
  }, [detections]);

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold mb-4">TensorFlow.js Face Detection Test</h1>
      
      <div className="mt-5 relative">
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
        {detections.length > 0 && (
          <div className="absolute top-2 left-2 bg-green-500 text-white px-3 py-1 rounded">
            Face Detected!
          </div>
        )}
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

      <div className="mt-4 text-sm text-gray-600">
        {isModelLoading ? (
          'Loading face detection model...'
        ) : detector ? (
          'Model loaded successfully. Click "Detect Face" to test.'
        ) : (
          'Error loading model. Please refresh the page.'
        )}
      </div>
    </div>
  );
}

export default App;