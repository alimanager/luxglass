import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, Loader2, Sparkles } from 'lucide-react';
import { loadAnalysis } from '../lib/analysisStore';
import { productById, products, priceLabel, type Product } from '../lib/catalog';
import { recommendGlasses } from '../lib/recommendations';
import FrameImage from '../components/frames/FrameImage';
import Offres from '../components/Offres';

const CONSENT_KEY = 'luxoptic.consentement-ia.v1';
const QUOTA_KEY = 'luxoptic.apercus';
const QUOTA_PER_DAY = 5;

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, v: string) {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* private mode: ignore */
    }
  },
};

function usedToday(): number {
  const raw = store.get(QUOTA_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return 0;
  const [day, n] = raw.split(':');
  return day === today ? Number(n) || 0 : 0;
}
function countOne() {
  store.set(QUOTA_KEY, `${new Date().toISOString().slice(0, 10)}:${usedToday() + 1}`);
}

const cache = new Map<string, string>();

export default function Apercu() {
  const { id } = useParams();
  const navigate = useNavigate();
  const analysis = useMemo(() => loadAnalysis(), []);
  const product = productById(id ?? '') as Product | undefined;
  const [consent, setConsent] = useState(store.get(CONSENT_KEY) === 'oui');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(() =>
    product && cache.has(String(product.id)) ? 'done' : 'idle'
  );
  const [image, setImage] = useState<string | null>(() => (product ? cache.get(String(product.id)) ?? null : null));
  const [demoImage, setDemoImage] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const [showBefore, setShowBefore] = useState(false);

  const others = useMemo(
    () =>
      analysis
        ? recommendGlasses(analysis.metrics, analysis.profile, 6)
            .map((g) => productById(g.id))
            .filter((p): p is Product => !!p && p.id !== product?.id)
            .slice(0, 4)
        : products.slice(0, 4),
    [analysis, product]
  );

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-5 py-24">
        <h1 className="wide font-extrabold text-3xl">Cette monture n’existe pas</h1>
        <Link to="/montures" className="btn-ink mt-6">Voir les montures</Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-xl mx-auto px-5 py-24">
        <h1 className="wide font-extrabold text-3xl">D’abord, une photo de toi</h1>
        <p className="text-graphite mt-2">
          L’aperçu utilise la photo de face prise pendant l’analyse. Ça prend deux minutes, et on te conseille au passage
          les montures qui te vont.
        </p>
        <Link to="/analyse" className="btn-ink mt-6">Faire l’analyse</Link>
      </div>
    );
  }

  const left = QUOTA_PER_DAY - usedToday();

  const generate = async () => {
    store.set(CONSENT_KEY, 'oui');
    setConsent(true);
    if (left <= 0) {
      setState('error');
      setError(`Tu as utilisé tes ${QUOTA_PER_DAY} aperçus du jour. Reviens demain, ou essaie les montures en direct en attendant.`);
      return;
    }
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/apercu', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          face: analysis.photo,
          productId: product.id,
          frameWidthMm: product.width,
          faceWidthMm: analysis.metrics.faceWidthMm,
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { image?: string; error?: string; detail?: string; demo?: boolean };
      setDetail(out.detail ?? '');
      if (!res.ok || !out.image) throw new Error(out.error ?? `La génération a échoué (erreur ${res.status}). Réessaie.`);
      countOne();
      cache.set(String(product.id), out.image);
      setImage(out.image);
      setDemoImage(!!out.demo);
      setState('done');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'La génération a échoué. Réessaie.');
    }
  };

  const demoOffers = product.id >= 9000;

  return (
    <div className="max-w-6xl mx-auto px-5 pt-6 pb-24 lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative rounded-stage overflow-hidden bg-[#0e1420] aspect-[3/4]">
          <img
            src={state === 'done' && image && !showBefore ? image : analysis.photo}
            alt={state === 'done' ? `Toi avec ${product.name}, image générée par IA` : 'Ta photo'}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {state === 'loading' && (
            <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px] flex flex-col items-center justify-center text-paper text-center px-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-3 font-semibold">On te met les lunettes…</p>
              <p className="text-sm text-paper/70 mt-1">10 à 20 secondes</p>
            </div>
          )}
          {state === 'done' && (
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
              <button
                onPointerDown={() => setShowBefore(true)}
                onPointerUp={() => setShowBefore(false)}
                onPointerLeave={() => setShowBefore(false)}
                className="h-9 px-4 rounded-full text-sm bg-black/55 text-paper backdrop-blur select-none"
              >
                Maintenir pour comparer
              </button>
              {image && (
                <a href={image} download={`luxoptic-${product.id}.png`} className="h-9 w-9 rounded-full bg-black/55 text-paper backdrop-blur flex items-center justify-center" aria-label="Enregistrer l’image">
                  <Download className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
        {state === 'done' && (
          <p className="text-xs text-graphite mt-2">
            {demoImage
              ? 'Mode démonstration : l’IA n’est pas branchée, ta photo est affichée telle quelle.'
              : 'Image générée par IA : un rendu indicatif, pas une mesure. La taille réelle s’essaie en direct.'}
          </p>
        )}
      </div>

      <div className="mt-8 lg:mt-0">
        <p className="text-graphite">{product.brand}</p>
        <h1 className="wide font-extrabold text-3xl md:text-4xl leading-tight">{product.name}</h1>
        <p className="tnum text-xl font-semibold mt-2">{priceLabel(product)}</p>

        {state !== 'done' && (
          <div className="mt-6 rounded-tile bg-glass-soft p-5">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-shell" />
              <div>
                <p className="font-semibold">Te voir avec ces lunettes</p>
                <p className="text-[15px] text-graphite mt-1">
                  Une IA crée une photo réaliste de toi avec cette monture, à partir de ta photo d’analyse.
                </p>
                {!consent && (
                  <p className="text-sm text-graphite mt-3">
                    Pour cela, ta photo est envoyée à Google (Gemini), qui génère l’image. LuxOptic ne la conserve pas.
                  </p>
                )}
              </div>
            </div>
            <button onClick={generate} disabled={state === 'loading'} className="btn-ink w-full mt-4">
              {state === 'loading' ? 'Génération…' : consent ? 'Me voir avec' : 'J’accepte et je me vois avec'}
            </button>
            <p className="text-xs text-graphite mt-2 text-center">
              {Math.max(0, left)} aperçu{left > 1 ? 's' : ''} restant{left > 1 ? 's' : ''} aujourd’hui
            </p>
            {state === 'error' && (
              <div className="mt-3">
                <p className="text-sm text-danger">{error}</p>
                {detail && <p className="text-xs text-graphite mt-1 break-words">{detail}</p>}
              </div>
            )}
          </div>
        )}

        {product.offres?.length ? (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-3">Où l’acheter</h2>
            <Offres offres={product.offres} demo={demoOffers} />
          </section>
        ) : (
          <div className="mt-8 flex flex-col gap-2">
            {!product.photo && <Link to={`/essayer/${product.id}`} className="btn-line">Essayer en direct, à taille réelle</Link>}
            <Link to={`/montures/${product.id}`} className="btn-quiet">Voir la fiche</Link>
          </div>
        )}

        {others.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold">Essayer aussi</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {others.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setState(cache.has(String(p.id)) ? 'done' : 'idle');
                    setImage(cache.get(String(p.id)) ?? null);
                    navigate(`/apercu/${p.id}`);
                  }}
                  className="text-left group"
                >
                  <div className="rounded-tile bg-glass-soft group-hover:bg-glass transition-colors px-3 py-5">
                    <FrameImage frame={p} alt={p.name} />
                  </div>
                  <p className="mt-2 text-sm text-graphite">{p.brand}</p>
                  <p className="font-semibold leading-snug">{p.name}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
