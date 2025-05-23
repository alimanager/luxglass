import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertCircle, Move } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface FaceAnalysisProps {
  onAnalysisComplete: (faceShape: string) => void;
  onLandmarksDetected?: (landmarks: any) => void;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete, onLandmarksDetected }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detector, setDetector] = useState<faceDetection.FaceDetector | null>(null);
  const [landmarksDetector, setLandmarksDetector] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePosition, setFacePosition] = useState<'center' | 'off-center' | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const initializeTF = async () => {
      try {
        setIsModelLoading(true);
        setError(null);
        
        // Ensure WebGL backend is initialized
        await tf.setBackend('webgl');
        await tf.ready();
        
        console.log('TensorFlow.js initialized with WebGL backend');
        
        // Initialize face detection model
        const faceModel = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: 'tfjs',
            modelType: 'short',
            maxFaces: 1
          }
        );
        
        console.log('Face detection model loaded');
        
        // Initialize face landmarks detection model
        const landmarksModel = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: 'tfjs',
            refineLandmarks: true,
            maxFaces: 1
          }
        );
        
        console.log('Face landmarks model loaded');
        
        setDetector(faceModel);
        setLandmarksDetector(landmarksModel);
        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading face detection models:', err);
        setError('Error loading face detection models. Please refresh the page.');
        setIsModelLoading(false);
      }
    };

    initializeTF();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (webcamRef.current?.video) {
      const video = webcamRef.current.video;
      
      const handleVideoReady = () => {
        if (video.readyState === 4) {
          console.log('Video stream is ready');
          setIsVideoReady(true);
          if (detector && landmarksDetector) {
            startContinuousDetection(detector, landmarksDetector);
          }
        }
      };

      video.addEventListener('loadeddata', handleVideoReady);
      
      // Check if video is already ready
      if (video.readyState === 4) {
        handleVideoReady();
      }

      return () => {
        video.removeEventListener('loadeddata', handleVideoReady);
      };
    }
  }, [detector, landmarksDetector]);

  const checkFacePosition = (face: faceDetection.Face, videoWidth: number, videoHeight: number) => {
    const centerX = videoWidth / 2;
    const centerY = videoHeight / 2;
    const faceX = face.box.xCenter;
    const faceY = face.box.yCenter;
    
    const threshold = 50; // pixels from center
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - faceX, 2) + Math.pow(centerY - faceY, 2)
    );
    
    return distanceFromCenter < threshold ? 'center' : 'off-center';
  };

  const startContinuousDetection = (
    faceModel: faceDetection.FaceDetector,
    landmarksModel: faceLandmarksDetection.FaceLandmarksDetector
  ) => {
    const detectFace = async () => {
      try {
        const video = webcamRef.current?.video;
        if (!video || !isVideoReady || !faceModel || !landmarksModel) {
          animationFrameRef.current = requestAnimationFrame(detectFace);
          return;
        }

        // Get video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Detect face
        const detections = await faceModel.estimateFaces(video);
        const hasFace = detections.length > 0;
        setFaceDetected(hasFace);

        if (hasFace) {
          const face = detections[0];
          const position = checkFacePosition(face, videoWidth, videoHeight);
          setFacePosition(position);

          // Get face landmarks if face is centered
          if (position === 'center') {
            const landmarks = await landmarksModel.estimateFaces(video);
            if (landmarks.length > 0 && onLandmarksDetected) {
              onLandmarksDetected(landmarks[0]);
            }
          }

          if (error) {
            setError(null);
          }
        } else {
          setFacePosition(null);
          setError('No face detected. Please ensure you are visible in the frame.');
        }

        animationFrameRef.current = requestAnimationFrame(detectFace);
      } catch (err) {
        console.error('Error in continuous detection:', err);
        setFaceDetected(false);
        setFacePosition(null);
        setError('An error occurred during detection. Please check your camera.');
        
        // Retry detection after a delay
        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(detectFace);
        }, 1000);
      }
    };

    animationFrameRef.current = requestAnimationFrame(detectFace);
  };

  const analyzeFaceShape = async () => {
    if (!detector || !webcamRef.current?.video || !isVideoReady) {
      setError('Video is not ready yet. Please wait.');
      return;
    }

    if (facePosition !== 'center') {
      setError('Please center your face in the frame before analysis.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const detections = await detector.estimateFaces(webcamRef.current.video);

      if (detections && detections.length > 0) {
        const face = detections[0];
        const { width, height } = face.box;
        const ratio = height / width;

        let faceShape = 'oval';
        if (ratio > 1.5) {
          faceShape = 'oblong';
        } else if (ratio < 1.2) {
          faceShape = 'round';
        } else if (ratio >= 1.2 && ratio <= 1.3) {
          faceShape = 'square';
        } else if (ratio > 1.3 && ratio <= 1.5) {
          faceShape = 'heart';
        }

        onAnalysisComplete(faceShape);
      } else {
        setError('No face detected. Please ensure you are well-framed and in a well-lit area.');
      }
    } catch (err) {
      console.error('Error analyzing face:', err);
      setError('An error occurred during analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative space-y-4">
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
        <Webcam
          ref={webcamRef}
          mirrored
          className="w-full h-full object-cover"
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user"
          }}
          onUserMediaError={() => {
            setError('Cannot access camera. Please check permissions.');
          }}
        />
        
        {/* Face detection guide overlay */}
        <div className={`absolute inset-0 border-4 transition-colors duration-300 ${
          faceDetected ? (
            facePosition === 'center' ? 'border-green-500' : 'border-yellow-500'
          ) : 'border-gray-300'
        } rounded-lg`}>
          <div className="absolute inset-1/4 border-2 border-dashed border-white/50 rounded-lg"></div>
        </div>

        {/* Face position indicator */}
        {faceDetected && facePosition === 'off-center' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-yellow-500/80 text-white px-4 py-2 rounded-full flex items-center">
              <Move className="h-5 w-5 mr-2" />
              Center your face
            </div>
          </div>
        )}

        {/* Face detection status indicator */}
        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full transition-colors ${
          faceDetected ? (
            facePosition === 'center' ? 'bg-green-500' : 'bg-yellow-500'
          ) : 'bg-gray-500'
        } text-white text-sm flex items-center`}>
          {!isVideoReady ? 'Initializing camera...' : (
            faceDetected ? (
              facePosition === 'center' ? 'Face well positioned' : 'Adjust position'
            ) : 'Waiting for detection'
          )}
        </div>

        {/* Loading overlay */}
        {isModelLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading model...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={analyzeFaceShape}
          disabled={isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || facePosition !== 'center'}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !isVideoReady || !faceDetected || facePosition !== 'center'
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {isModelLoading ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Loading model...
            </>
          ) : !isVideoReady ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Initializing camera...
            </>
          ) : isAnalyzing ? (
            <>
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              {faceDetected ? (
                facePosition === 'center' ? 'Analyze Face Shape' : 'Center your face'
              ) : 'Waiting for face detection'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;