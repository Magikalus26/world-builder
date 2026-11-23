/**
 * Workd Builder — Level 2: Ancient Rome ("La Domus Romaine Classique" — 48 Blocks)
 * Sculpted 128x128 Mediterranean Tuscan/Latium terrain with multi-layer PBR splatting
 * (olive-green grass & wildflowers, cobblestone Roman Via road, crushed travertine dust,
 * turquoise Roman cistern), Italian cypresses, terracotta amphorae, Travertine Marble Quarry,
 * Roman Cargo Sleds, Pergola Stonemason Workshop, and a 4-tier 48-block Roman Domus with
 * geometric mosaic atrium, sunken impluvium, fluted marble columns, and sloped terracotta
 * compluvium roof tiles (tegulae).
 */

import * as THREE from 'three';
import { Level1Pyramid } from './level1_pyramid.js';
import {
  createConnectedMasonryGeometry,
  createCompluviumStraightRoofGeometry,
  createCompluviumCornerRoofGeometry,
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
  buildStylizedRomanCypress,
  buildStylizedRomanStonePine,
} from '../foliageAndGround.js';

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const DOMUS_STEP = BLOCK_W; // Exact zero-gap horizontal grid step matching block width/depth
const DOMUS_CENTER = new THREE.Vector3(3.6, 0, -0.8);
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
 * Unified 128x128 Mediterranean Tuscan/Latium terrain heightfield.
 * Rolling cypress hills around the perimeter, travertine quarry pit in NW,
 * sunken Roman cistern channel in NE, and flat compacted work pads under all 4 stations.
 */
function sampleRomanTerrainHeight(x, z) {
  const hillBase =
    Math.sin(x * 0.3 + z * 0.24 + 0.5) * 0.28 +
    Math.cos(x * 0.22 - z * 0.34) * 0.24 +
    Math.sin(x * 0.62 + z * 0.45) * 0.08;

  // Perimeter Tuscan hills & terraced cypress hillside
  const edgeX = Math.max(0, Math.abs(x) - 5.9);
  const edgeZ = Math.max(0, Math.abs(z) - 5.6);
  const perimeterHill =
    smoothstep(0.0, 4.4, Math.hypot(edgeX, edgeZ)) *
    (0.88 + Math.sin(x * 0.52 - z * 0.38) * 0.28);

  // Subtle vineyard terrace steps on North & South hillside rims
  const northTerrace =
    smoothstep(-5.8, -8.8, z) * (1.0 - smoothstep(2.0, 6.2, x)) * 0.48;
  const southRidge = smoothstep(6.0, 9.0, z) * 0.34;
  const westHill = smoothstep(-6.2, -9.6, x) * 0.44;

  let h = 0.06 + hillBase * 0.44 + perimeterHill + northTerrace + southRidge + westHill;

  // Decorative Roman water cistern / channel basin in NE corner
  const cisDist = Math.hypot((x - 7.5) / 3.0, (z + 5.75) / 2.65);
  const cisternMask = 1.0 - smoothstep(0.45, 1.38, cisDist);
  h -= cisternMask * 0.72;

  // Excavated white travertine marble quarry pit in NW
  const quarryPit = rectFlatMask(x, z, -4.6, -4.45, 2.35, 1.8, 1.55);
  h = h * (1.0 - quarryPit) + -0.055 * quarryPit;

  // Flat compacted pads for Roman Via tracks, Pergola Workshop, Staging & Domus
  const flatMask = Math.max(
    rectFlatMask(x, z, -4.6, -1.75, 2.3, 1.35, 1.2),
    rectFlatMask(x, z, -4.55, 0.75, 1.55, 2.65, 1.15),
    rectFlatMask(x, z, -4.6, 5.0, 2.4, 1.95, 1.3),
    rectFlatMask(x, z, 0.2, 4.75, 3.0, 1.4, 1.2),
    rectFlatMask(x, z, 4.1, 4.75, 1.5, 1.4, 1.1),
    rectFlatMask(x, z, 3.6, -0.8, 3.35, 3.35, 1.45),
    rectFlatMask(x, z, -1.6, 1.0, 2.6, 3.0, 1.65)
  );
  h *= 1.0 - flatMask;

  // Gentle beveled island perimeter skirt
  const rimT = Math.max(smoothstep(9.5, 10.2, Math.abs(x)), smoothstep(8.9, 9.6, Math.abs(z)));
  h -= rimT * 0.24;

  return h;
}

/**
 * 4-Biome Roman Terrain Splat Weights:
 *   x = Olive-Green Grass & Wildflowers
 *   y = Warm Terracotta Earth & Cobblestone Roman Via Road
 *   z = Pale Crushed Travertine & Marble Quarry Dust
 *   w = Lush Cistern Bank & Hillside Moss
 */
