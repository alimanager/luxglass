import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export interface FaceModels {
  faceDetector: faceDetection.FaceDetector;
  landmarksDetector: faceLandmarksDetection.FaceLandmarksDetector;
}

let modelsPromise: Promise<FaceModels> | null = null;

// Charge les modèles TFJS à la demande (une seule fois, partagé entre pages).
// L'app se monte immédiatement ; seules les pages d'analyse attendent ce chargement.
export function loadFaceModels(): Promise<FaceModels> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      await tf.setBackend('webgl');
      await tf.ready();

      const [faceDetector, landmarksDetector] = await Promise.all([
        faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          { runtime: 'tfjs', modelType: 'full', maxFaces: 1 }
        ),
        faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          { runtime: 'tfjs', refineLandmarks: true, maxFaces: 1 }
        )
      ]);

      return { faceDetector, landmarksDetector };
    })().catch(err => {
      // Permet de retenter au prochain appel au lieu de rester bloqué sur l'échec
      modelsPromise = null;
      throw err;
    });
  }
  return modelsPromise;
}
