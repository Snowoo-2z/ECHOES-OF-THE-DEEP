// ============================================================================
//  village.js — L'île du village, générée proceduralement
// ----------------------------------------------------------------------------
//  Ancien sommet de montagne émergeant de l'océan : rochers, maisons de bois
//  sur pilotis, pontons, feu de camp, séchoirs à poissons, mouettes.
//
//  Tout est en dur ici (pas de .glb requis) pour que la cinématique tourne
//  sans dépendre de modèles externes. Les maisons peuvent être remplacées
//  plus tard par house_stilts.glb.
// ============================================================================
import * as THREE from 'three';

// PRNG déterministe : le village est identique à chaque lancement
function makeRng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const MAT = {
  rock:      new THREE.MeshStandardMaterial({ color: 0x5a5f5c, roughness: 0.96, flatShading: true }),
  rockDark:  new THREE.MeshStandardMaterial({ color: 0x43494a, roughness: 1.0,  flatShading: true }),
  grass:     new THREE.MeshStandardMaterial({ color: 0x5b6b4a, roughness: 0.95, flatShading: true }),
  wood:      new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.92 }),
  woodDark:  new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.95 }),
  plank:     new THREE.MeshStandardMaterial({ color: 0x7d6144, roughness: 0.9 }),
  metal:     new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.7, metalness: 0.5 }),
  rust:      new THREE.MeshStandardMaterial({ color: 0x8a5433, roughness: 0.85, metalness: 0.25 }),
  cloth:     new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 1.0, side: THREE.DoubleSide }),
  rope:      new THREE.MeshStandardMaterial({ color: 0x8b7d5f, roughness: 1.0 }),
  emberCore: new THREE.MeshBasicMaterial({ color: 0xffb347 }),
};

