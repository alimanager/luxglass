import type { Offre } from '../lib/flux';
import { total } from '../lib/flux';

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** Price comparison for one frame: cheapest delivered price first, affiliate links. */
export default function Offres({ offres, demo = false }: { offres: Offre[]; demo?: boolean }) {
  if (!offres.length) return null;
  const best = offres[0];
  return (
    <div>
      {demo && (
        <p className="text-sm bg-shell-light rounded-tile px-3 py-2 mb-3">
          Boutiques et prix fictifs, pour la démonstration.
        </p>
      )}
      <ul className="border-t border-rule">
        {offres.map((o, i) => (
          <li key={o.marchand + o.url} className="flex items-center gap-3 py-3 border-b border-rule">
            <div className="min-w-0 flex-1">
              {i === 0 && o.dispo && <p className="text-xs font-semibold text-shell">Le moins cher</p>}
              <p className="font-semibold truncate">{o.marchand}</p>
              <p className="text-sm text-graphite tnum">
                {eur(o.prix)}
                {o.livraison ? ` + ${eur(o.livraison)} de livraison` : ', livraison offerte'}
                {!o.dispo && ', en rupture'}
              </p>
            </div>
            <span className="tnum font-bold shrink-0">{eur(total(o))}</span>
            <a
              href={o.url}
              target="_blank"
              rel="sponsored nofollow noopener"
              aria-disabled={demo}
              onClick={(e) => demo && e.preventDefault()}
              className={`shrink-0 h-10 px-4 rounded-[10px] inline-flex items-center text-sm font-semibold ${
                o === best ? 'bg-ink text-paper hover:bg-ink-soft' : 'border border-ink/20 hover:border-ink'
              } ${demo ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Voir l’offre
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-graphite mt-3">
        Liens affiliés : LuxOptic peut percevoir une commission sur un achat, sans surcoût pour toi. Prix relevés dans
        les flux des marchands ; le prix final est celui affiché sur leur site.
      </p>
    </div>
  );
}
