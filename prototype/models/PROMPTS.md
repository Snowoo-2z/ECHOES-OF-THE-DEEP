# 🎨 Prompts de génération des personnages

Prompts prêts à copier-coller pour Meshy / Tripo / Rodin / Hunyuan3D.

**Ordre conseillé** : `player` d'abord (le plus vu à l'écran),
`villager_generic` en dernier (le moins critique).

## ⚙️ Réglages dans l'outil

- **T-pose** (pas A-pose si tu as le choix)
- **Symétrie** activée
- **Export `.glb`** — pas `.obj`, pas `.fbx`
- **~15k–40k triangles** suffisent
- Pas besoin d'auto-rigging : le code rigge tout seul au chargement

## ⚠️ Trois pièges

1. **Jambes séparées** — contrainte n°1. Robe longue, cape qui traîne ou
   manteau fermé = maille déchirée au premier pas. Le rig a besoin de deux
   volumes de jambes distincts.
2. **Pas de socle** — les générateurs ajoutent souvent une base sous les pieds.
3. **Bras bien horizontaux** — s'ils sortent tombants ou en A-pose, les
   épaules seront décalées.

---

## 1️⃣ `player.glb` — le protagoniste (1,75 m)

```
Personnage 3D complet, corps entier : jeune pêcheur d'une vingtaine
d'années, silhouette élancée et athlétique, univers post-apocalyptique
maritime.

Cheveux courts en bataille, visage jeune au regard vif et déterminé.
Tunique de toile épaisse sans manches, brun-gris délavé, rapiécée aux
épaules. Pantalon de toile roulé aux mollets. Ceinture de corde tressée
avec un petit couteau dans un étui de cuir. Bandes de tissu enroulées
autour des avant-bras. Pieds nus ou sandales de corde usées.

Vêtements marqués par le sel et le soleil, coutures visibles, quelques
pièces de tissu recousues de couleur différente. Allure modeste mais
solide, quelqu'un qui travaille dehors.

Pose en T-pose stricte, bras tendus à l'horizontale sur les côtés,
jambes droites et légèrement écartées, debout, parfaitement symétrique,
face à la caméra. Mains vides et ouvertes, doigts détendus.

Style low-poly stylisé, textures PBR usées, palette bleu-gris délavé,
brun bois et orange rouille. Vêtements rapiécés. Sans socle, sans base,
personnage isolé. Fond uni gris clair, éclairage neutre et uniforme,
aucune ombre portée.
```

---

## 2️⃣ `villager_woman_old.glb` — la narratrice (1,58 m)

```
Personnage 3D complet, corps entier : femme âgée d'environ 70 ans,
villageoise d'un archipel post-apocalyptique, silhouette menue.

Visage ridé et doux, expression fatiguée mais bienveillante. Cheveux
gris tirés en chignon bas, quelques mèches échappées. Foulard de tissu
noué sur la tête. Grand châle de laine rapiécé couvrant les épaules et
retombant sur les bras. Robe-tunique longue jusqu'aux genoux, toile
épaisse gris-beige, ceinturée par une corde. Jambières de tissu enroulé.
Sandales de corde usées.

Dos très légèrement voûté, épaules affaissées par l'âge, mains noueuses.
Vêtements élimés, ourlets effilochés, pièces recousues.

Pose en T-pose stricte, bras tendus à l'horizontale sur les côtés,
jambes droites et légèrement écartées, debout, symétrique, face à la
caméra. Mains vides et ouvertes.

IMPORTANT : les jambes doivent rester deux volumes distincts et séparés,
visibles jusqu'aux chevilles. Pas de jupe longue fermée, pas de robe qui
enveloppe les deux jambes ensemble.

Style low-poly stylisé, textures PBR usées, palette bleu-gris délavé,
brun bois et orange rouille. Sans socle, personnage isolé. Fond uni,
éclairage neutre.
```

