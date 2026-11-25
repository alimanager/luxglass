import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { loadAnalysis } from '../lib/analysisStore';
import { SHAPE_INFO } from '../lib/recommendations';
import {
  CONSTRUCTION_LABEL,
  FAMILIES,
  GABARITS,
  MOODS,
  filterGabarits,
  matchFace,
  picture,
  type Filters,
  type Gabarit,
} from '../lib/gabarits';
import { answer, answers, type Label } from '../lib/feedbackStore';

const chip = (active: boolean) =>
  `shrink-0 h-9 px-4 rounded-full border text-sm transition-colors ${
    active ? 'bg-ink text-paper border-ink' : 'border-rule text-ink hover:border-ink'
  }`;

function Verdict({ id, value, onChange }: { id: string; value?: Label; onChange: (l: Label | null) => void }) {
  const btn = (active: boolean) =>
    `h-9 px-3 rounded-full border text-sm inline-flex items-center gap-1.5 transition-colors ${
      active ? 'bg-ink text-paper border-ink' : 'border-rule text-graphite hover:border-ink hover:text-ink'
    }`;
  return (
    <div className="flex gap-2 mt-3">
      <button className={btn(value === 'like')} aria-pressed={value === 'like'} onClick={() => onChange(answer(`g:${id}`, 'like', 'formes'))}>
        <ThumbsUp className="h-4 w-4" aria-hidden /> Ça me va
      </button>
      <button className={btn(value === 'dislike')} aria-pressed={value === 'dislike'} onClick={() => onChange(answer(`g:${id}`, 'dislike', 'formes'))}>
        <ThumbsDown className="h-4 w-4" aria-hidden /> Pas pour moi
      </button>
    </div>
  );
}

function Card({ g, score, value, onChange }: { g: Gabarit; score?: number; value?: Label; onChange: (l: Label | null) => void }) {
  const meta = [g.era, g.mood.join(' et ')].filter(Boolean).join(', ');
  return (
    <article className="flex flex-col">
      <div className="relative aspect-[16/9] rounded-tile bg-glass-soft flex items-center justify-center px-5">
        <img src={picture(g)} alt={`Monture ${g.name}, vue de face`} loading="lazy" className="w-full h-auto max-h-full object-contain" />
        {score !== undefined && (
          <span className="absolute top-3 right-3 text-xs font-semibold tnum bg-paper/90 rounded-full px-2.5 py-1">{score} %</span>
        )}
      </div>
      <h3 className="font-semibold mt-3 leading-snug">{g.name}</h3>
      <p className="text-sm text-graphite">
        {CONSTRUCTION_LABEL[g.construction]}
        {g.size !== 'standard' ? `, ${g.size}` : ''}
        {meta ? `. ${meta[0].toUpperCase()}${meta.slice(1)}.` : ''}
      </p>
      {g.icon && <p className="text-sm text-graphite mt-1.5 leading-snug">{g.icon}</p>}
      <Verdict id={g.id} value={value} onChange={onChange} />
    </article>
  );
}

export default function Formes() {
  const analysis = useMemo(() => loadAnalysis(), []);
  const [filters, setFilters] = useState<Filters>({ kitOnly: true });
  const [votes, setVotes] = useState(() => answers());
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const vote = (id: string) => (l: Label | null) =>
    setVotes((v) => {
      const next = new Map(v);
      if (l) next.set(`g:${id}`, l);
      else next.delete(`g:${id}`);
      return next;
    });

  const forMe = useMemo(() => (analysis ? matchFace(analysis.metrics).slice(0, 6) : []), [analysis]);
  const scores = useMemo(
    () => (analysis ? new Map(matchFace(analysis.metrics).map((m) => [m.gabarit.id, m.score])) : null),
    [analysis]
  );
  const list = useMemo(() => {
    const l = filterGabarits(GABARITS, filters);
    return scores ? [...l].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)) : l;
  }, [filters, scores]);
  const liked = [...votes.values()].filter((l) => l === 'like').length;

  return (
    <div className="max-w-6xl mx-auto px-5 pt-10 pb-24">
      <h1 className="wide font-extrabold text-4xl md:text-5xl">Formes</h1>
      <p className="text-graphite mt-2 max-w-2xl">
        Les grandes silhouettes de lunettes, dessinées à leurs proportions réelles. Dis lesquelles te vont : tes réponses affinent
        les conseils{liked ? ` (${liked} ${liked > 1 ? 'formes aimées' : 'forme aimée'} pour l’instant)` : ''}.
      </p>

      {analysis ? (
        <section className="mt-10">
          <h2 className="wide font-bold text-2xl">Pour ton visage {SHAPE_INFO[analysis.metrics.shape].label.toLowerCase()}</h2>
          {forMe[0]?.why.length ? <p className="text-graphite mt-1">{forMe[0].why.join(', ')}.</p> : null}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {forMe.map((m) => (
              <Card key={m.gabarit.id} g={m.gabarit} score={m.score} value={votes.get(`g:${m.gabarit.id}`)} onChange={vote(m.gabarit.id)} />
            ))}
          </div>
        </section>
      ) : (
        <p className="mt-8 text-[15px]">
          <Link to="/analyse" className="font-semibold underline underline-offset-4 decoration-shell decoration-2">
            Analyse ton visage
          </Link>{' '}
          pour voir d’abord les formes faites pour toi.
        </p>
      )}

      <section className="mt-14">
        <h2 className="wide font-bold text-2xl">{filters.kitOnly ? 'Les 21 icônes' : 'Toutes les formes'}</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          <button className={chip(!!filters.kitOnly)} onClick={() => set({ kitOnly: true })} aria-pressed={!!filters.kitOnly}>
            Les 21 icônes
          </button>
          <button className={chip(!filters.kitOnly)} onClick={() => set({ kitOnly: false })} aria-pressed={!filters.kitOnly}>
            Tout l’atlas
          </button>
          <span className="w-px bg-rule shrink-0 mx-1" />
          {MOODS.map((m) => (
            <button key={m.id} className={chip(filters.mood === m.id)} onClick={() => set({ mood: filters.mood === m.id ? null : m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {FAMILIES.map((f) => (
            <button key={f} className={chip(filters.family === f)} onClick={() => set({ family: filters.family === f ? null : f })}>
              {f}
            </button>
          ))}
          <span className="w-px bg-rule shrink-0 mx-1" />
          {(Object.keys(CONSTRUCTION_LABEL) as Gabarit['construction'][]).map((c) => (
            <button key={c} className={chip(filters.construction === c)} onClick={() => set({ construction: filters.construction === c ? null : c })}>
              {CONSTRUCTION_LABEL[c]}
            </button>
          ))}
        </div>

        {list.length ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {list.map((g) => (
              <Card key={g.id} g={g} score={scores?.get(g.id)} value={votes.get(`g:${g.id}`)} onChange={vote(g.id)} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-graphite">
            Aucune forme ne combine ces filtres.{' '}
            <button className="underline underline-offset-4" onClick={() => setFilters({ kitOnly: false })}>
              Retirer les filtres
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
