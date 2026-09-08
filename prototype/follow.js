// ============================================================================
//  follow.js — Segment jouable : suivre le vieil homme jusqu'au chef
// ----------------------------------------------------------------------------
//  Contrôle à la troisième personne sur le plateau du village. Le guide
//  avance par étapes : il marche jusqu'au point suivant, attend si le joueur
//  traîne, et s'arrête à l'arrivée. Fin du segment prévu pour l'instant.
// ============================================================================
import * as THREE from 'three';

const WALK_SPEED = 2.6;
const RUN_SPEED = 4.3;
const GUIDE_SPEED = 1.55;
const NEAR = 3.6;        // distance à laquelle le guide reprend sa route
const FAR = 7.0;         // distance au-delà de laquelle il attend

export class FollowSegment {
  /**
   * @param {Object} o { hero, guide, camera, village, ui, onArrive }
   */
  constructor(o) {
    this.hero = o.hero;
    this.guide = o.guide;
    this.camera = o.camera;
    this.village = o.village;
    this.ui = o.ui;
    this.onArrive = o.onArrive;

    this.active = false;
    this.arrived = false;
    this.keys = {};
    this.yaw = 0;
    this.pitch = -0.06;
    this.vel = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.time = 0;

    const G = this.village.groundY;
    const A = this.village.anchors;
    // Itinéraire jusqu'à la maison du chef (la plus grande, au nord)
    this.chiefDoor = new THREE.Vector3(1.0, G, -8.2);
    this.path = [
      new THREE.Vector3(A.lookout.x + 5.0, G, A.lookout.z - 4.5),
      new THREE.Vector3(-4.0, G, 2.0),
      new THREE.Vector3(-1.0, G, -2.5),
      this.chiefDoor.clone().add(new THREE.Vector3(0.2, 0, 1.8)),
    ];
    this.leg = 0;
    this.guideWaiting = false;

    this._bind();
  }

  _bind() {
    this._kd = (e) => {
      if (!this.active) return;
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    };
    this._ku = (e) => { this.keys[e.code] = false; };
    this._mm = (e) => {
      if (!this.active || !document.pointerLockElement) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0016;
      this.pitch = Math.max(-0.55, Math.min(0.5, this.pitch));
    };
    addEventListener('keydown', this._kd);
    addEventListener('keyup', this._ku);
    addEventListener('mousemove', this._mm);
  }

  start() {
    this.active = true;
    this.arrived = false;
    this.time = 0;
    this.leg = 0;
    this.hero.setAction('stand');
    this.guide.setAction('standOld');
    // caméra derrière le héros, orientée vers le village
    const d = new THREE.Vector3().subVectors(this.path[0], this.hero.root.position);
    this.yaw = Math.atan2(d.x, d.z);
    this.camPos.copy(this.hero.root.position);
    if (this.ui.objective) {
      this.ui.objective.textContent = 'Suivre le vieil homme';
      this.ui.objective.classList.add('on');
    }
  }

  stop() {
    this.active = false;
    if (this.ui.objective) this.ui.objective.classList.remove('on');
  }

