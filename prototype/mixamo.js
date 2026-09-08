// ============================================================================
//  mixamo.js — Adaptation d'un personnage riggé sur Mixamo
// ----------------------------------------------------------------------------
//  Mixamo fournit un squelette standard (28 à 65 os) avec des poids peints
//  correctement. C'est bien meilleur que le rigging automatique de rig.js,
//  qui devinait la position des os à partir du profil du maillage.
//
//  Ce module se contente de faire correspondre les noms d'os Mixamo aux noms
//  utilisés par acting.js, pour que les poses existantes continuent de
//  fonctionner sans réécriture.
// ============================================================================
import * as THREE from 'three';
import { BONE_NAMES } from './rig.js';

const PREFIX = 'mixamorig:';

// Correspondance nom interne → nom Mixamo
const MAP = {
  hips:      'Hips',
  spine:     'Spine',
  chest:     'Spine2',      // Spine1/Spine2 : on pilote le haut du buste
  neck:      'Neck',
  head:      'Head',
  shoulderL: 'LeftArm',     // "Arm" = épaule articulée ; "Shoulder" = clavicule
  elbowL:    'LeftForeArm',
  handL:     'LeftHand',
  shoulderR: 'RightArm',
  elbowR:    'RightForeArm',
  handR:     'RightHand',
  thighL:    'LeftUpLeg',
  kneeL:     'LeftLeg',
  footL:     'LeftFoot',
  thighR:    'RightUpLeg',
  kneeR:     'RightLeg',
  footR:     'RightFoot',
};

// ---------------------------------------------------------------------------
//  Conversion des axes
// ---------------------------------------------------------------------------
//  acting.js a été écrit pour le squelette maison, où les os partent d'une
//  T-pose alignée sur les axes du monde. Sur un rig Mixamo chaque os a sa
//  propre orientation de repos, donc les axes ne correspondent pas :
//  par exemple abaisser un bras se fait autour de X et non de Z.
//
//  Plutôt que de réécrire les dix poses, on convertit ici le triplet
//  (x, y, z) d'acting.js vers les axes réels de Mixamo. La correspondance
//  a été établie en mesurant le déplacement des extrémités os par os
//  (voir /tmp/t/axis3.mjs).
//
//  Convention d'acting.js :
//    épaule  [2] = descente du bras   [0] < 0 = bras vers l'avant
//    coude   [1] = flexion
//    cuisse  [0] < 0 = jambe levée devant   [2] = écartement
//    genou   [0] > 0 = talon vers l'arrière
//    buste   [0] > 0 = penché en avant
const REMAP = {
  // torse : les axes coïncident déjà
  hips:  (r) => [r[0], r[1], r[2]],
  spine: (r) => [r[0], r[1], r[2]],
  chest: (r) => [r[0], r[1], r[2]],
  neck:  (r) => [r[0], r[1], r[2]],
  head:  (r) => [r[0], r[1], r[2]],

  // bras : X abaisse, Z porte vers l'avant (signe opposé à droite)
  shoulderL: (r) => [ r[2],  r[1], -r[0]],
  shoulderR: (r) => [-r[2], -r[1], -r[0]],
  elbowL:    (r) => [ r[0],  0,    -r[1]],
  elbowR:    (r) => [ r[0],  0,    -r[1]],
  handL:     (r) => [ r[0],  r[1],  r[2]],
  handR:     (r) => [ r[0],  r[1],  r[2]],

  // jambes : X fléchit, sens inversé par rapport au rig maison
  thighL: (r) => [-r[0], r[1],  r[2]],
  thighR: (r) => [-r[0], r[1],  r[2]],
  kneeL:  (r) => [-r[0], 0, 0],
  kneeR:  (r) => [-r[0], 0, 0],
  footL:  (r) => [-r[0], 0, 0],
  footR:  (r) => [-r[0], 0, 0],
};

/** Convertit une rotation d'acting.js vers les axes Mixamo. */
export function remapRotation(boneKey, r) {
  const f = REMAP[boneKey];
  return f ? f(r) : r;
}

/** Vrai si la scène glTF contient déjà un squelette exploitable. */
export function hasSkeleton(gltf) {
  let found = false;
  gltf.scene.traverse(o => {
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones.length > 4) found = true;
  });
  return found;
}

/**
 * Prépare un personnage Mixamo pour le reste du code.
 * @returns {{ skinned, bones, attach, height, yMin, yMax, skeleton, clips }}
 */
export function adoptMixamo(gltf) {
  let skinned = null;
  gltf.scene.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  if (!skinned) throw new Error('Aucun SkinnedMesh dans le modèle Mixamo');

  // Mixamo exporte souvent une caméra et une lampe : on ne garde que le perso.
  gltf.scene.updateMatrixWorld(true);

  // --- Correspondance des os ------------------------------------------------
  // GLTFLoader remplace les caractères interdits : "mixamorig:Hips" devient
  // "mixamorigHips". On normalise donc au lieu de retirer un préfixe fixe.
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig\d*/, '');
  const byName = new Map();
  for (const b of skinned.skeleton.bones) {
    byName.set(norm(b.name), b);
  }

  const bones = {};
  const manquants = [];
  for (const key of BONE_NAMES) {
    const b = byName.get(norm(MAP[key]));
    if (b) bones[key] = b; else manquants.push(`${key} (${MAP[key]})`);
  }
  if (manquants.length) {
    console.warn('[mixamo] os introuvables :', manquants.join(', '));
  }

  // --- Pose de repos --------------------------------------------------------
  // acting.js écrit des rotations ABSOLUES. Sur un rig Mixamo les os ont déjà
  // une rotation de repos non nulle (bras en A-pose, clavicules inclinées).
  // On la mémorise pour composer par-dessus au lieu de l'écraser, sinon le
  // personnage se disloque dès la première pose.
  const rest = {};
  for (const [key, b] of Object.entries(bones)) {
    rest[key] = b.quaternion.clone();
  }

  // --- Dimensions -----------------------------------------------------------
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const yMin = box.min.y, yMax = box.max.y;

  // --- Points d'ancrage (objets tenus en main, etc.) ------------------------
  const attach = {};
  for (const [key, name] of [['handL', 'handL'], ['handR', 'handR'],
                             ['head', 'head'], ['chest', 'chest']]) {
    const g = new THREE.Group();
    g.name = `attach_${key}`;
    if (bones[name]) bones[name].add(g);
    attach[key] = g;
  }

  return {
    skinned,
    root: gltf.scene,
    bones,
    rest,
    attach,
    height: yMax - yMin,
    yMin,
    yMax,
    skeleton: skinned.skeleton,
    clips: gltf.animations || [],
    isMixamo: true,
  };
}
