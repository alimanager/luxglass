# LuxGlass — LuxOptic

Trouvez la monture qui correspond vraiment à votre visage, ou faites-la dessiner sur mesure.

## Fonctionnalités

- **Analyse morphologique** (`/try-on`) — la webcam et MediaPipe FaceMesh (TensorFlow.js)
  mesurent le visage en millimètres réels grâce à l'étalonnage par le diamètre de l'iris
  (~11,7 mm, quasi constant chez l'humain) : écart pupillaire, pont nasal, largeur et
  longueur du visage, forme du visage, teint de peau.
- **Recommandation personnalisée** (`/analysis-results`) — chaque monture du catalogue
  porte ses vraies cotes d'opticien (calibre □ pont — branches) et sa forme ; un score de
  compatibilité croise harmonie morphologique, ajustement physique et accord des couleurs
  avec le teint.
- **Atelier Sur Mesure** (`/atelier`) — une monture unique est générée procéduralement en
  3D (Three.js) à partir des mesures : calibre calculé sur l'écart pupillaire, pont ajusté
  au nez, forme conseillée selon la morphologie, couleurs et matières personnalisables.
- **Catalogue** (`/catalog`) — filtres par marque, style, couleur, matière, prix.

## Démarrage

```bash
npm install
npm run dev     # serveur de développement
npm run build   # build de production (tsc + vite)
```

## Architecture

| Module | Rôle |
|---|---|
| `src/utils/modelLoader.ts` | Chargement paresseux et partagé des modèles TFJS |
| `src/utils/recommendation.ts` | Moteur de scoring monture ↔ morphologie |
| `src/utils/parametricGlasses.ts` | Génération procédurale des montures 3D (mm réels) |
| `src/components/FaceAnalysis.tsx` | Capture webcam, mesures étalonnées sur l'iris |
| `src/pages/Atelier.tsx` | Configurateur 3D de la monture sur mesure |

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · TensorFlow.js (MediaPipe FaceMesh) · Three.js
