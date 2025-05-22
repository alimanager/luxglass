import React, { useState } from 'react';
import FaceAnalysis from '../components/FaceAnalysis';
import VirtualTryOn from '../components/VirtualTryOn';
import { glasses } from '../data/mockData';
import { Glasses } from '../types/glasses';

const faceShapeDescriptions: Record<string, { description: string; recommendations: string[] }> = {
  round: {
    description: "Votre visage présente des courbes douces et une largeur similaire à sa longueur. Les pommettes sont la partie la plus large de votre visage.",
    recommendations: [
      "Optez pour des montures angulaires pour créer un contraste",
      "Les lunettes rectangulaires allongent visuellement le visage",
      "Évitez les montures rondes qui accentuent la rondeur"
    ]
  },
  square: {
    description: "Votre visage présente des angles marqués, avec une mâchoire forte et un front large. La largeur et la longueur sont proportionnelles.",
    recommendations: [
      "Choisissez des montures rondes ou ovales pour adoucir les traits",
      "Les lunettes aviateur s'adaptent parfaitement à votre morphologie",
      "Évitez les montures carrées qui renforcent l'aspect anguleux"
    ]
  },
  heart: {
    description: "Votre visage s'affine vers le menton, avec un front plus large et des pommettes hautes. La forme rappelle un cœur inversé.",
    recommendations: [
      "Privilégiez les montures qui s'élargissent vers le bas",
      "Les lunettes papillon équilibrent les proportions",
      "Évitez les montures trop larges au niveau des tempes"
    ]
  },
  oblong: {
    description: "Votre visage est plus long que large, avec des traits réguliers et un front, des joues et une mâchoire de largeur similaire.",
    recommendations: [
      "Choisissez des montures larges pour réduire visuellement la longueur",
      "Les lunettes oversize créent un bel équilibre",
      "Évitez les montures étroites qui allongent encore plus le visage"
    ]
  },
  oval: {
    description: "Votre visage présente des proportions équilibrées avec un front légèrement plus large que le menton et des contours harmonieux.",
    recommendations: [
      "La plupart des styles de lunettes vous vont bien",
      "Privilégiez des montures proportionnées à votre visage",
      "Évitez les montures trop grandes qui déséquilibrent les proportions"
    ]
  }
};

const TryOn: React.FC = () => {
  const [faceShape, setFaceShape] = useState<string | null>(null);
  const [recommendedGlasses, setRecommendedGlasses] = useState<Glasses[]>([]);
  const [selectedGlasses, setSelectedGlasses] = useState<Glasses | null>(null);

  const getRecommendedGlasses = (shape: string) => {
    let recommendedStyles: string[] = [];
    switch (shape) {
      case 'round':
        recommendedStyles = ['Rectangulaire', 'Carré', 'Aviateur'];
        break;
      case 'square':
        recommendedStyles = ['Rond', 'Aviateur', 'Oversize'];
        break;
      case 'heart':
        recommendedStyles = ['Aviateur', 'Papillon', 'Rond'];
        break;
      case 'oblong':
        recommendedStyles = ['Oversize', 'Papillon', 'Browline'];
        break;
      default:
        recommendedStyles = ['Rectangulaire', 'Aviateur', 'Rond'];
    }

    return glasses
      .filter(glass => recommendedStyles.includes(glass.style))
      .slice(0, 3);
  };

  const handleAnalysisComplete = (shape: string) => {
    setFaceShape(shape);
    const recommended = getRecommendedGlasses(shape);
    setRecommendedGlasses(recommended);
    setSelectedGlasses(recommended[0]); // Automatically select first pair
  };

  return (
    <div className="min-h-screen pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif mb-6">Essayage Virtuel</h1>
        
        {!faceShape ? (
          <div>
            <h2 className="text-xl mb-4">Analysez votre visage</h2>
            <p className="text-secondary-600 mb-6">
              Positionnez-vous face à la caméra dans un endroit bien éclairé. 
              Notre technologie analysera la forme de votre visage pour vous recommander 
              les montures les plus adaptées à votre morphologie.
            </p>
            <FaceAnalysis onAnalysisComplete={handleAnalysisComplete} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {selectedGlasses && (
                <VirtualTryOn
                  glasses={selectedGlasses}
                  faceShape={faceShape}
                />
              )}
            </div>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-medium mb-4">Analyse de votre visage</h3>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-lg mb-2">
                      Forme : <span className="text-primary-600">{faceShape}</span>
                    </p>
                    <p className="text-secondary-600">
                      {faceShapeDescriptions[faceShape]?.description}
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-medium mb-2">Nos recommandations :</p>
                    <ul className="list-disc list-inside space-y-1 text-secondary-600">
                      {faceShapeDescriptions[faceShape]?.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-medium mb-4">Lunettes recommandées :</h3>
                <div className="space-y-4">
                  {recommendedGlasses.map(glass => (
                    <button
                      key={glass.id}
                      onClick={() => setSelectedGlasses(glass)}
                      className={`w-full text-left card transition-shadow ${
                        selectedGlasses?.id === glass.id 
                          ? 'ring-2 ring-primary-500' 
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="relative h-32">
                        <img
                          src={glass.imageUrl}
                          alt={glass.name}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="font-medium">{glass.name}</h4>
                        <p className="text-sm text-secondary-600">{glass.brand}</p>
                        <p className="mt-1 font-medium">{glass.price} €</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TryOn;