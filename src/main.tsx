import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import App from './App';
import './index.css';

(async () => {
  // Initialize TensorFlow.js backend
  await tf.setBackend('webgl');
  await tf.ready();

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
})();