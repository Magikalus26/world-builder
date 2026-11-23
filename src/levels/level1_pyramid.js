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

// Sculpted 128x128 diorama terrain dimensions & Nile water level
const TERRAIN_W = 20.4;
const TERRAIN_D = 19.2;
const TERRAIN_SEG = 128;
const WATER_LEVEL = -0.14;
const PLINTH_BOTTOM = -1.65;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Signed distance to an axis-aligned rectangle (negative inside) */
function sdBox2D(x, z, cx, cz, hx, hz) {
  const dx = Math.abs(x - cx) - hx;
  const dz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}

/** Distance from point (x, z) to a 2D line segment (ax, az)-(bx, bz) */
function distToSegment(x, z, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = x - ax;
  const wz = z - az;
  const lenSq = vx * vx + vz * vz || 1;
  const t = clamp01((wx * vx + wz * vz) / lenSq);
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

/** Fast smooth deterministic pseudo-noise for organic desert dunes & biome feathering */
function organicWave(x, z) {
  return (
    Math.sin(x * 0.42 + z * 0.27) * 0.45 +
    Math.cos(x * 0.24 - z * 0.51 + 1.1) * 0.32 +
    Math.sin(x * 0.85 - z * 0.62 + 0.5) * 0.15 +
    Math.cos(x * 1.35 + z * 1.15) * 0.08
  );
}

/** Distance to the curving North-East Nile water cove / oasis basin */
function distToNileBasin(x, z) {
  const d1 = distToSegment(x, z, 6.2, -6.1, 8.9, -5.5);
  const d2 = distToSegment(x, z, 6.8, -6.4, 8.2, -8.9);
  const organic = organicWave(x * 1.4, z * 1.4) * 0.34;
  return Math.min(d1, d2) + organic;
}

/**
 * Computes flat-pad mask in [0, 1] (1.0 on compacted playable work zones so all
 * tracks, sleds, workbench, staging pads, and pyramid foundation sit flush at y = 0).
 */
function sampleFlatPadMask(x, z) {
  const pads = [
    // Pyramid construction foundation
    sdBox2D(x, z, PYRAMID_CENTER.x, PYRAMID_CENTER.z, 3.45, 3.45),
    // Pyramid staging pallet
    sdBox2D(x, z, 4.15, 4.85, 1.6, 1.55),
    // Stonecutter workshop & output pallet
    sdBox2D(x, z, -4.6, 5.1, 2.3, 2.25),
    // Track A + Quarry staging pad corridor
    sdBox2D(x, z, -4.6, -0.5, 2.25, 3.05),
    // Track B corridor
    sdBox2D(x, z, 0.25, 4.85, 2.85, 1.75),
    // Central stepping-stone promenade
    sdBox2D(x, z, -0.8, 0.3, 1.9, 2.5),
  ];

  let minD = Infinity;
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] < minD) minD = pads[i];
  }
  return 1.0 - smoothstep(0.0, 1.85, minD);
}

/**
 * Deterministic analytical elevation function shared by the 128x128 terrain mesh,
 * contoured plinth skirt, environment props, and drag-and-drop height sampling.
 */
function sampleTerrainHeight(x, z) {
  const flatMask = sampleFlatPadMask(x, z);

  // 1. Continuous wind-swept perimeter desert dunes
  const edgeX = smoothstep(5.6, 9.8, Math.abs(x));
  const edgeZ = smoothstep(5.2, 9.3, Math.abs(z));
  const perimeterFactor = clamp01(Math.max(edgeX, edgeZ) * 0.92 + smoothstep(6.2, 10.6, Math.hypot(x * 0.92, z)) * 0.38);

  const duneCrest = Math.sin(x * 0.38 + z * 0.32 + Math.cos(z * 0.25) * 0.7) * 0.5 + 0.5;
  const duneUndulation = organicWave(x, z) * 0.32 + 0.55;
  let height = (0.35 + duneCrest * 0.92 + duneUndulation * 0.36) * perimeterFactor * (1.0 - flatMask);

  // Extra sculptural leeward sand ridge along North-Central & South edges
  const northDune = (1.0 - smoothstep(1.2, 3.9, Math.hypot((x - 0.6) * 0.65, z + 8.1))) * 0.72;
  const southDune = (1.0 - smoothstep(1.0, 3.4, Math.hypot((x - 0.3) * 0.68, z - 8.4))) * 0.52;
  height += (northDune + southDune) * (1.0 - flatMask);

  // 2. Excavated rocky Quarry pit around the NW extraction cliff base
  const quarryPitDist = sdBox2D(x, z, -4.6, -4.65, 2.35, 0.55);
  const quarryPitMask = 1.0 - smoothstep(0.0, 0.95, quarryPitDist);
  height = height * (1.0 - quarryPitMask * 0.85) - quarryPitMask * 0.24;

  // Rocky limestone shoulder rising naturally behind the NW Quarry cliff
  const nwBankDist = sdBox2D(x, z, -6.4, -7.8, 3.0, 1.0);
  const nwBankMask = 1.0 - smoothstep(0.0, 1.5, nwBankDist);
  height += nwBankMask * (0.65 + Math.max(0, organicWave(x * 1.2, z * 1.2)) * 0.28) * (1.0 - flatMask) * (1.0 - quarryPitMask);

  // 3. Gently depressed Nile water basin in the North-East corner
  const dNile = distToNileBasin(x, z);
  const basinMask = 1.0 - smoothstep(1.25, 3.05, dNile);
  const deepBasin = 1.0 - smoothstep(0.15, 2.05, dNile);
  // Carve basin cleanly down below WATER_LEVEL while preserving nearby Pyramid pad
  const nileCut = (basinMask * 0.42 + deepBasin * 0.48) * (1.0 - flatMask * 0.92);
  height = height * (1.0 - basinMask * 0.88) - nileCut;

  return height;
}

