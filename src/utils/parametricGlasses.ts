import * as THREE from 'three';
import { FaceProfile, SkinTone } from '../types/glasses';

// Formes disponibles dans l'Atelier (générées procéduralement)
export type AtelierShape = 'oval' | 'round' | 'rectangular' | 'aviator' | 'cat-eye';

export interface AtelierColor {
  name: string;
  hex: string;
  finish: 'acetate' | 'metal';
}

export interface CustomFrameSpec {
  shape: AtelierShape;
  lensWidth: number;    // calibre A (mm)
  lensHeight: number;   // hauteur B (mm)
  bridgeWidth: number;  // pont DBL (mm)
  templeLength: number; // branches (mm)
  totalWidth: number;   // largeur totale de la face (mm)
  color: AtelierColor;
  sunLenses: boolean;
}

export const ATELIER_SHAPE_LABELS: Record<AtelierShape, string> = {
  oval: 'Ovale',
  round: 'Ronde',
  rectangular: 'Rectangulaire',
  aviator: 'Aviateur',
  'cat-eye': 'Œil-de-chat'
};

export const ATELIER_COLORS: AtelierColor[] = [
  { name: 'Noir Profond', hex: '#1c1c1e', finish: 'acetate' },
  { name: 'Écaille', hex: '#7a4a1f', finish: 'acetate' },
  { name: 'Havane', hex: '#9c6b30', finish: 'acetate' },
  { name: 'Bordeaux', hex: '#5e1a2f', finish: 'acetate' },
  { name: 'Bleu Nuit', hex: '#1d2b4f', finish: 'acetate' },
  { name: 'Vert Forêt', hex: '#1f3d2b', finish: 'acetate' },
  { name: 'Ivoire', hex: '#e8e0cf', finish: 'acetate' },
  { name: 'Or', hex: '#c9a227', finish: 'metal' },
  { name: 'Argent', hex: '#b8bcc2', finish: 'metal' },
  { name: 'Gunmetal', hex: '#4a4f56', finish: 'metal' }
];

// Forme conseillée par morphologie : on recherche le contraste avec les
// lignes naturelles du visage.
const RECOMMENDED_SHAPE: Record<string, AtelierShape> = {
  oval: 'aviator',
  round: 'rectangular',
  square: 'oval',
  oblong: 'aviator',
  heart: 'aviator',
  diamond: 'cat-eye'
};

// Couleurs conseillées par teint de peau
const RECOMMENDED_COLORS: Record<SkinTone, string[]> = {
  'Fair': ['Écaille', 'Bordeaux', 'Bleu Nuit'],
  'Light': ['Écaille', 'Havane', 'Bordeaux'],
  'Medium Light': ['Havane', 'Vert Forêt', 'Or'],
  'Medium': ['Or', 'Havane', 'Écaille'],
  'Medium Dark': ['Or', 'Ivoire', 'Écaille'],
  'Dark': ['Or', 'Ivoire', 'Bleu Nuit'],
  'Deep': ['Or', 'Ivoire', 'Bordeaux']
};

