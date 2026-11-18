import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="max-w-6xl mx-auto px-5 py-10 grid gap-8 md:grid-cols-[1fr_auto] text-sm text-graphite">
        <div className="max-w-md">
          <p className="wide font-extrabold text-ink text-lg">LuxOptic</p>
          <p className="mt-2">
            Les montures sont rendues en 3D à partir de leurs cotes. Les marques citées appartiennent à leurs propriétaires ;
            LuxOptic n’est affilié à aucune d’entre elles.
          </p>
        </div>
        <nav className="flex gap-6 md:flex-col md:gap-2">
          <Link to="/montures" className="hover:text-ink">Montures</Link>
          <Link to="/analyse" className="hover:text-ink">Analyse du visage</Link>
          <Link to="/essayer" className="hover:text-ink">Essayer</Link>
        </nav>
      </div>
    </footer>
  );
}
