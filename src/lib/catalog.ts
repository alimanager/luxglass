import { glasses } from '../data/mockData';
import type { Glasses } from '../types/glasses';
import { frameWidth, sizeMarking, specForGlasses, type FrameSpec } from '../three/frameSpec';
import type { FrameModel } from '../three/loadModel';
import fluxData from '../data/flux.json';
import fluxDemo from '../data/flux-demo.json';
import { sortOffres, total, type FluxData, type Offre } from './flux';

export interface Product extends Glasses {
  spec: FrameSpec;
  /** real 3D model (glTF/GLB) shown instead of the parametric frame */
  model?: FrameModel;
  /** demo item, not for sale */
  demo?: boolean;
  /** merchant photo (feed products): shown instead of a 3D render, used as the AI reference */
  photo?: string;
  /** merchant offers from the affiliate feeds, cheapest first */
  offres?: Offre[];
  marking: string;
  /** total frame width in mm */
  width: number;
  size: 'S' | 'M' | 'L';
}

const sizeOf = (width: number): Product['size'] => (width < 132 ? 'S' : width > 142 ? 'L' : 'M');

const parametric: Product[] = glasses.map((g) => {
  const spec = specForGlasses(g);
  const width = Math.round(frameWidth(spec));
  return { ...g, spec, marking: sizeMarking(spec), width, size: sizeOf(width) };
});

/**
 * Real 3D models (glTF/GLB). Drop a file in public/frames/ and add an entry:
 * the loader orients it, scales it to `widthMm` and seats it on the nose.
 */
const MODELS: (Omit<Product, 'spec' | 'marking' | 'width' | 'size'> & { lens: [number, number, number] })[] = [
  {
    id: 101,
    name: 'Glasses',
    brand: 'Modèle 3D d’AlbertVictory',
    price: 0,
    demo: true,
    description:
      'Monture optique en acétate noir et métal, modélisée en 3D par AlbertVictory et publiée sur Sketchfab sous licence CC BY 4.0. Modèle de démonstration, non vendu.',
    color: 'Noir',
    style: 'Rectangulaire',
    material: 'Acétate et métal',
    gender: 'unisex',
    imageUrl: '',
    magazineFeatures: [],
    productUrl: 'https://sketchfab.com/3d-models/glasses-4b8a1e54f3084c63828fe8c324198aec',
    lens: [52, 18, 145],
    model: {
      url: '/frames/albertvictory-glasses.glb',
      widthMm: 136,
      credit: {
        author: 'AlbertVictory',
        source: 'https://sketchfab.com/3d-models/glasses-4b8a1e54f3084c63828fe8c324198aec',
        license: 'CC BY 4.0',
      },
    },
  },
];

const real: Product[] = MODELS.map(({ lens, ...m }) => {
  const spec = specForGlasses(m);
  spec.lens = { ...spec.lens, w: lens[0] };
  spec.bridge = lens[1];
  spec.temple = lens[2];
  const width = m.model!.widthMm;
  return { ...m, spec, marking: sizeMarking(spec), width, size: sizeOf(width) };
});

/**
 * Products from the affiliate feeds (npm run flux). In development, a fictional demo feed
 * is used when the real one is empty, so the price comparison can be tried out; it never
 * reaches the production site.
 */
const feed: FluxData = (fluxData as FluxData).produits.length ? (fluxData as FluxData) : import.meta.env.DEV ? (fluxDemo as FluxData) : (fluxData as FluxData);

const fromFeed: Product[] = feed.produits.map((f) => {
  const spec = specForGlasses({ style: f.style, color: f.couleur, material: '' });
  if (f.cotes) {
    spec.lens = { ...spec.lens, w: f.cotes[0] };
    spec.bridge = f.cotes[1];
    spec.temple = f.cotes[2];
  }
  const width = Math.round(frameWidth(spec));
  const offres = sortOffres(f.offres);
  return {
    id: f.id,
    name: f.nom,
    brand: f.marque || offres[0]?.marchand || '',
    price: Math.round(total(offres[0]) * 100) / 100,
    description: '',
    color: f.couleur,
    style: f.style,
    material: '',
    gender: 'unisex',
    imageUrl: f.image,
    magazineFeatures: [],
    productUrl: offres[0]?.url ?? '',
    spec,
    marking: f.cotes ? sizeMarking(spec) : '',
    width,
    size: sizeOf(width),
    photo: f.image,
    offres,
  };
});

// real models first: they are the most faithful; then merchant products
export const products: Product[] = [...real, ...fromFeed, ...parametric];

/** Product image used as the AI reference: merchant photo, else our own front render. */
export const referenceImage = (p: Pick<Product, 'id' | 'photo'>) => p.photo ?? `/references/${p.id}.jpg`;

export const priceLabel = (p: Pick<Product, 'price' | 'demo' | 'offres'>) =>
  p.demo
    ? 'Démo'
    : p.offres?.length
    ? `dès ${p.price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`
    : `${p.price} €`;

export const productById = (id: number | string) => products.find((p) => String(p.id) === String(id));

export const STYLES = Array.from(new Set(products.map((p) => p.style)));
