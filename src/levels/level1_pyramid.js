/**
 * Workd Builder — Level 1: "La Petite Pyramide - 5 Étages"
 * Self-contained level module managing the desert diorama, 4 connected production stations
 * (Quarry, Wooden Sleds on Tracks A & B, Stonecutter Workbench, 5-Tier 55-Block Pyramid),
 * pooled particle FX, and golden sunbeam completion sequence.
 *
 * Extensibility Contract:
 * Future levels in `src/levels/` (e.g., medieval houses, monuments, towns) can follow this
 * exact class interface:
 *  - static meta = { id, title, hudLabel, totalGoal }
 *  - init(), update(dt, elapsed), getHitTargets(), evaluateDropZones(), clearDropHighlights(),
 *    onBlockDragStart(), onBlockDrop(), onBlockDragCancel(),
 *    onSledDragStart(), onSledDragMove(), onSledDragEnd(), onSledTap(), onSledLeverTap(),
 *    chipQuarryNode(), carveWorkbenchBlock(), dispose()
 */

import * as THREE from 'three';

const BLOCK_W = 0.96;
const BLOCK_H = 0.68;
const BLOCK_D = 0.96;
const PYRAMID_STEP = 1.01;
const PYRAMID_CENTER = new THREE.Vector3(3.6, 0, -0.75);
const FOUNDATION_Y = 0.28;

const LAYER_SIZES = [5, 4, 3, 2, 1]; // 25 + 16 + 9 + 4 + 1 = 55 blocks

/**
 * Creates a displaced rough low-poly stone geometry (for Raw & Stage 1 blocks).
 */
