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
- **Le Miroir** (`/miroir`) — essayage en réalité augmentée : la monture sur mesure est
  posée sur le visage en direct. Pose 3D de la tête estimée depuis le mesh facial
  (base orthonormée tempes/front-menton), échelle absolue par le diamètre d'iris,
  lissage adaptatif type One-Euro, occlusion des branches par un ellipsoïde de
  profondeur, et cotes de la monture recalculées en continu sur les mesures stabilisées
  (médiane glissante). La géométrie est couverte par un banc de test synthétique :
  `npx tsx scripts/test-facepose.ts`.
- **Catalogue** (`/catalog`) — filtres par marque, style, couleur, matière, prix.

## Démarrage

```bash
npm install
npm run dev     # serveur de développement
npm run build   # build de production (tsc + vite)
```

## Import de produits AliExpress

Le catalogue fusionne automatiquement `src/data/importedGlasses.json` avec la
sélection éditoriale. Ce fichier est généré par `scripts/import-aliexpress.mjs` :

```bash
# Via l'API affiliée officielle (clés sur https://openservice.aliexpress.com)
ALIEXPRESS_APP_KEY=xxx ALIEXPRESS_APP_SECRET=yyy \
  node scripts/import-aliexpress.mjs --keywords "glasses frame" --pages 3

# Ou depuis un dump JSON (réponse API, export d'outil de scraping…)
node scripts/import-aliexpress.mjs --from-json scripts/sample-aliexpress.json
```

Le normaliseur déduit la forme de monture depuis le titre (cat-eye, aviator,
round…), extrait les cotes d'opticien quand elles figurent dans l'annonce
(« 52-18-140 », « lens width: 52 »…), et mappe matière, genre et couleur — les
produits importés sont donc directement notés par le moteur de recommandation.

Note : les requêtes vers `*.aliexpress.com` doivent être autorisées par la
politique réseau de l'environnement (ou lancez le script depuis votre machine).

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
