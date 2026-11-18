import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FrameImage from '../components/frames/FrameImage';
import { products, STYLES } from '../lib/catalog';
import { loadAnalysis } from '../lib/analysisStore';
import { SHAPE_INFO } from '../lib/recommendations';

type Sort = 'pertinence' | 'prix-asc' | 'prix-desc';

export default function Catalog() {
  const analysis = useMemo(() => loadAnalysis(), []);
  const [style, setStyle] = useState<string | null>(null);
  const [mySize, setMySize] = useState(!!analysis);
  const [forMe, setForMe] = useState(!!analysis);
  const [sort, setSort] = useState<Sort>('pertinence');

  const list = useMemo(() => {
    let l = products.filter((p) => !style || p.style === style);
    if (analysis && mySize) l = l.filter((p) => p.size === analysis.metrics.frameSize);
    if (analysis && forMe) l = l.filter((p) => SHAPE_INFO[analysis.metrics.shape].styles.includes(p.style));
    if (sort === 'prix-asc') l = [...l].sort((a, b) => a.price - b.price);
    if (sort === 'prix-desc') l = [...l].sort((a, b) => b.price - a.price);
    return l;
  }, [style, mySize, forMe, sort, analysis]);

  const chip = (active: boolean) =>
    `shrink-0 h-9 px-4 rounded-full border text-sm transition-colors ${
      active ? 'bg-ink text-paper border-ink' : 'border-rule text-ink hover:border-ink'
    }`;

  return (
    <div className="max-w-6xl mx-auto px-5 pt-10 pb-24">
      <h1 className="wide font-extrabold text-4xl md:text-5xl">Montures</h1>
      <p className="text-graphite mt-2">
        {list.length} {list.length > 1 ? 'modèles' : 'modèle'}
        {analysis ? `, filtrés pour ton visage ${SHAPE_INFO[analysis.metrics.shape].label.toLowerCase()} en taille ${analysis.metrics.frameSize}` : ''}.
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {analysis && (
          <>
            <button className={chip(forMe)} onClick={() => setForMe((v) => !v)} aria-pressed={forMe}>
              Conseillées pour moi
            </button>
            <button className={chip(mySize)} onClick={() => setMySize((v) => !v)} aria-pressed={mySize}>
              Ma taille ({analysis.metrics.frameSize})
            </button>
            <span className="w-px bg-rule shrink-0 mx-1" />
          </>
        )}
        <button className={chip(style === null)} onClick={() => setStyle(null)}>
          Toutes les formes
        </button>
        {STYLES.map((s) => (
          <button key={s} className={chip(style === s)} onClick={() => setStyle(style === s ? null : s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <label className="text-sm text-graphite flex items-center gap-2">
          Trier
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-tile border border-rule bg-paper px-2 text-ink">
            <option value="pertinence">Pertinence</option>
            <option value="prix-asc">Prix croissant</option>
            <option value="prix-desc">Prix décroissant</option>
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-semibold">Aucune monture ne combine tous ces filtres.</p>
          <button
            className="btn-line mt-4"
            onClick={() => {
              setStyle(null);
              setMySize(false);
              setForMe(false);
            }}
          >
            Retirer les filtres
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-10">
          {list.map((p) => (
            <Link key={p.id} to={`/montures/${p.id}`} className="group">
              <div className="rounded-tile bg-glass-soft group-hover:bg-glass transition-colors px-3 py-8">
                <FrameImage spec={p.spec} alt={p.name} />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-graphite">{p.brand}</p>
                  <p className="font-semibold leading-snug truncate">{p.name}</p>
                  <p className="marking mt-1">{p.marking}</p>
                </div>
                <p className="tnum font-semibold shrink-0">{p.price} €</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
