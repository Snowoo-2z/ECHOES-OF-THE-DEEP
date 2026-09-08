// ============================================================================
//  animation.js — Système d'animation procédurale du plongeur
// ----------------------------------------------------------------------------
//  Le modèle n'ayant aucune animation exportée, tout est généré à la volée.
//
//  Principe : chaque état (IDLE, CRUISE, SPRINT…) est une fonction qui écrit
//  une pose dans un buffer d'euler par os. L'animateur mélange (blend) la pose
//  de l'état sortant et celle de l'état entrant pendant la transition, ce qui
//  évite tout claquement. Des couches additives (respiration, turbulence,
//  regard, inclinaison en virage) sont appliquées par-dessus.
// ============================================================================
import * as THREE from 'three';
import { BONE_NAMES } from './rig.js';

// ---------------------------------------------------------------- OUTILS
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Lissage type easeInOut, pour des transitions sans à-coup
const smooth = t => t * t * (3 - 2 * t);

/** Pose = { boneName: [rx, ry, rz] }. Buffer réutilisé, zéro allocation/frame. */
function makePose() {
  const p = {};
  for (const n of BONE_NAMES) p[n] = [0, 0, 0];
  return p;
}
function zeroPose(p) {
  for (const n of BONE_NAMES) { const r = p[n]; r[0] = r[1] = r[2] = 0; }
}
function blendPose(out, a, b, t) {
  for (const n of BONE_NAMES) {
    const ra = a[n], rb = b[n], ro = out[n];
    ro[0] = lerp(ra[0], rb[0], t);
    ro[1] = lerp(ra[1], rb[1], t);
    ro[2] = lerp(ra[2], rb[2], t);
  }
}

// ============================================================================
//  LES POSES DE BASE
//  Convention : bras en T-pose au repos. rotation.z rabat le bras le long du
//  corps (+ à gauche, - à droite). rotation.x fait pivoter vers l'avant/arrière.
// ============================================================================

const ARM_DOWN = 1.30;   // angle pour ramener un bras à la verticale

// --- IDLE : dérive immobile, position fœtale légère, bras qui flottent ------
function poseIdle(p, t) {
  const s  = Math.sin(t * 0.9);
  const s2 = Math.sin(t * 0.62 + 1.1);
  const s3 = Math.sin(t * 0.45 + 2.3);

  // Corps légèrement recroquevillé, comme en apesanteur
  p.hips[0]  = 0.10 + s * 0.035;
  p.spine[0] = 0.07 + s2 * 0.03;
  p.chest[0] = -0.05 + s * 0.025;
  p.chest[1] = s3 * 0.06;
  p.neck[0]  = -0.12 - s2 * 0.03;
  p.head[1]  = s3 * 0.10;
  p.head[0]  = s2 * 0.04;

  // Bras ouverts, ballotés par l'eau
  p.shoulderL[2] =  ARM_DOWN - 0.34 + s * 0.10;
  p.shoulderR[2] = -ARM_DOWN + 0.34 - s * 0.10;
  p.shoulderL[0] =  0.16 + s2 * 0.13;
  p.shoulderR[0] =  0.16 - s2 * 0.13;
  p.elbowL[1] = -0.52 - s3 * 0.12;
  p.elbowR[1] =  0.52 + s3 * 0.12;
  p.handL[0] = s * 0.16;
  p.handR[0] = -s * 0.16;

  // Jambes fléchies, en suspension
  p.thighL[0] = 0.30 + s2 * 0.07;
  p.thighR[0] = 0.26 - s2 * 0.07;
  p.thighL[2] = 0.09;
  p.thighR[2] = -0.09;
  p.kneeL[0]  = 0.46 + s * 0.09;
  p.kneeR[0]  = 0.42 - s * 0.09;
  p.footL[0]  = -0.16 + s3 * 0.10;
  p.footR[0]  = -0.13 - s3 * 0.10;
}

