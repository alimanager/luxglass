import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Minus } from 'lucide-react';
import FrameViewer from '../components/frames/FrameViewer';
import FrameImage from '../components/frames/FrameImage';
import { productById, products, priceLabel } from '../lib/catalog';
import { loadAnalysis } from '../lib/analysisStore';
import { SHAPE_INFO } from '../lib/recommendations';
import type { FaceShape } from '../lib/faceMetrics';

export default function ProductDetail() {
  const { id } = useParams();
  const p = productById(id ?? '');
  const analysis = useMemo(() => loadAnalysis(), []);

  if (!p) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-24">
        <h1 className="wide font-extrabold text-3xl">Cette monture n’existe pas</h1>
        <Link to="/montures" className="btn-ink mt-6">Voir toutes les montures</Link>
      </div>
    );
  }

  const shapes = (Object.keys(SHAPE_INFO) as FaceShape[]).filter((s) => SHAPE_INFO[s].styles.includes(p.style));
  const others = products.filter((q) => q.id !== p.id);
  const similar = [
    ...others.filter((q) => q.style === p.style || q.size === p.size),
    ...others.filter((q) => q.style !== p.style && q.size !== p.size),
  ].slice(0, 4);

  let fit: { good: boolean; text: string } | null = null;
  if (analysis) {
    const m = analysis.metrics;
    const shapeOk = shapes.includes(m.shape);
    const diff = Math.round(p.width - m.faceWidthMm);
    const sizeOk = Math.abs(diff) <= 6;
    fit = {
      good: shapeOk && sizeOk,
      text: [
        shapeOk
          ? `Cette forme met en valeur un visage ${SHAPE_INFO[m.shape].label.toLowerCase()}.`
          : `Pour un visage ${SHAPE_INFO[m.shape].label.toLowerCase()}, d’autres formes sont plus flatteuses.`,
        sizeOk
          ? `Sa largeur (${p.width} mm) correspond à la tienne (${Math.round(m.faceWidthMm)} mm).`
          : diff > 0
          ? `Elle est ${diff} mm plus large que ton visage : elle paraîtra grande.`
          : `Elle est ${-diff} mm plus étroite que ton visage : elle paraîtra petite.`,
      ].join(' '),
    };
  }

  const specs: [string, string][] = [
    ['Largeur de verre', `${p.spec.lens.w} mm`],
    ['Pont', `${p.spec.bridge} mm`],
    ['Branches', `${p.spec.temple} mm`],
    ['Largeur totale', `${p.width} mm (taille ${p.size})`],
    ['Hauteur de verre', `${p.spec.lens.h} mm`],
    ['Matière', p.material],
    ['Couleur', p.color],
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 pt-6 pb-24">
      <Link to="/montures" className="inline-flex items-center gap-2 text-sm text-graphite hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Montures
      </Link>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="relative rounded-stage bg-glass overflow-hidden lg:self-start lg:sticky lg:top-24">
          <FrameViewer frame={p} label={`${p.name} en 3D`} className="h-[300px] sm:h-[400px] lg:h-[520px]" />
          <p className="absolute right-5 bottom-4 text-xs text-graphite pointer-events-none">Fais-la tourner</p>
        </div>

        <div className="mt-8 lg:mt-2">
          <p className="text-graphite">{p.brand}</p>
          <h1 className="wide font-extrabold text-3xl md:text-4xl leading-tight">{p.name}</h1>
          <p className="tnum text-2xl font-semibold mt-3">{priceLabel(p)}</p>

          {fit && (
            <div className={`mt-6 rounded-tile p-4 flex gap-3 ${fit.good ? 'bg-glass-soft' : 'bg-shell-light'}`}>
              {fit.good ? <Check className="h-5 w-5 shrink-0 mt-0.5" /> : <Minus className="h-5 w-5 shrink-0 mt-0.5 text-shell" />}
              <p className="text-[15px]">{fit.text}</p>
            </div>
          )}

          <div className="mt-6 grid gap-2">
            <Link to={`/essayer/${p.id}`} className="btn-ink">Essayer sur mon visage</Link>
            {!analysis && (
              <Link to="/analyse" className="btn-line">Vérifier si elle me va</Link>
            )}
          </div>

          <section className="mt-10">
            <h2 className="font-bold">Cotes</h2>
            <p className="text-sm text-graphite mt-1">
              Gravées à l’intérieur de la branche : <span className="marking !text-ink">{p.marking}</span>
            </p>
            <dl className="mt-4 border-t border-rule">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5 border-b border-rule text-[15px]">
                  <dt className="text-graphite">{k}</dt>
                  <dd className="tnum text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-10">
            <h2 className="font-bold">Va bien aux visages</h2>
            <p className="text-[15px] text-graphite mt-1">
              {shapes.length ? shapes.map((s) => SHAPE_INFO[s].label.toLowerCase()).join(', ') : 'ovales'}.
            </p>
            <p className="text-[15px] text-graphite mt-4 max-w-[60ch]">{p.description}</p>
            {p.model?.credit && (
              <p className="text-sm text-graphite mt-4">
                Modèle 3D :{' '}
                <a href={p.model.credit.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {p.model.credit.author}
                </a>
                , licence {p.model.credit.license}.
              </p>
            )}
            {p.productUrl && !p.demo && (
              <a href={p.productUrl} target="_blank" rel="noreferrer" className="inline-block mt-4 text-[15px] font-semibold underline underline-offset-4 decoration-shell decoration-2">
                Voir chez {p.brand}
              </a>
            )}
          </section>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-20">
          <h2 className="wide font-extrabold text-2xl md:text-3xl">Dans le même esprit</h2>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {similar.map((q) => (
              <Link key={q.id} to={`/montures/${q.id}`} className="group">
                <div className="rounded-tile bg-glass-soft group-hover:bg-glass transition-colors px-3 py-6">
                  <FrameImage frame={q} alt={q.name} />
                </div>
                <p className="mt-3 text-sm text-graphite">{q.brand}</p>
                <p className="font-semibold leading-snug">{q.name}</p>
                <p className="tnum text-[15px]">{priceLabel(q)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
