# 🌊 Prototype v0.1 — Déplacement

Première version jouable. **Pas d'histoire, pas d'objectif** : juste le plongeur et la nage 3D sous-marine.

## ▶️ Lancer

Ouvre `index.html` dans un navigateur, ou sers le dossier :

```bash
python3 -m http.server 3000 --directory prototype
# puis http://localhost:3000
```

Aucune installation : Three.js est chargé depuis un CDN (connexion internet requise).

## 🎮 Contrôles

| Touche | Action |
|--------|--------|
| `Z` `Q` `S` `D` / flèches | Nager |
| `Espace` | Monter |
| `Maj` | Descendre |
| Souris | Regarder autour |
| `F` | Allumer / éteindre la lampe |
| `Échap` | Libérer la souris (pause) |

## ✅ Ce qui est dans cette version

- Modèle 3D du plongeur (`models/diver.glb`, généré via Meshy) en vue 3e personne
- **Rigging automatique par code** : le GLB est livré sans squelette, `rig.js`
  en génère un de 17 os et calcule les poids de skinning au chargement
- Animation de nage procédurale : battement de palmes, bras qui se plaquent
  avec l'effort, ondulation du buste
- Nage 6 directions avec inertie et traînée aquatique (flottabilité légère)
- Lampe frontale avec jauge : se décharge allumée, se recharge éteinte
- Jauge d'oxygène : se vide plus vite en profondeur, se recharge en surface
- Profondimètre + nom du biome courant (Résidentiel → Gratte-ciels → Métro → Bunkers)
- Ville engloutie procédurale : ~34 bâtiments avec coraux, collisions cylindriques
- Fond marin vallonné, surface de l'eau vue du dessous
- Neige marine + bulles émises par le plongeur
- Assombrissement progressif de l'eau et du brouillard avec la profondeur

## 🦴 Le rig (`rig.js`)

Le modèle généré par IA est un mesh statique : **ni squelette, ni animations**.
`rig.js` le rigge à l'exécution :

1. Un squelette humanoïde de 17 os est placé par proportions, déduites de la
   bounding box du mesh (T-pose, debout sur +Y, face à +Z).
2. Les poids de skinning sont calculés par distance inverse aux segments d'os
   (4 influences par sommet).
3. `swimPose()` anime le squelette procéduralement selon la vitesse.

Des **points d'ancrage** sont exposés pour l'équipement futur :
`attach.handR`, `attach.handL`, `attach.back`, `attach.helmet`.

### Remplacer le modèle

Dépose un nouveau `.glb` en `models/diver.glb`. Il doit être en **T-pose**,
debout sur **+Y**, face à **+Z**. L'échelle est normalisée automatiquement
(`TARGET_HEIGHT = 1.85 m`), peu importe la taille d'origine.

## 🔜 Pistes pour la suite

- Ramassage d'**Échos** et flashbacks jouables
- Faune (bancs de poissons, créatures, la raie-monture)
- Intérieurs de bâtiments et poches d'air
- Base flottante et upgrades du scaphandre
- Sons : ambiance, respiration, craquements du métal
