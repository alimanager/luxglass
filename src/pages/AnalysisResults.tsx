import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Box, Info, RotateCcw, ScanFace } from 'lucide-react';
import FacePhoto from '../components/analysis/FacePhoto';
import { loadAnalysis, type AnalysisResult } from '../lib/analysisStore';
import { FRAME_SIZE_INFO, SHAPE_INFO, frameColors, recommendGlasses } from '../lib/recommendations';

const AnalysisResults: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const result: AnalysisResult | null = (location.state as { result?: AnalysisResult } | null)?.result ?? loadAnalysis();
  const [showMesh, setShowMesh] = useState(false);

  const picks = useMemo(() => (result ? recommendGlasses(result.metrics, result.profile) : []), [result]);

  if (!result) {
    return (
      <div className="min-h-screen pt-20 bg-sand-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <ScanFace className="h-12 w-12 text-ink-300 mx-auto mb-4" />
          <h1 className="font-serif text-3xl text-ink-900">Pas encore d’analyse</h1>
          <p className="text-ink-500 mt-2 mb-8">Fais l’analyse de ton visage pour obtenir ton rapport personnalisé.</p>
          <button onClick={() => navigate('/try-on')} className="h-14 px-8 rounded-2xl bg-ink-900 text-white font-medium">
            Commencer l’analyse
          </button>
        </div>
      </div>
    );
  }

  const { metrics: m, profile } = result;
  const shape = SHAPE_INFO[m.shape];
  const colors = frameColors(m.skin);

  return (
    <div className="min-h-screen pt-20 bg-sand-50 pb-16">
      <div className="max-w-md lg:max-w-5xl mx-auto px-5">
        <header className="pt-6 pb-6">
          <p className="text-xs font-medium tracking-wider uppercase text-ink-400">Ton rapport</p>
          <h1 className="font-serif text-4xl text-ink-900 leading-tight mt-1">
            {profile.firstName ? `${profile.firstName}, ton` : 'Ton'} visage est {shape.label.toLowerCase()}
          </h1>
        </header>

        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8 lg:items-start">
          {/* Photo */}
          <div className="lg:sticky lg:top-24">
            <div className="relative">
              <FacePhoto
                photo={result.photo}
                width={result.photoWidth}
                height={result.photoHeight}
                landmarks={result.landmarks}
                showMesh={showMesh}
                showGuides={showMesh}
                className="w-full rounded-3xl bg-ink-950"
              />
              <button
                onClick={() => setShowMesh((s) => !s)}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-md"
              >
                {showMesh ? 'Masquer les mesures' : 'Voir les mesures'}
              </button>
            </div>
          </div>

          <div className="space-y-4 mt-6 lg:mt-0">
            {/* Shape */}
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Eyebrow>Forme du visage</Eyebrow>
                  <h2 className="font-serif text-3xl text-ink-900 mt-1">{shape.label}</h2>
                </div>
                <ShapeIcon shape={m.shape} />
              </div>
              <p className="text-ink-600 mt-3 text-[15px]">{shape.summary}</p>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <Stat label="Longueur / largeur" value={m.lengthRatio.toFixed(2)} />
                <Stat label="Mâchoire" value={`${Math.round(m.jawRatio * 100)} %`} />
                <Stat label="Front" value={`${Math.round(m.foreheadRatio * 100)} %`} />
              </div>
              <p className="text-xs text-ink-400 mt-2">Mâchoire et front exprimés en % de la largeur des pommettes.</p>
            </Card>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <Gauge value={m.symmetryScore} />
                <h3 className="font-medium text-ink-900 mt-3">Symétrie</h3>
                <p className="text-xs text-ink-500 mt-1">Écart entre les deux côtés sur 10 paires de points.</p>
              </Card>
              <Card>
                <Gauge value={m.harmonyScore} />
                <h3 className="font-medium text-ink-900 mt-3">Proportions</h3>
                <p className="text-xs text-ink-500 mt-1">Tiers du visage, bas du visage et écart des yeux.</p>
              </Card>
            </div>

            {/* Measurements */}
            <Card>
              <Eyebrow>Tes mesures</Eyebrow>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label="Écart pupillaire" value={`${Math.round(m.pupillaryDistanceMm)} mm`} />
                <Stat label="Largeur du visage" value={`${Math.round(m.faceWidthMm)} mm`} />
                <Stat label="Taille conseillée" value={m.frameSize} highlight />
              </div>
              <p className="text-sm text-ink-600 mt-4">{FRAME_SIZE_INFO[m.frameSize]}</p>
              <p className="flex gap-2 text-xs text-ink-400 mt-3">
                <Info className="h-4 w-4 shrink-0" />
                Mesures estimées à partir de la taille de l’iris (±2 à 3 mm). Pour des verres correcteurs, ton opticien
                vérifiera l’écart pupillaire.
              </p>
            </Card>

            {/* Skin */}
            <Card>
              <Eyebrow>Ton teint</Eyebrow>
              <div className="flex items-center gap-4 mt-4">
                <span className="h-14 w-14 rounded-2xl border border-sand-200" style={{ background: m.skin.hex }} />
                <div>
                  <p className="font-medium text-ink-900 capitalize">{m.skin.depth}</p>
                  <p className="text-sm text-ink-500">Sous-ton {m.skin.undertone}</p>
                </div>
              </div>
              <p className="text-sm text-ink-600 mt-5 mb-3">Couleurs de monture qui te mettent en valeur :</p>
              <div className="flex gap-3">
                {colors.map((c) => (
                  <div key={c.name} className="flex-1 text-center">
                    <span className="block h-10 rounded-xl" style={{ background: c.hex }} />
                    <span className="block text-[11px] text-ink-500 mt-1.5 leading-tight">{c.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-400 mt-3">L’éclairage influence le résultat : à confirmer en lumière naturelle.</p>
            </Card>

            {/* Advice */}
            <Card>
              <Eyebrow>Nos conseils</Eyebrow>
              <ul className="mt-4 space-y-3">
                {shape.tips.map((tip) => (
                  <li key={tip} className="flex gap-3 text-[15px] text-ink-800">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gold-500 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-500 mt-4 pt-4 border-t border-sand-200">
                <span className="font-medium text-ink-700">À éviter : </span>
                {shape.avoid}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {shape.styles.map((s) => (
                  <span key={s} className="px-3 py-1 rounded-full bg-sand-100 text-xs font-medium text-ink-700">
                    {s}
                  </span>
                ))}
              </div>
            </Card>

            {/* Picks */}
            {picks.length > 0 && (
              <section className="pt-4">
                <h2 className="font-serif text-2xl text-ink-900">Sélectionnées pour toi</h2>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {picks.map((g) => (
                    <Link key={g.id} to={`/product/${g.id}`} className="group bg-white rounded-2xl overflow-hidden border border-sand-200">
                      <div className="aspect-square overflow-hidden bg-sand-100">
                        <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover transition group-hover:scale-105" />
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] uppercase tracking-wider text-ink-400">{g.brand}</p>
                        <p className="text-sm font-medium text-ink-900 leading-snug">{g.name}</p>
                        <p className="text-sm text-ink-600 mt-1">{g.price} €</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="pt-4 space-y-3">
              <button
                onClick={() => navigate('/virtual-try-on', { state: { faceShape: m.shape, characteristics: m } })}
                className="w-full h-14 rounded-2xl bg-ink-900 text-white font-medium flex items-center justify-center gap-2 hover:bg-ink-800 transition"
              >
                <Box className="h-5 w-5" /> Essayer en 3D <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate('/try-on')}
                className="w-full h-12 rounded-2xl text-ink-700 font-medium flex items-center justify-center gap-2 hover:bg-sand-100 transition"
              >
                <RotateCcw className="h-4 w-4" /> Refaire l’analyse
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-3xl border border-sand-200 p-5">{children}</div>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-medium tracking-wider uppercase text-ink-400">{children}</p>
);

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`rounded-2xl px-3 py-3 ${highlight ? 'bg-ink-900 text-white' : 'bg-sand-50'}`}>
    <p className={`text-lg font-medium tabular-nums ${highlight ? 'text-white' : 'text-ink-900'}`}>{value}</p>
    <p className={`text-[11px] leading-tight mt-0.5 ${highlight ? 'text-ink-200' : 'text-ink-500'}`}>{label}</p>
  </div>
);

const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f1ece4" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#1f2a2e"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-serif text-2xl text-ink-900">{value}</span>
    </div>
  );
};

const SHAPE_PATHS: Record<string, string> = {
  oval: 'M24 4 C36 4 42 14 42 26 C42 38 34 46 24 46 C14 46 6 38 6 26 C6 14 12 4 24 4 Z',
  round: 'M24 5 C36 5 44 13 44 25 C44 37 36 45 24 45 C12 45 4 37 4 25 C4 13 12 5 24 5 Z',
  square: 'M8 6 H40 Q43 6 43 9 V36 Q43 44 34 45 H14 Q5 44 5 36 V9 Q5 6 8 6 Z',
  heart: 'M6 8 Q6 4 12 4 H36 Q42 4 42 8 V20 Q42 34 24 46 Q6 34 6 20 Z',
  oblong: 'M24 2 C34 2 38 10 38 18 V32 C38 42 32 47 24 47 C16 47 10 42 10 32 V18 C10 10 14 2 24 2 Z',
};

const ShapeIcon: React.FC<{ shape: string }> = ({ shape }) => (
  <svg viewBox="0 0 48 50" className="h-14 w-14 shrink-0">
    <path d={SHAPE_PATHS[shape]} fill="#f1ece4" stroke="#1f2a2e" strokeWidth="2" />
  </svg>
);

export default AnalysisResults;
