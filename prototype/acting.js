// ============================================================================
//  acting.js — Poses et animations « à terre » pour la cinématique
// ----------------------------------------------------------------------------
//  animation.js couvre la nage. Ici on couvre le village : debout, marche,
//  assis, travail manuel, gestes de dialogue.
//
//  Même convention que animation.js : une pose est un dictionnaire
//  { nomOs: [rx, ry, rz] }, appliqué sur le squelette généré par autoRig.
//  Les bras partent d'une T-pose, donc rotation.z les rabat le long du corps.
// ============================================================================
import * as THREE from 'three';
import { BONE_NAMES } from './rig.js';
import { remapRotation } from './mixamo.js';

const ARM_DOWN = 1.42;          // ramène un bras à la verticale depuis la T-pose
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

export function makePose() {
  const p = {};
  for (const n of BONE_NAMES) p[n] = [0, 0, 0];
  return p;
}
export function zeroPose(p) {
  for (const n of BONE_NAMES) { const r = p[n]; r[0] = r[1] = r[2] = 0; }
}
export function blendPose(out, a, b, t) {
  for (const n of BONE_NAMES) {
    const ra = a[n], rb = b[n], ro = out[n];
    ro[0] = lerp(ra[0], rb[0], t);
    ro[1] = lerp(ra[1], rb[1], t);
    ro[2] = lerp(ra[2], rb[2], t);
  }
}
export function applyPose(bones, pose) {
  for (const n of BONE_NAMES) {
    const r = pose[n];
    if (bones[n]) bones[n].rotation.set(r[0], r[1], r[2]);
  }
}

// ============================================================================
//  POSES DE BASE
//  Signature : (p, t, v) — p = pose de sortie, t = temps, v = variation 0..1
//  (v décale les phases pour que deux villageois ne bougent pas à l'unisson)
// ============================================================================

// --- Debout au repos, respiration et micro-balancement ---------------------
export function poseStand(p, t, v = 0) {
  const b = Math.sin(t * 0.85 + v * 6.3);
  const s = Math.sin(t * 0.31 + v * 3.1);

  p.shoulderL[2] =  ARM_DOWN - 0.06;
  p.shoulderR[2] = -ARM_DOWN + 0.06;
  p.shoulderL[0] =  0.05 + b * 0.02;
  p.shoulderR[0] =  0.05 - b * 0.02;
  p.elbowL[1] = -0.18;
  p.elbowR[1] =  0.18;

  p.chest[0] = 0.015 + b * 0.02;      // respiration
  p.spine[0] = 0.01 + b * 0.01;
  p.hips[2]  = s * 0.015;
  p.chest[1] = s * 0.03;
  p.head[1]  = s * 0.05;
  p.neck[0]  = -0.04;
}

// --- Vieillard : dos voûté, appui décalé -----------------------------------
export function poseStandOld(p, t, v = 0) {
  poseStand(p, t * 0.75, v);
  p.spine[0] += 0.16;
  p.chest[0] += 0.12;
  p.neck[0]  -= 0.14;
  p.head[0]  += 0.06;
  p.hips[0]  += 0.05;
  p.shoulderL[0] += 0.10;
  p.shoulderR[0] += 0.10;
  p.elbowL[1] -= 0.22;
  p.elbowR[1] += 0.22;
  p.kneeL[0] += 0.07;
  p.kneeR[0] += 0.05;
}

