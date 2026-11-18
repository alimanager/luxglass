import { glasses } from '../data/mockData';
import type { Glasses } from '../types/glasses';
import { frameWidth, sizeMarking, specForGlasses, type FrameSpec } from '../three/frameSpec';

export interface Product extends Glasses {
  spec: FrameSpec;
  marking: string;
  /** total frame width in mm */
  width: number;
  size: 'S' | 'M' | 'L';
}

export const products: Product[] = glasses.map((g) => {
  const spec = specForGlasses(g);
  const width = Math.round(frameWidth(spec));
  return { ...g, spec, marking: sizeMarking(spec), width, size: width < 132 ? 'S' : width > 142 ? 'L' : 'M' };
});

export const productById = (id: number | string) => products.find((p) => String(p.id) === String(id));

export const STYLES = Array.from(new Set(products.map((p) => p.style)));
