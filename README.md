# LuxOptic

Analyse du visage, catalogue de montures en 3D et essayage en réalité augmentée, dans le navigateur.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Comment ça marche

- **Suivi du visage** : MediaPipe Face Landmarker (`@mediapipe/tasks-vision`), 478 points + matrice de pose
  de la tête, sur GPU si disponible. Tout tourne sur l'appareil, aucune image n'est envoyée.
  - Le runtime WASM est servi depuis notre propre domaine (`/mediapipe/wasm`, voir `vite.config.ts`).
  - Le modèle `face_landmarker.task` (3,7 Mo) est chargé depuis l'URL officielle de Google par défaut.
    Pour l'héberger soi-même : le placer dans `public/models/` et définir
    `VITE_FACE_MODEL_URL=/models/face_landmarker.task`.
- **Montures** : générées en 3D (three.js) à partir de leurs cotes, voir `src/three/frameSpec.ts`.
- **Taille réelle** : l'iris humain (~11,7 mm) sert d'étalon pour convertir les pixels en millimètres.

## Déploiement

Vercel ou Netlify, sans configuration : `vercel.json` et `public/_redirects` renvoient toutes les URL vers
l'application. La caméra exige HTTPS (sauf sur `localhost`).

## « Me voir avec » et comparaison des prix (affiliation)

- **Photo IA** (`/apercu/:id`) : la photo d'analyse et l'image de référence de la monture sont envoyées
  à Gemini (Nano Banana 2) par la fonction `api/apercu.ts`. Le client n'envoie que l'identifiant de la
  monture ; l'image de référence est choisie par le serveur. Rien n'est conservé.
  - Vercel → Settings → Environment Variables : `GEMINI_API_KEY` (obligatoire),
    `GEMINI_IMAGE_MODEL` (défaut `gemini-3.1-flash-image`), `APERCU_MAX_PAR_HEURE` (défaut 6).
  - En local, sans clé : `APERCU_DEMO=1 npm run dev` renvoie la photo telle quelle.
- **Flux d'affiliation** : `npm run flux -- flux1.csv flux2.csv` (format Awin et colonnes courantes)
  regroupe les produits par EAN, garde l'offre la moins chère de chaque marchand et écrit
  `src/data/flux.json` et `public/references/index.json`. En développement, un flux de démonstration
  fictif est utilisé tant que le vrai est vide ; il n'est jamais inclus dans le build de production.
