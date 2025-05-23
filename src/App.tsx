import React, { useState } from 'react';
import FaceAnalysis from './components/FaceAnalysis';
import VirtualTryOn from './components/VirtualTryOn';
import { glasses } from './data/mockData';

function App() {
  const [faceShape, setFaceShape] = useState<string | null>(null);
  const [selectedGlasses, setSelectedGlasses] = useState(glasses[0]);

  const handleFaceAnalysis = (shape: string) => {
    setFaceShape(shape);
    // Get recommended glasses based on face shape
    const recommendedGlasses = glasses.filter(g => {
      switch (shape) {
        case 'round':
          return ['Rectangulaire', 'Carré'].includes(g.style);
        case 'square':
          return ['Rond', 'Ovale'].includes(g.style);
        case 'heart':
          return ['Aviateur', 'Papillon'].includes(g.style);
        case 'oval':
          return true; // Oval faces can wear most styles
        default:
          return true;
      }
    });
    
    if (recommendedGlasses.length > 0) {
      setSelectedGlasses(recommendedGlasses[0]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Essayage Virtuel de Lunettes
        </h1>

        {!faceShape ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">
                Analysez votre visage
              </h2>
              <p className="text-gray-600 mb-6">
                Positionnez votre visage dans le cadre et laissez-nous analyser 
                sa forme pour vous recommander les meilleures montures.
              </p>
              <FaceAnalysis onAnalysisComplete={handleFaceAnalysis} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <VirtualTryOn glasses={selectedGlasses} faceShape={faceShape} />
            </div>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-4">
                  Résultats de l'analyse
                </h2>
                <p className="text-gray-600">
                  Votre forme de visage : <span className="font-semibold">{faceShape}</span>
                </p>
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Lunettes recommandées :</h3>
                  <div className="grid gap-4">
                    {glasses.slice(0, 3).map((glass) => (
                      <button
                        key={glass.id}
                        onClick={() => setSelectedGlasses(glass)}
                        className={`p-4 rounded-lg border transition-all ${
                          selectedGlasses.id === glass.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-200'
                        }`}
                      >
                        <div className="flex items-center">
                          <img
                            src={glass.imageUrl}
                            alt={glass.name}
                            className="w-20 h-20 object-cover rounded"
                          />
                          <div className="ml-4 text-left">
                            <h4 className="font-medium">{glass.name}</h4>
                            <p className="text-sm text-gray-600">{glass.brand}</p>
                            <p className="text-primary-600 font-medium mt-1">
                              {glass.price} €
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setFaceShape(null)}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Recommencer l'analyse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;