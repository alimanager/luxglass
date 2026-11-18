import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ScanFace, ShieldCheck, Sparkles } from 'lucide-react';
import StepShell, { OptionCard, PrimaryButton } from '../components/analysis/StepShell';
import CaptureStep, { type Capture } from '../components/analysis/CaptureStep';
import AnalyzingStep from '../components/analysis/AnalyzingStep';
import { loadFaceModel } from '../lib/faceModel';
import { buildResult } from '../lib/buildResult';
import { saveAnalysis, type AnalysisResult } from '../lib/analysisStore';
import type { Profile } from '../lib/recommendations';

type Step = 'intro' | 'name' | 'style' | 'budget' | 'capture' | 'analyzing';
const ORDER: Step[] = ['intro', 'name', 'style', 'budget', 'capture', 'analyzing'];

const TryOn: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [profile, setProfile] = useState<Profile>({ firstName: '', style: 'classique', budget: 'mid' });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start downloading the model right away; it is ready by the time the camera opens.
  useEffect(() => {
    loadFaceModel().catch(() => undefined);
  }, []);

  const index = ORDER.indexOf(step);
  const next = () => setStep(ORDER[index + 1]);
  const back = index > 0 && step !== 'analyzing' ? () => setStep(ORDER[index - 1]) : undefined;

  const onCaptured = useCallback(
    (capture: Capture) => {
      try {
        const r = buildResult(capture, profile);
        saveAnalysis(r);
        setResult(r);
        setStep('analyzing');
      } catch {
        setError('L’analyse a échoué sur cette photo. Réessaie avec une photo bien de face.');
      }
    },
    [profile]
  );

  const onDone = useCallback(() => {
    if (result) navigate('/analyse/resultats', { state: { result } });
  }, [navigate, result]);

  return (
    <div className="min-h-screen pt-20 bg-paper">
      <StepShell step={index + 1} total={ORDER.length} onBack={back}>
        {step === 'intro' && (
          <div className="flex flex-col flex-1">
            <h1 className="wide font-extrabold text-[34px] text-ink leading-[1.05]">
              Analyse de ton visage
            </h1>
            <p className="text-graphite mt-3">
              Gratuite, en deux minutes. On mesure ton visage sur une photo de face, puis on te conseille les formes,
              la taille et les couleurs de monture qui te vont.
            </p>
            <ol className="mt-8 space-y-4">
              {[
                { icon: Sparkles, title: '3 questions', text: 'Pour connaître tes goûts et ton budget' },
                { icon: Camera, title: '1 photo de face', text: 'Prise automatiquement, guidée en direct' },
                { icon: ScanFace, title: 'Ton rapport', text: 'Forme du visage, mesures, montures conseillées' },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="h-11 w-11 shrink-0 rounded-[10px] bg-glass-soft flex items-center justify-center text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{title}</span>
                    <span className="block text-sm text-graphite">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 text-xs text-mist mt-8">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Ta photo est analysée sur ton appareil. Rien n’est envoyé sur un serveur.
            </div>
            <div className="mt-auto pt-8 pb-5">
              <PrimaryButton onClick={next}>
                Commencer
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === 'name' && (
          <Question title="Comment tu t’appelles ?" subtitle="Pour personnaliser ton rapport.">
            <input
              autoFocus
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value.slice(0, 30) })}
              onKeyDown={(e) => e.key === 'Enter' && next()}
              placeholder="Ton prénom"
              className="w-full h-14 rounded-[10px] border border-rule bg-white px-5 text-lg text-ink placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <Footer onNext={next} label={profile.firstName.trim() ? 'Continuer' : 'Passer'} />
          </Question>
        )}

        {step === 'style' && (
          <Question title="Quel style tu recherches ?" subtitle="On l’utilise pour classer tes recommandations.">
            {(
              [
                ['discret', 'Discret', 'Fin, léger, qui se fait oublier'],
                ['classique', 'Classique', 'Des valeurs sûres, intemporelles'],
                ['affirme', 'Affirmé', 'Une monture qui se remarque'],
              ] as const
            ).map(([value, title, subtitle]) => (
              <OptionCard
                key={value}
                title={title}
                subtitle={subtitle}
                selected={profile.style === value}
                onClick={() => {
                  setProfile({ ...profile, style: value });
                  window.setTimeout(next, 180);
                }}
              />
            ))}
          </Question>
        )}

        {step === 'budget' && (
          <Question title="Ton budget pour une monture ?">
            {(
              [
                ['low', 'Moins de 200 €'],
                ['mid', 'Entre 200 et 400 €'],
                ['high', 'Plus de 400 €'],
              ] as const
            ).map(([value, title]) => (
              <OptionCard
                key={value}
                title={title}
                selected={profile.budget === value}
                onClick={() => {
                  setProfile({ ...profile, budget: value });
                  window.setTimeout(next, 180);
                }}
              />
            ))}
          </Question>
        )}

        {step === 'capture' && (
          <>
            {error && <p className="mb-4 text-sm text-danger bg-shell-light rounded-xl px-4 py-3">{error}</p>}
            <CaptureStep onCaptured={onCaptured} />
          </>
        )}

        {step === 'analyzing' && result && <AnalyzingStep result={result} onDone={onDone} />}
      </StepShell>
    </div>
  );
};

const Question: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="flex flex-col flex-1">
    <h1 className="wide font-extrabold text-3xl text-ink leading-tight">{title}</h1>
    {subtitle && <p className="text-graphite mt-2">{subtitle}</p>}
    <div className="mt-8 space-y-3 flex-1 flex flex-col">{children}</div>
  </div>
);

const Footer: React.FC<{ onNext: () => void; label: string }> = ({ onNext, label }) => (
  <div className="mt-auto pt-8 pb-5">
    <PrimaryButton onClick={onNext}>
      {label}
    </PrimaryButton>
  </div>
);

export default TryOn;
