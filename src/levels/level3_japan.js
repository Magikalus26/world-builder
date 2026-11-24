/**
 * Workd Builder — Level 3: Feudal Japan ("La Maison Ancienne Japonaise (Minka)" — 46 Blocks)
 * Sculpted 128x128 misty Japanese mountain garden terrain with 4-biome GPU splatting
 * (mossy emerald forest grass, raked white Zen gravel, crushed grey basalt quarry dust,
 * compacted dark earth), tranquil turquoise koi pond with arched lacquered wooden footbridge,
 * stylized 3D cherry blossom (sakura) trees, bamboo groves, granite Toro lanterns,
 * Basalt Quarry, Lacquered Wooden Handcarts, Master Carpenter & Stonemason Workshop,
 * and a 4-tier 46-block zero-gap connected Minka house with ishigaki stone foundation,
 * wrap-around cedar engawa veranda, glowing shoji lattice walls, dark cedar charpente beams,
 * and curved upturned-eave slate-blue kawara roof with carved onigawara ridge ornaments.
 */

import * as THREE from 'three';
import { Level1Pyramid } from './level1_pyramid.js';
import {
  createConnectedMasonryGeometry,
  createKawaraStraightRoofGeometry,
  createKawaraCornerRoofGeometry,
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
  buildStylizedSakuraTree,
} from '../foliageAndGround.js';

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const MINKA_STEP = BLOCK_W; // Exact zero-gap horizontal grid step matching block width/depth
const MINKA_CENTER = new THREE.Vector3(3.6, 0, -0.8);
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
 * Unified 128x128 Japanese mountain garden terrain heightfield.
 * Misty terraced hills around the perimeter, basalt quarry pit in NW,
 * tranquil koi pond basin in NE, and flat compacted pads under all 4 stations.
 */
function sampleJapanTerrainHeight(x, z) {
  const ridgeWave =
    Math.sin(x * 0.34 + z * 0.22 + 1.1) * 0.32 +
    Math.cos(x * 0.25 - z * 0.36) * 0.28 +
    Math.sin(x * 0.72 + z * 0.58) * 0.08;

  // Perimeter misty mountain terraces framing the Zen garden
  const edgeX = smoothstep(5.6, 10.0, Math.abs(x));
  const edgeZ = smoothstep(5.0, 9.4, Math.abs(z));
  const mountainRing = clamp01(Math.max(edgeX, edgeZ));
  const terraced = Math.floor(mountainRing * 3.5) * 0.14 + mountainRing * 1.15;
  let h = (0.2 + ridgeWave) * mountainRing + terraced * 0.62;

  // Flat compacted pads for the 4 gameplay stations
  const flatQuarryPad = rectFlatMask(x, z, -4.6, -3.15, 2.9, 1.35, 1.2);
  const flatTrackA = rectFlatMask(x, z, -4.6, 0.2, 1.45, 2.8, 1.05);
  const flatWorkshop = rectFlatMask(x, z, -4.6, 5.0, 2.75, 2.25, 1.25);
  const flatTrackB = rectFlatMask(x, z, -0.3, 4.75, 2.8, 1.4, 1.1);
  const flatPallet = rectFlatMask(x, z, 4.1, 4.75, 1.85, 1.65, 1.15);
  const flatMinka = rectFlatMask(x, z, MINKA_CENTER.x, MINKA_CENTER.z, 3.65, 3.65, 1.35);

  const flatMask = Math.max(
    flatQuarryPad,
    flatTrackA,
    flatWorkshop,
    flatTrackB,
    flatPallet,
    flatMinka
  );
  h *= 1.0 - flatMask;

  // Excavated dark basalt quarry pit in North-West
  const qDist = Math.hypot((x + 4.6) / 2.95, (z + 4.75) / 1.4);
  const qPit = 1.0 - smoothstep(0.62, 1.15, qDist);
  h -= qPit * 0.22;

  // Stepped mountain cliff backdrop behind the basalt quarry
  const cliffBack =
    smoothstep(-5.0, -7.2, z) * (1.0 - smoothstep(2.4, 5.4, Math.abs(x + 4.6)));
  h += cliffBack * 0.95;

  // Tranquil turquoise Koi Pond basin in North-East
  const pondDist = Math.hypot((x - 7.35) / 3.3, (z + 5.95) / 2.75);
  const pondMask = 1.0 - smoothstep(0.45, 1.05, pondDist);
  h = h * (1.0 - pondMask * 0.85) - pondMask * 0.62;

  return h;
}

/**
 * Computes 4-biome GPU splat weights for Level 3 Feudal Japan:
 *   x (sand slot)   = Mossy Emerald Forest Grass & Bamboo Soil
 *   y (path slot)   = Raked White Zen Gravel & Stepping-Stone Path
 *   z (quarry slot) = Crushed Grey Basalt Quarry Dust
 *   w (oasis slot)  = Compacted Dark Earth & Koi Pond Banks
 */
function computeJapanSplatWeights(x, z, h) {
  // Biome 2 (z): Crushed Grey Basalt Dust around NW quarry & SW workshop
  const quarryZone = 1.0 - smoothstep(2.2, 4.4, Math.hypot(x + 4.6, z + 4.4));
  const wsZone = 1.0 - smoothstep(2.1, 3.8, Math.hypot(x + 4.6, z - 5.0));
  const wBasalt = clamp01(Math.max(quarryZone, wsZone * 0.72));

  // Biome 1 (y): Raked White Zen Gravel court around Minka house & stepping-stone entrance path
  const dEntrance = segmentDist(x, z, 3.6, 2.2, 3.6, 4.75);
  const dGarden = segmentDist(x, z, 0.3, 4.4, 3.6, 2.4);
  const zenCourt = 1.0 - smoothstep(2.75, 4.45, Math.hypot(x - MINKA_CENTER.x, z - MINKA_CENTER.z));
  const zenPath = 1.0 - smoothstep(0.75, 1.85, Math.min(dEntrance, dGarden));
  const wZenGravel = clamp01(Math.max(zenCourt * 0.92, zenPath * 0.85));

  // Biome 3 (w): Compacted Dark Earth beneath timber transport tracks & damp koi pond banks
  const dTrackA = segmentDist(x, z, -4.6, -2.5, -4.6, 2.7);
  const dTrackB = segmentDist(x, z, -2.5, 4.75, 2.8, 4.75);
  const trackEarth = 1.0 - smoothstep(0.85, 1.9, Math.min(dTrackA, dTrackB));
  const pondBank = 1.0 - smoothstep(2.0, 3.7, Math.hypot(x - 7.35, z + 5.95));
  const wDarkEarth = clamp01(Math.max(trackEarth * 0.9, pondBank * 0.88));

  // Biome 0 (x): Lush Mossy Emerald Forest Grass across the hills & bamboo groves
  const used = clamp01(wBasalt * 0.95 + wZenGravel * 0.92 + wDarkEarth * 0.88);
  let w0 = Math.max(0.12, 1.0 - used);
  let w1 = wZenGravel * (1.0 - wDarkEarth * 0.5);
  let w2 = wBasalt * (1.0 - wZenGravel * 0.65);
  let w3 = wDarkEarth;

  const sum = w0 + w1 + w2 + w3;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(WATER_LEVEL - 0.04, WATER_LEVEL + 0.16, h);
  return { w0, w1, w2, w3, wetness };
}

/**
 * Compact curved slate-blue kawara roof tile preview for workbench carving & dragging.
 */
