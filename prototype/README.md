# 🌊 Prototype v0.3 — Cinématique d'introduction

Version jouable du déplacement. **Pas d'histoire, pas d'objectif** : le
personnage, la nage, et un système d'animation complet.

## ▶️ Lancer

```bash
python3 -m http.server 3000 --directory prototype
```

| Page | Contenu |
|---|---|
| `http://localhost:3000/` | **Cinématique d'introduction** + segment jouable au village |
| `http://localhost:3000/dive.html` | Bac à sable de plongée (nage sous-marine) |

Les deux pages sont reliées par un lien sur leur écran de démarrage.

Aucune installation : Three.js est chargé depuis un CDN (connexion requise).
Le modèle fait 12 Mo, comptez 2-3 s au premier chargement.

## 🎮 Contrôles

| Touche | Action |
|--------|--------|
| `Z` `Q` `S` `D` / flèches | Nager |
| `Espace` | Monter |
| `Maj` | Descendre |
| Souris | Regarder autour |
| `F` | Lampe frontale |
| `H` | Masquer l'indicateur d'état d'animation |
| `Échap` | Libérer la souris |

## 🎬 Les 7 animations

Le badge coloré en bas à gauche indique l'état courant. Pour toutes les voir :

| État | Couleur | Comment le déclencher |
|------|---------|----------------------|
| **IDLE** | bleu pâle | Ne rien toucher — dérive en apesanteur, bras qui flottent |
| **CRUISE** | turquoise | `Z` — nage de croisière, battement régulier |
| **SPRINT** | jaune | `Z` maintenu jusqu'à dépasser 8,5 m/s — corps profilé, bras plaqués |
| **ASCEND** | vert | `Espace` seul — corps vertical, brasse vers le bas |
| **DESCEND** | bleu-violet | `Maj` seul — piqué tête en avant |
| **BRAKE** | orange | Lâcher tout en pleine vitesse — bras écartés face au courant |
| **BACK** | violet | `S` — brasse inversée |

## 🦴 Architecture

### `rig.js` — rigging automatique

Le modèle généré par IA est un mesh statique : **ni squelette, ni animations**
(vérifié : `skins: 0`, `animations: 0`). Il est donc riggé à l'exécution.

1. **Squelette de 17 os** placé par proportions humanoïdes, déduites de la
   bounding box du mesh.
2. **Poids de skinning** par distance inverse aux segments d'os, 4 influences
   par sommet, avec trois corrections :
   - *anti-bavure latérale* — un sommet du bras gauche n'est pas tiré par le
     bras droit ;
   - *symétrisation de la couture centrale* — sur l'axe médian (entrejambe,
     sternum), les sommets dupliqués sont égalisés entre les os gauche et
     droit, sinon la maille se déchire quand les jambes battent en opposition ;
   - *protection de l'équipement rigide* — les os de bras n'emportent pas les
     bouteilles d'oxygène fixées dans le dos.
3. **Points d'ancrage** exposés : `attach.handR`, `handL`, `back`, `helmet`,
   `hips` — pour accrocher lampe, propulseur ou scanner plus tard.

### `animation.js` — animation procédurale

Chaque état est une fonction qui écrit une pose (rotations par os) dans un
buffer réutilisé. L'animateur mélange la pose sortante et la pose entrante
pendant la transition, puis applique des **couches additives** :

- **respiration** — s'accélère à l'effort et en profondeur ;
- **banking** — le corps s'incline dans les virages, la tête reste droite ;
- **turbulence** — bruit lent, plus marqué à faible vitesse ;
- **regard** — la nuque compense le tangage de la caméra.

Deux garde-fous évitent tout défaut visible :

- **`MIN_STATE_TIME`** empêche le clignotement quand le joueur est pile au
  seuil entre deux états ;
- **lissage de sortie** borne la vitesse angulaire de chaque articulation
  (`MAX_RATE`), donc aucun claquement n'est possible même en cas de
  changement d'état brutal.

## ✅ Validation