// Rapport hauteur/largeur du verre selon la forme
const LENS_RATIO: Record<AtelierShape, number> = {
  oval: 0.82,
  round: 0.95,
  rectangular: 0.7,
  aviator: 0.88,
  'cat-eye': 0.72
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function recommendedShapeFor(faceShape: string): AtelierShape {
  return RECOMMENDED_SHAPE[faceShape] ?? 'aviator';
}

export function recommendedColorsFor(skinTone: SkinTone): string[] {
  return RECOMMENDED_COLORS[skinTone] ?? RECOMMENDED_COLORS['Medium'];
}

// Calcule les cotes d'une monture sur mesure depuis les mesures du visage,
// selon le système "boxing" : distance entre centres optiques = A + DBL,
// que l'on fait coïncider avec l'écart pupillaire.
export function deriveFrameSpec(profile: FaceProfile, shape?: AtelierShape): CustomFrameSpec {
  const resolvedShape = shape ?? recommendedShapeFor(profile.faceShape);

  const bridgeWidth = Math.round(clamp(profile.noseBridgeWidth, 14, 24));
  const lensWidth = Math.round(clamp(profile.interpupillaryDistance - bridgeWidth, 44, 58));

  // Visage allongé : on augmente légèrement la hauteur des verres pour équilibrer
  const faceRatio = profile.faceLength / profile.faceWidth;
  const heightBoost = faceRatio > 1.3 ? 1.06 : 1;
  const lensHeight = Math.round(lensWidth * LENS_RATIO[resolvedShape] * heightBoost);

  // Longueur de branche standard la plus proche de la profondeur estimée du visage
  const rawTemple = 135 + (profile.faceWidth - 130) * 0.75;
  const templeLength = clamp(Math.round(rawTemple / 5) * 5, 135, 150);

  const totalWidth = 2 * lensWidth + bridgeWidth + 10;

  const recommendedColorName = recommendedColorsFor(profile.skinTone)[0];
  const color = ATELIER_COLORS.find(c => c.name === recommendedColorName) ?? ATELIER_COLORS[0];

  return {
    shape: resolvedShape,
    lensWidth,
    lensHeight,
    bridgeWidth,
    templeLength,
    totalWidth,
    color,
    sunLenses: false
  };
}

// --- Génération de la géométrie 3D ---------------------------------------
// Contour du verre : superellipse "mélangée" — exposants différents pour les
// quadrants haut/bas, effilage vers le nez (aviateur) et remontée du coin
// externe (œil-de-chat). Tout est exprimé en millimètres.

interface OutlineParams {
  nTop: number;
  nBottom: number;
  bottomScale: number;
  noseTaper: number;
  outerLift: number;
}

const OUTLINE_PARAMS: Record<AtelierShape, OutlineParams> = {
  oval: { nTop: 2, nBottom: 2, bottomScale: 1, noseTaper: 0, outerLift: 0 },
  round: { nTop: 2, nBottom: 2, bottomScale: 1, noseTaper: 0, outerLift: 0 },
  rectangular: { nTop: 4.5, nBottom: 4.5, bottomScale: 1, noseTaper: 0, outerLift: 0 },
  aviator: { nTop: 2.6, nBottom: 1.7, bottomScale: 1.05, noseTaper: 0.2, outerLift: 0 },
  'cat-eye': { nTop: 2.8, nBottom: 2.2, bottomScale: 0.9, noseTaper: 0, outerLift: 0.32 }
};

// side = 1 : verre droit (bord externe vers +x) ; side = -1 : verre gauche
function lensOutlinePoints(shape: AtelierShape, A: number, B: number, side: 1 | -1): THREE.Vector2[] {
  const p = OUTLINE_PARAMS[shape];
  const pts: THREE.Vector2[] = [];
  const N = 96;
  const halfA = A / 2;
  const halfB = B / 2;

  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const n = s >= 0 ? p.nTop : p.nBottom;

    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * halfA;
    let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * halfB * (s >= 0 ? 1 : p.bottomScale);

    // Effilage du bas du verre vers le nez (côté nez = -x avant miroir)
    if (s < 0 && p.noseTaper) {
      x -= p.noseTaper * Math.abs(s) * halfA;
    }
    // Remontée du coin externe supérieur (côté externe = +x avant miroir)
    if (s >= 0 && p.outerLift) {
      y += p.outerLift * Math.pow(Math.max(0, x / halfA), 2) * halfB;
    }

    pts.push(new THREE.Vector2(side * x, y));
  }
  return pts;
}

function shapeFromPoints(points: THREE.Vector2[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    s.lineTo(points[i].x, points[i].y);
  }
  s.closePath();
  return s;
}

