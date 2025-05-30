import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import * as faceapi from 'face-api.js';

interface FaceAnalysisProps {
  onAnalysisComplete: (measurements: any) => void;
}

function FaceAnalysis({ onAnalysisComplete }: FaceAnalysisProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
      } catch (err) {
        setError('Failed to load face detection models');
        console.error('Error loading models:', err);
      }
    };

    loadModels();
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Unable to access camera');
      console.error('Error accessing camera:', err);
    }
  };

  const handleAnalysis = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsAnalyzing(true);
    try {
      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();

      if (detections.length === 0) {
        setError('No face detected. Please ensure your face is clearly visible.');
        setIsAnalyzing(false);
        return;
      }

      const detection = detections[0];
      const measurements = {
        // Calculate face measurements here
        faceWidth: detection.detection.box.width,
        faceHeight: detection.detection.box.height,
        // Add more measurements as needed
      };

      onAnalysisComplete(measurements);
    } catch (err) {
      setError('Error during face analysis');
      console.error('Analysis error:', err);
    }
    setIsAnalyzing(false);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          onPlay={startVideo}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </div>

      {error && (
        <div className="mt-2 text-red-500 text-sm text-center">
          {error}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <button
          onClick={handleAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="w-5 h-5" />
          {isAnalyzing ? 'Analyzing...' : 'Analyze Face'}
        </button>
      </div>
    </div>
  );
}

export default FaceAnalysis;