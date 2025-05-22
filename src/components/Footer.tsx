import React from 'react';
import { Link } from 'react-router-dom';
import { Glasses, Instagram, Facebook, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-secondary-950 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <Glasses className="h-6 w-6 text-primary-500" />
              <span className="ml-2 text-xl font-serif">LuxOptic</span>
            </div>
            <p className="text-secondary-300 mb-4">
              Découvrez les meilleures lunettes du marché français, triées et filtrées pour votre confort.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Liens Rapides</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link to="/catalog" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  Catalogue
                </Link>
              </li>
              <li>
                <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  À Propos
                </a>
              </li>
              <li>
                <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Magazines</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  Vogue
                </a>
              </li>
              <li>
                <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  Elle
                </a>
              </li>
              <li>
                <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  GQ
                </a>
              </li>
              <li>
                <a href="#" className="text-secondary-300 hover:text-primary-500 transition-colors">
                  Marie Claire
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Newsletter</h3>
            <p className="text-secondary-300 mb-4">
              Abonnez-vous pour recevoir les dernières tendances et nouveautés.
            </p>
            <form className="space-y-2">
              <input
                type="email"
                placeholder="Votre email"
                className="w-full px-4 py-2 bg-secondary-800 rounded-lg text-white placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="w-full btn btn-primary"
              >
                S'abonner
              </button>
            </form>
          </div>
        </div>
        
        <div className="mt-12 pt-6 border-t border-secondary-800 text-center">
          <p className="text-secondary-400 text-sm">
            &copy; {new Date().getFullYear()} LuxOptic. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;