function computeRomanSplatWeights(x, z, h) {
  const jitter = Math.sin(x * 1.15 + z * 0.92) * 0.34 + Math.cos(x * 1.7 - z * 1.3) * 0.18;

  // Biome 2 (z): Pale Crushed Travertine & Marble Quarry Dust around NW quarry & SW pergola
  const wQuarry = Math.max(
    rectFlatMask(x + jitter * 0.28, z + jitter * 0.24, -4.6, -4.35, 2.7, 2.15, 1.95),
    rectFlatMask(x + jitter * 0.22, z + jitter * 0.22, -4.6, 5.0, 2.05, 1.65, 1.5) * 0.84,
    rectFlatMask(x + jitter * 0.18, z + jitter * 0.18, 3.6, -0.8, 2.95, 2.95, 1.15) * 0.42
  );

  // Biome 1 (y): Compacted Terracotta Earth & Cobblestone Roman Via Road under tracks & walkways
  const dTrackA = segmentDist(x, z, -4.55, -2.2, -4.55, 3.2);
  const dTrackB = segmentDist(x, z, -2.6, 4.75, 3.2, 4.75);
  const dViaPath = segmentDist(x, z, -2.0, -1.0, 1.6, 2.0);
  const dDomusApron = segmentDist(x, z, 3.6, 2.4, 3.6, 4.75);

  const wPath = Math.max(
    1.0 - smoothstep(0.95, 2.1, dTrackA + jitter * 0.35),
    1.0 - smoothstep(0.95, 2.1, dTrackB + jitter * 0.35),
    (1.0 - smoothstep(0.75, 1.85, dViaPath + jitter * 0.3)) * 0.85,
    (1.0 - smoothstep(0.9, 1.95, dDomusApron + jitter * 0.28)) * 0.88,
    rectFlatMask(x, z, 4.1, 4.75, 1.4, 1.3, 1.0) * 0.9
  );

  // Biome 3 (w): Lush Cistern Bank & Hillside Cypress Moss around NE cistern & groves
  const dCistern = Math.hypot((x - 7.5) / 3.35, (z + 5.75) / 2.95);
  const wCistern = 1.0 - smoothstep(0.7, 1.52, dCistern + jitter * 0.2);

  // Biome 0 (x): Lush Mediterranean Olive-Green Grass & Wildflowers everywhere else
  const used = clamp01(wQuarry * 0.95 + wPath * 0.9 + wCistern * 0.85);
  let w0 = Math.max(0.14, 1.0 - used);
  let w1 = wPath * (1.0 - wCistern * 0.55);
  let w2 = wQuarry * (1.0 - wCistern * 0.7);
  let w3 = wCistern;

  const sum = w0 + w1 + w2 + w3;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(WATER_LEVEL - 0.04, WATER_LEVEL + 0.16, h);
  return { w0, w1, w2, w3, wetness };
}

/**
 * Builds a compact sloped terracotta roof tile preview for workbench carving & dragging.
 */
function createRoofPreviewGeometry(width, height, depth) {
  const geo = new THREE.BoxGeometry(width, height, depth, 2, 1, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y > 0) {
      const t = (z + depth * 0.5) / depth;
      pos.setY(i, height * 0.5 + (1 - t) * 0.26 - t * 0.06);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a classical fluted Roman marble column geometry with sturdy base plinth & Doric capital.
 */
function createFlutedColumnGeometry(height) {
  const pts = [
    new THREE.Vector2(0.0, -height * 0.5),
    new THREE.Vector2(0.36, -height * 0.5),
    new THREE.Vector2(0.36, -height * 0.43),
    new THREE.Vector2(0.28, -height * 0.4),
    new THREE.Vector2(0.24, -height * 0.36),
    new THREE.Vector2(0.21, height * 0.36),
    new THREE.Vector2(0.29, height * 0.42),
    new THREE.Vector2(0.38, height * 0.45),
    new THREE.Vector2(0.38, height * 0.5),
    new THREE.Vector2(0.0, height * 0.5),
  ];
  const geo = new THREE.LatheGeometry(pts, 16);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Defines the 48-block, 4-tier Classical Roman Domus Blueprint (zero-gap DOMUS_STEP = 0.96):
 *   Tier 1 (16 blocks): Full 5x5 perimeter travertine foundation around mosaic atrium & impluvium
 *   Tier 2 (14 blocks): 10 perimeter Roman Ashlar walls (with front doorway, garden vista & side loggia arches)
 *                       + 4 tall fluted marble atrium columns rising flush from mosaic floor to roof soffit
 *   Tier 3 (10 blocks): Carved stone entablature lintels bridging doorway, garden vista & side bays
 *                       (automatically bonding corner/pier cornice stones into a continuous upper wall ring)
 *   Tier 4 (8 blocks):  4 straight eaves + 4 mitered 45-degree corner hip terracotta compluvium roof sections
 */
function buildDomusBlueprintTiers() {
  // Tier 1: 5x5 outer perimeter ring = 16 blocks
  const tier1 = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) === 2 || Math.abs(gz) === 2) {
        tier1.push({ dx: gx, dz: gz, pieceType: 'ashlar', rotY: 0 });
      }
    }
  }

  // Tier 2: 10 perimeter Ashlar walls + 4 full-height fluted marble atrium columns = 14 blocks
  const tier2Walls = [
    [-2, -2], [-1, -2], [1, -2], [2, -2],
    [-2, 0], [2, 0],
    [-2, 2], [-1, 2], [1, 2], [2, 2],
  ].map(([dx, dz]) => ({ dx, dz, pieceType: 'ashlar', rotY: 0 }));

  const tier2Columns = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ].map(([dx, dz]) => ({ dx, dz, pieceType: 'column', rotY: 0 }));

  const tier2 = [...tier2Walls, ...tier2Columns];

  // Tier 3: Entablature lintels bridging the doorway, garden vista & side peristyle bays = 10 blocks
  const tier3 = [
    [-1, -2], [0, -2], [1, -2],
    [-2, -1], [2, -1],
    [-2, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2],
  ].map(([dx, dz]) => ({ dx, dz, pieceType: 'ashlar', rotY: 0 }));

  // Tier 4: 8 welded terracotta compluvium roof sections (4 straight eaves + 4 mitered 45° hip corners)
  const tier4 = [
    { dx: -1, dz: -1, pieceType: 'roof', roofVariant: 'corner', rotY: 0 }, // NW 45° hip
    { dx: 0, dz: -1, pieceType: 'roof', roofVariant: 'straight', rotY: 0 }, // North slope
    { dx: 1, dz: -1, pieceType: 'roof', roofVariant: 'corner', rotY: -Math.PI * 0.5 }, // NE 45° hip
    { dx: 1, dz: 0, pieceType: 'roof', roofVariant: 'straight', rotY: -Math.PI * 0.5 }, // East slope
    { dx: 1, dz: 1, pieceType: 'roof', roofVariant: 'corner', rotY: Math.PI }, // SE 45° hip
    { dx: 0, dz: 1, pieceType: 'roof', roofVariant: 'straight', rotY: Math.PI }, // South slope
    { dx: -1, dz: 1, pieceType: 'roof', roofVariant: 'corner', rotY: Math.PI * 0.5 }, // SW 45° hip
    { dx: -1, dz: 0, pieceType: 'roof', roofVariant: 'straight', rotY: Math.PI * 0.5 }, // West slope
  ];

  return [tier1, tier2, tier3, tier4];
}

