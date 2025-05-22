import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Filter, Tag, Eye } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative h-screen">
        <div className="absolute inset-0 bg-gradient-to-r from-secondary-950/90 to-secondary-900/70 z-10"></div>
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.pexels.com/photos/701877/pexels-photo-701877.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')" }}
        ></div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-center items-start z-20 pt-16">
          <h1 className="text-white mb-4 max-w-2xl animate-fade-in">
            Découvrez les Meilleures Lunettes du Marché Français
          </h1>
          <p className="text-white/90 text-xl mb-8 max-w-xl animate-slide-up">
            Un catalogue complet et curé des plus belles montures présentées dans les magazines de mode français.
          </p>
          <Link
            to="/catalog"
            className="btn btn-primary text-base animate-slide-up"
          >
            Explorer le Catalogue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="mb-4">Pourquoi Choisir LuxOptic</h2>
            <p className="text-secondary-600 max-w-2xl mx-auto">
              Nous vous offrons une expérience unique pour découvrir et comparer les lunettes du marché français.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="bg-primary-100 p-3 rounded-full w-fit mb-6">
                <Filter className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl mb-3">Filtres Avancés</h3>
              <p className="text-secondary-600">
                Trouvez facilement les lunettes qui correspondent exactement à vos critères grâce à nos filtres détaillés.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="bg-primary-100 p-3 rounded-full w-fit mb-6">
                <Tag className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl mb-3">Sources Magazine</h3>
              <p className="text-secondary-600">
                Découvrez dans quels magazines chaque paire de lunettes a été présentée et mise en valeur.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="bg-primary-100 p-3 rounded-full w-fit mb-6">
                <Eye className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl mb-3">Design Élégant</h3>
              <p className="text-secondary-600">
                Profitez d'une interface soignée et intuitive pour une expérience utilisateur agréable et efficace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div>
              <h2 className="mb-2">Lunettes Tendance</h2>
              <p className="text-secondary-600">
                Découvrez les montures les plus populaires du moment
              </p>
            </div>
            <Link to="/catalog" className="btn btn-secondary mt-4 md:mt-0">
              Voir tout le catalogue
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((item) => (
              <Link to={`/product/${item}`} key={item} className="card group">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={`https://images.pexels.com/photos/70365${item}/pexels-photo-70365${item}.jpeg?auto=compress&cs=tinysrgb&w=800`}
                    alt="Glasses preview"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4">
                    <span className="magazine-tag bg-accent-100 text-accent-800">
                      Vogue
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium">Ray-Ban Wayfarer</h3>
                  <p className="text-secondary-600 mb-3">Classique Intemporel</p>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-lg">149 €</span>
                    <span className="text-sm text-primary-600 group-hover:text-primary-800 transition-colors">
                      Voir le détail
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-secondary-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-6">Prêt à Découvrir Votre Prochaine Paire ?</h2>
          <p className="text-secondary-300 max-w-2xl mx-auto mb-8">
            Explorez notre catalogue complet et trouvez la monture parfaite qui correspond à votre style et à vos besoins.
          </p>
          <Link to="/catalog" className="btn btn-accent text-base">
            Explorer le Catalogue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;