import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';

interface FaceAnalysisProps {
  onAnalysisComplete: (faceShape: string) => void;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detector, setDetector] = useState<faceDetection.FaceDetector | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    const initializeTF = async () => {
      try {
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
        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading model:', err);
        setError('Error loading face detection model');
        setIsModelLoading(false);
      }
    };

    initializeTF();
  }, []);

  useEffect(() => {
    if (!detector || !webcamRef.current?.video) return;

    const detectFace = async () => {
      try {
        const video = webcamRef.current?.video;
        if (!video) return;

        const faces = await detector.estimateFaces(video);
        setFaceDetected(faces.length > 0);
        setError(null);
      } catch (err) {
        console.error('Detection error:', err);
        setFaceDetected(false);
        setError('Face detection error');
      }
    };

    const interval = setInterval(detectFace, 100);
    return () => clearInterval(interval);
  }, [detector]);

  const analyzeFaceShape = async () => {
    if (!detector || !webcamRef.current?.video) {
      setError('Camera or model not ready');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const faces = await detector.estimateFaces(webcamRef.current.video);
      
      if (faces && faces.length > 0) {
        const face = faces[0];
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
        setError('No face detected');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Face analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
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
            setError('Cannot access camera');
          }}
        />
        
        <div className={`absolute inset-0 border-4 ${
          faceDetected ? 'border-green-500' : 'border-gray-300'
        } rounded-lg transition-colors duration-300`}>
          <div className="absolute inset-1/4 border-2 border-dashed border-white/50 rounded-lg"></div>
        </div>

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
        <div className="bg-red-50 text-red-600 p-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={analyzeFaceShape}
        disabled={isAnalyzing || isModelLoading || !faceDetected}
        className={`w-full py-3 px-4 rounded-lg flex items-center justify-center ${
          isAnalyzing || isModelLoading || !faceDetected
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-primary-600 hover:bg-primary-700 text-white'
        }`}
      >
        {isModelLoading ? (
          <>
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Loading model...
          </>
        ) : isAnalyzing ? (
          <>
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Camera className="h-5 w-5 mr-2" />
            {faceDetected ? 'Analyze Face Shape' : 'Waiting for face detection'}
          </>
        )}
      </button>
    </div>
  );
};

export default FaceAnalysis;