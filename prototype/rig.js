// ============================================================================
//  rig.js — Rigging automatique d'un mesh humanoïde en T-pose
// ----------------------------------------------------------------------------
//  Le modèle généré par Meshy n'a ni squelette ni animations : juste un mesh
//  statique. Ce module construit un squelette à l'exécution, calcule les poids
//  de skinning par distance aux os, et renvoie un SkinnedMesh animable.
//
//  Prérequis sur le mesh : T-pose, debout sur +Y, face à +Z, bras à l'horizontale.
// ============================================================================
import * as THREE from 'three';

/**
 * Construit un squelette et skinne le mesh fourni.
 * @param {THREE.Mesh} mesh - mesh statique en T-pose
 * @returns {{ skinned: THREE.SkinnedMesh, bones: Object, attach: Object, height: number }}
 */
export function autoRig(mesh) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;

  const yMin = bb.min.y, yMax = bb.max.y;
  const H = yMax - yMin;                    // hauteur totale du personnage
  const armTip = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)); // bout des doigts
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;

  // Position verticale à partir d'une fraction de la hauteur
  const Y = f => yMin + f * H;

  // --- Proportions humanoïdes (fractions de la hauteur totale) --------------
  const shoulderX = 0.11 * H;   // écartement des épaules
  const hipX      = 0.085 * H;  // écartement des hanches
  const handX     = armTip * 0.96;
  const elbowX    = (shoulderX + handX) / 2;

  // Définition du squelette : nom, parent, position monde (espace du mesh)
  const layout = [
    ['hips',      null,       cx,             Y(0.50), cz],
    ['spine',     'hips',     cx,             Y(0.62), cz],
    ['chest',     'spine',    cx,             Y(0.74), cz],
    ['neck',      'chest',    cx,             Y(0.845), cz],
    ['head',      'neck',     cx,             Y(0.91), cz],

    ['shoulderL', 'chest',    cx - shoulderX, Y(0.815), cz],
    ['elbowL',    'shoulderL',cx - elbowX,    Y(0.815), cz],
    ['handL',     'elbowL',   cx - handX,     Y(0.815), cz],

    ['shoulderR', 'chest',    cx + shoulderX, Y(0.815), cz],
    ['elbowR',    'shoulderR',cx + elbowX,    Y(0.815), cz],
    ['handR',     'elbowR',   cx + handX,     Y(0.815), cz],

    ['thighL',    'hips',     cx - hipX,      Y(0.48), cz],
    ['kneeL',     'thighL',   cx - hipX,      Y(0.26), cz],
    ['footL',     'kneeL',    cx - hipX,      Y(0.03), cz],

    ['thighR',    'hips',     cx + hipX,      Y(0.48), cz],
    ['kneeR',     'thighR',   cx + hipX,      Y(0.26), cz],
    ['footR',     'kneeR',    cx + hipX,      Y(0.03), cz],
  ];

  // --- Création des os ------------------------------------------------------
  const bones = {};
  const boneList = [];
  const worldPos = {};

  for (const [name, parent, x, y, z] of layout) {
    const b = new THREE.Bone();
    b.name = name;
    worldPos[name] = new THREE.Vector3(x, y, z);
    if (parent) {
      // position locale = monde - monde du parent
      b.position.copy(worldPos[name]).sub(worldPos[parent]);
      bones[parent].add(b);
    } else {
      b.position.copy(worldPos[name]);
    }
    bones[name] = b;
    boneList.push(b);
  }

  // --- Segments servant au calcul des poids ---------------------------------
  // Chaque os influence la zone autour du segment qui le relie à son enfant.
  const pairs = [
    ['hips','spine'], ['spine','chest'], ['chest','neck'], ['neck','head'],
    ['shoulderL','elbowL'], ['elbowL','handL'],
    ['shoulderR','elbowR'], ['elbowR','handR'],
    ['thighL','kneeL'], ['kneeL','footL'],
    ['thighR','kneeR'], ['kneeR','footR'],
  ];
  const segs = pairs.map(([a, b]) => ({
    i: boneList.indexOf(bones[a]),
    a: worldPos[a],
    b: worldPos[b],
  }));
  // La tête et les mains/pieds prolongent un peu leur segment pour capter
  // les extrémités (casque, palmes, gants).
  const extend = (from, to, k) => worldPos[to].clone().sub(worldPos[from]).multiplyScalar(k).add(worldPos[to]);
  segs.push({ i: boneList.indexOf(bones.head),  a: worldPos.head,  b: extend('neck','head', 1.6) });
  segs.push({ i: boneList.indexOf(bones.footL), a: worldPos.footL, b: extend('kneeL','footL', 0.5).setZ(cz + 0.35 * H) });
  segs.push({ i: boneList.indexOf(bones.footR), a: worldPos.footR, b: extend('kneeR','footR', 0.5).setZ(cz + 0.35 * H) });

  // --- Calcul des poids de skinning ----------------------------------------
  const pos = geo.attributes.position;
  const n = pos.count;
  const skinIndex  = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);

  const v = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const av = new THREE.Vector3();
  const proj = new THREE.Vector3();

  // distance d'un point au segment [a,b]
  function distToSeg(p, a, b) {
    ab.subVectors(b, a);
    av.subVectors(p, a);
    const len2 = ab.lengthSq();
    let t = len2 > 1e-9 ? av.dot(ab) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    proj.copy(ab).multiplyScalar(t).add(a);
    return p.distanceTo(proj);
  }

  const EPS = 0.02 * H;   // évite les divisions par zéro
  const POW = 4;          // netteté de l'influence (plus haut = moins de bavure)
  const cand = [];

  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    cand.length = 0;
    for (const s of segs) {
      const d = distToSeg(v, s.a, s.b);
      cand.push({ i: s.i, w: 1 / Math.pow(d + EPS, POW) });
    }
    // on garde les 4 os les plus influents
    cand.sort((p, q) => q.w - p.w);
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += cand[k].w;
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k]  = cand[k].i;
      skinWeight[i * 4 + k] = cand[k].w / sum;
    }
  }

  geo.setAttribute('skinIndex',  new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  // --- Construction du SkinnedMesh -----------------------------------------
  const skinned = new THREE.SkinnedMesh(geo, mesh.material);
  skinned.name = 'diverSkinned';
  skinned.frustumCulled = false;           // le skinning peut sortir de la bbox
  skinned.add(bones.hips);
  skinned.bind(new THREE.Skeleton(boneList));

  // --- Points d'ancrage pour l'équipement ----------------------------------
  // (lampe, propulseur, scanner… à accrocher plus tard)
  const mk = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const attach = {
    handR:  mk(bones.handR, 0, 0, 0.04 * H),
    handL:  mk(bones.handL, 0, 0, 0.04 * H),
    back:   mk(bones.chest, 0, 0, -0.10 * H),
    helmet: mk(bones.head,  0, 0.02 * H, 0.09 * H),
  };

  return { skinned, bones, attach, height: H, yMin, yMax };
}