function createRoughStoneGeometry(w, h, d, roughness, seed = 11) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = geo.attributes.position;
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Displace shared spatial vertices consistently so no cracks open
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * 100)}_${Math.round(y * 100)}_${Math.round(z * 100)}`;
    let off = map.get(key);
    if (!off) {
      off = [
        (rand() - 0.5) * roughness,
        (rand() - 0.5) * roughness * 0.85,
        (rand() - 0.5) * roughness,
      ];
      map.set(key, off);
    }
    pos.setXYZ(i, x + off[0], y + off[1], z + off[2]);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a crisp beveled sandstone ashlar block geometry with clean UVs.
 */
function createBeveledBlockGeometry(w, h, d, bevel = 0.055) {
  const shape = new THREE.Shape();
  const hw = w * 0.5 - bevel;
  const hd = d * 0.5 - bevel;
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  });

  // Orient extrusion along Y axis and center at origin
  geo.rotateX(-Math.PI / 2);
  geo.center();

  // Normalize box-projected UVs so procedural sandstone & hieroglyphic trim maps crisply
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny >= nx && ny >= nz) {
      uv.setXY(i, x / w + 0.5, z / d + 0.5);
    } else if (nx >= nz) {
      uv.setXY(i, z / d + 0.5, y / h + 0.5);
    } else {
      uv.setXY(i, x / w + 0.5, y / h + 0.5);
    }
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export class Level1Pyramid {
  static meta = {
    id: 'level1_pyramid',
    title: 'La Petite Pyramide - 5 Étages',
    hudLabel: 'Pyramide',
    totalGoal: 55,
  };

  constructor({ scene, textures, audio, onProgress, onComplete }) {
    this.scene = scene;
    this.textures = textures;
    this.audio = audio;
    this.onProgress = onProgress;
    this.onComplete = onComplete;

    this.root = new THREE.Group();
    this.root.name = 'Level1PyramidRoot';
    this.scene.add(this.root);

    // Track locally allocated geometries/materials for guaranteed leak-free disposal
    this.ownedGeometries = [];
    this.ownedMaterials = [];

    // Gameplay collections
    this.blocks = [];
    this.quarryNodes = [];
    this.quarrySlots = [];
    this.sleds = [];
    this.workbenchSlot = null;
    this.outputSlots = [];
    this.stagingSlots = [];
    this.pyramidSlots = [];
    this.hitTargets = [];
    this.tweens = [];
    this.slotMarkers = [];

    // Pyramid construction progress
    this.placedCount = 0;
    this.activeLayer = 0;
    this.isComplete = false;
    this.blockIdCounter = 1;

    // Animated environment props
    this.palmFronds = [];
    this.canopyMesh = null;
    this.carvingPips = [];
    this.victoryGroup = null;
    this.victoryBeamInner = null;
    this.victoryBeamOuter = null;
    this.victoryMoteAccum = 0;

    // Pooled particle system
    this.particles = [];
    this.particleCursor = 0;

    this._initSharedGeometries();
    this._buildDioramaBase();
    this._buildQuarryStation();
    this._buildTransportTracksAndSleds();
    this._buildStonecutterWorkshop();
    this._buildPyramidSite();
    this._buildParticlePool();
    this._rebuildHitTargets();
  }

  _trackGeo(geo) {
    this.ownedGeometries.push(geo);
    return geo;
  }

  _trackMat(mat) {
    this.ownedMaterials.push(mat);
    return mat;
  }

  _initSharedGeometries() {
    this.geos = {
      rawBlock: this._trackGeo(createRoughStoneGeometry(0.92, 0.66, 0.92, 0.14, 17)),
      stage1Block: this._trackGeo(createRoughStoneGeometry(0.93, 0.67, 0.93, 0.08, 29)),
      stage2Block: this._trackGeo(createBeveledBlockGeometry(0.95, 0.67, 0.95, 0.07)),
      carvedBlock: this._trackGeo(createBeveledBlockGeometry(BLOCK_W, BLOCK_H, BLOCK_D, 0.05)),
      capstone: this._trackGeo(
        (() => {
          const g = new THREE.ConeGeometry(BLOCK_W / Math.SQRT2, 0.82, 4);
          g.rotateY(Math.PI / 4);
          return g;
        })()
      ),
      ghostBox: this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.89, BLOCK_H * 0.92, BLOCK_D * 0.89)),
      ghostBoxEdges: this._trackGeo(
        (() => {
          const g = new THREE.BoxGeometry(BLOCK_W * 0.9, BLOCK_H * 0.93, BLOCK_D * 0.9);
          const edges = new THREE.EdgesGeometry(g);
          g.dispose();
          return edges;
        })()
      ),
      ghostCapstone: this._trackGeo(
        (() => {
          const g = new THREE.ConeGeometry(BLOCK_W / Math.SQRT2, 0.82, 4);
          g.rotateY(Math.PI / 4);
          return g;
        })()
      ),
      ghostCapstoneEdges: this._trackGeo(
        (() => {
          const g = new THREE.ConeGeometry(BLOCK_W / Math.SQRT2, 0.82, 4);
          g.rotateY(Math.PI / 4);
          const edges = new THREE.EdgesGeometry(g);
          g.dispose();
          return edges;
        })()
      ),
      slotOutline: this._trackGeo(
        (() => {
          const g = new THREE.RingGeometry(0.38, 0.48, 4);
          g.rotateX(-Math.PI / 2);
          g.rotateY(Math.PI / 4);
          return g;
        })()
      ),
      particleCube: this._trackGeo(new THREE.DodecahedronGeometry(0.11, 0)),
    };

    // Shared ghost slot materials (normal vs snap-highlighted)
    this.mats = {
      ghostNormal: this._trackMat(
        new THREE.MeshBasicMaterial({
          map: this.textures.maps.blueprint,
          color: 0x72e0ff,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        })
      ),
      ghostHighlight: this._trackMat(
        new THREE.MeshBasicMaterial({
          map: this.textures.maps.blueprint,
          color: 0xffe27a,
          transparent: true,
          opacity: 0.84,
          depthWrite: false,
        })
      ),
      ghostLineNormal: this._trackMat(
        new THREE.LineBasicMaterial({
          color: 0xdffaff,
          transparent: true,
          opacity: 0.85,
        })
      ),
      ghostLineHighlight: this._trackMat(
        new THREE.LineBasicMaterial({
          color: 0xffdc66,
          transparent: true,
          opacity: 1.0,
        })
      ),
      slotIdle: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x8f6b3e,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      ),
      slotValid: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x89e2ff,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      ),
      slotSnap: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffd357,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        })
      ),
      dustLimestone: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xd4cbb8, roughness: 0.95 })),
      dustSand: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xe7c37c, roughness: 0.95 })),
      dustGold: this._trackMat(
        new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.92 })
      ),
      sparkCopper: this._trackMat(new THREE.MeshBasicMaterial({ color: 0xfff0b2 })),
    };
  }

  /* ============================================================================
   * 1. DESERT DIORAMA BASE & DECORATIVE PROPS
   * ========================================================================== */
  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // Top desert sand tabletop slab
    const sandTopGeo = this._trackGeo(new THREE.BoxGeometry(19.6, 0.36, 18.6));
    const sandTop = new THREE.Mesh(sandTopGeo, this.textures.materials.sand);
    sandTop.position.set(0, -0.18, 0);
    sandTop.receiveShadow = true;
    env.add(sandTop);

    // Layered geological sandstone plinth skirt underneath
    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(19.1, 1.5, 18.1));
    const plinth = new THREE.Mesh(plinthGeo, this.textures.materials.plinth);
    plinth.position.set(0, -1.1, 0);
    plinth.receiveShadow = true;
    env.add(plinth);

    // Sculpted rolling perimeter dunes with seamless planar UVs (no pole pinching)
    const duneSpecs = [
      { x: 0.9, z: -7.7, sx: 4.5, sy: 0.68, sz: 1.9 },
      { x: 8.1, z: -4.2, sx: 2.1, sy: 0.82, sz: 3.4 },
      { x: 8.2, z: 2.5, sx: 1.9, sy: 0.64, sz: 3.1 },
      { x: -8.2, z: 0.6, sx: 1.9, sy: 0.72, sz: 3.6 },
      { x: 0.6, z: 8.25, sx: 3.8, sy: 0.54, sz: 1.45 },
      { x: -7.4, z: 7.7, sx: 2.4, sy: 0.6, sz: 1.8 },
    ];
    const duneGeo = this._trackGeo(
      (() => {
        const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const pos = g.attributes.position;
        const uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          uv.setXY(i, pos.getX(i) * 0.32 + 0.5, pos.getZ(i) * 0.32 + 0.5);
        }
        uv.needsUpdate = true;
        return g;
      })()
    );
    duneSpecs.forEach((d) => {
      const mesh = new THREE.Mesh(duneGeo, this.textures.materials.sand);
      mesh.position.set(d.x, -0.06, d.z);
      mesh.scale.set(d.sx, d.sy, d.sz);
      mesh.receiveShadow = true;
      env.add(mesh);
    });

    // Small turquoise desert oasis pool in the North-East corner
    const poolRimGeo = this._trackGeo(new THREE.CylinderGeometry(1.75, 1.9, 0.14, 14));
    const poolRim = new THREE.Mesh(poolRimGeo, this.textures.materials.sand);
    poolRim.position.set(6.5, 0.01, -6.1);
    poolRim.scale.set(1.25, 1, 0.85);
    poolRim.receiveShadow = true;
    env.add(poolRim);

    const waterGeo = this._trackGeo(new THREE.CylinderGeometry(1.42, 1.42, 0.08, 14));
    const water = new THREE.Mesh(waterGeo, this.textures.materials.oasisWater);
    water.position.set(6.5, 0.06, -6.1);
    water.scale.set(1.22, 1, 0.82);
    water.receiveShadow = true;
    env.add(water);

    // Stylized low-poly date palms framing the oasis & outer edge
    this._createPalmTree(env, 4.9, -6.8, 1.05, 0.14);
    this._createPalmTree(env, 7.8, -6.6, 0.88, -0.16);
    this._createPalmTree(env, 7.6, 5.8, 0.95, -0.12);
    this._createPalmTree(env, -7.6, 6.2, 0.82, 0.18);

    // Subtle sandstone stepping stones along the central work avenues
    const stepGeo = this._trackGeo(new THREE.BoxGeometry(0.75, 0.06, 0.55));
    const stepCoords = [
      [-1.1, -1.6],
      [-0.4, -0.7],
      [-0.9, 0.5],
      [-0.4, 1.8],
      [3.6, 3.05],
    ];
    stepCoords.forEach(([x, z], i) => {
      const stone = new THREE.Mesh(stepGeo, this.textures.materials.foundation);
      stone.position.set(x, 0.02, z);
      stone.rotation.y = (i % 2 === 0 ? 0.12 : -0.15);
      stone.receiveShadow = true;
      env.add(stone);
    });
  }

  _createPalmTree(parent, x, z, scale = 1, lean = 0.12) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);

    // Segmented curved trunk
    const segGeo = this._trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 0.52, 6));
    let curY = 0.22;
    let curX = 0;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(segGeo, this.textures.materials.palmTrunk);
      seg.position.set(curX, curY, 0);
      seg.rotation.z = lean * (i * 0.42);
      const shrink = 1 - i * 0.1;
      seg.scale.set(shrink, 1, shrink);
      seg.castShadow = true;
      group.add(seg);
      curX -= Math.sin(lean * (i * 0.42)) * 0.36;
      curY += 0.44;
    }

    // Crown of swaying palm fronds
    const crown = new THREE.Group();
    crown.position.set(curX, curY - 0.1, 0);
    const frondGeo = this._trackGeo(new THREE.ConeGeometry(0.24, 1.35, 4));
    frondGeo.scale(1, 1, 0.22);
    frondGeo.translate(0, 0.65, 0);

    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(frondGeo, this.textures.materials.palmLeaf);
      frond.rotation.y = (f / 6) * Math.PI * 2;
      frond.rotation.z = 1.05 + (f % 2) * 0.18;
      frond.castShadow = true;
      crown.add(frond);
    }
    group.add(crown);
    this.palmFronds.push({ group: crown, phase: x * 0.7 + z * 0.3 });
    parent.add(group);
  }

  /* ============================================================================
   * 2. STATION 1 — LA CARRIÈRE (QUARRY - NORTH-WEST)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    // Stepped stratified limestone cliff terraces (NW corner)
    const terraceSpecs = [
      { x: -4.7, y: 0.45, z: -5.9, w: 6.4, h: 0.9, d: 2.3 },
      { x: -5.1, y: 1.25, z: -6.45, w: 5.4, h: 1.0, d: 1.65 },
      { x: -5.5, y: 2.0, z: -6.95, w: 4.1, h: 0.9, d: 1.2 },
      { x: -7.5, y: 0.65, z: -4.9, w: 1.6, h: 1.3, d: 2.6 },
    ];
    terraceSpecs.forEach((t) => {
      const geo = this._trackGeo(new THREE.BoxGeometry(t.w, t.h, t.d));
      const mesh = new THREE.Mesh(geo, this.textures.materials.limestone);
      mesh.position.set(t.x, t.y, t.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      quarryGroup.add(mesh);
    });

    // Timber quarry beam & resting copper pickaxe prop
    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.18, 1.5, 0.18));
    const beamGeo = this._trackGeo(new THREE.BoxGeometry(1.4, 0.16, 0.18));
    const post = new THREE.Mesh(postGeo, this.textures.materials.timber);
    post.position.set(-2.1, 0.75, -5.2);
    post.castShadow = true;
    quarryGroup.add(post);

    const beam = new THREE.Mesh(beamGeo, this.textures.materials.timber);
    beam.position.set(-2.5, 1.45, -5.2);
    beam.castShadow = true;
    quarryGroup.add(beam);

    // 3 Extractable Rock Nodes along the cliff base
    const nodePositions = [
      new THREE.Vector3(-6.05, 0.46, -4.55),
      new THREE.Vector3(-4.6, 0.5, -4.78),
      new THREE.Vector3(-3.15, 0.46, -4.55),
    ];

    const nodeGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.62, 0));
    const hitSphereGeo = this._trackGeo(new THREE.SphereGeometry(0.84, 8, 6));
    const hitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    nodePositions.forEach((pos, idx) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(pos);

      const mat = this._trackMat(this.textures.materials.limestone.clone());
      mat.emissive = new THREE.Color(0x3a2a12);
      mat.emissiveIntensity = 0.08;

      const rockMesh = new THREE.Mesh(nodeGeo, mat);
      rockMesh.scale.set(1.12, 0.86, 1.04);
      rockMesh.rotation.set(idx * 0.4, idx * 1.1, idx * 0.25);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      nodeGroup.add(rockMesh);

      const nodeData = {
        index: idx,
        group: nodeGroup,
        mesh: rockMesh,
        material: mat,
        basePos: pos.clone(),
        hits: 0,
        maxHits: 2,
        depleted: false,
        regenTimer: 0,
        shakeTime: 0,
      };

      // Generous invisible touch hitbox for effortless iPhone tapping/holding
      const hitbox = new THREE.Mesh(hitSphereGeo, hitMat);
      hitbox.userData.interact = { type: 'quarry-node', node: nodeData };
      rockMesh.userData.interact = { type: 'quarry-node', node: nodeData };
      nodeGroup.add(hitbox);

      quarryGroup.add(nodeGroup);
      this.quarryNodes.push(nodeData);
    });

    // Quarry Raw-Stone Staging Pad (5 neat slots right in front of the rock nodes)
    const padGeo = this._trackGeo(new THREE.BoxGeometry(5.6, 0.14, 1.35));
    const pad = new THREE.Mesh(padGeo, this.textures.materials.foundation);
    pad.position.set(-4.6, 0.07, -3.15);
    pad.receiveShadow = true;
    quarryGroup.add(pad);

    for (let i = 0; i < 5; i++) {
      const sx = -6.6 + i * 1.0;
      const slotPos = new THREE.Vector3(sx, 0.14 + BLOCK_H * 0.5, -3.15);
      const marker = this._createSlotMarker(quarryGroup, sx, 0.155, -3.15);
      this.quarrySlots.push({
        id: `quarry_${i}`,
        zoneType: 'quarry',
        accepts: ['raw'],
        position: slotPos,
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    }
  }

  /* ============================================================================
   * 3. STATION 2 — LE TRANSPORT (TRACKS A & B + WOODEN SLEDS)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    // Track A: West, North-South (Quarry -> Stonecutter)
    this._createTrackAndSled({
      id: 'sledA',
      axis: 'z',
      fixedCoord: -4.6,
      startPos: -1.3,
      endPos: 1.45,
      trackStart: -2.05,
      trackEnd: 2.25,
      accepts: ['raw', 'carved', 'capstone'],
      primaryKind: 'raw',
      leverLocalPos: new THREE.Vector3(1.76, 0.34, 0),
    });

    // Track B: Center-South, West-East (Stonecutter -> Pyramid Staging)
    this._createTrackAndSled({
      id: 'sledB',
      axis: 'x',
      fixedCoord: 4.85,
      startPos: -1.45,
      endPos: 1.85,
      trackStart: -2.25,
      trackEnd: 2.65,
      accepts: ['carved', 'capstone', 'raw'],
      primaryKind: 'carved',
      leverLocalPos: new THREE.Vector3(0, 0.34, 1.76),
    });
  }

  _createTrackAndSled(cfg) {
    const trackGroup = new THREE.Group();
    this.root.add(trackGroup);

    const len = cfg.trackEnd - cfg.trackStart;
    const mid = (cfg.trackStart + cfg.trackEnd) * 0.5;
    const isZ = cfg.axis === 'z';

    // Two longitudinal timber rail runners
    const railGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(0.24, 0.12, len) : new THREE.BoxGeometry(len, 0.12, 0.24)
    );
    [-0.95, 0.95].forEach((offset) => {
      const rail = new THREE.Mesh(railGeo, this.textures.materials.timberDark);
      rail.position.set(
        isZ ? cfg.fixedCoord + offset : mid,
        0.05,
        isZ ? mid : cfg.fixedCoord + offset
      );
      rail.receiveShadow = true;
      trackGroup.add(rail);
    });

    // Sunken wooden cross-ties along the track
    const tieGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(2.55, 0.08, 0.24) : new THREE.BoxGeometry(0.24, 0.08, 2.55)
    );
    const tieCount = 8;
    for (let i = 0; i < tieCount; i++) {
      const t = cfg.trackStart + 0.25 + (i / (tieCount - 1)) * (len - 0.5);
      const tie = new THREE.Mesh(tieGeo, this.textures.materials.timber);
      tie.position.set(isZ ? cfg.fixedCoord : t, 0.035, isZ ? t : cfg.fixedCoord);
      tie.receiveShadow = true;
      trackGroup.add(tie);
    }

    // End bumpers at both stations
    const bumperGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(2.4, 0.22, 0.18) : new THREE.BoxGeometry(0.18, 0.22, 2.4)
    );
    [cfg.trackStart, cfg.trackEnd].forEach((endVal) => {
      const b = new THREE.Mesh(bumperGeo, this.textures.materials.timberDark);
      b.position.set(isZ ? cfg.fixedCoord : endVal, 0.11, isZ ? endVal : cfg.fixedCoord);
      b.castShadow = true;
      b.receiveShadow = true;
      trackGroup.add(b);
    });

    // Wooden Desert Sled Mesh
    const sledGroup = new THREE.Group();
    const initX = isZ ? cfg.fixedCoord : cfg.startPos;
    const initZ = isZ ? cfg.startPos : cfg.fixedCoord;
    sledGroup.position.set(initX, 0.11, initZ);
    this.root.add(sledGroup);

    // Sled runners (curved sled feel with angled end tips)
    const runnerGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(0.18, 0.14, 1.32) : new THREE.BoxGeometry(1.32, 0.14, 0.18)
    );
    [-1.15, 0, 1.15].forEach((rOff) => {
      const runner = new THREE.Mesh(runnerGeo, this.textures.materials.timberDark);
      runner.position.set(isZ ? rOff : 0, 0.07, isZ ? 0 : rOff);
      runner.castShadow = true;
      runner.receiveShadow = true;
      sledGroup.add(runner);
    });

    // Slatted wooden cargo deck (holds 3 blocks side-by-side)
    const deckGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(3.15, 0.14, 1.18) : new THREE.BoxGeometry(1.18, 0.14, 3.15)
    );
    const deck = new THREE.Mesh(deckGeo, this.textures.materials.timber);
    deck.position.y = 0.19;
    deck.castShadow = true;
    deck.receiveShadow = true;
    sledGroup.add(deck);

    // Low side guard rails on front/back of deck
    const guardGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(3.15, 0.11, 0.08) : new THREE.BoxGeometry(0.08, 0.11, 3.15)
    );
    [-0.55, 0.55].forEach((gOff) => {
      const guard = new THREE.Mesh(guardGeo, this.textures.materials.timberDark);
      guard.position.set(isZ ? 0 : gOff, 0.3, isZ ? gOff : 0);
      guard.castShadow = true;
      sledGroup.add(guard);
    });

    // Physical wooden pull-lever assembly (mounted on side facing clear space)
    const leverPivot = new THREE.Group();
    leverPivot.position.copy(cfg.leverLocalPos);
    leverPivot.position.y = 0.22;

    const leverBaseGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.18, 0.32));
    const leverBase = new THREE.Mesh(leverBaseGeo, this.textures.materials.timberDark);
    leverBase.position.copy(cfg.leverLocalPos);
    leverBase.position.y = 0.18;
    leverBase.castShadow = true;
    sledGroup.add(leverBase);

    const leverStickGeo = this._trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.85, 7));
    const leverStick = new THREE.Mesh(leverStickGeo, this.textures.materials.timber);
    leverStick.position.y = 0.42;
    leverStick.castShadow = true;
    leverPivot.add(leverStick);

    const knobGeo = this._trackGeo(new THREE.SphereGeometry(0.16, 10, 8));
    const knob = new THREE.Mesh(knobGeo, this.textures.materials.leverKnob);
    knob.position.y = 0.86;
    knob.castShadow = true;
    leverPivot.add(knob);

    // Generous invisible touch collider around the lever for crisp mobile tapping
    const leverHitGeo = this._trackGeo(new THREE.SphereGeometry(0.56, 8, 6));
    const leverHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    const leverHit = new THREE.Mesh(leverHitGeo, leverHitMat);
    leverHit.position.y = 0.55;
    leverPivot.add(leverHit);

    sledGroup.add(leverPivot);

    // Build sled state object & 3 cargo slots
    const sled = {
      id: cfg.id,
      axis: cfg.axis,
      fixedCoord: cfg.fixedCoord,
      startPos: cfg.startPos,
      endPos: cfg.endPos,
      primaryKind: cfg.primaryKind,
      group: sledGroup,
      deck,
      leverPivot,
      leverAngle: -0.42,
      targetLeverAngle: -0.42,
      progress: 0, // 0 = start station, 1 = end station
      targetProgress: 0,
      isAutoGliding: false,
      isDragging: false,
      dragOffset: 0,
      sandTrailAccum: 0,
      slots: [],
    };

    const leverInteract = { type: 'sled-lever', sled };
    leverStick.userData.interact = leverInteract;
    knob.userData.interact = leverInteract;
    leverHit.userData.interact = leverInteract;

    const sledInteract = { type: 'sled', sled };
    deck.userData.interact = sledInteract;

    // 3 Cargo slots mounted on the sled deck
    const offsets = [-1.02, 0, 1.02];
    offsets.forEach((off, idx) => {
      const localX = isZ ? off : 0;
      const localZ = isZ ? 0 : off;
      const marker = this._createSlotMarker(sledGroup, localX, 0.275, localZ);
      const slot = {
        id: `${cfg.id}_slot_${idx}`,
        zoneType: 'sled',
        sled,
        localOffset: new THREE.Vector3(localX, 0.26 + BLOCK_H * 0.5, localZ),
        accepts: cfg.accepts,
        position: new THREE.Vector3(),
        dropIndicatorY: 0.37,
        marker,
        block: null,
      };
      this._syncSledSlotWorldPos(sled, slot);
      sled.slots.push(slot);
    });

    this.sleds.push(sled);
  }

  _syncSledSlotWorldPos(sled, slot) {
    slot.position.set(
      sled.group.position.x + slot.localOffset.x,
      sled.group.position.y + slot.localOffset.y,
      sled.group.position.z + slot.localOffset.z
    );
  }

  _updateSledTransform(sled) {
    const posVal = THREE.MathUtils.lerp(sled.startPos, sled.endPos, sled.progress);
    if (sled.axis === 'z') {
      sled.group.position.z = posVal;
    } else {
      sled.group.position.x = posVal;
    }

    // Keep all cargo slots and loaded blocks riding smoothly with the sled
    sled.slots.forEach((slot) => {
      this._syncSledSlotWorldPos(sled, slot);
      if (slot.block && !slot.block.isDragging && !slot.block.isTweening) {
        slot.block.mesh.position.copy(slot.position);
      }
    });
  }

  /* ============================================================================
   * 4. STATION 3 — L'ATELIER DE TAILLE (STONECUTTER WORKBENCH - SOUTH-WEST)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const workshop = new THREE.Group();
    this.root.add(workshop);

    const cx = -4.6;
    const cz = 4.85;

    // Stone floor apron
    const floorGeo = this._trackGeo(new THREE.BoxGeometry(3.8, 0.14, 3.6));
    const floor = new THREE.Mesh(floorGeo, this.textures.materials.foundation);
    floor.position.set(cx, 0.07, cz + 0.35);
    floor.receiveShadow = true;
    workshop.add(floor);

    // Shaded timber pergola posts (4 corner cedar posts)
    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.18, 2.55, 0.18));
    const postOffsets = [
      [-1.65, -1.25],
      [1.65, -1.25],
      [-1.65, 1.35],
      [1.65, 1.35],
    ];
    postOffsets.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, this.textures.materials.timberDark);
      post.position.set(cx + px, 1.32, cz + pz);
      post.castShadow = true;
      workshop.add(post);
    });

    // Overhead rafters
    const beamXGeo = this._trackGeo(new THREE.BoxGeometry(3.55, 0.14, 0.14));
    [-1.25, 1.35].forEach((bz) => {
      const beam = new THREE.Mesh(beamXGeo, this.textures.materials.timber);
      beam.position.set(cx, 2.6, cz + bz);
      beam.castShadow = true;
      workshop.add(beam);
    });

    // Open-front woven desert canopy shade (positioned slightly back so anvil stays 100% visible)
    const canopyGeo = this._trackGeo(new THREE.PlaneGeometry(3.55, 1.65, 6, 2));
    canopyGeo.rotateX(-Math.PI / 2 + 0.14);
    const canopy = new THREE.Mesh(canopyGeo, this.textures.materials.canopy);
    canopy.position.set(cx, 2.74, cz - 0.52);
    canopy.castShadow = true;
    workshop.add(canopy);
    this.canopyMesh = canopy;

    // Central Dressed-Stone Workbench / Anvil
    const anvilBaseGeo = this._trackGeo(new THREE.BoxGeometry(1.56, 0.48, 1.56));
    const anvilBase = new THREE.Mesh(anvilBaseGeo, this.textures.materials.limestone);
    anvilBase.position.set(cx, 0.36, cz - 0.1);
    anvilBase.castShadow = true;
    anvilBase.receiveShadow = true;
    workshop.add(anvilBase);

    const anvilTopGeo = this._trackGeo(new THREE.BoxGeometry(1.7, 0.12, 1.7));
    const anvilTop = new THREE.Mesh(anvilTopGeo, this.textures.materials.foundation);
    anvilTop.position.set(cx, 0.65, cz - 0.1);
    anvilTop.castShadow = true;
    anvilTop.receiveShadow = true;
    workshop.add(anvilTop);

    // Mason's wooden mallet & copper chisel resting on the corner of the workbench
    const malletHandleGeo = this._trackGeo(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 6));
    const malletHandle = new THREE.Mesh(malletHandleGeo, this.textures.materials.timber);
    malletHandle.position.set(cx + 0.62, 0.74, cz - 0.56);
    malletHandle.rotation.set(Math.PI / 2, 0, 0.45);
    workshop.add(malletHandle);

    const malletHeadGeo = this._trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 7));
    const malletHead = new THREE.Mesh(malletHeadGeo, this.textures.materials.timberDark);
    malletHead.position.set(cx + 0.72, 0.77, cz - 0.68);
    malletHead.rotation.set(0, 0.45, Math.PI / 2);
    workshop.add(malletHead);

    const chiselGeo = this._trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.36));
    const chisel = new THREE.Mesh(chiselGeo, this.textures.materials.copperTool);
    chisel.position.set(cx - 0.64, 0.73, cz - 0.54);
    chisel.rotation.y = -0.38;
    workshop.add(chisel);

    // Workbench drop slot (accepts Raw Stone Blocks for 3-stage carving)
    const wbY = 0.71;
    const wbMarker = this._createSlotMarker(workshop, cx, wbY + 0.015, cz - 0.1);
    this.workbenchSlot = {
      id: 'workbench_anvil',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(cx, wbY + BLOCK_H * 0.5, cz - 0.1),
      dropIndicatorY: wbY + 0.01,
      marker: wbMarker,
      block: null,
    };

    // Generous invisible carve-swipe hitbox over anvil (active whenever an uncarved block sits on it)
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.9, 1.35, 1.9));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(cx, wbY + 0.45, cz - 0.1);
    this.workbenchCarveHitbox.visible = false;
    workshop.add(this.workbenchCarveHitbox);

    // 3 diegetic floating carving-stage diamond pips above the anvil
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.095, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
        })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(cx + (i - 1) * 0.32, wbY + 1.28, cz - 0.1);
      pip.visible = false;
      workshop.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // Finished Carved Output Pallet (3 tidy slots right along the South edge of the workshop)
    for (let i = 0; i < 3; i++) {
      const ox = cx + (i - 1) * 1.05;
      const oz = cz + 1.35;
      const marker = this._createSlotMarker(workshop, ox, 0.155, oz);
      this.outputSlots.push({
        id: `workshop_out_${i}`,
        zoneType: 'output',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(ox, 0.14 + BLOCK_H * 0.5, oz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    }
  }

  _updateCarvingPips() {
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    const show = Boolean(block && !block.isDragging && block.kind === 'raw');
    this.workbenchCarveHitbox.visible = show;
    if (show) {
      this.workbenchCarveHitbox.userData.interact = { type: 'workbench-carve', block };
    } else {
      delete this.workbenchCarveHitbox.userData.interact;
    }

    this.carvingPips.forEach((p, idx) => {
      p.mesh.visible = show;
      if (show) {
        const filled = idx < block.carveStage;
        p.mat.color.setHex(filled ? 0xffd24c : 0xe9e1cf);
        p.mat.opacity = filled ? 0.96 : 0.36;
        p.mesh.scale.setScalar(filled ? 1.2 : 0.85);
      }
    });
  }

  /* ============================================================================
   * 5. STATION 4 — LE CHANTIER DE LA PYRAMIDE (5-TIER 55-BLOCK PYRAMID - EAST)
   * ========================================================================== */
  _buildPyramidSite() {
    const site = new THREE.Group();
    this.root.add(site);

    // Dressed-stone foundation terrace
    const baseGeo = this._trackGeo(new THREE.BoxGeometry(5.9, FOUNDATION_Y, 5.9));
    const baseMesh = new THREE.Mesh(baseGeo, this.textures.materials.foundation);
    baseMesh.position.set(PYRAMID_CENTER.x, FOUNDATION_Y * 0.5, PYRAMID_CENTER.z);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    site.add(baseMesh);

    // Stepped perimeter stone trim curb
    const curbGeo = this._trackGeo(new THREE.BoxGeometry(6.35, 0.12, 6.35));
    const curb = new THREE.Mesh(curbGeo, this.textures.materials.limestone);
    curb.position.set(PYRAMID_CENTER.x, 0.06, PYRAMID_CENTER.z);
    curb.receiveShadow = true;
    site.add(curb);

    // 4 miniature sandstone corner obelisk markers around the foundation
    const obeliskBodyGeo = this._trackGeo(new THREE.BoxGeometry(0.28, 0.9, 0.28));
    const obeliskTipGeo = this._trackGeo(new THREE.ConeGeometry(0.2, 0.28, 4));
    obeliskTipGeo.rotateY(Math.PI / 4);
    const cornerOff = 2.86;
    [
      [-cornerOff, -cornerOff],
      [cornerOff, -cornerOff],
      [-cornerOff, cornerOff],
      [cornerOff, cornerOff],
    ].forEach(([cx, cz]) => {
      const ob = new THREE.Mesh(obeliskBodyGeo, this.textures.materials.carvedBlock);
      ob.position.set(PYRAMID_CENTER.x + cx, FOUNDATION_Y + 0.45, PYRAMID_CENTER.z + cz);
      ob.castShadow = true;
      site.add(ob);

      const tip = new THREE.Mesh(obeliskTipGeo, this.textures.materials.capstoneGold);
      tip.position.set(PYRAMID_CENTER.x + cx, FOUNDATION_Y + 1.04, PYRAMID_CENTER.z + cz);
      tip.castShadow = true;
      site.add(tip);
    });

    // Pyramid Staging Pallet (4 slots right beside Track B's East stop)
    const stagePadGeo = this._trackGeo(new THREE.BoxGeometry(2.55, 0.14, 2.55));
    const stagePad = new THREE.Mesh(stagePadGeo, this.textures.materials.foundation);
    stagePad.position.set(4.15, 0.07, 4.85);
    stagePad.receiveShadow = true;
    site.add(stagePad);

    const stageOffsets = [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ];
    stageOffsets.forEach(([ox, oz], idx) => {
      const sx = 4.15 + ox;
      const sz = 4.85 + oz;
      const marker = this._createSlotMarker(site, sx, 0.155, sz);
      this.stagingSlots.push({
        id: `pyramid_staging_${idx}`,
        zoneType: 'staging',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(sx, 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    });

    // Build all 55 pyramid blueprint slots across 5 progressive layers (5x5 -> 4x4 -> 3x3 -> 2x2 -> 1x1)
    let slotIdx = 0;
    LAYER_SIZES.forEach((gridSize, layer) => {
      const isCapstone = layer === 4;
      const centerOffset = (gridSize - 1) * 0.5;
      const layerBaseY = FOUNDATION_Y + layer * BLOCK_H;
      const centerY = isCapstone ? layerBaseY + 0.41 : layerBaseY + BLOCK_H * 0.5;

      for (let gx = 0; gx < gridSize; gx++) {
        for (let gz = 0; gz < gridSize; gz++) {
          const wx = PYRAMID_CENTER.x + (gx - centerOffset) * PYRAMID_STEP;
          const wz = PYRAMID_CENTER.z + (gz - centerOffset) * PYRAMID_STEP;

          // Translucent glowing blueprint ghost slot
          const ghostGroup = new THREE.Group();
          ghostGroup.position.set(wx, centerY, wz);

          const ghostMesh = new THREE.Mesh(
            isCapstone ? this.geos.ghostCapstone : this.geos.ghostBox,
            this.mats.ghostNormal
          );
          const ghostLines = new THREE.LineSegments(
            isCapstone ? this.geos.ghostCapstoneEdges : this.geos.ghostBoxEdges,
            this.mats.ghostLineNormal
          );
          ghostGroup.add(ghostMesh);
          ghostGroup.add(ghostLines);
          ghostGroup.visible = layer === 0;
          site.add(ghostGroup);

          this.pyramidSlots.push({
            id: `pyramid_L${layer}_${gx}_${gz}`,
            index: slotIdx++,
            zoneType: 'pyramid',
            layer,
            isCapstone,
            accepts: ['carved', 'capstone'],
            position: new THREE.Vector3(wx, centerY, wz),
            dropIndicatorY: layerBaseY + 0.01,
            ghostGroup,
            ghostMesh,
            ghostLines,
            block: null,
          });
        }
      }
    });
  }

  _createSlotMarker(parent, x, y, z) {
    const marker = new THREE.Mesh(this.geos.slotOutline, this.mats.slotIdle);
    marker.position.set(x, y, z);
    parent.add(marker);
    this.slotMarkers.push(marker);
    return marker;
  }

  /* ============================================================================
   * 6. POOLED PARTICLE SYSTEM (ZERO GC OVERHEAD, 60 FPS MOBILE)
   * ========================================================================== */
  _buildParticlePool() {
    const poolSize = 130;
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(this.geos.particleCube, this.mats.dustLimestone);
      mesh.visible = false;
      this.root.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        age: 0,
        life: 0,
        gravity: 9.8,
        scale0: 1,
        spin: new THREE.Vector3(),
        active: false,
      });
    }
  }

  _spawnParticles(origin, {
    count = 8,
    material = this.mats.dustLimestone,
    speed = 2.6,
    upSpeed = 3.2,
    gravity = 9.5,
    life = 0.55,
    scale = 1.0,
    spread = 0.25,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;

      const angle = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.8) * speed;

      p.active = true;
      p.age = 0;
      p.life = life * (0.75 + Math.random() * 0.45);
      p.gravity = gravity;
      p.scale0 = scale * (0.65 + Math.random() * 0.65);

      p.mesh.material = material;
      p.mesh.visible = true;
      p.mesh.position.set(
        origin.x + (Math.random() - 0.5) * spread,
        origin.y + Math.random() * spread * 0.6,
        origin.z + (Math.random() - 0.5) * spread
      );
      p.mesh.scale.setScalar(p.scale0);
      p.vel.set(Math.cos(angle) * spd, upSpeed * (0.6 + Math.random() * 0.65), Math.sin(angle) * spd);
      p.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    }
  }

  /* ============================================================================
   * 7. BLOCK CREATION & QUARRY EXTRACTION
   * ========================================================================== */
  _findFreeQuarrySpawnSlot() {
    for (let i = 0; i < this.quarrySlots.length; i++) {
      if (!this.quarrySlots[i].block) return this.quarrySlots[i];
    }
    // Convenience overflow: if Sled A is parked at the Quarry and has an open cargo slot
    const sledA = this.sleds[0];
    if (sledA && sledA.progress < 0.08 && !sledA.isAutoGliding) {
      for (let i = 0; i < sledA.slots.length; i++) {
        if (!sledA.slots[i].block) return sledA.slots[i];
      }
    }
    return null;
  }

  chipQuarryNode(node) {
    if (!node || node.depleted || this.isComplete) return;

    const freeSlot = this._findFreeQuarrySpawnSlot();
    if (!freeSlot) {
      // Pad is full: gentle tactile rock knock + dust nudge
      node.shakeTime = 0.2;
      this.audio.playHeavyThud();
      this._spawnParticles(node.basePos, {
        count: 5,
        material: this.mats.dustLimestone,
        speed: 1.4,
        upSpeed: 2.0,
        scale: 0.7,
      });
      return;
    }

    node.hits += 1;
    node.shakeTime = 0.22;
    this.audio.playQuarryChip(node.hits - 1);

    // Dust & limestone chip burst
    this._spawnParticles(
      new THREE.Vector3(node.basePos.x, node.basePos.y + 0.35, node.basePos.z),
      {
        count: 10,
        material: this.mats.dustLimestone,
        speed: 2.8,
        upSpeed: 3.6,
        scale: 0.9,
      }
    );

    if (node.hits >= node.maxHits) {
      node.hits = 0;
      node.depleted = true;
      node.regenTimer = 0.85;
      node.mesh.visible = false;

      // Spawn Raw Stone Block and arc-bounce it onto the Quarry Staging Pad
      this._spawnRawBlock(node.basePos, freeSlot);
    } else {
      // Visual fracture shrink on first chip
      node.mesh.scale.set(0.95, 0.72, 0.9);
    }
  }

  _spawnRawBlock(fromPos, targetSlot) {
    const mesh = new THREE.Mesh(this.geos.rawBlock, this.textures.materials.rawBlock);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(fromPos);
    mesh.position.y += 0.3;
    this.root.add(mesh);

    const block = {
      id: this.blockIdCounter++,
      kind: 'raw', // 'raw' | 'carved' | 'capstone'
      carveStage: 0, // 0, 1, 2 -> 3 (carved/capstone)
      mesh,
      slot: targetSlot,
      originSlot: null,
      isDragging: false,
      isTweening: true,
      locked: false,
    };

    mesh.userData.interact = { type: 'block', block };
    targetSlot.block = block;
    this.blocks.push(block);
    this._rebuildHitTargets();

    this.audio.playStoneSpawn();
    this._addTween({
      block,
      from: mesh.position.clone(),
      to: targetSlot.position.clone(),
      duration: 0.34,
      arcHeight: 1.25,
      onDone: () => {
        block.isTweening = false;
        this._spawnParticles(targetSlot.position, {
          count: 7,
          material: this.mats.dustSand,
          speed: 1.5,
          upSpeed: 1.4,
          scale: 0.75,
        });
      },
    });
  }

  /* ============================================================================
   * 8. STONECUTTER CARVING (3 VISUAL STAGES: TAP OR SWIPE)
   * ========================================================================== */
  _shouldForgeCapstone() {
    if (this.placedCount < 54) return false;
    // Only forge one capstone at a time
    return !this.blocks.some((b) => b.kind === 'capstone');
  }

  carveWorkbenchBlock(swipeVec) {
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (!block || block.kind !== 'raw' || block.isDragging || block.isTweening) {
      return false;
    }

    block.carveStage += 1;
    const stage = block.carveStage;
    this.audio.playChiselPing(stage);

    // Directional stone chips & chisel sparks
    const burstOrigin = block.mesh.position.clone().add(new THREE.Vector3(0, 0.25, 0));
    this._spawnParticles(burstOrigin, {
      count: stage === 3 ? 16 : 11,
      material: stage === 3 ? this.mats.dustGold : this.mats.dustLimestone,
      speed: stage === 3 ? 3.2 : 2.5,
      upSpeed: stage === 3 ? 4.2 : 3.2,
      scale: stage === 3 ? 0.95 : 0.85,
    });
    this._spawnParticles(burstOrigin, {
      count: 6,
      material: this.mats.sparkCopper,
      speed: 3.8,
      upSpeed: 3.4,
      gravity: 6.5,
      life: 0.32,
      scale: 0.55,
    });

    // Visual geometry & material evolution across the 3 stages
    if (stage === 1) {
      block.mesh.geometry = this.geos.stage1Block;
      block.mesh.material = this.textures.materials.carvingStage1;
      this._triggerSquashBounce(block.mesh, 1.16, 0.82);
    } else if (stage === 2) {
      block.mesh.geometry = this.geos.stage2Block;
      block.mesh.material = this.textures.materials.carvingStage2;
      this._triggerSquashBounce(block.mesh, 1.14, 0.85);
    } else if (stage >= 3) {
      const makeCapstone = this._shouldForgeCapstone();
      if (makeCapstone) {
        this._convertBlockToCapstone(block);
      } else {
        block.kind = 'carved';
        block.mesh.geometry = this.geos.carvedBlock;
        block.mesh.material = this.textures.materials.carvedBlock;
      }
      block.mesh.rotation.set(0, 0, 0);
      block.mesh.userData.interact = { type: 'block', block };
      this._triggerSquashBounce(block.mesh, 1.2, 0.84);
      this._rebuildHitTargets();
    }

    // Subtle directional nudge if swiped
    if (swipeVec) {
      block.mesh.rotation.y += THREE.MathUtils.clamp(swipeVec.dx * 0.008, -0.25, 0.25);
    }

    this._updateCarvingPips();
    return block.kind === 'raw';
  }

  _convertBlockToCapstone(block) {
    block.kind = 'capstone';
    block.mesh.geometry = this.geos.capstone;
    block.mesh.material = this.textures.materials.capstoneGold;
    block.mesh.rotation.set(0, 0, 0);
  }

  _triggerSquashBounce(mesh, sxz = 1.15, sy = 0.84) {
    mesh.scale.set(sxz, sy, sxz);
  }

  /* ============================================================================
   * 9. SLED DRAG & PULL-LEVER TRANSPORT
   * ========================================================================== */
  onSledLeverTap(sled) {
    if (!sled || this.isComplete) return;
    this.audio.playLeverFlip();
    const goEnd = sled.progress < 0.5;
    sled.targetProgress = goEnd ? 1 : 0;
    sled.isAutoGliding = true;
    sled.targetLeverAngle = goEnd ? 0.45 : -0.45;
    this.audio.playSledCreak(0.68);
  }

  onSledTap(sled) {
    // Tapping a sled directly also flips its lever and dispatches it
    this.onSledLeverTap(sled);
  }

  onSledDragStart(sled) {
    if (!sled || this.isComplete) return;
    sled.isDragging = true;
    sled.isAutoGliding = false;
    sled.dragOffset = null;
  }

  onSledDragMove(sled, worldPoint) {
    if (!sled || !sled.isDragging) return;
    const coord = sled.axis === 'z' ? worldPoint.z : worldPoint.x;
    const currentCoord = THREE.MathUtils.lerp(sled.startPos, sled.endPos, sled.progress);
    if (sled.dragOffset === null) {
      sled.dragOffset = currentCoord - coord;
    }
    const desiredCoord = coord + sled.dragOffset;
    const nextProgress = THREE.MathUtils.clamp(
      (desiredCoord - sled.startPos) / (sled.endPos - sled.startPos),
      0,
      1
    );
    const moved = Math.abs(nextProgress - sled.progress);
    if (moved > 0.004) {
      sled.progress = nextProgress;
      sled.targetProgress = nextProgress;
      sled.targetLeverAngle = THREE.MathUtils.lerp(-0.45, 0.45, sled.progress);
      this._updateSledTransform(sled);

      if (moved > 0.015) {
        this.audio.playSledCreak(0.4);
        this._emitSledSandTrail(sled);
      }
    }
  }

  onSledDragEnd(sled) {
    if (!sled) return;
    sled.isDragging = false;
    sled.dragOffset = null;
    // Snap cleanly to the closer station (with generous 35% commit threshold)
    sled.targetProgress = sled.progress >= 0.5 ? 1 : 0;
    sled.isAutoGliding = true;
    sled.targetLeverAngle = sled.targetProgress > 0.5 ? 0.45 : -0.45;
  }

  _emitSledSandTrail(sled) {
    const pos = sled.group.position;
    this._spawnParticles(new THREE.Vector3(pos.x, 0.14, pos.z), {
      count: 3,
      material: this.mats.dustSand,
      speed: 0.9,
      upSpeed: 1.0,
      gravity: 5.5,
      life: 0.42,
      scale: 0.65,
      spread: 1.3,
    });
  }

  /* ============================================================================
   * 10. DRAG & DROP VALIDATION + MAGNETIC SNAPPING
   * ========================================================================== */
  onBlockDragStart(block) {
    if (!block || block.locked || block.isTweening || this.isComplete) return null;
    // If an uncarved raw block sits on the workbench, it should be carved instead of dragged
    if (block.slot === this.workbenchSlot && block.kind === 'raw') {
      return null;
    }

    block.isDragging = true;
    block.originSlot = block.slot;
    if (block.slot) {
      block.slot.block = null;
      block.slot = null;
    }
    block.mesh.rotation.set(0, 0, 0);
    this._updateCarvingPips();
    this.audio.playPickup();

    // Hover cleanly above the active pyramid tier height
    const activeTierHeight = FOUNDATION_Y + (this.activeLayer + 1) * BLOCK_H;
    const hoverY = block.kind === 'raw' ? 1.55 : Math.max(1.75, activeTierHeight + 0.72);
    return { hoverY };
  }

  _getValidSlotsForBlock(block) {
    const valid = [];

    if (block.kind === 'raw') {
      // Sled A (always valid when empty), Workbench Anvil, and Quarry pad
      this.sleds.forEach((s) => {
        if (s.id === 'sledA') {
          s.slots.forEach((slot) => {
            if (!slot.block) valid.push(slot);
          });
        }
      });
      if (this.workbenchSlot && !this.workbenchSlot.block) {
        valid.push(this.workbenchSlot);
      }
      this.quarrySlots.forEach((slot) => {
        if (!slot.block) valid.push(slot);
      });
      return valid;
    }

    // Carved Pyramid Block or Golden Capstone
    this.sleds.forEach((s) => {
      if (s.id === 'sledB') {
        s.slots.forEach((slot) => {
          if (!slot.block) valid.push(slot);
        });
      }
    });
    this.outputSlots.forEach((slot) => {
      if (!slot.block) valid.push(slot);
    });
    this.stagingSlots.forEach((slot) => {
      if (!slot.block) valid.push(slot);
    });

    // Active unlocked pyramid layer blueprint slots
    this.pyramidSlots.forEach((slot) => {
      if (slot.layer === this.activeLayer && !slot.block) {
        valid.push(slot);
      }
    });

    return valid;
  }

  evaluateDropZones(block, dragPos) {
    this.clearDropHighlights();

    const validSlots = this._getValidSlotsForBlock(block);
    let bestSlot = null;
    let bestDistSq = Infinity;

    for (let i = 0; i < validSlots.length; i++) {
      const slot = validSlots[i];
      if (slot.zoneType === 'pyramid') {
        slot.ghostMesh.material = this.mats.ghostNormal;
        slot.ghostLines.material = this.mats.ghostLineNormal;
      } else if (slot.marker) {
        slot.marker.material = this.mats.slotValid;
      }

      const dx = dragPos.x - slot.position.x;
      const dz = dragPos.z - slot.position.z;
      const dSq = dx * dx + dz * dz;
      const snapRad = slot.zoneType === 'pyramid' ? 1.25 : 1.48;
      if (dSq < snapRad * snapRad && dSq < bestDistSq) {
        bestDistSq = dSq;
        bestSlot = slot;
      }
    }

    if (bestSlot) {
      if (bestSlot.zoneType === 'pyramid') {
        bestSlot.ghostMesh.material = this.mats.ghostHighlight;
        bestSlot.ghostLines.material = this.mats.ghostLineHighlight;
        bestSlot.ghostGroup.scale.setScalar(1.05);
      } else if (bestSlot.marker) {
        bestSlot.marker.material = this.mats.slotSnap;
        bestSlot.marker.scale.setScalar(1.16);
      }
    }

    // Compute ground elevation underneath the dragged block for the drop-shadow indicator
    let groundY = 0.02;
    if (bestSlot) {
      groundY = bestSlot.dropIndicatorY;
    } else if (
      Math.abs(dragPos.x - PYRAMID_CENTER.x) < 3.1 &&
      Math.abs(dragPos.z - PYRAMID_CENTER.z) < 3.1
    ) {
      groundY = FOUNDATION_Y + this.activeLayer * BLOCK_H;
    }

    return { snapZone: bestSlot, groundY };
  }

  clearDropHighlights() {
    this.slotMarkers.forEach((m) => {
      m.material = this.mats.slotIdle;
      m.scale.setScalar(1);
    });
    this.pyramidSlots.forEach((s) => {
      if (!s.block && s.layer === this.activeLayer) {
        s.ghostMesh.material = this.mats.ghostNormal;
        s.ghostLines.material = this.mats.ghostLineNormal;
        s.ghostGroup.scale.setScalar(1);
      }
    });
  }

  onBlockDrop(block, targetSlot) {
    block.isDragging = false;
    block.originSlot = null;
    block.slot = targetSlot;
    targetSlot.block = block;
    block.isTweening = true;

    const isPyramidSnap = targetSlot.zoneType === 'pyramid';

    // Seamless golden capstone transformation if placing onto Layer 5 apex slot
    if (isPyramidSnap && targetSlot.isCapstone && block.kind !== 'capstone') {
      this._convertBlockToCapstone(block);
    }

    if (isPyramidSnap) {
      block.locked = true;
      delete block.mesh.userData.interact;
      targetSlot.ghostGroup.visible = false;
      this._rebuildHitTargets();
    } else if (targetSlot === this.workbenchSlot && block.kind === 'raw') {
      block.mesh.userData.interact = { type: 'workbench-carve', block };
    } else {
      block.mesh.userData.interact = { type: 'block', block };
    }

    this._addTween({
      block,
      from: block.mesh.position.clone(),
      to: targetSlot.position.clone(),
      duration: isPyramidSnap ? 0.17 : 0.18,
      arcHeight: isPyramidSnap ? 0.28 : 0.22,
      onDone: () => {
        block.isTweening = false;
        block.mesh.rotation.set(0, 0, 0);
        this._triggerSquashBounce(block.mesh, 1.12, 0.88);

        if (isPyramidSnap) {
          this._onPyramidBlockPlaced(targetSlot);
        } else {
          this.audio.playHeavyThud();
          this._spawnParticles(targetSlot.position, {
            count: 6,
            material: this.mats.dustSand,
            speed: 1.5,
            upSpeed: 1.3,
            scale: 0.72,
          });
          this._updateCarvingPips();
        }
      },
    });
  }

  onBlockDragCancel(block) {
    block.isDragging = false;
    const home = block.originSlot;
    block.originSlot = null;
    if (!home) return;

    block.slot = home;
    home.block = block;
    block.isTweening = true;

    this._addTween({
      block,
      from: block.mesh.position.clone(),
      to: home.position.clone(),
      duration: 0.22,
      arcHeight: 0.45,
      onDone: () => {
        block.isTweening = false;
        block.mesh.rotation.set(0, 0, 0);
        this.audio.playHeavyThud();
        this._updateCarvingPips();
      },
    });
  }

  /* ============================================================================
   * 11. PYRAMID PROGRESSION & GOLDEN SUNBEAM COMPLETION SEQUENCE
   * ========================================================================== */
  _onPyramidBlockPlaced(slot) {
    this.placedCount += 1;
    this.audio.playBlueprintSnap(slot.layer);

    this._spawnParticles(slot.position, {
      count: slot.isCapstone ? 28 : 12,
      material: this.mats.dustGold,
      speed: slot.isCapstone ? 3.8 : 2.3,
      upSpeed: slot.isCapstone ? 4.8 : 2.4,
      gravity: slot.isCapstone ? 3.2 : 6.5,
      life: slot.isCapstone ? 1.1 : 0.55,
      scale: slot.isCapstone ? 1.15 : 0.8,
    });

    if (this.onProgress) {
      this.onProgress(this.placedCount, Level1Pyramid.meta.totalGoal);
    }

    // Check if the current layer is fully completed
    const currentLayerSlots = this.pyramidSlots.filter((s) => s.layer === this.activeLayer);
    const layerDone = currentLayerSlots.every((s) => Boolean(s.block));

    if (layerDone) {
      if (this.activeLayer < LAYER_SIZES.length - 1) {
        const finishedTier = this.activeLayer;
        this.activeLayer += 1;
        this.audio.playLayerComplete(finishedTier);

        // Reveal next tier's translucent blueprint ghost slots smoothly
        this.pyramidSlots.forEach((s) => {
          if (s.layer === this.activeLayer && !s.block) {
            s.ghostGroup.visible = true;
            s.ghostGroup.scale.setScalar(0.15);
          }
        });
      } else {
        // All 55 blocks placed! Trigger Golden Sunbeam Celebration!
        this._triggerCompletionSequence();
      }
    }
  }

  _triggerCompletionSequence() {
    this.isComplete = true;
    this.clearDropHighlights();
    this._updateCarvingPips();
    this.audio.playVictoryFanfare();

    // Build Golden Sunbeam light shaft descending onto the 55th capstone
    const apexY = FOUNDATION_Y + 4 * BLOCK_H + 0.82;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(PYRAMID_CENTER.x, apexY, PYRAMID_CENTER.z);

    const innerBeamGeo = this._trackGeo(new THREE.CylinderGeometry(0.45, 2.35, 11.5, 20, 1, true));
    const innerBeamMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffdf78,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerBeamGeo, innerBeamMat);
    this.victoryBeamInner.position.y = 4.6;
    this.victoryGroup.add(this.victoryBeamInner);

    const outerBeamGeo = this._trackGeo(new THREE.CylinderGeometry(0.95, 3.8, 12.2, 22, 1, true));
    const outerBeamMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffc040,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerBeamGeo, outerBeamMat);
    this.victoryBeamOuter.position.y = 4.9;
    this.victoryGroup.add(this.victoryBeamOuter);

    // Radiant golden halo ring floating gently around the pyramidion
    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.76, 0.94, 32));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe484,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.18;
    this.victoryGroup.add(this.victoryHalo);

    this.root.add(this.victoryGroup);

    if (this.onComplete) {
      this.onComplete({
        focusPoint: new THREE.Vector3(PYRAMID_CENTER.x, FOUNDATION_Y + 1.85, PYRAMID_CENTER.z),
      });
    }
  }

  /* ============================================================================
   * 12. TWEENS, HIT TARGETS & PER-FRAME UPDATE
   * ========================================================================== */
  _addTween({ block, from, to, duration, arcHeight = 0.3, onDone }) {
    this.tweens.push({
      block,
      from,
      to,
      duration,
      arcHeight,
      elapsed: 0,
      onDone,
    });
  }

  _rebuildHitTargets() {
    this.hitTargets.length = 0;
    this.blocks.forEach((b) => {
      if (!b.locked) this.hitTargets.push(b.mesh);
    });
    if (this.workbenchCarveHitbox) {
      this.hitTargets.push(this.workbenchCarveHitbox);
    }
    this.sleds.forEach((s) => {
      this.hitTargets.push(s.leverPivot);
      this.hitTargets.push(s.deck);
    });
    this.quarryNodes.forEach((n) => {
      this.hitTargets.push(n.group);
    });
  }

  getHitTargets() {
    return this.hitTargets;
  }

  update(dt, elapsed) {
    // 1. Update block arc-snap tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += dt;
      const t = Math.min(tw.elapsed / tw.duration, 1);
      // Cubic ease-out for crisp magnetic snap
      const ease = 1 - Math.pow(1 - t, 3);

      // Keep destination fresh if landing on a sled
      const dest = tw.block.slot ? tw.block.slot.position : tw.to;
      tw.block.mesh.position.lerpVectors(tw.from, dest, ease);
      tw.block.mesh.position.y += Math.sin(t * Math.PI) * tw.arcHeight;

      if (t >= 1) {
        tw.block.mesh.position.copy(dest);
        this.tweens.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }

    // 2. Spring-recover squash-and-stretch on blocks
    const scaleRecover = 1 - Math.exp(-14 * dt);
    for (let i = 0; i < this.blocks.length; i++) {
      const m = this.blocks[i].mesh;
      if (Math.abs(m.scale.x - 1) > 0.002 || Math.abs(m.scale.y - 1) > 0.002) {
        m.scale.x = THREE.MathUtils.lerp(m.scale.x, 1, scaleRecover);
        m.scale.y = THREE.MathUtils.lerp(m.scale.y, 1, scaleRecover);
        m.scale.z = THREE.MathUtils.lerp(m.scale.z, 1, scaleRecover);
      }
    }

    // 3. Quarry node shake & smooth pop-in regeneration
    for (let i = 0; i < this.quarryNodes.length; i++) {
      const n = this.quarryNodes[i];
      if (n.depleted) {
        n.regenTimer -= dt;
        if (n.regenTimer <= 0) {
          n.depleted = false;
          n.mesh.visible = true;
          n.mesh.scale.setScalar(0.05);
        }
      } else {
        const targetSX = n.hits > 0 ? 0.95 : 1.12;
        const targetSY = n.hits > 0 ? 0.72 : 0.86;
        const targetSZ = n.hits > 0 ? 0.9 : 1.04;
        n.mesh.scale.x = THREE.MathUtils.lerp(n.mesh.scale.x, targetSX, 1 - Math.exp(-10 * dt));
        n.mesh.scale.y = THREE.MathUtils.lerp(n.mesh.scale.y, targetSY, 1 - Math.exp(-10 * dt));
        n.mesh.scale.z = THREE.MathUtils.lerp(n.mesh.scale.z, targetSZ, 1 - Math.exp(-10 * dt));
      }

      if (n.shakeTime > 0) {
        n.shakeTime = Math.max(0, n.shakeTime - dt);
        const amp = n.shakeTime * 0.42;
        n.group.position.x = n.basePos.x + Math.sin(elapsed * 65 + i) * amp;
        n.group.position.z = n.basePos.z + Math.cos(elapsed * 58 + i) * amp;
      } else {
        n.group.position.copy(n.basePos);
      }
    }

    // 4. Wooden Sleds auto-glide, lever pivot, & sand trail dust
    for (let i = 0; i < this.sleds.length; i++) {
      const s = this.sleds[i];
      s.leverAngle = THREE.MathUtils.lerp(s.leverAngle, s.targetLeverAngle, 1 - Math.exp(-14 * dt));
      if (s.axis === 'z') {
        s.leverPivot.rotation.x = s.leverAngle;
      } else {
        s.leverPivot.rotation.z = -s.leverAngle;
      }

      if (s.isAutoGliding && !s.isDragging) {
        const diff = s.targetProgress - s.progress;
        if (Math.abs(diff) < 0.004) {
          s.progress = s.targetProgress;
          s.isAutoGliding = false;
          this._updateSledTransform(s);
          this.audio.playHeavyThud();
        } else {
          const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.15);
          // Smooth speed boost in middle, gentle ease into bumpers
          const speedCurve = 0.55 + Math.sin(s.progress * Math.PI) * 0.75;
          s.progress = THREE.MathUtils.clamp(s.progress + step * speedCurve, 0, 1);
          this._updateSledTransform(s);

          s.sandTrailAccum += dt;
          if (s.sandTrailAccum >= 0.085) {
            s.sandTrailAccum = 0;
            this._emitSledSandTrail(s);
          }
        }
      }
    }

    // 5. Breathing pulse on active blueprint ghost slots
    const pulse = 0.38 + Math.sin(elapsed * 3.4) * 0.1;
    this.mats.ghostNormal.opacity = pulse;
    for (let i = 0; i < this.pyramidSlots.length; i++) {
      const s = this.pyramidSlots[i];
      if (s.ghostGroup.visible && s.ghostGroup.scale.x < 0.995) {
        const nextS = THREE.MathUtils.lerp(s.ghostGroup.scale.x, 1, 1 - Math.exp(-8 * dt));
        s.ghostGroup.scale.setScalar(nextS);
      }
    }

    // 6. Subtle breeze on palm fronds, workshop sunshade, & carving pips
    for (let i = 0; i < this.palmFronds.length; i++) {
      const p = this.palmFronds[i];
      p.group.rotation.z = Math.sin(elapsed * 1.45 + p.phase) * 0.045;
      p.group.rotation.x = Math.cos(elapsed * 1.1 + p.phase) * 0.03;
    }
    if (this.canopyMesh) {
      this.canopyMesh.rotation.z = Math.sin(elapsed * 1.8) * 0.015;
    }
    for (let i = 0; i < this.carvingPips.length; i++) {
      const pip = this.carvingPips[i];
      if (pip.mesh.visible) {
        pip.mesh.rotation.y = elapsed * 2.2 + i * 0.8;
      }
    }

    // 7. Victory Golden Sunbeam animation & rising golden motes
    if (this.isComplete && this.victoryGroup) {
      this.victoryBeamInner.rotation.y += dt * 0.35;
      this.victoryBeamOuter.rotation.y -= dt * 0.22;
      const shimmer = 0.38 + Math.sin(elapsed * 2.6) * 0.08;
      this.victoryBeamInner.material.opacity = shimmer;
      if (this.victoryHalo) {
        this.victoryHalo.scale.setScalar(1 + Math.sin(elapsed * 2.8) * 0.07);
      }

      this.victoryMoteAccum += dt;
      if (this.victoryMoteAccum >= 0.09) {
        this.victoryMoteAccum = 0;
        const angle = Math.random() * Math.PI * 2;
        const rad = 0.8 + Math.random() * 2.1;
        this._spawnParticles(
          new THREE.Vector3(
            PYRAMID_CENTER.x + Math.cos(angle) * rad,
            FOUNDATION_Y + 0.5 + Math.random() * 2.2,
            PYRAMID_CENTER.z + Math.sin(angle) * rad
          ),
          {
            count: 1,
            material: this.mats.dustGold,
            speed: 0.4,
            upSpeed: 1.5,
            gravity: -0.4, // Gently float upward!
            life: 1.6,
            scale: 0.72,
            spread: 0.15,
          }
        );
      }
    }

    // 8. Pooled particles step
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      const remain = 1 - p.age / p.life;
      p.mesh.scale.setScalar(p.scale0 * remain);
    }
  }

  /**
   * Cleanly disposes all level-owned GPU geometries, materials, and scene graph nodes.
   */
  dispose() {
    this.tweens.length = 0;
    this.blocks.length = 0;
    this.quarryNodes.length = 0;
    this.quarrySlots.length = 0;
    this.sleds.length = 0;
    this.outputSlots.length = 0;
    this.stagingSlots.length = 0;
    this.pyramidSlots.length = 0;
    this.hitTargets.length = 0;
    this.slotMarkers.length = 0;
    this.particles.length = 0;
    this.palmFronds.length = 0;
    this.carvingPips.length = 0;

    this.scene.remove(this.root);

    this.ownedGeometries.forEach((g) => g.dispose());
    this.ownedMaterials.forEach((m) => m.dispose());
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }
}
