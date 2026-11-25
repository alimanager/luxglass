import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV = [
  { to: '/formes', label: 'Formes' },
  { to: '/montures', label: 'Montures' },
  { to: '/analyse', label: 'Analyse du visage' },
  { to: '/essayer', label: 'Essayer' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const dark = pathname.startsWith('/essayer');

  return (
    <header className={`sticky top-0 z-40 h-16 border-b ${dark ? 'bg-ink text-paper border-white/10' : 'bg-paper/95 backdrop-blur border-rule'}`}>
      <div className="max-w-6xl mx-auto h-full px-5 flex items-center justify-between">
        <Link to="/" className="wide font-extrabold text-[19px] tracking-tight">
          LuxOptic
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[15px]">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `py-1 border-b-2 transition-colors ${isActive ? 'border-shell' : 'border-transparent opacity-75 hover:opacity-100'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button className="md:hidden -mr-2 p-2" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden absolute inset-x-0 top-16 bg-paper text-ink border-b border-rule shadow-sm animate-fade-in">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="block px-5 py-4 text-lg border-t border-rule first:border-t-0">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
