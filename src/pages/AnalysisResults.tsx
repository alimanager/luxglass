import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';

interface LocationState {
  faceShape: string;
  characteristics: {
    symmetry: number;
    jawlineStrength: number;
    cheekboneProminence: number;
    chinShape: 'pointed' | 'rounded' | 'square';
    faceWidth: number;
    faceLength: number;
    eyeDistance: number;
  };
}

const AnalysisResults: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  if (!state?.faceShape || !state?.characteristics) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-medium mb-4">Analyse non disponible</h2>
          <p className="text-gray-600 mb-6">
            Veuillez d'abord effectuer l'analyse de votre visage.
          </p>
          <button
            onClick={() => navigate('/try-on')}
            className="btn btn-primary"
          >
            Commencer l'analyse
          </button>
        </div>
      </div>
    );
  }

  const { faceShape, characteristics } = state;

  return (
    <div className="min-h-screen pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif mb-8">Résultats de l'Analyse</h1>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Face Shape Section */}
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-medium mb-6">
              Forme de Visage : <span className="text-primary-600 capitalize">{faceShape}</span>
            </h2>
            <p className="text-gray-600 mb-6">
              Votre visage présente les caractéristiques typiques d'une forme {faceShape}.
              Cette analyse nous permet de vous recommander les montures les plus adaptées à votre morphologie.
            </p>
          </div>

          {/* Characteristics Section */}
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-medium mb-6">Caractéristiques du Visage</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column - Progress Bars */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Symétrie du Visage</span>
                    <span className="text-sm font-medium text-primary-600">
                      {characteristics.symmetry.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary-600 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${characteristics.symmetry}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Force de la Mâchoire</span>
                    <span className="text-sm font-medium text-primary-600">
                      {characteristics.jawlineStrength.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary-600 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${characteristics.jawlineStrength}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Proéminence des Pommettes</span>
                    <span className="text-sm font-medium text-primary-600">
                      {characteristics.cheekboneProminence.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary-600 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${characteristics.cheekboneProminence}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Right Column - Measurements and Shape */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Forme du Menton</h3>
                  <p className="text-lg font-medium text-primary-600 capitalize">
                    {characteristics.chinShape === 'pointed' ? 'Pointu' : 
                     characteristics.chinShape === 'rounded' ? 'Arrondi' : 'Carré'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Proportions du Visage</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Largeur</span>
                      <span className="text-sm font-medium">
                        {characteristics.faceWidth.toFixed(0)}px
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Longueur</span>
                      <span className="text-sm font-medium">
                        {characteristics.faceLength.toFixed(0)}px
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Distance entre les yeux</span>
                      <span className="text-sm font-medium">
                        {characteristics.eyeDistance.toFixed(0)}px
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations Section */}
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-medium mb-6">Recommandations</h2>
            <div className="space-y-4">
              <p className="text-gray-600">
                Basé sur votre forme de visage {faceShape}, voici nos recommandations pour le choix de vos lunettes :
              </p>
              <ul className="space-y-2 text-gray-600">
                {faceShape === 'round' && (
                  <>
                    <li>• Optez pour des montures angulaires pour créer un contraste</li>
                    <li>• Les lunettes rectangulaires allongent visuellement le visage</li>
                    <li>• Évitez les montures rondes qui accentuent la rondeur</li>
                  </>
                )}
                {faceShape === 'square' && (
                  <>
                    <li>• Choisissez des montures rondes ou ovales pour adoucir les traits</li>
                    <li>• Les lunettes aviateur s'adaptent parfaitement à votre morphologie</li>
                    <li>• Évitez les montures carrées qui renforcent l'aspect anguleux</li>
                  </>
                )}
                {faceShape === 'oval' && (
                  <>
                    <li>• La plupart des styles de lunettes vous vont bien</li>
                    <li>• Privilégiez des montures proportionnées à votre visage</li>
                    <li>• Évitez les montures trop grandes qui déséquilibrent les proportions</li>
                  </>
                )}
                {faceShape === 'heart' && (
                  <>
                    <li>• Privilégiez les montures qui s'élargissent vers le bas</li>
                    <li>• Les lunettes papillon équilibrent les proportions</li>
                    <li>• Évitez les montures trop larges au niveau des tempes</li>
                  </>
                )}
                {faceShape === 'oblong' && (
                  <>
                    <li>• Choisissez des montures larges pour réduire visuellement la longueur</li>
                    <li>• Les lunettes oversize créent un bel équilibre</li>
                    <li>• Évitez les montures étroites qui allongent encore plus le visage</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-center pt-6">
            <button
              onClick={() => navigate('/virtual-try-on', { 
                state: { faceShape, characteristics } 
              })}
              className="btn btn-primary text-lg px-8 py-3"
            >
              Continuer vers l'essayage virtuel
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;