// --- CRUISE : nage de croisière, battement de palmes régulier ---------------
function poseCruise(p, t) {
  const s  = Math.sin(t);
  const s2 = Math.sin(t + 0.85);   // tibias en retard : effet de fouet
  const s3 = Math.sin(t * 0.5);

  // Corps allongé, tendu vers l'avant
  p.hips[0]  = -0.04 - s3 * 0.045;
  p.spine[0] = 0.03 + s3 * 0.05;
  p.chest[0] = 0.02 - s3 * 0.035;
  p.chest[1] = s3 * 0.055;
  p.neck[0]  = -0.24;
  p.head[1]  = s3 * 0.05;

  // Battement de palmes alterné
  p.thighL[0] =  s * 0.40;
  p.thighR[0] = -s * 0.40;
  p.kneeL[0]  = 0.20 + s2 * 0.40;
  p.kneeR[0]  = 0.20 - s2 * 0.40;
  p.footL[0]  = -s2 * 0.34;
  p.footR[0]  =  s2 * 0.34;

  // Bras semi-repliés devant, mains qui guident
  p.shoulderL[2] =  ARM_DOWN - 0.10;
  p.shoulderR[2] = -ARM_DOWN + 0.10;
  p.shoulderL[0] =  0.30 + s3 * 0.07;
  p.shoulderR[0] =  0.30 - s3 * 0.07;
  p.elbowL[1] = -0.62;
  p.elbowR[1] =  0.62;
  p.elbowL[0] = 0.18;
  p.elbowR[0] = 0.18;
}

// --- SPRINT : nage puissante, corps profilé, bras collés -------------------
function poseSprint(p, t) {
  const s  = Math.sin(t);
  const s2 = Math.sin(t + 0.7);
  const s3 = Math.sin(t * 0.5);

  // Corps très allongé, hydrodynamique
  p.hips[0]  = -0.10 - s3 * 0.07;
  p.spine[0] = 0.06 + s3 * 0.075;
  p.chest[0] = 0.05 - s3 * 0.05;
  p.neck[0]  = -0.34;

  // Battement ample et rapide
  p.thighL[0] =  s * 0.60;
  p.thighR[0] = -s * 0.60;
  p.kneeL[0]  = 0.24 + s2 * 0.56;
  p.kneeR[0]  = 0.24 - s2 * 0.56;
  p.footL[0]  = -s2 * 0.44;
  p.footR[0]  =  s2 * 0.44;

  // Bras plaqués le long du corps, mains vers l'arrière
  p.shoulderL[2] =  ARM_DOWN + 0.04;
  p.shoulderR[2] = -ARM_DOWN - 0.04;
  p.shoulderL[0] = -0.06;
  p.shoulderR[0] = -0.06;
  p.elbowL[1] = -0.16;
  p.elbowR[1] =  0.16;
  p.handL[0] = 0.10;
  p.handR[0] = 0.10;
}

// --- ASCEND : remontée, corps vertical, brasse vers le bas ------------------
function poseAscend(p, t) {
  const s  = Math.sin(t * 0.85);
  const s2 = Math.sin(t * 0.85 + 0.9);

  p.hips[0]  = 0.16;
  p.spine[0] = 0.10;
  p.chest[0] = -0.06;
  p.neck[0]  = 0.10;      // regard vers le haut
  p.head[0]  = 0.14;

  // Ciseaux de jambes, plus lents et plus amples
  p.thighL[0] =  s * 0.50 + 0.14;
  p.thighR[0] = -s * 0.50 + 0.14;
  p.kneeL[0]  = 0.34 + s2 * 0.34;
  p.kneeR[0]  = 0.34 - s2 * 0.34;
  p.footL[0]  = -s2 * 0.26;
  p.footR[0]  =  s2 * 0.26;

  // Bras qui poussent l'eau vers le bas
  p.shoulderL[2] =  ARM_DOWN - 0.50 + s * 0.42;
  p.shoulderR[2] = -ARM_DOWN + 0.50 - s * 0.42;
  p.shoulderL[0] =  0.20;
  p.shoulderR[0] =  0.20;
  p.elbowL[1] = -0.72 - s2 * 0.26;
  p.elbowR[1] =  0.72 + s2 * 0.26;
}

