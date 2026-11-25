# Apprentissage des préférences (« ça me va / ça ne me va pas »)

Aujourd’hui, LuxOptic recommande des montures avec des **règles d’expert écrites à la main**
(`src/lib/fit.ts`) : un visage rond appelle des angles, des sourcils épais une barre supérieure
marquée, etc. Ce dossier prépare l’étape suivante : **apprendre, à partir des avis des
personnes qui l’acceptent, quelles montures plaisent vraiment à quels visages**, et mêler
progressivement ce savoir aux règles.

## Ce qui est collecté

Uniquement quand la personne a donné son accord (case à cocher explicite), et uniquement au
moment où elle dit « ça me va » ou « ça ne me va pas » à une monture :

| Champ | Contenu | Exemple |
|---|---|---|
| `version` | version du format | `1` |
| `at` | date et **heure arrondie** (sans minutes ni secondes, UTC) | `2026-11-25T14:00:00.000Z` |
| `templateId` | la monture concernée (gabarit du catalogue) | `panto-acetate` |
| `label` | l’avis | `like` / `dislike` |
| `source` | où l’avis a été donné | `apercu` (aperçu), `essai` (essayage virtuel), `kit` (kit papier) |
| `face.shape` | la forme de visage calculée | `oval`, `round`, `square`, `heart`, `oblong` |
| `face.v` | 15 mesures arrondies du visage (liste ci-dessous) | `[1.213, 0.765, …]` |
| `consent` | toujours `true` : sans accord, rien n’est créé | `true` |

Les 15 mesures, dans cet ordre (une valeur inconnue vaut `null`) :

1. `lengthRatio` — longueur du visage / largeur aux pommettes
2. `jawRatio` — largeur de la mâchoire / largeur aux pommettes
3. `foreheadRatio` — largeur du front / largeur aux pommettes
4. `thirdsRatio` — tiers moyen / tiers inférieur du visage
5. `eyeSpacingRatio` — écart entre les yeux / largeur d’un œil
6. `faceWidthMm` — largeur du visage, arrondie au millimètre
7. `pupillaryDistanceMm` — écart pupillaire, arrondi au millimètre
8. `skinIta` — clarté de la peau (angle ITA°, entier)
9. `undertone` — sous-ton de peau : −1 froid, 0 neutre, +1 chaud
10. `browThicknessRatio` — épaisseur des sourcils / largeur d’un œil
11. `browArchRatio` — courbure des sourcils
12. `browGapRatio` — hauteur entre sourcil et paupière / largeur d’un œil
13. `eyeTiltDeg` — inclinaison des yeux, en degrés
14. `intensity` — force des traits (sourcils, mâchoire), de 0 à 1
15. `browContrast` — contraste entre sourcils et peau, de 0 à 1

## Ce qui n’est jamais collecté

- **aucune photo**, aucune image, même réduite ;
- **aucun point du visage** (les 478 repères mesurés sur la photo restent sur l’appareil) ;
- **aucun identifiant** : ni nom, ni e-mail, ni compte, ni identifiant d’appareil, ni adresse IP
  dans les données d’apprentissage, ni cookie de suivi ;
- ni les scores de symétrie ou d’« harmonie » du visage, sans utilité ici.

Les mesures sont des **rapports arrondis** : elles décrivent des proportions partagées par
beaucoup de personnes et ne permettent pas de redessiner un visage ni de reconnaître quelqu’un.
Le format est **fermé** : un événement qui contient le moindre champ en plus (une image, un
e-mail…) est rejeté par la validation (`validateFeedback`).

Les avis donnés lors d’une même analyse partagent les mêmes mesures ; c’est la seule chose qui
permet de les regrouper (pour évaluer le modèle sur des personnes qu’il n’a jamais vues). Ce
regroupement ne relie pas deux analyses différentes de la même personne.

## Pourquoi

- **Améliorer les recommandations** : les règles d’expert sont des généralités ; les avis réels
  disent quelles montures plaisent vraiment, pour quelles proportions de visage.
- **Corriger les règles** : le modèle montre quelles associations (par exemple « mâchoire
  marquée × monture arrondie ») comptent le plus, ce qui sert à recalibrer `fit.ts`.
- **Prudence** : tant qu’il y a peu d’avis réels, le score affiché reste celui des règles. Le
  modèle ne prend du poids que progressivement (35 % à 2 000 avis, jamais plus de 70 %), et
  les explications (« pourquoi cette monture ») viennent toujours des règles.

Retirer son accord arrête immédiatement la collecte. En revanche, comme les avis déjà envoyés
ne sont reliés à aucune identité, il n’est pas possible de retrouver ensuite ceux d’une
personne en particulier pour les supprimer un par un.

## Contenu technique

| Fichier | Rôle |
|---|---|
| `feedback.ts` | format des événements, `faceVector`, `frameVector`, validation, JSONL |
| `simulate.ts` | visages et avis simulés (graine fixe) pour tester toute la chaîne |
| `model.ts` | régression logistique visage × monture (L2), `scoreLearned`, `blend` |
| `ruleBaseline.ts` | applique les règles de `fit.ts` aux gabarits (point de comparaison) |
| `metrics.ts` | AUC, précision, log-loss |
| `train.ts` | simule, entraîne, évalue, écrit `out/model.json` |
| `data.ts` | lecture de `src/data/gabarits.json` (Node uniquement) |

```
npx tsx ml/train.ts            # 1 200 visages simulés, graine 42
npx vitest run ml
npx tsc -p tsconfig.ml.json --noEmit
```

Le modèle de `out/model.json` est entraîné sur des **données simulées** (`source: "simulated"`,
`nFeedback: 0`) : il valide la chaîne mais ne doit pas influencer les recommandations ; avec
`nFeedback = 0`, `blend()` renvoie exactement le score des règles.
