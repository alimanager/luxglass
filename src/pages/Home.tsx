import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ScanFace } from 'lucide-react';
import { glasses } from '../data/mockData';

const TICKER_ITEMS = [
  'Analyse morphologique par caméra',
  'Montures notées pour votre visage',
  '13 modèles au banc d\'essai',
  'L\'Atelier : une monture dessinée pour vous seul',
  'Écart pupillaire mesuré au millimètre',
];

const SOMMAIRE = [
  {
    numero: '01',
    titre: 'L\'Analyse',
    texte: 'Notre caméra mesure votre visage au millimètre : écart pupillaire, pont nasal, forme et teint. Le miroir ne vous avait jamais rien dit de tel.',
    lien: '/try-on',
    action: 'Passer devant l\'objectif',
    icon: ScanFace,
  },
  {
    numero: '02',
    titre: 'La Sélection',
    texte: 'Chaque monture du numéro est notée face à votre morphologie : harmonie des formes, ajustement physique, accord des couleurs.',
    lien: '/catalog',
    action: 'Feuilleter le catalogue',
    icon: ArrowRight,
  },
  {
    numero: '03',
    titre: 'L\'Atelier',
    texte: 'Le clou du numéro : une monture unique, dessinée en trois dimensions à partir de vos mesures. Calibre, pont, forme — tout est à vous.',
    lien: '/atelier',
    action: 'Entrer dans l\'atelier',
    icon: Sparkles,
  },
];

const Home: React.FC = () => {
  const featured = glasses.slice(0, 3);

  return (
    <div className="flex flex-col">
      {/* Couverture */}
      <section className="relative overflow-hidden border-b-[3px] border-ink bg-paper pt-36 pb-10">
        {/* Décor Memphis */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-8 right-[8%] w-40 h-40 bg-accent-400 border-2 border-ink rotate-12" />
          <div className="absolute top-1/3 right-[22%] w-24 h-24 bg-primary-600 border-2 border-ink rounded-full" />
          <div className="absolute bottom-16 right-[6%] w-56 h-10 bg-teal border-2 border-ink -rotate-6" />
          <div className="absolute top-24 left-[55%] w-14 h-14 bg-cream border-2 border-ink -rotate-12" />
          <div
            className="absolute bottom-24 left-[45%] w-48 h-6 -rotate-3"
            style={{
              background:
                'repeating-linear-gradient(90deg, #221a14 0 12px, transparent 12px 24px)',
            }}
          />
        </div>

        <div className="relative container mx-auto px-4">
          <p className="kicker mb-6">Le grand numéro de l'été — Spécial morphologie</p>

          <h1 className="font-serif font-black leading-[0.95] mb-8">
            <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl uppercase text-outline">
              Lunettes
            </span>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl uppercase text-primary-600">
              & Visages
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-xl mb-10 font-medium">
            Le premier magazine qui mesure votre visage avant de vous conseiller
            une monture — et qui la dessine sur mesure si aucune ne vous va.
          </p>

          <div className="flex flex-wrap gap-4 mb-6">
            <Link to="/try-on" className="btn btn-primary text-sm">
              Analyser mon visage
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link to="/atelier" className="btn btn-accent text-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Créer ma monture sur mesure
            </Link>
          </div>
        </div>

        {/* Ticker bas de couverture */}
        <div className="absolute bottom-0 left-0 right-0 bg-ink text-cream overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee py-2">
            {[0, 1].map(copy => (
              <span key={copy} className="flex-shrink-0">
                {TICKER_ITEMS.map((item, i) => (
                  <span key={i} className="mx-6 text-[11px] uppercase tracking-[0.25em]">
                    {item} <span className="text-accent-400 mx-2">★</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Sommaire */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-4 mb-12">
            <h2 className="uppercase">Sommaire</h2>
            <span className="kicker hidden sm:block">Dans ce numéro</span>
          </div>

          {/* Annonce de l'article de fond */}
          <Link
            to="/manifeste"
            className="card group flex flex-col md:flex-row items-baseline justify-between gap-2 px-6 py-5 mb-10 bg-accent-100"
          >
            <span className="kicker">À lire — pages 42 à 47</span>
            <span className="font-serif italic text-xl md:text-2xl">
              La Géométrie Secrète du Visage
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700 group-hover:underline underline-offset-4">
              Lire l'article →
            </span>
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SOMMAIRE.map(({ numero, titre, texte, lien, action, icon: Icon }) => (
              <Link key={numero} to={lien} className="card group p-8 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display text-5xl text-primary-600">{numero}</span>
                  <Icon className="h-7 w-7 text-ink" />
                </div>
                <h3 className="text-2xl mb-3 uppercase">{titre}</h3>
                <p className="text-secondary-800 mb-6">{texte}</p>
                <span className="mt-auto text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700 group-hover:underline underline-offset-4">
                  {action} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* En couverture */}
      <section className="py-20 bg-cream border-y-[3px] border-ink">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-baseline border-b-[3px] border-ink pb-4 mb-12 gap-2">
            <h2 className="uppercase">En Couverture</h2>
            <Link
              to="/catalog"
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700 hover:underline underline-offset-4"
            >
              Tout le catalogue →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featured.map(item => (
              <Link to={`/product/${item.id}`} key={item.id} className="card group">
                <div className="relative h-64 overflow-hidden border-b-2 border-ink">
                  <img
                    src={item.imageUrl}
                    alt={`${item.brand} ${item.name}`}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  {item.magazineFeatures[0] && (
                    <div className="absolute top-4 right-4">
                      <span className="magazine-tag bg-accent-300 text-ink">
                        {item.magazineFeatures[0].name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="kicker !tracking-[0.2em] mb-1">{item.brand}</p>
                  <h3 className="text-lg font-bold">{item.name}</h3>
                  <div className="flex justify-between items-center mt-3">
                    <span className="font-mono font-bold text-lg">{item.price} €</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700 group-hover:underline underline-offset-4">
                      Voir la fiche
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="paper-panel bg-ink text-cream p-10 md:p-16 text-center relative overflow-hidden">
            <div aria-hidden className="absolute top-6 left-6 w-10 h-10 bg-primary-600 border-2 border-cream rotate-12" />
            <div aria-hidden className="absolute bottom-6 right-8 w-14 h-14 bg-accent-400 border-2 border-cream rounded-full" />
            <p className="kicker !text-cream mb-4">Édition limitée</p>
            <h2 className="!text-cream uppercase mb-6">
              Votre visage mérite sa une
            </h2>
            <p className="text-secondary-200 max-w-2xl mx-auto mb-8">
              Passez devant l'objectif, laissez nos mesures parler, et repartez
              avec la monture que ce numéro a dessinée pour vous.
            </p>
            <Link to="/try-on" className="btn btn-accent text-sm">
              Commencer l'analyse
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