// --- DESCEND : piqué vers le fond, corps tendu tête en avant ---------------
function poseDescend(p, t) {
  const s  = Math.sin(t * 1.15);
  const s2 = Math.sin(t * 1.15 + 0.75);
  const s3 = Math.sin(t * 0.55);

  p.hips[0]  = -0.14;
  p.spine[0] = -0.05 + s3 * 0.04;
  p.chest[0] = -0.05;
  p.neck[0]  = -0.30;     // regard vers le bas
  p.head[0]  = -0.16;

  // Battement resserré
  p.thighL[0] =  s * 0.34 - 0.10;
  p.thighR[0] = -s * 0.34 - 0.10;
  p.kneeL[0]  = 0.16 + s2 * 0.30;
  p.kneeR[0]  = 0.16 - s2 * 0.30;
  p.footL[0]  = -s2 * 0.26;
  p.footR[0]  =  s2 * 0.26;

  // Bras le long du corps, mains vers l'avant
  p.shoulderL[2] =  ARM_DOWN + 0.06;
  p.shoulderR[2] = -ARM_DOWN - 0.06;
  p.shoulderL[0] =  0.42 + s3 * 0.06;
  p.shoulderR[0] =  0.42 - s3 * 0.06;
  p.elbowL[1] = -0.42;
  p.elbowR[1] =  0.42;
  p.elbowL[0] =  0.22;
  p.elbowR[0] =  0.22;
}

// --- BRAKE : freinage, bras écartés face au courant ------------------------
function poseBrake(p, t) {
  const s = Math.sin(t * 1.6);

  p.hips[0]  = 0.24;
  p.spine[0] = 0.16;
  p.chest[0] = -0.12;
  p.neck[0]  = -0.06;

  // Jambes repliées, en position d'arrêt
  p.thighL[0] = 0.52 + s * 0.05;
  p.thighR[0] = 0.48 - s * 0.05;
  p.thighL[2] = 0.14;
  p.thighR[2] = -0.14;
  p.kneeL[0]  = 0.72;
  p.kneeR[0]  = 0.68;
  p.footL[0]  = -0.24;
  p.footR[0]  = -0.20;

  // Bras grands ouverts pour freiner
  p.shoulderL[2] =  ARM_DOWN - 0.80;
  p.shoulderR[2] = -ARM_DOWN + 0.80;
  p.shoulderL[0] =  0.52 + s * 0.06;
  p.shoulderR[0] =  0.52 - s * 0.06;
  p.elbowL[1] = -0.86;
  p.elbowR[1] =  0.86;
  p.handL[0] = 0.28;
  p.handR[0] = 0.28;
}

// --- BACK : nage en marche arrière -----------------------------------------
function poseBackward(p, t) {
  const s  = Math.sin(t * 0.9);
  const s2 = Math.sin(t * 0.9 + 0.8);

  p.hips[0]  = 0.20;
  p.spine[0] = 0.12;
  p.chest[0] = -0.08;
  p.neck[0]  = -0.10;

  p.thighL[0] = 0.36 + s * 0.34;
  p.thighR[0] = 0.32 - s * 0.34;
  p.kneeL[0]  = 0.50 - s2 * 0.28;
  p.kneeR[0]  = 0.46 + s2 * 0.28;
  p.footL[0]  = -0.18;
  p.footR[0]  = -0.15;

  // Brasse inversée : les mains poussent l'eau vers l'avant
  p.shoulderL[2] =  ARM_DOWN - 0.62 - s * 0.30;
  p.shoulderR[2] = -ARM_DOWN + 0.62 + s * 0.30;
  p.shoulderL[0] =  0.30 + s2 * 0.24;
  p.shoulderR[0] =  0.30 - s2 * 0.24;
  p.elbowL[1] = -0.78;
  p.elbowR[1] =  0.78;
}

