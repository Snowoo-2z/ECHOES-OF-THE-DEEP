# Passer les personnages sur Mixamo

Mixamo remplace **à la fois** le rigging automatique (`rig.js`) et les poses
écrites à la main (`acting.js`). C'est un rig professionnel avec des poids
peints correctement, donc plus de membres tordus ni d'articulations inversées.

## 1. Riggez chaque personnage

Sur <https://www.mixamo.com> → **Upload Character**, envoyez le `.glb`
(ou le `.fbx`) du personnage.

Mixamo demande de placer 5 marqueurs : menton, poignets, coudes, genoux,
entrejambe. Réglez **Skeleton LOD** sur *Standard Skeleton (65)*.

> ⚠️ Pour le plongeur : placez le marqueur du menton **sur le menton réel**,
> pas sur la vitre du casque, sinon la tête est décalée vers l'avant.

## 2. Téléchargez les animations

Une fois le personnage rigué, cherchez ces animations et téléchargez-les.
Ce sont celles dont la cinématique a besoin — les noms correspondent aux
actions actuelles d'`acting.js` :

| Action du code | Animation Mixamo à chercher |
|---|---|
| `stand`      | Standing Idle |
| `standOld`   | Old Man Idle |
| `walk`       | Walking |
| `walkOld`    | Old Man Walk |
| `sit`        | Sitting Idle |
| `crouchWork` | Crouched Sneaking Idle *(ou Kneeling)* |
| `workStand`  | Standing Idle *(bras occupés)* |
| `carry`      | Walking With Briefcase |
| `offer`      | Standing Greeting |
| `talk`       | Talking |

**Réglages de téléchargement, importants :**

- Format : **FBX Binary (.fbx)**
- Skin : **With Skin** pour la *première* animation seulement,
  **Without Skin** pour toutes les suivantes (évite de dupliquer le maillage,
  qui pèse plusieurs Mo)
- Frames per Second : 30
- Keyframe Reduction : none

Cochez **In Place** pour les marches (`walk`, `walkOld`, `carry`) : le code
déplace déjà les personnages lui-même, sinon ils avanceraient deux fois.

## 3. Déposez les fichiers

Placez les `.fbx` dans `prototype/models/mixamo/`, en nommant ainsi :

```
prototype/models/mixamo/
  player_stand.fbx        <- celui-ci "With Skin"
  player_walk.fbx
  player_sit.fbx
  ...
  diver_stand.fbx         <- celui-ci "With Skin"
  ...
```

Puis poussez sur GitHub. Je m'occupe de la conversion et de l'intégration.

## 4. Conversion (côté agent)

```sh
tools/get-fbx2gltf.sh                        # une seule fois
tools/bin/FBX2glTF -b -i perso.fbx -o perso.glb
```