/**
 * Computes normalized 4-biome splat weights [Sand, EarthPath, QuarryDust, OasisGrass]
 * for organic hand-painted terrain transitions.
 */
function sampleTerrainSplat(x, z, h) {
  const jitter = organicWave(x * 1.7, z * 1.7) * 0.42;

  // Biome 1: Compacted Dusty Earth & Gravel Path under tracks, sled routes, and stepping stones
  const dTrackA = distToSegment(x, z, -4.6, -2.5, -4.6, 2.6);
  const dTrackB = distToSegment(x, z, -2.5, 4.85, 3.5, 4.85);
  const dPromenade1 = distToSegment(x, z, -1.2, -1.7, -0.35, 1.9);
  const dPromenade2 = distToSegment(x, z, 3.6, 2.2, 4.0, 4.6);
  const dStagePad = sdBox2D(x, z, 4.15, 4.85, 1.45, 1.45);
  const dPathMin = Math.min(dTrackA - 1.15, dTrackB - 1.15, dPromenade1 - 0.68, dPromenade2 - 0.72, dStagePad);
  let wPath = 1.0 - smoothstep(-0.15, 0.95, dPathMin + jitter * 0.55);

  // Biome 2: Crushed Limestone & Cracked Quarry Dust around NW Quarry & SW Stonecutter Workshop
  const dQuarryZone = sdBox2D(x, z, -4.8, -5.0, 3.2, 2.25);
  const dWorkshopZone = sdBox2D(x, z, -4.6, 5.1, 2.15, 2.1);
  const wQuarry = Math.max(
    1.0 - smoothstep(-0.2, 1.35, dQuarryZone + jitter * 0.65),
    (1.0 - smoothstep(-0.15, 1.15, dWorkshopZone + jitter * 0.55)) * 0.88
  );

  // Biome 3: Lush Riverbank Silt & Oasis Grass around Nile water edge and palm trees
  const dNile = distToNileBasin(x, z);
  const wNileBank = 1.0 - smoothstep(1.6, 4.15, dNile + jitter * 0.65);
  const dSePalm = Math.hypot(x - 7.6, z - 5.8);
  const wSeOasis = (1.0 - smoothstep(0.7, 2.35, dSePalm + jitter * 0.45)) * 0.78;
  const wOasis = clamp01(Math.max(wNileBank, wSeOasis) * (h < 0.85 ? 1.0 : 0.4));

  // Keep oasis grass and quarry dust clean from overlapping tracks
  wPath *= 1.0 - wOasis * 0.85;

  // Biome 0: Wind-Rippled Golden Desert Sand fills all remaining weight
  const sumOther = wPath + wQuarry + wOasis;
  let wSand = Math.max(0, 1.0 - sumOther);

  const total = wSand + wPath + wQuarry + wOasis || 1;
  return [wSand / total, wPath / total, wQuarry / total, wOasis / total];
}