// --- Marche ----------------------------------------------------------------
export function poseWalk(p, t, v = 0, speed = 1) {
  const s  = Math.sin(t);
  const c  = Math.cos(t);
  const s2 = Math.sin(t * 2);
  const k = speed;

  p.thighL[0] =  s * 0.44 * k;
  p.thighR[0] = -s * 0.44 * k;
  p.kneeL[0]  = Math.max(0, -s + 0.35) * 0.62 * k;
  p.kneeR[0]  = Math.max(0,  s + 0.35) * 0.62 * k;
  p.footL[0]  = -p.thighL[0] * 0.35 - 0.05;
  p.footR[0]  = -p.thighR[0] * 0.35 - 0.05;

  // balancement des bras, en opposition aux jambes
  p.shoulderL[2] =  ARM_DOWN - 0.10;
  p.shoulderR[2] = -ARM_DOWN + 0.10;
  p.shoulderL[0] = -s * 0.34 * k;
  p.shoulderR[0] =  s * 0.34 * k;
  p.elbowL[1] = -0.30 - Math.max(0, -s) * 0.30;
  p.elbowR[1] =  0.30 + Math.max(0,  s) * 0.30;

  // le buste compense
  p.hips[1]   =  s * 0.09 * k;
  p.chest[1]  = -s * 0.07 * k;
  p.hips[2]   =  c * 0.04 * k;
  p.spine[0]  = 0.03 + s2 * 0.015;
  p.chest[0]  = 0.02;
  p.neck[0]   = -0.05;
}

// --- Marche de vieillard : lente, appuyée ----------------------------------
export function poseWalkOld(p, t, v = 0) {
  poseWalk(p, t, v, 0.62);
  p.spine[0] += 0.15;
  p.chest[0] += 0.10;
  p.neck[0]  -= 0.12;
  p.kneeL[0] += 0.10;
  p.kneeR[0] += 0.10;
  p.hips[0]  += 0.04;
}

// --- Assis (sur un rocher, jambes pendantes) -------------------------------
export function poseSit(p, t, v = 0) {
  const b = Math.sin(t * 0.7 + v * 4.2);
  const s = Math.sin(t * 0.26 + v * 2.0);

  // Flexions volontairement modérées : au-delà d'environ 60° le skinning
  // linéaire pince la maille à la hanche et au genou. On compense en
  // inclinant le bassin, ce qui donne la même lecture visuelle.
  p.hips[0]   =  0.10;        // buste presque droit (>0 = vers l'avant)
  p.thighL[0] = -1.45;        // cuisses à l'horizontale, vers l'avant
  p.thighR[0] = -1.40;
  p.thighL[2] =  0.08;
  p.thighR[2] = -0.08;
  p.kneeL[0]  = 1.42 + b * 0.03;      // tibias verticaux, légère oscillation
  p.kneeR[0]  = 1.38 - b * 0.03;
  p.footL[0]  = 0.10;
  p.footR[0]  = 0.08;

  p.spine[0] = 0.10 + b * 0.02;
  p.chest[0] = 0.04;
  p.neck[0]  = -0.06;
  p.head[1]  = s * 0.06;

  // avant-bras posés sur les cuisses ([0] < 0 amène les mains devant)
  p.shoulderL[2] =  ARM_DOWN - 0.30;
  p.shoulderR[2] = -ARM_DOWN + 0.30;
  p.shoulderL[0] = -0.44;
  p.shoulderR[0] = -0.44;
  p.elbowL[1] = -0.86;
  p.elbowR[1] =  0.86;
  p.elbowL[0] =  0.30;
  p.elbowR[0] =  0.30;
}

// --- Accroupi (réparation de filet, travail au sol) ------------------------
export function poseCrouchWork(p, t, v = 0) {
  const w = Math.sin(t * 2.1 + v * 5.0);
  const w2 = Math.sin(t * 1.4 + v * 2.2);

  // Même contrainte que poseSit : on reste sous ~60° par articulation.
  p.hips[0]   =  0.30;        // accroupi, buste penché en avant
  p.thighL[0] = -1.55;
  p.thighR[0] = -1.50;
  p.thighL[2] =  0.24;
  p.thighR[2] = -0.24;
  p.kneeL[0]  = 1.85;
  p.kneeR[0]  = 1.80;
  p.footL[0]  = 0.45;
  p.footR[0]  = 0.42;

  p.spine[0] = 0.26;
  p.chest[0] = 0.14;
  p.neck[0]  = -0.30;        // regard vers les mains
  p.head[0]  = -0.10;

  // mains qui travaillent devant soi
  p.shoulderL[2] =  ARM_DOWN - 0.42;
  p.shoulderR[2] = -ARM_DOWN + 0.42;
  p.shoulderL[0] = -0.78 + w * 0.10;
  p.shoulderR[0] = -0.78 - w * 0.10;
  p.elbowL[1] = -1.16 - w2 * 0.14;
  p.elbowR[1] =  1.16 + w2 * 0.14;
  p.handL[0] = w * 0.30;
  p.handR[0] = -w * 0.30;
}