export function buildVillage(scene, opts = {}) {
  const rng = makeRng(opts.seed ?? 1337);
  const group = new THREE.Group();
  group.name = 'village';
  scene.add(group);

  const api = {
    group,
    anchors: {},        // points remarquables pour la caméra et les acteurs
    update: null,
  };

  // ------------------------------------------------------------------ ÎLE
  // Cône irrégulier : ancien sommet de montagne
  const ISLAND_R = 26;
  const islandGeo = new THREE.CylinderGeometry(ISLAND_R * 0.62, ISLAND_R * 1.5, 22, 26, 6);
  {
    const p = islandGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.z, v.x);
      const r = Math.hypot(v.x, v.z);
      const n = Math.sin(a * 3.1) * 1.5 + Math.sin(a * 5.7 + 1.3) * 0.9
              + Math.sin(v.y * 0.4 + a * 2.2) * 1.1;
      const k = 1 + n / Math.max(4, r);
      p.setX(i, v.x * k);
      p.setZ(i, v.z * k);
      // plateau sommital aplati
      if (v.y > 8) p.setY(i, 8 + (v.y - 8) * 0.35);
    }
    islandGeo.computeVertexNormals();
  }
  const island = new THREE.Mesh(islandGeo, MAT.rock);
  island.position.y = -8;
  group.add(island);

  // plateau herbeux au sommet
  const topGeo = new THREE.CylinderGeometry(ISLAND_R * 0.60, ISLAND_R * 0.63, 0.6, 24, 1);
  {
    const p = topGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (p.getY(i) > 0) p.setY(i, p.getY(i) + Math.sin(x * 0.3) * 0.25 + Math.cos(z * 0.27) * 0.22);
    }
    topGeo.computeVertexNormals();
  }
  const top = new THREE.Mesh(topGeo, MAT.grass);
  top.position.y = 2.9;
  group.add(top);

  const GROUND_Y = 3.2;      // hauteur de marche sur le plateau
  api.groundY = GROUND_Y;

  // rochers épars
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 6 + rng() * (ISLAND_R * 0.55);
    const s = 0.5 + rng() * 1.8;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0),
                                rng() > 0.5 ? MAT.rock : MAT.rockDark);
    rock.position.set(Math.cos(a) * r, GROUND_Y - 0.2 + rng() * 0.5, Math.sin(a) * r);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    rock.scale.y *= 0.6 + rng() * 0.5;
    group.add(rock);
  }

  // ------------------------------------------------------- ROCHER PANORAMA
  // Le rocher où le personnage s'assied au plan 4, en surplomb de l'eau
  // y = sommet du rocher, mesuré : c'est la surface d'assise. Le personnage
  // est posé dessus par intro.js, qui abaisse lui-même le bassin.
  const lookoutPos = new THREE.Vector3(-13.5, GROUND_Y + 1.149, 9.5);
  {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), MAT.rockDark);
    r.position.copy(lookoutPos).add(new THREE.Vector3(0, -1.5, 0));
    r.scale.set(1.25, 0.72, 1.1);
    r.rotation.y = 0.6;
    group.add(r);
    const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), MAT.rock);
    r2.position.copy(lookoutPos).add(new THREE.Vector3(1.9, -1.9, -1.1));
    r2.scale.set(1, 0.7, 1);
    group.add(r2);
  }
  api.anchors.lookout = lookoutPos;

  // ------------------------------------------------------------- MAISONS
  function buildHouse(x, z, rotY, w, d, h, onStilts) {
    const g = new THREE.Group();
    g.position.set(x, GROUND_Y, z);
    g.rotation.y = rotY;

    const baseY = onStilts ? 1.5 : 0.1;

    // pilotis
    if (onStilts) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.13, baseY + 0.4, 6), MAT.woodDark);
        post.position.set(sx * (w / 2 - 0.25), (baseY + 0.4) / 2 - 0.3, sz * (d / 2 - 0.25));
        g.add(post);
      }
      // plancher
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.14, d + 0.3), MAT.plank);
      floor.position.y = baseY;
      g.add(floor);
    }

    // murs : planches verticales, légèrement irrégulières
    const nPlanks = Math.max(5, Math.round(w / 0.34));
    for (let i = 0; i < nPlanks; i++) {
      const px = -w / 2 + (i + 0.5) * (w / nPlanks);
      for (const sz of [-1, 1]) {
        const pw = (w / nPlanks) * (0.86 + rng() * 0.2);
        const ph = h * (0.94 + rng() * 0.1);
        const pl = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.07),
                                  rng() > 0.4 ? MAT.wood : MAT.woodDark);
        pl.position.set(px, baseY + ph / 2, sz * d / 2);
        pl.rotation.z = (rng() - 0.5) * 0.014;
        g.add(pl);
      }
    }
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, d), MAT.wood);
      side.position.set(sx * w / 2, baseY + h / 2, 0);
      g.add(side);
    }

    // toit : tôle rouillée à deux pentes
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.08, d + 0.5), MAT.rust);
    roofL.position.set(-w * 0.26, baseY + h + 0.42, 0);
    roofL.rotation.z = 0.44;
    g.add(roofL);
    const roofR = roofL.clone();
    roofR.position.x = w * 0.26;
    roofR.rotation.z = -0.44;
    g.add(roofR);

    // porte
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.55, 0.06), MAT.woodDark);
    door.position.set(0, baseY + 0.78, d / 2 + 0.05);
    g.add(door);

    // fenêtre
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.05),
                new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.4 }));
    win.position.set(w * 0.3, baseY + h * 0.62, d / 2 + 0.05);
    g.add(win);

    group.add(g);
    return g;
  }

  // maison principale (celle du plan 2)
  const homePos = new THREE.Vector3(4.5, GROUND_Y, -3.5);
  const home = buildHouse(homePos.x, homePos.z, -0.42, 4.6, 4.0, 2.5, true);
  api.anchors.home = homePos;
  api.anchors.homeDoor = new THREE.Vector3(
    homePos.x + Math.sin(-0.42 + Math.PI) * 0, homePos.y, homePos.z);

  // autres maisons
  buildHouse(-6.5, -6.0,  0.85, 3.8, 3.4, 2.3, true);
  buildHouse(9.5,  4.5,  -1.35, 4.0, 3.2, 2.4, false);
  buildHouse(-9.0,  2.0,  1.95, 3.4, 3.0, 2.2, true);
  buildHouse(1.0, -9.5,   0.25, 3.6, 3.2, 2.2, false);

  // ------------------------------------------------------------- PONTON
  // Descend du plateau vers l'eau : c'est là qu'accoste le plongeur
  const dockDir = new THREE.Vector3(0.72, 0, 0.69).normalize();
  const dockStart = new THREE.Vector3(11.0, GROUND_Y, 8.0);
  const dockEnd = dockStart.clone().addScaledVector(dockDir, 11);
  dockEnd.y = 0.55;
  {
    const g = new THREE.Group();
    const len = dockStart.distanceTo(dockEnd);
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const p = dockStart.clone().lerp(dockEnd, t);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.11, 0.72), MAT.plank);
      plank.position.copy(p);
      plank.rotation.y = Math.atan2(dockDir.x, dockDir.z);
      plank.rotation.x = -Math.atan2(dockStart.y - dockEnd.y, len) * 0.0;
      g.add(plank);
      // pilotis
      if (i % 3 === 1 && p.y < GROUND_Y - 0.3) {
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, p.y + 3.2, 6), MAT.woodDark);
          post.position.set(p.x + s * 0.8 * dockDir.z, p.y - (p.y + 3.2) / 2 + 0.05, p.z - s * 0.8 * dockDir.x);
          g.add(post);
        }
      }
    }
    group.add(g);
  }
  api.anchors.dockStart = dockStart;
  api.anchors.dockEnd = dockEnd;

  // barque amarrée au bout du ponton
  const boat = new THREE.Group();
  {
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 2.1, 4, 10), MAT.wood);
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(1, 1, 0.62);
    boat.add(hull);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.7), MAT.woodDark);
    inner.position.y = 0.28;
    boat.add(inner);
    for (const s of [-0.6, 0.6]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.86), MAT.plank);
      bench.position.set(s, 0.34, 0);
      boat.add(bench);
    }
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 6), MAT.woodDark);
    oar.rotation.set(0, 0.4, Math.PI / 2 - 0.14);
    oar.position.set(0.1, 0.42, 0.32);
    boat.add(oar);
  }
  boat.position.copy(dockEnd).add(new THREE.Vector3(1.6, -0.28, 1.5));
  boat.rotation.y = -0.5;
  group.add(boat);
  api.boat = boat;
  api.anchors.boat = boat.position.clone();

  // ---------------------------------------------------------- FEU DE CAMP
  const firePos = new THREE.Vector3(-2.0, GROUND_Y, 3.0);
  const fire = new THREE.Group();
  fire.position.copy(firePos);
  {
    // cercle de pierres
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + rng() * 0.1, 0), MAT.rock);
      st.position.set(Math.cos(a) * 0.78, 0.1, Math.sin(a) * 0.78);
      st.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      fire.add(st);
    }
    // bûches
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.05, 6), MAT.woodDark);
      log.position.set(Math.cos(a) * 0.2, 0.22, Math.sin(a) * 0.2);
      log.rotation.set(Math.PI / 2 - 0.5, a, 0);
      fire.add(log);
    }
    // trépied + marmite
    const potMat = MAT.metal;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.7, 5), MAT.woodDark);
      leg.position.set(Math.cos(a) * 0.42, 0.82, Math.sin(a) * 0.42);
      leg.rotation.set(Math.cos(a) * -0.28, 0, Math.sin(a) * 0.28);
      fire.add(leg);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.36, 12), potMat);
    pot.position.y = 0.78;
    fire.add(pot);
  }
  group.add(fire);
  api.anchors.fire = firePos;

  // lumière + braises
  const fireLight = new THREE.PointLight(0xff9a3c, 2.6, 14, 1.8);
  fireLight.position.copy(firePos).add(new THREE.Vector3(0, 0.5, 0));
  group.add(fireLight);

  const emberCount = 70;
  const emberPos = new Float32Array(emberCount * 3);
  const emberVel = new Float32Array(emberCount);
  const emberLife = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) {
    emberLife[i] = rng();
    emberVel[i] = 0.5 + rng() * 0.8;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: 0xffab52, size: 0.075, transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  group.add(embers);

  // fumée
  const smokeCount = 40;
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeLife = new Float32Array(smokeCount);
  for (let i = 0; i < smokeCount; i++) smokeLife[i] = rng();
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
    color: 0x9aa0a4, size: 0.55, transparent: true, opacity: 0.16, depthWrite: false,
  }));
  group.add(smoke);

  // ------------------------------------------------------ SÉCHOIRS / FILETS
  function buildDryingRack(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, GROUND_Y, z);
    g.rotation.y = rot;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.1, 6), MAT.woodDark);
      post.position.set(s * 1.5, 1.05, 0);
      g.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.1, 6), MAT.wood);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.0;
    g.add(bar);
    // filet suspendu
    const net = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5, 8, 5), MAT.cloth);
    {
      const p = net.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setZ(i, Math.sin(p.getX(i) * 1.6) * 0.12 + Math.cos(p.getY(i) * 2.1) * 0.08);
      }
      net.geometry.computeVertexNormals();
    }
    net.position.set(0, 1.2, 0);
    g.add(net);
    // poissons qui sèchent
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 3, 6), MAT.metal);
      f.position.set(-1.1 + i * 0.55, 1.75, 0.12);
      f.rotation.x = 0.1;
      g.add(f);
    }
    group.add(g);
    return g;
  }
  buildDryingRack(-5.0, 6.5, 0.35);
  buildDryingRack(6.5, -7.5, -0.9);
  api.anchors.rack = new THREE.Vector3(-5.0, GROUND_Y, 6.5);

  // caisses et paniers épars
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2;
    const r = 3 + rng() * 9;
    const s = 0.3 + rng() * 0.3;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s),
                                 rng() > 0.5 ? MAT.wood : MAT.woodDark);
    crate.position.set(Math.cos(a) * r, GROUND_Y + s * 0.4, Math.sin(a) * r);
    crate.rotation.y = rng() * 3;
    group.add(crate);
  }

  // ------------------------------------------------------------- MOUETTES
  const GULLS = 7;
  const gulls = [];
  for (let i = 0; i < GULLS; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 3, 6),
                 new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 }));
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const wingGeo = new THREE.BoxGeometry(0.62, 0.02, 0.16);
    const wl = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.9 }));
    wl.position.set(0, 0.02, -0.16); g.add(wl);
    const wr = wl.clone(); wr.position.z = 0.16; g.add(wr);
    g.userData = {
      wl, wr,
      radius: 14 + rng() * 16,
      height: 11 + rng() * 9,
      speed: 0.12 + rng() * 0.1,
      phase: rng() * Math.PI * 2,
      flap: rng() * Math.PI * 2,
      bob: rng() * Math.PI * 2,
    };
    group.add(g);
    gulls.push(g);
  }

  // ------------------------------------------------------------- ANIMATION
  let time = 0;
  api.update = (dt) => {
    time += dt;

    // feu : lumière vacillante
    fireLight.intensity = 2.3 + Math.sin(time * 9.1) * 0.35
                        + Math.sin(time * 21.7) * 0.22 + Math.sin(time * 3.3) * 0.2;

    // braises
    const ep = emberGeo.attributes.position;
    for (let i = 0; i < emberCount; i++) {
      emberLife[i] += dt * emberVel[i] * 0.55;
      if (emberLife[i] > 1) {
        emberLife[i] -= 1;
        emberPos[i * 3]     = firePos.x + (Math.random() - 0.5) * 0.5;
        emberPos[i * 3 + 2] = firePos.z + (Math.random() - 0.5) * 0.5;
      }
      const l = emberLife[i];
      emberPos[i * 3 + 1] = firePos.y + 0.25 + l * 2.4;
      emberPos[i * 3]     += Math.sin(time * 2 + i) * dt * 0.22;
      emberPos[i * 3 + 2] += Math.cos(time * 1.7 + i * 1.3) * dt * 0.22;
    }
    ep.needsUpdate = true;
    embers.material.opacity = 0.85;

    // fumée
    const sp = smokeGeo.attributes.position;
    for (let i = 0; i < smokeCount; i++) {
      smokeLife[i] += dt * 0.12;
      if (smokeLife[i] > 1) {
        smokeLife[i] -= 1;
        smokePos[i * 3]     = firePos.x + (Math.random() - 0.5) * 0.4;
        smokePos[i * 3 + 2] = firePos.z + (Math.random() - 0.5) * 0.4;
      }
      const l = smokeLife[i];
      smokePos[i * 3 + 1] = firePos.y + 0.9 + l * 7.5;
      smokePos[i * 3]     += Math.sin(time * 0.6 + i) * dt * 0.8 + dt * 0.35;
      smokePos[i * 3 + 2] += Math.cos(time * 0.5 + i * 2.1) * dt * 0.6;
    }
    sp.needsUpdate = true;

    // barque qui tangue
    boat.position.y = dockEnd.y - 0.28 + Math.sin(time * 0.9) * 0.07;
    boat.rotation.z = Math.sin(time * 0.75) * 0.045;
    boat.rotation.x = Math.cos(time * 0.62) * 0.03;

    // mouettes
    for (const g of gulls) {
      const u = g.userData;
      const a = time * u.speed + u.phase;
      g.position.set(Math.cos(a) * u.radius,
                     u.height + Math.sin(time * 0.5 + u.bob) * 1.3,
                     Math.sin(a) * u.radius * 0.85);
      g.rotation.y = -a + Math.PI / 2;
      g.rotation.z = Math.sin(a * 2) * 0.14;
      const f = Math.sin(time * 5.5 + u.flap);
      u.wl.rotation.x = f * 0.55;
      u.wr.rotation.x = -f * 0.55;
    }
  };

  return api;
}