Le rig et les animations ont été vérifiés numériquement (pas de navigateur
disponible dans l'environnement de dev) :

| Test | Résultat |
|------|----------|
| Somme des poids de skinning | erreur max `4.8e-8` |
| Erreur en pose de repos | `6.7e-8` (bind pose exacte) |
| Étirement moyen des arêtes | 1,02× à 1,05× selon l'état |
| NaN / Infinity | aucun, sur 36 000 frames |
| Dérive d'angle sur 10 min | aucune (max 77°) |
| Oscillation d'état | 8 changements sur 870 frames de jeu scripté |
| Saut angulaire en transition | 6,4°/frame max, sous le seuil de perception |
| Coût CPU de l'animation | 3,9 µs/frame, soit 0,02 % du budget 60 fps |

**Limite connue** : le skinning linéaire produit jusqu'à ~10 cm de pincement à
l'épaule dans la pose de sprint (5 % de la hauteur du perso). C'est le défaut
classique du *linear blend skinning* ; le corriger demanderait des
*corrective shapes* ou du *dual quaternion skinning*.

## 🎥 Caméra

Elle recule et le champ de vision s'ouvre avec la vitesse, avec un léger
décalage latéral dans les virages. La lampe est ancrée au casque : elle suit
donc les mouvements de tête de l'animation.

## 🔄 Remplacer le modèle

Dépose un nouveau `.glb` en `models/diver.glb`. Il doit être en **T-pose**,
debout sur **+Y**, face à **+Z**. L'échelle est normalisée automatiquement
(`TARGET_HEIGHT = 1.85 m`).

Si le modèle a déjà un squelette et des animations, il faudra brancher
l'`AnimationMixer` de Three.js à la place de `DiverAnimator`.

## 🎬 La cinématique (`index.html`)

**Durée : 1 min 42**, 6 plans, 11 sous-titres. Puis passage au jouable.

| Plan | Durée | Contenu |
|---|---|---|
| Ouverture | 6 s | Texte sur noir |
| 1 — L'île | 14 s | Vue large, voix off de la vieille femme |
| 2 — La maison | 18 s | Le héros au travail, le vieil homme le rabroue |
| 3 — Le plongeur | 24 s | Accostage, déballage, l'ampoule s'allume, signe de tête |
| 4 — Le rocher | 23 s | Moment intime, l'enfant tend la montre |
| 5 — L'appel | 18 s | La cloche, « le chef veut te voir » |

Puis **segment jouable** : suivre le vieil homme jusqu'à la maison du chef.
Il attend si tu traînes (au-delà de 7 m) et repart quand tu le rejoins.

**Commandes cinématique** : `Échap` passer le plan · `Entrée` tout passer
**Commandes jouable** : `Z Q S D` marcher · `Maj` courir · souris regarder

### Architecture

| Fichier | Rôle |
|---|---|
| `cinematic.js` | Moteur : timeline, plans, mouvements de caméra, sous-titres, fondus, letterbox |
| `village.js` | L'île procédurale : rochers, maisons sur pilotis, ponton, feu, mouettes, océan, props |
| `characters.js` | Chargement des `.glb` **avec repli automatique** sur des silhouettes riggées |
| `acting.js` | 10 poses terrestres (debout, marche, assis, travail, gestes) + classe `Actor` |
| `intro.js` | Le script : les 6 plans, la mise en scène, les répliques |
| `follow.js` | Le segment jouable « suivre le guide » |

### Modèles manquants

La cinématique tourne **sans aucun modèle**. Les personnages absents
apparaissent en silhouettes de substitution, riggées au même squelette et aux
bonnes tailles. Voir `models/README.md` pour la liste et les conventions.

## ✅ Validation de la cinématique

| Test | Résultat |
|---|---|
| Déroulé complet | 6/6 plans joués, 102,0 s |
| NaN sur les os / la caméra | aucun, sur 6 123 frames |
| Sujet dans le champ | 100 % sur les 4 plans dialogués |
| Caméra sous le décor | 0 frame |
| Lisibilité des sous-titres | tous ≥ 15 car./s |
| Segment jouable | arrivée en 11,7 s, guide attend puis repart |

## 🔜 Pistes pour la suite

- La scène chez le chef (le segment s'arrête devant sa porte)
- Audio : 11 répliques + ambiances (vagues, vent, feu, cloche, sonar, mouettes)
- Ramassage d'**Échos** et flashbacks jouables
- Faune : bancs de poissons, créatures, la raie-monture
- Intérieurs de bâtiments, poches d'air
- Base flottante et upgrades du scaphandre
- Sons : ambiance, respiration, craquements du métal

## 📦 Three.js en local (`vendor/`)

Three.js et le GLTFLoader sont **vendus dans le dépôt** (`prototype/vendor/`,
1,4 Mo) plutôt que chargés depuis un CDN : unpkg n'est pas joignable depuis
tous les réseaux, ce qui laissait une page noire silencieuse.

Le prototype fonctionne donc **entièrement hors ligne**.

Pour mettre à jour Three.js, remplacer les trois fichiers de
`prototype/vendor/three/` par ceux d'une nouvelle version.

## 🚨 Affichage des erreurs

Toute erreur de chargement s'affiche désormais dans un encadré rouge en bas de
l'écran, au lieu de laisser une page noire sans explication.
