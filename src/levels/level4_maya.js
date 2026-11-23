/**
 * Workd Builder — Level 4: Mayan Civilization ("Le Temple Maya de Kukulcán" — 52 Blocks)
 * Sculpted 128x128 Yucatán jungle & sacred cenote terrain with 4-biome GPU splatting
 * (tropical jungle moss & ferns, sun-baked clay & ancient Sacbé stone causeway,
 * pale-gold & jade-tinted limestone quarry dust, wet cenote rim moss), crystal-turquoise
 * sacred Cenote pool ringed by mossy boulders, stylized 3D Ceiba/palm trees, giant ferns,
 * carved Mayan stone stelae, Yucatán Limestone Quarry, Tropical Hardwood Log Sleds,
 * Palm-Thatched Sculptor Workshop, and a 52-block zero-gap connected Mayan Temple of Kukulcán
 * with protruding 3-tier ceremonial staircase, feathered-serpent balustrades, jade-inlaid
 * relief terraces, red-ochre stucco summit shrine, and crowning carved roof comb (Crestería).
 */

import * as THREE from 'three';
import { Level1Pyramid } from './level1_pyramid.js';
import {
  createConnectedMasonryGeometry,
  createMayanStairBlockGeometry,
  createMayanRoofCombGeometry,
  NEIGHBOR_PX,
  NEIGHBOR_NX,
  NEIGHBOR_PZ,
  NEIGHBOR_NZ,
  NEIGHBOR_PY,
  NEIGHBOR_NY,
} from './connectedMasonry.js';
import {
  createCozyGroundFoliageSystem,
  createContactShadowSystem,
  buildStylizedCeibaTree,
} from '../foliageAndGround.js';

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const TEMPLE_STEP = BLOCK_W; // Exact zero-gap horizontal grid step matching block width/depth
const TEMPLE_CENTER = new THREE.Vector3(3.6, 0, -0.8);
const FOUNDATION_Y = 0.24;

const TERRAIN_W = 20.4;
const TERRAIN_D = 19.2;
const TERRAIN_SEGS = 128;
const WATER_LEVEL = -0.14;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function rectFlatMask(x, z, cx, cz, halfW, halfD, feather = 1.35) {
  const dx = Math.max(Math.abs(x - cx) - halfW, 0);
  const dz = Math.max(Math.abs(z - cz) - halfD, 0);
  return 1.0 - smoothstep(0.0, feather, Math.hypot(dx, dz));
}

function segmentDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 0 ? clamp01((wx * vx + wz * vz) / lenSq) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/**
 * Unified 128x128 Yucatán Mayan Jungle & Sacred Cenote terrain heightfield.
 * Rolling tropical jungle mounds around perimeter, mossy limestone quarry pit in NW,
 * sunken crystal-turquoise Cenote sinkhole in NE, and flat ceremonial plaza pads.
 */
function sampleMayaTerrainHeight(x, z) {
  const moundWave =
    Math.sin(x * 0.32 + z * 0.26 + 0.7) * 0.34 +
    Math.cos(x * 0.24 - z * 0.32) * 0.28 +
    Math.sin(x * 0.68 + z * 0.52) * 0.09;

  const edgeX = smoothstep(5.7, 10.0, Math.abs(x));
  const edgeZ = smoothstep(5.1, 9.4, Math.abs(z));
  const jungleRing = clamp01(Math.max(edgeX, edgeZ));
  let h = (0.28 + moundWave) * jungleRing + jungleRing * jungleRing * 1.05;

  // Flat ceremonial pads under all 4 gameplay stations
  const flatQuarryPad = rectFlatMask(x, z, -4.6, -3.15, 2.9, 1.35, 1.2);
  const flatTrackA = rectFlatMask(x, z, -4.6, 0.2, 1.45, 2.8, 1.05);
  const flatWorkshop = rectFlatMask(x, z, -4.6, 5.0, 2.75, 2.25, 1.25);
  const flatTrackB = rectFlatMask(x, z, -0.3, 4.75, 2.8, 1.4, 1.1);
  const flatPallet = rectFlatMask(x, z, 4.1, 4.75, 1.85, 1.65, 1.15);
  const flatTemple = rectFlatMask(x, z, TEMPLE_CENTER.x, TEMPLE_CENTER.z + 0.2, 3.65, 3.95, 1.35);

  const flatMask = Math.max(
    flatQuarryPad,
    flatTrackA,
    flatWorkshop,
    flatTrackB,
    flatPallet,
    flatTemple
  );
  h *= 1.0 - flatMask;

  // Excavated Yucatán limestone quarry pit in NW
  const qDist = Math.hypot((x + 4.6) / 2.95, (z + 4.75) / 1.4);
  const qPit = 1.0 - smoothstep(0.62, 1.15, qDist);
  h -= qPit * 0.22;

  const cliffBack =
    smoothstep(-5.0, -7.2, z) * (1.0 - smoothstep(2.4, 5.4, Math.abs(x + 4.6)));
  h += cliffBack * 0.92;

  // Sunken deep circular Sacred Cenote sinkhole in NE
  const cenoteDist = Math.hypot((x - 7.4) / 2.95, (z + 6.0) / 2.7);
  const cenoteBasin = 1.0 - smoothstep(0.42, 0.98, cenoteDist);
  // Natural raised limestone rim right around the cenote edge
  const cenoteRim =
    smoothstep(0.75, 1.05, cenoteDist) * (1.0 - smoothstep(1.08, 1.48, cenoteDist)) * (1.0 - flatMask);
  h = h * (1.0 - cenoteBasin * 0.9) - cenoteBasin * 0.72 + cenoteRim * 0.38;

  return h;
}

/**
 * Computes 4-biome GPU splat weights for Level 4 Mayan Civilization:
 *   x (sand slot)   = Lush Tropical Jungle Moss, Ferns & Loam Soil
 *   y (path slot)   = Compacted Sun-Baked Clay & Ancient Sacbé Stone Causeway
 *   z (quarry slot) = Crushed Pale-Gold & Jade-Tinted Limestone Quarry Dust
 *   w (oasis slot)  = Deep Wet Cenote Rim Moss
 */
