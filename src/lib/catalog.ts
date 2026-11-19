import { glasses } from '../data/mockData';
import type { Glasses } from '../types/glasses';
import { frameWidth, sizeMarking, specForGlasses, type FrameSpec } from '../three/frameSpec';
import type { FrameModel } from '../three/loadModel';

export interface Product extends Glasses {
  spec: FrameSpec;
  /** real 3D model (glTF/GLB) shown instead of the parametric frame */
  model?: FrameModel;
  /** demo item, not for sale */
  demo?: boolean;
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

// real models first: they are the most faithful
export const products: Product[] = [...real, ...parametric];

export const priceLabel = (p: Pick<Product, 'price' | 'demo'>) => (p.demo ? 'Démo' : `${p.price} €`);

export const productById = (id: number | string) => products.find((p) => String(p.id) === String(id));

export const STYLES = Array.from(new Set(products.map((p) => p.style)));
