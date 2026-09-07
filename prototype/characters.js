// ============================================================================
//  characters.js — Chargement et instanciation des personnages
// ----------------------------------------------------------------------------
//  Chaque personnage peut venir de deux sources :
//    1. un .glb fourni (T-pose, +Y debout, +Z devant) → riggé par autoRig()
//    2. un placeholder procédural, généré ici avec le MÊME squelette
//
//  Dans les deux cas l'API est identique (mêmes os, mêmes ancrages), donc
//  déposer un .glb dans models/ suffit à remplacer le placeholder : aucune
//  autre ligne de code à toucher.
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { autoRig, BONE_NAMES, PROP } from './rig.js';

// ---------------------------------------------------------------- CATALOGUE
// height : taille réelle en mètres (le modèle est normalisé à cette valeur)
export const CAST = {
  player:      { file: 'player.glb',            height: 1.75, palette: { cloth: 0x5d6f7a, skin: 0xc99b74, accent: 0x8a5a3b } },
  diver:       { file: 'diver.glb',             height: 1.85, palette: { cloth: 0xd9622b, skin: 0x9aa7b0, accent: 0x7fe6ff } },
  oldWoman:    { file: 'villager_woman_old.glb',height: 1.58, palette: { cloth: 0x6b6257, skin: 0xbe9273, accent: 0x8c7f6a } },
  oldMan:      { file: 'villager_man_old.glb',  height: 1.68, palette: { cloth: 0x5a5347, skin: 0xb8895f, accent: 0x6e5f4a } },
  villager:    { file: 'villager_generic.glb',  height: 1.72, palette: { cloth: 0x4f6b6e, skin: 0xc2926b, accent: 0x7a6350 } },
  child:       { file: 'child.glb',             height: 1.22, palette: { cloth: 0x7a8b6a, skin: 0xd0a37e, accent: 0xa8785a } },
};

const loader = new GLTFLoader();
const cache = new Map();     // clé → { geometry, material } prêt à cloner

// ============================================================================
//  PLACEHOLDER PROCÉDURAL
//  Construit un humanoïde simple, en T-pose, aux proportions de PROP.
//  Il est généré comme un mesh unique pour pouvoir passer dans autoRig().
// ============================================================================
function buildPlaceholderMesh(cfg) {
  const H = 1.0;                      // on travaille en hauteur normalisée
  const P = PROP;
  const parts = [];

  const add = (geo, x, y, z, rx = 0, rz = 0) => {
    geo.rotateX(rx); geo.rotateZ(rz);
    geo.translate(x, y, z);
    parts.push(geo);
  };

  const shoulderX = P.shoulderX * H;
  const hipX = P.hipX * H;
  const armLen = 0.32 * H;

  // torse
  add(new THREE.CapsuleGeometry(0.105 * H, 0.20 * H, 4, 10), 0, P.chestY * H - 0.02 * H, 0);
  // bassin
  add(new THREE.CapsuleGeometry(0.095 * H, 0.08 * H, 4, 10), 0, P.hipsY * H, 0);
  // cou
  add(new THREE.CylinderGeometry(0.035 * H, 0.04 * H, 0.05 * H, 8), 0, P.neckY * H, 0);
  // tête
  add(new THREE.SphereGeometry(0.072 * H, 14, 12), 0, P.headY * H, 0);
  // nez : marque le devant (+Z), utile pour vérifier l'orientation
  add(new THREE.ConeGeometry(0.018 * H, 0.05 * H, 6), 0, P.headY * H, 0.068 * H, Math.PI / 2);

  // bras en T (le long de X)
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.032 * H, armLen, 4, 8),
        s * (shoulderX + armLen * 0.5 + 0.03 * H), P.armY * H, 0, 0, Math.PI / 2);
    add(new THREE.CapsuleGeometry(0.030 * H, armLen * 0.9, 4, 8),
        s * (shoulderX + armLen * 1.55), P.armY * H, 0, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.035 * H, 8, 8),
        s * (shoulderX + armLen * 2.05), P.armY * H, 0);
    // épaule
    add(new THREE.SphereGeometry(0.048 * H, 10, 8), s * shoulderX, P.armY * H, 0);
  }

  // jambes
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.048 * H, 0.16 * H, 4, 8), s * hipX, 0.37 * H, 0);
    add(new THREE.CapsuleGeometry(0.040 * H, 0.16 * H, 4, 8), s * hipX, 0.15 * H, 0);
    add(new THREE.BoxGeometry(0.07 * H, 0.04 * H, 0.16 * H), s * hipX, P.footY * H, 0.04 * H);
  }

  // fusion en une seule géométrie
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  return merged;
}

