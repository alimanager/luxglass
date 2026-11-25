import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import FacePhoto from '../components/analysis/FacePhoto';
import FrameImage from '../components/frames/FrameImage';
import { loadAnalysis, type AnalysisResult } from '../lib/analysisStore';
import { FRAME_SIZE_INFO, SHAPE_INFO, frameColors, rankGlasses } from '../lib/recommendations';
import { FEATURE_LABELS } from '../lib/faceFeatures';
import { priceLabel } from '../lib/catalog';

export default function AnalysisResults() {
  const location = useLocation();
  const result: AnalysisResult | null = (location.state as { result?: AnalysisResult } | null)?.result ?? loadAnalysis();
  const [showMesh, setShowMesh] = useState(false);
  const picks = useMemo(
    () => (result ? rankGlasses(result.metrics, result.profile).slice(0, 4) : []),
    [result]
  );

  if (!result) {
    return (
      <div className="max-w-xl mx-auto px-5 py-24">
        <h1 className="wide font-extrabold text-3xl">Pas encore d’analyse</h1>
        <p className="text-graphite mt-2">Fais l’analyse de ton visage pour obtenir ton rapport : forme, mesures et montures conseillées.</p>
        <Link to="/analyse" className="btn-ink mt-6">Commencer l’analyse</Link>
      </div>
    );
  }

  const { metrics: m, profile } = result;
  const shape = SHAPE_INFO[m.shape];
  const colors = frameColors(m.skin);

  return (
    <div className="max-w-6xl mx-auto px-5 pt-5 pb-24 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative">
          <FacePhoto
            photo={result.photo}
            width={result.photoWidth}
            height={result.photoHeight}
            landmarks={result.landmarks}
            showMesh={showMesh}
            showGuides={showMesh}
            className="w-full rounded-stage bg-[#0e1420]"
          />
          <button
            onClick={() => setShowMesh((s) => !s)}
            aria-pressed={showMesh}
            className="absolute bottom-3 right-3 h-9 px-4 rounded-full text-sm bg-black/55 text-paper backdrop-blur"
          >
            {showMesh ? 'Masquer les points' : 'Voir les points mesurés'}
          </button>
        </div>
      </div>

      <div>
        <h1 className="wide font-extrabold text-[34px] md:text-5xl leading-[1.04] mt-8 lg:mt-0">
          {profile.firstName ? `${profile.firstName}, ton` : 'Ton'} visage est {shape.label.toLowerCase()}
        </h1>
        <p className="text-graphite text-[17px] mt-4 max-w-[52ch]">{shape.summary}</p>

        {/* the numbers are the memorable part of the report */}
        <dl className="mt-10 grid grid-cols-3 border-y border-rule divide-x divide-rule">
          {[
            [`${Math.round(m.pupillaryDistanceMm)}`, 'mm', 'Écart pupillaire'],
            [`${Math.round(m.faceWidthMm)}`, 'mm', 'Largeur du visage'],
            [m.frameSize, '', 'Taille de monture'],
          ].map(([v, unit, label]) => (
            <div key={label} className="py-5 px-3 first:pl-0">
              <dd className="wide font-black text-[26px] sm:text-[32px] md:text-[44px] leading-none tnum whitespace-nowrap">
                {v}
                {unit && <span className="text-sm sm:text-base font-semibold text-graphite ml-0.5">{unit}</span>}
              </dd>
              <dt className="text-sm text-graphite mt-2">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-sm text-graphite mt-3 max-w-[60ch]">
          {FRAME_SIZE_INFO[m.frameSize]} Mesures prises sur ton iris, à 2 ou 3 mm près ; pour des verres correcteurs, ton opticien
          confirmera l’écart pupillaire.
        </p>

        <Section title="Ce qui te va">
          <ul className="space-y-2">
            {shape.tips.map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-shell shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-graphite mt-4">À éviter : {shape.avoid.charAt(0).toLowerCase() + shape.avoid.slice(1)}</p>
          <Link to="/formes" className="inline-block mt-4 font-semibold underline underline-offset-4 decoration-shell decoration-2">
            Voir les formes faites pour toi
          </Link>
        </Section>

        {picks.length > 0 && (
          <Section title="Tes montures">
            <div className="grid grid-cols-2 gap-3">
              {picks.map(({ product: p, fit }) => (
                <div key={p.id}>
                  <Link to={`/montures/${p.id}`} className="block rounded-tile bg-glass-soft hover:bg-glass transition-colors px-3 py-6">
                    <FrameImage frame={p} alt={p.name} />
                  </Link>
                  <p className="mt-3 text-sm text-graphite">{p.brand}</p>
                  <p className="font-semibold leading-snug">{p.name}</p>
                  <p className="text-sm tnum">{priceLabel(p)}</p>
                  <p className="text-sm mt-1.5">
                    <span className="tnum font-semibold">{fit.score} %</span> pour toi
                    {fit.reasons[0] && fit.reasons[0].delta > 0 && (
                      <span className="block text-graphite leading-snug mt-0.5">{fit.reasons[0].text}</span>
                    )}
                  </p>
                  <span className="flex gap-4 mt-1">
                    <Link to={`/apercu/${p.id}`} className="text-sm font-semibold underline underline-offset-4 decoration-shell decoration-2">
                      Me voir avec
                    </Link>
                    {!p.photo && (
                      <Link to={`/essayer/${p.id}`} className="text-sm font-semibold underline underline-offset-4 decoration-rule decoration-2">
                        En direct
                      </Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <Link to={`/apercu/${picks[0].product.id}`} className="btn-ink w-full mt-8">Me voir avec mes montures</Link>
          </Section>
        )}

        {m.features && (
          <Section title="Tes traits">
            <ul className="space-y-2">
              <li>Sourcils {FEATURE_LABELS.browThickness[m.features.browThickness]}, {FEATURE_LABELS.browArch[m.features.browArch]}, {FEATURE_LABELS.browGap[m.features.browGap]}.</li>
              <li>Yeux {FEATURE_LABELS.eyeSet[m.features.eyeSet]}, {FEATURE_LABELS.eyeSlant[m.features.eyeSlant]}.</li>
              <li>Traits {m.features.intensity > 0.6 ? 'marqués' : m.features.intensity < 0.35 ? 'délicats' : 'équilibrés'} : les montures sont choisies avec la présence qui va avec.</li>
            </ul>
          </Section>
        )}

        <Section title="Couleurs de monture">
          <div className="flex items-center gap-4">
            <span className="h-12 w-12 rounded-full border border-rule shrink-0" style={{ background: m.skin.hex }} />
            <p>
              Teint {m.skin.depth}, sous-ton {m.skin.undertone}.
              <span className="block text-sm text-graphite">Relevé sur ta photo ; l’éclairage peut le fausser.</span>
            </p>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {colors.map((c) => (
              <div key={c.name}>
                <span className="block h-10 rounded-tile" style={{ background: c.hex }} />
                <span className="block text-xs text-graphite mt-1.5 leading-tight">{c.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Proportions">
          <Meter label="Symétrie" value={m.symmetryScore} note="Écart entre tes deux côtés, sur 10 paires de points." />
          <Meter label="Équilibre des proportions" value={m.harmonyScore} note="Tiers du visage, bas du visage et écart des yeux." />
          <p className="text-sm text-graphite mt-4">
            Rapport longueur sur largeur <span className="tnum text-ink">{m.lengthRatio.toFixed(2)}</span>, mâchoire à{' '}
            <span className="tnum text-ink">{Math.round(m.jawRatio * 100)} %</span> et front à{' '}
            <span className="tnum text-ink">{Math.round(m.foreheadRatio * 100)} %</span> de la largeur des pommettes.
          </p>
        </Section>

        <Link to="/analyse" className="btn-quiet w-full mt-10">Refaire l’analyse</Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t-2 border-ink pt-5">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Meter({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex justify-between items-baseline">
        <span className="font-semibold">{label}</span>
        <span className="tnum wide font-extrabold text-xl">{value}<span className="text-sm text-graphite font-normal">/100</span></span>
      </div>
      <div className="h-1.5 bg-glass rounded-full mt-2 overflow-hidden">
        <div className="h-full bg-ink rounded-full" style={{ width: `${value}%` }} />
      </div>
      <p className="text-sm text-graphite mt-1.5">{note}</p>
    </div>
  );
}
