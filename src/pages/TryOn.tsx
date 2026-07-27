import React from 'react';
import { useNavigate } from 'react-router-dom';
import FaceAnalysis from '../components/FaceAnalysis';

const TryOn: React.FC = () => {
  const navigate = useNavigate();

  const handleAnalysisComplete = (shape: string, characteristics: any) => {
    navigate('/analysis-results', {
      state: { faceShape: shape, characteristics }
    });
  };

  return (
    <div className="min-h-screen pt-28">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif mb-6">Essayage Virtuel</h1>
        
        <div>
          <h2 className="text-xl mb-4">Analysez votre visage</h2>
          <p className="text-secondary-600 mb-6">
            Positionnez-vous face à la caméra dans un endroit bien éclairé. 
            Notre technologie analysera la forme de votre visage pour vous recommander 
            les montures les plus adaptées à votre morphologie.
          </p>
          <FaceAnalysis onAnalysisComplete={handleAnalysisComplete} />
        </div>
      </div>
    </div>
  );
};

export default TryOn;