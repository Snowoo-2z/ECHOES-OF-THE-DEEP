# 📦 Modèles 3D

Dépose les `.glb` ici. **Tout fonctionne sans eux** : les personnages manquants
sont remplacés par des silhouettes de substitution, riggées au même squelette.
Déposer le fichier suffit à le remplacer, aucune ligne de code à toucher.

## Format

**glTF binaire (`.glb`)** — un seul fichier, textures incluses.
Depuis Blender : `Fichier > Exporter > glTF 2.0 (.glb)`.

⚠️ `.blend`, `.fbx` et `.obj` ne sont pas chargeables directement.

## Convention obligatoire

- **T-pose stricte** : bras à l'horizontale, jambes droites, symétrique
- Le modèle regarde vers **+Z**, debout sur **+Y**
- Pivot **aux pieds**
- Pas de socle, pas de pièce flottante détachée

L'échelle est normalisée automatiquement, peu importe la taille d'origine.

## Personnages attendus

| Fichier | Taille cible | Rôle |
|---|---|---|
| `diver.glb` | 1,85 m | ✅ **fourni** — le Plongeur d'Échos |
| `player.glb` | 1,75 m | Le protagoniste hors scaphandre, vingtaine d'années |
| `villager_woman_old.glb` | 1,58 m | La narratrice, châle, dos voûté |
| `villager_man_old.glb` | 1,68 m | Celui qui dit « arrête de rêver » |
| `villager_generic.glb` | 1,72 m | Villageois lambda (dupliqué avec variations) |
| `child.glb` | 1,22 m | L'enfant à la montre |

## Décors (optionnels)

Le village est entièrement procédural. Ces modèles amélioreraient le rendu
mais ne sont pas requis :

`house_stilts.glb`, `boat_small.glb`

## Props (optionnels)

Créés en dur dans `village.js` (`Props.watch()`, `Props.bulb()`, etc.).
Remplaçables par : `metal_box.glb`, `old_lamp.glb`, `pocket_watch.glb`,
`fishing_net.glb`.

## Cohérence de style

Garde le style du `diver.glb` (« Rustbound Deep Diver »), sinon ça jurera.
Suffixe à ajouter à chaque prompt :

```
Style low-poly stylisé, textures PBR usées, palette bleu-gris délavé,
brun bois et orange rouille. Univers post-apocalyptique maritime,
vêtements rapiécés. T-pose stricte, bras à l'horizontale, symétrique,
sans socle. Fond uni, éclairage neutre.
```

## Ajouter un personnage au catalogue

Dans `characters.js`, ajoute une entrée à `CAST` :

```js
chief: { file: 'chief.glb', height: 1.80,
         palette: { cloth: 0x4a5a6a, skin: 0xc09070, accent: 0x8a6a4a } },
```

La `palette` ne sert qu'au placeholder ; le `.glb` garde ses propres textures.
