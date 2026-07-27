import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AtelierShape } from '../utils/parametricGlasses';

// --- Illustrations au trait, façon planches de presse ----------------------

type IconShape = AtelierShape | 'browline' | 'oversize' | 'square';

const GlassesIcon: React.FC<{ shape: IconShape }> = ({ shape }) => {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 3 };
  const bridge = <path d="M42 16 Q50 10 58 16" {...stroke} />;

  const lenses: Record<IconShape, React.ReactNode> = {
    rectangular: (
      <>
        <rect x="6" y="8" width="34" height="18" {...stroke} />
        <rect x="60" y="8" width="34" height="18" {...stroke} />
      </>
    ),
    square: (
      <>
        <rect x="8" y="6" width="32" height="22" {...stroke} />
        <rect x="60" y="6" width="32" height="22" {...stroke} />
      </>
    ),
    round: (
      <>
        <circle cx="24" cy="17" r="14" {...stroke} />
        <circle cx="76" cy="17" r="14" {...stroke} />
      </>
    ),
    oval: (
      <>
        <ellipse cx="24" cy="17" rx="16" ry="11" {...stroke} />
        <ellipse cx="76" cy="17" rx="16" ry="11" {...stroke} />
      </>
    ),
    aviator: (
      <>
        <path d="M8 8 H40 Q42 22 30 28 Q12 32 8 8 Z" {...stroke} />
        <path d="M92 8 H60 Q58 22 70 28 Q88 32 92 8 Z" {...stroke} />
      </>
    ),
    'cat-eye': (
      <>
        <path d="M6 6 Q22 2 40 12 Q38 28 22 28 Q6 26 6 6 Z" {...stroke} />
        <path d="M94 6 Q78 2 60 12 Q62 28 78 28 Q94 26 94 6 Z" {...stroke} />
      </>
    ),
    browline: (
      <>
        <path d="M6 8 H40" {...stroke} strokeWidth={6} />
        <path d="M60 8 H94" {...stroke} strokeWidth={6} />
        <path d="M8 8 Q8 26 24 26 Q38 26 38 8" {...stroke} />
        <path d="M92 8 Q92 26 76 26 Q62 26 62 8" {...stroke} />
      </>
    ),
    oversize: (
      <>
        <rect x="3" y="4" width="40" height="26" {...stroke} />
        <rect x="57" y="4" width="40" height="26" {...stroke} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 100 36" className="h-6 w-auto" aria-hidden>
      {lenses[shape]}
      {bridge}
    </svg>
  );
};

const FaceIcon: React.FC<{ face: string }> = ({ face }) => {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 3 };

  const outlines: Record<string, React.ReactNode> = {
    oval: <ellipse cx="60" cy="72" rx="34" ry="48" {...stroke} />,
    round: <ellipse cx="60" cy="74" rx="43" ry="45" {...stroke} />,
    square: (
      <path
        d="M22 40 Q22 28 34 28 H86 Q98 28 98 40 V92 Q98 114 60 120 Q22 114 22 92 Z"
        {...stroke}
      />
    ),
    oblong: <ellipse cx="60" cy="72" rx="27" ry="54" {...stroke} />,
    heart: (
      <path
        d="M60 120 Q28 98 23 64 Q20 30 44 27 Q56 25 60 32 Q64 25 76 27 Q100 30 97 64 Q92 98 60 120 Z"
        {...stroke}
      />
    ),
    diamond: (
      <path
        d="M60 22 Q88 42 97 72 Q88 102 60 122 Q32 102 23 72 Q32 42 60 22 Z"
        {...stroke}
      />
    ),
  };

  return (
    <svg viewBox="0 0 120 144" className="h-28 w-auto" aria-hidden>
      {outlines[face]}
      {/* Yeux au trait */}
      <line x1="44" y1="64" x2="54" y2="64" stroke="currentColor" strokeWidth="3" />
      <line x1="66" y1="64" x2="76" y2="64" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
};

// --- Les six visages --------------------------------------------------------