function createKawaraPreviewGeometry(width, height, depth) {
  const geo = new THREE.BoxGeometry(width, height, depth, 4, 1, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y > 0) {
      const t = (z + depth * 0.5) / depth; // 0 at outer eave, 1 at upper ridge
      // Gentle Japanese concave curve rising toward +Z
      pos.setY(i, height * 0.42 + Math.pow(t, 1.45) * 0.34);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Defines the 46-block, 4-tier Traditional Japanese Minka House Blueprint (zero-gap MINKA_STEP = 0.96):
 *   Tier 1 (16 blocks): Full 5x5 perimeter Carved Grey Foundation Stone (Ishigaki) + wrap-around cedar Engawa deck
 *   Tier 2 (14 blocks): Dark Cedar Timber & Glowing Rice-Paper Shoji Walls (front doorway [0,2] & back garden [0,-2] open)
 *   Tier 3 (8 blocks):  Dark-Stained Cedar Roof Framing Beams (4 corners, 2 side ties, 2 doorway lintels)
 *                       automatically bonding the 8 intermediate wall-plate beams into a continuous overhanging eaves ring
 *   Tier 4 (8 blocks):  4 Curved Slate-Blue Kawara Straight Bays + 4 Mitered 45° Upturned-Eave Corner Hip Tiles
 */
function buildMinkaBlueprintTiers() {
  // Tier 1: Full 5x5 perimeter Ishigaki stone foundation ring = 16 blocks
  const tier1 = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) === 2 || Math.abs(gz) === 2) {
        tier1.push({ dx: gx, dz: gz, pieceType: 'ishigaki', rotY: 0 });
      }
    }
  }

  // Tier 2: 14 connected Dark Cedar & Shoji Lattice Wall blocks (leaving recessed South entrance [0,2] & North garden [0,-2])
  const tier2 = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) !== 2 && Math.abs(gz) !== 2) continue;
      if (gx === 0 && (gz === 2 || gz === -2)) continue;
      tier2.push({ dx: gx, dz: gz, pieceType: 'shoji', rotY: 0 });
    }
  }

  // Tier 3: 8 Dark Cedar Timber Roof Framing & Lintel Beams (4 corners + 2 side ties + 2 doorway lintels)
  const tier3 = [
    [-2, -2], [0, -2], [2, -2],
    [-2, 0], [2, 0],
    [-2, 2], [0, 2], [2, 2],
  ].map(([dx, dz]) => ({ dx, dz, pieceType: 'beam', rotY: 0 }));

  // Tier 4: 8 Welded Curved Slate-Blue Kawara Roof Sections (4 straight bays + 4 upturned 45° hip corners)
  const tier4 = [
    { dx: -1, dz: -1, pieceType: 'kawara', roofVariant: 'corner', rotY: 0 }, // NW upturned hip
    { dx: 0, dz: -1, pieceType: 'kawara', roofVariant: 'straight', rotY: 0 }, // North slope
    { dx: 1, dz: -1, pieceType: 'kawara', roofVariant: 'corner', rotY: -Math.PI * 0.5 }, // NE upturned hip
    { dx: 1, dz: 0, pieceType: 'kawara', roofVariant: 'straight', rotY: -Math.PI * 0.5 }, // East slope
    { dx: 1, dz: 1, pieceType: 'kawara', roofVariant: 'corner', rotY: Math.PI }, // SE upturned hip
    { dx: 0, dz: 1, pieceType: 'kawara', roofVariant: 'straight', rotY: Math.PI }, // South slope
    { dx: -1, dz: 1, pieceType: 'kawara', roofVariant: 'corner', rotY: Math.PI * 0.5 }, // SW upturned hip
    { dx: -1, dz: 0, pieceType: 'kawara', roofVariant: 'straight', rotY: Math.PI * 0.5 }, // West slope
  ];

  return [tier1, tier2, tier3, tier4];
}

// 8 intermediate Tier 3 dark cedar wall-plate beams that bond automatically when adjacent Tier 3 beams lock in
const BEAM_BONDER_CELLS = [
  { dx: -1, dz: -2, triggers: [[-2, -2], [0, -2]] },
  { dx: 1, dz: -2, triggers: [[2, -2], [0, -2]] },
  { dx: -1, dz: 2, triggers: [[-2, 2], [0, 2]] },
  { dx: 1, dz: 2, triggers: [[2, 2], [0, 2]] },
  { dx: -2, dz: -1, triggers: [[-2, -2], [-2, 0]] },
  { dx: -2, dz: 1, triggers: [[-2, 2], [-2, 0]] },
  { dx: 2, dz: -1, triggers: [[2, -2], [2, 0]] },
  { dx: 2, dz: 1, triggers: [[2, 2], [2, 0]] },
];

export class Level3Japan extends Level1Pyramid {
  static meta = {
    id: 'level3_japan',
    title: 'Niveau 3 : La Maison Ancienne Japonaise (46 blocs)',
    hudLabel: 'Japon • Minka',
    skyColor: '#d7e7ec',
    totalGoal: 46,
    rewardCoins: 160,
    firstCompletionTokens: 20,
    solarPreset: 'japan_sakura_dawn',
  };

  constructor(opts) {
    super({
      ...opts,
      runConfig: null,
    });
    this.root.name = 'Level3JapanRoot';
    this.totalGoal = Level3Japan.meta.totalGoal;
    this.hudLabel = Level3Japan.meta.hudLabel;
  }

  _beforeBuild() {
    this.japan = this.textures.ensureJapanPack();
    this.totalGoal = Level3Japan.meta.totalGoal;
    this.hudLabel = Level3Japan.meta.hudLabel;
    this.beamBonders = new Map();
    this.eaveTrimMeshes = [];
    this.ridgeCrownGroup = null;
    this.sakuraCanopies = [];
    this.bambooGroves = [];
    this.koiFish = [];
    this.sakuraPetals = [];

    // Support Royal Gold Stone upgrade with subtle gilded sheen on Ishigaki stonework
    if (this.upgrades.royal_gold_stone) {
      const m = this._trackMat(this.japan.materials.ishigakiStone.clone());
      m.emissive = new THREE.Color('#5a4310');
      m.emissiveIntensity = 0.14;
      m.metalness = 0.2;
      this.ishigakiMat = m;
    } else {
      this.ishigakiMat = this.japan.materials.ishigakiStone;
    }
    this.carvedBlockMat = this.ishigakiMat;
  }

