import React from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Glasses } from '../types/glasses';

interface ProductCardProps {
  product: Glasses;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { id, name, brand, price, imageUrl, magazineFeatures } = product;
  
  return (
    <div className="card group h-full flex flex-col">
      <div className="relative h-64 overflow-hidden">
        <img
          src={imageUrl}
          alt={`${brand} ${name}`}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {magazineFeatures.slice(0, 2).map((magazine) => (
            <span 
              key={magazine.id} 
              className="magazine-tag bg-accent-100 text-accent-800"
            >
              {magazine.name}
            </span>
          ))}
          {magazineFeatures.length > 2 && (
            <span className="magazine-tag bg-secondary-100 text-secondary-800">
              +{magazineFeatures.length - 2}
            </span>
          )}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-2">
          <span className="text-sm text-secondary-600">{brand}</span>
          <h3 className="text-lg font-medium">{name}</h3>
        </div>
        <div className="mt-auto pt-4 flex justify-between items-center">
          <span className="font-medium text-lg">{price} €</span>
          <Link 
            to={`/product/${id}`}
            className="btn btn-primary flex items-center"
          >
            <Eye className="mr-2 h-4 w-4" />
            Voir
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;