// --- Debout en travaillant (filet tendu entre les mains) -------------------
export function poseWorkStanding(p, t, v = 0) {
  const w  = Math.sin(t * 1.9 + v * 4.4);
  const w2 = Math.sin(t * 1.3 + v * 1.7);

  poseStand(p, t * 0.6, v);

  p.shoulderL[2] =  ARM_DOWN - 0.46;
  p.shoulderR[2] = -ARM_DOWN + 0.46;
  p.shoulderL[0] = -0.66 + w * 0.13;
  p.shoulderR[0] = -0.66 - w * 0.13;
  p.elbowL[1] = -1.02 - w2 * 0.18;
  p.elbowR[1] =  1.02 + w2 * 0.18;
  p.elbowL[0] =  0.14;
  p.elbowR[0] =  0.14;
  p.handL[0]  =  w * 0.34;
  p.handR[0]  = -w * 0.34;

  p.neck[0] = -0.24;
  p.spine[0] += 0.06;
  p.chest[1] = w2 * 0.05;
}

// --- Porter une charge (seaux d'eau) ---------------------------------------
export function poseCarry(p, t, v = 0) {
  const s = Math.sin(t);
  poseWalk(p, t, v, 0.72);

  // bras tendus vers le bas, épaules tirées
  p.shoulderL[2] =  ARM_DOWN + 0.10;
  p.shoulderR[2] = -ARM_DOWN - 0.10;
  p.shoulderL[0] = -0.04;
  p.shoulderR[0] = -0.04;
  p.elbowL[1] = -0.06;
  p.elbowR[1] =  0.06;
  p.spine[0] += 0.10;
  p.chest[0] += 0.06;
  p.hips[2]  += s * 0.05;      // démarche pesante
  p.neck[0]  -= 0.06;
}

// --- Geste : tendre un objet des deux mains --------------------------------
export function poseOffer(p, t, v = 0) {
  const b = Math.sin(t * 1.1 + v * 3.0);
  poseStand(p, t * 0.7, v);

  p.shoulderL[2] =  ARM_DOWN - 0.58;
  p.shoulderR[2] = -ARM_DOWN + 0.58;
  p.shoulderL[0] = -0.92 + b * 0.03;
  p.shoulderR[0] = -0.92 - b * 0.03;
  p.elbowL[1] = -0.52;
  p.elbowR[1] =  0.52;
  p.elbowL[0] =  0.18;
  p.elbowR[0] =  0.18;
  p.neck[0]  = 0.06;
  p.chest[0] = 0.04;
}

// --- Geste : parler, une main qui accompagne -------------------------------
export function poseTalk(p, t, v = 0, intensity = 1) {
  poseStand(p, t, v);
  const g  = Math.sin(t * 2.3 + v * 2.6);
  const g2 = Math.sin(t * 1.5 + v * 4.1);
  const k = intensity;

  p.shoulderR[2] = -ARM_DOWN + (0.34 + g * 0.16) * k;
  p.shoulderR[0] = -(0.42 + g2 * 0.16) * k;
  p.elbowR[1]    =  (0.92 + g * 0.24) * k;
  p.elbowR[0]    =  0.16 * k;
  p.handR[0]     =  g * 0.20 * k;

  p.head[1]  = g2 * 0.10 * k;
  p.head[0]  = g * 0.05 * k;
  p.chest[1] = g2 * 0.06 * k;
}

