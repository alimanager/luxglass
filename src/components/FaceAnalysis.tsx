import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import * as faceapi from 'face-api.js';

interface FaceAnalysisProps {
  onAnalysisComplete: (shape: string, characteristics: any) => void;
}

const FaceAnalysis: React.FC<FaceAnalysisProps> = ({ onAnalysisComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        setError(null);

        console.log('Loading face-api.js models...');
        
        // Load models from the public directory
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/face-api'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models/face-api'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models/face-api')
        ]);

        console.log('Models loaded successfully');
        
        // Start video after models are loaded
        await startVideo();
        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading models:', err);
        setError('Failed to load face detection models. Please refresh the page and try again.');
        setIsModelLoading(false);
      }
    };

    loadModels();

    // Cleanup
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check your camera permissions.');
    }
  };

  const detectFace = async () => {
    if (!videoRef.current) return false;

    try {
      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();

      setIsFaceDetected(detections.length > 0);
      return detections.length > 0;
    } catch (err) {
      console.error('Error detecting face:', err);
      return false;
    }
  };

  const analyzeFace = async () => {
    if (!videoRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const hasFace = await detectFace();
      if (!hasFace) {
        setError('No face detected. Please ensure your face is clearly visible.');
        setIsAnalyzing(false);
        return;
      }

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detections.length === 0) {
        setError('Unable to analyze face features. Please try again.');
        setIsAnalyzing(false);
        return;
      }

      const detection = detections[0];
      const landmarks = detection.landmarks;
      const expressions = detection.expressions;

      // Calculate face measurements
      const measurements = {
        faceWidth: detection.detection.box.width,
        faceHeight: detection.detection.box.height,
        symmetry: calculateSymmetry(landmarks),
        jawlineStrength: calculateJawlineStrength(landmarks),
        cheekboneProminence: calculateCheekboneProminence(landmarks),
        chinShape: determineChinShape(landmarks),
        eyeDistance: calculateEyeDistance(landmarks),
        skinTone: await analyzeSkinTone(videoRef.current)
      };

      // Determine face shape
      const faceShape = determineFaceShape(measurements);

      onAnalysisComplete(faceShape, measurements);
    } catch (err) {
      console.error('Error during analysis:', err);
      setError('An error occurred during face analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateSymmetry = (landmarks: any) => {
    // Calculate facial symmetry using landmark points
    // Return value between 0-100
    return 85 + Math.random() * 10; // Placeholder implementation
  };

  const calculateJawlineStrength = (landmarks: any) => {
    // Calculate jawline strength using landmark points
    // Return value between 0-100
    return 70 + Math.random() * 20; // Placeholder implementation
  };

  const calculateCheekboneProminence = (landmarks: any) => {
    // Calculate cheekbone prominence using landmark points
    // Return value between 0-100
    return 75 + Math.random() * 15; // Placeholder implementation
  };

  const determineChinShape = (landmarks: any): 'pointed' | 'rounded' | 'square' => {
    // Determine chin shape using landmark points
    const shapes: Array<'pointed' | 'rounded' | 'square'> = ['pointed', 'rounded', 'square'];
    return shapes[Math.floor(Math.random() * shapes.length)]; // Placeholder implementation
  };

  const calculateEyeDistance = (landmarks: any) => {
    // Calculate interpupillary distance using landmark points
    return Math.round(100 + Math.random() * 50); // Placeholder implementation
  };

  const analyzeSkinTone = async (video: HTMLVideoElement): Promise<'Fair' | 'Light' | 'Medium Light' | 'Medium' | 'Medium Dark' | 'Dark' | 'Deep'> => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate average RGB values
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    // Simple skin tone classification based on RGB values
    const brightness = (r + g + b) / 3;
    if (brightness > 200) return 'Fair';
    if (brightness > 180) return 'Light';
    if (brightness > 160) return 'Medium Light';
    if (brightness > 140) return 'Medium';
    if (brightness > 120) return 'Medium Dark';
    if (brightness > 100) return 'Dark';
    return 'Deep';
  };

  const determineFaceShape = (measurements: any): string => {
    const ratio = measurements.faceHeight / measurements.faceWidth;
    
    if (ratio > 1.5) return 'oblong';
    if (ratio < 1.2) return 'round';
    if (measurements.jawlineStrength > 85) return 'square';
    if (measurements.cheekboneProminence > 85) return 'diamond';
    return 'oval';
  };

  return (
    <div className="space-y-4">
      <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onPlay={() => {
            const checkFace = setInterval(async () => {
              const hasface = await detectFace();
              setIsFaceDetected(hasface);
            }, 1000);

            return () => clearInterval(checkFace);
          }}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
        
        <div className={`absolute inset-[15%] border-4 transition-colors duration-300 ${
          isFaceDetected ? 'border-green-500' : 'border-gray-300'
        } rounded-lg`}>
          <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-lg"></div>
        </div>

        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full transition-colors ${
          isFaceDetected ? 'bg-green-500' : 'bg-gray-500'
        } text-white text-sm flex items-center`}>
          {isModelLoading ? 'Loading models...' : (
            isFaceDetected ? 'Face detected' : 'No face detected'
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={analyzeFace}
          disabled={isAnalyzing || isModelLoading || !isFaceDetected}
          className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors ${
            isAnalyzing || isModelLoading || !isFaceDetected
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          <Camera className="h-5 w-5 mr-2" />
          {isModelLoading ? 'Loading models...' : 
           isAnalyzing ? 'Analyzing...' : 
           !isFaceDetected ? 'Waiting for face detection' :
           'Analyze face shape'}
        </button>
      </div>
    </div>
  );
};

export default FaceAnalysis;