// ============================================================================
//  ÉTATS
//  speedMul : vitesse d'avancement de la phase du cycle
// ============================================================================
const STATES = {
  IDLE:    { fn: poseIdle,     speedMul: 1.00, fade: 0.45 },
  CRUISE:  { fn: poseCruise,   speedMul: 1.00, fade: 0.30 },
  SPRINT:  { fn: poseSprint,   speedMul: 1.55, fade: 0.28 },
  ASCEND:  { fn: poseAscend,   speedMul: 0.90, fade: 0.35 },
  DESCEND: { fn: poseDescend,  speedMul: 1.00, fade: 0.35 },
  BRAKE:   { fn: poseBrake,    speedMul: 1.00, fade: 0.20 },
  BACK:    { fn: poseBackward, speedMul: 0.90, fade: 0.35 },
};

// ============================================================================
//  L'ANIMATEUR
// ============================================================================

// Lissage de sortie : réactivité vs douceur
const SMOOTH_LAMBDA = 26;    // plus haut = plus réactif
const MAX_RATE = 7.0;        // rad/s max par articulation (~400 deg/s)
// Anti-oscillation : durée minimale dans un état avant d'en changer
const MIN_STATE_TIME = 0.16; // s
export class DiverAnimator {
  constructor(bones) {
    this.bones = bones;

    this.state = 'IDLE';
    this.prevState = 'IDLE';
    this.blend = 1;          // 1 = transition terminée
    this.fadeDur = 0.3;

    this.phase = 0;          // phase du cycle courant
    this.prevPhase = 0;      // phase figée de l'état sortant

    // buffers réutilisés
    this.poseA = makePose();
    this.poseB = makePose();
    this.poseOut = makePose();

    // couches additives lissées
    this.lean = 0;           // inclinaison en virage
    this.turnRate = 0;
    this.breath = 0;
    this.turbulence = 0;
    this.stateTime = 0;

    // pose lissée réellement appliquée au squelette
    this.smoothed = makePose();
    this.primed = false;
  }

  /** Change d'état avec un fondu. */
  setState(next) {
    if (next === this.state) return;
    // évite le clignotement entre deux états quand le joueur est à la
    // frontière (ex. vitesse pile au seuil CRUISE/SPRINT)
    if (this.stateTime < MIN_STATE_TIME) return;
    this.prevState = this.state;
    this.prevPhase = this.phase;
    this.state = next;
    this.fadeDur = STATES[next].fade;
    this.blend = 0;
    this.stateTime = 0;
  }

  /**
   * Choisit l'état en fonction du contexte de jeu.
   * @param {Object} ctx
   *   speed       vitesse absolue (m/s)
   *   inputFwd    -1 arrière / 0 / +1 avant
   *   inputUp     -1 descend / 0 / +1 monte
   *   moving      une touche de direction est enfoncée
   *   braking     décélération forte sans input
   *   vy          vitesse verticale
   */
  pickState(ctx) {
    const { speed, inputFwd, inputUp, moving, braking, vy } = ctx;

    if (braking && speed > 3.2)          return 'BRAKE';
    if (!moving)                          return speed > 2.2 ? 'CRUISE' : 'IDLE';
    if (inputFwd < 0)                     return 'BACK';
    // Mouvement vertical dominant ?
    if (inputUp > 0 && Math.abs(vy) > 1.6 && inputFwd === 0) return 'ASCEND';
    if (inputUp < 0 && Math.abs(vy) > 1.6 && inputFwd === 0) return 'DESCEND';
    if (speed > 8.5)                      return 'SPRINT';
    return 'CRUISE';
  }

  /**
   * @param {number} dt
   * @param {Object} ctx  contexte de jeu (voir pickState) + turnInput, depth01
   */
  update(dt, ctx) {
    const b = this.bones;
    if (!b) return;

    // --- sélection d'état
    this.stateTime += dt;
    this.setState(this.pickState(ctx));

    // --- avancement de la phase, indexé sur la vitesse
    const cfg = STATES[this.state];
    const rate = (1.1 + ctx.speed * 0.62) * cfg.speedMul;
    this.phase += dt * rate;
    this.prevPhase += dt * rate * 0.85;

    // --- fondu entre l'état sortant et l'état entrant
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / this.fadeDur);
    const t = smooth(this.blend);

