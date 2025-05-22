import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Search, X, Grid, List } from 'lucide-react';
import FilterSidebar from '../components/FilterSidebar';
import ProductCard from '../components/ProductCard';
import { glasses, filterOptions } from '../data/mockData';
import { Glasses, GlassesFilters } from '../types/glasses';

const Catalog: React.FC = () => {
  const [filteredGlasses, setFilteredGlasses] = useState<Glasses[]>(glasses);
  const [filters, setFilters] = useState<GlassesFilters>({
    brand: [],
    style: [],
    color: [],
    gender: [],
    priceRange: [filterOptions.priceRange.min, filterOptions.priceRange.max],
    magazine: [],
    materials: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let result = glasses;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        glass =>
          glass.name.toLowerCase().includes(query) ||
          glass.brand.toLowerCase().includes(query) ||
          glass.description.toLowerCase().includes(query)
      );
    }

    // Filter by brands
    if (filters.brand.length > 0) {
      result = result.filter(glass => filters.brand.includes(glass.brand));
    }

    // Filter by styles
    if (filters.style.length > 0) {
      result = result.filter(glass => filters.style.includes(glass.style));
    }

    // Filter by colors
    if (filters.color.length > 0) {
      result = result.filter(glass => filters.color.includes(glass.color));
    }

    // Filter by gender
    if (filters.gender.length > 0) {
      result = result.filter(glass => filters.gender.includes(glass.gender));
    }

    // Filter by materials
    if (filters.materials.length > 0) {
      result = result.filter(glass => filters.materials.includes(glass.material));
    }

    // Filter by magazines
    if (filters.magazine.length > 0) {
      result = result.filter(glass =>
        glass.magazineFeatures.some(mag => filters.magazine.includes(mag.name))
      );
    }

    // Filter by price range
    result = result.filter(
      glass =>
        glass.price >= filters.priceRange[0] &&
        glass.price <= filters.priceRange[1]
    );

    setFilteredGlasses(result);
  }, [filters, searchQuery]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="bg-secondary-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-serif mb-4">
            Catalogue de Lunettes
          </h1>
          <p className="max-w-2xl mx-auto text-secondary-200">
            Découvrez notre sélection de lunettes françaises issues des plus grands magazines de mode
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar for filters */}
          <FilterSidebar
            filters={filters}
            setFilters={setFilters}
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
          />

          {/* Main content */}
          <div className="flex-1">
            <div className="sticky top-16 bg-white z-30 pt-4 pb-4">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Rechercher des lunettes..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-10 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-secondary-400" />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-2.5"
                    >
                      <X className="h-5 w-5 text-secondary-400 hover:text-secondary-700" />
                    </button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={toggleSidebar}
                    className="lg:hidden btn btn-secondary"
                  >
                    <SlidersHorizontal className="h-5 w-5 mr-2" />
                    Filtres
                  </button>
                  <button
                    onClick={toggleViewMode}
                    className="btn btn-secondary"
                    aria-label={
                      viewMode === 'grid' ? 'Afficher en liste' : 'Afficher en grille'
                    }
                  >
                    {viewMode === 'grid' ? (
                      <List className="h-5 w-5" />
                    ) : (
                      <Grid className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {filters.brand.length > 0 &&
                  filters.brand.map(brand => (
                    <div
                      key={`tag-brand-${brand}`}
                      className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {brand}
                      <button
                        onClick={() =>
                          setFilters(prev => ({
                            ...prev,
                            brand: prev.brand.filter(b => b !== brand)
                          }))
                        }
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                {filters.style.length > 0 &&
                  filters.style.map(style => (
                    <div
                      key={`tag-style-${style}`}
                      className="bg-secondary-100 text-secondary-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {style}
                      <button
                        onClick={() =>
                          setFilters(prev => ({
                            ...prev,
                            style: prev.style.filter(s => s !== style)
                          }))
                        }
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                {filters.color.length > 0 &&
                  filters.color.map(color => (
                    <div
                      key={`tag-color-${color}`}
                      className="bg-accent-100 text-accent-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {color}
                      <button
                        onClick={() =>
                          setFilters(prev => ({
                            ...prev,
                            color: prev.color.filter(c => c !== color)
                          }))
                        }
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>

              <div className="flex justify-between items-center">
                <p className="text-secondary-600">
                  {filteredGlasses.length} résultat{filteredGlasses.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {filteredGlasses.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl text-secondary-600 mb-4">
                  Aucun résultat ne correspond à vos critères
                </p>
                <button
                  onClick={() => {
                    setFilters({
                      brand: [],
                      style: [],
                      color: [],
                      gender: [],
                      priceRange: [
                        filterOptions.priceRange.min,
                        filterOptions.priceRange.max
                      ],
                      magazine: [],
                      materials: []
                    });
                    setSearchQuery('');
                  }}
                  className="btn btn-primary"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-6'
                }
              >
                {filteredGlasses.map(glass => (
                  <ProductCard key={glass.id} product={glass} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Catalog;