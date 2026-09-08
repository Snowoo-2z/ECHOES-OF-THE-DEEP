// ============================================================================
//  cinematic.js — Moteur de cinématique
// ----------------------------------------------------------------------------
//  Une cinématique est une liste de plans (shots). Chaque plan a une durée,
//  une fonction de caméra, et des évènements datés (sous-titres, gestes,
//  changements d'action des acteurs).
//
//  Le moteur gère : timeline, mouvements de caméra, fondus, letterbox,
//  sous-titres, saut de plan et saut complet.
// ============================================================================
import * as THREE from 'three';

const clamp01 = t => Math.max(0, Math.min(1, t));
export const Ease = {
  linear: t => t,
  in:     t => t * t,
  out:    t => 1 - (1 - t) * (1 - t),
  inOut:  t => t * t * (3 - 2 * t),
  soft:   t => t * t * t * (t * (t * 6 - 15) + 10),
};

// ============================================================================
//  MOUVEMENTS DE CAMÉRA
//  Chaque helper renvoie une fonction (camera, u) où u ∈ [0,1] est
//  l'avancement du plan.
// ============================================================================
export const Cam = {
  /** Caméra fixe. */
  still(pos, look) {
    const p = new THREE.Vector3(...pos), l = new THREE.Vector3(...look);
    return (cam) => { cam.position.copy(p); cam.lookAt(l); };
  },

  /** Travelling : la position et la cible se déplacent. */
  move(fromPos, toPos, fromLook, toLook, ease = Ease.inOut) {
    const a = new THREE.Vector3(...fromPos), b = new THREE.Vector3(...toPos);
    const la = new THREE.Vector3(...fromLook), lb = new THREE.Vector3(...toLook);
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    return (cam, u) => {
      const e = ease(u);
      p.lerpVectors(a, b, e); l.lerpVectors(la, lb, e);
      cam.position.copy(p); cam.lookAt(l);
    };
  },

  /** Orbite autour d'un point. */
  orbit(center, radius, height, angFrom, angTo, ease = Ease.inOut) {
    const c = new THREE.Vector3(...center);
    return (cam, u) => {
      const a = angFrom + (angTo - angFrom) * ease(u);
      cam.position.set(c.x + Math.sin(a) * radius, c.y + height, c.z + Math.cos(a) * radius);
      cam.lookAt(c);
    };
  },

  /** Suit une cible mobile (fonction renvoyant un Vector3). */
  follow(getTarget, offset, lookOffset = [0, 0, 0], smoothing = 0) {
    const off = new THREE.Vector3(...offset);
    const lo = new THREE.Vector3(...lookOffset);
    const desired = new THREE.Vector3(), look = new THREE.Vector3();
    let first = true;
    return (cam, u, dt) => {
      const tgt = getTarget();
      desired.copy(tgt).add(off);
      if (smoothing > 0 && !first) {
        cam.position.lerp(desired, Math.min(1, dt * smoothing));
      } else {
        cam.position.copy(desired);
      }
      first = false;
      look.copy(tgt).add(lo);
      cam.lookAt(look);
    };
  },

  /** Combine un mouvement et un léger tremblement (caméra portée). */
  handheld(base, amount = 1) {
    const tmp = new THREE.Vector3();
    return (cam, u, dt, t) => {
      base(cam, u, dt, t);
      const a = 0.012 * amount;
      tmp.set(
        Math.sin(t * 1.7) * Math.sin(t * 0.6) * a,
        Math.sin(t * 2.3 + 1.4) * Math.sin(t * 0.8) * a,
        Math.sin(t * 1.1 + 2.7) * a * 0.6,
      );
      cam.position.add(tmp);
    };
  },
};

// ============================================================================
//  LE LECTEUR DE CINÉMATIQUE
// ============================================================================
export class CinematicPlayer {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {Object} ui  { subtitle, speaker, letterbox, fade, skipHint, title }
   */
  constructor(camera, ui) {
    this.camera = camera;
    this.ui = ui;
    this.shots = [];
    this.index = -1;
    this.shotTime = 0;
    this.totalTime = 0;
    this.playing = false;
    this.finished = false;
    this.onEnd = null;

    this.fadeAlpha = 1;         // 1 = noir complet
    this.fadeTarget = 0;
    this.fadeSpeed = 1.2;

    this.subtitle = null;       // { text, speaker, until }
    this.letterboxOn = false;

    this._firedEvents = new Set();
  }

