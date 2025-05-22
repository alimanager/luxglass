export interface Magazine {
  id: number;
  name: string;
  issueDate: string;
  coverImage?: string;
}

export interface Glasses {
  id: number;
  name: string;
  brand: string;
  price: number;
  description: string;
  color: string;
  style: string;
  material: string;
  gender: 'men' | 'women' | 'unisex';
  imageUrl: string;
  magazineFeatures: Magazine[];
  productUrl: string;
}

export type GlassesFilters = {
  brand: string[];
  style: string[];
  color: string[];
  gender: string[];
  priceRange: [number, number];
  magazine: string[];
  materials: string[];
}