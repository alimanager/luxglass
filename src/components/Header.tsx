import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Glasses } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Accueil' },
  { to: '/catalog', label: 'Catalogue' },
  { to: '/try-on', label: 'L\'Analyse' },
  { to: '/atelier', label: 'L\'Atelier' },
  { to: '/miroir', label: 'Le Miroir' },
  { to: '/manifeste', label: 'Le Manifeste' },
];

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Bandeau d'édition */}
      <div className="bg-ink text-cream text-[10px] uppercase tracking-[0.35em] text-center py-1.5 px-4">
        Le magazine des lunettes · Paris · N° 01 · Été 1984 · 24 F
      </div>

      {/* Manchette */}
      <div className="bg-paper border-b-[3px] border-ink">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-2.5">
            <Link to="/" className="flex items-center">
              <Glasses className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-2xl font-serif font-black text-ink tracking-tight">
                LuxOptic
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] px-2 py-1.5 transition-colors ${
                    location.pathname === item.to
                      ? 'bg-ink text-cream'
                      : 'text-ink hover:bg-accent-200'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 border-2 border-ink bg-cream shadow-hard-sm"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 text-ink" />
              ) : (
                <Menu className="h-5 w-5 text-ink" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden pb-4 animate-slide-down">
              <nav className="flex flex-col divide-y-2 divide-ink border-2 border-ink bg-cream shadow-hard">
                {NAV_ITEMS.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`text-xs font-bold uppercase tracking-[0.2em] px-4 py-3 ${
                      location.pathname === item.to
                        ? 'bg-ink text-cream'
                        : 'text-ink hover:bg-accent-200'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
