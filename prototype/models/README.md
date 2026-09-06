# 📦 Modèles 3D

Dépose ici les modèles du jeu.

## Format recommandé

**glTF binaire (`.glb`)** — un seul fichier, textures incluses, chargement natif par Three.js.
Si tu exportes depuis Blender : `Fichier > Exporter > glTF 2.0 (.glb)`.

`.gltf` + dossier de textures fonctionne aussi. Évite `.blend`, `.fbx` et `.obj` :
je ne peux pas les charger directement dans le prototype web.

## Convention

- Nomme le fichier d'après ce qu'il représente : `diver.glb`, `raie.glb`, `immeuble_a.glb`
- Orientation : le modèle doit regarder vers **+Z**, debout sur **+Y**
- Échelle : **1 unité = 1 mètre** (le plongeur fait ~1,8 m de haut)
- Origine du pivot : aux pieds pour un personnage, au centre pour un décor

## Poids

Garde les fichiers sous ~10 Mo si possible. Au-delà, dis-le moi : on passera par
du stockage externe plutôt que par Git.

## Une fois le fichier déposé

Dis-moi simplement son nom : je remplace le plongeur low-poly actuel (fait de
capsules et de sphères) par ton modèle, et je rebranche l'animation de nage dessus.
