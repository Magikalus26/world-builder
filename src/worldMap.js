/**
 * Workd Builder — Tactile 3D World Map Level Selector
 * Interactive miniature tabletop archipelago floating over animated turquoise ocean waves,
 * framed by a carved wooden & golden compass border, with 3 civilization level islands
 * connected by a dotted stone road.
 */

import * as THREE from 'three';

const MAP_W = 16.4;
const MAP_D = 18.0;

/**
 * Generates a crisp high-DPI floating pill badge texture for each 3D island node.
 */
function createBadgeTexture(text, unlocked = false) {
  const w = 384;
  const h = 84;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Frosted dark sandstone pill background
  const r = 36;
  ctx.beginPath();
  ctx.roundRect(8, 10, w - 16, h - 20, r);
  ctx.fillStyle = unlocked ? 'rgba(34, 23, 12, 0.86)' : 'rgba(38, 34, 30, 0.78)';
  ctx.fill();

  ctx.lineWidth = unlocked ? 4 : 3;
  ctx.strokeStyle = unlocked ? '#f7ca62' : 'rgba(220, 212, 198, 0.45)';
  ctx.stroke();

  // Status dot
  ctx.beginPath();
  ctx.arc(38, h * 0.5, 8, 0, Math.PI * 2);
  ctx.fillStyle = unlocked ? '#ffd55a' : '#a9a296';
  ctx.fill();

  // Crisp label text
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = unlocked ? '#fff4d4' : '#ded8cc';
  ctx.fillText(text, w * 0.5 + 10, h * 0.5 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sculpted smooth organic island mound geometry (reusing procedural textures cleanly).
 */
function createIslandMoundGeometry(radiusX, radiusZ, height, seed = 1) {
  const geo = new THREE.CylinderGeometry(radiusX * 0.78, radiusX * 1.06, height, 24, 5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const radialScale = 1 + Math.sin(angle * 3 + seed) * 0.08 + Math.cos(angle * 5 - seed * 1.7) * 0.05;
    const nx = x * radialScale;
    const nz = z * (radiusZ / radiusX) * radialScale;
    // Gently dome the top surface while keeping edges terraced
    let ny = y;
    if (y > height * 0.35) {
      const rNorm = Math.min(1, Math.hypot(x / radiusX, z / radiusX));
      ny += (1 - rNorm * rNorm) * 0.24;
    }
    pos.setXYZ(i, nx, ny, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

export class WorldMapScene {
  constructor({ scene, textures, audio, cameraController, onSelectNode, onClearSelection }) {
    this.scene = scene;
    this.textures = textures;
    this.audio = audio;
    this.cameraController = cameraController;
    this.onSelectNode = onSelectNode;
    this.onClearSelection = onClearSelection;

    this.root = new THREE.Group();
    this.root.name = 'WorldMapRoot';
    this.scene.add(this.root);

    this.ownedGeometries = [];
    this.ownedMaterials = [];
    this.ownedTextures = [];

    this.nodes = [];
    this.hitTargets = [];
    this.selectedNode = null;
    this.animatedProps = [];
    this.shoreRings = [];
    this.unlockedRings = [];
    this.oceanGeo = null;
    this.oceanBaseY = null;

    this._initMaterials();
    this._buildTabletopFrameAndCompass();
    this._buildTurquoiseOcean();
    this._buildCivilizationIslands();
    this._buildDottedStoneRoads();
    this._collectHitTargets();
  }

  _trackGeo(g) {
    this.ownedGeometries.push(g);
    return g;
  }

  _trackMat(m) {
    this.ownedMaterials.push(m);
    return m;
  }

  _trackTex(t) {
    this.ownedTextures.push(t);
    return t;
  }

  _initMaterials() {
    this.mats = {
      seabed: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#0f596b'),
          roughness: 0.92,
          metalness: 0.04,
        })
      ),
      ocean: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1fa4b8'),
          normalMap: this.textures.maps.waterNormal,
          normalScale: new THREE.Vector2(0.5, 0.5),
          roughness: 0.16,
          metalness: 0.18,
          transparent: true,
          opacity: 0.88,
        })
      ),
      desertSand: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#e6c07b'),
          roughness: 0.88,
          metalness: 0.02,
        })
      ),
      mediterraneanGrass: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#869c5b'),
          roughness: 0.88,
          metalness: 0.02,
        })
      ),
      romanMarble: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#dcd5c6'),
          roughness: 0.65,
          metalness: 0.05,
        })
      ),
      cypressGreen: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#395c34'),
          roughness: 0.84,
        })
      ),
      terracotta: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#b8593a'),
          roughness: 0.78,
        })
      ),
      jadeMountain: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#668d5e'),
          roughness: 0.88,
        })
      ),
      pagodaRed: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#b83228'),
          roughness: 0.58,
          metalness: 0.08,
        })
      ),
      pagodaRoof: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#2f3d47'),
          roughness: 0.52,
          metalness: 0.16,
        })
      ),
      bambooGreen: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#5f9c4a'),
          roughness: 0.68,
        })
      ),
      sakuraPink: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#f7b4c8'),
          roughness: 0.72,
        })
      ),
      sakuraLight: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#ffd9e5'),
          roughness: 0.68,
        })
      ),
      shojiCream: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#f5ead1'),
          emissive: new THREE.Color('#5a421c'),
          emissiveIntensity: 0.16,
          roughness: 0.65,
        })
      ),
      cedarDark: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#4f3324'),
          roughness: 0.8,
        })
      ),
      kawaraSlate: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#344254'),
          roughness: 0.5,
          metalness: 0.18,
        })
      ),
      mayaJungle: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#3f7f44'),
          roughness: 0.86,
        })
      ),
      mayaStone: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#cfc39c'),
          roughness: 0.82,
        })
      ),
      mayaRedOchre: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#ad412d'),
          roughness: 0.7,
        })
      ),
      mayaJade: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#22b47c'),
          emissive: new THREE.Color('#0c4c34'),
          emissiveIntensity: 0.25,
          roughness: 0.28,
          metalness: 0.2,
        })
      ),
      lockStone: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#9e978b'),
          roughness: 0.78,
          metalness: 0.12,
        })
      ),
      lockMetal: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#c8a768'),
          roughness: 0.35,
          metalness: 0.72,
        })
      ),
      shoreFoam: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xe6fbff,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
      ),
      goldRing: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffcf40,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      goldHalo: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffe478,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      hitbox: this._trackMat(new THREE.MeshBasicMaterial({ visible: false })),
    };
  }

  /* ============================================================================
   * 1. CARVED WOODEN & GOLDEN COMPASS TABLETOP FRAME
   * ========================================================================== */
  _buildTabletopFrameAndCompass() {
    const frameGroup = new THREE.Group();
    this.root.add(frameGroup);

    const hw = MAP_W * 0.5;
    const hd = MAP_D * 0.5;
    const borderT = 0.95;
    const borderH = 1.45;

    // Carved wooden outer rails
    const northSouthGeo = this._trackGeo(new THREE.BoxGeometry(MAP_W + borderT * 2, borderH, borderT));
    const eastWestGeo = this._trackGeo(new THREE.BoxGeometry(borderT, borderH, MAP_D));

    const northRail = new THREE.Mesh(northSouthGeo, this.textures.materials.timberDark);
    northRail.position.set(0, -0.22, -hd - borderT * 0.5);
    northRail.castShadow = true;
    northRail.receiveShadow = true;
    frameGroup.add(northRail);

    const southRail = new THREE.Mesh(northSouthGeo, this.textures.materials.timberDark);
    southRail.position.set(0, -0.22, hd + borderT * 0.5);
    southRail.castShadow = true;
    southRail.receiveShadow = true;
    frameGroup.add(southRail);

    const westRail = new THREE.Mesh(eastWestGeo, this.textures.materials.timberDark);
    westRail.position.set(-hw - borderT * 0.5, -0.22, 0);
    westRail.castShadow = true;
    westRail.receiveShadow = true;
    frameGroup.add(westRail);

    const eastRail = new THREE.Mesh(eastWestGeo, this.textures.materials.timberDark);
    eastRail.position.set(hw + borderT * 0.5, -0.22, 0);
    eastRail.castShadow = true;
    eastRail.receiveShadow = true;
    frameGroup.add(eastRail);

    // Gleaming inlaid golden trim strips along the wooden border
    const goldNSGeo = this._trackGeo(new THREE.BoxGeometry(MAP_W + 0.5, 0.08, 0.14));
    const goldEWGeo = this._trackGeo(new THREE.BoxGeometry(0.14, 0.08, MAP_D + 0.5));
    [-hd - 0.36, hd + 0.36].forEach((z) => {
      const strip = new THREE.Mesh(goldNSGeo, this.textures.materials.capstoneGold);
      strip.position.set(0, 0.52, z);
      frameGroup.add(strip);
    });
    [-hw - 0.36, hw + 0.36].forEach((x) => {
      const strip = new THREE.Mesh(goldEWGeo, this.textures.materials.capstoneGold);
      strip.position.set(x, 0.52, 0);
      frameGroup.add(strip);
    });

    // 4 Ornate Golden Corner Medallions
    const cornerGeo = this._trackGeo(new THREE.CylinderGeometry(0.46, 0.52, 0.16, 8));
    const cornerGemGeo = this._trackGeo(new THREE.OctahedronGeometry(0.22, 0));
    [
      [-hw - 0.45, -hd - 0.45],
      [hw + 0.45, -hd - 0.45],
      [-hw - 0.45, hd + 0.45],
      [hw + 0.45, hd + 0.45],
    ].forEach(([cx, cz]) => {
      const med = new THREE.Mesh(cornerGeo, this.textures.materials.capstoneGold);
      med.position.set(cx, 0.54, cz);
      med.castShadow = true;
      frameGroup.add(med);

      const gem = new THREE.Mesh(cornerGemGeo, this.textures.materials.capstoneGold);
      gem.position.set(cx, 0.68, cz);
      frameGroup.add(gem);
    });

    // Sculpted 3D Golden Compass Rose in the South-East ocean corner
    const compass = new THREE.Group();
    compass.position.set(5.4, 0.08, 6.2);

    const ringGeo = this._trackGeo(new THREE.TorusGeometry(1.15, 0.07, 8, 32));
    ringGeo.rotateX(Math.PI / 2);
    const outerRing = new THREE.Mesh(ringGeo, this.textures.materials.capstoneGold);
    compass.add(outerRing);

    const innerRingGeo = this._trackGeo(new THREE.TorusGeometry(0.75, 0.04, 6, 24));
    innerRingGeo.rotateX(Math.PI / 2);
    compass.add(new THREE.Mesh(innerRingGeo, this.textures.materials.capstoneGold));

    const cardinalGeo = this._trackGeo(new THREE.ConeGeometry(0.18, 1.15, 4));
    cardinalGeo.rotateX(Math.PI / 2);
    cardinalGeo.translate(0, 0, 0.58);

    const ordinalGeo = this._trackGeo(new THREE.ConeGeometry(0.12, 0.72, 4));
    ordinalGeo.rotateX(Math.PI / 2);
    ordinalGeo.translate(0, 0, 0.36);

    for (let i = 0; i < 4; i++) {
      const needle = new THREE.Mesh(cardinalGeo, this.textures.materials.capstoneGold);
      needle.rotation.y = (i * Math.PI) / 2;
      needle.scale.y = 0.35;
      compass.add(needle);

      const sub = new THREE.Mesh(ordinalGeo, this.mats.lockMetal);
      sub.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
      sub.scale.y = 0.32;
      compass.add(sub);
    }

    const hubGeo = this._trackGeo(new THREE.SphereGeometry(0.24, 10, 8));
    const hub = new THREE.Mesh(hubGeo, this.textures.materials.capstoneGold);
    hub.scale.y = 0.55;
    compass.add(hub);

    this.compassRose = compass;
    frameGroup.add(compass);
  }

  /* ============================================================================
   * 2. ANIMATED TURQUOISE OCEAN WAVES
   * ========================================================================== */
  _buildTurquoiseOcean() {
    // Deep sea bottom slab beneath water
    const bedGeo = this._trackGeo(new THREE.BoxGeometry(MAP_W + 0.2, 0.5, MAP_D + 0.2));
    const bed = new THREE.Mesh(bedGeo, this.mats.seabed);
    bed.position.set(0, -0.7, 0);
    bed.receiveShadow = true;
    this.root.add(bed);

    // Animated subdivided turquoise ocean surface
    const oceanGeo = this._trackGeo(new THREE.PlaneGeometry(MAP_W, MAP_D, 32, 32));
    oceanGeo.rotateX(-Math.PI / 2);
    this.oceanGeo = oceanGeo;
    this.oceanBaseY = new Float32Array(oceanGeo.attributes.position.count);

    const oceanMesh = new THREE.Mesh(oceanGeo, this.mats.ocean);
    oceanMesh.position.y = 0.0;
    oceanMesh.receiveShadow = true;
    this.root.add(oceanMesh);
  }

  /* ============================================================================
   * 3. THREE MINIATURE 3D CIVILIZATION ISLANDS
   * ========================================================================== */
  _buildCivilizationIslands() {
    this._buildEgyptIsland();
    this._buildRomeIsland();
    this._buildChinaIsland();
    this._buildMayaIsland();
  }

  _addIslandBadge(parent, label, unlocked, yHeight) {
    const tex = this._trackTex(createBadgeTexture(label, unlocked));
    const mat = this._trackMat(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      })
    );
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, yHeight, 0);
    sprite.scale.set(3.25, 0.72, 1);
    sprite.renderOrder = 10;
    parent.add(sprite);
    return sprite;
  }

  _addShoreFoamRing(parent, radiusX, radiusZ) {
    const geo = this._trackGeo(new THREE.RingGeometry(radiusX * 0.96, radiusX * 1.14, 28));
    geo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(geo, this.mats.shoreFoam);
    ring.position.y = 0.03;
    ring.scale.set(1, 1, radiusZ / radiusX);
    parent.add(ring);
    this.shoreRings.push({ mesh: ring, baseSX: 1, baseSZ: radiusZ / radiusX, phase: radiusX * 2.3 });
  }

  _addPadlockBadge(parent, x, y, z) {
    const lock = new THREE.Group();
    lock.position.set(x, y, z);

    const bodyGeo = this._trackGeo(new THREE.BoxGeometry(0.46, 0.42, 0.2));
    const body = new THREE.Mesh(bodyGeo, this.mats.lockStone);
    body.castShadow = true;
    lock.add(body);

    const shackleGeo = this._trackGeo(new THREE.TorusGeometry(0.15, 0.048, 8, 16, Math.PI));
    const shackle = new THREE.Mesh(shackleGeo, this.mats.lockMetal);
    shackle.position.y = 0.2;
    shackle.castShadow = true;
    lock.add(shackle);

    const keyholeGeo = this._trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8));
    keyholeGeo.rotateX(Math.PI / 2);
    const keyhole = new THREE.Mesh(keyholeGeo, this.mats.lockMetal);
    lock.add(keyhole);

    parent.add(lock);
    return lock;
  }

  _createMiniPalm(parent, x, y, z, scale = 0.45, lean = 0.14) {
    const palm = new THREE.Group();
    palm.position.set(x, y, z);
    palm.scale.setScalar(scale);

    const trunkGeo = this._trackGeo(new THREE.CylinderGeometry(0.12, 0.18, 1.5, 6));
    const trunk = new THREE.Mesh(trunkGeo, this.textures.materials.palmTrunk);
    trunk.position.y = 0.72;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    palm.add(trunk);

    const crown = new THREE.Group();
    crown.position.set(-Math.sin(lean) * 0.72, 1.42, 0);
    const frondGeo = this._trackGeo(new THREE.ConeGeometry(0.24, 1.15, 4));
    frondGeo.scale(1, 1, 0.22);
    frondGeo.translate(0, 0.55, 0);

    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(frondGeo, this.textures.materials.palmLeaf);
      frond.rotation.y = (f / 5) * Math.PI * 2;
      frond.rotation.z = 1.08;
      crown.add(frond);
    }
    palm.add(crown);
    this.animatedProps.push({ obj: crown, type: 'sway', phase: x + z });
    parent.add(palm);
  }

  /**
   * Level 1 — Égypte : La Petite Pyramide (UNLOCKED & PLAYABLE)
   */
  _buildEgyptIsland() {
    const pos = new THREE.Vector3(-1.8, 0, 3.6);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    // Sculpted desert sand island mound + shoreline foam
    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.7, 2.45, 0.65, 1.2));
    const mound = new THREE.Mesh(moundGeo, this.mats.desertSand);
    mound.position.y = 0.12;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.82, 2.55);

    // Glowing golden base ring indicating UNLOCKED & PLAYABLE
    const ringGeo = this._trackGeo(new THREE.RingGeometry(2.86, 3.12, 36));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.mats.goldRing);
    ringMesh.position.y = 0.11;
    ringMesh.scale.set(1, 1, 2.58 / 2.86);
    group.add(ringMesh);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(3.12, 3.52, 36));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, this.mats.goldHalo);
    haloMesh.position.y = 0.095;
    haloMesh.scale.set(1, 1, 2.58 / 2.86);
    group.add(haloMesh);

    this.unlockedRings.push({
      nodeId: 'level1_pyramid',
      ringMesh,
      haloMesh,
      ratioZ: 2.58 / 2.86,
      phase: 0,
    });

    // Tiny 5-tier stepped sandstone pyramid crowned with golden capstone!
    const pyrGroup = new THREE.Group();
    pyrGroup.position.set(0.55, 0.56, -0.15);
    const tierWidths = [1.56, 1.24, 0.92, 0.6, 0.34];
    const tierH = 0.22;
    for (let t = 0; t < 4; t++) {
      const geo = this._trackGeo(new THREE.BoxGeometry(tierWidths[t], tierH, tierWidths[t]));
      const mesh = new THREE.Mesh(geo, this.textures.materials.carvedBlock);
      mesh.position.y = t * tierH + tierH * 0.5;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pyrGroup.add(mesh);
    }
    // 5th tier golden pyramidion capstone
    const capGeo = this._trackGeo(new THREE.ConeGeometry(0.36 / Math.SQRT2, 0.34, 4));
    capGeo.rotateY(Math.PI / 4);
    const cap = new THREE.Mesh(capGeo, this.textures.materials.capstoneGold);
    cap.position.y = 4 * tierH + 0.17;
    cap.castShadow = true;
    pyrGroup.add(cap);
    group.add(pyrGroup);

    // Miniature Quarry cliff & boulders on NW side of island
    const cliff1 = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.15, 0.42, 0.68)),
      this.textures.materials.limestone
    );
    cliff1.position.set(-1.18, 0.72, -0.82);
    cliff1.castShadow = true;
    group.add(cliff1);

    const cliff2 = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.75, 0.34, 0.45)),
      this.textures.materials.limestone
    );
    cliff2.position.set(-1.3, 1.05, -0.95);
    cliff2.castShadow = true;
    group.add(cliff2);

    // Tiny wooden desert sled on plank track carrying 2 mini sandstone blocks
    const miniTrack = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.05, 0.05, 0.38)),
      this.textures.materials.timberDark
    );
    miniTrack.position.set(-0.95, 0.59, 0.55);
    miniTrack.rotation.y = 0.25;
    group.add(miniTrack);

    const miniSled = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.46, 0.08, 0.32)),
      this.textures.materials.timber
    );
    miniSled.position.set(-0.92, 0.65, 0.55);
    miniSled.rotation.y = 0.25;
    miniSled.castShadow = true;
    group.add(miniSled);

    const miniBlockGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 0.13, 0.16));
    [-0.1, 0.1].forEach((bx) => {
      const b = new THREE.Mesh(miniBlockGeo, this.textures.materials.rawBlock);
      b.position.set(-0.92 + bx, 0.75, 0.55);
      b.castShadow = true;
      group.add(b);
    });

    // Miniature oasis pool & 3 swaying palm trees
    const pool = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 12)),
      this.textures.materials.oasisWater
    );
    pool.position.set(1.45, 0.55, -0.98);
    group.add(pool);

    this._createMiniPalm(group, 1.05, 0.56, -1.25, 0.42, 0.16);
    this._createMiniPalm(group, 1.75, 0.52, -0.7, 0.36, -0.18);
    this._createMiniPalm(group, -1.65, 0.5, 1.05, 0.38, 0.14);

    // Floating crisp diegetic label
    const badge = this._addIslandBadge(group, 'Niveau 1 • Jouable', true, 3.05);

    // Generous touch hitbox for easy iPhone selection
    const hitGeo = this._trackGeo(new THREE.CylinderGeometry(2.9, 3.0, 2.4, 12));
    const hitbox = new THREE.Mesh(hitGeo, this.mats.hitbox);
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level1_pyramid',
      levelIndex: 0,
      unlocked: true,
      title: 'Niveau 1 : La Petite Pyramide (55 blocs)',
      shortLabel: 'Égypte',
      position: pos,
      focusDistance: 17.5,
      focusElevation: 40,
      focusAzimuth: 0.15,
      group,
      badge,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    mound.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 2 — Rome : La Domus Romaine (UNLOCKED & PLAYABLE)
   */
  _buildRomeIsland() {
    const pos = new THREE.Vector3(2.4, 0, -0.35);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    // Mediterranean hillside island
    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.45, 2.25, 0.72, 3.7));
    const mound = new THREE.Mesh(moundGeo, this.mats.mediterraneanGrass);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.58, 2.35);

    // Glowing golden base ring indicating UNLOCKED & PLAYABLE
    const ringGeo = this._trackGeo(new THREE.RingGeometry(2.78, 3.04, 36));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.mats.goldRing);
    ringMesh.position.y = 0.11;
    ringMesh.scale.set(1, 1, 2.52 / 2.78);
    group.add(ringMesh);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(3.04, 3.42, 36));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, this.mats.goldHalo);
    haloMesh.position.y = 0.095;
    haloMesh.scale.set(1, 1, 2.52 / 2.78);
    group.add(haloMesh);

    this.unlockedRings.push({
      nodeId: 'level2_rome',
      ringMesh,
      haloMesh,
      ratioZ: 2.52 / 2.78,
      phase: 1.55,
    });

    // Sculpted upper marble terrace hill
    const hill = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(1.15, 1.65, 0.42, 16)),
      this.mats.mediterraneanGrass
    );
    hill.position.set(0.35, 0.72, -0.35);
    hill.receiveShadow = true;
    group.add(hill);

    // Miniature Roman Imperial Aqueduct along rear ridge
    const aqGroup = new THREE.Group();
    aqGroup.position.set(-0.2, 0.68, -0.62);
    aqGroup.rotation.y = -0.22;

    const pierGeo = this._trackGeo(new THREE.BoxGeometry(0.18, 0.68, 0.22));
    const archGeo = this._trackGeo(new THREE.TorusGeometry(0.24, 0.065, 7, 14, Math.PI));
    const spacing = 0.62;

    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * spacing;
      const pier = new THREE.Mesh(pierGeo, this.mats.romanMarble);
      pier.position.set(px, 0.34, 0);
      pier.castShadow = true;
      aqGroup.add(pier);

      if (i < 3) {
        const arch = new THREE.Mesh(archGeo, this.mats.romanMarble);
        arch.position.set(px + spacing * 0.5, 0.52, 0);
        arch.castShadow = true;
        aqGroup.add(arch);
      }
    }

    const deck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.12, 0.13, 0.25)),
      this.mats.romanMarble
    );
    deck.position.y = 0.77;
    deck.castShadow = true;
    aqGroup.add(deck);

    const troughWater = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.04, 0.04, 0.11)),
      this.textures.materials.oasisWater
    );
    troughWater.position.y = 0.85;
    aqGroup.add(troughWater);
    group.add(aqGroup);

    // Miniature 3D Roman Domus Villa (marble courtyard walls + sunken turquoise impluvium + 4-sided terracotta compluvium roof!)
    const domusGroup = new THREE.Group();
    domusGroup.position.set(0.15, 0.74, 0.42);
    domusGroup.rotation.y = 0.18;

    const domusBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.18, 0.34, 1.08)),
      this.mats.romanMarble
    );
    domusBase.position.y = 0.17;
    domusBase.castShadow = true;
    domusBase.receiveShadow = true;
    domusGroup.add(domusBase);

    // 4-sided terracotta roof ring framing the open atrium compluvium
    const roofNS = this._trackGeo(new THREE.BoxGeometry(1.26, 0.16, 0.32));
    const roofEW = this._trackGeo(new THREE.BoxGeometry(0.32, 0.16, 0.52));
    [
      [0, 0.41, -0.4, roofNS],
      [0, 0.41, 0.4, roofNS],
      [-0.47, 0.41, 0, roofEW],
      [0.47, 0.41, 0, roofEW],
    ].forEach(([rx, ry, rz, g]) => {
      const rMesh = new THREE.Mesh(g, this.mats.terracotta);
      rMesh.position.set(rx, ry, rz);
      rMesh.castShadow = true;
      domusGroup.add(rMesh);
    });

    // Tiny turquoise impluvium visible inside the atrium courtyard
    const miniImpluvium = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.36, 0.05, 0.32)),
      this.textures.materials.oasisWater
    );
    miniImpluvium.position.y = 0.35;
    domusGroup.add(miniImpluvium);
    group.add(domusGroup);

    // 5 Slender Italian Cypress trees
    const cypressGeo = this._trackGeo(new THREE.ConeGeometry(0.16, 0.95, 7));
    const cypressPos = [
      [-1.35, 0.92, -0.45],
      [-1.15, 0.88, 0.65],
      [1.35, 0.9, 0.55],
      [0.65, 1.15, -1.05],
      [1.52, 0.88, -0.35],
    ];
    cypressPos.forEach(([cx, cy, cz], idx) => {
      const tree = new THREE.Mesh(cypressGeo, this.mats.cypressGreen);
      tree.position.set(cx, cy, cz);
      tree.scale.setScalar(0.82 + (idx % 3) * 0.14);
      tree.castShadow = true;
      group.add(tree);
    });

    // Floating crisp diegetic label
    const badge = this._addIslandBadge(group, 'Niveau 2 • Jouable', true, 2.85);

    // Generous touch hitbox
    const hitGeo = this._trackGeo(new THREE.CylinderGeometry(2.6, 2.7, 2.4, 12));
    const hitbox = new THREE.Mesh(hitGeo, this.mats.hitbox);
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level2_rome',
      levelIndex: 1,
      unlocked: true,
      title: 'Niveau 2 : La Domus Romaine (48 blocs)',
      shortLabel: 'Rome',
      position: pos,
      focusDistance: 17.5,
      focusElevation: 40,
      focusAzimuth: -0.15,
      group,
      badge,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    mound.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 3 — Japon : La Maison Ancienne (UNLOCKED & PLAYABLE — 46 blocs)
   */
  _buildChinaIsland() {
    const pos = new THREE.Vector3(-1.65, 0, -4.35);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    // Mossy emerald Japanese mountain garden island
    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.5, 2.3, 0.68, 6.4));
    const mound = new THREE.Mesh(moundGeo, this.mats.jadeMountain);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.62, 2.42);

    // Glowing golden base ring indicating UNLOCKED & PLAYABLE
    const ringGeo = this._trackGeo(new THREE.RingGeometry(2.8, 3.06, 36));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.mats.goldRing);
    ringMesh.position.y = 0.11;
    ringMesh.scale.set(1, 1, 2.56 / 2.8);
    group.add(ringMesh);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(3.06, 3.44, 36));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, this.mats.goldHalo);
    haloMesh.position.y = 0.095;
    haloMesh.scale.set(1, 1, 2.56 / 2.8);
    group.add(haloMesh);

    this.unlockedRings.push({
      nodeId: 'level3_japan',
      ringMesh,
      haloMesh,
      ratioZ: 2.56 / 2.8,
      phase: 3.1,
    });

    // Stepped Zen stone garden terrace beneath the traditional Japanese Minka house
    const terrace = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(1.26, 1.66, 0.36, 8)),
      this.mats.jadeMountain
    );
    terrace.position.set(0.1, 0.68, -0.1);
    terrace.castShadow = true;
    terrace.receiveShadow = true;
    group.add(terrace);

    // Tiny miniature turquoise koi pond on East flank
    const miniPond = new THREE.Mesh(
      this._trackGeo(new THREE.CircleGeometry(0.46, 14)),
      this.textures.materials.oasisWater
    );
    miniPond.rotation.x = -Math.PI / 2;
    miniPond.position.set(1.25, 0.71, 0.55);
    group.add(miniPond);

    // Miniature 3D Traditional Japanese Minka House (Ishigaki plinth + Engawa + Shoji walls + Curved Kawara Roof)
    const minka = new THREE.Group();
    minka.position.set(0.1, 0.86, -0.1);
    minka.rotation.y = 0.16;

    // Grey Ishigaki stone base + warm wooden Engawa veranda
    const stoneBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.18, 0.18, 1.08)),
      this.mats.lockStone
    );
    stoneBase.position.y = 0.09;
    stoneBase.castShadow = true;
    minka.add(stoneBase);

    const engawa = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.3, 0.06, 1.2)),
      this.textures.materials.timber
    );
    engawa.position.y = 0.19;
    minka.add(engawa);

    // Glowing cream Shoji walls framed by dark cedar corner posts
    const walls = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.98, 0.44, 0.88)),
      this.mats.shojiCream
    );
    walls.position.y = 0.43;
    walls.castShadow = true;
    minka.add(walls);

    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.08, 0.46, 0.08));
    [
      [-0.48, -0.43],
      [0.48, -0.43],
      [-0.48, 0.43],
      [0.48, 0.43],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(postGeo, this.mats.cedarDark);
      p.position.set(px, 0.43, pz);
      minka.add(p);
    });

    // Sweeping dark slate-blue Kawara hip-and-gable roof + carved ridge beam & onigawara tips
    const lowerRoof = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(1.12, 0.48, 4)),
      this.mats.kawaraSlate
    );
    lowerRoof.position.y = 0.85;
    lowerRoof.rotation.y = Math.PI / 4;
    lowerRoof.scale.set(1.06, 1.0, 0.96);
    lowerRoof.castShadow = true;
    minka.add(lowerRoof);

    const ridge = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.68, 0.1, 0.12)),
      this.mats.kawaraSlate
    );
    ridge.position.y = 1.07;
    minka.add(ridge);

    const oniGeo = this._trackGeo(new THREE.ConeGeometry(0.065, 0.16, 4));
    [-0.36, 0.36].forEach((ox) => {
      const oni = new THREE.Mesh(oniGeo, this.mats.kawaraSlate);
      oni.position.set(ox, 1.13, 0);
      oni.rotation.z = ox < 0 ? 0.25 : -0.25;
      minka.add(oni);
    });

    group.add(minka);

    // 2 Blooming Pink Cherry Blossom (Sakura) Trees framing the Japanese Minka house
    const sTrunkGeo = this._trackGeo(new THREE.CylinderGeometry(0.055, 0.09, 0.56, 6));
    const sPuffGeo = this._trackGeo(new THREE.IcosahedronGeometry(0.32, 1));
    [
      [1.22, 0.72, -0.68, 1.08],
      [-1.02, 0.72, -0.78, 0.92],
    ].forEach(([sx, sy, sz, sc], idx) => {
      const sak = new THREE.Group();
      sak.position.set(sx, sy, sz);
      sak.scale.setScalar(sc);

      const tr = new THREE.Mesh(sTrunkGeo, this.mats.cedarDark);
      tr.position.y = 0.26;
      tr.castShadow = true;
      sak.add(tr);

      [
        [0, 0.62, 0, 1.05, 0.72, 1.05, false],
        [-0.24, 0.52, 0.14, 0.78, 0.58, 0.78, true],
        [0.24, 0.54, -0.1, 0.74, 0.55, 0.74, false],
      ].forEach(([px, py, pz, rx, ry, rz, isLight]) => {
        const pf = new THREE.Mesh(sPuffGeo, isLight ? this.mats.sakuraLight : this.mats.sakuraPink);
        pf.position.set(px, py, pz);
        pf.scale.set(rx, ry, rz);
        pf.castShadow = true;
        sak.add(pf);
      });

      this.animatedProps.push({ obj: sak, type: 'sway', phase: 1.9 + idx });
      group.add(sak);
    });

    // Swaying Emerald Bamboo Grove on the mountain flank
    const bambooGroup = new THREE.Group();
    bambooGroup.position.set(-1.35, 0.56, 0.42);
    const stalkGeo = this._trackGeo(new THREE.CylinderGeometry(0.032, 0.042, 1.05, 5));
    const leafGeo = this._trackGeo(new THREE.ConeGeometry(0.14, 0.36, 4));
    for (let b = 0; b < 7; b++) {
      const angle = (b / 7) * Math.PI * 2;
      const rad = 0.2 + (b % 3) * 0.2;
      const bx = Math.cos(angle) * rad;
      const bz = Math.sin(angle) * rad;
      const hScale = 0.78 + (b % 3) * 0.22;

      const stalk = new THREE.Mesh(stalkGeo, this.mats.bambooGreen);
      stalk.position.set(bx, 0.5 * hScale, bz);
      stalk.scale.y = hScale;
      stalk.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.06;
      stalk.castShadow = true;
      bambooGroup.add(stalk);

      const crown = new THREE.Mesh(leafGeo, this.mats.bambooGreen);
      crown.position.set(bx, 1.02 * hScale, bz);
      bambooGroup.add(crown);
    }
    this.animatedProps.push({ obj: bambooGroup, type: 'sway', phase: 2.7 });
    group.add(bambooGroup);

    // Floating crisp diegetic label
    const badge = this._addIslandBadge(group, 'Niveau 3 • Jouable', true, 2.85);

    // Generous touch hitbox
    const hitGeo = this._trackGeo(new THREE.CylinderGeometry(2.65, 2.75, 2.6, 12));
    const hitbox = new THREE.Mesh(hitGeo, this.mats.hitbox);
    hitbox.position.y = 1.2;
    group.add(hitbox);

    const node = {
      id: 'level3_japan',
      levelIndex: 2,
      unlocked: true,
      title: 'Niveau 3 : La Maison Ancienne Japonaise (46 blocs)',
      shortLabel: 'Japon',
      position: pos,
      focusDistance: 17.5,
      focusElevation: 40,
      focusAzimuth: 0.14,
      group,
      badge,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    mound.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 4 — Maya : Le Temple Maya de Kukulcán (UNLOCKED & PLAYABLE — 52 blocs)
   */
  _buildMayaIsland() {
    const pos = new THREE.Vector3(4.35, 0, -4.35);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    // Lush tropical Yucatán jungle island mound
    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.45, 2.25, 0.7, 9.2));
    const mound = new THREE.Mesh(moundGeo, this.mats.mayaJungle);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.58, 2.38);

    // Glowing golden base ring indicating UNLOCKED & PLAYABLE
    const ringGeo = this._trackGeo(new THREE.RingGeometry(2.76, 3.02, 36));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.mats.goldRing);
    ringMesh.position.y = 0.11;
    ringMesh.scale.set(1, 1, 2.52 / 2.76);
    group.add(ringMesh);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(3.02, 3.4, 36));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, this.mats.goldHalo);
    haloMesh.position.y = 0.095;
    haloMesh.scale.set(1, 1, 2.52 / 2.76);
    group.add(haloMesh);

    this.unlockedRings.push({
      nodeId: 'level4_maya',
      ringMesh,
      haloMesh,
      ratioZ: 2.52 / 2.76,
      phase: 4.65,
    });

    // Miniature crystal-turquoise Sacred Cenote sinkhole ringed by mossy rocks
    const cenote = new THREE.Mesh(
      this._trackGeo(new THREE.CircleGeometry(0.52, 16)),
      this.textures.materials.oasisWater
    );
    cenote.rotation.x = -Math.PI / 2;
    cenote.position.set(1.12, 0.72, -0.58);
    group.add(cenote);

    const rockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.14, 0));
    for (let r = 0; r < 6; r++) {
      const a = (r / 6) * Math.PI * 2;
      const rk = new THREE.Mesh(rockGeo, this.mats.mayaStone);
      rk.position.set(1.12 + Math.cos(a) * 0.54, 0.76, -0.58 + Math.sin(a) * 0.48);
      group.add(rk);
    }

    // Miniature 3D Mayan Stepped Temple of Kukulcán (3 limestone tiers + front stair + red-ochre shrine + jade crest)
    const temple = new THREE.Group();
    temple.position.set(-0.22, 0.74, 0.14);
    temple.rotation.y = -0.18;

    [
      { w: 1.48, h: 0.24, y: 0.12, mat: this.mats.mayaStone },
      { w: 1.12, h: 0.24, y: 0.36, mat: this.mats.mayaStone },
      { w: 0.78, h: 0.22, y: 0.59, mat: this.mats.mayaRedOchre },
    ].forEach((t) => {
      const tier = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(t.w, t.h, t.w)), t.mat);
      tier.position.y = t.y;
      tier.castShadow = true;
      tier.receiveShadow = true;
      temple.add(tier);
    });

    // Front ceremonial staircase climbing up the South face
    const stair = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.32, 0.72, 0.55)),
      this.mats.mayaStone
    );
    stair.position.set(0, 0.34, 0.56);
    stair.rotation.x = -0.52;
    stair.castShadow = true;
    temple.add(stair);

    // Summit temple shrine + carved roof comb + gleaming emerald-jade crest jewel
    const shrine = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.52, 0.28, 0.44)),
      this.mats.mayaRedOchre
    );
    shrine.position.set(0, 0.84, -0.04);
    shrine.castShadow = true;
    temple.add(shrine);

    const comb = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.46, 0.18, 0.12)),
      this.mats.mayaRedOchre
    );
    comb.position.set(0, 1.06, -0.1);
    temple.add(comb);

    const jadeJewel = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.085, 0)),
      this.mats.mayaJade
    );
    jadeJewel.position.set(0, 1.19, -0.1);
    temple.add(jadeJewel);

    group.add(temple);

    // Tropical Jungle Palms & Ceiba trees framing the temple
    this._createMiniPalm(group, -1.35, 0.65, 0.58, 0.78, 0.18);
    this._createMiniPalm(group, 1.25, 0.65, 0.68, 0.74, -0.18);
    this._createMiniPalm(group, -1.18, 0.68, -0.82, 0.82, 0.12);

    // Floating crisp diegetic label
    const badge = this._addIslandBadge(group, 'Niveau 4 • Jouable', true, 2.85);

    // Generous touch hitbox
    const hitGeo = this._trackGeo(new THREE.CylinderGeometry(2.6, 2.7, 2.5, 12));
    const hitbox = new THREE.Mesh(hitGeo, this.mats.hitbox);
    hitbox.position.y = 1.15;
    group.add(hitbox);

    const node = {
      id: 'level4_maya',
      levelIndex: 3,
      unlocked: true,
      title: 'Niveau 4 : Le Temple Maya de Kukulcán (52 blocs)',
      shortLabel: 'Maya',
      position: pos,
      focusDistance: 17.5,
      focusElevation: 40,
      focusAzimuth: -0.22,
      group,
      badge,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    mound.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /* ============================================================================
   * 4. DOTTED STONE ROAD CONNECTING THE 4 CIVILIZATION ISLANDS
   * ========================================================================== */
  _buildDottedStoneRoads() {
    const stoneGeo = this._trackGeo(new THREE.CylinderGeometry(0.24, 0.29, 0.22, 8));

    const layCurve = (p0, pCtrl, p1, count, mat) => {
      const curve = new THREE.QuadraticBezierCurve3(p0, pCtrl, p1);
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const pt = curve.getPoint(t);
        const stone = new THREE.Mesh(stoneGeo, mat);
        stone.position.set(pt.x, 0.04, pt.z);
        stone.scale.set(1, 1, 0.85);
        stone.rotation.y = i * 0.7;
        stone.castShadow = true;
        stone.receiveShadow = true;
        this.root.add(stone);
      }
    };

    // Road Segment 1: Égypte -> Rome
    layCurve(
      new THREE.Vector3(-0.2, 0, 2.4),
      new THREE.Vector3(1.5, 0, 2.2),
      new THREE.Vector3(1.6, 0, 1.15),
      6,
      this.textures.materials.foundation
    );

    // Road Segment 2: Rome -> Japon (UNLOCKED)
    layCurve(
      new THREE.Vector3(1.45, 0, -1.75),
      new THREE.Vector3(1.15, 0, -3.55),
      new THREE.Vector3(-0.05, 0, -3.95),
      6,
      this.textures.materials.foundation
    );

    // Road Segment 3: Japon -> Maya (UNLOCKED)
    layCurve(
      new THREE.Vector3(0.45, 0, -4.55),
      new THREE.Vector3(1.55, 0, -5.05),
      new THREE.Vector3(2.45, 0, -4.55),
      5,
      this.textures.materials.foundation
    );
  }

  /* ============================================================================
   * 5. INTERACTION HOOKS (SHARED WITH TouchInteractionEngine)
   * ========================================================================== */
  _collectHitTargets() {
    this.hitTargets = this.nodes.map((n) => n.group);
  }

  getHitTargets() {
    return this.hitTargets;
  }

  onMapNodeTap(node) {
    if (!node) return;
    this.selectedNode = node;
    node.bounceTime = 0.42;

    this.audio.playMapTap(!node.unlocked);
    this.audio.playCameraWhoosh();

    // Smoothly fly camera to inspect the tapped 3D miniature island
    this.cameraController.flyTo({
      target: new THREE.Vector3(node.position.x, 0.65, node.position.z + 0.35),
      distance: node.focusDistance,
      elevationDeg: node.focusElevation,
      azimuth: node.focusAzimuth,
    });

    if (this.onSelectNode) {
      this.onSelectNode(node);
    }
  }

  onEmptyGroundTap() {
    if (!this.selectedNode) return;
    this.selectedNode = null;
    this.audio.playCameraWhoosh();
    this.cameraController.resetView(false);
    if (this.onClearSelection) {
      this.onClearSelection();
    }
  }

  /* ============================================================================
   * 6. PER-FRAME ANIMATION & CLEAN DISPOSAL
   * ========================================================================== */
  update(dt, elapsed) {
    // 1. Scroll turquoise ocean normal ripples & gentle vertex wave swell
    if (this.textures.maps.waterNormal) {
      this.textures.maps.waterNormal.offset.x = (elapsed * 0.028) % 1;
      this.textures.maps.waterNormal.offset.y = (elapsed * 0.018) % 1;
    }

    if (this.oceanGeo) {
      const pos = this.oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const wave =
          Math.sin(x * 0.65 + elapsed * 1.45) * 0.045 +
          Math.cos(z * 0.55 - elapsed * 1.15) * 0.038;
        pos.setY(i, wave);
      }
      pos.needsUpdate = true;
    }

    // 2. Pulsing golden base rings around all unlocked islands (Level 1 Égypte & Level 2 Rome)
    for (let i = 0; i < this.unlockedRings.length; i++) {
      const r = this.unlockedRings[i];
      const isSelected = this.selectedNode && this.selectedNode.id === r.nodeId;
      const selectedBoost = isSelected ? 1.07 : 1.0;
      const pulse = 1 + Math.sin(elapsed * 3.1 + r.phase) * 0.035;
      r.ringMesh.scale.set(pulse * selectedBoost, 1, r.ratioZ * pulse * selectedBoost);

      const haloPhase = (elapsed * 0.45 + r.phase * 0.25) % 1;
      const haloPulse = 1 + haloPhase * 0.16;
      r.haloMesh.scale.set(haloPulse, 1, r.ratioZ * haloPulse);
    }
    if (this.unlockedRings.length > 0) {
      this.mats.goldRing.opacity = 0.72 + Math.sin(elapsed * 3.1) * 0.22;
      this.mats.goldHalo.opacity = (1 - ((elapsed * 0.45) % 1)) * 0.42;
    }

    // 3. Soft breathing shoreline foam around all 3 islands
    for (let i = 0; i < this.shoreRings.length; i++) {
      const sr = this.shoreRings[i];
      const s = 1 + Math.sin(elapsed * 2.1 + sr.phase) * 0.025;
      sr.mesh.scale.set(sr.baseSX * s, 1, sr.baseSZ * s);
    }

    // 4. Gentle breeze on miniature palms & bamboo + tactile tap bounce on islands
    for (let i = 0; i < this.animatedProps.length; i++) {
      const p = this.animatedProps[i];
      p.obj.rotation.z = Math.sin(elapsed * 1.6 + p.phase) * 0.05;
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.bounceTime > 0) {
        n.bounceTime = Math.max(0, n.bounceTime - dt);
        const t = 1 - n.bounceTime / 0.42;
        const bounce = Math.sin(t * Math.PI) * 0.18;
        n.group.position.y = bounce;
        if (n.lock) {
          n.lock.rotation.z = Math.sin(t * Math.PI * 4) * 0.22 * (1 - t);
        }
      } else {
        n.group.position.y = Math.sin(elapsed * 1.3 + i * 2.1) * 0.025;
        if (n.lock) n.lock.rotation.z = 0;
      }
    }
  }

  dispose() {
    this.nodes.length = 0;
    this.hitTargets.length = 0;
    this.animatedProps.length = 0;
    this.shoreRings.length = 0;
    this.unlockedRings.length = 0;
    this.selectedNode = null;

    this.scene.remove(this.root);

    this.ownedGeometries.forEach((g) => g.dispose());
    this.ownedMaterials.forEach((m) => m.dispose());
    this.ownedTextures.forEach((t) => t.dispose());
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.ownedTextures.length = 0;
  }
}