// 6 perimeter corner/center pier positions on Tier 3 that bond automatically when adjacent lintels lock in
const CORNICE_BONDER_CELLS = [
  { dx: -2, dz: -2, triggers: [[-1, -2], [-2, -1]] },
  { dx: 2, dz: -2, triggers: [[1, -2], [2, -1]] },
  { dx: -2, dz: 2, triggers: [[-1, 2], [-2, 1]] },
  { dx: 2, dz: 2, triggers: [[1, 2], [2, 1]] },
  { dx: -2, dz: 0, triggers: [[-2, -1], [-2, 1]] },
  { dx: 2, dz: 0, triggers: [[2, -1], [2, 1]] },
];

export class Level2Rome extends Level1Pyramid {
  static meta = {
    id: 'level2_rome',
    title: 'Niveau 2 : La Domus Romaine (48 blocs)',
    hudLabel: 'Rome • Domus',
    skyColor: '#cde4f0',
    totalGoal: 48,
    rewardCoins: 120,
    firstCompletionTokens: 15,
  };

  constructor(opts) {
    super({
      ...opts,
      runConfig: null,
    });
    this.root.name = 'Level2RomeRoot';
    this.totalGoal = Level2Rome.meta.totalGoal;
    this.hudLabel = Level2Rome.meta.hudLabel;
  }

  _beforeBuild() {
    this.rome = this.textures.ensureRomePack();
    this.totalGoal = Level2Rome.meta.totalGoal;
    this.hudLabel = Level2Rome.meta.hudLabel;
    this.corniceBonders = new Map();
    this.corniceTrimMeshes = [];

    // Upgrade Roman ashlar material with Royal Gold sheen if player purchased the upgrade
    if (this.upgrades.royal_gold_stone) {
      const m = this._trackMat(this.rome.materials.romanAshlar.clone());
      m.emissive = new THREE.Color('#6b4708');
      m.emissiveIntensity = 0.15;
      m.metalness = 0.22;
      this.carvedBlockMat = m;
    } else {
      this.carvedBlockMat = this.rome.materials.romanAshlar;
    }
  }