function makeMaterials(spec: CustomFrameSpec) {
  const frame = spec.color.finish === 'metal'
    ? new THREE.MeshStandardMaterial({
        color: spec.color.hex,
        metalness: 1,
        roughness: 0.28
      })
    : new THREE.MeshPhysicalMaterial({
        color: spec.color.hex,
        roughness: 0.22,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15
      });

  const lens = new THREE.MeshPhysicalMaterial({
    color: spec.sunLenses ? '#3b3b30' : '#bfd4dd',
    transparent: true,
    opacity: spec.sunLenses ? 0.82 : 0.18,
    roughness: 0.05,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  return { frame, lens };
}

// Construit la monture complète. Le groupe est en millimètres,
// centré sur le pont, verres dans le plan XY, branches vers -Z.
export function buildGlassesModel(spec: CustomFrameSpec): THREE.Group {
  const group = new THREE.Group();
  const { frame: frameMat, lens: lensMat } = makeMaterials(spec);

  const A = spec.lensWidth;
  const B = spec.lensHeight;
  const DBL = spec.bridgeWidth;
  const isMetal = spec.color.finish === 'metal';

  const rim = isMetal ? 1.8 : 3.2;       // épaisseur du cerclage
  const depth = isMetal ? 1.6 : 3.4;     // profondeur d'extrusion
  const lensCenterX = (A + DBL) / 2;     // système boxing

  ([1, -1] as const).forEach(side => {
    // Cerclage : contour externe avec le verre en creux
    const outer = shapeFromPoints(lensOutlinePoints(spec.shape, A + 2 * rim, B + 2 * rim, side));
    const inner = shapeFromPoints(lensOutlinePoints(spec.shape, A, B, side));
    outer.holes.push(new THREE.Path(inner.getPoints()));

    const rimGeo = new THREE.ExtrudeGeometry(outer, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 2
    });
    const rimMesh = new THREE.Mesh(rimGeo, frameMat);
    rimMesh.position.set(side * lensCenterX, 0, -depth / 2);
    group.add(rimMesh);

    // Verre
    const lensGeo = new THREE.ExtrudeGeometry(inner, { depth: 1, bevelEnabled: false });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.set(side * lensCenterX, 0, -0.5);
    group.add(lensMesh);

    // Branche : part de la charnière, file vers l'arrière puis plonge derrière l'oreille
    const hingeX = side * (lensCenterX + A / 2 + rim);
    const hingeY = B * 0.3;
    const L = spec.templeLength;
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hingeX, hingeY, 0),
      new THREE.Vector3(hingeX + side * 1.5, hingeY, -L * 0.35),
      new THREE.Vector3(hingeX + side * 1.5, hingeY, -L * 0.62),
      new THREE.Vector3(hingeX, hingeY - 4, -L * 0.82),
      new THREE.Vector3(hingeX - side * 2, hingeY - 16, -L)
    ]);
    const templeGeo = new THREE.TubeGeometry(templeCurve, 48, isMetal ? 0.9 : 1.7, 12, false);
    group.add(new THREE.Mesh(templeGeo, frameMat));

    // Plaquettes de nez pour les montures métal
    if (isMetal) {
      const padGeo = new THREE.SphereGeometry(2.2, 16, 12);
      padGeo.scale(0.5, 1, 0.6);
      const pad = new THREE.Mesh(padGeo, new THREE.MeshPhysicalMaterial({
        color: '#e9e4da', roughness: 0.4, transparent: true, opacity: 0.9
      }));
      pad.position.set(side * (DBL / 2 + 1.5), -B * 0.12, -1.5);
      pad.rotation.z = side * 0.35;
      group.add(pad);
    }
  });

  // Pont : arche entre les deux cerclages
  const bridgeY = B * 0.22;
  const bridgeCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-(DBL / 2 + 2.5), bridgeY, 0),
    new THREE.Vector3(0, bridgeY + B * 0.12, 0),
    new THREE.Vector3(DBL / 2 + 2.5, bridgeY, 0)
  );
  const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 24, isMetal ? 1.1 : 2.2, 12, false);
  group.add(new THREE.Mesh(bridgeGeo, frameMat));

  return group;
}

export function disposeGlassesModel(group: THREE.Group) {
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
