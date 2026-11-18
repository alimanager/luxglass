import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import FacePhoto from './FacePhoto';
import type { AnalysisResult } from '../../lib/analysisStore';

const STAGES = [
  'Cartographie des 478 points du visage',
  'Mesure de la symétrie',
  'Proportions et forme du visage',
  'Écart pupillaire et taille de monture',
  'Analyse du teint',
  'Sélection de tes montures',
];

const DURATION = 4200;

const AnalyzingStep: React.FC<{ result: AnalysisResult; onDone: () => void }> = ({ result, onDone }) => {
  const [t, setT] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const p = Math.min(1, (performance.now() - start) / DURATION);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(loop);
      else window.setTimeout(onDone, 350);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const reveal = Math.min(1, t / 0.35);
  const stage = Math.min(STAGES.length - 1, Math.floor(t * STAGES.length));

  return (
    <div className="flex flex-col flex-1">
      <h1 className="font-serif text-3xl text-ink-900 leading-tight">
        Analyse en cours{result.profile.firstName ? `, ${result.profile.firstName}` : ''}
      </h1>
      <p className="text-ink-500 mt-2 mb-5 text-sm">Quelques secondes, tout se passe sur ton appareil.</p>

      <FacePhoto
        photo={result.photo}
        width={result.photoWidth}
        height={result.photoHeight}
        landmarks={result.landmarks}
        reveal={reveal}
        showGuides={t > 0.4}
        className="w-full rounded-3xl bg-ink-950"
      />

      <ul className="mt-6 space-y-3 pb-6">
        {STAGES.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${i <= stage ? 'opacity-100' : 'opacity-30'}`}
          >
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center ${
                i < stage || t >= 1 ? 'bg-ink-900 text-white' : 'bg-sand-200 text-ink-600'
              }`}
            >
              {i < stage || t >= 1 ? (
                <Check className="h-3.5 w-3.5" />
              ) : i === stage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
            </span>
            <span className="text-ink-800">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AnalyzingStep;
