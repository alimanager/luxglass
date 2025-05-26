import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import App from './App';
import './index.css';

const initializeTensorFlow = async () => {
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('TensorFlow.js initialized with WebGL backend');

    // Pre-load models
    const faceDetector = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      {
        runtime: 'tfjs',
        modelType: 'short',
        maxFaces: 1
      }
    );
    console.log('Face detector model loaded');

    const landmarksDetector = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      {
        runtime: 'tfjs',
        refineLandmarks: true,
        maxFaces: 1
      }
    );
    console.log('Face landmarks model loaded');

    // Store models in window for global access
    window.__models = {
      faceDetector,
      landmarksDetector
    };

    const root = createRoot(document.getElementById('root')!);
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js:', error);
    document.body.innerHTML = `
      <div style="color: red; padding: 20px;">
        Failed to initialize TensorFlow.js. Please check your internet connection and reload the page.
      </div>
    `;
  }
};

initializeTensorFlow();