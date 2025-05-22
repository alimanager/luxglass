import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, Glasses } from 'lucide-react';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || location.pathname !== '/' 
          ? 'bg-white shadow-md py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Glasses className={`h-8 w-8 ${scrolled || location.pathname !== '/' ? 'text-primary-600' : 'text-white'}`} />
            <span className={`ml-2 text-xl font-serif font-medium ${scrolled || location.pathname !== '/' ? 'text-secondary-950' : 'text-white'}`}>
              LuxOptic
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className={`font-medium hover:text-primary-600 transition-colors ${
              scrolled || location.pathname !== '/' ? 'text-secondary-900' : 'text-white'
            } ${location.pathname === '/' ? 'border-b-2 border-primary-500' : ''}`}>
              Accueil
            </Link>
            <Link to="/catalog" className={`font-medium hover:text-primary-600 transition-colors ${
              scrolled || location.pathname !== '/' ? 'text-secondary-900' : 'text-white'
            } ${location.pathname === '/catalog' ? 'border-b-2 border-primary-500' : ''}`}>
              Catalogue
            </Link>
            <Link to="/try-on" className={`font-medium hover:text-primary-600 transition-colors ${
              scrolled || location.pathname !== '/' ? 'text-secondary-900' : 'text-white'
            } ${location.pathname === '/try-on' ? 'border-b-2 border-primary-500' : ''}`}>
              Essayage Virtuel
            </Link>
            <button className={`flex items-center hover:text-primary-600 transition-colors ${
              scrolled || location.pathname !== '/' ? 'text-secondary-900' : 'text-white'
            }`}>
              <Search className="h-5 w-5" />
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className={`h-6 w-6 ${scrolled || location.pathname !== '/' ? 'text-secondary-900' : 'text-white'}`} />
            ) : (
              <Menu className={`h-6 w-6 ${scrolled || location.pathname !== '/' ? 'text-secondary-900' : 'text-white'}`} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 animate-slide-down">
            <nav className="flex flex-col space-y-4">
              <Link 
                to="/" 
                className="font-medium text-secondary-900 hover:text-primary-600 transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Accueil
              </Link>
              <Link 
                to="/catalog" 
                className="font-medium text-secondary-900 hover:text-primary-600 transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Catalogue
              </Link>
              <Link 
                to="/try-on" 
                className="font-medium text-secondary-900 hover:text-primary-600 transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Essayage Virtuel
              </Link>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full py-2 pl-10 pr-4 bg-secondary-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-secondary-400" />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;