// ============================================================================
//  OCÉAN (surface vue du dessus, pour les scènes de village)
// ============================================================================
export function buildOcean(scene, opts = {}) {
  const size = opts.size ?? 900;
  const seg = 90;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x1d4a5e, roughness: 0.24, metalness: 0.15,
    transparent: true, opacity: 0.94, flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  scene.add(mesh);

  const pos = geo.attributes.position;
  const base = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    base[i * 2] = pos.getX(i);
    base[i * 2 + 1] = pos.getZ(i);
  }

  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 2], z = base[i * 2 + 1];
        const d = Math.hypot(x, z);
        const h = Math.sin(x * 0.055 + t * 0.85) * 0.34
                + Math.cos(z * 0.048 + t * 0.62) * 0.30
                + Math.sin((x + z) * 0.028 + t * 1.15) * 0.20
                + Math.sin(d * 0.04 - t * 0.9) * 0.12;
        pos.setY(i, h);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

// ============================================================================
//  PROPS TENUS EN MAIN
//  Petits objets créés en dur, à accrocher aux ancrages des acteurs.
// ============================================================================
export const Props = {
  /** Vieille montre à gousset. */
  watch() {
    const g = new THREE.Group();
    // Une montre de poche fait environ 4 cm : le boîtier ne doit pas dépasser
    // 2 cm de rayon, sinon elle a la taille d'une assiette dans la main.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.007, 16),
                 new THREE.MeshStandardMaterial({ color: 0xb08d4f, roughness: 0.42, metalness: 0.8 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.017, 16),
                 new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.5 }));
    face.position.z = 0.004;
    g.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.002, 6, 12),
                 new THREE.MeshStandardMaterial({ color: 0xa08040, roughness: 0.4, metalness: 0.8 }));
    ring.position.y = 0.025;
    g.add(ring);
    return g;
  },

  /** Boîte métallique rouillée. */
  metalBox() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24),
              new THREE.MeshStandardMaterial({ color: 0x6d7b6a, roughness: 0.75, metalness: 0.45 }));
    g.add(b);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.26), MAT.rust);
    lid.position.y = 0.11;
    g.add(lid);
    return g;
  },

  /** Ampoule ancienne qui s'allume encore faiblement. */
  bulb() {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12),
                  new THREE.MeshStandardMaterial({
                    color: 0xfff0c4, emissive: 0xffc766, emissiveIntensity: 1.4,
                    transparent: true, opacity: 0.85, roughness: 0.15,
                  }));
    glass.position.y = 0.045;
    g.add(glass);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.055, 10),
                new THREE.MeshStandardMaterial({ color: 0x9a8b6a, roughness: 0.5, metalness: 0.7 }));
    cap.position.y = -0.018;
    g.add(cap);
    const light = new THREE.PointLight(0xffc766, 1.1, 3.2, 2);
    light.position.y = 0.045;
    g.add(light);
    g.userData.light = light;
    g.userData.glass = glass;
    return g;
  },

  /** Sac de plongeur. */
  satchel() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.2),
              new THREE.MeshStandardMaterial({ color: 0x5d4a35, roughness: 0.95 }));
    g.add(b);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.22), MAT.woodDark);
    flap.position.y = 0.12;
    g.add(flap);
    return g;
  },

  /** Seau. */
  bucket() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 12),
              new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.9 }));
    g.add(b);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12),
                  new THREE.MeshStandardMaterial({ color: 0x35657a, roughness: 0.2, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.1;
    g.add(water);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 5, 12, Math.PI), MAT.metal);
    handle.position.y = 0.13;
    handle.rotation.y = Math.PI / 2;
    g.add(handle);
    return g;
  },

  /** Filet de pêche tenu en main. */
  net() {
    const net = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6, 6, 4), MAT.cloth);
    const p = net.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, Math.sin(p.getX(i) * 4) * 0.05 + Math.cos(p.getY(i) * 5) * 0.04);
    }
    net.geometry.computeVertexNormals();
    return net;
  },
};
