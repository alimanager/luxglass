export interface Magazine {
  id: number;
  name: string;
  issueDate: string;
  coverImage?: string;
}

export type FrameShape =
  | 'rectangular'
  | 'square'
  | 'round'
  | 'oval'
  | 'aviator'
  | 'cat-eye'
  | 'browline'
  | 'butterfly'
  | 'geometric'
  | 'oversize';

// Dimensions au système "boxing" utilisé par les opticiens (en millimètres).
// Exemple d'inscription sur une branche : 52 □ 18 145
export interface FrameDimensions {
  lensWidth: number;    // calibre (A)
  lensHeight: number;   // hauteur du verre (B)
  bridgeWidth: number;  // pont (DBL)
  templeLength: number; // longueur des branches
  totalWidth: number;   // largeur totale de la face
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
  frameShape: FrameShape;
  dimensions: FrameDimensions;
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

export type SkinTone = 'Fair' | 'Light' | 'Medium Light' | 'Medium' | 'Medium Dark' | 'Dark' | 'Deep';

export type FaceShape = 'oval' | 'round' | 'square' | 'oblong' | 'heart' | 'diamond';

// Profil morphologique issu de l'analyse du visage (mesures en millimètres)
export interface FaceProfile {
  faceShape: FaceShape | string;
  faceWidth: number;
  faceLength: number;
  interpupillaryDistance: number;
  noseBridgeWidth: number;
  skinTone: SkinTone;
}