interface Visage {
  id: string;
  nom: string;
  epithete: string;
  texte: string;
  montures: { shape: IconShape; label: string }[];
  verdict: string;
}

const VISAGES: Visage[] = [
  {
    id: 'oval',
    nom: 'L\'Ovale',
    epithete: 'l\'insolent',
    texte: 'Longueur et largeur en proportion parfaite, pommettes en équilibre. Tout lui va — c\'est agaçant.',
    montures: [
      { shape: 'aviator', label: 'Aviateur' },
      { shape: 'browline', label: 'Browline' },
      { shape: 'rectangular', label: 'Rectangulaire' },
    ],
    verdict: 'Quand on peut tout se permettre, on choisit le panache : l\'aviateur.',
  },
  {
    id: 'round',
    nom: 'Le Rond',
    epithete: 'le tendre',
    texte: 'Joues pleines, courbes douces, à peine plus long que large. Il réclame de l\'angle, des lignes franches qui étirent et structurent.',
    montures: [
      { shape: 'rectangular', label: 'Rectangulaire' },
      { shape: 'square', label: 'Carrée' },
      { shape: 'browline', label: 'Browline' },
    ],
    verdict: 'La monture ronde sur visage rond ? 25 sur 100. On ne redouble pas une courbe.',
  },
  {
    id: 'square',
    nom: 'Le Carré',
    epithete: 'le magistrat',
    texte: 'Mâchoire affirmée, front droit, une autorité naturelle. On l\'adoucit par le cercle posé sur l\'angle.',
    montures: [
      { shape: 'round', label: 'Ronde' },
      { shape: 'oval', label: 'Ovale' },
      { shape: 'aviator', label: 'Aviateur' },
    ],
    verdict: 'Du Mondrian inversé — et ça fonctionne depuis toujours.',
  },
  {
    id: 'oblong',
    nom: 'L\'Allongé',
    epithete: 'l\'aristocrate',
    texte: 'Plus de longueur que de raison. Il lui faut de la matière en largeur et des verres hauts qui recomposent les proportions.',
    montures: [
      { shape: 'oversize', label: 'Oversize' },
      { shape: 'square', label: 'Carrée' },
      { shape: 'round', label: 'Ronde' },
    ],
    verdict: 'Notre atelier majore de 6 % la hauteur de ses verres. Le détail qu\'on ne voit pas mais qu\'on remarque.',
  },
  {
    id: 'heart',
    nom: 'Le Cœur',
    epithete: 'le romantique',
    texte: 'Front large, menton délicat. On équilibre par le bas — jamais de lourdeur aux tempes, tout est déjà dit en haut.',
    montures: [
      { shape: 'aviator', label: 'Aviateur' },
      { shape: 'oval', label: 'Ovale' },
      { shape: 'round', label: 'Ronde' },
    ],
    verdict: 'L\'aviateur, encore lui : sa goutte descend là où le visage s\'efface.',
  },
  {
    id: 'diamond',
    nom: 'Le Diamant',
    epithete: 'le mystérieux',
    texte: 'Pommettes souveraines, front et menton en retrait. Il faut prolonger la pommette au lieu de la concurrencer.',
    montures: [
      { shape: 'cat-eye', label: 'Œil-de-chat' },
      { shape: 'oval', label: 'Ovale' },
      { shape: 'browline', label: 'Browline' },
    ],
    verdict: 'L\'œil-de-chat est son triomphe.',
  },
];

// --- La page ----------------------------------------------------------------

