// ============================================================================
//  rig.js — Rigging automatique d'un mesh humanoïde en T-pose
// ----------------------------------------------------------------------------
//  Le modèle généré par IA (Meshy) n'a ni squelette ni animations : juste un
//  mesh statique. Ce module construit un squelette à l'exécution, calcule les
//  poids de skinning, et renvoie un SkinnedMesh animable.
//
//  Prérequis : T-pose, debout sur +Y, face à +Z, bras à l'horizontale.
// ============================================================================
import * as THREE from 'three';

// Nom des os, dans l'ordre d'indexation du squelette
export const BONE_NAMES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'handL',
  'shoulderR', 'elbowR', 'handR',
  'thighL', 'kneeL', 'footL',
  'thighR', 'kneeR', 'footR',
];

// Proportions humanoïdes, en fractions de la hauteur totale.
// Partagées entre le rig des vrais modèles et les placeholders, pour que
// toutes les poses soient valables sur les deux.
export const PROP = {
  hipsY: 0.50, spineY: 0.62, chestY: 0.74, neckY: 0.845, headY: 0.91,
  armY: 0.815, shoulderX: 0.11, hipX: 0.085,
  thighY: 0.48, kneeY: 0.26, footY: 0.03,
};

/**
 * Trouve la hauteur (en fraction de H) de la ligne des bras en T-pose :
 * c'est la tranche horizontale dont l'étendue en X est la plus grande.
 * On ne cherche que dans la moitié haute du corps.
 * @returns {number|null} fraction de la hauteur, ou null si indéterminé
 */
function detectArmLine(geo, yMin, H) {
  const pos = geo.attributes.position;
  const SLICES = 44;
  const minX = new Float32Array(SLICES).fill(Infinity);
  const maxX = new Float32Array(SLICES).fill(-Infinity);
  const count = new Uint32Array(SLICES);

  for (let i = 0; i < pos.count; i++) {
    const f = (pos.getY(i) - yMin) / H;
    let s = Math.floor(f * SLICES);
    if (s < 0) s = 0; else if (s >= SLICES) s = SLICES - 1;
    const x = pos.getX(i);
    if (x < minX[s]) minX[s] = x;
    if (x > maxX[s]) maxX[s] = x;
    count[s]++;
  }

  let best = -1, bestW = 0;
  // les bras sont forcément au-dessus de la taille
  for (let s = Math.floor(SLICES * 0.55); s < SLICES; s++) {
    if (count[s] < 24) continue;
    const w = maxX[s] - minX[s];
    if (w > bestW) { bestW = w; best = s; }
  }
  if (best < 0) return null;

  // il faut que ce soit franchement plus large que le torse, sinon le
  // modèle n'est pas vraiment en T-pose et on préfère la valeur par défaut
  const torso = maxX[Math.floor(SLICES * 0.60)] - minX[Math.floor(SLICES * 0.60)];
  if (!(bestW > torso * 1.8)) return null;

  return (best + 0.5) / SLICES;
}

/**
 * Trouve la base de la coiffe rigide (crâne ou casque de scaphandre).
 * On part de la ligne des bras et on remonte : dès que la largeur retombe
 * au niveau du torse, on est sorti des épaules et tout ce qui est au-dessus
 * appartient à la tête d'un seul bloc.
 * @returns {number} fraction de la hauteur
 */
function detectHeadBase(geo, yMin, H, armY) {
  const pos = geo.attributes.position;
  const S = 60;
  const mn = new Float32Array(S).fill(Infinity);
  const mx = new Float32Array(S).fill(-Infinity);
  const cnt = new Uint32Array(S);
  for (let i = 0; i < pos.count; i++) {
    const f = (pos.getY(i) - yMin) / H;
    let s = Math.floor(f * S);
    if (s < 0) s = 0; else if (s >= S) s = S - 1;
    const x = pos.getX(i);
    if (x < mn[s]) mn[s] = x;
    if (x > mx[s]) mx[s] = x;
    cnt[s]++;
  }
  const width = s => (cnt[s] < 12 ? 0 : mx[s] - mn[s]);

  // largeur du torse, mesurée bien en dessous des bras
  let torso = 0, n = 0;
  for (let s = Math.floor(S * 0.55); s < Math.floor(S * 0.65); s++) {
    const w = width(s);
    if (w > 0) { torso += w; n++; }
  }
  torso = n ? torso / n : 0.2 * H;

  // on remonte depuis la ligne des bras jusqu'à retomber au gabarit du torse
  const seuil = torso * 1.25;
  const startS = Math.min(S - 1, Math.floor(armY * S));
  for (let s = startS; s < S; s++) {
    if (width(s) > 0 && width(s) < seuil) return (s + 0.5) / S;
  }
  return armY + 0.06;
}