/** Shoreline wetness factor in [0, 1] where terrain dips toward/under the Nile water surface */
function sampleShoreWetness(x, z, h) {
  const dNile = distToNileBasin(x, z);
  if (dNile > 3.6) return 0;
  return (1.0 - smoothstep(WATER_LEVEL - 0.02, WATER_LEVEL + 0.25, h)) * (1.0 - smoothstep(2.4, 3.5, dNile));
}

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

  constructor({ scene, textures, audio, onProgress, onComplete, upgrades = {}, runConfig = null }) {
    this.scene = scene;
    this.textures = textures;
    this.audio = audio;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.upgrades = upgrades || {};
    this.runConfig = runConfig || null;

    // Layout mirroring & gameplay parameters (extensible for Roguelike runs & Shop upgrades)
    this.mirrorX = (this.runConfig && this.runConfig.mirrorX) || 1;
    this.pyramidCenter = new THREE.Vector3(PYRAMID_CENTER.x * this.mirrorX, 0, PYRAMID_CENTER.z);
    this.totalGoal = (this.runConfig && this.runConfig.totalGoal) || Level1Pyramid.meta.totalGoal;
    this.hudLabel = (this.runConfig && this.runConfig.hudLabel) || Level1Pyramid.meta.hudLabel;
    this.carveStep = (this.upgrades.golden_chisel ? 2 : 1) + (this.runConfig && this.runConfig.fastCarve ? 1 : 0);
    this.quarryMaxHits = (this.runConfig && this.runConfig.quarryMaxHits) || 2;
    this.sledCapacity = this.upgrades.reinforced_sled ? 4 : 3;
    this.sledSpeedMult =
      (this.upgrades.reinforced_sled ? 1.25 : 1.0) *
      (this.runConfig && this.runConfig.sledSpeedMult ? this.runConfig.sledSpeedMult : 1.0);
    this.pyramidSnapRadius = this.upgrades.pyramidion_aura ? 1.56 : 1.25;
    this.maxLayerIndex = 4;

    this.root = new THREE.Group();
    this.root.name = this.runConfig ? 'RoguelikeLevelRoot' : 'Level1PyramidRoot';
    this.scene.add(this.root);

    // Track locally allocated geometries/materials for guaranteed leak-free disposal
    this.ownedGeometries = [];
    this.ownedMaterials = [];

    // Apply biome terrain tint if running a Roguelike biome variant
    if (this.runConfig && this.runConfig.terrainTint) {
      this.textures.materials.terrainSplat.color.set(this.runConfig.terrainTint);
    } else {
      this.textures.materials.terrainSplat.color.setHex(0xffffff);
    }

    // Carved block material (upgraded with Royal Gold sheen or biome stone tint if active)
    if (this.upgrades.royal_gold_stone || (this.runConfig && this.runConfig.stoneTint)) {
      const m = this._trackMat(this.textures.materials.carvedBlock.clone());
      if (this.runConfig && this.runConfig.stoneTint) {
        m.color.set(this.runConfig.stoneTint);
      }
      if (this.upgrades.royal_gold_stone) {
        m.emissive = new THREE.Color('#6b4708');
        m.emissiveIntensity = 0.18;
        m.metalness = 0.28;
      }
      this.carvedBlockMat = m;
    } else {
      this.carvedBlockMat = this.textures.materials.carvedBlock;
    }

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
    this.auraRingMesh = null;
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

  _mx(x) {
    return x * this.mirrorX;
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
   * 1. SCULPTED & HAND-PAINTED 128x128 3D TERRAIN + ANIMATED NILE BASIN
   * ========================================================================== */
  getTerrainHeight(x, z) {
    return sampleTerrainHeight(x * this.mirrorX, z);
  }

  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // 1. High-density 128x128 subdivided sculpted terrain with 4-biome GPU splat painting
    const terrainGeo = this._trackGeo(
      new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEG, TERRAIN_SEG)
    );
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const vertCount = pos.count;
    const splatArr = new Float32Array(vertCount * 4);
    const wetArr = new Float32Array(vertCount);

    for (let i = 0; i < vertCount; i++) {
      const x = pos.getX(i);
      const sx = x * this.mirrorX;
      const z = pos.getZ(i);
      const y = sampleTerrainHeight(sx, z);
      pos.setY(i, y);

      const [wSand, wPath, wQuarry, wOasis] = sampleTerrainSplat(sx, z, y);
      splatArr[i * 4] = wSand;
      splatArr[i * 4 + 1] = wPath;
      splatArr[i * 4 + 2] = wQuarry;
      splatArr[i * 4 + 3] = wOasis;

      wetArr[i] = sampleShoreWetness(sx, z, y);
    }

    pos.needsUpdate = true;
    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splatArr, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetArr, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.textures.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    env.add(terrainMesh);

    // 2. Contoured geological plinth skirt hugging the exact sculpted terrain edges
    const skirtGeo = this._buildContouredPlinthSkirt();
    const skirtMesh = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirtMesh.receiveShadow = true;
    env.add(skirtMesh);

    // Bottom cap under the diorama island
    const bottomCapGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D));
    bottomCapGeo.rotateX(Math.PI / 2);
    const bottomCap = new THREE.Mesh(bottomCapGeo, this.textures.materials.plinth);
    bottomCap.position.y = PLINTH_BOTTOM;
    env.add(bottomCap);

    // 3. Animated translucent turquoise Nile water & sandy shoreline foam
    this._buildNileWater(env);

    // 4. Stylized date palms & coastal reed tufts planted on exact sculpted terrain height
    this._createPalmTree(env, this._mx(4.75), -6.9, 1.08, 0.16 * this.mirrorX);
    this._createPalmTree(env, this._mx(8.2), -7.25, 0.92, -0.18 * this.mirrorX);
    this._createPalmTree(env, this._mx(5.75), -8.35, 0.84, 0.1 * this.mirrorX);
    this._createPalmTree(env, this._mx(7.6), 5.8, 0.96, -0.14 * this.mirrorX);
    this._createPalmTree(env, this._mx(-7.8), 6.25, 0.85, 0.18 * this.mirrorX);
    this._buildOasisReeds(env);

    // 5. Subtle sandstone stepping stones along central avenues at exact terrain height
    const stepGeo = this._trackGeo(new THREE.BoxGeometry(0.76, 0.07, 0.56));
    const stepCoords = [
      [-1.1, -1.6],
      [-0.4, -0.7],
      [-0.9, 0.5],
      [-0.4, 1.8],
      [3.6, 3.05],
    ];
    stepCoords.forEach(([x, z], i) => {
      const wx = this._mx(x);
      const h = this.getTerrainHeight(wx, z);
      const stone = new THREE.Mesh(stepGeo, this.textures.materials.foundation);
      stone.position.set(wx, h + 0.02, z);
      stone.rotation.y = (i % 2 === 0 ? 0.12 : -0.15) * this.mirrorX;
      stone.receiveShadow = true;
      env.add(stone);
    });

    // 6. Sculpted limestone desert boulders nestled around the Quarry pit & dune ridges
    const boulderGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.45, 0));
    const boulders = [
      [-7.9, -3.2, 1.15, 0.72, 0.95],
      [-7.2, -2.5, 0.65, 0.45, 0.6],
      [-1.7, -5.6, 0.9, 0.62, 0.85],
      [8.3, -2.1, 0.88, 0.52, 0.8],
      [8.4, 3.2, 0.75, 0.48, 0.72],
    ];
    boulders.forEach(([bx, bz, sx, sy, sz], idx) => {
      const wx = this._mx(bx);
      const by = this.getTerrainHeight(wx, bz);
      const rock = new THREE.Mesh(boulderGeo, this.textures.materials.limestone);
      rock.position.set(wx, by + sy * 0.25, bz);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(idx * 0.35, idx * 1.2, idx * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      env.add(rock);
    });
  }

  /**
   * Builds a 4-sided geological strata plinth skirt whose top contour matches
   * getTerrainHeight(x, z) vertex-for-vertex around the entire island perimeter.
   */
  _buildContouredPlinthSkirt() {
    const hw = TERRAIN_W * 0.5;
    const hd = TERRAIN_D * 0.5;
    const segs = TERRAIN_SEG;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const addEdge = (x0, z0, x1, z1, nx, nz) => {
      const baseIndex = positions.length / 3;
      const edgeLen = Math.hypot(x1 - x0, z1 - z0);
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = THREE.MathUtils.lerp(x0, x1, t);
        const z = THREE.MathUtils.lerp(z0, z1, t);
        const topY = this.getTerrainHeight(x, z);
        const u = (t * edgeLen) / 6.0;

        positions.push(x, topY, z);
        normals.push(nx, 0, nz);
        uvs.push(u, 1);

        positions.push(x, PLINTH_BOTTOM, z);
        normals.push(nx, 0, nz);
        uvs.push(u, 0);
      }
      for (let i = 0; i < segs; i++) {
        const a = baseIndex + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    };

    addEdge(-hw, hd, hw, hd, 0, 1);
    addEdge(hw, hd, hw, -hd, 1, 0);
    addEdge(hw, -hd, -hw, -hd, 0, -1);
    addEdge(-hw, -hd, -hw, hd, -1, 0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return this._trackGeo(geo);
  }

  /**
   * Builds the translucent animated turquoise Nile water sheet and soft shoreline foam contour.
   */
  _buildNileWater(parent) {
    const wWidth = 6.5;
    const wDepth = 5.95;
    const cx = this._mx(6.9);
    const cz = -6.55;

    const waterGeo = this._trackGeo(new THREE.PlaneGeometry(wWidth, wDepth, 24, 24));
    waterGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(waterGeo, this.textures.materials.oasisWater);
    waterMesh.position.set(cx, WATER_LEVEL, cz);
    waterMesh.receiveShadow = true;
    parent.add(waterMesh);
    this.nileWaterMesh = waterMesh;

    const foamGeo = this._trackGeo(new THREE.PlaneGeometry(wWidth, wDepth, 40, 40));
    foamGeo.rotateX(-Math.PI / 2);
    const fPos = foamGeo.attributes.position;
    const fColors = new Float32Array(fPos.count * 4);
    for (let i = 0; i < fPos.count; i++) {
      const wx = cx + fPos.getX(i);
      const wz = cz + fPos.getZ(i);
      const h = this.getTerrainHeight(wx, wz);
      const diff = WATER_LEVEL - h;
      const foam = diff > -0.04 && diff < 0.22 ? Math.exp(-Math.pow((diff - 0.04) / 0.065, 2)) : 0;
      fColors[i * 4] = 0.96;
      fColors[i * 4 + 1] = 0.98;
      fColors[i * 4 + 2] = 0.94;
      fColors[i * 4 + 3] = foam * 0.65;
    }
    foamGeo.setAttribute('color', new THREE.BufferAttribute(fColors, 4));

    this.nileFoamMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    const foamMesh = new THREE.Mesh(foamGeo, this.nileFoamMat);
    foamMesh.position.set(cx, WATER_LEVEL + 0.012, cz);
    parent.add(foamMesh);
    this.nileFoamMesh = foamMesh;
  }

  _buildOasisReeds(parent) {
    const reedGeo = this._trackGeo(new THREE.ConeGeometry(0.055, 0.65, 4));
    reedGeo.translate(0, 0.32, 0);
    const reedClusters = [
      [5.35, -6.1],
      [6.1, -5.05],
      [7.4, -4.75],
      [6.4, -7.8],
      [8.6, -6.65],
    ];
    reedClusters.forEach(([rx, rz], idx) => {
      const wx = this._mx(rx);
      const y = this.getTerrainHeight(wx, rz);
      const tuft = new THREE.Group();
      tuft.position.set(wx, y - 0.03, rz);
      for (let k = 0; k < 4; k++) {
        const blade = new THREE.Mesh(reedGeo, this.textures.materials.palmLeaf);
        blade.position.set((k - 1.5) * 0.08, 0, ((k % 2) - 0.5) * 0.1);
        blade.rotation.z = (k - 1.5) * 0.18;
        blade.rotation.x = ((k % 2) - 0.5) * 0.16;
        blade.scale.setScalar(0.8 + (k % 3) * 0.22);
        tuft.add(blade);
      }
      this.palmFronds.push({ group: tuft, phase: idx * 1.1 });
      parent.add(tuft);
    });
  }

  _createPalmTree(parent, x, z, scale = 1, lean = 0.12) {
    const themeId = this.runConfig && this.runConfig.themeId;
    const group = new THREE.Group();
    const groundY = this.getTerrainHeight(x, z);
    group.position.set(x, groundY - 0.04, z);
    group.scale.setScalar(scale);

    if (themeId === 'rome') {
      // Sculpted Mediterranean Cypress tree for Rome — Colline Impériale
      const trunkGeo = this._trackGeo(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 6));
      const trunk = new THREE.Mesh(trunkGeo, this.textures.materials.palmTrunk);
      trunk.position.y = 0.26;
      trunk.castShadow = true;
      group.add(trunk);

      const foliage = new THREE.Group();
      foliage.position.y = 0.45;
      const c1 = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.42, 1.35, 7)),
        this.textures.materials.palmLeaf
      );
      c1.position.y = 0.65;
      c1.castShadow = true;
      foliage.add(c1);

      const c2 = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.32, 1.15, 7)),
        this.textures.materials.palmLeaf
      );
      c2.position.y = 1.32;
      c2.castShadow = true;
      foliage.add(c2);

      const c3 = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.2, 0.85, 7)),
        this.textures.materials.palmLeaf
      );
      c3.position.y = 1.88;
      c3.castShadow = true;
      foliage.add(c3);

      group.add(foliage);
      this.palmFronds.push({ group: foliage, phase: x * 0.7 + z * 0.3 });
      parent.add(group);
      return;
    }

    if (themeId === 'china') {
      // Cluster of 3 tall Jade Bamboo stalks for Chine — Montagne Céleste
      const stalkGeo = this._trackGeo(new THREE.CylinderGeometry(0.055, 0.075, 2.35, 6));
      const leafGeo = this._trackGeo(new THREE.ConeGeometry(0.18, 0.72, 4));
      leafGeo.scale(1, 1, 0.2);
      leafGeo.translate(0, 0.34, 0);

      const grove = new THREE.Group();
      [
        [0, 0, 1.0, 0.06],
        [-0.24, 0.14, 0.86, -0.09],
        [0.22, -0.15, 0.92, 0.08],
      ].forEach(([ox, oz, sc, tilt], idx) => {
        const s = new THREE.Mesh(stalkGeo, this.textures.materials.palmLeaf);
        s.position.set(ox, 1.12 * sc, oz);
        s.scale.set(1, sc, 1);
        s.rotation.z = tilt;
        s.castShadow = true;
        grove.add(s);

        for (let k = 0; k < 3; k++) {
          const lf = new THREE.Mesh(leafGeo, this.textures.materials.palmLeaf);
          lf.position.set(ox, (1.45 + k * 0.32) * sc, oz);
          lf.rotation.y = idx * 2.1 + k * 2.05;
          lf.rotation.z = 1.08;
          lf.castShadow = true;
          grove.add(lf);
        }
      });

      group.add(grove);
      this.palmFronds.push({ group: grove, phase: x * 0.7 + z * 0.3 });
      parent.add(group);
      return;
    }

    // Default / Égypte: Sunlit Desert Date Palm
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
   * 2. STATION 1 — LA CARRIÈRE (QUARRY)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    const terraceSpecs = [
      { x: -4.7, y: 0.45, z: -5.9, w: 6.4, h: 0.9, d: 2.3 },
      { x: -5.1, y: 1.25, z: -6.45, w: 5.4, h: 1.0, d: 1.65 },
      { x: -5.5, y: 2.0, z: -6.95, w: 4.1, h: 0.9, d: 1.2 },
      { x: -7.5, y: 0.65, z: -4.9, w: 1.6, h: 1.3, d: 2.6 },
    ];
    terraceSpecs.forEach((t) => {
      const geo = this._trackGeo(new THREE.BoxGeometry(t.w, t.h, t.d));
      const mesh = new THREE.Mesh(geo, this.textures.materials.limestone);
      mesh.position.set(this._mx(t.x), t.y, t.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      quarryGroup.add(mesh);
    });

    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.18, 1.5, 0.18));
    const beamGeo = this._trackGeo(new THREE.BoxGeometry(1.4, 0.16, 0.18));
    const post = new THREE.Mesh(postGeo, this.textures.materials.timber);
    post.position.set(this._mx(-2.1), 0.75, -5.2);
    post.castShadow = true;
    quarryGroup.add(post);

    const beam = new THREE.Mesh(beamGeo, this.textures.materials.timber);
    beam.position.set(this._mx(-2.5), 1.45, -5.2);
    beam.castShadow = true;
    quarryGroup.add(beam);

    // 3 Extractable Rock Nodes nestled into the excavated rocky quarry pit
    const nodePositions = [
      new THREE.Vector3(this._mx(-6.05), this.getTerrainHeight(this._mx(-6.05), -4.55) + 0.44, -4.55),
      new THREE.Vector3(this._mx(-4.6), this.getTerrainHeight(this._mx(-4.6), -4.78) + 0.48, -4.78),
      new THREE.Vector3(this._mx(-3.15), this.getTerrainHeight(this._mx(-3.15), -4.55) + 0.44, -4.55),
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
        maxHits: this.quarryMaxHits,
        depleted: false,
        regenTimer: 0,
        shakeTime: 0,
      };

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
    pad.position.set(this._mx(-4.6), 0.07, -3.15);
    pad.receiveShadow = true;
    quarryGroup.add(pad);

    for (let i = 0; i < 5; i++) {
      const sx = this._mx(-6.6 + i * 1.0);
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
    const leverDist = this.sledCapacity === 4 ? 2.22 : 1.76;

    // Track A: North-South (Quarry -> Stonecutter)
    this._createTrackAndSled({
      id: 'sledA',
      axis: 'z',
      fixedCoord: this._mx(-4.6),
      startPos: -1.3,
      endPos: 1.45,
      trackStart: -2.05,
      trackEnd: 2.25,
      accepts: ['raw', 'carved', 'capstone'],
      primaryKind: 'raw',
      leverLocalPos: new THREE.Vector3(this._mx(leverDist), 0.34, 0),
    });

    // Track B: West-East (Stonecutter -> Pyramid Staging)
    const bTrackMin = Math.min(this._mx(-2.25), this._mx(2.65));
    const bTrackMax = Math.max(this._mx(-2.25), this._mx(2.65));
    this._createTrackAndSled({
      id: 'sledB',
      axis: 'x',
      fixedCoord: 4.85,
      startPos: this._mx(-1.45),
      endPos: this._mx(1.85),
      trackStart: bTrackMin,
      trackEnd: bTrackMax,
      accepts: ['carved', 'capstone', 'raw'],
      primaryKind: 'carved',
      leverLocalPos: new THREE.Vector3(0, 0.34, leverDist),
    });
  }

  _createTrackAndSled(cfg) {
    const trackGroup = new THREE.Group();
    this.root.add(trackGroup);

    const len = cfg.trackEnd - cfg.trackStart;
    const mid = (cfg.trackStart + cfg.trackEnd) * 0.5;
    const isZ = cfg.axis === 'z';

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

    const sledGroup = new THREE.Group();
    const initX = isZ ? cfg.fixedCoord : cfg.startPos;
    const initZ = isZ ? cfg.startPos : cfg.fixedCoord;
    sledGroup.position.set(initX, 0.11, initZ);
    this.root.add(sledGroup);

    const deckSpan = this.sledCapacity === 4 ? 4.08 : 3.15;
    const runnerGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(0.18, 0.14, 1.32) : new THREE.BoxGeometry(1.32, 0.14, 0.18)
    );
    const runnerSpan = this.sledCapacity === 4 ? 1.55 : 1.15;
    [-runnerSpan, 0, runnerSpan].forEach((rOff) => {
      const runner = new THREE.Mesh(runnerGeo, this.textures.materials.timberDark);
      runner.position.set(isZ ? rOff : 0, 0.07, isZ ? 0 : rOff);
      runner.castShadow = true;
      runner.receiveShadow = true;
      sledGroup.add(runner);
    });

    const deckGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(deckSpan, 0.14, 1.18) : new THREE.BoxGeometry(1.18, 0.14, deckSpan)
    );
    const deck = new THREE.Mesh(deckGeo, this.textures.materials.timber);
    deck.position.y = 0.19;
    deck.castShadow = true;
    deck.receiveShadow = true;
    sledGroup.add(deck);

    // Reinforced sleds feature gilded guard rails
    const guardMat = this.upgrades.reinforced_sled
      ? this.textures.materials.capstoneGold
      : this.textures.materials.timberDark;
    const guardGeo = this._trackGeo(
      isZ ? new THREE.BoxGeometry(deckSpan, 0.11, 0.08) : new THREE.BoxGeometry(0.08, 0.11, deckSpan)
    );
    [-0.55, 0.55].forEach((gOff) => {
      const guard = new THREE.Mesh(guardGeo, guardMat);
      guard.position.set(isZ ? 0 : gOff, 0.3, isZ ? gOff : 0);
      guard.castShadow = true;
      sledGroup.add(guard);
    });

    // Physical wooden pull-lever assembly
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

    const leverHitGeo = this._trackGeo(new THREE.SphereGeometry(0.56, 8, 6));
    const leverHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    const leverHit = new THREE.Mesh(leverHitGeo, leverHitMat);
    leverHit.position.y = 0.55;
    leverPivot.add(leverHit);

    sledGroup.add(leverPivot);

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
      progress: 0,
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

    // 3 cargo slots (or 4 when Reinforced Sled upgrade is unlocked!)
    const offsets = this.sledCapacity === 4 ? [-1.47, -0.49, 0.49, 1.47] : [-1.02, 0, 1.02];
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

    sled.slots.forEach((slot) => {
      this._syncSledSlotWorldPos(sled, slot);
      if (slot.block && !slot.block.isDragging && !slot.block.isTweening) {
        slot.block.mesh.position.copy(slot.position);
      }
    });
  }

  /* ============================================================================
   * 4. STATION 3 — L'ATELIER DE TAILLE (STONECUTTER WORKBENCH)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const workshop = new THREE.Group();
    this.root.add(workshop);

    const cx = this._mx(-4.6);
    const cz = 4.85;

    const floorGeo = this._trackGeo(new THREE.BoxGeometry(3.8, 0.14, 3.6));
    const floor = new THREE.Mesh(floorGeo, this.textures.materials.foundation);
    floor.position.set(cx, 0.07, cz + 0.35);
    floor.receiveShadow = true;
    workshop.add(floor);

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

    const beamXGeo = this._trackGeo(new THREE.BoxGeometry(3.55, 0.14, 0.14));
    [-1.25, 1.35].forEach((bz) => {
      const beam = new THREE.Mesh(beamXGeo, this.textures.materials.timber);
      beam.position.set(cx, 2.6, cz + bz);
      beam.castShadow = true;
      workshop.add(beam);
    });

    const canopyGeo = this._trackGeo(new THREE.PlaneGeometry(3.55, 1.65, 6, 2));
    canopyGeo.rotateX(-Math.PI / 2 + 0.14);
    const canopy = new THREE.Mesh(canopyGeo, this.textures.materials.canopy);
    canopy.position.set(cx, 2.74, cz - 0.52);
    canopy.castShadow = true;
    workshop.add(canopy);
    this.canopyMesh = canopy;

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

    // Gilded chisel if Ciseau d'Or upgrade is owned!
    const chiselGeo = this._trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.36));
    const chiselMat = this.upgrades.golden_chisel
      ? this.textures.materials.capstoneGold
      : this.textures.materials.copperTool;
    const chisel = new THREE.Mesh(chiselGeo, chiselMat);
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

    const pc = this.pyramidCenter;

    const baseGeo = this._trackGeo(new THREE.BoxGeometry(5.9, FOUNDATION_Y, 5.9));
    const baseMesh = new THREE.Mesh(baseGeo, this.textures.materials.foundation);
    baseMesh.position.set(pc.x, FOUNDATION_Y * 0.5, pc.z);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    site.add(baseMesh);

    const curbGeo = this._trackGeo(new THREE.BoxGeometry(6.35, 0.12, 6.35));
    const curb = new THREE.Mesh(curbGeo, this.textures.materials.limestone);
    curb.position.set(pc.x, 0.06, pc.z);
    curb.receiveShadow = true;
    site.add(curb);

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
      const ob = new THREE.Mesh(obeliskBodyGeo, this.carvedBlockMat);
      ob.position.set(pc.x + cx, FOUNDATION_Y + 0.45, pc.z + cz);
      ob.castShadow = true;
      site.add(ob);

      const tip = new THREE.Mesh(obeliskTipGeo, this.textures.materials.capstoneGold);
      tip.position.set(pc.x + cx, FOUNDATION_Y + 1.04, pc.z + cz);
      tip.castShadow = true;
      site.add(tip);
    });

    // Optional Shop Upgrade: "Aura du Pyramidion" glowing perimeter halo around foundation
    if (this.upgrades.pyramidion_aura) {
      const auraGeo = this._trackGeo(new THREE.RingGeometry(3.35, 3.62, 40));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffd75e,
          transparent: true,
          opacity: 0.46,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      this.auraRingMesh = new THREE.Mesh(auraGeo, auraMat);
      this.auraRingMesh.position.set(pc.x, 0.09, pc.z);
      site.add(this.auraRingMesh);
    }

    // Pyramid Staging Pallet (4 slots beside Track B)
    const stageCx = this._mx(4.15);
    const stagePadGeo = this._trackGeo(new THREE.BoxGeometry(2.55, 0.14, 2.55));
    const stagePad = new THREE.Mesh(stagePadGeo, this.textures.materials.foundation);
    stagePad.position.set(stageCx, 0.07, 4.85);
    stagePad.receiveShadow = true;
    site.add(stagePad);

    const stageOffsets = [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ];
    stageOffsets.forEach(([ox, oz], idx) => {
      const sx = stageCx + ox;
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

    // Build progressive blueprint layers (custom Roguelike blueprint OR standard 55-block 5-tier pyramid)
    const layersDef =
      this.runConfig && Array.isArray(this.runConfig.blueprintLayers)
        ? this.runConfig.blueprintLayers
        : LAYER_SIZES.map((gridSize, layer) => {
            const centerOffset = (gridSize - 1) * 0.5;
            const cells = [];
            for (let gx = 0; gx < gridSize; gx++) {
              for (let gz = 0; gz < gridSize; gz++) {
                cells.push([gx - centerOffset, gz - centerOffset]);
              }
            }
            return { cells, isCapstone: layer === LAYER_SIZES.length - 1 };
          });

    this.maxLayerIndex = layersDef.length - 1;
    let slotIdx = 0;

    layersDef.forEach((layerSpec, layer) => {
      const isCapstone = Boolean(layerSpec.isCapstone);
      const layerBaseY = FOUNDATION_Y + layer * BLOCK_H;
      const centerY = isCapstone ? layerBaseY + 0.41 : layerBaseY + BLOCK_H * 0.5;

      layerSpec.cells.forEach(([dx, dz], cellIdx) => {
        const wx = pc.x + dx * PYRAMID_STEP;
        const wz = pc.z + dz * PYRAMID_STEP;

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
          id: `pyramid_L${layer}_${cellIdx}`,
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
      });
    });

    this.totalGoal = this.pyramidSlots.length;
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
    if (this.placedCount < this.totalGoal - 1) return false;
    return !this.blocks.some((b) => b.kind === 'capstone');
  }

  carveWorkbenchBlock(swipeVec) {
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (!block || block.kind !== 'raw' || block.isDragging || block.isTweening) {
      return false;
    }

    block.carveStage = Math.min(3, block.carveStage + this.carveStep);
    const stage = block.carveStage;
    this.audio.playChiselPing(stage);

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
        block.mesh.material = this.carvedBlockMat;
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
      const snapRad = slot.zoneType === 'pyramid' ? this.pyramidSnapRadius : 1.48;
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

    // Compute ground elevation underneath the dragged block using sculpted terrain height
    let groundY = Math.max(this.getTerrainHeight(dragPos.x, dragPos.z), WATER_LEVEL + 0.02);
    if (bestSlot) {
      groundY = bestSlot.dropIndicatorY;
    } else if (
      Math.abs(dragPos.x - this.pyramidCenter.x) < 3.1 &&
      Math.abs(dragPos.z - this.pyramidCenter.z) < 3.1
    ) {
      groundY = Math.max(groundY, FOUNDATION_Y + this.activeLayer * BLOCK_H);
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
      this.onProgress(this.placedCount, this.totalGoal);
    }

    const currentLayerSlots = this.pyramidSlots.filter((s) => s.layer === this.activeLayer);
    const layerDone = currentLayerSlots.every((s) => Boolean(s.block));

    if (layerDone) {
      if (this.activeLayer < this.maxLayerIndex) {
        const finishedTier = this.activeLayer;
        this.activeLayer += 1;
        this.audio.playLayerComplete(finishedTier);

        this.pyramidSlots.forEach((s) => {
          if (s.layer === this.activeLayer && !s.block) {
            s.ghostGroup.visible = true;
            s.ghostGroup.scale.setScalar(0.15);
          }
        });
      } else {
        this._triggerCompletionSequence();
      }
    }
  }

  _triggerCompletionSequence() {
    this.isComplete = true;
    this.clearDropHighlights();
    this._updateCarvingPips();
    this.audio.playVictoryFanfare();

    const apexY = FOUNDATION_Y + this.maxLayerIndex * BLOCK_H + 0.82;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(this.pyramidCenter.x, apexY, this.pyramidCenter.z);

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
      const baseReward = (this.runConfig && this.runConfig.rewardCoins) || 150;
      const goldMult = this.upgrades.royal_gold_stone ? 1.25 : 1.0;
      const rewardCoins = Math.round(baseReward * goldMult);
      const rewardTokens = (this.runConfig && this.runConfig.rewardTokens) || 0;
      this.onComplete({
        focusPoint: new THREE.Vector3(this.pyramidCenter.x, FOUNDATION_Y + 1.85, this.pyramidCenter.z),
        rewardCoins,
        rewardTokens,
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
      const ease = 1 - Math.pow(1 - t, 3);

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
          const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.15 * this.sledSpeedMult);
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

    // 5. Breathing pulse on active blueprint ghost slots & optional Pyramidion Aura ring
    const pulse = 0.38 + Math.sin(elapsed * 3.4) * 0.1;
    this.mats.ghostNormal.opacity = pulse;
    if (this.auraRingMesh) {
      const auraS = 1 + Math.sin(elapsed * 2.5) * 0.025;
      this.auraRingMesh.scale.setScalar(auraS);
      this.auraRingMesh.material.opacity = 0.34 + Math.sin(elapsed * 2.5) * 0.14;
    }
    for (let i = 0; i < this.pyramidSlots.length; i++) {
      const s = this.pyramidSlots[i];
      if (s.ghostGroup.visible && s.ghostGroup.scale.x < 0.995) {
        const nextS = THREE.MathUtils.lerp(s.ghostGroup.scale.x, 1, 1 - Math.exp(-8 * dt));
        s.ghostGroup.scale.setScalar(nextS);
      }
    }

    // 6. Subtle breeze on palm fronds, workshop sunshade, carving pips, & animated Nile water
    for (let i = 0; i < this.palmFronds.length; i++) {
      const p = this.palmFronds[i];
      p.group.rotation.z = Math.sin(elapsed * 1.45 + p.phase) * 0.045;
      p.group.rotation.x = Math.cos(elapsed * 1.1 + p.phase) * 0.03;
    }
    if (this.canopyMesh) {
      this.canopyMesh.rotation.z = Math.sin(elapsed * 1.8) * 0.015;
    }
    if (this.textures.maps.waterNormal) {
      this.textures.maps.waterNormal.offset.x = (elapsed * 0.038) % 1;
      this.textures.maps.waterNormal.offset.y = (elapsed * 0.024) % 1;
    }
    if (this.nileFoamMesh && this.nileFoamMat) {
      this.nileFoamMesh.position.y = WATER_LEVEL + 0.012 + Math.sin(elapsed * 2.2) * 0.008;
      this.nileFoamMat.opacity = 0.56 + Math.sin(elapsed * 2.2) * 0.16;
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
            this.pyramidCenter.x + Math.cos(angle) * rad,
            FOUNDATION_Y + 0.5 + Math.random() * 2.2,
            this.pyramidCenter.z + Math.sin(angle) * rad
          ),
          {
            count: 1,
            material: this.mats.dustGold,
            speed: 0.4,
            upSpeed: 1.5,
            gravity: -0.4,
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
    this.auraRingMesh = null;

    // Restore shared terrain splat color to neutral white
    this.textures.materials.terrainSplat.color.setHex(0xffffff);

    this.scene.remove(this.root);

    this.ownedGeometries.forEach((g) => g.dispose());
    this.ownedMaterials.forEach((m) => m.dispose());
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }
}