  _getRawBlockMaterial() {
    return this.japan.materials.rawBasalt;
  }

  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.038 };
  }

  _isConnectableMasonrySlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        !slot.isCapstone &&
        slot.pieceType !== 'kawara'
    );
  }

  _initSharedGeometries() {
    super._initSharedGeometries();

    // Override carved masonry block & ghost boxes to exact Level 3 height (BLOCK_H = 0.64)
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

    // Welded Curved Japanese Kawara Roof Geometries (compact workbench tile + straight & upturned 45° corner)
    const kawaraSpec = {
      tileStep: BLOCK_W,
      outerReach: 2.82, // Deep 0.42 overhanging traditional Japanese eaves past the ±2.40 Minka walls
      peakH: 1.64,
      eaveH: 0.14,
      cornerLift: 0.24,
      thickness: 0.14,
    };
    this.geos.kawaraPreview = this._trackGeo(
      createKawaraPreviewGeometry(BLOCK_W * 0.96, BLOCK_H * 0.65, BLOCK_D * 0.96)
    );
    this.geos.kawaraStraight = this._trackGeo(createKawaraStraightRoofGeometry(kawaraSpec));
    this.geos.kawaraCorner = this._trackGeo(createKawaraCornerRoofGeometry(kawaraSpec));

    this.geos.ghostKawaraStraight = this.geos.kawaraStraight;
    this.geos.ghostKawaraStraightEdges = this._trackGeo(
      new THREE.EdgesGeometry(this.geos.kawaraStraight, 24)
    );
    this.geos.ghostKawaraCorner = this.geos.kawaraCorner;
    this.geos.ghostKawaraCornerEdges = this._trackGeo(
      new THREE.EdgesGeometry(this.geos.kawaraCorner, 24)
    );

    // Cool grey basalt dust & warm cedar shaving particle tones
    this.mats.dustLimestone.color.set('#b8bec4');
    this.mats.dustSand.color.set('#d8d2c6');
    this.mats.sakuraPetal = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffc6d9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
  }

  getTerrainHeight(x, z) {
    return sampleJapanTerrainHeight(x * this.mirrorX, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 JAPANESE MOUNTAIN GARDEN, KOI POND, SAKURA & BAMBOO
   * ========================================================================== */
  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // Unified 128x128 sculpted Japanese mountain garden terrain mesh with 4-biome PBR splatting
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
      const h = sampleJapanTerrainHeight(sx, z);
      pos.setY(i, h);

      const { w0, w1, w2, w3, wetness } = computeJapanSplatWeights(sx, z, h);
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

    const terrainMesh = new THREE.Mesh(terrainGeo, this.japan.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    env.add(terrainMesh);

    // Contoured earthen/basalt island plinth skirt hugging terrain edges vertex-for-vertex
    const skirtGeo = this._buildContouredPlinthSkirt();
    const skirtMesh = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirtMesh.receiveShadow = true;
    env.add(skirtMesh);

    const bottomCapGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D));
    bottomCapGeo.rotateX(Math.PI / 2);
    const bottomCap = new THREE.Mesh(bottomCapGeo, this.textures.materials.plinth);
    bottomCap.position.y = -1.65;
    env.add(bottomCap);

    // Tranquil turquoise Koi Pond + arched red-lacquered wooden footbridge in North-East
    this._buildKoiPondAndBridge(env);

    // Stylized 3D Cherry Blossom (Sakura) Trees around the Zen garden & mountain slopes
    const sakuraSpecs = [
      [4.5, -7.2, 1.15],
      [8.2, -2.5, 1.02],
      [-7.9, 6.2, 1.05],
      [7.8, 5.9, 1.1],
      [-0.2, -7.6, 0.96],
    ];
    sakuraSpecs.forEach(([sx, sz, sc], idx) => {
      this._createSakuraTree(env, this._mx(sx), sz, sc, idx);
    });

    // Emerald Bamboo Groves framing the Western slope & koi pond edge
    const bambooSpecs = [
      [-8.35, -1.6, 1.08],
      [-8.1, 2.2, 0.96],
      [8.45, -7.4, 1.0],
      [1.8, -7.9, 0.94],
    ];
    bambooSpecs.forEach(([bx, bz, sc], idx) => {
      this._createBambooGrove(env, this._mx(bx), bz, sc, idx);
    });

    // Carved Granite Japanese Toro Stone Lanterns along the Zen path & pond edge
    const lanternSpecs = [
      [1.15, 2.45],
      [5.95, 2.55],
      [5.35, -4.45],
      [-1.85, 2.75],
    ];
    lanternSpecs.forEach(([lx, lz]) => {
      this._createStoneLantern(env, this._mx(lx), lz);
    });

    // Flat slate Zen garden stepping stones (tobi-ishi) across the raked white gravel path
    const stepGeo = this._trackGeo(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 7));
    [
      [3.6, 2.55],
      [3.52, 3.35],
      [3.72, 4.1],
      [2.6, 2.9],
      [1.65, 3.45],
      [0.75, 4.05],
    ].forEach(([sx, sz], i) => {
      const wx = this._mx(sx);
      const h = this.getTerrainHeight(wx, sz);
      const stone = new THREE.Mesh(stepGeo, this.japan.materials.ishigakiStone);
      stone.position.set(wx, h + 0.015, sz);
      stone.scale.set(1.15, 1, 0.85);
      stone.rotation.y = i * 0.7;
      stone.receiveShadow = true;
      env.add(stone);
    });

    // Cozy 3D Instanced Mossy Mountain Grass (1080 tufts), River Pebbles & Discreet Flowers
    const focalPoints = [
      ...sakuraSpecs.map(([sx, sz]) => ({ x: this._mx(sx), z: sz, innerRadius: 0.34, radius: 1.95 })),
      ...bambooSpecs.map(([bx, bz]) => ({ x: this._mx(bx), z: bz, innerRadius: 0.4, radius: 1.8 })),
      { x: this._mx(5.4), z: -4.8, innerRadius: 0.35, radius: 2.0 },
      { x: this._mx(7.1), z: -3.5, innerRadius: 0.35, radius: 1.95 },
    ];
    this.cozyGround = createCozyGroundFoliageSystem({
      parent: env,
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      isBlocked: (x, z) => this._isBlockedForFoliage(x, z),
      getGrassWeight: (x, z, y) => {
        const sx = x * this.mirrorX;
        const { w0: wMoss, w1: wGravel, w2: wBasalt, w3: wEarth } = computeJapanSplatWeights(sx, z, y);
        if (wGravel > 0.26 || wBasalt > 0.34) return 0;
        return Math.max(wMoss, wEarth * 0.55);
      },
      focalPoints,
      waterLevel: WATER_LEVEL,
      halfW: TERRAIN_W * 0.5,
      halfD: TERRAIN_D * 0.5,
      grassCount: 1080,
      pebbleCount: 118,
      flowerCount: 90,
      grassPalette: ['#4f913d', '#3e7834', '#68a645', '#8ab34a', '#356a2d'],
      pebblePalette: ['#85898d', '#9fa19d', '#6b7075', '#b5b2a6'],
      flowerPalette: ['#fffaf4', '#fff6dc', '#ffe266', '#ffd6e6'],
      seed: 303,
    });

    // Soft Circular Contact Shadows (AO) under Sakura, Bamboo, Lanterns, Quarry, Workshop & Minka
    const aoEntries = [
      ...sakuraSpecs.map(([sx, sz, sc]) => ({ x: this._mx(sx), z: sz, radius: 1.2 * sc, strength: 0.96 })),
      ...bambooSpecs.map(([bx, bz, sc]) => ({ x: this._mx(bx), z: bz, radius: 0.95 * sc, strength: 0.88 })),
      ...lanternSpecs.map(([lx, lz]) => ({ x: this._mx(lx), z: lz, radius: 0.45, strength: 0.92 })),
      { x: this._mx(-4.7), z: -5.2, radiusX: 3.3, radiusZ: 1.55, strength: 0.72 },
      { x: this._mx(-4.6), z: 4.15, radiusX: 2.35, radiusZ: 2.15, strength: 0.7 },
      { x: this.pyramidCenter.x, z: this.pyramidCenter.z, radiusX: 3.15, radiusZ: 3.15, strength: 0.78 },
    ];
    this.contactShadows = createContactShadowSystem(env, aoEntries, (x, z) => this.getTerrainHeight(x, z));
  }

  _buildKoiPondAndBridge(parent) {
    const px = this._mx(7.35);
    const pz = -5.95;

    // Shimmering turquoise koi pond surface
    const waterGeo = this._trackGeo(new THREE.CircleGeometry(3.15, 32));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.textures.materials.oasisWater);
    water.position.set(px, WATER_LEVEL, pz);
    water.scale.set(1.04, 1, 0.88);
    water.receiveShadow = true;
    parent.add(water);
    this.nileWaterMesh = water;

    // Mossy shoreline boulders bordering the koi pond
    const rockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.42, 0));
    [
      [4.95, -5.05, 1.2, 0.72, 1.0],
      [5.45, -7.1, 1.05, 0.65, 1.15],
      [6.85, -3.95, 0.95, 0.58, 0.9],
      [8.65, -4.6, 1.15, 0.75, 1.05],
      [7.85, -8.1, 1.25, 0.8, 1.1],
    ].forEach(([rx, rz, sx, sy, sz], i) => {
      const wx = this._mx(rx);
      const ry = this.getTerrainHeight(wx, rz);
      const rock = new THREE.Mesh(rockGeo, this.japan.materials.basaltCliff);
      rock.position.set(wx, ry + 0.12, rz);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(i * 0.3, i * 1.1, i * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      parent.add(rock);
    });

    // Floating emerald lily pads on the pond
    const padGeo = this._trackGeo(new THREE.CircleGeometry(0.24, 10, 0.25, Math.PI * 1.85));
    padGeo.rotateX(-Math.PI / 2);
    [
      [6.35, -5.6, 0.9],
      [6.75, -5.2, 1.1],
      [7.8, -6.55, 1.05],
      [8.2, -6.15, 0.82],
    ].forEach(([lx, lz, sc], i) => {
      const pad = new THREE.Mesh(padGeo, this.japan.materials.bambooLeaf);
      pad.position.set(this._mx(lx), WATER_LEVEL + 0.012, lz);
      pad.scale.setScalar(sc);
      pad.rotation.y = i * 1.6;
      parent.add(pad);
    });

    // 2 Graceful orange koi fish swimming in slow circles inside the pond
    const koiGeo = this._trackGeo(new THREE.ConeGeometry(0.08, 0.34, 6));
    koiGeo.rotateX(Math.PI / 2);
    for (let k = 0; k < 2; k++) {
      const koi = new THREE.Mesh(koiGeo, this.japan.materials.koiOrange);
      koi.position.set(px, WATER_LEVEL - 0.03, pz);
      parent.add(koi);
      this.koiFish.push({
        mesh: koi,
        cx: px,
        cz: pz,
        radius: 0.72 + k * 0.45,
        speed: 0.42 - k * 0.1,
        phase: k * Math.PI,
      });
    }

    // Small Arched Japanese Wooden Footbridge (Taikobashi) spanning the koi pond edge
    const bridge = new THREE.Group();
    bridge.position.set(this._mx(6.95), WATER_LEVEL + 0.06, -5.85);
    bridge.rotation.y = 0.58 * this.mirrorX;

    const plankGeo = this._trackGeo(new THREE.BoxGeometry(0.26, 0.065, 0.96));
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.038, 0.044, 0.52, 6));
    const capGeo = this._trackGeo(new THREE.SphereGeometry(0.055, 6, 6));
    const plankCount = 9;
    for (let i = 0; i < plankCount; i++) {
      const t = i / (plankCount - 1) - 0.5; // -0.5 .. +0.5
      const bx = t * 2.45;
      const archY = Math.cos(t * Math.PI) * 0.48;
      const tilt = -Math.sin(t * Math.PI) * 0.45;

      const plank = new THREE.Mesh(plankGeo, this.japan.materials.engawaDeck);
      plank.position.set(bx, archY, 0);
      plank.rotation.z = tilt;
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridge.add(plank);

      if (i % 2 === 0) {
        [-0.44, 0.44].forEach((rz) => {
          const post = new THREE.Mesh(postGeo, this.japan.materials.lacquerRed);
          post.position.set(bx, archY + 0.24, rz);
          post.castShadow = true;
          bridge.add(post);

          const finial = new THREE.Mesh(capGeo, this.textures.materials.capstoneGold);
          finial.position.set(bx, archY + 0.52, rz);
          bridge.add(finial);
        });
      }
    }

    // Curved red-lacquered bridge handrails
    const railSegGeo = this._trackGeo(new THREE.BoxGeometry(0.68, 0.055, 0.055));
    for (let s = 0; s < 4; s++) {
      const t = (s + 0.5) / 4 - 0.5;
      const rx = t * 2.45;
      const archY = Math.cos(t * Math.PI) * 0.48 + 0.42;
      const tilt = -Math.sin(t * Math.PI) * 0.45;
      [-0.44, 0.44].forEach((rz) => {
        const rail = new THREE.Mesh(railSegGeo, this.japan.materials.lacquerRed);
        rail.position.set(rx, archY, rz);
        rail.rotation.z = tilt;
        rail.castShadow = true;
        bridge.add(rail);
      });
    }
    parent.add(bridge);
  }

  _createSakuraTree(parent, x, z, scale = 1.0, idx = 0) {
    const groundY = this.getTerrainHeight(x, z);
    const { tree, crown } = buildStylizedSakuraTree({
      x,
      z,
      groundY,
      scale,
      seed: idx + 1,
      barkMat: this.japan.materials.sakuraTrunk,
      foliageMat: this._getSharedFoliageMaterial(),
      trackGeo: (g) => this._trackGeo(g),
    });
    parent.add(tree);
    this.sakuraCanopies.push({ group: crown, phase: idx * 1.4 });
  }

  _createBambooGrove(parent, x, z, scale = 1.0, idx = 0) {
    const grove = new THREE.Group();
    const y = this.getTerrainHeight(x, z);
    grove.position.set(x, y - 0.04, z);
    grove.scale.setScalar(scale);

    const stalkGeo = this._trackGeo(new THREE.CylinderGeometry(0.055, 0.072, 2.4, 6));
    const leafGeo = this._trackGeo(new THREE.ConeGeometry(0.24, 0.58, 5));
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2 + idx * 0.5;
      const rad = 0.24 + (b % 3) * 0.24;
      const hScale = 0.78 + (b % 3) * 0.22;
      const bx = Math.cos(ang) * rad;
      const bz = Math.sin(ang) * rad;

      const stalk = new THREE.Mesh(stalkGeo, this.japan.materials.bambooStalk);
      stalk.position.set(bx, 1.18 * hScale, bz);
      stalk.scale.y = hScale;
      stalk.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.05;
      stalk.castShadow = true;
      grove.add(stalk);

      const leaf = new THREE.Mesh(leafGeo, this.japan.materials.bambooLeaf);
      leaf.position.set(bx, 2.38 * hScale, bz);
      leaf.castShadow = true;
      grove.add(leaf);
    }
    parent.add(grove);
    this.bambooGroves.push({ group: grove, phase: idx * 1.7 });
  }

  _createStoneLantern(parent, x, z) {
    const lantern = new THREE.Group();
    const y = this.getTerrainHeight(x, z);
    lantern.position.set(x, y, z);

    const base = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 0.16, 6)),
      this.japan.materials.lanternStone
    );
    base.position.y = 0.08;
    base.castShadow = true;
    lantern.add(base);

    const pillar = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.1, 0.13, 0.52, 6)),
      this.japan.materials.lanternStone
    );
    pillar.position.y = 0.4;
    pillar.castShadow = true;
    lantern.add(pillar);

    const firebox = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.22, 0.24, 0.22)),
      this.japan.materials.lanternGlow
    );
    firebox.position.y = 0.78;
    lantern.add(firebox);

    const cap = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.34, 0.22, 6)),
      this.japan.materials.lanternStone
    );
    cap.position.y = 1.0;
    cap.castShadow = true;
    lantern.add(cap);

    parent.add(lantern);
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE GRANIT & PIERRE VOLCANIQUE (NORTH-WEST)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    // Stepped dark volcanic basalt quarry cliff behind the 3 extractable rock nodes
    const cliffLayers = [
      { pos: [-4.6, 0.56, -6.15], size: [5.4, 1.32, 1.95] },
      { pos: [-5.1, 1.38, -6.48], size: [3.7, 0.85, 1.25] },
      { pos: [-3.2, 0.92, -6.28], size: [2.3, 0.92, 1.35] },
    ];
    cliffLayers.forEach((c) => {
      const geo = this._trackGeo(new THREE.BoxGeometry(...c.size));
      const mesh = new THREE.Mesh(geo, this.japan.materials.basaltCliff);
      mesh.position.set(this._mx(c.pos[0]), c.pos[1], c.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      quarryGroup.add(mesh);
    });

    // Dark cedar timber pulley gantry over basalt cliff
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8));
    const post = new THREE.Mesh(postGeo, this.japan.materials.cedarBeam);
    post.position.set(this._mx(-3.0), 1.48, -6.2);
    post.castShadow = true;
    quarryGroup.add(post);

    const beam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.65, 0.12, 0.12)),
      this.japan.materials.cedarBeam
    );
    beam.position.set(this._mx(-3.55), 2.06, -5.95);
    beam.rotation.y = 0.25 * this.mirrorX;
    beam.castShadow = true;
    quarryGroup.add(beam);

    // 3 Extractable Volcanic Basalt Rock Nodes nestled into the quarry pit
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

      const mat = this._trackMat(this.japan.materials.rawBasalt.clone());
      mat.emissive = new THREE.Color(0x1f252e);
      mat.emissiveIntensity = 0.1;

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

    // Basalt Quarry Output Pad (5 slots for Raw Volcanic Basalt Blocks)
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.6, 0.14, 1.35)),
      this.japan.materials.ishigakiStone
    );
    pad.position.set(this._mx(-4.6), 0.07, -3.15);
    pad.receiveShadow = true;
    pad.raycast = () => {};
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
        occupied: false,
        block: null,
      });
    }
  }

  /* ============================================================================
   * 2b. ZONE 2 — LE CHARIOT EN BOIS LAQUÉ SUR RAILS (WEST & CENTER)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();
    // Apply traditional Japanese dark-cedar & vermilion-lacquer trim to the handcarts
    this.sleds.forEach((sled) => {
      if (!sled.group) return;
      sled.group.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (child.material === this.textures.materials.timber) {
          child.material = this.japan.materials.lacquerRed;
        } else if (child.material === this.textures.materials.timberDark) {
          child.material = this.japan.materials.cedarBeam;
        }
      });
    });
  }

  /* ============================================================================
   * 3. ZONE 3 — L'ATELIER DU MAÎTRE CHARPENTIER & TAILLEUR (SOUTH-WEST)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    this.root.add(ws);

    const cx = this._mx(-4.6);
    const cz = 5.0;

    // Granite & timber workshop floor pad
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.4, 0.14, 3.2)),
      this.japan.materials.ishigakiStone
    );
    floor.position.set(cx, 0.07, cz);
    floor.receiveShadow = true;
    ws.add(floor);

    // Decorative open-courtyard frame: 2 tall rear cedar posts + 2 lower front corner posts
    // Keeps full Japanese carpenter workshop silhouette while leaving the workbench 100% unobstructed from above!
    const frameGroup = new THREE.Group();
    ws.add(frameGroup);

    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.32));
    const rearPostGeo = this._trackGeo(new THREE.CylinderGeometry(0.085, 0.1, 2.22, 8));
    const frontPostGeo = this._trackGeo(new THREE.CylinderGeometry(0.08, 0.095, 1.32, 8));
    const postCapGeo = this._trackGeo(new THREE.BoxGeometry(0.24, 0.08, 0.24));

    [
      [cx - 1.85, cz - 1.28, true],
      [cx + 1.85, cz - 1.28, true],
      [cx - 1.85, cz + 1.28, false],
      [cx + 1.85, cz + 1.28, false],
    ].forEach(([px, pz, isRear]) => {
      const plinth = new THREE.Mesh(plinthGeo, this.japan.materials.basaltCliff);
      plinth.position.set(px, 0.22, pz);
      plinth.castShadow = true;
      frameGroup.add(plinth);

      const post = new THREE.Mesh(isRear ? rearPostGeo : frontPostGeo, this.japan.materials.cedarBeam);
      post.position.set(px, isRear ? 1.42 : 0.96, pz);
      post.castShadow = true;
      frameGroup.add(post);

      if (!isRear) {
        const cap = new THREE.Mesh(postCapGeo, this.japan.materials.kawaraRoof);
        cap.position.set(px, 1.66, pz);
        frameGroup.add(cap);
      }
    });

    // Cutaway / Open-Front Slate-Blue Kawara Eaves Awning (covers ONLY back ~35% behind workbench)
    const canopyGroup = new THREE.Group();
    canopyGroup.position.set(cx, 2.48, cz);

    // Rear cedar header girder & decorative open side eaves beams framing the open workbench bay
    const rearGirder = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.2, 0.15, 0.16)),
      this.japan.materials.cedarBeam
    );
    rearGirder.position.set(0, 0.04, -1.28);
    rearGirder.castShadow = true;
    canopyGroup.add(rearGirder);

    const sideRailGeo = this._trackGeo(new THREE.BoxGeometry(0.11, 0.12, 1.05));
    [-1.85, 1.85].forEach((ox) => {
      const rail = new THREE.Mesh(sideRailGeo, this.japan.materials.cedarBeam);
      rail.position.set(ox, 0.04, -1.22);
      rail.castShadow = true;
      canopyGroup.add(rail);
    });

    // Overhanging dark slate-blue Kawara tiled rear awning slope (z in [-1.72, -0.76] — completely clear of workbench!)
    const awningRoof = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.52, 0.13, 0.98)),
      this.japan.materials.kawaraRoof
    );
    awningRoof.position.set(0, 0.24, -1.24);
    awningRoof.rotation.x = -0.28;
    awningRoof.castShadow = true;
    canopyGroup.add(awningRoof);

    // Carved ridge trim & twin subtle Onigawara corner accents along top edge of rear awning
    const ridgeCap = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.42, 0.14, 0.16)),
      this.japan.materials.kawaraRoof
    );
    ridgeCap.position.set(0, 0.42, -0.82);
    ridgeCap.castShadow = true;
    canopyGroup.add(ridgeCap);

    // Red-lacquered Japanese Noren valance tucked cleanly under the back eaves behind the workbench
    const noren = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.48, 0.24, 0.05)),
      this.japan.materials.lacquerRed
    );
    noren.position.set(0, -0.06, -0.84);
    canopyGroup.add(noren);

    // Disable raycast hit-testing on ALL decorative workshop roof eaves & framing meshes
    // so touching/dragging stone blocks on the workbench NEVER collides with the canopy
    const noopRaycast = () => {};
    frameGroup.traverse((child) => {
      if (child.isMesh) child.raycast = noopRaycast;
    });
    canopyGroup.traverse((child) => {
      if (child.isMesh) child.raycast = noopRaycast;
    });

    this.canopyMesh = canopyGroup;
    ws.add(canopyGroup);

    // Master Carpenter & Stonemason Cedar/Granite Workbench
    const wbX = cx - this._mx(0.55);
    const wbZ = cz - 0.12;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.58, 0.62, 1.38)),
      this.japan.materials.cedarBeam
    );
    benchBase.position.set(wbX, 0.44, wbZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.72, 0.14, 1.52)),
      this.japan.materials.engawaDeck
    );
    benchTop.position.set(wbX, 0.8, wbZ);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    ws.add(benchTop);

    // Carpenter's wooden mallet & Japanese nomi chisel resting on workbench
    const malletHandle = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6)),
      this.japan.materials.engawaDeck
    );
    malletHandle.position.set(wbX - this._mx(0.6), 0.91, wbZ + 0.46);
    malletHandle.rotation.set(Math.PI / 2, 0.35, 0);
    ws.add(malletHandle);

    const malletHead = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.14, 0.14, 0.24)),
      this.japan.materials.cedarBeam
    );
    malletHead.position.set(wbX - this._mx(0.67), 0.93, wbZ + 0.3);
    ws.add(malletHead);

    const chiselMat = this.upgrades.golden_chisel
      ? this.textures.materials.capstoneGold
      : this.japan.materials.lanternStone;
    const chisel = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.36)), chiselMat);
    chisel.position.set(wbX + this._mx(0.62), 0.9, wbZ - 0.42);
    chisel.rotation.y = -0.38;
    ws.add(chisel);

    // Workbench active crafting slot
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

    // Generous invisible carve-swipe hitbox over workbench
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.9, 1.35, 1.9));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(wbX, wbY + 0.45, wbZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Diegetic Glowing Crafting Progress Pips above workbench
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.095, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshBasicMaterial({ color: 0xffd5e4, transparent: true, opacity: 0.35 })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(wbX + (i - 1) * 0.32, wbY + 1.24, wbZ);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Finished Piece Output Slots (right side of Workshop patio)
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
   * 4. ZONE 4 — CHANTIER DE LA MAISON ANCIENNE JAPONAISE (MINKA — 46 BLOCKS)
   * ========================================================================== */
  _buildPyramidSite() {
    const site = new THREE.Group();
    this.root.add(site);

    const mc = this.pyramidCenter;

    // Raised Zen garden grey granite foundation pad under the Minka house
    const basePlatform = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.9, FOUNDATION_Y, 5.9)),
      this.japan.materials.basaltCliff
    );
    basePlatform.position.set(mc.x, FOUNDATION_Y * 0.5, mc.z);
    basePlatform.receiveShadow = true;
    basePlatform.castShadow = true;
    site.add(basePlatform);

    // Wrap-around warm honey-cedar Engawa veranda deck framing the 4.80x4.80 Minka footprint
    const engawaDeck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.56, 0.12, 5.56)),
      this.japan.materials.engawaDeck
    );
    engawaDeck.position.set(mc.x, FOUNDATION_Y + 0.06, mc.z);
    engawaDeck.receiveShadow = true;
    engawaDeck.castShadow = true;
    site.add(engawaDeck);

    // Recessed traditional dark-cedar entrance threshold & tatami interior floor at Tier 1 top
    const tatamiFloor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.84, BLOCK_H, 3.84)),
      this.japan.materials.engawaDeck
    );
    tatamiFloor.position.set(mc.x, FOUNDATION_Y + BLOCK_H * 0.5, mc.z);
    tatamiFloor.receiveShadow = true;
    site.add(tatamiFloor);

    // Granite shoe-removal step stone (Kutsunugi-ishi) at the front South entrance
    const stepStone = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.18, 0.18, 0.56)),
      this.japan.materials.ishigakiStone
    );
    stepStone.position.set(mc.x, FOUNDATION_Y * 0.5 + 0.04, mc.z + 2.98);
    stepStone.receiveShadow = true;
    stepStone.castShadow = true;
    site.add(stepStone);

    // Recessed warm backlit wooden sliding doorway panels tucked inside front & back entrance thresholds
    const doorGeo = this._trackGeo(new THREE.BoxGeometry(0.92, BLOCK_H * 0.96, 0.12));
    [2.0, -2.0].forEach((dz) => {
      const door = new THREE.Mesh(doorGeo, this.japan.materials.shojiWall);
      door.position.set(mc.x, FOUNDATION_Y + BLOCK_H * 1.5, mc.z + dz * MINKA_STEP * 0.86);
      door.castShadow = true;
      door.receiveShadow = true;
      site.add(door);
    });

    // Aura du Pyramidion upgrade support
    if (this.upgrades.pyramidion_aura) {
      const auraGeo = this._trackGeo(new THREE.RingGeometry(3.32, 3.62, 40));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffd75e,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      this.auraRingMesh = new THREE.Mesh(auraGeo, auraMat);
      this.auraRingMesh.position.set(mc.x, FOUNDATION_Y + 0.025, mc.z);
      site.add(this.auraRingMesh);
    }

    // Staging Pallet beside Track B end (2x2 = 4 slots)
    const palletX = this._mx(4.1);
    const palletZ = 4.75;
    const pallet = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.35, 0.14, 2.35)),
      this.japan.materials.engawaDeck
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

    // Pre-build 8 automatic Tier 3 Dark Cedar Wall-Plate Bonding Beams so the wooden roof framing forms a 100% solid ring
    const tier3CenterY = FOUNDATION_Y + 2 * BLOCK_H + BLOCK_H * 0.5;
    BEAM_BONDER_CELLS.forEach((spec) => {
      const wx = mc.x + spec.dx * MINKA_STEP;
      const wz = mc.z + spec.dz * MINKA_STEP;
      const mesh = new THREE.Mesh(this.geos.carvedBlock, this.japan.materials.cedarBeam);
      mesh.position.set(wx, tier3CenterY, wz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      site.add(mesh);

      const key = this._gridKey(spec.dx, 2, spec.dz);
      this.beamBonders.set(key, {
        gridX: spec.dx,
        layer: 2,
        gridZ: spec.dz,
        triggers: spec.triggers,
        mesh,
        active: false,
        masonryMask: -1,
      });
    });

    // Cantilevered dark cedar eaves bracket band (degumi) revealed as Tier 3 charpente completes
    const trimY = FOUNDATION_Y + 3 * BLOCK_H - 0.05;
    const trimLen = 5 * BLOCK_W + 0.34;
    const trimH = 0.11;
    const trimThick = 0.18;
    const trimEdge = 2.5 * BLOCK_W + 0.08;
    const trimNSGeo = this._trackGeo(new THREE.BoxGeometry(trimLen, trimH, trimThick));
    const trimEWGeo = this._trackGeo(new THREE.BoxGeometry(trimThick, trimH, trimLen));
    [
      [trimNSGeo, 0, -trimEdge],
      [trimNSGeo, 0, trimEdge],
      [trimEWGeo, -trimEdge, 0],
      [trimEWGeo, trimEdge, 0],
    ].forEach(([geo, ox, oz]) => {
      const m = new THREE.Mesh(geo, this.japan.materials.cedarBeam);
      m.position.set(mc.x + ox, trimY, mc.z + oz);
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      site.add(m);
      this.eaveTrimMeshes.push(m);
    });

    // Carved Dark Slate-Blue Ridge Beam (Mune) & Twin Sculpted Onigawara End-Cap Finials (revealed on roof completion!)
    const ridgeGroup = new THREE.Group();
    ridgeGroup.position.set(mc.x, FOUNDATION_Y + 3 * BLOCK_H + 1.54, mc.z);
    const mainRidge = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.18, 0.26, 0.24)),
      this.japan.materials.kawaraRoof
    );
    mainRidge.castShadow = true;
    ridgeGroup.add(mainRidge);

    // Subtle white plaster-trimmed ridge highlight strip
    const ridgeTrim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.12, 0.06, 0.27)),
      this.japan.materials.lanternStone
    );
    ridgeTrim.position.y = -0.02;
    ridgeGroup.add(ridgeTrim);

    // Twin upturned sculpted Onigawara roof ornaments at East & West ridge ends
    const oniGeo = this._trackGeo(new THREE.ConeGeometry(0.18, 0.42, 4));
    [-0.62, 0.62].forEach((ox) => {
      const oni = new THREE.Mesh(oniGeo, this.japan.materials.kawaraRoof);
      oni.position.set(ox, 0.16, 0);
      oni.rotation.z = ox < 0 ? 0.28 : -0.28;
      oni.castShadow = true;
      ridgeGroup.add(oni);
    });
    ridgeGroup.visible = false;
    site.add(ridgeGroup);
    this.ridgeCrownGroup = ridgeGroup;

    // Build all 46 progressive zero-gap blueprint slots across the 4 Minka tiers
    const tiers = buildMinkaBlueprintTiers();
    this.maxLayerIndex = tiers.length - 1;
    let slotIdx = 0;

    tiers.forEach((tierCells, layer) => {
      const layerBaseY = FOUNDATION_Y + layer * BLOCK_H;

      tierCells.forEach((cell, cellIdx) => {
        const wx = mc.x + cell.dx * MINKA_STEP;
        const wz = mc.z + cell.dz * MINKA_STEP;
        const isKawara = cell.pieceType === 'kawara';
        const isCornerRoof = isKawara && cell.roofVariant === 'corner';

        const centerY = isKawara ? layerBaseY : layerBaseY + BLOCK_H * 0.5;

        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(wx, centerY + 0.02, wz);
        ghostGroup.rotation.y = cell.rotY || 0;

        const gGeo = isKawara
          ? isCornerRoof
            ? this.geos.ghostKawaraCorner
            : this.geos.ghostKawaraStraight
          : this.geos.ghostBox;
        const gEdges = isKawara
          ? isCornerRoof
            ? this.geos.ghostKawaraCornerEdges
            : this.geos.ghostKawaraStraightEdges
          : this.geos.ghostBoxEdges;

        const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
        ghostMesh.renderOrder = 5;
        const ghostLines = new THREE.LineSegments(gEdges, this.mats.ghostLineNormal);
        ghostLines.renderOrder = 6;
        ghostGroup.add(ghostMesh);
        ghostGroup.add(ghostLines);
        ghostGroup.visible = layer === 0;
        site.add(ghostGroup);

        const slot = {
          id: `minka_L${layer}_${cellIdx}`,
          index: slotIdx++,
          zoneType: 'pyramid',
          layer,
          gridX: cell.dx,
          gridZ: cell.dz,
          isCapstone: false,
          pieceType: cell.pieceType,
          roofVariant: cell.roofVariant || null,
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

    this.totalGoal = this.pyramidSlots.length; // 46 blocks
  }

  /* ============================================================================
   * 5. CONNECTED JAPANESE MASONRY, CHARPENTE BEAM BONDING & WELDED KAWARA ROOF
   * ========================================================================== */
  _hasOccupiedMinkaBlockAt(gx, layer, gz, matchPieceType = null) {
    const slot = this._getGridSlot(gx, layer, gz);
    if (this._isConnectableMasonrySlot(slot)) {
      if (!matchPieceType || slot.pieceType === matchPieceType) return true;
    }
    const bonder = this.beamBonders ? this.beamBonders.get(this._gridKey(gx, layer, gz)) : null;
    if (bonder && bonder.active) {
      if (!matchPieceType || matchPieceType === 'beam') return true;
    }
    return false;
  }

  _computeMasonryNeighborMask(slot) {
    if (!this._isConnectableMasonrySlot(slot)) return 0;
    const { gridX: gx, layer, gridZ: gz, pieceType } = slot;
    let mask = 0;

    // Horizontal bonding connects flush within the same tier's material (ishigaki / shoji / beam)
    if (this._hasOccupiedMinkaBlockAt(gx + 1, layer, gz, pieceType)) mask |= NEIGHBOR_PX;
    if (this._hasOccupiedMinkaBlockAt(gx - 1, layer, gz, pieceType)) mask |= NEIGHBOR_NX;
    if (this._hasOccupiedMinkaBlockAt(gx, layer, gz + 1, pieceType)) mask |= NEIGHBOR_PZ;
    if (this._hasOccupiedMinkaBlockAt(gx, layer, gz - 1, pieceType)) mask |= NEIGHBOR_NZ;

    // Vertical bonding flattens horizontal seam creases between stacked foundation -> shoji -> cedar beams
    if (this._hasOccupiedMinkaBlockAt(gx, layer + 1, gz, null)) mask |= NEIGHBOR_PY;
    if (layer > 0 && this._hasOccupiedMinkaBlockAt(gx, layer - 1, gz, null)) mask |= NEIGHBOR_NY;

    return mask;
  }

  _refreshBeamBonderGeometry(bonder) {
    if (!bonder || !bonder.active) return;
    const { gridX: gx, layer, gridZ: gz } = bonder;
    let mask = 0;
    if (this._hasOccupiedMinkaBlockAt(gx + 1, layer, gz, 'beam')) mask |= NEIGHBOR_PX;
    if (this._hasOccupiedMinkaBlockAt(gx - 1, layer, gz, 'beam')) mask |= NEIGHBOR_NX;
    if (this._hasOccupiedMinkaBlockAt(gx, layer, gz + 1, 'beam')) mask |= NEIGHBOR_PZ;
    if (this._hasOccupiedMinkaBlockAt(gx, layer, gz - 1, 'beam')) mask |= NEIGHBOR_NZ;
    if (this._hasOccupiedMinkaBlockAt(gx, layer - 1, gz, null)) mask |= NEIGHBOR_NY;

    if (bonder.masonryMask === mask) return;
    bonder.masonryMask = mask;
    const { w, h, d, bevel } = this._getMasonryBlockDimensions();
    bonder.mesh.geometry = this.masonryCache.getBlockGeometry(w, h, d, mask, bevel);
  }

  _onConnectedMasonryUpdated(slot) {
    if (!this.beamBonders || !slot) return;

    // Activate any Tier 3 intermediate cedar wall-plate beam once an adjacent Tier 3 beam locks in
    let anyBonderChanged = false;
    this.beamBonders.forEach((bonder) => {
      if (!bonder.active) {
        const wallBelow = this._hasOccupiedMinkaBlockAt(bonder.gridX, 1, bonder.gridZ, null);
        const adjacentBeam = bonder.triggers.some(([tx, tz]) =>
          this._hasOccupiedMinkaBlockAt(tx, 2, tz, 'beam')
        );
        if (wallBelow && adjacentBeam) {
          bonder.active = true;
          bonder.mesh.visible = true;
          this._triggerSquashBounce(bonder.mesh, 1.08, 0.92);
          anyBonderChanged = true;
        }
      }
      if (bonder.active) {
        this._refreshBeamBonderGeometry(bonder);
      }
    });

    if (anyBonderChanged) {
      this.beamBonders.forEach((bonder) => {
        if (!bonder.active) return;
        const { gridX: gx, layer, gridZ: gz } = bonder;
        [
          this._getGridSlot(gx + 1, layer, gz),
          this._getGridSlot(gx - 1, layer, gz),
          this._getGridSlot(gx, layer, gz + 1),
          this._getGridSlot(gx, layer, gz - 1),
          this._getGridSlot(gx, layer - 1, gz),
        ].forEach((nb) => {
          if (nb) this._applyConnectedMasonry(nb);
        });
      });
    }

    // Reveal cantilevered dark cedar eaves bracket ring when Tier 3 charpente completes
    const tier3Done = this.pyramidSlots
      .filter((s) => s.layer === 2)
      .every((s) => Boolean(s.block));
    if (tier3Done && this.eaveTrimMeshes.length > 0 && !this.eaveTrimMeshes[0].visible) {
      this.eaveTrimMeshes.forEach((m) => {
        m.visible = true;
      });
    }

    // Reveal crowning dark slate-blue ridge beam & twin Onigawara ornaments when Tier 4 roof completes
    const tier4Done = this.pyramidSlots
      .filter((s) => s.layer === 3)
      .every((s) => Boolean(s.block));
    if (tier4Done && this.ridgeCrownGroup && !this.ridgeCrownGroup.visible) {
      this.ridgeCrownGroup.visible = true;
      this._triggerSquashBounce(this.ridgeCrownGroup, 1.12, 0.88);
    }
  }

  _shouldForgeCapstone() {
    // Level 3 finishes with curved Kawara roof tiles & Onigawara ridge beam
    return false;
  }

  _pickNextCarvedPieceType() {
    const remaining = this.pyramidSlots.filter((s) => s.layer === this.activeLayer && !s.block);
    if (remaining.some((s) => s.pieceType === 'kawara')) return 'kawara';
    if (remaining.some((s) => s.pieceType === 'beam')) return 'beam';
    if (remaining.some((s) => s.pieceType === 'shoji')) return 'shoji';
    return 'ishigaki';
  }

  _resolveCarvingTargetMaterial() {
    const pieceType = this._pickNextCarvedPieceType();
    if (pieceType === 'kawara') return this.japan.materials.kawaraRoof;
    if (pieceType === 'beam') return this.japan.materials.cedarBeam;
    if (pieceType === 'shoji') return this.japan.materials.shojiWall;
    return this.carvedBlockMat;
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyJapanPieceVisual(block, pieceType, null);
    }
    return stillRaw;
  }

  _applyJapanPieceVisual(block, pieceType, slot = null) {
    block.pieceType = pieceType;
    if (pieceType === 'kawara') {
      if (slot) {
        block.mesh.geometry =
          slot.roofVariant === 'corner'
            ? this.geos.kawaraCorner
            : this.geos.kawaraStraight;
      } else {
        block.mesh.geometry = this.geos.kawaraPreview;
      }
      block.mesh.material = this.japan.materials.kawaraRoof;
    } else if (pieceType === 'beam') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.japan.materials.cedarBeam;
    } else if (pieceType === 'shoji') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.japan.materials.shojiWall;
    } else {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.ishigakiMat;
    }
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyJapanPieceVisual(block, slot.pieceType, slot);
  }

  /* ============================================================================
   * 6. SAKURA PETAL & GOLDEN SUNBEAM CELEBRATION (+160 OR & +20 ÉCLATS)
   * ========================================================================== */
  _triggerCompletionSequence() {
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    const mc = this.pyramidCenter;
    const apexY = FOUNDATION_Y + 3 * BLOCK_H + 1.85;

    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(mc.x, apexY, mc.z);

    // Gentle sunlit golden mountain rays descending over the Minka ridge
    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.36, 1.35, 7.6, 18, 1, true));
    innerGeo.translate(0, 3.2, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffe8b0,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.72, 2.15, 7.2, 18, 1, true));
    outerGeo.translate(0, 3.0, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffc8dc,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.65, 1.35, 28));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffd2e2,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.15;
    this.victoryGroup.add(this.victoryHalo);

    // Swirling Sakura cherry blossom petals drifting gracefully around the finished Japanese house
    const petalGeo = this._trackGeo(new THREE.PlaneGeometry(0.16, 0.11));
    for (let i = 0; i < 36; i++) {
      const petal = new THREE.Mesh(petalGeo, this.mats.sakuraPetal);
      const angle = (i / 36) * Math.PI * 2;
      const radius = 1.2 + (i % 6) * 0.45;
      const yStart = 0.2 + (i % 7) * 0.55;
      petal.position.set(Math.cos(angle) * radius, yStart, Math.sin(angle) * radius);
      petal.rotation.set(i * 0.5, i * 0.8, i * 0.3);
      this.victoryGroup.add(petal);
      this.sakuraPetals.push({
        mesh: petal,
        angle,
        radius,
        yBase: yStart,
        speed: 0.55 + (i % 4) * 0.18,
        fallSpeed: 0.48 + (i % 3) * 0.16,
      });
    }

    this.root.add(this.victoryGroup);

    if (this.onComplete) {
      const goldMult = this.upgrades.royal_gold_stone ? 1.25 : 1.0;
      const rewardCoins = Math.round(Level3Japan.meta.rewardCoins * goldMult);
      this.onComplete({
        levelId: Level3Japan.meta.id,
        focusPoint: new THREE.Vector3(mc.x, FOUNDATION_Y + 1.8, mc.z),
        rewardCoins,
        firstCompletionTokens: Level3Japan.meta.firstCompletionTokens,
      });
    }
  }

  update(dt, elapsed) {
    super.update(dt, elapsed);

    // Gentle mountain breeze on Sakura blossom canopies & Bamboo groves
    for (let i = 0; i < this.sakuraCanopies.length; i++) {
      const c = this.sakuraCanopies[i];
      c.group.rotation.z = Math.sin(elapsed * 1.35 + c.phase) * 0.032;
    }
    for (let i = 0; i < this.bambooGroves.length; i++) {
      const b = this.bambooGroves[i];
      b.group.rotation.z = Math.sin(elapsed * 1.7 + b.phase) * 0.04;
    }

    // Peaceful circular swimming animation for koi fish in the NE pond
    for (let i = 0; i < this.koiFish.length; i++) {
      const k = this.koiFish[i];
      const ang = elapsed * k.speed + k.phase;
      k.mesh.position.x = k.cx + Math.cos(ang) * k.radius;
      k.mesh.position.z = k.cz + Math.sin(ang) * k.radius * 0.78;
      k.mesh.rotation.y = -ang;
    }

    // Swirling sakura cherry blossom petals during completion celebration
    for (let i = 0; i < this.sakuraPetals.length; i++) {
      const p = this.sakuraPetals[i];
      const ang = p.angle + elapsed * p.speed;
      const yOff = ((p.yBase - elapsed * p.fallSpeed) % 3.6 + 3.6) % 3.6 - 1.5;
      p.mesh.position.set(
        Math.cos(ang) * p.radius,
        yOff,
        Math.sin(ang) * p.radius
      );
      p.mesh.rotation.x += dt * 1.9;
      p.mesh.rotation.y += dt * 1.3;
    }
  }

  dispose() {
    if (this.beamBonders) this.beamBonders.clear();
    if (this.eaveTrimMeshes) this.eaveTrimMeshes.length = 0;
    if (this.sakuraCanopies) this.sakuraCanopies.length = 0;
    if (this.bambooGroves) this.bambooGroves.length = 0;
    if (this.koiFish) this.koiFish.length = 0;
    if (this.sakuraPetals) this.sakuraPetals.length = 0;
    this.ridgeCrownGroup = null;
    super.dispose();
  }
}