  load(shots) {
    this.shots = shots;
    this.index = -1;
    this.shotTime = 0;
    this.totalTime = 0;
    this.finished = false;
  }

  get duration() {
    return this.shots.reduce((a, s) => a + s.duration, 0);
  }

  play() {
    this.playing = true;
    this.setLetterbox(true);
    this._nextShot();
  }

  stop() {
    this.playing = false;
    this.setLetterbox(false);
    this._setSubtitle(null);
  }

  /** Passe au plan suivant. */
  skipShot() {
    if (!this.playing) return;
    this._nextShot();
  }

  /** Termine immédiatement toute la cinématique. */
  skipAll() {
    if (!this.playing) return;
    this.index = this.shots.length;
    this._finish();
  }

  _nextShot() {
    this.index++;
    this.shotTime = 0;
    this._firedEvents.clear();
    this._setSubtitle(null);

    if (this.index >= this.shots.length) return this._finish();

    const shot = this.shots[this.index];
    if (shot.onEnter) shot.onEnter();
    // fondu d'entrée éventuel
    if (shot.fadeIn !== undefined) {
      this.fadeAlpha = 1;
      this.fadeTarget = 0;
      this.fadeSpeed = 1 / Math.max(0.05, shot.fadeIn);
    }
  }

  _finish() {
    this.playing = false;
    this.finished = true;
    this._setSubtitle(null);
    this.setLetterbox(false);
    if (this.onEnd) this.onEnd();
  }

  setLetterbox(on) {
    if (this.letterboxOn === on) return;
    this.letterboxOn = on;
    if (this.ui.letterbox) {
      this.ui.letterbox.classList.toggle('on', on);
    }
  }

  fadeTo(alpha, seconds) {
    this.fadeTarget = alpha;
    this.fadeSpeed = 1 / Math.max(0.05, seconds);
  }

  _setSubtitle(sub) {
    this.subtitle = sub;
    const el = this.ui.subtitle, sp = this.ui.speaker;
    if (!el) return;
    if (!sub) {
      el.classList.remove('on');
      return;
    }
    el.textContent = sub.text;
    el.classList.toggle('narration', !!sub.narration);
    if (sp) {
      sp.textContent = sub.speaker || '';
      sp.style.display = sub.speaker ? 'block' : 'none';
    }
    el.classList.add('on');
  }

  update(dt) {
    // fondu
    if (this.fadeAlpha !== this.fadeTarget) {
      const d = this.fadeSpeed * dt;
      this.fadeAlpha += Math.sign(this.fadeTarget - this.fadeAlpha) *
                        Math.min(d, Math.abs(this.fadeTarget - this.fadeAlpha));
      if (this.ui.fade) this.ui.fade.style.opacity = this.fadeAlpha;
    }

    if (!this.playing || this.index < 0 || this.index >= this.shots.length) return;

    const shot = this.shots[this.index];
    this.shotTime += dt;
    this.totalTime += dt;
    const u = clamp01(this.shotTime / shot.duration);

    // --- évènements datés
    if (shot.events) {
      for (let i = 0; i < shot.events.length; i++) {
        const ev = shot.events[i];
        if (this._firedEvents.has(i)) continue;
        if (this.shotTime >= ev.at) {
          this._firedEvents.add(i);
          if (ev.say) {
            this._setSubtitle({
              text: ev.say, speaker: ev.speaker,
              narration: ev.narration,
            });
          }
          if (ev.clear) this._setSubtitle(null);
          if (ev.do) ev.do();
        }
      }
    }

    // --- mise à jour du plan (acteurs, props…)
    if (shot.update) shot.update(this.shotTime, u, dt);

    // --- caméra
    if (shot.camera) shot.camera(this.camera, u, dt, this.shotTime);

    // --- fondu de sortie automatique
    if (shot.fadeOut !== undefined) {
      const remain = shot.duration - this.shotTime;
      if (remain <= shot.fadeOut && this.fadeTarget !== 1) {
        this.fadeTo(1, Math.max(0.05, remain));
      }
    }

    if (this.shotTime >= shot.duration) this._nextShot();
  }
}
