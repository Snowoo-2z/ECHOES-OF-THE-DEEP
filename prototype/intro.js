// ============================================================================
//  intro.js — Cinématique d'introduction
// ----------------------------------------------------------------------------
//  5 plans + ouverture sur noir, puis passage au segment jouable
//  « suivre le vieil homme jusqu'au chef ».
//
//  Les répliques sont en sous-titres. Les timings sont calés pour laisser le
//  temps de lire ; ils seront à réajuster quand l'audio arrivera.
// ============================================================================
import * as THREE from 'three';
import { Cam, Ease } from './cinematic.js';
import { Actor } from './acting.js';
import { loadCharacter } from './characters.js';
import { Props } from './village.js';
import * as Acting from './acting.js';

// Nom du personnage principal — à figer plus tard (cf. name.md)
export const HERO_NAME = 'Naïa';

/**
 * Construit la scène de la cinématique et renvoie la liste des plans.
 * @param {Object} ctx { scene, camera, village, ocean }
 */
export async function buildIntro(ctx) {
  const { scene, village } = ctx;
  const A = village.anchors;
  const G = village.groundY;

  // ------------------------------------------------------------ ACTEURS
  const [heroC, oldWomanC, oldManC, diverC, childC,
         v1C, v2C, v3C, v4C] = await Promise.all([
    loadCharacter('player'), loadCharacter('oldWoman'), loadCharacter('oldMan'),
    loadCharacter('diver'), loadCharacter('child'),
    loadCharacter('villager'), loadCharacter('villager'),
    loadCharacter('villager'), loadCharacter('villager'),
  ]);

  const hero     = new Actor(heroC,     { action: 'workStand', variation: 0.1 });
  const oldWoman = new Actor(oldWomanC, { action: 'standOld',  variation: 0.7 });
  const oldMan   = new Actor(oldManC,   { action: 'standOld',  variation: 0.3 });
  const diver    = new Actor(diverC,    { action: 'stand',     variation: 0.5 });
  const child    = new Actor(childC,    { action: 'stand',     variation: 0.9 });
  const vills = [
    new Actor(v1C, { action: 'crouchWork', variation: 0.15 }),
    new Actor(v2C, { action: 'workStand',  variation: 0.42 }),
    new Actor(v3C, { action: 'carry',      variation: 0.66 }),
    new Actor(v4C, { action: 'crouchWork', variation: 0.88 }),
  ];
  const actors = [hero, oldWoman, oldMan, diver, child, ...vills];
  for (const a of actors) scene.add(a.root);

  const usingPlaceholders = [heroC, oldWomanC, oldManC, childC, v1C]
    .some(c => c.isPlaceholder);

  // ------------------------------------------------- PLACEMENT INITIAL
  const place = (actor, x, z, rotY, y = G) => {
    actor.root.position.set(x, y, z);
    actor.root.rotation.y = rotY;
  };

  place(hero, 3.0, -0.6, 2.5);
  place(oldWoman, -3.4, 4.3, -0.7);
  place(oldMan, 4.6, 0.4, -0.5);
  place(diver, A.dockEnd.x - 1.2, A.dockEnd.z - 1.0, -2.3, A.dockEnd.y + 0.1);
  place(child, -1.2, 5.4, 1.2);
  place(vills[0], -4.4, 6.2, 0.9);
  place(vills[1], -6.2, 1.4, 1.9);
  place(vills[2], 7.2, 2.0, -1.2);
  place(vills[3], 0.6, -7.6, 0.2);

  // ------------------------------------------------------------- PROPS
  const watch = Props.watch();
  const bulb = Props.bulb();
  const metalBox = Props.metalBox();
  const satchel = Props.satchel();
  const heroNet = Props.net();
  const bucket = Props.bucket();

  // filet dans les mains du héros
  hero.attach.handL.add(heroNet);
  heroNet.position.set(0.1, -0.05, 0.14);
  heroNet.scale.setScalar(1 / heroC.scale);

  // seau porté par un villageois
  vills[2].attach.handR.add(bucket);
  bucket.position.set(0, -0.16, 0);
  bucket.scale.setScalar(1 / v3C.scale);

  // sac du plongeur
  diver.attach.handL.add(satchel);
  satchel.position.set(0.05, -0.18, 0.05);
  satchel.scale.setScalar(1 / diverC.scale);
  satchel.visible = true;

  // montre dans la main de l'enfant (cachée au début)
  child.attach.handR.add(watch);
  watch.position.set(0, -0.04, 0.06);
  watch.scale.setScalar(1 / childC.scale);
  watch.visible = false;

  // objets posés au sol après le déballage (plan 3)
  const loot = new THREE.Group();
  loot.position.copy(A.dockEnd).add(new THREE.Vector3(-0.9, 0.12, -0.4));
  scene.add(loot);
  metalBox.position.set(-0.3, 0.1, 0);
  bulb.position.set(0.25, 0.08, 0.1);
  loot.add(metalBox, bulb);
  loot.visible = false;
  const bulbLight = bulb.userData.light;
  bulbLight.intensity = 0;

  // casque du plongeur, retiré au plan 3
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d9aa3, roughness: 0.4, metalness: 0.75 }),
  );
  helmet.visible = false;
  scene.add(helmet);

  // ------------------------------------------------------------ HELPERS
  const tmpV = new THREE.Vector3();
  const heroHead = () => tmpV.copy(hero.root.position).setY(hero.root.position.y + 1.55);

  /** Déplace un acteur en ligne droite entre deux points. */
  function walkTo(actor, from, to, u, faceTarget = true) {
    actor.root.position.lerpVectors(from, to, u);
    if (faceTarget) {
      const d = new THREE.Vector3().subVectors(to, from);
      if (d.lengthSq() > 1e-6) actor.root.rotation.y = Math.atan2(d.x, d.z);
    }
  }

  const updateAll = (dt, t) => { for (const a of actors) a.update(dt, t); };

  // ============================================================ LES PLANS
  const shots = [];

  // ------------------------------------------------------------------
  // OUVERTURE — noir complet, texte
  // ------------------------------------------------------------------
  shots.push({
    name: 'ouverture',
    duration: 6.0,
    camera: Cam.still([0, G + 40, 60], [0, G + 6, 0]),
    onEnter: () => { ctx.setTitleText('Il y a 200 ans, la mer a pris ce que l\'homme avait bâti.'); },
    update: (t, u, dt) => updateAll(dt, t),
    events: [
      { at: 0.0, do: () => ctx.showTitle(true) },
      { at: 4.4, do: () => ctx.showTitle(false) },
    ],
  });

  // ------------------------------------------------------------------
  // PLAN 1 — vue large sur l'île
  // ------------------------------------------------------------------
  shots.push({
    name: 'plan1-ile',
    duration: 14,
    fadeIn: 2.2,
    camera: Cam.handheld(
      Cam.move([46, 15, 40], [26, 9.5, 24], [0, G + 1.5, 0], [0, G + 1.2, 1], Ease.soft),
      0.8),
    update: (t, u, dt) => updateAll(dt, t),
    events: [
      { at: 2.6, say: 'Ici, on survit. On ne vit pas vraiment.',
        speaker: 'Vieille femme', narration: true },
      { at: 7.4, clear: true },
      { at: 7.6, do: () => {
          // un villageois traverse le plateau avec ses seaux
          vills[2].setAction('carry');
          vills[2].walkSpeed = 0.85;
        } },
    ],
  });

  // ------------------------------------------------------------------
  // PLAN 2 — le héros au travail, le vieil homme le rabroue
  // ------------------------------------------------------------------
  const p2From = new THREE.Vector3(6.6, G + 1.75, 1.6);
  const p2To   = new THREE.Vector3(4.5, G + 1.62, 0.9);
  shots.push({
    name: 'plan2-maison',
    duration: 18,
    camera: Cam.handheld(
      Cam.move([p2From.x, p2From.y, p2From.z], [p2To.x, p2To.y, p2To.z],
               [3.0, G + 1.45, -0.6], [3.0, G + 1.5, -0.6], Ease.inOut),
      1.0),
    onEnter: () => {
      hero.setAction('workStand');
      oldMan.setAction('standOld');
      oldMan.lookAtWorld(heroHead(), 1);
    },
    update: (t, u, dt) => {
      updateAll(dt, t);
      oldMan.lookAtWorld(heroHead(), 1);
    },
    events: [
      { at: 1.2, do: () => oldMan.setCustom((p, ph, v) => Acting.poseTalk(p, ph, v, 1.0)) },
      { at: 1.3, say: 'T\'as encore regardé les plongeurs partir ce matin ?',
        speaker: 'Vieil homme' },
      { at: 5.4, say: 'Arrête de rêver. C\'est pas pour des gens comme nous.',
        speaker: 'Vieil homme' },
      { at: 9.6, do: () => { oldMan.clearCustom(); oldMan.setAction('standOld'); } },
      { at: 10.0, clear: true },
      // le héros ne répond pas : il s'arrête un instant, puis reprend
      { at: 10.6, do: () => {
          hero.setAction('stand');
          hero.lookAtWorld(new THREE.Vector3(20, G + 2, 14), 0.9);
        } },
      { at: 14.6, do: () => { hero.setAction('workStand'); hero.clearLook(); } },
      { at: 16.0, do: () => oldMan.setAction('walkOld') },
    ],
  });

  // ------------------------------------------------------------------
  // PLAN 3 — arrivée du Plongeur d'Échos
  // ------------------------------------------------------------------
  const diverStart = A.dockEnd.clone().add(new THREE.Vector3(-0.4, 0.1, -0.2));
  const diverEnd = A.dockStart.clone().add(new THREE.Vector3(-1.4, 0.05, -0.6));
  const crowd = [vills[0], vills[1], child, oldWoman];
  const crowdFrom = crowd.map(a => a.root.position.clone());
  const crowdTo = [
    new THREE.Vector3(diverEnd.x - 2.0, G, diverEnd.z + 1.4),
    new THREE.Vector3(diverEnd.x - 2.6, G, diverEnd.z - 0.5),
    new THREE.Vector3(diverEnd.x - 1.5, G, diverEnd.z + 2.3),
    new THREE.Vector3(diverEnd.x - 3.2, G, diverEnd.z + 0.7),
  ];

  shots.push({
    name: 'plan3-plongeur',
    duration: 24,
    camera: (cam, u, dt, t) => {
      // suit le plongeur qui remonte le ponton, puis se resserre
      if (u < 0.55) {
        const e = Ease.inOut(u / 0.55);
        cam.position.set(
          THREE.MathUtils.lerp(A.dockEnd.x + 6.5, diverEnd.x + 4.4, e),
          THREE.MathUtils.lerp(A.dockEnd.y + 2.6, G + 2.0, e),
          THREE.MathUtils.lerp(A.dockEnd.z + 3.4, diverEnd.z + 3.0, e),
        );
        cam.lookAt(diver.root.position.x, diver.root.position.y + 1.4, diver.root.position.z);
      } else {
        const e = Ease.inOut((u - 0.55) / 0.45);
        cam.position.set(
          THREE.MathUtils.lerp(diverEnd.x + 4.4, diverEnd.x + 2.6, e),
          THREE.MathUtils.lerp(G + 2.0, G + 1.75, e),
          THREE.MathUtils.lerp(diverEnd.z + 3.0, diverEnd.z + 2.0, e),
        );
        cam.lookAt(diver.root.position.x, diver.root.position.y + 1.5, diver.root.position.z);
      }
      const sh = 0.008;
      cam.position.x += Math.sin(t * 1.6) * sh;
      cam.position.y += Math.sin(t * 2.1 + 1.2) * sh;
    },
    onEnter: () => {
      diver.setAction('walk');
      diver.walkSpeed = 0.75;
      helmet.visible = false;
    },
    update: (t, u, dt) => {
      // le plongeur remonte le ponton (0 → 6 s)
      if (t < 6) {
        walkTo(diver, diverStart, diverEnd, Ease.inOut(Math.min(1, t / 6)));
      }
      // les villageois s'approchent (4.5 → 10 s)
      if (t > 4.5 && t < 10) {
        const e = Ease.inOut((t - 4.5) / 5.5);
        crowd.forEach((a, i) => walkTo(a, crowdFrom[i], crowdTo[i], e));
      }
      // tous regardent le plongeur après son arrivée
      if (t > 7) {
        const dp = tmpV.copy(diver.root.position).setY(diver.root.position.y + 1.5);
        for (const a of crowd) a.lookAtWorld(dp, 0.85);
      }
      updateAll(dt, t);

      // le casque suit la main du plongeur une fois retiré
      if (helmet.visible) {
        diver.attach.handR.getWorldPosition(helmet.position);
        helmet.position.y -= 0.12;
      }
    },
    events: [
      { at: 6.2, do: () => { diver.setAction('stand'); diver.walkSpeed = 1; } },
      // déballage du sac
      { at: 6.8, do: () => {
          diver.setCustom((p, ph, v) => Acting.poseCrouchWork(p, ph, v));
        } },
      { at: 8.0, do: () => { loot.visible = true; } },
      { at: 8.4, say: 'Les Plongeurs d\'Échos… ils sont notre seule fenêtre sur le passé.',
        speaker: 'Vieille femme', narration: true },
      // l'ampoule s'allume faiblement
      { at: 10.2, do: () => { ctx.pulseBulb(bulb, 3.2); } },
      { at: 13.4, say: 'Ils ramènent des choses qu\'on ne sait même plus fabriquer.',
        speaker: 'Vieille femme', narration: true },
      { at: 17.6, say: 'De la lumière. Du savoir. De l\'espoir.',
        speaker: 'Vieille femme', narration: true },
      // retrait du casque
      { at: 18.6, do: () => {
          diver.clearCustom();
          diver.setAction('stand');
          let ph = 0;
          diver.setCustom((p, _t, _v) => {
            ph = Math.min(1, ph + 1 / 60 / 2.2);
            Acting.poseRemoveHelmet(p, _t, ph);
          });
        } },
      { at: 20.3, do: () => { helmet.visible = true; } },
      { at: 21.2, clear: true },
      // il reconnaît le héros et lui fait un signe de tête
      { at: 21.6, do: () => {
          diver.clearCustom();
          diver.setAction('stand');
          diver.lookAtWorld(heroHead(), 1);
          diver.nod();
        } },
    ],
  });

  // ------------------------------------------------------------------
  // PLAN 4 — moment intime sur le rocher
  // ------------------------------------------------------------------
  const sitPos = A.lookout.clone();
  const childApproachFrom = new THREE.Vector3(sitPos.x + 4.2, G, sitPos.z - 3.0);
  const childApproachTo = new THREE.Vector3(sitPos.x + 1.25, G, sitPos.z - 1.05);

  shots.push({
    name: 'plan4-rocher',
    duration: 23,
    fadeIn: 1.2,
    camera: (cam, u, dt, t) => {
      if (u < 0.4) {
        // large : le héros minuscule face à l'océan
        const e = Ease.soft(u / 0.4);
        cam.position.set(
          THREE.MathUtils.lerp(sitPos.x - 9.5, sitPos.x - 5.2, e),
          THREE.MathUtils.lerp(G + 6.5, G + 3.4, e),
          THREE.MathUtils.lerp(sitPos.z - 8.5, sitPos.z - 4.6, e),
        );
        cam.lookAt(sitPos.x + 1.0, sitPos.y + 0.5, sitPos.z + 1.5);
      } else if (u < 0.72) {
        // se rapproche par le côté
        const e = Ease.inOut((u - 0.4) / 0.32);
        cam.position.set(
          THREE.MathUtils.lerp(sitPos.x - 5.2, sitPos.x - 2.5, e),
          THREE.MathUtils.lerp(G + 3.4, G + 1.9, e),
          THREE.MathUtils.lerp(sitPos.z - 4.6, sitPos.z - 2.2, e),
        );
        cam.lookAt(sitPos.x, sitPos.y + 1.0, sitPos.z + 0.3);
      } else {
        // gros plan sur l'échange avec l'enfant
        const e = Ease.inOut((u - 0.72) / 0.28);
        cam.position.set(
          THREE.MathUtils.lerp(sitPos.x - 2.5, sitPos.x - 1.5, e),
          THREE.MathUtils.lerp(G + 1.9, G + 1.55, e),
          THREE.MathUtils.lerp(sitPos.z - 2.2, sitPos.z - 1.7, e),
        );
        cam.lookAt(sitPos.x + 0.45, sitPos.y + 0.95, sitPos.z - 0.15);
      }
      const sh = 0.006;
      cam.position.x += Math.sin(t * 1.3) * sh;
      cam.position.y += Math.sin(t * 1.9 + 0.7) * sh;
    },
    onEnter: () => {
      // le héros est assis sur le rocher, face à l'océan
      hero.root.position.copy(sitPos);
      hero.root.rotation.y = 2.55;
      hero.setAction('sit', 0.01);
      hero.clearLook();
      heroNet.visible = false;
      child.root.position.copy(childApproachFrom);
      child.setAction('stand');
      watch.visible = false;
      // les autres restent près du ponton, hors champ
    },
    update: (t, u, dt) => {
      // l'enfant s'approche entre 8.5 et 13.5 s
      if (t > 8.5 && t < 13.5) {
        const e = Ease.inOut((t - 8.5) / 5);
        walkTo(child, childApproachFrom, childApproachTo, e);
      }
      if (t > 13.2) {
        child.lookAtWorld(tmpV.copy(hero.root.position).setY(hero.root.position.y + 1.15), 1);
        if (t > 14.0) hero.lookAtWorld(
          tmpV.copy(child.root.position).setY(child.root.position.y + 1.0), 0.9);
      }
      updateAll(dt, t);
    },
    events: [
      { at: 3.4, say: 'Je pourrais le faire… Je sais que je le pourrais.',
        speaker: HERO_NAME },
      { at: 8.2, clear: true },
      { at: 8.3, do: () => { child.setAction('walk'); child.walkSpeed = 0.8; } },
      { at: 13.4, do: () => {
          child.setAction('stand');
          child.walkSpeed = 1;
        } },
      // l'enfant tend la montre
      { at: 14.0, do: () => {
          watch.visible = true;
          child.setCustom((p, ph, v) => Acting.poseOffer(p, ph, v));
        } },
      // le héros la regarde longuement
      { at: 15.6, do: () => {
          hero.setCustom((p, ph, v) => {
            Acting.poseSit(p, ph, v);
            // mains rapprochées, comme s'il tenait l'objet
            p.shoulderL[2] = 1.42 - 0.52; p.shoulderR[2] = -1.42 + 0.52;
            p.shoulderL[0] = 0.72; p.shoulderR[0] = 0.72;
            p.elbowL[1] = -1.04; p.elbowR[1] = 1.04;
            p.neck[0] = -0.34; p.head[0] = -0.12;
          });
        } },
      // il la rend doucement
      { at: 18.4, do: () => {
          hero.clearCustom();
          hero.setAction('sit');
          child.clearCustom();
          child.setAction('stand');
          watch.visible = true;
        } },
      { at: 19.4, say: 'Un jour, je plongerai.', speaker: HERO_NAME },
      { at: 22.4, clear: true },
    ],
  });

  // ------------------------------------------------------------------
  // PLAN 5 — la cloche, l'appel
  // ------------------------------------------------------------------
  const callerFrom = new THREE.Vector3(sitPos.x + 6.5, G, sitPos.z - 5.0);
  const callerTo = new THREE.Vector3(sitPos.x + 2.6, G, sitPos.z - 2.6);

  shots.push({
    name: 'plan5-appel',
    duration: 18,
    camera: (cam, u, dt, t) => {
      const e = Ease.inOut(u);
      cam.position.set(
        THREE.MathUtils.lerp(sitPos.x - 1.5, sitPos.x - 3.4, e),
        THREE.MathUtils.lerp(G + 1.55, G + 2.1, e),
        THREE.MathUtils.lerp(sitPos.z - 1.7, sitPos.z - 3.6, e),
      );
      cam.lookAt(
        THREE.MathUtils.lerp(sitPos.x + 0.45, sitPos.x + 1.2, e),
        sitPos.y + 1.0,
        THREE.MathUtils.lerp(sitPos.z - 0.15, sitPos.z - 0.6, e),
      );
      cam.position.x += Math.sin(t * 1.4) * 0.007;
      cam.position.y += Math.sin(t * 2.0 + 0.5) * 0.007;
    },
    onEnter: () => {
      oldMan.root.position.copy(callerFrom);
      oldMan.setAction('walkOld');
      child.clearLook();
      child.setAction('stand');
    },
    update: (t, u, dt) => {
      if (t > 1.8 && t < 6.2) {
        walkTo(oldMan, callerFrom, callerTo, Ease.inOut((t - 1.8) / 4.4));
      }
      if (t > 5.6) {
        oldMan.lookAtWorld(tmpV.copy(hero.root.position).setY(hero.root.position.y + 1.2), 1);
      }
      if (t > 6.6) {
        hero.lookAtWorld(tmpV.copy(oldMan.root.position).setY(oldMan.root.position.y + 1.5), 1);
      }
      updateAll(dt, t);
    },
    events: [
      { at: 0.6, do: () => ctx.ringBell() },
      { at: 1.8, do: () => { child.setAction('walk'); child.walkSpeed = 0.9; } },
      { at: 6.2, do: () => {
          oldMan.setAction('standOld');
          oldMan.setCustom((p, ph, v) => Acting.poseTalk(p, ph, v, 1.15));
        } },
      { at: 6.5, say: 'Hé ! Toi. Le chef veut te voir.', speaker: 'Vieil homme' },
      { at: 9.5, say: 'Il paraît que tu continues à demander à plonger.',
        speaker: 'Vieil homme' },
      { at: 13.2, say: 'Aujourd\'hui, il a peut-être une réponse pour toi.',
        speaker: 'Vieil homme' },
      // le héros se lève, le regard vif
      { at: 15.2, do: () => {
          oldMan.clearCustom();
          oldMan.setAction('standOld');
          hero.setAction('stand', 0.7);
          hero.root.position.y = G;
        } },
      { at: 17.0, clear: true },
      { at: 17.2, do: () => { oldMan.setAction('walkOld'); } },
    ],
    fadeOut: 1.2,
  });

  return {
    shots,
    actors,
    hero, oldMan, oldWoman, diver, child, vills,
    usingPlaceholders,
    props: { watch, bulb, metalBox, satchel, heroNet, helmet, loot },
    /** Position de départ du segment jouable. */
    playStart: {
      hero: sitPos.clone(),
      guide: callerTo.clone(),
    },
  };
}
