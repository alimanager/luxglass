import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { glasses } from '../data/mockData';
import { Glasses } from '../types/glasses';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Glasses | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchProduct = async () => {
      setLoading(true);
      try {
        // Find the product from our mock data
        const foundProduct = glasses.find(g => g.id === Number(id));
        
        // Small delay to simulate network request
        setTimeout(() => {
          setProduct(foundProduct || null);
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching product:', error);
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pt-20 container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-serif mb-6">Produit non trouvé</h1>
        <p className="text-secondary-600 mb-8">
          Le produit que vous recherchez n'existe pas ou a été retiré.
        </p>
        <Link to="/catalog" className="btn btn-primary">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/catalog"
          className="inline-flex items-center text-primary-600 hover:text-primary-800 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au catalogue
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="relative">
            <img
              src={product.imageUrl}
              alt={`${product.brand} ${product.name}`}
              className="w-full h-auto object-cover rounded-lg shadow-md"
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              {product.magazineFeatures.map((magazine) => (
                <span 
                  key={magazine.id} 
                  className="magazine-tag bg-accent-100 text-accent-800"
                >
                  {magazine.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-primary-600 font-medium">{product.brand}</span>
            <h1 className="text-3xl font-serif font-medium mb-3">{product.name}</h1>
            <p className="text-2xl font-medium mb-6">{product.price} €</p>

            <div className="mb-8">
              <p className="text-secondary-700 mb-6">{product.description}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Caractéristiques</h3>
                  <ul className="space-y-2 text-secondary-700">
                    <li><span className="text-secondary-500">Style:</span> {product.style}</li>
                    <li><span className="text-secondary-500">Couleur:</span> {product.color}</li>
                    <li><span className="text-secondary-500">Matériau:</span> {product.material}</li>
                    <li>
                      <span className="text-secondary-500">Genre:</span> 
                      {product.gender === 'men' ? ' Homme' : product.gender === 'women' ? ' Femme' : ' Unisexe'}
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Vu dans</h3>
                  <ul className="space-y-2 text-secondary-700">
                    {product.magazineFeatures.map((magazine) => (
                      <li key={magazine.id}>
                        {magazine.name} ({magazine.issueDate})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full justify-center mb-4"
            >
              Voir sur le site officiel
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>

            <div className="mt-8 border-t border-secondary-200 pt-6">
              <h3 className="font-medium mb-4">Dans les magazines</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {product.magazineFeatures.map((magazine) => (
                  <div key={magazine.id} className="group relative">
                    {magazine.coverImage && (
                      <div className="overflow-hidden rounded-lg shadow-sm">
                        <img
                          src={magazine.coverImage}
                          alt={`${magazine.name} cover`}
                          className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="font-medium text-sm">{magazine.name}</p>
                      <p className="text-xs text-secondary-500">{magazine.issueDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-serif font-medium mb-6">Lunettes similaires</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {glasses
              .filter(g => g.id !== product.id && (g.brand === product.brand || g.style === product.style))
              .slice(0, 4)
              .map(glass => (
                <Link to={`/product/${glass.id}`} key={glass.id} className="card group">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={glass.imageUrl}
                      alt={`${glass.brand} ${glass.name}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    {glass.magazineFeatures.length > 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="magazine-tag bg-accent-100 text-accent-800">
                          {glass.magazineFeatures[0].name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <span className="text-xs text-secondary-600">{glass.brand}</span>
                    <h3 className="text-sm font-medium truncate">{glass.name}</h3>
                    <p className="text-primary-600 font-medium">{glass.price} €</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;