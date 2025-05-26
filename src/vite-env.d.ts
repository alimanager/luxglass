/// <reference types="vite/client" />

interface Window {
  __models: {
    faceDetector: import('@tensorflow-models/face-detection').FaceDetector;
    landmarksDetector: import('@tensorflow-models/face-landmarks-detection').FaceLandmarksDetector;
  };
}