/** Fusion manuelle (évite d'importer BufferGeometryUtils). */
function mergeGeometries(geos) {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const idx = [];
  let vOff = 0;

  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos[(vOff + i) * 3]     = p.getX(i);
      pos[(vOff + i) * 3 + 1] = p.getY(i);
      pos[(vOff + i) * 3 + 2] = p.getZ(i);
      if (n) {
        nor[(vOff + i) * 3]     = n.getX(i);
        nor[(vOff + i) * 3 + 1] = n.getY(i);
        nor[(vOff + i) * 3 + 2] = n.getZ(i);
      }
    }
    const gi = g.index;
    if (gi) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + vOff);
    else    for (let i = 0; i < p.count; i++) idx.push(i + vOff);
    vOff += p.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

// ============================================================================
//  CHARGEMENT
// ============================================================================

/**
 * Charge un personnage du catalogue. Tente le .glb, retombe sur le
 * placeholder s'il est absent.
 * @returns {Promise<{ root, bones, attach, height, isPlaceholder }>}
 */
export async function loadCharacter(key) {
  const cfg = CAST[key];
  if (!cfg) throw new Error(`Personnage inconnu : ${key}`);

  if (!cache.has(key)) cache.set(key, fetchSource(key, cfg));
  const src = await cache.get(key);

  // Chaque instance a sa propre géométrie (les poids de skinning sont
  // partagés mais le squelette doit être indépendant).
  const geo = src.geometry.clone();
  const mesh = new THREE.Mesh(geo, src.material);
  const rig = autoRig(mesh);

  const root = new THREE.Group();
  root.name = key;
  const s = cfg.height / rig.height;
  rig.skinned.scale.setScalar(s);
  // pieds posés sur y = 0
  rig.skinned.position.y = -rig.yMin * s;
  root.add(rig.skinned);

  return {
    root,
    skinned: rig.skinned,
    bones: rig.bones,
    attach: rig.attach,
    height: cfg.height,
    scale: s,
    isPlaceholder: src.isPlaceholder,
    key,
  };
}

function fetchSource(key, cfg) {
  return new Promise((resolve) => {
    const fallback = () => {
      const geometry = buildPlaceholderMesh(cfg);
      const material = new THREE.MeshStandardMaterial({
        color: cfg.palette.cloth, roughness: 0.85, metalness: 0.05,
        flatShading: true,
      });
      resolve({ geometry, material, isPlaceholder: true });
    };

    loader.load(
      `models/${cfg.file}`,
      (gltf) => {
        let found = null;
        gltf.scene.traverse(o => { if (o.isMesh && !found) found = o; });
        if (!found) return fallback();
        found.updateWorldMatrix(true, false);
        const geometry = found.geometry.clone();
        geometry.applyMatrix4(found.matrixWorld);
        const material = found.material;
        material.side = THREE.FrontSide;
        material.envMapIntensity = 0.6;
        resolve({ geometry, material, isPlaceholder: false });
      },
      undefined,
      fallback,      // 404 → placeholder
    );
  });
}

/** Précharge plusieurs personnages en parallèle. */
export function preload(keys) {
  return Promise.all(keys.map(k => {
    if (!cache.has(k)) cache.set(k, fetchSource(k, CAST[k]));
    return cache.get(k);
  }));
}