  _getRawBlockMaterial() {
    return this.rome.materials.rawTravertine;
  }

  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.04 };
  }

  _initSharedGeometries() {
    super._initSharedGeometries();

    // Override carved masonry block & ghost boxes to exact Level 2 height (BLOCK_H = 0.64)
    this.geos.carvedBlock = this._trackGeo(
      createConnectedMasonryGeometry(BLOCK_W, BLOCK_H, BLOCK_D, 0, 0.04)
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

    // Fluted Roman Marble Columns: compact workbench preview + full 3-tier atrium shaft (flush floor -> roof)
    const fullColH = BLOCK_H * 3.0;
    this.geos.romanColumnPreview = this._trackGeo(createFlutedColumnGeometry(BLOCK_H * 1.25));
    this.geos.romanColumn = this._trackGeo(createFlutedColumnGeometry(fullColH));
    this.geos.ghostColumn = this._trackGeo(new THREE.CylinderGeometry(0.32, 0.34, fullColH * 0.98, 12));
    this.geos.ghostColumnEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostColumn));

    // Welded Roman Compluvium Terracotta Roof (compact workbench tile + exact straight & 45° mitered corner)
    const roofSpec = {
      tileStep: BLOCK_W,
      innerSpan: BLOCK_W * 0.5, // 0.48 -> frames exact 0.96x0.96 sunlit impluvium opening
      outerSpan: BLOCK_W * 1.5 + 0.2, // 1.64 -> extends 0.20 eave overhang past outer ±2.40 stone walls
      innerH: 0.14,
      outerH: 0.68,
    };
    this.geos.romanRoofPreview = this._trackGeo(createRoofPreviewGeometry(BLOCK_W * 0.96, BLOCK_H * 0.65, BLOCK_D * 0.96));
    this.geos.romanRoofStraight = this._trackGeo(createCompluviumStraightRoofGeometry(roofSpec));
    this.geos.romanRoofCorner = this._trackGeo(createCompluviumCornerRoofGeometry(roofSpec));
    this.geos.romanRoof = this.geos.romanRoofPreview;

    this.geos.ghostRoofStraight = this.geos.romanRoofStraight;
    this.geos.ghostRoofStraightEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.romanRoofStraight, 22));
    this.geos.ghostRoofCorner = this.geos.romanRoofCorner;
    this.geos.ghostRoofCornerEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.romanRoofCorner, 22));

    // Pale travertine dust particle color for Roman chipping
    this.mats.dustLimestone.color.set('#f4efe4');
    this.mats.dustSand.color.set('#d2a472');
  }

  getTerrainHeight(x, z) {
    return sampleRomanTerrainHeight(x * this.mirrorX, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 MEDITERRANEAN TUSCAN TERRAIN, CISTERN, CYPRESS & AMPHORAE
   * ========================================================================== */
  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // Unified 128x128 sculpted Mediterranean terrain mesh with 4-biome PBR splatting
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
      const h = sampleRomanTerrainHeight(sx, z);
      pos.setY(i, h);

      const { w0, w1, w2, w3, wetness } = computeRomanSplatWeights(sx, z, h);
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

    const terrainMesh = new THREE.Mesh(terrainGeo, this.rome.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    env.add(terrainMesh);

    // Contoured earthen/travertine island plinth skirt
    const skirtGeo = this._buildContouredPlinthSkirt();
    const skirtMesh = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirtMesh.receiveShadow = true;
    env.add(skirtMesh);

    const bottomCapGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D));
    bottomCapGeo.rotateX(Math.PI / 2);
    const bottomCap = new THREE.Mesh(bottomCapGeo, this.textures.materials.plinth);
    bottomCap.position.y = -1.65;
    env.add(bottomCap);

    // Decorative turquoise Roman water cistern / channel edge in North-East
    this._buildRomanCistern(env);

    // Stylized Mediterranean Cypresses & Tuscan Umbrella Stone Pines (no smooth cones!)
    const cypressSpecs = [
      [4.5, -6.95, 1.16, 'cypress'],
      [8.25, -7.25, 1.02, 'cypress'],
      [5.75, -8.35, 0.94, 'pine'],
      [7.8, 5.7, 1.04, 'pine'],
      [-7.9, 6.25, 0.96, 'cypress'],
      [-8.3, -1.8, 1.05, 'cypress'],
      [0.4, -7.9, 1.12, 'cypress'],
      [8.4, 2.2, 0.92, 'cypress'],
    ];
    cypressSpecs.forEach(([cx, cz, sc, kind], idx) => {
      this._createRomanCypress(env, this._mx(cx), cz, sc, kind, idx + 1);
    });

    // Cut white travertine Roman Via stepping flagstones
    const stepGeo = this._trackGeo(new THREE.BoxGeometry(0.95, 0.08, 0.72));
    [
      [-1.7, -0.8],
      [-1.15, 0.3],
      [-0.55, 1.4],
      [0.05, 2.5],
      [3.6, 2.95],
      [3.6, 3.85],
    ].forEach(([sx, sz], i) => {
      const wx = this._mx(sx);
      const h = this.getTerrainHeight(wx, sz);
      const stone = new THREE.Mesh(stepGeo, this.rome.materials.romanAshlar);
      stone.position.set(wx, h + 0.015, sz);
      stone.rotation.y = (i % 2 === 0 ? 0.08 : -0.1) * this.mirrorX;
      stone.receiveShadow = true;
      env.add(stone);
    });

    // Stylized Terracotta Roman Amphorae props around the diorama edge & workshop
    this._buildTerracottaAmphorae(env);

    // Cozy 3D Instanced Mediterranean Grass (1040 tufts), Flat Pebbles & White/Yellow Wildflowers
    const focalPoints = [
      ...cypressSpecs.map(([cx, cz]) => ({ x: this._mx(cx), z: cz, innerRadius: 0.3, radius: 1.9 })),
      { x: this._mx(5.0), z: -4.8, innerRadius: 0.35, radius: 2.1 },
      { x: this._mx(6.7), z: -3.6, innerRadius: 0.35, radius: 1.9 },
      { x: this._mx(-7.0), z: 4.7, innerRadius: 0.35, radius: 1.5 },
      { x: this._mx(6.7), z: 4.6, innerRadius: 0.35, radius: 1.5 },
    ];
    this.cozyGround = createCozyGroundFoliageSystem({
      parent: env,
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      isBlocked: (x, z) => this._isBlockedForFoliage(x, z),
      getGrassWeight: (x, z, y) => {
        const sx = x * this.mirrorX;
        const { w0: wGrass, w1: wPath, w2: wQuarry, w3: wMoss } = computeRomanSplatWeights(sx, z, y);
        if (wPath > 0.28 || wQuarry > 0.34) return 0;
        return Math.max(wGrass, wMoss);
      },
      focalPoints,
      waterLevel: WATER_LEVEL,
      halfW: TERRAIN_W * 0.5,
      halfD: TERRAIN_D * 0.5,
      grassCount: 1040,
      pebbleCount: 120,
      flowerCount: 96,
      grassPalette: ['#6da142', '#528032', '#82b348', '#a5ba4e', '#46702b'],
      pebblePalette: ['#cfc7b8', '#b8af9e', '#9b9487', '#ddd5c4'],
      flowerPalette: ['#fffcf2', '#fff7e0', '#ffe35c', '#ffd342'],
      seed: 202,
    });

    // Soft Circular Contact Shadows (AO) under trees, amphora clusters, quarry, workshop & Domus
    const aoEntries = [
      ...cypressSpecs.map(([cx, cz, sc, kind]) => ({
        x: this._mx(cx),
        z: cz,
        radius: (kind === 'pine' ? 1.25 : 0.88) * sc,
        strength: 0.95,
      })),
      { x: this._mx(-7.0), z: 4.65, radius: 0.72, strength: 0.85 },
      { x: this._mx(6.65), z: 4.55, radius: 0.72, strength: 0.85 },
      { x: this._mx(-4.7), z: -5.2, radiusX: 3.3, radiusZ: 1.55, strength: 0.72 },
      { x: this._mx(-4.6), z: 4.15, radiusX: 2.35, radiusZ: 2.15, strength: 0.7 },
      { x: this.pyramidCenter.x, z: this.pyramidCenter.z, radiusX: 3.15, radiusZ: 3.15, strength: 0.78 },
    ];
    this.contactShadows = createContactShadowSystem(env, aoEntries, (x, z) => this.getTerrainHeight(x, z));
  }

  _buildRomanCistern(parent) {
    // Shimmering turquoise cistern water surface
    const waterGeo = this._trackGeo(new THREE.CircleGeometry(3.15, 32));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.textures.materials.oasisWater);
    water.position.set(this._mx(7.5), WATER_LEVEL, -5.75);
    water.scale.set(1.02, 1, 0.88);
    water.receiveShadow = true;
    parent.add(water);
    this.nileWaterMesh = water;

    // Carved travertine Roman cistern stone coping curb along the inner shoreline
    const curbGeo = this._trackGeo(new THREE.BoxGeometry(1.1, 0.24, 0.34));
    [
      [4.7, -5.2, 0.55],
      [5.4, -4.1, 0.95],
      [6.5, -3.55, 1.42],
      [7.7, -3.45, 1.65],
    ].forEach(([cx, cz, rot]) => {
      const wx = this._mx(cx);
      const h = Math.max(this.getTerrainHeight(wx, cz), WATER_LEVEL + 0.02);
      const curb = new THREE.Mesh(curbGeo, this.rome.materials.travertineCliff);
      curb.position.set(wx, h + 0.08, cz);
      curb.rotation.y = rot * this.mirrorX;
      curb.castShadow = true;
      curb.receiveShadow = true;
      parent.add(curb);
    });
  }

  _createRomanCypress(parent, x, z, scale = 1.0, kind = 'cypress', seed = 1) {
    const groundY = this.getTerrainHeight(x, z);
    const foliageMat = this._getSharedFoliageMaterial();
    const builder = kind === 'pine' ? buildStylizedRomanStonePine : buildStylizedRomanCypress;
    const { tree, crown } = builder({
      x,
      z,
      groundY,
      scale,
      seed,
      barkMat: this.textures.materials.palmTrunk,
      foliageMat,
      trackGeo: (g) => this._trackGeo(g),
    });
    this.palmFronds.push({ group: crown, phase: x * 0.65 + z * 0.4 });
    parent.add(tree);
  }

  _buildTerracottaAmphorae(parent) {
    const ampPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.11, 0.0),
      new THREE.Vector2(0.17, 0.14),
      new THREE.Vector2(0.22, 0.32),
      new THREE.Vector2(0.18, 0.48),
      new THREE.Vector2(0.09, 0.58),
      new THREE.Vector2(0.12, 0.68),
      new THREE.Vector2(0.09, 0.69),
    ];
    const ampGeo = this._trackGeo(new THREE.LatheGeometry(ampPts, 12));

    [
      [-7.2, 4.4, 1.0],
      [-6.7, 4.9, 0.85],
      [6.4, 4.4, 0.95],
      [6.95, 4.75, 0.8],
      [-1.8, -5.8, 0.92],
      [3.9, -5.5, 0.88],
    ].forEach(([ax, az, sc]) => {
      const wx = this._mx(ax);
      const y = this.getTerrainHeight(wx, az);
      const mesh = new THREE.Mesh(ampGeo, this.rome.materials.amphoraClay);
      mesh.position.set(wx, y - 0.02, az);
      mesh.scale.setScalar(sc);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    });
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE MARBRE & TRAVERTIN (NORTH-WEST)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    // Stepped white-and-cream travertine marble cliff ledges
    const terraceSpecs = [
      { pos: [this._mx(-4.6), 0.72, -6.35], size: [5.5, 1.45, 2.3] },
      { pos: [this._mx(-4.7), 1.68, -6.9], size: [4.5, 1.05, 1.55] },
      { pos: [this._mx(-6.55), 0.55, -5.1], size: [1.8, 1.1, 2.4] },
      { pos: [this._mx(-2.7), 0.46, -5.35], size: [1.6, 0.92, 1.9] },
      { pos: [this._mx(-4.6), 0.34, -5.35], size: [2.7, 0.68, 1.35] },
    ];
    terraceSpecs.forEach((t) => {
      const mesh = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(t.size[0], t.size[1], t.size[2])),
        this.rome.materials.travertineCliff
      );
      mesh.position.set(t.pos[0], t.pos[1], t.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      quarryGroup.add(mesh);
    });

    // Roman timber & bronze crane beam over quarry cliff
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 1.35, 8));
    const post = new THREE.Mesh(postGeo, this.textures.materials.timberDark);
    post.position.set(this._mx(-3.0), 1.45, -6.2);
    post.castShadow = true;
    quarryGroup.add(post);

    const beam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.6, 0.12, 0.12)),
      this.textures.materials.timber
    );
    beam.position.set(this._mx(-3.55), 2.02, -5.95);
    beam.rotation.y = 0.25 * this.mirrorX;
    beam.castShadow = true;
    quarryGroup.add(beam);

    // 3 Extractable Travertine Marble Rock Nodes nestled into the excavated quarry pit
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

      const mat = this._trackMat(this.rome.materials.rawTravertine.clone());
      mat.emissive = new THREE.Color(0x3a3222);
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

    // Travertine Stone Quarry Output Pad (5 neat slots right in front of the rock nodes)
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.6, 0.14, 1.35)),
      this.rome.materials.romanAshlar
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
   * 3. ZONE 3 — L'ATELIER DU TAILLEUR ROMAIN (TIMBER PERGOLA + MARBLE WORKBENCH)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    this.root.add(ws);

    const cx = this._mx(-4.6);
    const cz = 5.0;

    // Travertine stone workshop patio floor
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.4, 0.14, 3.2)),
      this.rome.materials.romanAshlar
    );
    floor.position.set(cx, 0.07, cz);
    floor.receiveShadow = true;
    ws.add(floor);

    // Roman Timber Pergola (4 carved stone plinth bases + dark cedar posts + open pergola beams)
    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.24, 0.32));
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.085, 0.1, 2.2, 8));
    [
      [cx - 1.85, cz - 1.3],
      [cx + 1.85, cz - 1.3],
      [cx - 1.85, cz + 1.3],
      [cx + 1.85, cz + 1.3],
    ].forEach(([px, pz]) => {
      const plinth = new THREE.Mesh(plinthGeo, this.rome.materials.travertineCliff);
      plinth.position.set(px, 0.24, pz);
      plinth.castShadow = true;
      ws.add(plinth);

      const post = new THREE.Mesh(postGeo, this.textures.materials.timberDark);
      post.position.set(px, 1.42, pz);
      post.castShadow = true;
      ws.add(post);
    });

    // Pergola main girders & cross rafters
    const girderGeo = this._trackGeo(new THREE.BoxGeometry(4.15, 0.14, 0.16));
    [-1.3, 1.3].forEach((dz) => {
      const girder = new THREE.Mesh(girderGeo, this.textures.materials.timberDark);
      girder.position.set(cx, 2.52, cz + dz);
      girder.castShadow = true;
      ws.add(girder);
    });

    const rafterGroup = new THREE.Group();
    rafterGroup.position.set(cx, 2.64, cz);
    const rafterGeo = this._trackGeo(new THREE.BoxGeometry(0.11, 0.1, 3.1));
    for (let i = -3; i <= 3; i++) {
      const rafter = new THREE.Mesh(rafterGeo, this.textures.materials.timber);
      rafter.position.set(i * 0.58, 0, 0);
      rafter.castShadow = true;
      rafterGroup.add(rafter);
    }
    // Mediterranean vine foliage clusters draped across pergola rafters
    const vineGeo = this._trackGeo(new THREE.SphereGeometry(0.28, 7, 6));
    [
      [-1.35, 0.1, -0.8],
      [-0.6, 0.12, -1.1],
      [0.95, 0.1, -0.95],
      [1.45, 0.1, 0.55],
      [-1.1, 0.1, 0.9],
    ].forEach(([vx, vy, vz]) => {
      const v = new THREE.Mesh(vineGeo, this.rome.materials.cypressLeafLight);
      v.position.set(vx, vy, vz);
      v.scale.set(1.4, 0.45, 1.1);
      rafterGroup.add(v);
    });
    this.canopyMesh = rafterGroup;
    ws.add(rafterGroup);

    // White Travertine Marble Workbench (centered under pergola)
    const wbX = cx - this._mx(0.55);
    const wbZ = cz - 0.12;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.58, 0.62, 1.38)),
      this.textures.materials.timberDark
    );
    benchBase.position.set(wbX, 0.44, wbZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.72, 0.14, 1.52)),
      this.rome.materials.travertineCliff
    );
    benchTop.position.set(wbX, 0.8, wbZ);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    ws.add(benchTop);

    // Iron chisels & bronze mallet resting on marble workbench
    const malletHandle = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6)),
      this.textures.materials.timber
    );
    malletHandle.position.set(wbX - this._mx(0.6), 0.91, wbZ + 0.46);
    malletHandle.rotation.set(Math.PI / 2, 0.35, 0);
    ws.add(malletHandle);

    const malletHead = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 8)),
      this.rome.materials.romanBronze
    );
    malletHead.position.set(wbX - this._mx(0.67), 0.93, wbZ + 0.3);
    malletHead.rotation.z = Math.PI / 2;
    ws.add(malletHead);

    const chiselMat = this.upgrades.golden_chisel
      ? this.textures.materials.capstoneGold
      : this.rome.materials.romanBronze;
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

    // Generous invisible carve-swipe hitbox over the marble workbench
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.9, 1.35, 1.9));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(wbX, wbY + 0.45, wbZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Diegetic Glowing Carving Progress Pips above workbench
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.095, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshBasicMaterial({ color: 0xffe49e, transparent: true, opacity: 0.35 })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(wbX + (i - 1) * 0.32, wbY + 1.24, wbZ);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Finished Stone Output Slots (right side of Pergola patio)
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
   * 4. ZONE 4 — CHANTIER DE LA DOMUS ROMAINE CLASSIQUE (48 BLOCKS, 4 TIERS)
   * ========================================================================== */
  _buildPyramidSite() {
    const site = new THREE.Group();
    this.root.add(site);

    const dc = this.pyramidCenter;

    // Raised Travertine Domus Construction Terrace (exact apron around 4.80x4.80 zero-gap Domus walls)
    const basePlatform = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.48, FOUNDATION_Y, 5.48)),
      this.rome.materials.travertineCliff
    );
    basePlatform.position.set(dc.x, FOUNDATION_Y * 0.5, dc.z);
    basePlatform.receiveShadow = true;
    basePlatform.castShadow = true;
    site.add(basePlatform);

    // Geometric Roman Mosaic Atrium Floor inside the Domus footprint
    const mosaicFloor = new THREE.Mesh(
      this._trackGeo(new THREE.PlaneGeometry(4.8, 4.8)),
      this.rome.materials.mosaicFloor
    );
    mosaicFloor.rotation.x = -Math.PI / 2;
    mosaicFloor.position.set(dc.x, FOUNDATION_Y + 0.008, dc.z);
    mosaicFloor.receiveShadow = true;
    site.add(mosaicFloor);

    // Central Sunken Roman Impluvium Pool (carved marble curb + shimmering turquoise rainwater)
    const impRim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.56, 0.12, 1.56)),
      this.rome.materials.travertineCliff
    );
    impRim.position.set(dc.x, FOUNDATION_Y + 0.05, dc.z);
    impRim.receiveShadow = true;
    site.add(impRim);

    const impWater = new THREE.Mesh(
      this._trackGeo(new THREE.PlaneGeometry(1.22, 1.22)),
      this.textures.materials.oasisWater
    );
    impWater.rotation.x = -Math.PI / 2;
    impWater.position.set(dc.x, FOUNDATION_Y + 0.116, dc.z);
    site.add(impWater);

    // 4 Corner Roman Bronze Torches / Markers framing the site
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 0.72, 8));
    const capGeo = this._trackGeo(new THREE.SphereGeometry(0.11, 8, 8));
    [
      [-2.62, -2.62],
      [2.62, -2.62],
      [-2.62, 2.62],
      [2.62, 2.62],
    ].forEach(([ox, oz]) => {
      const post = new THREE.Mesh(postGeo, this.rome.materials.travertineCliff);
      post.position.set(dc.x + ox, FOUNDATION_Y + 0.34, dc.z + oz);
      post.castShadow = true;
      site.add(post);

      const cap = new THREE.Mesh(capGeo, this.rome.materials.romanBronze);
      cap.position.set(dc.x + ox, FOUNDATION_Y + 0.74, dc.z + oz);
      site.add(cap);
    });

    // Aura du Pyramidion upgrade support (golden glowing construction halo)
    if (this.upgrades.pyramidion_aura) {
      const auraGeo = this._trackGeo(new THREE.RingGeometry(3.15, 3.45, 40));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffd75e,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      this.auraRingMesh = new THREE.Mesh(auraGeo, auraMat);
      this.auraRingMesh.position.set(dc.x, FOUNDATION_Y + 0.025, dc.z);
      site.add(this.auraRingMesh);
    }

    // Staging Pallet beside Track B end (2x2 = 4 slots)
    const palletX = this._mx(4.1);
    const palletZ = 4.75;
    const pallet = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.35, 0.14, 2.35)),
      this.rome.materials.romanAshlar
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

    // Pre-build the 6 automatic Tier 3 Cornice Bonding Stones over the 4 corners & 2 E/W piers
    // They bond seamlessly when adjacent Tier 3 lintels lock in so the upper entablature is 100% solid under the roof!
    const tier3CenterY = FOUNDATION_Y + 2 * BLOCK_H + BLOCK_H * 0.5;
    CORNICE_BONDER_CELLS.forEach((spec) => {
      const wx = dc.x + spec.dx * DOMUS_STEP;
      const wz = dc.z + spec.dz * DOMUS_STEP;
      const mesh = new THREE.Mesh(this.geos.carvedBlock, this.carvedBlockMat);
      mesh.position.set(wx, tier3CenterY, wz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      site.add(mesh);

      const key = this._gridKey(spec.dx, 2, spec.dz);
      this.corniceBonders.set(key, {
        gridX: spec.dx,
        layer: 2,
        gridZ: spec.dz,
        triggers: spec.triggers,
        mesh,
        active: false,
        masonryMask: -1,
      });
    });

    // Subtle continuous molded travertine eaves cornice trim around top of Tier 3 (revealed when Tier 3 bonds)
    const trimY = FOUNDATION_Y + 3 * BLOCK_H - 0.045;
    const trimLen = 5 * BLOCK_W + 0.14;
    const trimH = 0.09;
    const trimThick = 0.12;
    const trimEdge = 2.5 * BLOCK_W + 0.02;
    const trimNSGeo = this._trackGeo(new THREE.BoxGeometry(trimLen, trimH, trimThick));
    const trimEWGeo = this._trackGeo(new THREE.BoxGeometry(trimThick, trimH, trimLen));
    [
      [trimNSGeo, 0, -trimEdge],
      [trimNSGeo, 0, trimEdge],
      [trimEWGeo, -trimEdge, 0],
      [trimEWGeo, trimEdge, 0],
    ].forEach(([geo, ox, oz]) => {
      const m = new THREE.Mesh(geo, this.rome.materials.travertineCliff);
      m.position.set(dc.x + ox, trimY, dc.z + oz);
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      site.add(m);
      this.corniceTrimMeshes.push(m);
    });

    // Build all 48 progressive blueprint slots across the 4 Roman Domus tiers (zero-gap DOMUS_STEP = 0.96)
    const tiers = buildDomusBlueprintTiers();
    this.maxLayerIndex = tiers.length - 1;
    let slotIdx = 0;

    tiers.forEach((tierCells, layer) => {
      const layerBaseY = FOUNDATION_Y + layer * BLOCK_H;

      tierCells.forEach((cell, cellIdx) => {
        const wx = dc.x + cell.dx * DOMUS_STEP;
        const wz = dc.z + cell.dz * DOMUS_STEP;
        const isColumn = cell.pieceType === 'column';
        const isRoof = cell.pieceType === 'roof';
        const isCornerRoof = isRoof && cell.roofVariant === 'corner';

        // Columns span flush from mosaic floor (FOUNDATION_Y) to roof underside (FOUNDATION_Y + 3*BLOCK_H).
        // Roof sections have flat underside at local y = 0, sitting flush on Tier 3 cornice & columns (layerBaseY).
        const centerY = isColumn
          ? FOUNDATION_Y + BLOCK_H * 1.5
          : isRoof
          ? layerBaseY
          : layerBaseY + BLOCK_H * 0.5;

        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(wx, centerY, wz);
        ghostGroup.rotation.y = cell.rotY || 0;

        const gGeo = isColumn
          ? this.geos.ghostColumn
          : isRoof
          ? isCornerRoof
            ? this.geos.ghostRoofCorner
            : this.geos.ghostRoofStraight
          : this.geos.ghostBox;
        const gEdges = isColumn
          ? this.geos.ghostColumnEdges
          : isRoof
          ? isCornerRoof
            ? this.geos.ghostRoofCornerEdges
            : this.geos.ghostRoofStraightEdges
          : this.geos.ghostBoxEdges;

        const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
        const ghostLines = new THREE.LineSegments(gEdges, this.mats.ghostLineNormal);
        ghostGroup.add(ghostMesh);
        ghostGroup.add(ghostLines);
        ghostGroup.visible = layer === 0;
        site.add(ghostGroup);

        const slot = {
          id: `domus_L${layer}_${cellIdx}`,
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
          dropIndicatorY: isColumn ? FOUNDATION_Y + 0.02 : layerBaseY + 0.01,
          ghostGroup,
          ghostMesh,
          ghostLines,
          block: null,
        };
        this.pyramidSlots.push(slot);
        this._registerSlotInGrid(slot);
      });
    });

    this.totalGoal = this.pyramidSlots.length; // 48 blocks
  }

  /* ============================================================================
   * 5. CONNECTED ROMAN MASONRY, CORNICE BONDING & WELDED TERRACOTTA ROOF
   * ========================================================================== */
  _hasOccupiedMasonryAt(gx, layer, gz) {
    const slot = this._getGridSlot(gx, layer, gz);
    if (this._isConnectableMasonrySlot(slot)) return true;
    const bonder = this.corniceBonders ? this.corniceBonders.get(this._gridKey(gx, layer, gz)) : null;
    return Boolean(bonder && bonder.active);
  }

  _computeMasonryNeighborMask(slot) {
    if (!this._isConnectableMasonrySlot(slot)) return 0;
    const { gridX: gx, layer, gridZ: gz } = slot;
    let mask = 0;

    if (this._hasOccupiedMasonryAt(gx + 1, layer, gz)) mask |= NEIGHBOR_PX;
    if (this._hasOccupiedMasonryAt(gx - 1, layer, gz)) mask |= NEIGHBOR_NX;
    if (this._hasOccupiedMasonryAt(gx, layer, gz + 1)) mask |= NEIGHBOR_PZ;
    if (this._hasOccupiedMasonryAt(gx, layer, gz - 1)) mask |= NEIGHBOR_NZ;
    if (this._hasOccupiedMasonryAt(gx, layer + 1, gz)) mask |= NEIGHBOR_PY;
    if (layer > 0 && this._hasOccupiedMasonryAt(gx, layer - 1, gz)) mask |= NEIGHBOR_NY;

    return mask;
  }

  _refreshCorniceBonderGeometry(bonder) {
    if (!bonder || !bonder.active) return;
    const { gridX: gx, layer, gridZ: gz } = bonder;
    let mask = 0;
    if (this._hasOccupiedMasonryAt(gx + 1, layer, gz)) mask |= NEIGHBOR_PX;
    if (this._hasOccupiedMasonryAt(gx - 1, layer, gz)) mask |= NEIGHBOR_NX;
    if (this._hasOccupiedMasonryAt(gx, layer, gz + 1)) mask |= NEIGHBOR_PZ;
    if (this._hasOccupiedMasonryAt(gx, layer, gz - 1)) mask |= NEIGHBOR_NZ;
    if (this._hasOccupiedMasonryAt(gx, layer - 1, gz)) mask |= NEIGHBOR_NY;

    if (bonder.masonryMask === mask) return;
    bonder.masonryMask = mask;
    const { w, h, d, bevel } = this._getMasonryBlockDimensions();
    bonder.mesh.geometry = this.masonryCache.getBlockGeometry(w, h, d, mask, bevel);
  }

  _onConnectedMasonryUpdated(slot) {
    if (!this.corniceBonders || !slot) return;

    // Activate any Tier 3 cornice bonding pier once an adjacent Tier 3 lintel snaps next to it
    let anyBonderChanged = false;
    this.corniceBonders.forEach((bonder) => {
      if (!bonder.active) {
        const pierBelowOccupied = this._hasOccupiedMasonryAt(bonder.gridX, 1, bonder.gridZ);
        const adjacentLintelPlaced = bonder.triggers.some(([tx, tz]) =>
          this._hasOccupiedMasonryAt(tx, 2, tz)
        );
        if (pierBelowOccupied && adjacentLintelPlaced) {
          bonder.active = true;
          bonder.mesh.visible = true;
          this._triggerSquashBounce(bonder.mesh, 1.08, 0.92);
          anyBonderChanged = true;
        }
      }
      if (bonder.active) {
        this._refreshCorniceBonderGeometry(bonder);
      }
    });

    // Re-bond adjacent Tier 2 piers & Tier 3 lintels whenever a cornice bonding pier activates
    if (anyBonderChanged) {
      this.corniceBonders.forEach((bonder) => {
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

    // Reveal the continuous molded travertine Roman cornice band once Tier 3 entablature completes
    const tier3Done = this.pyramidSlots
      .filter((s) => s.layer === 2)
      .every((s) => Boolean(s.block));
    if (tier3Done && this.corniceTrimMeshes.length > 0 && !this.corniceTrimMeshes[0].visible) {
      this.corniceTrimMeshes.forEach((m) => {
        m.visible = true;
      });
    }
  }

  _shouldForgeCapstone() {
    // Level 2 finishes with welded terracotta compluvium roof tiles instead of an Egyptian pyramidion
    return false;
  }

  _pickNextCarvedPieceType() {
    const remaining = this.pyramidSlots.filter((s) => s.layer === this.activeLayer && !s.block);
    if (remaining.some((s) => s.pieceType === 'roof')) return 'roof';
    if (remaining.some((s) => s.pieceType === 'column')) return 'column';
    return 'ashlar';
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyRomanPieceVisual(block, pieceType, null);
    }
    return stillRaw;
  }

  _applyRomanPieceVisual(block, pieceType, slot = null) {
    block.pieceType = pieceType;
    if (pieceType === 'column') {
      // Compact column on workbench/sled -> full 3-tier atrium shaft when snapped into Domus slot
      block.mesh.geometry = slot ? this.geos.romanColumn : this.geos.romanColumnPreview;
      block.mesh.material = this.rome.materials.flutedColumn;
    } else if (pieceType === 'roof') {
      // Compact terracotta tile on workbench/sled -> welded full-eave straight or 45° mitered corner roof
      if (slot) {
        block.mesh.geometry =
          slot.roofVariant === 'corner'
            ? this.geos.romanRoofCorner
            : this.geos.romanRoofStraight;
      } else {
        block.mesh.geometry = this.geos.romanRoofPreview;
      }
      block.mesh.material = this.rome.materials.terracottaRoof;
    } else {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.carvedBlockMat;
    }
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyRomanPieceVisual(block, slot.pieceType, slot);
  }

  dispose() {
    if (this.corniceBonders) this.corniceBonders.clear();
    if (this.corniceTrimMeshes) this.corniceTrimMeshes.length = 0;
    super.dispose();
  }

  /* ============================================================================
   * 6. ROMAN COMPLETION CELEBRATION (+120 OR & +15 ÉCLATS ON FIRST COMPLETION)
   * ========================================================================== */
  _triggerCompletionSequence() {
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    const dc = this.pyramidCenter;
    const apexY = FOUNDATION_Y + 4 * BLOCK_H + 0.5;

    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(dc.x, apexY, dc.z);

    // Sunlit golden Mediterranean celebration rays shining gracefully into the Domus atrium impluvium
    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.32, 1.15, 7.6, 18, 1, true));
    innerGeo.translate(0, 3.2, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffe49c,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.62, 1.75, 7.2, 18, 1, true));
    outerGeo.translate(0, 3.0, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffd27a,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.55, 1.18, 28));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe488,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.35;
    this.victoryGroup.add(this.victoryHalo);

    this.root.add(this.victoryGroup);

    if (this.onComplete) {
      const goldMult = this.upgrades.royal_gold_stone ? 1.25 : 1.0;
      const rewardCoins = Math.round(Level2Rome.meta.rewardCoins * goldMult);
      this.onComplete({
        levelId: Level2Rome.meta.id,
        focusPoint: new THREE.Vector3(dc.x, FOUNDATION_Y + 1.55, dc.z),
        rewardCoins,
        firstCompletionTokens: Level2Rome.meta.firstCompletionTokens,
      });
    }
  }
}