function computeMayaSplatWeights(x, z, h) {
  // Biome 2 (z): Pale-gold & jade-tinted limestone dust around NW quarry & SW sculptor workshop
  const quarryZone = 1.0 - smoothstep(2.2, 4.4, Math.hypot(x + 4.6, z + 4.4));
  const wsZone = 1.0 - smoothstep(2.0, 3.8, Math.hypot(x + 4.6, z - 5.0));
  const wDust = clamp01(Math.max(quarryZone, wsZone * 0.78));

  // Biome 1 (y): Sun-baked clay & ancient Sacbé stone causeway beneath tracks & ceremonial plaza
  const dTrackA = segmentDist(x, z, -4.6, -2.5, -4.6, 2.7);
  const dTrackB = segmentDist(x, z, -2.5, 4.75, 3.6, 4.75);
  const dCauseway = segmentDist(x, z, 3.6, 2.2, 3.6, 4.75);
  const plazaZone = 1.0 - smoothstep(2.9, 4.5, Math.hypot(x - TEMPLE_CENTER.x, z - TEMPLE_CENTER.z));
  const sacbeDist = Math.min(dTrackA, dTrackB, dCauseway);
  const wSacbe = clamp01(Math.max(1.0 - smoothstep(0.85, 2.0, sacbeDist), plazaZone * 0.92));

  // Biome 3 (w): Wet Cenote rim moss around the NE sacred cenote
  const cenoteDist = Math.hypot(x - 7.4, z + 6.0);
  const wCenote = 1.0 - smoothstep(2.1, 4.1, cenoteDist);

  // Biome 0 (x): Tropical Jungle Moss & Ferns everywhere else
  const used = clamp01(wDust * 0.95 + wSacbe * 0.92 + wCenote * 0.88);
  let w0 = Math.max(0.12, 1.0 - used);
  let w1 = wSacbe * (1.0 - wCenote * 0.55);
  let w2 = wDust * (1.0 - wSacbe * 0.65);
  let w3 = wCenote;

  const sum = w0 + w1 + w2 + w3;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(WATER_LEVEL - 0.04, WATER_LEVEL + 0.16, h);
  return { w0, w1, w2, w3, wetness };
}

/**
 * Compact carved Mayan roof-comb crest preview for workbench crafting & dragging.
 */
function createCrestPreviewGeometry() {
  return createMayanRoofCombGeometry({
    slabW: 0.94,
    slabD: 0.88,
    slabH: 0.16,
    combW: 0.84,
    combH: 0.44,
    combD: 0.28,
  });
}

/**
 * Defines the 52-block, 4-Tier Connected Mayan Temple of Kukulcán Blueprint (zero-gap TEMPLE_STEP = 0.96):
 *   Tier 1 (layer 0 — 22 blocks): Wide notched 5x5 limestone basal terrace (21) + protruding front ceremonial stair [0,3] (1)
 *   Tier 2 (layer 1 — 15 blocks): Carved feathered-serpent & jade-inlaid terrace (14) + mid ceremonial stair [0,2] (1)
 *   Tier 3 (layer 2 — 9 blocks):  Red-ochre stucco upper ceremonial terrace (8) + upper ceremonial stair [0,1] (1)
 *   Tier 4 (layer 3 + layer 4 — 6 blocks): 5 summit sanctuary walls framing open temple doorway [0,0]
 *                                          + 1 crowning jade-trimmed roof slab & carved roof comb (Crestería)
 */
function buildKukulkanBlueprintTiers() {
  // Tier 1 (layer 0): 5x5 minus 4 notched corners = 21 terrace blocks + 1 front ceremonial stair [0, 3] = 22 blocks
  const tier1 = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) === 2 && Math.abs(gz) === 2) continue;
      tier1.push({ dx: gx, dz: gz, pieceType: 'terrace', rotY: 0 });
    }
  }
  tier1.push({ dx: 0, dz: 3, pieceType: 'stair', rotY: 0 });

  // Tier 2 (layer 1): 3x3 core + cardinal wings [-2,0],[2,0],[0,-2],[-1,2],[1,2] (14 relief) + stair [0,2] (1) = 15 blocks
  const tier2 = [];
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      tier2.push({ dx: gx, dz: gz, pieceType: 'relief', rotY: 0 });
    }
  }
  [
    [-2, 0],
    [2, 0],
    [0, -2],
    [-1, 2],
    [1, 2],
  ].forEach(([dx, dz]) => {
    tier2.push({ dx, dz, pieceType: 'relief', rotY: 0 });
  });
  tier2.push({ dx: 0, dz: 2, pieceType: 'stair', rotY: 0 });

  // Tier 3 (layer 2): 3x3 upper ceremonial platform (8 red-ochre stucco + 1 upper stair [0, 1]) = 9 blocks
  const tier3 = [];
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const pieceType = gx === 0 && gz === 1 ? 'stair' : 'stucco';
      tier3.push({ dx: gx, dz: gz, pieceType, rotY: 0 });
    }
  }

  // Tier 4a (layer 3): 5 summit sanctuary shrine walls framing recessed doorway [0, 0] facing the grand staircase
  const tier4Shrine = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
  ].map(([dx, dz]) => ({ dx, dz, pieceType: 'shrine', rotY: 0 }));

  // Tier 4b (layer 4): 1 crowning jade-inlaid temple roof slab & carved Mayan Roof Comb (Crestería)
  const tier4Crest = [
    { dx: 0, dz: -0.5, pieceType: 'crest', rotY: 0 },
  ];

  return [tier1, tier2, tier3, tier4Shrine, tier4Crest];
}

export class Level4Maya extends Level1Pyramid {
  static meta = {
    id: 'level4_maya',
    title: 'Niveau 4 : Le Temple Maya de Kukulcán (52 blocs)',
    hudLabel: 'Maya • Kukulcán',
    skyColor: '#cde8dc',
    totalGoal: 52,
    rewardCoins: 200,
    firstCompletionTokens: 25,
  };

  constructor(opts) {
    super({
      ...opts,
      runConfig: null,
    });
    this.root.name = 'Level4MayaRoot';
    this.totalGoal = Level4Maya.meta.totalGoal;
    this.hudLabel = Level4Maya.meta.hudLabel;
  }

  _beforeBuild() {
    this.maya = this.textures.ensureMayaPack();
    this.totalGoal = Level4Maya.meta.totalGoal;
    this.hudLabel = Level4Maya.meta.hudLabel;
    this.jungleCanopies = [];
    this.jadeMotes = [];
    this.stuccoTrimMeshes = [];
    this.crestJadeJewel = null;

    if (this.upgrades.royal_gold_stone) {
      const m = this._trackMat(this.maya.materials.mayaLimestone.clone());
      m.emissive = new THREE.Color('#5a4310');
      m.emissiveIntensity = 0.14;
      m.metalness = 0.2;
      this.limestoneMat = m;
    } else {
      this.limestoneMat = this.maya.materials.mayaLimestone;
    }
    this.carvedBlockMat = this.limestoneMat;
  }

