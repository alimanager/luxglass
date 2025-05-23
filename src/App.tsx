import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
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
        
        await tf.ready();
        
        const model = await faceDetection.load(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection',
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
    <div style={{ padding: '20px' }}>
      <h1>TensorFlow.js Face Detection Test</h1>
      
      <div style={{ marginTop: '20px' }}>
        <Webcam
          ref={webcamRef}
          mirrored
          style={{ width: '100%', maxWidth: '640px' }}
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
        />
      </div>

      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          {error}
        </div>
      )}

      <button
        onClick={detectFace}
        disabled={isModelLoading}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: isModelLoading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isModelLoading ? 'not-allowed' : 'pointer'
        }}
      >
        {isModelLoading ? 'Loading model...' : 'Detect Face'}
      </button>
    </div>
  );
}

export default App;