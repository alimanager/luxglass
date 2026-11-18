import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export type Point = { x: number; y: number; z?: number };

let detectorPromise: Promise<faceLandmarksDetection.FaceLandmarksDetector> | null = null;

/**
 * Loads the MediaPipe FaceMesh model (468 points + 10 iris points = 478) on demand.
 * The promise is shared, so calling this early (e.g. on the intro screen) preloads it
 * while the user fills in the questionnaire.
 */
export function loadFaceModel(): Promise<faceLandmarksDetection.FaceLandmarksDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      // Optional: VITE_FACE_RUNTIME=mediapipe + VITE_FACE_SOLUTION_PATH to use the WASM runtime
      // (handy for offline tests, where the tfjs weights cannot be downloaded).
      if (import.meta.env.VITE_FACE_RUNTIME === 'mediapipe') {
        return faceLandmarksDetection.createDetector(model, {
          runtime: 'mediapipe',
          solutionPath: import.meta.env.VITE_FACE_SOLUTION_PATH || 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
          refineLandmarks: true,
          maxFaces: 1,
        });
      }
      await tf.setBackend('webgl');
      await tf.ready();
      return faceLandmarksDetection.createDetector(model, { runtime: 'tfjs', refineLandmarks: true, maxFaces: 1 });
    })().catch((err) => {
      console.error('Face model failed to load', err);
      detectorPromise = null; // allow a retry
      throw err;
    });
  }
  return detectorPromise;
}

export async function detectLandmarks(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<Point[] | null> {
  const detector = await loadFaceModel();
  const faces = await detector.estimateFaces(source, { flipHorizontal: false });
  if (!faces.length || faces[0].keypoints.length < 478) return null;
  return faces[0].keypoints.map((k) => ({ x: k.x, y: k.y, z: k.z }));
}
