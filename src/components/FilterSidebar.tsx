import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { GlassesFilters } from '../types/glasses';
import { filterOptions } from '../data/mockData';

interface FilterSidebarProps {
  filters: GlassesFilters;
  setFilters: React.Dispatch<React.SetStateAction<GlassesFilters>>;
  isOpen: boolean;
  toggleSidebar: () => void;
}

const FilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-b border-secondary-200 py-4">
      <button
        className="flex items-center justify-between w-full text-left font-medium text-secondary-900"
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-secondary-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-secondary-500" />
        )}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
};

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  setFilters,
  isOpen,
  toggleSidebar
}) => {
  const handleCheckboxChange = (
    category: keyof Omit<GlassesFilters, 'priceRange'>,
    value: string
  ) => {
    setFilters(prev => {
      const currentFilters = prev[category] as string[];
      if (currentFilters.includes(value)) {
        return {
          ...prev,
          [category]: currentFilters.filter(item => item !== value)
        };
      } else {
        return {
          ...prev,
          [category]: [...currentFilters, value]
        };
      }
    });
  };

  const handlePriceRangeChange = (min: number, max: number) => {
    setFilters(prev => ({
      ...prev,
      priceRange: [min, max]
    }));
  };

  const resetFilters = () => {
    setFilters({
      brand: [],
      style: [],
      color: [],
      gender: [],
      priceRange: [filterOptions.priceRange.min, filterOptions.priceRange.max],
      magazine: [],
      materials: []
    });
  };

  return (
    <aside
      className={`${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed left-0 top-0 bottom-0 w-72 bg-white z-40 shadow-xl overflow-y-auto transition-transform duration-300 ease-in-out pt-20 lg:translate-x-0 lg:static lg:pt-0 lg:shadow-none lg:h-auto`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium">Filtres</h3>
          <button
            className="text-primary-600 text-sm hover:text-primary-800 transition-colors"
            onClick={resetFilters}
          >
            Réinitialiser
          </button>
        </div>

        <FilterSection title="Prix">
          <div className="px-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-secondary-600">
                {filters.priceRange[0]} €
              </span>
              <span className="text-sm text-secondary-600">
                {filters.priceRange[1]} €
              </span>
            </div>
            <input
              type="range"
              min={filterOptions.priceRange.min}
              max={filterOptions.priceRange.max}
              value={filters.priceRange[0]}
              onChange={e =>
                handlePriceRangeChange(
                  parseInt(e.target.value),
                  filters.priceRange[1]
                )
              }
              className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="range"
              min={filterOptions.priceRange.min}
              max={filterOptions.priceRange.max}
              value={filters.priceRange[1]}
              onChange={e =>
                handlePriceRangeChange(
                  filters.priceRange[0],
                  parseInt(e.target.value)
                )
              }
              className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </FilterSection>

        <FilterSection title="Marque">
          <div className="space-y-2">
            {filterOptions.brands.map(brand => (
              <div key={brand} className="flex items-center">
                <input
                  type="checkbox"
                  id={`brand-${brand}`}
                  checked={filters.brand.includes(brand)}
                  onChange={() => handleCheckboxChange('brand', brand)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <label
                  htmlFor={`brand-${brand}`}
                  className="ml-2 text-sm text-secondary-700"
                >
                  {brand}
                </label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Style">
          <div className="space-y-2">
            {filterOptions.styles.map(style => (
              <div key={style} className="flex items-center">
                <input
                  type="checkbox"
                  id={`style-${style}`}
                  checked={filters.style.includes(style)}
                  onChange={() => handleCheckboxChange('style', style)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <label
                  htmlFor={`style-${style}`}
                  className="ml-2 text-sm text-secondary-700"
                >
                  {style}
                </label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Couleur">
          <div className="space-y-2">
            {filterOptions.colors.map(color => (
              <div key={color} className="flex items-center">
                <input
                  type="checkbox"
                  id={`color-${color}`}
                  checked={filters.color.includes(color)}
                  onChange={() => handleCheckboxChange('color', color)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <label
                  htmlFor={`color-${color}`}
                  className="ml-2 text-sm text-secondary-700"
                >
                  {color}
                </label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Genre">
          <div className="space-y-2">
            {filterOptions.genders.map(gender => (
              <div key={gender} className="flex items-center">
                <input
                  type="checkbox"
                  id={`gender-${gender}`}
                  checked={filters.gender.includes(gender)}
                  onChange={() => handleCheckboxChange('gender', gender)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <label
                  htmlFor={`gender-${gender}`}
                  className="ml-2 text-sm text-secondary-700"
                >
                  {gender === 'men' ? 'Homme' : gender === 'women' ? 'Femme' : 'Unisexe'}
                </label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Matériau">
          <div className="space-y-2">
            {filterOptions.materials.map(material => (
              <div key={material} className="flex items-center">
                <input
                  type="checkbox"
                  id={`material-${material}`}
                  checked={filters.materials.includes(material)}
                  onChange={() => handleCheckboxChange('materials', material)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <label
                  htmlFor={`material-${material}`}
                  className="ml-2 text-sm text-secondary-700"
                >
                  {material}
                </label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Magazine">
          <div className="space-y-2">
            {filterOptions.magazines.map(magazine => (
              <div key={magazine} className="flex items-center">
                <input
                  type="checkbox"
                  id={`magazine-${magazine}`}
                  checked={filters.magazine.includes(magazine)}
                  onChange={() => handleCheckboxChange('magazine', magazine)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <label
                  htmlFor={`magazine-${magazine}`}
                  className="ml-2 text-sm text-secondary-700"
                >
                  {magazine}
                </label>
              </div>
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
};

export default FilterSidebar;