  _getRawBlockMaterial() {
    return this.maya.materials.rawMayaStone;
  }

  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.038 };
  }

  _isConnectableMasonrySlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        !slot.isCapstone &&
        slot.pieceType !== 'stair' &&
        slot.pieceType !== 'crest'
    );
  }

  _initSharedGeometries() {
    super._initSharedGeometries();

    // Override carved masonry block & ghosts to exact Level 4 height (BLOCK_H = 0.64)
    this.geos.carvedBlock = this._trackGeo(
      createConnectedMasonryGeometry(BLOCK_W, BLOCK_H, BLOCK_D, 0, 0.038)
    );
    this.geos.ghostBox = this._trackGeo(
      new THREE.BoxGeometry(BLOCK_W * 0.96, BLOCK_H * 0.96, BLOCK_D * 0.96)
    );
    this.geos.ghostBoxEdges = this._trackGeo(
      (() => {
        const g = new THREE.BoxGeometry(BLOCK_W * 0.97, BLOCK_H * 0.97, BLOCK_D * 0.97);
        const edges = new THREE.EdgesGeometry(g);
        g.dispose();
        return edges;
      })()
    );

    // Zero-gap 4-step Mayan ceremonial staircase block with sloped stone alfardas
    this.geos.mayaStair = this._trackGeo(createMayanStairBlockGeometry(BLOCK_W, BLOCK_H, BLOCK_D, 4));
    this.geos.ghostStair = this.geos.mayaStair;
    this.geos.ghostStairEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.mayaStair, 22));

    // Crowning Mayan Summit Temple Roof Slab & Carved Roof Comb (Crestería)
    this.geos.mayaCrestPreview = this._trackGeo(createCrestPreviewGeometry());
    this.geos.mayaCrest = this._trackGeo(
      createMayanRoofCombGeometry({
        slabW: BLOCK_W * 3 + 0.14,
        slabD: BLOCK_D * 2 + 0.14,
        slabH: 0.22,
        combW: BLOCK_W * 2.55,
        combH: 0.64,
        combD: 0.42,
      })
    );
    this.geos.ghostCrest = this.geos.mayaCrest;
    this.geos.ghostCrestEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.mayaCrest, 22));

    // Pale-gold Yucatán limestone dust & emerald-jade celebration sparks
    this.mats.dustLimestone.color.set('#e6dcba');
    this.mats.dustSand.color.set('#b9c698');
    this.mats.jadeSpark = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x3ef0a8,
        transparent: true,
        opacity: 0.92,
      })
    );
  }

  getTerrainHeight(x, z) {
    return sampleMayaTerrainHeight(x * this.mirrorX, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 MAYAN JUNGLE, SACRED CENOTE, CEIBA TREES, FERNS & STELAE
   * ========================================================================== */
  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // Unified 128x128 sculpted Yucatán jungle terrain with 4-biome GPU splatting
    const terrainGeo = this._trackGeo(
      new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEGS, TERRAIN_SEGS)
    );
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const count = pos.count;
    const splats = new Float32Array(count * 4);
    const wetnessArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const sx = x * this.mirrorX;
      const h = sampleMayaTerrainHeight(sx, z);
      pos.setY(i, h);

      const { w0, w1, w2, w3, wetness } = computeMayaSplatWeights(sx, z, h);
      const i4 = i * 4;
      splats[i4] = w0;
      splats[i4 + 1] = w1;
      splats[i4 + 2] = w2;
      splats[i4 + 3] = w3;
      wetnessArr[i] = wetness;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splats, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetnessArr, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.maya.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    env.add(terrainMesh);

    // Contoured limestone/earthen island plinth skirt
    const skirtGeo = this._buildContouredPlinthSkirt();
    const skirtMesh = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirtMesh.receiveShadow = true;
    env.add(skirtMesh);

    const bottomCapGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D));
    bottomCapGeo.rotateX(Math.PI / 2);
    const bottomCap = new THREE.Mesh(bottomCapGeo, this.textures.materials.plinth);
    bottomCap.position.y = -1.65;
    env.add(bottomCap);

    // Sunken crystal-turquoise Sacred Cenote pool ringed by mossy boulders in NE
    this._buildSacredCenote(env);

    // Stylized 3D Tropical Ceiba Trees around perimeter (sculpted irregular foliage cushions + buttress roots)
    const ceibaSpecs = [
      [4.45, -7.25, 1.15],
      [8.35, -2.55, 1.05],
      [-8.05, 6.15, 1.08],
      [7.85, 5.85, 1.12],
      [-0.25, -7.75, 1.02],
      [-8.3, -1.65, 1.0],
    ];
    ceibaSpecs.forEach(([tx, tz, sc], idx) => {
      this._createCeibaTree(env, this._mx(tx), tz, sc, idx);
    });

    // Giant Tropical Jungle Ferns along the cenote rim & mounds
    const fernSpecs = [
      [5.1, -4.6, 1.05],
      [8.2, -4.3, 0.96],
      [6.4, -8.25, 1.1],
      [-7.6, 1.8, 1.0],
      [1.4, -7.2, 0.92],
      [7.7, 3.1, 1.05],
    ];
    fernSpecs.forEach(([fx, fz, sc], idx) => {
      this._createJungleFern(env, this._mx(fx), fz, sc, idx);
    });

    // Carved Mayan Stone Stelae with jade inlays flanking the ceremonial plaza & Sacbé causeway
    const stelaSpecs = [
      [0.85, 2.55, 0.15],
      [6.35, 2.55, -0.15],
      [5.55, -3.75, 0.45],
      [-1.75, 2.75, -0.25],
    ];
    stelaSpecs.forEach(([sx, sz, ry]) => {
      this._createMayanStela(env, this._mx(sx), sz, ry);
    });

    // Ancient Sacbé carved limestone causeway flagstones leading into the temple staircase
    const flagGeo = this._trackGeo(new THREE.BoxGeometry(1.05, 0.08, 0.72));
    [
      [3.6, 3.05],
      [3.6, 3.85],
      [2.4, 3.45],
      [1.3, 3.95],
      [0.2, 4.3],
    ].forEach(([fx, fz], i) => {
      const wx = this._mx(fx);
      const h = this.getTerrainHeight(wx, fz);
      const flag = new THREE.Mesh(flagGeo, this.maya.materials.mayaLimestone);
      flag.position.set(wx, h + 0.015, fz);
      flag.rotation.y = (i % 2 === 0 ? 0.06 : -0.07) * this.mirrorX;
      flag.receiveShadow = true;
      env.add(flag);
    });

    // Cozy 3D Instanced Jungle Grass (1120 tufts), Flat Limestone Pebbles & Discreet Tropical Flowers
    const focalPoints = [
      ...ceibaSpecs.map(([tx, tz]) => ({ x: this._mx(tx), z: tz, innerRadius: 0.42, radius: 2.05 })),
      ...fernSpecs.map(([fx, fz]) => ({ x: this._mx(fx), z: fz, innerRadius: 0.3, radius: 1.55 })),
      { x: this._mx(5.4), z: -4.9, innerRadius: 0.35, radius: 2.05 },
      { x: this._mx(7.1), z: -3.7, innerRadius: 0.35, radius: 1.9 },
    ];
    this.cozyGround = createCozyGroundFoliageSystem({
      parent: env,
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      isBlocked: (x, z) => this._isBlockedForFoliage(x, z),
      getGrassWeight: (x, z, y) => {
        const sx = x * this.mirrorX;
        const { w0: wJungle, w1: wSacbe, w2: wQuarry, w3: wCenoteMoss } = computeMayaSplatWeights(sx, z, y);
        if (wSacbe > 0.28 || wQuarry > 0.34) return 0;
        return Math.max(wJungle, wCenoteMoss);
      },
      focalPoints,
      waterLevel: WATER_LEVEL,
      halfW: TERRAIN_W * 0.5,
      halfD: TERRAIN_D * 0.5,
      grassCount: 1120,
      pebbleCount: 115,
      flowerCount: 88,
      grassPalette: ['#3d8a3a', '#2c7032', '#5ea641', '#88b848', '#255f2a'],
      pebblePalette: ['#b8b29f', '#9e9b8a', '#808276', '#c9c2ad'],
      flowerPalette: ['#fffbf0', '#fff4d4', '#ffe14d', '#ffd23f'],
      seed: 404,
    });

    // Soft Circular Contact Shadows (AO) under Ceiba trees, ferns, stelae, quarry, workshop & Temple
    const aoEntries = [
      ...ceibaSpecs.map(([tx, tz, sc]) => ({ x: this._mx(tx), z: tz, radius: 1.38 * sc, strength: 0.96 })),
      ...fernSpecs.map(([fx, fz, sc]) => ({ x: this._mx(fx), z: fz, radius: 0.65 * sc, strength: 0.85 })),
      ...stelaSpecs.map(([sx, sz]) => ({ x: this._mx(sx), z: sz, radius: 0.48, strength: 0.92 })),
      { x: this._mx(-4.7), z: -5.2, radiusX: 3.3, radiusZ: 1.55, strength: 0.72 },
      { x: this._mx(-4.6), z: 4.15, radiusX: 2.35, radiusZ: 2.15, strength: 0.7 },
      { x: this.pyramidCenter.x, z: this.pyramidCenter.z, radiusX: 3.15, radiusZ: 3.15, strength: 0.78 },
    ];
    this.contactShadows = createContactShadowSystem(env, aoEntries, (x, z) => this.getTerrainHeight(x, z));
  }

  _buildSacredCenote(parent) {
    const cx = this._mx(7.4);
    const cz = -6.0;

    // Luminous crystal-turquoise Sacred Cenote sinkhole water
    const waterGeo = this._trackGeo(new THREE.CircleGeometry(2.85, 32));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.textures.materials.oasisWater);
    water.position.set(cx, WATER_LEVEL, cz);
    water.scale.set(1.02, 1, 0.92);
    water.receiveShadow = true;
    parent.add(water);
    this.nileWaterMesh = water;

    // Ring of mossy Yucatán limestone boulders & overhanging roots around the Cenote sinkhole
    const rockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.46, 0));
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.2;
      const rx = 7.4 + Math.cos(ang) * (2.68 + (i % 2) * 0.24);
      const rz = -6.0 + Math.sin(ang) * (2.42 + (i % 3) * 0.18);
      if (rx > 9.6 || rz < -9.0) continue;
      const wx = this._mx(rx);
      const ry = this.getTerrainHeight(wx, rz);
      const rock = new THREE.Mesh(rockGeo, this.maya.materials.mayaCliff);
      rock.position.set(wx, ry + 0.14, rz);
      rock.scale.set(1.1 + (i % 3) * 0.2, 0.65 + (i % 2) * 0.22, 1.05);
      rock.rotation.set(i * 0.35, i * 1.1, i * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      parent.add(rock);
    }

    // Floating sacred jade-rimmed water offerings / lily pads on the cenote
    const padGeo = this._trackGeo(new THREE.CircleGeometry(0.24, 10, 0.2, Math.PI * 1.85));
    padGeo.rotateX(-Math.PI / 2);
    [
      [6.6, -5.5, 0.95],
      [7.9, -6.4, 1.1],
      [7.1, -6.7, 0.85],
    ].forEach(([lx, lz, sc], idx) => {
      const pad = new THREE.Mesh(padGeo, this.maya.materials.jungleCanopyLight);
      pad.position.set(this._mx(lx), WATER_LEVEL + 0.015, lz);
      pad.scale.setScalar(sc);
      pad.rotation.y = idx * 1.8;
      parent.add(pad);
    });
  }

  _createCeibaTree(parent, x, z, scale = 1.0, idx = 0) {
    const groundY = this.getTerrainHeight(x, z);
    const { tree, crown } = buildStylizedCeibaTree({
      x,
      z,
      groundY,
      scale,
      seed: idx + 1,
      barkMat: this.maya.materials.ceibaTrunk,
      foliageMat: this._getSharedFoliageMaterial(),
      trackGeo: (g) => this._trackGeo(g),
    });
    parent.add(tree);
    this.jungleCanopies.push({ group: crown, phase: idx * 1.3 });
  }

  _createJungleFern(parent, x, z, scale = 1.0, idx = 0) {
    const fern = new THREE.Group();
    const y = this.getTerrainHeight(x, z);
    fern.position.set(x, y, z);
    fern.scale.setScalar(scale);

    const frondGeo = this._trackGeo(new THREE.ConeGeometry(0.24, 0.92, 4));
    frondGeo.translate(0, 0.42, 0);
    for (let f = 0; f < 6; f++) {
      const ang = (f / 6) * Math.PI * 2 + idx * 0.4;
      const frond = new THREE.Mesh(
        frondGeo,
        f % 2 === 0 ? this.maya.materials.jungleCanopy : this.maya.materials.jungleCanopyLight
      );
      frond.rotation.y = ang;
      frond.rotation.z = 0.78;
      frond.scale.set(1.0, 1.0, 0.28);
      frond.castShadow = true;
      fern.add(frond);
    }
    parent.add(fern);
  }

  _createMayanStela(parent, x, z, rotY = 0) {
    const stela = new THREE.Group();
    const y = this.getTerrainHeight(x, z);
    stela.position.set(x, y, z);
    stela.rotation.y = rotY;

    const plinth = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.56, 0.16, 0.44)),
      this.maya.materials.mayaCliff
    );
    plinth.position.y = 0.08;
    plinth.castShadow = true;
    stela.add(plinth);

    const monolith = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.4, 1.18, 0.24)),
      this.maya.materials.mayaRelief
    );
    monolith.position.y = 0.74;
    monolith.castShadow = true;
    stela.add(monolith);

    const jadeGem = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.09, 0)),
      this.maya.materials.jadeInlay
    );
    jadeGem.position.set(0, 1.12, 0.13);
    stela.add(jadeGem);

    parent.add(stela);
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE CALCAIRE DU YUCATÁN (NORTH-WEST)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    // Stepped mossy Yucatán limestone quarry cliff behind the 3 extractable rock nodes
    const cliffLayers = [
      { pos: [-4.6, 0.56, -6.15], size: [5.4, 1.32, 1.95] },
      { pos: [-5.1, 1.38, -6.48], size: [3.7, 0.85, 1.25] },
      { pos: [-3.2, 0.92, -6.28], size: [2.3, 0.92, 1.35] },
    ];
    cliffLayers.forEach((c) => {
      const geo = this._trackGeo(new THREE.BoxGeometry(...c.size));
      const mesh = new THREE.Mesh(geo, this.maya.materials.mayaCliff);
      mesh.position.set(this._mx(c.pos[0]), c.pos[1], c.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      quarryGroup.add(mesh);
    });

    // Tropical hardwood crane beam over quarry cliff
    const post = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8)),
      this.maya.materials.hardwoodLog
    );
    post.position.set(this._mx(-3.0), 1.48, -6.2);
    post.castShadow = true;
    quarryGroup.add(post);

    const beam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.65, 0.12, 0.12)),
      this.maya.materials.hardwoodLog
    );
    beam.position.set(this._mx(-3.55), 2.06, -5.95);
    beam.rotation.y = 0.25 * this.mirrorX;
    beam.castShadow = true;
    quarryGroup.add(beam);

    // 3 Extractable Yucatán Limestone Rock Nodes
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

      const mat = this._trackMat(this.maya.materials.rawMayaStone.clone());
      mat.emissive = new THREE.Color(0x283422);
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

    // Yucatán Quarry Staging Pad (5 slots for Raw Mayan Limestone Blocks)
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.6, 0.14, 1.35)),
      this.maya.materials.mayaLimestone
    );
    pad.position.set(this._mx(-4.6), 0.07, -3.15);
    pad.receiveShadow = true;
    quarryGroup.add(pad);

    for (let i = 0; i < 5; i++) {
      const sx = this._mx(-6.6 + i * 1.0);
      const sz = -3.15;
      const marker = this._createSlotMarker(quarryGroup, sx, 0.155, sz);
      this.quarrySlots.push({
        id: `quarry_${i}`,
        zoneType: 'quarry',
        accepts: ['raw'],
        position: new THREE.Vector3(sx, 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    }
  }

  /* ============================================================================
   * 2b. ZONE 2 — LE TRAÎNEAU SUR RONDINS & CHAUSSÉE SACBÉ (WEST & CENTER)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();
    // Apply heavy tropical hardwood & ceremonial red-ochre accents to Mayan log sleds
    this.sleds.forEach((sled) => {
      if (!sled.group) return;
      sled.group.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (child.material === this.textures.materials.timberDark) {
          child.material = this.maya.materials.hardwoodLog;
        } else if (child.material === this.textures.materials.copperTool) {
          child.material = this.maya.materials.jadeInlay;
        }
      });
    });
  }

  /* ============================================================================
   * 3. ZONE 3 — L'ATELIER DU SCULPTEUR MAYA (PALM-THATCHED CANOPY, SOUTH-WEST)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    this.root.add(ws);

    const cx = this._mx(-4.6);
    const cz = 5.0;

    // Carved Yucatán limestone workshop floor patio
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.4, 0.14, 3.2)),
      this.maya.materials.mayaLimestone
    );
    floor.position.set(cx, 0.07, cz);
    floor.receiveShadow = true;
    ws.add(floor);

    // Decorative open-courtyard Mayan sculptor frame: 2 tall rear hardwood posts + 2 lower carved front bollards
    // Keeps authentic palm-thatch palapa look while leaving the stone anvil 100% open to top-down view & touch!
    const frameGroup = new THREE.Group();
    ws.add(frameGroup);

    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.32));
    const rearPostGeo = this._trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 8));
    const frontPostGeo = this._trackGeo(new THREE.CylinderGeometry(0.085, 0.1, 1.28, 8));
    const jadeOrbGeo = this._trackGeo(new THREE.OctahedronGeometry(0.11, 0));

    [
      [cx - 1.85, cz - 1.28, true],
      [cx + 1.85, cz - 1.28, true],
      [cx - 1.85, cz + 1.28, false],
      [cx + 1.85, cz + 1.28, false],
    ].forEach(([px, pz, isRear]) => {
      const plinth = new THREE.Mesh(plinthGeo, this.maya.materials.mayaCliff);
      plinth.position.set(px, 0.22, pz);
      plinth.castShadow = true;
      frameGroup.add(plinth);

      const post = new THREE.Mesh(isRear ? rearPostGeo : frontPostGeo, this.maya.materials.hardwoodLog);
      post.position.set(px, isRear ? 1.4 : 0.94, pz);
      post.castShadow = true;
      frameGroup.add(post);

      if (!isRear) {
        const orb = new THREE.Mesh(jadeOrbGeo, this.maya.materials.jadeInlay);
        orb.position.set(px, 1.66, pz);
        frameGroup.add(orb);
      }
    });

    // Cutaway / Open-Front Palm-Thatched Palapa Awning (covers ONLY back ~35% behind stone anvil)
    const canopyGroup = new THREE.Group();
    canopyGroup.position.set(cx, 2.48, cz);

    // Hardwood rear girder & open side beam brackets
    const rearPole = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 4.3, 6)),
      this.maya.materials.hardwoodLog
    );
    rearPole.rotation.z = Math.PI / 2;
    rearPole.position.set(0, 0.06, -1.28);
    rearPole.castShadow = true;
    canopyGroup.add(rearPole);

    const sideBeamGeo = this._trackGeo(new THREE.BoxGeometry(0.11, 0.12, 1.05));
    [-1.85, 1.85].forEach((ox) => {
      const sb = new THREE.Mesh(sideBeamGeo, this.maya.materials.hardwoodLog);
      sb.position.set(ox, 0.06, -1.22);
      sb.castShadow = true;
      canopyGroup.add(sb);
    });

    // Golden palm-thatch overhanging rear awning (z in [-1.74, -0.74] — completely clear of anvil & block!)
    const thatchAwning = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.56, 0.18, 1.02)),
      this.maya.materials.thatchRoof
    );
    thatchAwning.position.set(0, 0.26, -1.24);
    thatchAwning.rotation.x = -0.32;
    thatchAwning.castShadow = true;
    canopyGroup.add(thatchAwning);

    // Hardwood front ridge pole along the raised lip of the rear thatch awning
    const ridgePole = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 4.46, 6)),
      this.maya.materials.hardwoodLog
    );
    ridgePole.rotation.z = Math.PI / 2;
    ridgePole.position.set(0, 0.44, -0.82);
    canopyGroup.add(ridgePole);

    // Ceremonial red-ochre & jade banner fascia tucked neatly beneath the rear awning eaves
    const banner = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.52, 0.18, 0.06)),
      this.maya.materials.redOchre
    );
    banner.position.set(0, -0.04, -0.84);
    canopyGroup.add(banner);

    // Disable raycast hit-testing on ALL decorative workshop roof eaves & framing meshes
    // so tapping/dragging limestone blocks on the anvil NEVER hits the roof overhang
    const noopRaycast = () => {};
    frameGroup.traverse((child) => {
      if (child.isMesh) child.raycast = noopRaycast;
    });
    canopyGroup.traverse((child) => {
      if (child.isMesh) child.raycast = noopRaycast;
    });

    this.canopyMesh = canopyGroup;
    ws.add(canopyGroup);

    // Carved Limestone Sculptor Anvil & Obsidian / Copper Chisels
    const wbX = cx - this._mx(0.55);
    const wbZ = cz - 0.12;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.58, 0.62, 1.38)),
      this.maya.materials.mayaCliff
    );
    benchBase.position.set(wbX, 0.44, wbZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.72, 0.14, 1.52)),
      this.maya.materials.mayaRelief
    );
    benchTop.position.set(wbX, 0.8, wbZ);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    ws.add(benchTop);

    // Hardwood sculptor mallet & volcanic obsidian chisel resting on anvil
    const malletHandle = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6)),
      this.maya.materials.hardwoodLog
    );
    malletHandle.position.set(wbX - this._mx(0.6), 0.91, wbZ + 0.46);
    malletHandle.rotation.set(Math.PI / 2, 0.35, 0);
    ws.add(malletHandle);

    const malletHead = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 8)),
      this.textures.materials.copperTool
    );
    malletHead.position.set(wbX - this._mx(0.67), 0.93, wbZ + 0.3);
    malletHead.rotation.z = Math.PI / 2;
    ws.add(malletHead);

    const chiselMat = this.upgrades.golden_chisel
      ? this.textures.materials.capstoneGold
      : this.maya.materials.obsidianBlade;
    const chisel = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.36)), chiselMat);
    chisel.position.set(wbX + this._mx(0.62), 0.9, wbZ - 0.42);
    chisel.rotation.y = -0.38;
    ws.add(chisel);

    // Workbench active carving slot
    const wbY = 0.87;
    const wbMarker = this._createSlotMarker(ws, wbX, wbY + 0.015, wbZ);
    this.workbenchSlot = {
      id: 'workbench_anvil',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(wbX, wbY + BLOCK_H * 0.5, wbZ),
      dropIndicatorY: wbY + 0.01,
      marker: wbMarker,
      block: null,
    };

    // Generous invisible carve-swipe hitbox over anvil
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.9, 1.35, 1.9));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(wbX, wbY + 0.45, wbZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Diegetic Emerald-Jade Carving Progress Pips
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.095, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshBasicMaterial({ color: 0x52f2b4, transparent: true, opacity: 0.35 })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(wbX + (i - 1) * 0.32, wbY + 1.24, wbZ);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Finished Stone Output Slots
    const outPositions = [
      [cx + this._mx(1.05), cz - 0.55],
      [cx + this._mx(1.05), cz + 0.55],
    ];
    outPositions.forEach(([ox, oz], idx) => {
      const marker = this._createSlotMarker(ws, ox, 0.155, oz);
      this.outputSlots.push({
        id: `workshop_out_${idx}`,
        zoneType: 'output',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(ox, 0.14 + BLOCK_H * 0.5, oz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    });
  }

  /* ============================================================================
   * 4. ZONE 4 — CHANTIER DU TEMPLE MAYA DE KUKULCÁN (52 BLOCKS, 4 TIERS)
   * ========================================================================== */
  _buildPyramidSite() {
    const site = new THREE.Group();
    this.root.add(site);

    const tc = this.pyramidCenter;

    // Raised Ceremonial Limestone Plaza Platform under the Mayan Temple
    const basePlatform = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.65, FOUNDATION_Y, 6.25)),
      this.maya.materials.mayaCliff
    );
    basePlatform.position.set(tc.x, FOUNDATION_Y * 0.5, tc.z + 0.25);
    basePlatform.receiveShadow = true;
    basePlatform.castShadow = true;
    site.add(basePlatform);

    // Twin Carved Stone Feathered-Serpent (Kukulcán) Heads flanking the foot of the grand front staircase!
    const headGeo = this._trackGeo(new THREE.BoxGeometry(0.36, 0.42, 0.52));
    const eyeGeo = this._trackGeo(new THREE.SphereGeometry(0.06, 6, 6));
    [-0.64, 0.64].forEach((ox) => {
      const serpent = new THREE.Group();
      serpent.position.set(tc.x + ox, FOUNDATION_Y + 0.21, tc.z + 3.42 * TEMPLE_STEP);

      const head = new THREE.Mesh(headGeo, this.maya.materials.mayaRelief);
      head.castShadow = true;
      serpent.add(head);

      const crest = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.4, 0.12, 0.32)),
        this.maya.materials.redOchre
      );
      crest.position.set(0, 0.24, -0.05);
      serpent.add(crest);

      [-0.12, 0.12].forEach((ex) => {
        const eye = new THREE.Mesh(eyeGeo, this.maya.materials.jadeInlay);
        eye.position.set(ex, 0.08, 0.25);
        serpent.add(eye);
      });
      site.add(serpent);
    });

    // Aura du Pyramidion upgrade support
    if (this.upgrades.pyramidion_aura) {
      const auraGeo = this._trackGeo(new THREE.RingGeometry(3.38, 3.68, 40));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x3ef0a8,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      this.auraRingMesh = new THREE.Mesh(auraGeo, auraMat);
      this.auraRingMesh.position.set(tc.x, FOUNDATION_Y + 0.025, tc.z);
      site.add(this.auraRingMesh);
    }

    // Staging Pallet beside Track B end (2x2 = 4 slots)
    const palletX = this._mx(4.1);
    const palletZ = 4.75;
    const pallet = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.35, 0.14, 2.35)),
      this.maya.materials.mayaLimestone
    );
    pallet.position.set(palletX, 0.07, palletZ);
    pallet.receiveShadow = true;
    site.add(pallet);

    [
      [-0.56, -0.56],
      [0.56, -0.56],
      [-0.56, 0.56],
      [0.56, 0.56],
    ].forEach(([ox, oz], idx) => {
      const sx = palletX + ox;
      const sz = palletZ + oz;
      const marker = this._createSlotMarker(site, sx, 0.155, sz);
      this.stagingSlots.push({
        id: `staging_${idx}`,
        zoneType: 'staging',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(sx, 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    });

    // Molded Red-Ochre & Jade Stucco Cornice Band crowning Tier 3 (revealed automatically when Tier 3 bonds!)
    const trimY = FOUNDATION_Y + 3 * BLOCK_H - 0.045;
    const trimLen = 3 * BLOCK_W + 0.16;
    const trimNSGeo = this._trackGeo(new THREE.BoxGeometry(trimLen, 0.09, 0.12));
    const trimEWGeo = this._trackGeo(new THREE.BoxGeometry(0.12, 0.09, trimLen));
    const trimEdge = 1.5 * BLOCK_W + 0.03;
    [
      [trimNSGeo, 0, -trimEdge],
      [trimEWGeo, -trimEdge, 0],
      [trimEWGeo, trimEdge, 0],
    ].forEach(([geo, ox, oz]) => {
      const m = new THREE.Mesh(geo, this.maya.materials.redOchre);
      m.position.set(tc.x + ox, trimY, tc.z + oz);
      m.castShadow = true;
      m.visible = false;
      site.add(m);
      this.stuccoTrimMeshes.push(m);
    });

    // Gleaming Emerald-Jade Medallion inset in the crowning Crestería (revealed when final 52nd block locks in!)
    const jadeJewel = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.24, 0)),
      this.maya.materials.jadeInlay
    );
    jadeJewel.position.set(tc.x, FOUNDATION_Y + 4 * BLOCK_H + 0.68, tc.z - 0.48);
    jadeJewel.visible = false;
    site.add(jadeJewel);
    this.crestJadeJewel = jadeJewel;

    // Build all 52 progressive zero-gap blueprint slots across the Mayan Temple of Kukulcán
    const tiers = buildKukulkanBlueprintTiers();
    this.maxLayerIndex = tiers.length - 1;
    let slotIdx = 0;

    tiers.forEach((tierCells, layer) => {
      const layerBaseY = FOUNDATION_Y + layer * BLOCK_H;

      tierCells.forEach((cell, cellIdx) => {
        const wx = tc.x + cell.dx * TEMPLE_STEP;
        const wz = tc.z + cell.dz * TEMPLE_STEP;
        const isStair = cell.pieceType === 'stair';
        const isCrest = cell.pieceType === 'crest';

        const centerY = isCrest ? layerBaseY : layerBaseY + BLOCK_H * 0.5;

        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(wx, centerY, wz);
        ghostGroup.rotation.y = cell.rotY || 0;

        const gGeo = isStair
          ? this.geos.ghostStair
          : isCrest
          ? this.geos.ghostCrest
          : this.geos.ghostBox;
        const gEdges = isStair
          ? this.geos.ghostStairEdges
          : isCrest
          ? this.geos.ghostCrestEdges
          : this.geos.ghostBoxEdges;

        const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
        const ghostLines = new THREE.LineSegments(gEdges, this.mats.ghostLineNormal);
        ghostGroup.add(ghostMesh);
        ghostGroup.add(ghostLines);
        ghostGroup.visible = layer === 0;
        site.add(ghostGroup);

        const slot = {
          id: `maya_L${layer}_${cellIdx}`,
          index: slotIdx++,
          zoneType: 'pyramid',
          layer,
          gridX: cell.dx,
          gridZ: cell.dz,
          isCapstone: isCrest,
          pieceType: cell.pieceType,
          rotY: cell.rotY || 0,
          accepts: ['carved', 'capstone'],
          position: new THREE.Vector3(wx, centerY, wz),
          dropIndicatorY: layerBaseY + 0.01,
          ghostGroup,
          ghostMesh,
          ghostLines,
          block: null,
        };
        this.pyramidSlots.push(slot);
        this._registerSlotInGrid(slot);
      });
    });

    this.totalGoal = this.pyramidSlots.length; // 52 blocks
  }

  /* ============================================================================
   * 5. CONNECTED MAYAN MASONRY, STAIRCASE MERGING & CRESTERÍA SANCTUARY CROWN
   * ========================================================================== */
  _computeMasonryNeighborMask(slot) {
    if (!this._isConnectableMasonrySlot(slot)) return 0;
    const { gridX: gx, layer, gridZ: gz } = slot;
    let mask = 0;

    if (this._isConnectableMasonrySlot(this._getGridSlot(gx + 1, layer, gz))) mask |= NEIGHBOR_PX;
    if (this._isConnectableMasonrySlot(this._getGridSlot(gx - 1, layer, gz))) mask |= NEIGHBOR_NX;
    if (this._isConnectableMasonrySlot(this._getGridSlot(gx, layer, gz + 1))) mask |= NEIGHBOR_PZ;
    if (this._isConnectableMasonrySlot(this._getGridSlot(gx, layer, gz - 1))) mask |= NEIGHBOR_NZ;
    if (this._isConnectableMasonrySlot(this._getGridSlot(gx, layer + 1, gz))) mask |= NEIGHBOR_PY;
    if (layer > 0 && this._isConnectableMasonrySlot(this._getGridSlot(gx, layer - 1, gz))) {
      mask |= NEIGHBOR_NY;
    }

    return mask;
  }

  _onConnectedMasonryUpdated(_slot) {
    // Reveal red-ochre stucco cornice trim once Tier 3 finishes
    const tier3Done = this.pyramidSlots
      .filter((s) => s.layer === 2)
      .every((s) => Boolean(s.block));
    if (tier3Done && this.stuccoTrimMeshes.length > 0 && !this.stuccoTrimMeshes[0].visible) {
      this.stuccoTrimMeshes.forEach((m) => {
        m.visible = true;
      });
    }

    // Reveal gleaming emerald-jade crest medallion when the final crowning Crestería locks in
    const crestPlaced = this.pyramidSlots.some((s) => s.pieceType === 'crest' && Boolean(s.block));
    if (crestPlaced && this.crestJadeJewel && !this.crestJadeJewel.visible) {
      this.crestJadeJewel.visible = true;
    }
  }

  _shouldForgeCapstone() {
    // Final 52nd block is crafted as the Jade-Trimmed Sanctuary Crest (Crestería) instead of an Egyptian cone
    return false;
  }

  _pickNextCarvedPieceType() {
    const remaining = this.pyramidSlots.filter((s) => s.layer === this.activeLayer && !s.block);
    if (remaining.some((s) => s.pieceType === 'crest')) return 'crest';
    if (remaining.some((s) => s.pieceType === 'stair')) return 'stair';
    if (remaining.some((s) => s.pieceType === 'shrine')) return 'shrine';
    if (remaining.some((s) => s.pieceType === 'stucco')) return 'stucco';
    if (remaining.some((s) => s.pieceType === 'relief')) return 'relief';
    return 'terrace';
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyMayaPieceVisual(block, pieceType, null);
    }
    return stillRaw;
  }

  _applyMayaPieceVisual(block, pieceType, slot = null) {
    block.pieceType = pieceType;
    if (pieceType === 'stair') {
      block.mesh.geometry = this.geos.mayaStair;
      block.mesh.material = this.limestoneMat;
    } else if (pieceType === 'crest') {
      block.mesh.geometry = slot ? this.geos.mayaCrest : this.geos.mayaCrestPreview;
      block.mesh.material = this.maya.materials.mayaStucco;
    } else if (pieceType === 'shrine' || pieceType === 'stucco') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.maya.materials.mayaStucco;
    } else if (pieceType === 'relief') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.maya.materials.mayaRelief;
    } else {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.limestoneMat;
    }
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyMayaPieceVisual(block, slot.pieceType, slot);
  }

  /* ============================================================================
   * 6. EMERALD-JADE & GOLDEN SUNBEAM CELEBRATION (+200 OR & +25 ÉCLATS)
   * ========================================================================== */
  _triggerCompletionSequence() {
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    const tc = this.pyramidCenter;
    const apexY = FOUNDATION_Y + 4 * BLOCK_H + 1.05;

    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(tc.x, apexY, tc.z - 0.35);

    // Emerald-jade & golden celestial sunbeams shining down onto the Temple of Kukulcán
    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.36, 1.38, 7.8, 18, 1, true));
    innerGeo.translate(0, 3.3, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffe486,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.74, 2.25, 7.4, 18, 1, true));
    outerGeo.translate(0, 3.1, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0x38e89e,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.68, 1.38, 28));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x4ef5ae,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.18;
    this.victoryGroup.add(this.victoryHalo);

    // Swirling emerald-jade & sun-gold firefly motes orbiting the summit temple
    const moteGeo = this._trackGeo(new THREE.OctahedronGeometry(0.085, 0));
    for (let i = 0; i < 32; i++) {
      const mote = new THREE.Mesh(
        moteGeo,
        i % 2 === 0 ? this.mats.jadeSpark : this.mats.dustGold
      );
      const ang = (i / 32) * Math.PI * 2;
      const rad = 1.15 + (i % 5) * 0.42;
      const yBase = -0.5 + (i % 6) * 0.52;
      mote.position.set(Math.cos(ang) * rad, yBase, Math.sin(ang) * rad);
      this.victoryGroup.add(mote);
      this.jadeMotes.push({
        mesh: mote,
        angle: ang,
        radius: rad,
        yBase,
        speed: 0.65 + (i % 4) * 0.2,
      });
    }

    this.root.add(this.victoryGroup);

    if (this.onComplete) {
      const goldMult = this.upgrades.royal_gold_stone ? 1.25 : 1.0;
      const rewardCoins = Math.round(Level4Maya.meta.rewardCoins * goldMult);
      this.onComplete({
        levelId: Level4Maya.meta.id,
        focusPoint: new THREE.Vector3(tc.x, FOUNDATION_Y + 2.0, tc.z),
        rewardCoins,
        firstCompletionTokens: Level4Maya.meta.firstCompletionTokens,
      });
    }
  }

  update(dt, elapsed) {
    super.update(dt, elapsed);

    for (let i = 0; i < this.jungleCanopies.length; i++) {
      const c = this.jungleCanopies[i];
      c.group.rotation.z = Math.sin(elapsed * 1.25 + c.phase) * 0.03;
    }

    if (this.crestJadeJewel && this.crestJadeJewel.visible) {
      this.crestJadeJewel.rotation.y = elapsed * 1.4;
    }

    for (let i = 0; i < this.jadeMotes.length; i++) {
      const m = this.jadeMotes[i];
      const ang = m.angle + elapsed * m.speed;
      const yOff = m.yBase + Math.sin(elapsed * 2.2 + i) * 0.35;
      m.mesh.position.set(Math.cos(ang) * m.radius, yOff, Math.sin(ang) * m.radius);
      m.mesh.rotation.y += dt * 2.4;
    }
  }

  dispose() {
    if (this.jungleCanopies) this.jungleCanopies.length = 0;
    if (this.jadeMotes) this.jadeMotes.length = 0;
    if (this.stuccoTrimMeshes) this.stuccoTrimMeshes.length = 0;
    this.crestJadeJewel = null;
    super.dispose();
  }
}