const Manifeste: React.FC = () => {
  return (
    <div className="min-h-screen pt-28">
      <article className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Ouverture */}
        <header className="text-center border-b-[3px] border-ink pb-10 mb-10">
          <p className="kicker mb-6">Cahier Beauté &amp; Optique — Pages 42–47</p>
          <h1 className="font-serif font-black uppercase leading-[0.95] text-5xl sm:text-6xl md:text-7xl mb-6">
            La Géométrie<br />
            <span className="text-primary-600">Secrète</span> du Visage
          </h1>
          <p className="font-serif italic text-xl md:text-2xl text-secondary-800 max-w-3xl mx-auto">
            Ou comment une caméra, onze millimètres sept d'iris et quelques théorèmes
            bien parisiens trouvent la monture que votre miroir vous cachait.
          </p>
        </header>

        {/* Chapô + lettrine */}
        <div className="article-columns mb-16">
          <p className="drop-cap text-lg leading-relaxed mb-6">
            On a longtemps choisi ses lunettes comme on choisit un amant : à l'instinct,
            sous un mauvais éclairage, en écoutant une vendeuse pressée. C'est fini.
            Cette saison, la machine s'est mise au service du visage — et elle a des
            manières exquises.
          </p>
          <p className="text-lg leading-relaxed">
            Tout commence par une confidence que la nature nous fait à tous :
            l'iris humain mesure 11,7 millimètres de diamètre, chez la duchesse comme
            chez le coursier, à un souffle près. C'est le seul mètre-étalon que nous
            portons sur nous depuis la naissance. Notre technologie le sait — elle
            repère les quatre cent soixante-dix-huit points de votre visage, isole les
            deux iris, et voilà la règle de trois la plus élégante de la décennie :
            le visage entier se convertit en millimètres vrais, comme chez le meilleur
            opticien du boulevard Saint-Germain, mais sans quitter son fauteuil.
          </p>
        </div>

        {/* Planche : l'iris étalon */}
        <figure className="paper-panel p-8 md:p-10 mb-16 text-center">
          <svg viewBox="0 0 370 120" className="mx-auto h-32 w-auto text-ink" aria-hidden>
            {/* Œil en amande */}
            <path d="M30 60 Q100 8 160 60 Q100 112 30 60 Z" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="95" cy="60" r="26" fill="none" stroke="#c23a1c" strokeWidth="3" />
            <circle cx="95" cy="60" r="10" fill="#221a14" />
            {/* Cotation */}
            <line x1="69" y1="100" x2="121" y2="100" stroke="#c23a1c" strokeWidth="2" />
            <line x1="69" y1="94" x2="69" y2="106" stroke="#c23a1c" strokeWidth="2" />
            <line x1="121" y1="94" x2="121" y2="106" stroke="#c23a1c" strokeWidth="2" />
            <text x="200" y="52" fontFamily="Courier Prime, monospace" fontSize="22" fill="#221a14" fontWeight="bold">11,7 mm</text>
            <text x="200" y="76" fontFamily="Archivo, sans-serif" fontSize="11" fill="#221a14" letterSpacing="2">L'ÉTALON UNIVERSEL</text>
          </svg>
          <figcaption className="kicker mt-4">
            Fig. 1 — Le diamètre de l'iris, constant chez l'humain, convertit les pixels en millimètres.
          </figcaption>
        </figure>

        {/* Les six visages */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-4 mb-10">
            <h2 className="uppercase">Les Six Visages de Paris</h2>
            <span className="kicker hidden sm:block">Planches I à VI</span>
          </div>

          <p className="text-lg leading-relaxed max-w-3xl mb-10">
            La machine range ensuite votre visage dans l'une des grandes familles que
            les visagistes se transmettent depuis toujours — et à chacune, elle applique
            la seule loi qui compte en la matière : <strong>le contraste</strong>. Une
            monture ne doit jamais répéter le visage ; elle doit lui répondre.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {VISAGES.map((v, i) => (
              <div key={v.id} className="card p-6 flex flex-col text-ink">
                <div className="flex items-start justify-between mb-4">
                  <span className="kicker">Planche {['I', 'II', 'III', 'IV', 'V', 'VI'][i]}</span>
                  <span className="font-display text-3xl text-primary-600">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="flex justify-center text-ink mb-4">
                  <FaceIcon face={v.id} />
                </div>
                <h3 className="text-2xl text-center mb-1">{v.nom}</h3>
                <p className="font-serif italic text-center text-secondary-700 mb-4">— {v.epithete} —</p>
                <p className="text-sm text-secondary-800 mb-5">{v.texte}</p>
                <div className="mt-auto border-t-2 border-ink pt-4">
                  <p className="kicker !tracking-[0.2em] mb-3">On lui conseille</p>
                  <div className="space-y-2">
                    {v.montures.map(m => (
                      <div key={m.label} className="flex items-center gap-3 text-primary-700">
                        <GlassesIcon shape={m.shape} />
                        <span className="text-xs font-bold uppercase tracking-wider">{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="font-serif italic text-sm text-secondary-700 mt-4">« {v.verdict} »</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* La note finale */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-4 mb-10">
            <h2 className="uppercase">La Note Finale</h2>
            <span className="kicker hidden sm:block">Composée comme un parfum</span>
          </div>

          <p className="text-lg leading-relaxed max-w-3xl mb-10">
            Car oui, mesdames, messieurs : chaque monture de nos pages reçoit désormais
            une note sur cent — et la maison est intraitable sur la composition.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="paper-panel p-8">
              <p className="font-display text-6xl text-primary-600 mb-2">50<span className="text-2xl">%</span></p>
              <h3 className="text-xl uppercase mb-3">L'Harmonie</h3>
              <p className="text-sm text-secondary-800">
                L'accord entre la forme de votre visage et celle de la monture, selon la
                matrice de contraste des planches ci-dessus. Le rond sur le rond est une
                faute de goût chiffrée.
              </p>
            </div>
            <div className="paper-panel p-8">
              <p className="font-display text-6xl text-primary-600 mb-2">30<span className="text-2xl">%</span></p>
              <h3 className="text-xl uppercase mb-3">L'Ajustement</h3>
              <p className="text-sm text-secondary-800">
                La face au millimètre de la largeur du visage, le pont à celle du nez, et
                la vieille arithmétique des opticiens : <span className="font-mono font-bold">calibre + pont = écart pupillaire</span>.
                Toute entorse chute en courbe de Gauss, sans pitié ni exception.
              </p>
            </div>
            <div className="paper-panel p-8">
              <p className="font-display text-6xl text-primary-600 mb-2">20<span className="text-2xl">%</span></p>
              <h3 className="text-xl uppercase mb-3">La Carnation</h3>
              <p className="text-sm text-secondary-800">
                L'écaille et le bordeaux pour la porcelaine, l'or et le havane pour les
                peaux dorées, l'ivoire pour les carnations profondes. Le noir, lui, va à
                tout le monde : c'est Paris.
              </p>
            </div>
          </div>
        </section>

        {/* Citation */}
        <blockquote className="border-y-[3px] border-ink py-10 my-16 text-center">
          <p className="font-serif italic text-2xl md:text-3xl max-w-3xl mx-auto">
            « Le miroir flatte, la caméra compte. Entre les deux,
            choisissez celle qui vous veut du bien. »
          </p>
        </blockquote>

        {/* Clôture / CTA */}
        <section className="paper-panel bg-ink text-cream p-10 md:p-14 text-center relative overflow-hidden">
          <div aria-hidden className="absolute top-6 right-8 w-12 h-12 bg-accent-400 border-2 border-cream rotate-12" />
          <p className="kicker !text-accent-400 mb-4">Et pour les inconsolables</p>
          <h2 className="!text-cream uppercase mb-6">L'Atelier vous attend</h2>
          <p className="text-secondary-200 max-w-2xl mx-auto mb-8">
            Si aucune monture du numéro n'atteint la note que vous méritez, la vôtre
            sera dessinée en trois dimensions, sous vos yeux — calibre calculé sur votre
            écart pupillaire, gravure rituelle sur la branche. Elle n'existera qu'en un
            exemplaire : le vôtre.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/try-on" className="btn btn-primary text-sm">
              Passer devant l'objectif
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link to="/atelier" className="btn btn-accent text-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Entrer dans l'atelier
            </Link>
          </div>
        </section>

        {/* Pied de page d'article */}
        <footer className="flex justify-between items-center mt-12 pt-4 border-t border-ink">
          <span className="kicker">LuxOptic — N° 01</span>
          <span className="font-mono text-sm">page 47</span>
        </footer>
      </article>
    </div>
  );
};

export default Manifeste;