> Le bloc **IMPORTANT** est essentiel : une jupe fermée relierait les deux
> jambes en un seul volume, et le rig les ferait se déchirer à chaque pas.

---

## 3️⃣ `villager_man_old.glb` — le vieil homme (1,68 m)

```
Personnage 3D complet, corps entier : homme âgé d'environ 70 ans, vieux
pêcheur bourru d'un village post-apocalyptique.

Visage buriné et ridé, barbe grise courte et mal taillée, sourcils
épais, expression sévère et désabusée. Cheveux gris clairsemés, bonnet
de laine usé sur la tête. Veste de toile épaisse sans col, brun-gris,
rapiécée aux coudes, portée ouverte sur une chemise élimée. Pantalon de
toile large, ceinture de cuir craquelé. Bottes de cuir montantes très
usées.

Dos légèrement voûté, épaules larges mais tombantes, mains larges et
abîmées par le travail. Corde enroulée autour d'une épaule.

Pose en T-pose stricte, bras tendus à l'horizontale sur les côtés,
jambes droites et légèrement écartées, debout, symétrique, face à la
caméra. Mains vides et ouvertes.

Style low-poly stylisé, textures PBR usées, palette bleu-gris délavé,
brun bois et orange rouille. Vêtements rapiécés. Sans socle, personnage
isolé. Fond uni, éclairage neutre.
```

---

## 4️⃣ `child.glb` — l'enfant (1,22 m)

```
Personnage 3D complet, corps entier : enfant de 8 à 10 ans, garçon ou
fille, villageois d'un archipel post-apocalyptique. Proportions
enfantines : tête proportionnellement grande, membres courts, silhouette
frêle.

Cheveux courts et ébouriffés, visage rond, grands yeux curieux.
Tunique de toile trop grande pour lui, brun-beige, manches roulées,
descendant jusqu'aux cuisses. Short de toile rapiécé. Ficelle nouée à la
taille en guise de ceinture. Pieds nus, chevilles sales.

Petit sac de toile en bandoulière. Vêtements visiblement récupérés et
retaillés, pièces cousues de couleurs dépareillées.

Pose en T-pose stricte, bras tendus à l'horizontale sur les côtés,
jambes droites et légèrement écartées, debout, symétrique, face à la
caméra. Mains vides et ouvertes.

Style low-poly stylisé, textures PBR usées, palette bleu-gris délavé,
brun bois et orange rouille. Sans socle, personnage isolé. Fond uni,
éclairage neutre.
```

---

## 5️⃣ `villager_generic.glb` — le figurant (1,72 m)

```
Personnage 3D complet, corps entier : villageois adulte d'une trentaine
d'années, pêcheur d'un archipel post-apocalyptique, morphologie
moyenne et neutre.

Visage ordinaire, traits neutres, barbe de trois jours, cheveux courts.
Tissu enroulé autour de la tête comme protection contre le soleil.
Chemise de toile à manches longues roulées aux coudes, gris-vert
délavé, rapiécée. Pantalon de toile simple. Tablier de cuir usé attaché
à la taille. Bandes de tissu aux avant-bras. Bottes de toile souple.

Apparence volontairement banale et passe-partout : ce personnage sera
dupliqué plusieurs fois pour peupler le village. Éviter tout détail
trop distinctif ou mémorable.

Pose en T-pose stricte, bras tendus à l'horizontale sur les côtés,
jambes droites et légèrement écartées, debout, symétrique, face à la
caméra. Mains vides et ouvertes.

Style low-poly stylisé, textures PBR usées, palette bleu-gris délavé,
brun bois et orange rouille. Sans socle, personnage isolé. Fond uni,
éclairage neutre.
```

---

## 📥 Après génération

Dépose les fichiers dans `prototype/models/` avec **exactement ces noms**,
sur la branche `arena/01a0772c-echoes-of-the-deep`.

Chaque `.glb` remplace automatiquement son placeholder — aucune ligne de code
à toucher. Tu peux les envoyer un par un.
