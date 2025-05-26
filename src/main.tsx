import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import App from './App';
import './index.css';

declare global {
  interface Window {
    __models: {
      faceDetector: faceDetection.FaceDetector;
      landmarksDetector: faceLandmarksDetection.FaceLandmarksDetector;
    };
  }
}

const initializeTensorFlow = async () => {
  try {
    console.log('Setting up TensorFlow.js...');
    await tf.setBackend('webgl');
    await tf.ready();
    
    console.log('Loading face detection models...');
    const [faceDetector, landmarksDetector] = await Promise.all([
      faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        {
          runtime: 'tfjs',
          modelType: 'short',
          maxFaces: 1
        }
      ),
      faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 1
        }
      )
    ]);

    window.__models = {
      faceDetector,
      landmarksDetector
    };

    console.log('Models loaded successfully');

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
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fee2e2;
        color: #991b1b;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        max-width: 400px;
      ">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Erreur d'initialisation</h2>
        <p>Une erreur est survenue lors de l'initialisation de TensorFlow.js. Veuillez vérifier votre connexion internet et recharger la page.</p>
      </div>
    `;
  }
};

window.addEventListener('unload', () => {
  if (window.__models) {
    window.__models.faceDetector.dispose();
    window.__models.landmarksDetector.dispose();
    tf.disposeVariables();
  }
});

initializeTensorFlow();