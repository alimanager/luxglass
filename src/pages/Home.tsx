import { Link } from 'react-router-dom';
import FrameViewer from '../components/frames/FrameViewer';
import FrameImage from '../components/frames/FrameImage';
import { products } from '../lib/catalog';

// The hero is set like an optician's acuity chart: each line smaller than the last,
// with its acuity in the margin. The smallest line carries the actual explanation.
const CHART = [
  { text: 'TROUVE', acuity: '1/10', size: 'text-[clamp(56px,15vw,168px)]' },
  { text: 'LA MONTURE', acuity: '3/10', size: 'text-[clamp(34px,9.2vw,100px)]' },
  { text: 'FAITE POUR', acuity: '5/10', size: 'text-[clamp(26px,6.6vw,64px)]' },
  { text: 'TON VISAGE', acuity: '7/10', size: 'text-[clamp(19px,4.6vw,42px)]' },
];

const STEPS = [
  { title: 'Trois questions', text: 'Ton style et ton budget, pour classer les montures qui te correspondent.' },
  { title: 'Une photo de face', text: 'Prise automatiquement. On mesure la forme de ton visage, l’écart entre tes pupilles et ta largeur de tempes.' },
  { title: 'L’essayage en direct', text: 'Les montures conseillées s’affichent sur ton visage, à leur taille réelle, et suivent tes mouvements.' },
];

export default function Home() {
  const featured = products[0];
  const picks = [products[1], products[4], products[2], products[8]];

  return (
    <>
      <section className="max-w-6xl mx-auto px-5 pt-12 md:pt-16 pb-10 text-center">
        <h1 className="wide font-black leading-[0.92] tracking-[-0.01em]">
          {CHART.map((l, i) => (
            <span key={l.text} className="relative block animate-chart-in" style={{ animationDelay: `${i * 90}ms` }}>
              <span className={l.size}>{l.text}</span>
              <span aria-hidden className="absolute right-0 top-1/2 -translate-y-1/2 narrow tnum text-[11px] md:text-xs font-normal text-mist hidden sm:block">
                {l.acuity}
              </span>
            </span>
          ))}
        </h1>
        <p className="relative mt-4 mx-auto max-w-[34ch] text-[15px] text-graphite animate-chart-in" style={{ animationDelay: '400ms' }}>
          Analyse gratuite de ton visage, puis essayage des montures en direct sur ta caméra.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/analyse" className="btn-ink">Analyser mon visage</Link>
          <Link to="/essayer" className="btn-line">Essayer des montures</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5">
        <div className="relative rounded-stage bg-glass overflow-hidden">
          <FrameViewer spec={featured.spec} label={`${featured.name} en 3D`} className="h-[300px] md:h-[440px]" />
          <div className="absolute left-5 bottom-4 md:left-8 md:bottom-6 text-left pointer-events-none">
            <p className="font-semibold">{featured.name}</p>
            <p className="marking">{featured.marking}</p>
          </div>
          <p className="absolute right-5 bottom-4 md:right-8 md:bottom-6 text-xs text-graphite pointer-events-none">Fais-la tourner</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <h2 className="wide font-extrabold text-3xl md:text-4xl max-w-[18ch]">Comment ça marche</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-5">
              <span className="narrow tnum text-sm text-graphite">Étape {i + 1}</span>
              <h3 className="text-xl font-bold mt-1">{s.title}</h3>
              <p className="text-graphite mt-2 max-w-[38ch]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-24">
        <div className="flex items-end justify-between gap-6">
          <h2 className="wide font-extrabold text-3xl md:text-4xl">Quelques montures</h2>
          <Link to="/montures" className="text-[15px] font-semibold underline underline-offset-4 decoration-shell decoration-2 shrink-0">
            Voir les {products.length}
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {picks.map((p) => (
            <Link key={p.id} to={`/montures/${p.id}`} className="group">
              <div className="rounded-tile bg-glass-soft group-hover:bg-glass transition-colors px-3 py-6">
                <FrameImage spec={p.spec} alt={p.name} />
              </div>
              <p className="mt-3 text-sm text-graphite">{p.brand}</p>
              <p className="font-semibold leading-snug">{p.name}</p>
              <p className="tnum text-[15px] mt-0.5">{p.price} €</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