  dispose() {
    removeEventListener('keydown', this._kd);
    removeEventListener('keyup', this._ku);
    removeEventListener('mousemove', this._mm);
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const G = this.village.groundY;
    const hp = this.hero.root.position;
    const gp = this.guide.root.position;

    // ---------------------------------------------------- déplacement joueur
    const k = this.keys;
    let ix = 0, iz = 0;
    if (k['KeyW'] || k['KeyZ'] || k['ArrowUp'])    iz += 1;
    if (k['KeyS'] || k['ArrowDown'])               iz -= 1;
    if (k['KeyA'] || k['KeyQ'] || k['ArrowLeft'])  ix -= 1;
    if (k['KeyD'] || k['ArrowRight'])              ix += 1;
    const running = k['ShiftLeft'] || k['ShiftRight'];
    const speed = running ? RUN_SPEED : WALK_SPEED;

    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const move = new THREE.Vector3(fx * iz + fz * ix, 0, fz * iz - fx * ix);
    const moving = move.lengthSq() > 1e-4;
    if (moving) move.normalize().multiplyScalar(speed);

    this.vel.lerp(move, Math.min(1, dt * 9));
    hp.addScaledVector(this.vel, dt);
    hp.y = G;

    // limite : rester sur le plateau
    const r = Math.hypot(hp.x, hp.z);
    const RMAX = 15.2;
    if (r > RMAX) { hp.x *= RMAX / r; hp.z *= RMAX / r; }

    // orientation + animation du héros
    const sp = this.vel.length();
    if (sp > 0.15) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.hero.root.rotation.y;
      while (d >  Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.hero.root.rotation.y += d * Math.min(1, dt * 9);
    }
    this.hero.setAction(sp > 0.3 ? 'walk' : 'stand');
    this.hero.walkSpeed = Math.max(0.4, sp / WALK_SPEED);

    // ----------------------------------------------------------- le guide
    if (!this.arrived) {
      const dist = Math.hypot(hp.x - gp.x, hp.z - gp.z);
      const target = this.path[Math.min(this.leg, this.path.length - 1)];
      const toTarget = new THREE.Vector3(target.x - gp.x, 0, target.z - gp.z);
      const dTarget = toTarget.length();

      // Il attend si le joueur est trop loin. Hystérésis : une fois qu'il
      // s'est arrêté, il ne repart que si le joueur s'est vraiment rapproché
      // (évite qu'il reparte dès que le joueur franchit FAR à reculons).
      if (dist > FAR) this.guideWaiting = true;
      else if (dist < NEAR) this.guideWaiting = false;

      if (!this.guideWaiting && dTarget > 0.35) {
        toTarget.normalize();
        gp.addScaledVector(toTarget, GUIDE_SPEED * dt);
        gp.y = G;
        const ty = Math.atan2(toTarget.x, toTarget.z);
        let d = ty - this.guide.root.rotation.y;
        while (d >  Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.guide.root.rotation.y += d * Math.min(1, dt * 5);
        this.guide.setAction('walkOld');
        this.guide.walkSpeed = 0.62;
        this.guide.clearLook();
      } else if (this.guideWaiting) {
        // il se retourne et attend
        this.guide.setAction('standOld');
        this.guide.lookAtWorld(
          new THREE.Vector3(hp.x, hp.y + 1.5, hp.z), 1);
      } else {
        // étape atteinte
        if (this.leg < this.path.length - 1) {
          this.leg++;
        } else {
          this.guide.setAction('standOld');
          this.guide.lookAtWorld(new THREE.Vector3(hp.x, hp.y + 1.5, hp.z), 1);
          // le joueur doit rejoindre le guide devant la porte
          if (dist < 2.6) {
            this.arrived = true;
            if (this.ui.objective) {
              this.ui.objective.textContent = 'La maison du chef';
            }
            if (this.onArrive) this.onArrive();
          }
        }
      }
    } else {
      this.guide.setAction('standOld');
      this.guide.lookAtWorld(new THREE.Vector3(hp.x, hp.y + 1.5, hp.z), 1);
    }

    // ------------------------------------------------------------- caméra
    const dist = 4.6, height = 2.15;
    const want = new THREE.Vector3(
      hp.x - Math.sin(this.yaw) * dist,
      hp.y + height + this.pitch * 2.2,
      hp.z - Math.cos(this.yaw) * dist,
    );
    this.camPos.lerp(want, Math.min(1, dt * 6));
    // ne pas passer sous le sol
    this.camPos.y = Math.max(this.camPos.y, G + 0.8);
    this.camera.position.copy(this.camPos);
    this.camLook.lerp(new THREE.Vector3(hp.x, hp.y + 1.35, hp.z), Math.min(1, dt * 9));
    this.camera.lookAt(this.camLook);
  }
}
