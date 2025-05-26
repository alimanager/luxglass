import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import App from './App';
import './index.css';

(async () => {
  try {
    // Initialize TensorFlow.js backend
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('TensorFlow.js initialized successfully with WebGL backend');
    
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
  }
})();