// --- Geste : retirer son casque --------------------------------------------
// phase 0 → 1 : mains vers la tête, puis redescente avec le casque
export function poseRemoveHelmet(p, t, phase) {
  poseStand(p, t * 0.6, 0);
  const up = Math.sin(Math.min(1, phase * 1.35) * Math.PI);       // cloche
  const down = smooth(Math.max(0, (phase - 0.62) / 0.38));

  p.shoulderL[2] =  ARM_DOWN - 0.34 - up * 0.78;
  p.shoulderR[2] = -ARM_DOWN + 0.34 + up * 0.78;
  p.shoulderL[0] = -0.20 - up * 0.36;
  p.shoulderR[0] = -0.20 - up * 0.36;
  p.elbowL[1] = -0.40 - up * 1.32;
  p.elbowR[1] =  0.40 + up * 1.32;

  p.neck[0] = -0.04 + up * 0.14 - down * 0.14;
  p.chest[0] = up * 0.05;

  // après le retrait, on regarde vers le personnage principal
  p.head[1] = down * 0.30;
}

// --- Geste : signe de tête -------------------------------------------------
export function addNod(p, t01) {
  const a = Math.sin(t01 * Math.PI * 2) * 0.24;
  p.neck[0] += a;
  p.head[0] += a * 0.55;
}

// --- Regard vers une direction (ajoute au buste et à la tête) --------------
export function addLookAt(p, yaw, pitch, weight = 1) {
  const y = Math.max(-1.3, Math.min(1.3, yaw));
  const pi = Math.max(-0.7, Math.min(0.7, pitch));
  p.head[1] += y * 0.55 * weight;
  p.neck[1] += y * 0.28 * weight;
  p.chest[1] += y * 0.18 * weight;
  p.head[0] += pi * 0.50 * weight;
  p.neck[0] += pi * 0.30 * weight;
}

// ============================================================================
//  ACTEUR
//  Enveloppe un personnage chargé et gère ses transitions de pose.
// ============================================================================
const ACTIONS = {
  stand:      { fn: poseStand,        fade: 0.5, rate: 1.0 },
  standOld:   { fn: poseStandOld,     fade: 0.5, rate: 1.0 },
  walk:       { fn: poseWalk,         fade: 0.3, rate: 1.0 },
  walkOld:    { fn: poseWalkOld,      fade: 0.4, rate: 1.0 },
  sit:        { fn: poseSit,          fade: 0.6, rate: 1.0 },
  crouchWork: { fn: poseCrouchWork,   fade: 0.5, rate: 1.0 },
  workStand:  { fn: poseWorkStanding, fade: 0.5, rate: 1.0 },
  carry:      { fn: poseCarry,        fade: 0.4, rate: 1.0 },
  offer:      { fn: poseOffer,        fade: 0.5, rate: 1.0 },
  talk:       { fn: poseTalk,         fade: 0.4, rate: 1.0 },
};

const SMOOTH_LAMBDA = 24;
const MAX_RATE = 8.0;

export class Actor {
  /** @param {Object} char résultat de loadCharacter() */
  constructor(char, opts = {}) {
    this.char = char;
    this.root = char.root;
    this.bones = char.bones;
    this.attach = char.attach;
    this.rest = char.rest || null;   // pose de repos (rig Mixamo)
    this.height = char.height;

    this.variation = opts.variation ?? Math.random();
    this.action = opts.action ?? 'stand';
    this.prevAction = this.action;
    this.blend = 1;
    this.fadeDur = 0.5;
    this.phase = Math.random() * 10;
    this.prevPhase = this.phase;
    this.walkSpeed = 1;

    this.poseA = makePose();
    this.poseB = makePose();
    this.poseOut = makePose();
    this.smoothed = makePose();

    // état de regard, lissé
    this.lookYaw = 0; this.lookPitch = 0;
    this.lookTargetYaw = 0; this.lookTargetPitch = 0;
    this.lookWeight = 0; this.lookTargetWeight = 0;

    // gestes ponctuels
    this.nodTime = -1;
    this.custom = null;      // fonction (p, t) appliquée à la place de l'action

    this.primed = false;
  }

  setAction(name, fade) {
    if (name === this.action) return;
    this.prevAction = this.action;
    this.prevPhase = this.phase;
    this.action = name;
    this.fadeDur = fade ?? ACTIONS[name]?.fade ?? 0.4;
    this.blend = 0;
  }