    zeroPose(this.poseA);
    zeroPose(this.poseB);
    STATES[this.prevState].fn(this.poseA, this.prevPhase);
    cfg.fn(this.poseB, this.phase);
    blendPose(this.poseOut, this.poseA, this.poseB, t);

    // ================= COUCHES ADDITIVES =================
    const out = this.poseOut;

    // --- Respiration : subtile, s'accélère en profondeur et à l'effort
    const breathRate = 0.55 + ctx.speed * 0.045 + (ctx.depth01 || 0) * 0.5;
    this.breath += dt * breathRate;
    const br = Math.sin(this.breath * Math.PI * 2);
    out.chest[0] += br * 0.022;
    out.spine[0] += br * 0.012;
    out.neck[0]  -= br * 0.010;

    // --- Inclinaison en virage (banking), comme un avion
    const targetLean = clamp(-(ctx.turnInput || 0) * 5.5, -0.42, 0.42);
    this.lean = lerp(this.lean, targetLean, Math.min(1, dt * 3.4));
    out.hips[2]  += this.lean * 0.42;
    out.spine[2] += this.lean * 0.34;
    out.chest[2] += this.lean * 0.26;
    out.head[2]  -= this.lean * 0.30;   // la tête reste droite
    // le corps braque légèrement dans le virage
    out.spine[1] += this.lean * 0.16;
    out.chest[1] -= this.lean * 0.10;

    // --- Turbulence de l'eau : bruit lent, plus fort à faible vitesse
    this.turbulence += dt;
    const tb = 1 - clamp(ctx.speed / 10, 0, 0.75);
    const n1 = Math.sin(this.turbulence * 0.73) * Math.sin(this.turbulence * 0.31 + 1.7);
    const n2 = Math.sin(this.turbulence * 0.54 + 2.2) * Math.sin(this.turbulence * 0.22);
    out.hips[1]  += n1 * 0.035 * tb;
    out.spine[0] += n2 * 0.030 * tb;
    out.chest[2] += n1 * 0.026 * tb;
    out.handL[0] += n2 * 0.10 * tb;
    out.handR[0] -= n1 * 0.10 * tb;
    out.footL[0] += n1 * 0.06 * tb;
    out.footR[0] -= n2 * 0.06 * tb;

    // --- Regard : la tête compense le tangage de la caméra
    const look = clamp(ctx.lookPitch || 0, -0.9, 0.9);
    out.neck[0] += look * 0.30;
    out.head[0] += look * 0.22;

    // ================= LISSAGE DE SORTIE =================
    // Filet de sécurité : quel que soit l'état ou la transition, aucune
    // articulation ne peut bouger plus vite que MAX_RATE. Cela garantit
    // qu'aucun claquement n'est visible, même si la logique d'état
    // oscille entre deux états sur des frames consécutives.
    const k = 1 - Math.exp(-SMOOTH_LAMBDA * dt);   // lissage indépendant du framerate
    const maxStep = MAX_RATE * dt;
    const sm = this.smoothed;

    for (const n of BONE_NAMES) {
      const r = out[n], s = sm[n];
      for (let c = 0; c < 3; c++) {
        let d = (r[c] - s[c]) * k;
        if (d >  maxStep) d =  maxStep;
        if (d < -maxStep) d = -maxStep;
        s[c] += d;
      }
      b[n].rotation.set(s[0], s[1], s[2]);
    }
  }

  /** Pose statique de repos (avant la première frame d'animation). */
  applyRest() {
    zeroPose(this.poseOut);
    poseIdle(this.poseOut, 0);
    for (const n of BONE_NAMES) {
      const r = this.poseOut[n], s = this.smoothed[n];
      s[0] = r[0]; s[1] = r[1]; s[2] = r[2];
      this.bones[n].rotation.set(r[0], r[1], r[2]);
    }
    this.primed = true;
  }
}

export const STATE_LIST = Object.keys(STATES);
