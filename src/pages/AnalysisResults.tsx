import React, { useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, AlertCircle, Sparkles, Check } from 'lucide-react';
import { glasses } from '../data/mockData';
import { recommendGlasses, FACE_SHAPE_LABELS } from '../utils/recommendation';
import { FaceProfile, SkinTone } from '../types/glasses';

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
    interpupillaryDistance: number;
    noseBridgeWidth: number;
    skinTone: SkinTone;
  };
}

const AnalysisResults: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const profile: FaceProfile | null = useMemo(() => {
    if (!state?.faceShape || !state?.characteristics) return null;
    const c = state.characteristics;
    return {
      faceShape: state.faceShape,
      faceWidth: c.faceWidth,
      faceLength: c.faceLength,
      interpupillaryDistance: c.interpupillaryDistance ?? c.eyeDistance,
      noseBridgeWidth: c.noseBridgeWidth ?? 18,
      skinTone: c.skinTone
    };
  }, [state]);

  const recommendations = useMemo(
    () => (profile ? recommendGlasses(profile, glasses).slice(0, 6) : []),
    [profile]
  );

  if (!state?.faceShape || !state?.characteristics || !profile) {
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
  const faceShapeLabel = FACE_SHAPE_LABELS[faceShape] ?? faceShape;

  return (
    <div className="min-h-screen pt-20">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif mb-8">Résultats de l'Analyse</h1>

        <div className="max-w-5xl mx-auto space-y-8">
          {/* Face Shape Section */}
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-medium mb-6">
              Forme de Visage : <span className="text-primary-600 capitalize">{faceShapeLabel}</span>
            </h2>
            <p className="text-gray-600">
              Votre visage présente les caractéristiques typiques d'une forme {faceShapeLabel}.
              Nous avons croisé vos mesures avec les dimensions réelles de chaque monture
              du catalogue pour établir votre sélection personnalisée.
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

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Teint de Peau</h3>
                  <p className="text-lg font-medium text-primary-600">
                    {characteristics.skinTone}
                  </p>
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
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Vos Mesures</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Largeur du visage</span>
                      <span className="text-sm font-medium">
                        {characteristics.faceWidth.toFixed(0)} mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Longueur du visage</span>
                      <span className="text-sm font-medium">
                        {characteristics.faceLength.toFixed(0)} mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Écart pupillaire</span>
                      <span className="text-sm font-medium">
                        {profile.interpupillaryDistance.toFixed(0)} mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pont nasal</span>
                      <span className="text-sm font-medium">
                        {profile.noseBridgeWidth.toFixed(0)} mm
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sur Mesure CTA */}
          <div className="bg-secondary-900 text-white p-8 rounded-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-6 w-6 text-accent-400" />
                <h2 className="text-2xl font-serif">Votre monture unique</h2>
              </div>
              <p className="text-secondary-300 max-w-xl">
                Notre Atelier dessine en 3D une monture créée pour vous seul :
                calibre calculé sur votre écart pupillaire ({profile.interpupillaryDistance.toFixed(0)} mm),
                pont ajusté à votre nez, forme et couleurs choisies pour votre morphologie.
              </p>
            </div>
            <button
              onClick={() => navigate('/atelier', { state: { faceShape, characteristics } })}
              className="btn btn-accent text-base whitespace-nowrap px-8 py-3"
            >
              Créer ma monture
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>

          {/* Recommendations Section */}
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-medium mb-2">Votre Sélection Personnalisée</h2>
            <p className="text-gray-600 mb-8">
              Chaque monture du catalogue a été notée selon trois critères : l'harmonie
              avec la forme de votre visage, l'ajustement physique (largeur de face, pont,
              centres optiques) et l'accord avec votre teint.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recommendations.map(({ glasses: g, score, reasons }, index) => (
                <Link
                  key={g.id}
                  to={`/product/${g.id}`}
                  className="card group flex flex-col overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={g.imageUrl}
                      alt={`${g.brand} ${g.name}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-primary-600 text-white text-sm font-semibold px-3 py-1 rounded-full shadow">
                      {score}% compatible
                    </div>
                    {index === 0 && (
                      <div className="absolute top-3 right-3 bg-accent-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                        Meilleur choix
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm text-secondary-500">{g.brand}</span>
                      <span className="font-medium">{g.price} €</span>
                    </div>
                    <h3 className="text-lg font-medium mb-3">{g.name}</h3>
                    <ul className="space-y-1.5 mt-auto">
                      {reasons.slice(0, 2).map((reason, i) => (
                        <li key={i} className="flex items-start text-sm text-secondary-600">
                          <Check className="h-4 w-4 text-primary-600 mr-2 mt-0.5 flex-shrink-0" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-secondary-500 mt-3">
                      {g.dimensions.lensWidth} □ {g.dimensions.bridgeWidth} — {g.dimensions.templeLength}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <Link to="/catalog" className="btn btn-secondary">
                Voir tout le catalogue
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;
