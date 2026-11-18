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