/**
 * Construit un squelette et skinne le mesh fourni.
 * @param {THREE.Mesh} mesh - mesh statique en T-pose
 */
export function autoRig(mesh) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;

  const yMin = bb.min.y, yMax = bb.max.y;
  const H = yMax - yMin;
  const armTip = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;

  const Y = f => yMin + f * H;

  // --- Détection de la ligne des bras --------------------------------------
  // En T-pose, la tranche horizontale la plus large est celle des bras
  // tendus. On la détecte au lieu de la supposer, car elle varie selon le
  // modèle (0.74 sur un personnage aux épaules basses, 0.81 sur un autre).
  const armY = detectArmLine(geo, yMin, H) ?? PROP.armY;

  // Le cou et la tête restent calés en absolu : le sommet du mesh est
  // toujours le haut du crâne, quelle que soit la hauteur des épaules.
  // Seul le buste s'adapte, pour rester juste sous la ligne des bras.
  const headY  = PROP.headY;
  const neckY  = PROP.neckY;
  // le buste se place entre la ligne des bras et le cou : sur un modèle aux
  // épaules basses (casque volumineux), il descend avec elles
  const chestY = Math.min(PROP.chestY, (armY + neckY) * 0.5);
  const spineY = Math.min(PROP.spineY, chestY - 0.06);
  const hipsY  = Math.min(PROP.hipsY, spineY - 0.06);

  // --- Proportions humanoïdes (fractions de la hauteur) ---------------------
  const shoulderX = 0.11 * H;
  const hipX      = 0.085 * H;
  const handX     = armTip * 0.94;
  const elbowX    = (shoulderX + handX) / 2;

  //  nom, parent, x, y, z, côté (-1 gauche / +1 droite / 0 centre)
  const layout = [
    ['hips',      null,        cx,             Y(hipsY),  cz,  0],
    ['spine',     'hips',      cx,             Y(spineY), cz,  0],
    ['chest',     'spine',     cx,             Y(chestY), cz,  0],
    ['neck',      'chest',     cx,             Y(neckY),  cz,  0],
    ['head',      'neck',      cx,             Y(headY),  cz,  0],

    ['shoulderL', 'chest',     cx - shoulderX, Y(armY),  cz, -1],
    ['elbowL',    'shoulderL', cx - elbowX,    Y(armY),  cz, -1],
    ['handL',     'elbowL',    cx - handX,     Y(armY),  cz, -1],

    ['shoulderR', 'chest',     cx + shoulderX, Y(armY),  cz, +1],
    ['elbowR',    'shoulderR', cx + elbowX,    Y(armY),  cz, +1],
    ['handR',     'elbowR',    cx + handX,     Y(armY),  cz, +1],

    ['thighL',    'hips',      cx - hipX,      Y(PROP.thighY), cz, -1],
    ['kneeL',     'thighL',    cx - hipX,      Y(PROP.kneeY),  cz, -1],
    ['footL',     'kneeL',     cx - hipX,      Y(PROP.footY),  cz, -1],

    ['thighR',    'hips',      cx + hipX,      Y(PROP.thighY), cz, +1],
    ['kneeR',     'thighR',    cx + hipX,      Y(PROP.kneeY),  cz, +1],
    ['footR',     'kneeR',     cx + hipX,      Y(PROP.footY),  cz, +1],
  ];

  // --- Création des os ------------------------------------------------------
  const bones = {};
  const boneList = [];
  const worldPos = {};
  const sideOf = {};

  for (const [name, parent, x, y, z, side] of layout) {
    const b = new THREE.Bone();
    b.name = name;
    worldPos[name] = new THREE.Vector3(x, y, z);
    sideOf[name] = side;
    if (parent) {
      b.position.copy(worldPos[name]).sub(worldPos[parent]);
      bones[parent].add(b);
    } else {
      b.position.copy(worldPos[name]);
    }
    bones[name] = b;
    boneList.push(b);
  }

  // --- Segments d'influence -------------------------------------------------
  const pairs = [
    ['hips','spine'], ['spine','chest'], ['chest','neck'], ['neck','head'],
    ['shoulderL','elbowL'], ['elbowL','handL'],
    ['shoulderR','elbowR'], ['elbowR','handR'],
    ['thighL','kneeL'], ['kneeL','footL'],
    ['thighR','kneeR'], ['kneeR','footR'],
  ];
  const segs = pairs.map(([a, b]) => ({
    i: boneList.indexOf(bones[a]),
    name: a,
    a: worldPos[a], b: worldPos[b],
    side: sideOf[a],
    yLo: Math.min(worldPos[a].y, worldPos[b].y),
  }));

  // Prolongements pour capter les extrémités (casque, gants, palmes)
  const ext = (from, to, k) =>
    worldPos[to].clone().sub(worldPos[from]).multiplyScalar(k).add(worldPos[to]);

  segs.push({ i: boneList.indexOf(bones.head), name:'head', a: worldPos.head,
              b: ext('neck','head', 1.9), side: 0, yLo: worldPos.head.y });
  // Les palmes dépassent vers l'avant (+Z) au niveau des pieds
  segs.push({ i: boneList.indexOf(bones.footL), name:'footL', a: worldPos.footL,
              b: worldPos.footL.clone().setZ(cz + 0.30 * H).setY(Y(0.01)),
              side: -1, yLo: Y(0.0) });
  segs.push({ i: boneList.indexOf(bones.footR), name:'footR', a: worldPos.footR,
              b: worldPos.footR.clone().setZ(cz + 0.30 * H).setY(Y(0.01)),
              side: +1, yLo: Y(0.0) });
  // Les mains couvrent aussi le bout des doigts
  segs.push({ i: boneList.indexOf(bones.handL), name:'handL', a: worldPos.handL,
              b: ext('elbowL','handL', 0.35), side: -1, yLo: worldPos.handL.y });
  segs.push({ i: boneList.indexOf(bones.handR), name:'handR', a: worldPos.handR,
              b: ext('elbowR','handR', 0.35), side: +1, yLo: worldPos.handR.y });

  // --- Poids de skinning ----------------------------------------------------
  const pos = geo.attributes.position;
  const n = pos.count;
  const skinIndex  = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);

  const v = new THREE.Vector3();
  const ab = new THREE.Vector3(), av = new THREE.Vector3(), proj = new THREE.Vector3();

  function distToSeg(p, a, b) {
    ab.subVectors(b, a);
    av.subVectors(p, a);
    const len2 = ab.lengthSq();
    let t = len2 > 1e-9 ? av.dot(ab) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    proj.copy(ab).multiplyScalar(t).add(a);
    return p.distanceTo(proj);
  }

  const EPS = 0.018 * H;
  const POW = 4.2;
  // Un sommet du bras gauche ne doit pas être tiré par le bras droit.
  const CROSS_PENALTY = 0.06;
  // Largeur de la bande centrale où gauche et droite se rejoignent
  // (entrejambe, sternum, nuque). Dans cette bande, les os latéraux sont
  // atténués au profit des os centraux, sinon la maille se déchire quand
  // les jambes battent en opposition de phase.
  const MID = 0.055 * H;
  const smoothstep = t => t * t * (3 - 2 * t);
  const lerpN = (a, b, t) => a + (b - a) * t;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const ARM_BONES = new Set(['shoulderL','elbowL','handL','shoulderR','elbowR','handR']);
  const cand = [];
  const raw = new Map();

  // Paires miroir, pour la symétrisation de la couture centrale
  const MIRROR = [
    ['thighL','thighR'], ['kneeL','kneeR'], ['footL','footR'],
    ['shoulderL','shoulderR'], ['elbowL','elbowR'], ['handL','handR'],
  ];
  const boneIndex = {};
  for (const s of segs) boneIndex[s.name] = s.i;

  // Bande de transition vers le verrouillage sur la tête, calée sur la base
  // réelle du crâne / du casque (variable selon le modèle).
  const headBase = detectHeadBase(geo, yMin, H, armY);
  const headLock0 = headBase - 0.03;
  const headLock1 = headBase + 0.03;

  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    const dxMid = v.x - cx;
    const vSide = Math.sign(dxMid);
    const fy = (v.y - yMin) / H;
    // 0 au centre exact → 1 dès qu'on sort de la bande médiane
    const lateral = smoothstep(Math.min(1, Math.abs(dxMid) / MID));
    cand.length = 0;

    // Poids bruts, indexés par nom d'os
    raw.clear();
    for (const s of segs) {
      const d = distToSeg(v, s.a, s.b);
      let w = 1 / Math.pow(d + EPS, POW);
      if (s.side !== 0) {
        if (vSide !== 0 && s.side !== vSide) w *= CROSS_PENALTY;
        w *= 0.12 + 0.88 * lateral;
      }
      // Les os de bras ne doivent pas emporter le torse ni l'équipement
      // rigide fixé dessus (bouteilles d'oxygène dans le dos). On atténue
      // leur influence à l'intérieur de la largeur d'épaules.
      if (ARM_BONES.has(s.name)) {
        const inTorso = 1 - smoothstep(clamp01(
          (Math.abs(dxMid) - shoulderX * 0.72) / (shoulderX * 0.55)));
        w *= 1 - 0.94 * inTorso;
      }
      raw.set(s.name, Math.max(raw.get(s.name) || 0, w));
    }

    // --- Coiffe rigide (casque, capuche) --------------------------------
    // Au-dessus de la base du cou, la géométrie appartient à la tête. Sans
    // cela un casque de scaphandre est tiraillé entre chest, neck et head,
    // qui divergent dès que le buste bouge : la coque se déchire.
    if (fy > headLock0) {
      const lock = smoothstep(clamp01((fy - headLock0) / (headLock1 - headLock0)));
      for (const [name, w] of raw) {
        if (name === 'head') continue;
        raw.set(name, w * (1 - lock));
      }
      raw.set('head', Math.max(raw.get('head') || 0, 1e-6) + lock * 1e3);
    } else if (raw.has('head')) {
      // Réciproquement : sous la coiffe, la tête ne doit plus tirer. Sur un
      // scaphandre la coque descend très bas et « head » gardait jusqu'à 40 %
      // d'influence au niveau des épaules, ce qui étirait le col.
      const fade = smoothstep(clamp01((headLock0 - fy) / 0.06));
      raw.set('head', raw.get('head') * (1 - fade));
    }

    // --- Symétrisation de la couture centrale ---------------------------
    // Sur l'axe médian (entrejambe, sternum, nuque), les sommets sont
    // dupliqués et se voient attribuer arbitrairement l'os gauche OU droit.
    // Quand les deux os divergent (battement en opposition), la maille se
    // déchire. On égalise donc les paires L/R d'autant plus qu'on est près
    // du centre.
    if (lateral < 1) {
      const mix = 1 - lateral;   // 1 au centre exact, 0 hors de la bande
      for (const [l, r] of MIRROR) {
        const wl = raw.get(l) || 0, wr = raw.get(r) || 0;
        if (wl === 0 && wr === 0) continue;
        const avg = (wl + wr) * 0.5;
        raw.set(l, lerpN(wl, avg, mix));
        raw.set(r, lerpN(wr, avg, mix));
      }
    }

    for (const [name, w] of raw) cand.push({ i: boneIndex[name], w });

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

  // --- SkinnedMesh ----------------------------------------------------------
  const skinned = new THREE.SkinnedMesh(geo, mesh.material);
  skinned.name = 'diverSkinned';
  skinned.frustumCulled = false;
  skinned.add(bones.hips);
  skinned.bind(new THREE.Skeleton(boneList));

  // --- Ancrages pour l'équipement ------------------------------------------
  const mk = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const attach = {
    handR:  mk(bones.handR, 0, 0, 0.04 * H),
    handL:  mk(bones.handL, 0, 0, 0.04 * H),
    back:   mk(bones.chest, 0, 0, -0.11 * H),
    helmet: mk(bones.head,  0, 0.03 * H, 0.10 * H),
    hips:   mk(bones.hips,  0, 0, 0.09 * H),
  };

  return { skinned, bones, attach, height: H, yMin, yMax, skeleton: skinned.skeleton };
}