  /** Pose personnalisée, prioritaire sur l'action (pour les gestes scriptés). */
  setCustom(fn) { this.custom = fn; }
  clearCustom() { this.custom = null; }

  nod() { this.nodTime = 0; }

  /** Oriente le regard vers un point du monde. */
  lookAtWorld(target, weight = 1) {
    const p = this.root.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dy = target.y - (p.y + this.height * 0.9);
    const worldYaw = Math.atan2(dx, dz);
    let rel = worldYaw - this.root.rotation.y;
    while (rel >  Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    this.lookTargetYaw = rel;
    this.lookTargetPitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.lookTargetWeight = weight;
  }
  clearLook() { this.lookTargetWeight = 0; }

  update(dt, time) {
    const cfg = ACTIONS[this.action] ?? ACTIONS.stand;
    const rate = cfg.rate * (this.action.startsWith('walk') || this.action === 'carry'
                             ? this.walkSpeed * 4.2 : 1);
    this.phase += dt * rate;
    this.prevPhase += dt * rate;

    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / this.fadeDur);
    const t = smooth(this.blend);

    zeroPose(this.poseA);
    zeroPose(this.poseB);

    if (this.custom) {
      this.custom(this.poseB, this.phase, this.variation);
      // on fond quand même depuis l'action précédente
      (ACTIONS[this.prevAction] ?? ACTIONS.stand).fn(this.poseA, this.prevPhase, this.variation);
    } else {
      (ACTIONS[this.prevAction] ?? ACTIONS.stand).fn(this.poseA, this.prevPhase, this.variation);
      cfg.fn(this.poseB, this.phase, this.variation);
    }
    blendPose(this.poseOut, this.poseA, this.poseB, t);

    // --- geste ponctuel : signe de tête
    if (this.nodTime >= 0) {
      this.nodTime += dt;
      const d = 0.9;
      if (this.nodTime > d) this.nodTime = -1;
      else addNod(this.poseOut, this.nodTime / d);
    }

    // --- regard, lissé
    const lk = Math.min(1, dt * 3.2);
    this.lookYaw    = lerp(this.lookYaw, this.lookTargetYaw, lk);
    this.lookPitch  = lerp(this.lookPitch, this.lookTargetPitch, lk);
    this.lookWeight = lerp(this.lookWeight, this.lookTargetWeight, lk);
    if (this.lookWeight > 0.01) {
      addLookAt(this.poseOut, this.lookYaw, this.lookPitch, this.lookWeight);
    }

    // --- lissage de sortie (même filet de sécurité que pour la nage)
    if (!this.primed) {
      for (const n of BONE_NAMES) {
        const r = this.poseOut[n], s = this.smoothed[n];
        s[0] = r[0]; s[1] = r[1]; s[2] = r[2];
      }
      this.primed = true;
    }
    const k = 1 - Math.exp(-SMOOTH_LAMBDA * dt);
    const maxStep = MAX_RATE * dt;
    for (const n of BONE_NAMES) {
      const r = this.poseOut[n], s = this.smoothed[n];
      for (let c = 0; c < 3; c++) {
        let d = (r[c] - s[c]) * k;
        if (d >  maxStep) d =  maxStep;
        if (d < -maxStep) d = -maxStep;
        s[c] += d;
      }
      const bone = this.bones[n];
      if (!bone) continue;
      if (this.rest) {
        // Rig Mixamo : les os ont une rotation de repos non nulle et leurs
        // axes locaux diffèrent du squelette maison. On convertit les axes,
        // puis on compose par-dessus la pose de repos au lieu de l'écraser.
        const m = remapRotation(n, s);
        _q.setFromEuler(_e.set(m[0], m[1], m[2]));
        bone.quaternion.copy(this.rest[n]).multiply(_q);
      } else {
        bone.rotation.set(s[0], s[1], s[2]);
      }
    }
  }
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export const ACTION_LIST = Object.keys(ACTIONS);
