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

- Plongeur en scaphandre (modèle low-poly) en vue 3e personne
- Nage 6 directions avec inertie et traînée aquatique (flottabilité légère)
- Animation de palmes et de bras selon la vitesse
- Lampe frontale avec jauge : se décharge allumée, se recharge éteinte
- Jauge d'oxygène : se vide plus vite en profondeur, se recharge en surface
- Profondimètre + nom du biome courant (Résidentiel → Gratte-ciels → Métro → Bunkers)
- Ville engloutie procédurale : ~34 bâtiments avec coraux, collisions cylindriques
- Fond marin vallonné, surface de l'eau vue du dessous
- Neige marine + bulles émises par le plongeur
- Assombrissement progressif de l'eau et du brouillard avec la profondeur

## 🔜 Pistes pour la suite

- Ramassage d'**Échos** et flashbacks jouables
- Faune (bancs de poissons, créatures, la raie-monture)
- Intérieurs de bâtiments et poches d'air
- Base flottante et upgrades du scaphandre
- Sons : ambiance, respiration, craquements du métal