/**
 * Pose de repos : le modèle est en T-pose, on ramène les bras le long du corps.
 * À appeler une fois après le rig.
 */
export function applyRestPose(bones) {
  // Bras baissés : le bras gauche pointe vers -X, +Z le fait descendre
  bones.shoulderL.rotation.z =  1.18;
  bones.shoulderR.rotation.z = -1.18;
  // Coudes légèrement fléchis vers l'avant
  bones.elbowL.rotation.y = -0.25;
  bones.elbowR.rotation.y =  0.25;
  // Léger écartement naturel
  bones.shoulderL.rotation.x = 0.12;
  bones.shoulderR.rotation.x = 0.12;
}

/**
 * Animation procédurale de nage.
 * @param {Object} b      - les os
 * @param {number} phase  - phase du cycle (rad), avance avec la vitesse
 * @param {number} effort - 0 = dérive immobile, 1 = nage soutenue
 */
export function swimPose(b, phase, effort) {
  const k = 0.15 + effort * 0.85;
  const s  = Math.sin(phase);
  const s2 = Math.sin(phase + 0.7);   // les tibias suivent avec un retard
  const s3 = Math.sin(phase * 0.5);   // ondulation lente du corps

  // --- Battement de palmes (flutter kick), en opposition de phase
  b.thighL.rotation.x =  s  * 0.42 * k;
  b.thighR.rotation.x = -s  * 0.42 * k;
  b.kneeL.rotation.x  = (0.22 + s2 * 0.38) * k;
  b.kneeR.rotation.x  = (0.22 - s2 * 0.38) * k;
  b.footL.rotation.x  = -s2 * 0.30 * k;
  b.footR.rotation.x  =  s2 * 0.30 * k;

  // --- Bras : plaqués le long du corps en nage, plus ouverts en dérive
  const tuck = effort;                       // 1 = serrés, 0 = flottants
  b.shoulderL.rotation.z =  1.18 + tuck * 0.22 + s3 * 0.06;
  b.shoulderR.rotation.z = -1.18 - tuck * 0.22 - s3 * 0.06;
  b.shoulderL.rotation.x =  0.12 + s3 * 0.10 * (1 - tuck);
  b.shoulderR.rotation.x =  0.12 - s3 * 0.10 * (1 - tuck);
  b.elbowL.rotation.y = -0.25 - tuck * 0.35;
  b.elbowR.rotation.y =  0.25 + tuck * 0.35;

  // --- Ondulation du buste
  b.spine.rotation.x = s3 * 0.06 * k;
  b.chest.rotation.y = s3 * 0.05 * (1 - tuck * 0.5);
  b.hips.rotation.x  = -s3 * 0.05 * k;

  // --- La tête reste stable, regard vers l'avant
  b.neck.rotation.x = -0.10 - effort * 0.14;
  b.head.rotation.y = s3 * 0.07 * (1 - tuck);
}
