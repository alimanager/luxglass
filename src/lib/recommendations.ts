import { glasses as catalog } from '../data/mockData';
import type { Glasses } from '../types/glasses';
import type { FaceMetrics, FaceShape, SkinTone } from './faceMetrics';

export interface Profile {
  firstName: string;
  style: 'discret' | 'classique' | 'affirme';
  budget: 'low' | 'mid' | 'high';
}

export const SHAPE_INFO: Record<FaceShape, { label: string; summary: string; tips: string[]; styles: string[]; avoid: string }> = {
  oval: {
    label: 'Ovale',
    summary: 'Des proportions équilibrées, un front légèrement plus large que la mâchoire. La forme la plus polyvalente.',
    tips: ['Presque toutes les formes te vont', 'Garde une monture aussi large que ton visage', 'Ose les formes marquées : géométrique, browline'],
    styles: ['Rectangulaire', 'Aviateur', 'Géométrique', 'Browline', 'Cat-eye', 'Rond', 'Carré'],
    avoid: 'Les montures beaucoup plus larges que ton visage, qui cassent l’équilibre.',
  },
  round: {
    label: 'Rond',
    summary: 'Largeur et longueur proches, des courbes douces et une mâchoire peu marquée.',
    tips: ['Des angles pour structurer le visage', 'Une monture un peu plus large que haute', 'Un pont fin et légèrement haut'],
    styles: ['Rectangulaire', 'Carré', 'Géométrique', 'Browline', 'Cat-eye'],
    avoid: 'Les petites montures rondes, qui accentuent la rondeur.',
  },
  square: {
    label: 'Carré',
    summary: 'Une mâchoire large et marquée, un front et des pommettes de largeur similaire.',
    tips: ['Des courbes pour adoucir les angles', 'Une monture fine, en métal ou acétate léger', 'Les formes pilote et aviateur fonctionnent très bien'],
    styles: ['Rond', 'Aviateur', 'Aviateur Moderne', 'Pilot', 'Papillon', 'Oversize'],
    avoid: 'Les montures carrées et anguleuses, qui durcissent les traits.',
  },
  heart: {
    label: 'Cœur',
    summary: 'Un front plus large, un visage qui s’affine vers un menton plus étroit.',
    tips: ['Du poids visuel vers le bas de la monture', 'Des formes aviateur ou rondes', 'Un dessus de monture discret'],
    styles: ['Aviateur', 'Aviateur Moderne', 'Rond', 'Pilot', 'Rectangulaire'],
    avoid: 'Les montures très chargées en haut (browline épaisse, cat-eye marqué).',
  },
  oblong: {
    label: 'Allongé',
    summary: 'Un visage nettement plus long que large, aux joues droites.',
    tips: ['Des verres hauts pour raccourcir visuellement', 'Des montures larges et affirmées', 'Une barre ou un pont marqué'],
    styles: ['Oversize', 'Papillon', 'Carré', 'Browline', 'Géométrique'],
    avoid: 'Les montures étroites et fines, qui allongent encore le visage.',
  },
};

const STYLE_PREFERENCE: Record<Profile['style'], string[]> = {
  discret: ['Rond', 'Rectangulaire', 'Browline', 'Aviateur'],
  classique: ['Rectangulaire', 'Aviateur', 'Browline', 'Carré', 'Pilot'],
  affirme: ['Oversize', 'Cat-eye', 'Papillon', 'Géométrique', 'Aviateur Moderne'],
};

const BUDGET: Record<Profile['budget'], [number, number]> = {
  low: [0, 200],
  mid: [150, 420],
  high: [350, Infinity],
};

export function recommendGlasses(m: FaceMetrics, profile: Profile, count = 4): Glasses[] {
  const styles = SHAPE_INFO[m.shape].styles;
  const pref = STYLE_PREFERENCE[profile.style];
  const [lo, hi] = BUDGET[profile.budget];
  return [...catalog]
    .map((g) => {
      let score = 0;
      const rank = styles.indexOf(g.style);
      if (rank >= 0) score += 10 - rank;
      if (pref.includes(g.style)) score += 4;
      if (g.price >= lo && g.price <= hi) score += 5;
      return { g, score };
    })
    .filter((x) => x.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.g);
}

export function frameColors(skin: SkinTone): { name: string; hex: string }[] {
  if (skin.undertone === 'chaud') {
    return [
      { name: 'Écaille miel', hex: '#9a6a34' },
      { name: 'Or', hex: '#c8a24a' },
      { name: 'Olive', hex: '#6b6b3a' },
      { name: 'Cognac', hex: '#8a4b24' },
    ];
  }
  if (skin.undertone === 'froid') {
    return [
      { name: 'Noir', hex: '#1b1b1b' },
      { name: 'Argent', hex: '#b8bec6' },
      { name: 'Bleu nuit', hex: '#23324a' },
      { name: 'Bordeaux', hex: '#5e1f2c' },
    ];
  }
  return [
    { name: 'Écaille', hex: '#6e4a2e' },
    { name: 'Gris fumé', hex: '#5d6266' },
    { name: 'Noir', hex: '#1b1b1b' },
    { name: 'Or rose', hex: '#c49a8a' },
  ];
}

export const FRAME_SIZE_INFO: Record<FaceMetrics['frameSize'], string> = {
  S: 'Taille S : largeur totale de monture d’environ 125–130 mm.',
  M: 'Taille M : largeur totale de monture d’environ 130–140 mm.',
  L: 'Taille L : largeur totale de monture d’environ 140–150 mm.',
};
