/**
 * Workd Builder — Level 8: Medieval Era ("Le Château Fort Médiéval")
 *
 * Tactile 4-station medieval fortress construction diorama (56 blocks across 4 connected tiers):
 *  - Sculpted 128x128 medieval valley terrain with rocky eastern castle motte/hilltop terrace,
 *    NW grey-limestone quarry cliff, NE turquoise moat & river bend with wooden drawbridge approach,
 *    cobblestone wagon roads, stylized oaks & pines, wooden palisade stakes & fluttering banners.
 *  - Zone 1 (NW): Stepped grey-limestone quarry with 3 extractable rock nodes & 5 tracked storage slots.
 *  - Zone 2 (W/C): Two iron-banded oak transport carts on twin timber tracks with wrought-iron levers.
 *  - Zone 3 (SW): Timber-and-slate medieval stonemason lodge with open-front cutaway roof (rear ~35%,
 *    raycast disabled) and progressive 512x512 carving PBR stages (Stage 0 -> 1 -> 2 -> 3).
 *  - Zone 4 (E): Zero-gap 56-block Medieval Fortress (18 rampart bases + drawbridge threshold ->
 *    16 arrow-slit curtain walls, iron portcullis gate & 4 corner towers -> 14 crenellated battlements,
 *    upper corner towers & towering central Keep -> 8 welded pitched Keep slate roofs & conical turret spires).
 */

import * as THREE from 'three';
import { Level1Pyramid } from './level1_pyramid.js';
import {
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
  createMatteFoliageMaterial,
  createRootedTrunk,
  createOrganicFoliageBlobGeo,
  createIrregularConiferTierGeo,
} from '../foliageAndGround.js';

const TERRAIN_W = 21.5;
const TERRAIN_D = 20.5;
const TERRAIN_SEGS = 128;

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const CASTLE_STEP = BLOCK_W; // Zero-gap exact outer block width/depth

const CASTLE_CENTER = { x: 3.45, z: -0.95 };
const MOTTE_ELEV = 0.22;
const FOUNDATION_Y = MOTTE_ELEV + 0.16; // 0.38 flush stone plinth atop the elevated castle motte
const MOAT_WATER_Y = -0.26;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function segmentDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const lenSq = abx * abx + abz * abz || 1;
  const t = clamp01((apx * abx + apz * abz) / lenSq);
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

function rectFlatMask(x, z, cx, cz, hw, hd, feather = 1.0) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return 1.0 - smoothstep(0, feather, Math.hypot(dx, dz));
}

/**
 * Unified 128x128 Medieval Valley, Rocky Motte Terrace, Quarry Cliff & Turquoise Moat heightfield.
 */
function sampleCastleTerrainHeight(x, z) {
  // Gentle European valley rolling hills around perimeter
  let h =
    Math.sin(x * 0.24 + 0.5) * Math.cos(z * 0.21 - 0.3) * 0.12 +
    Math.sin(x * 0.52 - z * 0.44) * 0.04;

  // Scenic rolling meadow ridges around outer NW/N/W/E edges
  const northRidge = smoothstep(-5.8, -9.2, z) * 0.95;
  const westHill = smoothstep(-6.8, -10.2, x) * 0.72;
  const eastHill = smoothstep(8.2, 10.6, x) * 0.58;
  const southBank = smoothstep(7.4, 9.8, z) * 0.22;
  h += northRidge + westHill + eastHill + southBank;

  // Shallow grey-limestone quarry excavation pit in North-West
  const pitDist = Math.hypot((x + 5.1) * 0.85, (z + 4.95) * 1.05);
  h -= (1.0 - smoothstep(1.25, 3.1, pitDist)) * 0.44;

  // Rocky elevated Castle Motte / Hilltop Terrace on the East
  const motteMask = rectFlatMask(x, z, CASTLE_CENTER.x, CASTLE_CENTER.z, 2.75, 2.75, 1.35);
  h = h * (1.0 - motteMask) + MOTTE_ELEV * motteMask;

  // Turquoise Castle Moat & River Bend curving across the North-East flank
  const moatBendDist = Math.min(
    segmentDist(x, z, 5.4, -7.2, 8.1, -4.8),
    segmentDist(x, z, 8.1, -4.8, 7.6, -1.2),
    segmentDist(x, z, 3.0, -7.4, 5.4, -7.2)
  );
  const moatMask = 1.0 - smoothstep(0.95, 2.15, moatBendDist);
  h = h * (1.0 - moatMask) + -0.62 * moatMask;

  // Flat compacted bailey grounds for Stonemason Workshop, Quarry output, Staging & Wagon Tracks
  const flatMask = clamp01(
    Math.max(
      rectFlatMask(x, z, -4.6, -3.28, 2.95, 1.05, 0.95), // Quarry output pad
      rectFlatMask(x, z, -4.6, 0.1, 1.55, 3.35, 0.85),   // Track A corridor
      rectFlatMask(x, z, -4.6, 4.35, 2.55, 2.1, 1.05),   // Stonemason Lodge yard
      rectFlatMask(x, z, -0.5, 4.75, 3.55, 1.55, 0.9),   // Track B wagon road
      rectFlatMask(x, z, 3.55, 3.55, 1.85, 1.75, 0.95)   // Castle approach & staging yard
    )
  );
  h *= 1.0 - flatMask;

  // Subtle rim taper to frame the geological strata diorama skirt cleanly
  const rimT = Math.max(smoothstep(9.6, 10.35, Math.abs(x)), smoothstep(9.0, 9.75, Math.abs(z)));
  h *= 1.0 - rimT * 0.25;

  return h;
}

/**
 * Computes 4-biome terrain splat weights:
 *  w0: Lush Medieval Meadow Grass & Wildflowers
 *  w1: Compacted Cobblestone Courtyard & Rutted Mud Wagon Road
 *  w2: Crushed Pale-Grey Limestone Quarry Dust
 *  w3: Wet Turquoise Moat Bank Moss & River Pebbles
 */
function sampleCastleBiomeWeights(x, z, h) {
  const quarryZone = 1.0 - smoothstep(2.15, 4.35, Math.hypot(x + 4.85, z + 4.7));
  const wsDust = rectFlatMask(x, z, -4.6, 4.35, 2.2, 1.8, 1.15) * 0.88;
  const wQuarry = clamp01(Math.max(quarryZone, wsDust));

  const dTrackA = segmentDist(x, z, -4.6, -2.6, -4.6, 2.9);
  const dTrackB = segmentDist(x, z, -2.5, 4.75, 3.55, 4.75);
  const dApproach = segmentDist(x, z, 3.55, 1.85, 3.55, 4.75);
  const dBridge = segmentDist(x, z, 5.7, -4.6, 8.6, -4.6);
  const pathDist = Math.min(dTrackA, dTrackB, dApproach, dBridge * 1.1);
  const castlePad = rectFlatMask(x, z, CASTLE_CENTER.x, CASTLE_CENTER.z, 2.95, 2.95, 1.15) * 0.92;
  const wCobble = clamp01(Math.max(1.0 - smoothstep(0.88, 1.98, pathDist), castlePad));

  const moatBendDist = Math.min(
    segmentDist(x, z, 5.4, -7.2, 8.1, -4.8),
    segmentDist(x, z, 8.1, -4.8, 7.6, -1.2),
    segmentDist(x, z, 3.0, -7.4, 5.4, -7.2)
  );
  const wMoat = 1.0 - smoothstep(1.35, 2.95, moatBendDist);

  const used = clamp01(wQuarry * 0.94 + wCobble * 0.92 + wMoat * 0.95);
  let w0 = Math.max(0.05, 1.0 - used);
  let w1 = wCobble * (1.0 - wMoat * 0.55);
  let w2 = wQuarry * (1.0 - wCobble * 0.45);
  let w3 = wMoat;

  const sum = w0 + w1 + w2 + w3 || 1;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(MOAT_WATER_Y - 0.04, MOAT_WATER_Y + 0.24, h);
  return { w0, w1, w2, w3, wetness: wetness * clamp01(wMoat * 1.4) };
}

/**
 * Creates a stylized European Medieval Broadleaf Oak Tree (rooted trunk + sculpted matte canopy).
 */
function createMedievalOakTree(x, z, groundY, trunkMat, foliageMat, trackGeo, seed = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.04, z);
  tree.rotation.y = (seed % 7) * 0.88;

  const trunkGroup = createRootedTrunk({
    height: 1.08 + (seed % 3) * 0.14,
    botR: 0.16,
    topR: 0.085,
    barkMat: trunkMat,
    trackGeo,
    seed,
  });
  tree.add(trunkGroup);

  const crown = new THREE.Group();
  crown.position.y = 1.02 + (seed % 3) * 0.12;
  const puffs = [
    [0.0, 0.24, 0.0, 0.58],
    [-0.36, 0.02, 0.2, 0.44],
    [0.36, 0.06, -0.18, 0.46],
    [0.14, 0.12, 0.34, 0.4],
    [-0.18, 0.04, -0.32, 0.4],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pz, r] = puffs[i];
    const puffGeo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: r,
        detail: 1,
        squashY: 0.84,
        irregularity: 0.22,
        seed: seed * 17 + i * 11,
        baseColor: '#254a24',
        midColor: '#407a34',
        topColor: '#7cb54c',
      })
    );
    const m = new THREE.Mesh(puffGeo, foliageMat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    crown.add(m);
  }
  tree.add(crown);
  return tree;
}

/**
 * Creates a stylized Medieval Forest Pine Tree (rooted trunk + 3 irregular conifer tiers).
 */
function createMedievalPineTree(x, z, groundY, trunkMat, foliageMat, trackGeo, seed = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.04, z);
  tree.rotation.y = (seed % 9) * 0.72;

  const trunkGroup = createRootedTrunk({
    height: 0.92,
    botR: 0.13,
    topR: 0.065,
    barkMat: trunkMat,
    trackGeo,
    seed: seed + 41,
  });
  tree.add(trunkGroup);

  const tiers = [
    { y: 0.78, rb: 0.58, rt: 0.14, h: 0.72 },
    { y: 1.24, rb: 0.44, rt: 0.1, h: 0.66 },
    { y: 1.66, rb: 0.3, rt: 0.03, h: 0.58 },
  ];
  tiers.forEach((t, idx) => {
    const geo = trackGeo(
      createIrregularConiferTierGeo({
        radiusBottom: t.rb,
        radiusTop: t.rt,
        height: t.h,
        radialSegments: 8,
        heightSegments: 2,
        jaggedness: 0.24,
        droop: 0.06,
        seed: seed * 19 + idx * 7,
        baseColor: '#1e3c24',
        midColor: '#316236',
        topColor: '#5c9446',
      })
    );
    const m = new THREE.Mesh(geo, foliageMat);
    m.position.y = t.y;
    m.castShadow = true;
    m.receiveShadow = true;
    tree.add(m);
  });
  return tree;
}

/**
 * Builds a pointed conical medieval slate turret spire ("poivrière") with overhanging eave lip
 * and bottom clearance (+0.002) to sit cleanly atop corner stone towers with zero z-fighting.
 */
function createConicalTurretRoofGeometry(radius = 0.62, height = 1.18, radialSegs = 12) {
  const geo = new THREE.ConeGeometry(radius, height, radialSegs, 1, false);
  // Shift base to local y = -BLOCK_H * 0.5 + 0.002 so it sits flush on top of the tower below!
  geo.translate(0, -BLOCK_H * 0.5 + height * 0.5 + 0.002, 0);
  // World-scale radial slate shingle UV density
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * 3.0, uv.getY(i) * 2.2);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Level8Castle extends Level1Pyramid {
  static meta = {
    id: 'level8_castle',
    title: 'Niveau 8 : Le Château Fort Médiéval',
    hudLabel: 'Château Fort',
    totalGoal: 56,
    rewardCoins: 320,
    rewardTokens: 40,
  };

  constructor(options) {
    super(options);
  }

  _beforeBuild() {
    this.castle = this.textures.ensureMedievalPack();
    this.cartWheels = [];
    this.pennants = [];
    this.torchFlames = [];
    this.moatWaterMesh = null;
    this.cozyFoliageSystem = null;
    this.drawbridgeGroup = null;
    this.curtainCrestGroup = null;
    this.slotGridMap = new Map();
    this.victorySparkTimer = 0;
  }

  _initSharedGeometries() {
    super._initSharedGeometries();
    this.geos.rawBlock = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.94, BLOCK_H * 0.94, BLOCK_D * 0.94));
    this.geos.carvedBlock = this._trackGeo(new THREE.BoxGeometry(BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.ghostBox = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.97, BLOCK_H * 0.97, BLOCK_D * 0.97));
    this.geos.ghostBoxEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostBox));
    this.geos.unitBox = this._trackGeo(new THREE.BoxGeometry(1, 1, 1));

    // Conical dark-blue slate turret spire (poivrière) + compact preview for workbench/carts
    this.geos.turretSpire = this._trackGeo(createConicalTurretRoofGeometry(0.64, 1.24, 12));
    this.geos.turretSpirePreview = this._trackGeo(createConicalTurretRoofGeometry(0.48, 0.72, 12));
    this.geos.ghostSpire = this._trackGeo(createConicalTurretRoofGeometry(0.61, 1.18, 10));
    this.geos.ghostSpireEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostSpire, 20));

    // Pitched slate Keep roof preview (placed Keep roofs weld seamlessly via ConnectedMasonryCache!)
    this.geos.keepRoofPreview = this._trackGeo(
      this.masonryCache.getPitchedRoofGeometry(BLOCK_W * 0.94, BLOCK_H * 0.92, BLOCK_D * 0.94, 0, {
        style: 'gable',
        defaultAxis: 'z',
        eaveOverhang: 0.02,
      })
    );
    this.geos.ghostKeepRoof = this._trackGeo(
      this.masonryCache.getPitchedRoofGeometry(BLOCK_W * 0.97, BLOCK_H * 1.12, BLOCK_D * 0.97, 0, {
        style: 'gable',
        defaultAxis: 'z',
        eaveOverhang: 0.02,
      })
    );
    this.geos.ghostKeepRoofEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostKeepRoof, 22));

    // Fluttering heraldic pennant flag geometry (4x2 segments for smooth wind wave)
    this.geos.pennantFlag = this._trackGeo(new THREE.PlaneGeometry(0.62, 0.24, 4, 1));
    this.geos.pennantFlag.translate(0.31, 0, 0);

    // Medieval wooden iron-rimmed cart wheel
    this.geos.cartWheel = this._trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.085, 14));
    this.geos.cartWheel.rotateZ(Math.PI / 2);

    // Medieval dust, slate chips & royal celebration particle materials
    this.mats.dustStone = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xdad5ca, transparent: true, opacity: 0.88 })
    );
    this.mats.dustSlate = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0x527298, transparent: true, opacity: 0.84 })
    );
    this.mats.royalSpark = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.95 })
    );
    this.mats.crimsonConfetti = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xd42d34, transparent: true, opacity: 0.92 })
    );
    this.mats.oakBark = this._trackMat(
      new THREE.MeshStandardMaterial({ color: '#5d432c', roughness: 0.92, metalness: 0.02 })
    );
    this.mats.medievalFoliage = this._trackMat(createMatteFoliageMaterial());
  }

  getTerrainHeight(x, z) {
    return sampleCastleTerrainHeight(x, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 MEDIEVAL HILLTOP, MOAT, DRAWBRIDGE & PALISADE DIORAMA
   * ========================================================================== */
  _buildDioramaBase() {
    const base = new THREE.Group();

    const terrainGeo = this._trackGeo(
      new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEGS, TERRAIN_SEGS)
    );
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const count = pos.count;
    const splat = new Float32Array(count * 4);
    const wet = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = sampleCastleTerrainHeight(x, z);
      pos.setY(i, h);

      const { w0, w1, w2, w3, wetness } = sampleCastleBiomeWeights(x, z, h);
      splat[i * 4] = w0;
      splat[i * 4 + 1] = w1;
      splat[i * 4 + 2] = w2;
      splat[i * 4 + 3] = w3;
      wet[i] = wetness;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wet, 1));
    terrainGeo.computeVertexNormals();

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.castle.materials.terrainSplat);
    this.terrainMesh.receiveShadow = true;
    base.add(this.terrainMesh);

    // Geological cross-section plinth skirt framing the floating medieval valley diorama
    const skirtBottom = -1.95;
    const hw = TERRAIN_W * 0.5;
    const hd = TERRAIN_D * 0.5;
    const segs = 40;
    const skirtPositions = [];
    const skirtUVs = [];
    const skirtIndices = [];

    const addEdgeStrip = (getXZ) => {
      const baseIdx = skirtPositions.length / 3;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const [ex, ez] = getXZ(u);
        const topY = sampleCastleTerrainHeight(ex, ez) + 0.015;
        skirtPositions.push(ex, topY, ez);
        skirtUVs.push(u * 4, 1);
        skirtPositions.push(ex, skirtBottom, ez);
        skirtUVs.push(u * 4, 0);
      }
      for (let i = 0; i < segs; i++) {
        const a = baseIdx + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        skirtIndices.push(a, b, c, b, d, c);
      }
    };

    addEdgeStrip((u) => [-hw + u * TERRAIN_W, hd]);
    addEdgeStrip((u) => [hw, hd - u * TERRAIN_D]);
    addEdgeStrip((u) => [hw - u * TERRAIN_W, -hd]);
    addEdgeStrip((u) => [-hw, -hd + u * TERRAIN_D]);

    const skirtGeo = this._trackGeo(new THREE.BufferGeometry());
    skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
    skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUVs, 2));
    skirtGeo.setIndex(skirtIndices);
    skirtGeo.computeVertexNormals();

    this.plinthSkirtMesh = new THREE.Mesh(skirtGeo, this.castle.materials.castleBaseStone);
    this.plinthSkirtMesh.castShadow = true;
    this.plinthSkirtMesh.receiveShadow = true;
    base.add(this.plinthSkirtMesh);

    const bottomCap = new THREE.Mesh(
      this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D)),
      this.castle.materials.castleBaseStone
    );
    bottomCap.rotation.x = Math.PI / 2;
    bottomCap.position.y = skirtBottom;
    base.add(bottomCap);

    // Turquoise Moat / River Bend & Small Wooden Drawbridge Approach in the North-East
    this._buildMoatAndDrawbridge(base);

    // Stylized Oaks, Pines, Wooden Palisade Stakes, Boulders & Heraldic Banners
    this._buildMedievalPerimeterScenery(base);

    this.root.add(base);
  }

  _buildMoatAndDrawbridge(parent) {
    const moatGroup = new THREE.Group();

    // Sculpted curving turquoise moat water plane sitting cleanly inside the NE river channel
    const waterGeo = this._trackGeo(new THREE.PlaneGeometry(7.6, 8.2, 16, 16));
    waterGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(waterGeo, this.castle.materials.moatWater);
    waterMesh.position.set(6.55, MOAT_WATER_Y, -4.65);
    waterMesh.receiveShadow = true;
    moatGroup.add(waterMesh);
    this.moatWaterMesh = waterMesh;

    // Small wooden drawbridge approach spanning the NE moat bend toward the outer meadow
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(7.45, MOAT_WATER_Y + 0.34, -4.55);
    bridgeGroup.rotation.y = -0.22;

    // Stone bridge abutments anchoring both riverbanks
    const abutGeo = this._trackGeo(new THREE.BoxGeometry(0.62, 0.56, 1.38));
    [-1.48, 1.48].forEach((ax) => {
      const ab = new THREE.Mesh(abutGeo, this.castle.materials.castleBaseStone);
      ab.position.set(ax, -0.14, 0);
      ab.castShadow = true;
      ab.receiveShadow = true;
      bridgeGroup.add(ab);
    });

    // Hewn oak bridge deck planks
    const plankGeo = this._trackGeo(new THREE.BoxGeometry(0.24, 0.09, 1.18));
    for (let i = -5; i <= 5; i++) {
      const plank = new THREE.Mesh(plankGeo, this.castle.materials.oakTimber);
      plank.position.set(i * 0.27, 0.14, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }

    // Timber bridge railings & support posts
    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.1, 0.56, 0.1));
    const railGeo = this._trackGeo(new THREE.BoxGeometry(2.86, 0.08, 0.08));
    [-0.56, 0.56].forEach((rz) => {
      [-1.3, 0, 1.3].forEach((px) => {
        const post = new THREE.Mesh(postGeo, this.castle.materials.darkOak);
        post.position.set(px, 0.38, rz);
        post.castShadow = true;
        bridgeGroup.add(post);
      });
      const rail = new THREE.Mesh(railGeo, this.castle.materials.darkOak);
      rail.position.set(0, 0.62, rz);
      rail.castShadow = true;
      bridgeGroup.add(rail);
    });

    moatGroup.add(bridgeGroup);

    // Mossy riverbank boulders framing the moat shoreline
    const boulderGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.38, 0));
    [
      [4.2, -7.8, 1.15],
      [5.5, -8.3, 0.9],
      [8.8, -6.5, 1.25],
      [9.2, -3.1, 1.05],
      [6.4, -2.5, 0.85],
      [8.6, -1.3, 0.95],
    ].forEach(([bx, bz, s], idx) => {
      const b = new THREE.Mesh(boulderGeo, this.castle.materials.castleBaseStone);
      b.position.set(bx, sampleCastleTerrainHeight(bx, bz) + 0.14 * s, bz);
      b.scale.set(s * 1.15, s * 0.72, s);
      b.rotation.set(idx * 0.4, idx * 1.1, idx * 0.25);
      b.castShadow = true;
      b.receiveShadow = true;
      moatGroup.add(b);
    });

    parent.add(moatGroup);
  }

  _buildMedievalPerimeterScenery(parent) {
    const contactEntries = [];

    // Stylized Medieval Oak & Pine Trees framing the hillside valley
    const oaks = [
      [-8.8, -7.8, 11],
      [-9.3, -1.8, 19],
      [-8.7, 6.9, 27],
      [0.4, -8.3, 33],
      [8.9, 6.2, 41],
      [9.3, 1.6, 47],
    ];
    oaks.forEach(([tx, tz, seed]) => {
      const gy = sampleCastleTerrainHeight(tx, tz);
      const oak = createMedievalOakTree(
        tx,
        tz,
        gy,
        this.mats.oakBark,
        this.mats.medievalFoliage,
        (g) => this._trackGeo(g),
        seed
      );
      parent.add(oak);
      contactEntries.push({ x: tx, z: tz, radius: 0.95 });
    });

    const pines = [
      [-7.2, -8.6, 53],
      [-2.0, -8.5, 61],
      [2.4, -8.7, 67],
      [8.9, -7.9, 73],
      [-9.2, 2.2, 79],
      [7.4, 7.2, 83],
    ];
    pines.forEach(([tx, tz, seed]) => {
      const gy = sampleCastleTerrainHeight(tx, tz);
      const pine = createMedievalPineTree(
        tx,
        tz,
        gy,
        this.mats.oakBark,
        this.mats.medievalFoliage,
        (g) => this._trackGeo(g),
        seed
      );
      parent.add(pine);
      contactEntries.push({ x: tx, z: tz, radius: 0.78 });
    });

    // Wooden Palisade Stakes guarding the western & southern hilltop approach
    const stakeGeo = this._trackGeo(new THREE.CylinderGeometry(0.04, 0.085, 0.96, 6));
    const railGeo = this._trackGeo(new THREE.BoxGeometry(1.75, 0.08, 0.06));
    const palisadeRuns = [
      { x0: -8.6, z0: 1.0, x1: -8.6, z1: 5.8, count: 11 },
      { x0: -1.8, z0: 7.7, x1: 2.2, z1: 7.7, count: 9 },
      { x0: 5.2, z0: 7.5, x1: 8.1, z1: 7.5, count: 7 },
    ];
    palisadeRuns.forEach((run) => {
      for (let i = 0; i < run.count; i++) {
        const t = run.count > 1 ? i / (run.count - 1) : 0;
        const sx = THREE.MathUtils.lerp(run.x0, run.x1, t);
        const sz = THREE.MathUtils.lerp(run.z0, run.z1, t);
        const sy = sampleCastleTerrainHeight(sx, sz);
        const stake = new THREE.Mesh(stakeGeo, this.castle.materials.darkOak);
        stake.position.set(sx, sy + 0.42, sz);
        stake.rotation.z = ((i % 3) - 1) * 0.04;
        stake.castShadow = true;
        parent.add(stake);
      }
      const midX = (run.x0 + run.x1) * 0.5;
      const midZ = (run.z0 + run.z1) * 0.5;
      const runLen = Math.hypot(run.x1 - run.x0, run.z1 - run.z0);
      const crossRail = new THREE.Mesh(railGeo, this.castle.materials.oakTimber);
      crossRail.scale.x = runLen / 1.75;
      crossRail.position.set(midX, sampleCastleTerrainHeight(midX, midZ) + 0.52, midZ);
      crossRail.rotation.y = Math.atan2(-(run.z1 - run.z0), run.x1 - run.x0);
      parent.add(crossRail);
    });

    // Fluttering Crimson-and-Gold Medieval Banners on wooden standards around perimeter
    const poleGeo = this._trackGeo(new THREE.CylinderGeometry(0.032, 0.042, 1.95, 6));
    const finialGeo = this._trackGeo(new THREE.SphereGeometry(0.07, 8, 6));
    [
      [1.2, 3.1, 0.3],
      [5.9, 3.1, 1.7],
      [-1.8, -4.4, 2.9],
      [6.4, -3.5, 4.1],
    ].forEach(([bx, bz, phase]) => {
      const by = sampleCastleTerrainHeight(bx, bz);
      const pole = new THREE.Mesh(poleGeo, this.castle.materials.darkOak);
      pole.position.set(bx, by + 0.96, bz);
      pole.castShadow = true;
      parent.add(pole);

      const tip = new THREE.Mesh(finialGeo, this.castle.materials.royalGold);
      tip.position.set(bx, by + 1.96, bz);
      parent.add(tip);

      const flag = new THREE.Mesh(this.geos.pennantFlag, this.castle.materials.royalCrimson);
      flag.position.set(bx, by + 1.72, bz);
      flag.castShadow = true;
      parent.add(flag);
      this.pennants.push({ mesh: flag, baseY: by + 1.72, phase });
    });

    // Cozy 3D Instanced Grass Tufts, Pebbles & Wildflowers on grassy banks (never on roads or buildings!)
    this.cozyFoliageSystem = createCozyGroundFoliageSystem({
      parent,
      getTerrainHeight: sampleCastleTerrainHeight,
      waterLevel: MOAT_WATER_Y + 0.08,
      isBlocked: (gx, gz) => {
        const h = sampleCastleTerrainHeight(gx, gz);
        if (h < MOAT_WATER_Y + 0.14) return true;
        const bw = sampleCastleBiomeWeights(gx, gz, h);
        return bw.w1 > 0.28 || bw.w2 > 0.28;
      },
      getGrassWeight: (gx, gz) => {
        const h = sampleCastleTerrainHeight(gx, gz);
        return sampleCastleBiomeWeights(gx, gz, h).w0;
      },
      grassCount: 950,
      pebbleCount: 110,
      flowerCount: 90,
      grassPalette: ['#4a8234', '#3c6f2f', '#5a943c', '#7fb044', '#2e5826'],
      seed: 808,
    });

    contactEntries.push({ x: CASTLE_CENTER.x, z: CASTLE_CENTER.z, radius: 3.1 });
    contactEntries.push({ x: -4.6, z: 4.35, radius: 2.3 });
    this.contactShadows = createContactShadowSystem(parent, contactEntries, sampleCastleTerrainHeight);
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE PIERRE DE TAILLE (NORTH-WEST)
   *    Stepped grey-limestone cliff, 3 extractable rock nodes & 5 tracked storage slots
   * ========================================================================== */
  _buildQuarryStation() {
    const qGroup = new THREE.Group();
    this.quarryNodes = [];
    this.quarrySlots = [];

    // Stepped grey-limestone cliff terrace backdrop framing the medieval quarry
    const cliffLayers = [
      { pos: [-5.1, -6.55], size: [6.4, 2.05, 1.9], mat: this.castle.materials.rawQuarryStone },
      { pos: [-5.5, -5.65], size: [4.8, 1.15, 1.5], mat: this.castle.materials.castleBaseStone },
      { pos: [-2.7, -5.8], size: [2.2, 1.35, 1.4], mat: this.castle.materials.rawQuarryStone },
    ];
    cliffLayers.forEach((l) => {
      const m = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(...l.size)), l.mat);
      const gy = sampleCastleTerrainHeight(l.pos[0], l.pos[1]);
      m.position.set(l.pos[0], gy + l.size[1] * 0.44, l.pos[1]);
      m.castShadow = true;
      m.receiveShadow = true;
      qGroup.add(m);
    });

    // Medieval timber quarry crane & rope pulley frame behind the rock nodes
    const craneY = sampleCastleTerrainHeight(-7.4, -5.0);
    const mast = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.18, 2.35, 0.18)),
      this.castle.materials.darkOak
    );
    mast.position.set(-7.35, craneY + 1.15, -5.05);
    mast.castShadow = true;
    qGroup.add(mast);

    const jib = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.15, 0.14, 0.14)),
      this.castle.materials.oakTimber
    );
    jib.position.set(-6.45, craneY + 2.15, -5.05);
    jib.rotation.z = 0.14;
    jib.castShadow = true;
    qGroup.add(jib);

    const pulley = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10)),
      this.castle.materials.wroughtIron
    );
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(-5.55, craneY + 2.18, -5.05);
    qGroup.add(pulley);

    // 3 Extractable Grey-Limestone Quarry Rock Nodes
    const rockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.68, 0));
    const subRockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.42, 0));
    const hitGeo = this._trackGeo(new THREE.SphereGeometry(1.12, 10, 8));
    const hitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    const nodePositions = [
      [-6.25, -4.85],
      [-4.65, -5.12],
      [-3.05, -4.82],
    ];
    nodePositions.forEach(([nx, nz], idx) => {
      const ny = sampleCastleTerrainHeight(nx, nz);
      const g = new THREE.Group();
      g.position.set(nx, ny + 0.52, nz);

      const core = new THREE.Mesh(rockGeo, this.castle.materials.rawQuarryStone);
      core.scale.set(1.1, 0.88, 0.96);
      core.rotation.set(0.2 + idx * 0.4, idx * 1.1, 0.12);
      core.castShadow = true;
      core.receiveShadow = true;
      g.add(core);

      const sub = new THREE.Mesh(subRockGeo, this.castle.materials.castleBaseStone);
      sub.position.set(0.36 * (idx % 2 === 0 ? 1 : -1), -0.18, 0.24);
      sub.castShadow = true;
      g.add(sub);

      const hitbox = new THREE.Mesh(hitGeo, hitMat);
      g.add(hitbox);
      qGroup.add(g);

      const nodeObj = {
        index: idx,
        id: `castle_quarry_${idx}`,
        group: g,
        mesh: core,
        basePos: new THREE.Vector3(nx, ny + 0.52, nz),
        baseScale: new THREE.Vector3(1.1, 0.88, 0.96),
        hits: 0,
        maxHits: this.quarryMaxHits,
        depleted: false,
        regenTimer: 0,
        shakeTime: 0,
      };
      hitbox.userData.interact = { type: 'quarry-node', node: nodeObj };
      core.userData.interact = { type: 'quarry-node', node: nodeObj };
      this.quarryNodes.push(nodeObj);
    });

    // Quarry Output Staging Pad (5 explicitly tracked ground slots; raycast disabled on pad!)
    const outPadY = sampleCastleTerrainHeight(-4.6, -3.28);
    const outPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.45, 0.14, 1.42)),
      this.castle.materials.castleBaseStone
    );
    outPad.position.set(-4.6, outPadY + 0.07, -3.28);
    outPad.receiveShadow = true;
    outPad.castShadow = true;
    outPad.raycast = () => {};
    qGroup.add(outPad);

    for (let i = 0; i < 5; i++) {
      const sx = -6.6 + i * 1.0;
      const sz = -3.28;
      const marker = this._createSlotMarker(qGroup, sx, outPadY + 0.155, sz);
      this.quarrySlots.push({
        id: `quarry_${i}`,
        zoneType: 'quarry',
        accepts: ['raw'],
        position: new THREE.Vector3(sx, outPadY + 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: outPadY + 0.15,
        marker,
        occupied: false,
        block: null,
      });
    }

    this.root.add(qGroup);
  }

  _getRawBlockMaterial() {
    return this.castle.materials.rawQuarryStone;
  }

  /* ============================================================================
   * 3. ZONE 2 — LES CHARIOTS MÉDIÉVAUX SUR RAILS DE BOIS (OAK & WROUGHT IRON)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();

    const oakMat = this.castle.materials.oakTimber;
    const darkOakMat = this.castle.materials.darkOak;
    const ironMat = this.castle.materials.wroughtIron;

    for (let i = 0; i < this.sleds.length; i++) {
      const sled = this.sleds[i];
      const g = sled.group;
      if (!g) continue;

      g.traverse((child) => {
        if (!child.isMesh) return;
        if (!child.visible || (child.material && child.material.visible === false)) return;
        if (child.userData && child.userData.interact && child.userData.interact.type === 'sled-lever') {
          child.material = ironMat;
        } else {
          child.material = darkOakMat;
        }
      });

      const isTrackA = sled.axis === 'z';
      const deckW = isTrackA ? (this.sledCapacity === 4 ? 3.5 : 3.16) : 1.08;
      const deckD = isTrackA ? 1.08 : (this.sledCapacity === 4 ? 3.5 : 3.16);

      // Heavy iron-banded medieval oak cart bed cleanly above frame
      const flatbed = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(deckW, 0.06, deckD)),
        oakMat
      );
      flatbed.position.y = 0.255;
      flatbed.castShadow = true;
      flatbed.receiveShadow = true;
      g.add(flatbed);

      // Forged wrought-iron corner bands gripping the medieval cart ends
      const bandGeo = this._trackGeo(
        new THREE.BoxGeometry(isTrackA ? deckW + 0.05 : 0.1, 0.09, isTrackA ? 0.1 : deckD + 0.05)
      );
      [-1, 1].forEach((side) => {
        const band = new THREE.Mesh(bandGeo, ironMat);
        if (isTrackA) band.position.set(0, 0.23, side * (deckD * 0.5 + 0.02));
        else band.position.set(side * (deckW * 0.5 + 0.02), 0.23, 0);
        g.add(band);
      });

      // Twin timber guide rails running cleanly along each wagon corridor (using startPos/endPos!)
      const span = Math.abs(sled.endPos - sled.startPos) + 2.3;
      const midV = (sled.startPos + sled.endPos) * 0.5;
      const railGeo = this._trackGeo(
        isTrackA ? new THREE.BoxGeometry(0.11, 0.075, span) : new THREE.BoxGeometry(span, 0.075, 0.11)
      );
      [-0.44, 0.44].forEach((rOff) => {
        const rail = new THREE.Mesh(railGeo, darkOakMat);
        if (isTrackA) rail.position.set(sled.fixedCoord + rOff, 0.085, midV);
        else rail.position.set(midV, 0.085, sled.fixedCoord + rOff);
        rail.receiveShadow = true;
        this.root.add(rail);
      });

      // 4 Rotating Iron-Rimmed Medieval Oak Wheels
      const wheelOffsets = isTrackA
        ? [[-1.18, -0.44], [1.18, -0.44], [-1.18, 0.44], [1.18, 0.44]]
        : [[-0.44, -1.18], [0.44, -1.18], [-0.44, 1.18], [0.44, 1.18]];
      wheelOffsets.forEach(([wx, wz]) => {
        const w = new THREE.Mesh(this.geos.cartWheel, ironMat);
        w.position.set(wx, 0.08, wz);
        if (!isTrackA) w.rotation.y = Math.PI / 2;
        w.castShadow = true;
        g.add(w);
        this.cartWheels.push({ mesh: w, sled, lastCoord: isTrackA ? g.position.z : g.position.x });
      });
    }
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DU MAÎTRE TAILLEUR MÉDIÉVAL (SW — OPEN-TOP VISIBILITY!)
   *    Recessed rear-35% pitched slate roof with raycast disabled on roof meshes
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const wx = -4.6;
    const wz = 4.35;
    const wy = sampleCastleTerrainHeight(wx, wz);

    // Compacted stone-flagged stonemason lodge floor
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.35, 0.16, 3.65)),
      this.castle.materials.castleBaseStone
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.castShadow = true;
    ws.add(floor);

    // Half-timber & ashlar stone rear wall behind the anvil (never obstructs top-down view)
    const backWall = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.15, 1.68, 0.26)),
      this.castle.materials.castleAshlar
    );
    backWall.position.set(wx, wy + 0.92, wz - 1.65);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    ws.add(backWall);

    // Hewn medieval oak corner timber posts supporting the recessed rear overhang
    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.18, 2.02, 0.18));
    [
      [wx - 2.02, wz - 1.62],
      [wx + 2.02, wz - 1.62],
      [wx - 2.02, wz - 0.56],
      [wx + 2.02, wz - 0.56],
    ].forEach(([cx, cz]) => {
      const post = new THREE.Mesh(postGeo, this.castle.materials.darkOak);
      post.position.set(cx, wy + 1.08, cz);
      post.castShadow = true;
      ws.add(post);
    });

    // OPEN-TOP / CUTAWAY SLATE AWNING: covers ONLY rear ~34% edge behind the workbench!
    // Raycast explicitly disabled on ALL canopy meshes so tapping/dragging the block is 100% unobstructed.
    const canopyGroup = new THREE.Group();
    const rearBeam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.42, 0.14, 0.16)),
      this.castle.materials.darkOak
    );
    rearBeam.position.set(wx, wy + 2.06, wz - 0.58);
    canopyGroup.add(rearBeam);

    const rearSlateRoof = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.56, 0.13, 1.32)),
      this.castle.materials.conicalSlate
    );
    rearSlateRoof.position.set(wx, wy + 2.26, wz - 1.18);
    rearSlateRoof.rotation.x = 0.24;
    rearSlateRoof.castShadow = true;
    canopyGroup.add(rearSlateRoof);

    const ridgeCap = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.6, 0.1, 0.14)),
      this.castle.materials.wroughtIron
    );
    ridgeCap.position.set(wx, wy + 2.44, wz - 1.78);
    canopyGroup.add(ridgeCap);

    canopyGroup.traverse((obj) => {
      if (obj.isMesh) obj.raycast = () => {};
    });
    ws.add(canopyGroup);

    // Master Stonemason Oak-and-Stone Carving Anvil directly in the sunlit open front bay
    const benchX = wx - 0.52;
    const benchZ = wz + 0.35;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.52, 0.6, 1.48)),
      this.castle.materials.darkOak
    );
    benchBase.position.set(benchX, wy + 0.46, benchZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchSlab = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.42, 0.1, 1.38)),
      this.castle.materials.castleAshlar
    );
    benchSlab.position.set(benchX, wy + 0.8, benchZ);
    benchSlab.receiveShadow = true;
    ws.add(benchSlab);

    // Decorative medieval mason's mallet & iron chisel resting beside the anvil
    const chisel = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.36)),
      this.castle.materials.wroughtIron
    );
    chisel.position.set(benchX + 0.54, wy + 0.87, benchZ + 0.36);
    chisel.rotation.y = 0.48;
    ws.add(chisel);

    const wbMarker = this._createSlotMarker(ws, benchX, wy + 0.86, benchZ);
    this.workbenchSlot = {
      id: 'workbench',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(benchX, wy + 0.85 + BLOCK_H * 0.5, benchZ),
      dropIndicatorY: wy + 0.86,
      marker: wbMarker,
      occupied: false,
      block: null,
    };

    // Generous invisible carve-swipe hitbox over the stonemason anvil
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.92, 1.35, 1.92));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(benchX, wy + 1.3, benchZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Carving Progress Pips floating above the stonemason anvil
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xffd56a,
          emissive: 0xd98a1f,
          emissiveIntensity: 0.65,
          roughness: 0.28,
        })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(benchX + (i - 1) * 0.36, wy + 2.02, benchZ - 0.55);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Dressed Stone Output Slots on the East side of the open workshop floor
    this.outputSlots = [];
    [
      [benchX + 1.48, wz - 0.52],
      [benchX + 1.48, wz + 0.64],
    ].forEach(([ox, oz], idx) => {
      const oMarker = this._createSlotMarker(ws, ox, wy + 0.175, oz);
      this.outputSlots.push({
        id: `ws_out_${idx}`,
        zoneType: 'workshop_output',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(ox, wy + 0.16 + BLOCK_H * 0.5, oz),
        dropIndicatorY: wy + 0.17,
        marker: oMarker,
        block: null,
      });
    });

    // 4 Staging Slots at the East end of Track B (leading straight up to the Castle Gate)
    const stageX = 3.55;
    const stageZ = 3.55;
    const stageY = sampleCastleTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.65, 0.14, 2.35)),
      this.castle.materials.castleBaseStone
    );
    stagePad.position.set(stageX, stageY + 0.07, stageZ);
    stagePad.receiveShadow = true;
    stagePad.castShadow = true;
    stagePad.raycast = () => {};
    ws.add(stagePad);

    this.stagingSlots = [];
    [
      [-0.64, -0.56],
      [0.64, -0.56],
      [-0.64, 0.56],
      [0.64, 0.56],
    ].forEach(([dx, dz], idx) => {
      const sx = stageX + dx;
      const sz = stageZ + dz;
      const sMarker = this._createSlotMarker(ws, sx, stageY + 0.155, sz);
      this.stagingSlots.push({
        id: `staging_${idx}`,
        zoneType: 'staging',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(sx, stageY + 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: stageY + 0.15,
        marker: sMarker,
        block: null,
      });
    });

    this.root.add(ws);
  }

  /* ============================================================================
   * 5. ZONE 4 — CHANTIER DU CHÂTEAU FORT MÉDIÉVAL (EAST — 56 BLOCKS, 4 TIERS)
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidCenter = new THREE.Vector3(CASTLE_CENTER.x, 0, CASTLE_CENTER.z);
    const pc = this.pyramidCenter;
    const site = new THREE.Group();

    // Heavy battered limestone foundation terrace resting solidly atop the rocky motte
    const padSpan = 5 * CASTLE_STEP + 0.42;
    const basePlinth = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(padSpan, FOUNDATION_Y, padSpan)),
      this.castle.materials.castleBaseStone
    );
    basePlinth.position.set(pc.x, FOUNDATION_Y * 0.5, pc.z);
    basePlinth.receiveShadow = true;
    basePlinth.castShadow = true;
    site.add(basePlinth);

    // Compacted cobblestone inner castle courtyard bailey floor (+0.008 lift, zero z-fighting)
    const courtFloor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.3, 0.04, 3.3)),
      this.castle.materials.cobbleCourt
    );
    courtFloor.position.set(pc.x, FOUNDATION_Y + 0.012, pc.z);
    courtFloor.receiveShadow = true;
    site.add(courtFloor);

    // Lowered Oak Drawbridge (Pont-Levis) & Iron Hoist Chains at the South Gatehouse Entrance
    this.drawbridgeGroup = new THREE.Group();
    const dbZ = pc.z + 2 * CASTLE_STEP + 0.72;
    const dbDeck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.12, 0.09, 1.08)),
      this.castle.materials.oakTimber
    );
    dbDeck.position.set(pc.x, FOUNDATION_Y - 0.06, dbZ);
    dbDeck.rotation.x = 0.24;
    dbDeck.castShadow = true;
    dbDeck.receiveShadow = true;
    this.drawbridgeGroup.add(dbDeck);

    // Twin forged-iron drawbridge chains angling up toward the portcullis archway
    const chainGeo = this._trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 1.15, 6));
    [-0.46, 0.46].forEach((cx) => {
      const chain = new THREE.Mesh(chainGeo, this.castle.materials.wroughtIron);
      chain.position.set(pc.x + cx, FOUNDATION_Y + 0.46, dbZ - 0.14);
      chain.rotation.x = 0.54;
      this.drawbridgeGroup.add(chain);
    });
    site.add(this.drawbridgeGroup);

    // Twin flickering iron wall torches flanking the castle gate approach
    const torchPostGeo = this._trackGeo(new THREE.CylinderGeometry(0.04, 0.055, 0.78, 6));
    const flameGeo = this._trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    [-1.12, 1.12].forEach((tx, idx) => {
      const tz = pc.z + 2 * CASTLE_STEP + 0.62;
      const post = new THREE.Mesh(torchPostGeo, this.castle.materials.wroughtIron);
      post.position.set(pc.x + tx, FOUNDATION_Y + 0.36, tz);
      post.castShadow = true;
      site.add(post);

      const flame = new THREE.Mesh(flameGeo, this.castle.materials.torchGlow);
      flame.position.set(pc.x + tx, FOUNDATION_Y + 0.82, tz);
      site.add(flame);
      this.torchFlames.push({ mesh: flame, phase: idx * 1.9 });
    });

    // Subtle stone crenellation coping revealed along the outer flanking curtain walls when Tier 2 completes
    this.curtainCrestGroup = new THREE.Group();
    this.curtainCrestGroup.visible = false;
    const merlonGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.22));
    const flankingWallSpots = [
      // North flank merlons
      [-1, -2, 'nz'], [1, -2, 'nz'],
      // West flank merlons
      [-2, -1, 'nx'], [-2, 1, 'nx'],
      // East flank merlons
      [2, -1, 'px'], [2, 1, 'px'],
    ];
    flankingWallSpots.forEach(([gx, gz, face]) => {
      const wx = pc.x + this._mx(gx * CASTLE_STEP);
      const wz = pc.z + gz * CASTLE_STEP;
      const topY = FOUNDATION_Y + 2 * BLOCK_H + 0.11;
      [-0.25, 0.25].forEach((off) => {
        const m = new THREE.Mesh(merlonGeo, this.castle.materials.crenellationStone);
        if (face === 'nz') {
          m.position.set(wx + off, topY, wz - BLOCK_D * 0.36);
        } else if (face === 'nx') {
          m.rotation.y = Math.PI / 2;
          m.position.set(wx - BLOCK_W * 0.36, topY, wz + off);
        } else {
          m.rotation.y = Math.PI / 2;
          m.position.set(wx + BLOCK_W * 0.36, topY, wz + off);
        }
        m.castShadow = true;
        this.curtainCrestGroup.add(m);
      });
    });
    site.add(this.curtainCrestGroup);

    // =========================================================================
    // EXACT 56-BLOCK MEDIEVAL FORTRESS BLUEPRINT (18 + 16 + 14 + 8 = 56 BLOCKS)
    // =========================================================================
    const blueprint = [];

    // TIER 1 (layer 0, gy = 0) — 18 Blocks: Assises des Remparts & Pont-Levis
    const tier1Cells = [
      // 4 Corner Tower Plinths
      [-2, -2, 'rampart_base'],
      [2, -2, 'rampart_base'],
      [-2, 2, 'rampart_base'],
      [2, 2, 'rampart_base'],
      // 11 Outer Curtain Wall Bases
      [-1, -2, 'rampart_base'],
      [0, -2, 'rampart_base'],
      [1, -2, 'rampart_base'],
      [-2, -1, 'rampart_base'],
      [-2, 0, 'rampart_base'],
      [-2, 1, 'rampart_base'],
      [2, -1, 'rampart_base'],
      [2, 0, 'rampart_base'],
      [2, 1, 'rampart_base'],
      [-1, 2, 'rampart_base'],
      [1, 2, 'rampart_base'],
      // 1 Front Drawbridge Gatehouse Threshold
      [0, 2, 'gate_threshold'],
      // 2 Central Keep (Donjon) Foundation Piers inside the courtyard
      [0, -1, 'rampart_base'],
      [0, 0, 'rampart_base'],
    ];
    tier1Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 0, gx, gy: 0, gz, pieceType });
    });

    // TIER 2 (layer 1, gy = 1) — 16 Blocks: Courtines, Porte à Herse & Tours d'Angle
    const tier2Cells = [
      // 4 Projecting Corner Towers
      [-2, -2, 'corner_tower'],
      [2, -2, 'corner_tower'],
      [-2, 2, 'corner_tower'],
      [2, 2, 'corner_tower'],
      // 9 Arrow-Slit & Ashlar Curtain Walls (North, West, East)
      [-1, -2, 'arrow_slit'],
      [0, -2, 'curtain_wall'],
      [1, -2, 'arrow_slit'],
      [-2, -1, 'curtain_wall'],
      [-2, 0, 'arrow_slit'],
      [-2, 1, 'curtain_wall'],
      [2, -1, 'curtain_wall'],
      [2, 0, 'arrow_slit'],
      [2, 1, 'curtain_wall'],
      // 3 Front Gatehouse Bay (flanking arrow-slit bastions + Iron Portcullis Gate!)
      [-1, 2, 'arrow_slit'],
      [0, 2, 'gate_portcullis'],
      [1, 2, 'arrow_slit'],
    ];
    tier2Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 1, gx, gy: 1, gz, pieceType });
    });

    // TIER 3 (layer 2, gy = 1..3) — 14 Blocks: Chemin de Ronde Crénelé & Donjon Central
    const tier3Cells = [
      // 4 Upper Corner Tower Drum Tiers (gy = 2)
      [-2, 2, -2, 'corner_tower'],
      [2, 2, -2, 'corner_tower'],
      [-2, 2, 2, 'corner_tower'],
      [2, 2, 2, 'corner_tower'],
      // 4 Crenellated Battlement Crowns on Cardinal Ramparts & Gatehouse (gy = 2)
      [0, 2, -2, 'battlement'],
      [-2, 2, 0, 'battlement'],
      [2, 2, 0, 'battlement'],
      [0, 2, 2, 'battlement'],
      // 6 Towering Central Keep (Donjon) Hall & Arrow-Slit Levels (gy = 1, 2, 3)
      [0, 1, -1, 'keep_wall'],
      [0, 1, 0, 'keep_wall'],
      [0, 2, -1, 'keep_wall'],
      [0, 2, 0, 'arrow_slit'],
      [0, 3, -1, 'keep_wall'],
      [0, 3, 0, 'arrow_slit'],
    ];
    tier3Cells.forEach(([gx, gy, gz, pieceType]) => {
      blueprint.push({ layer: 2, gx, gy, gz, pieceType });
    });

    // TIER 4 (layer 3, gy = 2..4) — 8 Blocks: Toitures Coniques en Ardoise & Bannières Royales
    const tier4Cells = [
      // 4 Pointed Conical Dark-Blue Slate Corner Turret Roofs (poivrières, gy = 3)
      [-2, 3, -2, 'turret_spire'],
      [2, 3, -2, 'turret_spire'],
      [-2, 3, 2, 'turret_spire'],
      [2, 3, 2, 'turret_spire'],
      // 2 Welded Steep Dark-Blue Slate Pitched Roofs crowning the Central Donjon (gy = 4)
      [0, 4, -1, 'keep_roof'],
      [0, 4, 0, 'keep_roof'],
      // 2 Steep Dark-Blue Slate Gatehouse Flanking Roofs (gy = 2)
      [-1, 2, 2, 'keep_roof'],
      [1, 2, 2, 'keep_roof'],
    ];
    tier4Cells.forEach(([gx, gy, gz, pieceType]) => {
      blueprint.push({ layer: 3, gx, gy, gz, pieceType });
    });

    this.pyramidSlots = [];
    this.slotGridMap.clear();
    this.activeLayer = 0;
    this.maxLayerIndex = 3;

    blueprint.forEach((cell, idx) => {
      const worldX = pc.x + this._mx(cell.gx * CASTLE_STEP);
      const layerBaseY = FOUNDATION_Y + cell.gy * BLOCK_H;
      const worldY = layerBaseY + BLOCK_H * 0.5;
      const worldZ = pc.z + cell.gz * CASTLE_STEP;

      const isSpire = cell.pieceType === 'turret_spire';
      const isKeepRoof = cell.pieceType === 'keep_roof';

      const ghostGroup = new THREE.Group();
      ghostGroup.position.set(worldX, worldY, worldZ);

      const gGeo = isSpire
        ? this.geos.ghostSpire
        : isKeepRoof
          ? this.geos.ghostKeepRoof
          : this.geos.ghostBox;
      const eGeo = isSpire
        ? this.geos.ghostSpireEdges
        : isKeepRoof
          ? this.geos.ghostKeepRoofEdges
          : this.geos.ghostBoxEdges;

      const ghostFill = new THREE.Mesh(gGeo, this.mats.ghostFill);
      const ghostEdges = new THREE.LineSegments(eGeo, this.mats.ghostEdge);
      ghostGroup.add(ghostFill);
      ghostGroup.add(ghostEdges);
      ghostGroup.visible = cell.layer === 0;
      site.add(ghostGroup);

      const slot = {
        id: `castle_${cell.layer}_${idx}`,
        zoneType: 'pyramid',
        layer: cell.layer,
        gridX: cell.gx,
        gridY: cell.gy,
        gridZ: cell.gz,
        pieceType: cell.pieceType,
        accepts: ['carved'],
        isCapstone: false,
        position: new THREE.Vector3(worldX, worldY, worldZ),
        dropIndicatorY: layerBaseY + 0.04,
        ghostGroup,
        ghostFill,
        ghostEdges,
        block: null,
      };

      this.pyramidSlots.push(slot);
      this.slotGridMap.set(`${cell.gx},${cell.gy},${cell.gz}`, slot);
    });

    this.totalGoal = this.pyramidSlots.length;
    this.root.add(site);
  }

  /* ============================================================================
   * 6. ZERO-GAP CONNECTED MASONRY, CRENELLATIONS & SEAMLESS SLATE ROOF MERGING
   * ========================================================================== */
  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.032 };
  }

  _isConnectableMasonrySlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        slot.pieceType !== 'keep_roof' &&
        slot.pieceType !== 'turret_spire'
    );
  }

  _computeMasonryNeighborMask(slot) {
    let mask = 0;
    const dirs = [
      [1, 0, 0, NEIGHBOR_PX],
      [-1, 0, 0, NEIGHBOR_NX],
      [0, 0, 1, NEIGHBOR_PZ],
      [0, 0, -1, NEIGHBOR_NZ],
      [0, 1, 0, NEIGHBOR_PY],
      [0, -1, 0, NEIGHBOR_NY],
    ];
    for (const [dx, dy, dz, bit] of dirs) {
      const nb = this.slotGridMap.get(`${slot.gridX + dx},${slot.gridY + dy},${slot.gridZ + dz}`);
      if (nb && nb.block && this._isConnectableMasonrySlot(nb)) {
        mask |= bit;
      }
    }
    return mask;
  }

  _updateConnectedMasonryAround(slot) {
    if (!slot || slot.gridX === undefined || slot.gridZ === undefined) return;
    const { gridX: gx, gridY: gy, gridZ: gz } = slot;
    const candidates = [
      slot,
      this.slotGridMap.get(`${gx + 1},${gy},${gz}`),
      this.slotGridMap.get(`${gx - 1},${gy},${gz}`),
      this.slotGridMap.get(`${gx},${gy},${gz + 1}`),
      this.slotGridMap.get(`${gx},${gy},${gz - 1}`),
      this.slotGridMap.get(`${gx},${gy + 1},${gz}`),
      this.slotGridMap.get(`${gx},${gy - 1},${gz}`),
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]) this._applyConnectedMasonry(candidates[i]);
    }
    this._onConnectedMasonryUpdated(slot);
  }

  _onConnectedMasonryUpdated(_slot) {
    // Reveal outer curtain-wall stone merlons automatically as soon as Tier 2 completes!
    if (this.curtainCrestGroup && !this.curtainCrestGroup.visible) {
      const tier2Done = this.pyramidSlots
        .filter((s) => s.layer === 1)
        .every((s) => Boolean(s.block));
      if (tier2Done) {
        this.curtainCrestGroup.visible = true;
      }
    }
  }

  _shouldForgeCapstone() {
    return false;
  }

  _pickNextCarvedPieceType() {
    const remaining = this.pyramidSlots.filter((s) => s.layer === this.activeLayer && !s.block);
    if (remaining.some((s) => s.pieceType === 'turret_spire')) return 'turret_spire';
    if (remaining.some((s) => s.pieceType === 'keep_roof')) return 'keep_roof';
    if (remaining.some((s) => s.pieceType === 'battlement')) return 'battlement';
    if (remaining.some((s) => s.pieceType === 'keep_wall')) return 'keep_wall';
    if (remaining.some((s) => s.pieceType === 'gate_portcullis')) return 'gate_portcullis';
    if (remaining.some((s) => s.pieceType === 'corner_tower')) return 'corner_tower';
    if (remaining.some((s) => s.pieceType === 'arrow_slit')) return 'arrow_slit';
    if (remaining.some((s) => s.pieceType === 'curtain_wall')) return 'curtain_wall';
    if (remaining.some((s) => s.pieceType === 'gate_threshold')) return 'gate_threshold';
    return 'rampart_base';
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyCastlePieceVisual(block, pieceType, false);
    }
    return stillRaw;
  }

  _clearCustomBlockAttachments(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  _applyCastlePieceVisual(block, pieceType, isPlaced = false) {
    block.pieceType = pieceType;
    this._clearCustomBlockAttachments(block);

    if (pieceType === 'turret_spire') {
      block.mesh.geometry = isPlaced ? this.geos.turretSpire : this.geos.turretSpirePreview;
      block.mesh.material = this.castle.materials.conicalSlate;
      if (isPlaced) {
        this._attachTurretFinialAndPennant(block);
      }
      return;
    }

    if (pieceType === 'keep_roof') {
      block.mesh.geometry = this.geos.keepRoofPreview;
      block.mesh.material = this.castle.materials.conicalSlate;
      return;
    }

    if (pieceType === 'battlement') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.castle.materials.crenellationStone;
      if (isPlaced) {
        this._attachBattlementMerlons(block);
      }
      return;
    }

    if (pieceType === 'gate_portcullis') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.castle.materials.portcullisOak;
      return;
    }

    if (pieceType === 'arrow_slit') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.castle.materials.arrowSlitStone;
      return;
    }

    if (pieceType === 'corner_tower' || pieceType === 'keep_wall' || pieceType === 'curtain_wall') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.castle.materials.castleAshlar;
      return;
    }

    if (pieceType === 'gate_threshold') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.castle.materials.oakTimber;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = this.castle.materials.castleBaseStone;
  }

  _isRoofSlot(slot) {
    return Boolean(slot && slot.block && slot.pieceType === 'keep_roof');
  }

  _computeRoofNeighborMask(slot) {
    if (!this._isRoofSlot(slot)) return 0;
    const { gridX: gx, gridY: gy, gridZ: gz } = slot;
    let mask = 0;
    if (this._isRoofSlot(this.slotGridMap.get(`${gx + 1},${gy},${gz}`))) mask |= NEIGHBOR_PX;
    if (this._isRoofSlot(this.slotGridMap.get(`${gx - 1},${gy},${gz}`))) mask |= NEIGHBOR_NX;
    if (this._isRoofSlot(this.slotGridMap.get(`${gx},${gy},${gz + 1}`))) mask |= NEIGHBOR_PZ;
    if (this._isRoofSlot(this.slotGridMap.get(`${gx},${gy},${gz - 1}`))) mask |= NEIGHBOR_NZ;
    return mask;
  }

  _applyConnectedRoof(slot) {
    if (!this._isRoofSlot(slot)) return;
    const mask = this._computeRoofNeighborMask(slot);
    const defaultAxis = slot.gridY >= 4 ? 'z' : 'x';
    slot.block.roofMask = mask;
    slot.block.mesh.rotation.set(0, 0, 0);
    slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
      BLOCK_W,
      BLOCK_H * 1.15,
      BLOCK_D,
      mask,
      { style: 'gable', defaultAxis, eaveOverhang: 0.03 }
    );

    // Crown the Central Donjon (gy === 4, gz === 0) with the Grand Royal Standard!
    if (slot.gridY >= 4 && slot.gridZ === 0 && !slot.block.customAttach) {
      const stdGroup = new THREE.Group();
      const pole = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.025, 0.032, 0.96, 6)),
        this.castle.materials.royalGold
      );
      pole.position.set(0, BLOCK_H * 0.68 + 0.45, 0);
      stdGroup.add(pole);

      const flag = new THREE.Mesh(this.geos.pennantFlag, this.castle.materials.royalCrimson);
      flag.scale.set(1.22, 1.25, 1);
      flag.position.set(0, BLOCK_H * 0.68 + 0.78, 0);
      stdGroup.add(flag);
      this.pennants.push({ mesh: flag, baseY: flag.position.y, phase: 0.6 });

      slot.block.mesh.add(stdGroup);
      slot.block.customAttach = stdGroup;
    }
  }

  _updateConnectedRoofAround(slot) {
    if (!slot || slot.pieceType !== 'keep_roof') return;
    const { gridX: gx, gridY: gy, gridZ: gz } = slot;
    const candidates = [
      slot,
      this.slotGridMap.get(`${gx + 1},${gy},${gz}`),
      this.slotGridMap.get(`${gx - 1},${gy},${gz}`),
      this.slotGridMap.get(`${gx},${gy},${gz + 1}`),
      this.slotGridMap.get(`${gx},${gy},${gz - 1}`),
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]) this._applyConnectedRoof(candidates[i]);
    }
  }

  /**
   * Crowns each conical slate turret spire (poivrière) with a forged finial spike & fluttering royal pennant.
   */
  _attachTurretFinialAndPennant(block) {
    const group = new THREE.Group();
    const peakY = -BLOCK_H * 0.5 + 1.24;

    const spike = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.015, 0.032, 0.56, 6)),
      this.castle.materials.wroughtIron
    );
    spike.position.y = peakY + 0.24;
    group.add(spike);

    const orb = new THREE.Mesh(
      this._trackGeo(new THREE.SphereGeometry(0.055, 8, 6)),
      this.castle.materials.royalGold
    );
    orb.position.y = peakY + 0.52;
    group.add(orb);

    const pennant = new THREE.Mesh(this.geos.pennantFlag, this.castle.materials.royalCrimson);
    pennant.scale.set(0.86, 0.85, 1);
    pennant.position.set(0, peakY + 0.36, 0);
    group.add(pennant);
    this.pennants.push({ mesh: pennant, baseY: pennant.position.y, phase: (block.id || 1) * 1.3 });

    block.mesh.add(group);
    block.customAttach = group;
  }

  /**
   * Adds sculpted medieval stone merlons & créneaux battlements along top outer edges (zero overlap!).
   */
  _attachBattlementMerlons(block) {
    const group = new THREE.Group();
    const yTop = BLOCK_H * 0.5 + 0.125;
    const edgeOff = BLOCK_W * 0.36;

    // 4 crisp corner/edge crenellation merlons with generous embrasure slots between them
    [
      [-0.28, -edgeOff, 0.3, 0.22],
      [0.28, -edgeOff, 0.3, 0.22],
      [-0.28, edgeOff, 0.3, 0.22],
      [0.28, edgeOff, 0.3, 0.22],
    ].forEach(([mx, mz, sx, sz]) => {
      const merlon = new THREE.Mesh(this.geos.unitBox, this.castle.materials.crenellationStone);
      merlon.scale.set(sx, 0.24, sz);
      merlon.position.set(mx, yTop, mz);
      merlon.castShadow = true;
      merlon.receiveShadow = true;
      group.add(merlon);
    });

    block.mesh.add(group);
    block.customAttach = group;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyCastlePieceVisual(block, slot.pieceType, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const dustMat =
      slot.pieceType === 'turret_spire' || slot.pieceType === 'keep_roof'
        ? this.mats.dustSlate
        : this.mats.dustStone;

    this._spawnParticles(slot.position, {
      count: 10,
      material: dustMat,
      speed: 2.2,
      upSpeed: 2.8,
      scale: 0.9,
      life: 0.5,
    });
  }

  /* ============================================================================
   * 7. COMPLETION CELEBRATION (+320 PIÈCES D'OR, +40 ÉCLATS, SUNBEAMS & BANNERS)
   * ========================================================================== */
  _triggerCompletionSequence() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    if (this.curtainCrestGroup) this.curtainCrestGroup.visible = true;

    const pc = this.pyramidCenter;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(pc.x, FOUNDATION_Y + 3.6, pc.z);

    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.56, 1.95, 7.2, 18, 1, true));
    innerGeo.translate(0, 2.9, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffe99e,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.98, 2.6, 6.6, 18, 1, true));
    outerGeo.translate(0, 2.6, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffd27a,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.95, 1.85, 30));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffde78,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.3;
    this.victoryGroup.add(this.victoryHalo);

    this.root.add(this.victoryGroup);

    // Royal golden trumpet sparkle & crimson heraldic celebration burst
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 3.0, pc.z), {
      count: 26,
      material: this.mats.royalSpark,
      speed: 3.6,
      upSpeed: 4.4,
      scale: 0.92,
      life: 1.2,
    });
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 2.5, pc.z), {
      count: 18,
      material: this.mats.crimsonConfetti,
      speed: 3.1,
      upSpeed: 3.8,
      scale: 0.85,
      life: 1.1,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level8Castle.meta.id,
        focusPoint: new THREE.Vector3(pc.x, FOUNDATION_Y + 2.15, pc.z),
        rewardCoins: 320,
        firstCompletionTokens: 40,
      });
    }
  }

  /* ============================================================================
   * 8. REAL-TIME ANIMATION LOOP (CART WHEELS, MOAT WATER, PENNANTS & TORCHES)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Rotate iron-rimmed wooden cart wheels smoothly along timber tracks
    for (let i = 0; i < this.cartWheels.length; i++) {
      const cw = this.cartWheels[i];
      const coord = cw.sled.axis === 'z' ? cw.sled.group.position.z : cw.sled.group.position.x;
      const delta = coord - cw.lastCoord;
      cw.lastCoord = coord;
      if (Math.abs(delta) > 0.0001) {
        cw.mesh.rotation.x += delta / 0.18;
      }
    }

    // 2. Gentle animated sunlight water ripple across the turquoise castle moat
    if (this.moatWaterMesh && this.moatWaterMesh.material && this.moatWaterMesh.material.normalMap) {
      this.moatWaterMesh.material.normalMap.offset.x = (elapsed * 0.02) % 1;
      this.moatWaterMesh.material.normalMap.offset.y = (elapsed * 0.014) % 1;
    }

    // 3. Fluttering royal crimson-and-gold castle pennants in the valley breeze
    for (let i = 0; i < this.pennants.length; i++) {
      const p = this.pennants[i];
      p.mesh.rotation.y = Math.sin(elapsed * 3.1 + p.phase) * 0.24;
      p.mesh.rotation.z = Math.cos(elapsed * 2.4 + p.phase) * 0.06;
    }

    // 4. Warm flickering torches flanking the drawbridge entrance
    for (let i = 0; i < this.torchFlames.length; i++) {
      const t = this.torchFlames[i];
      const flicker = 0.88 + Math.sin(elapsed * 9.5 + t.phase) * 0.14;
      t.mesh.scale.set(flicker * 0.95, flicker * 1.18, flicker * 0.95);
    }

    // 5. Cozy 3D grass wind sway
    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.update === 'function') {
      this.cozyFoliageSystem.update(elapsed);
    }

    // 6. Post-completion royal golden celebration sparkles
    if (this.isComplete) {
      this.victorySparkTimer += dt;
      if (this.victorySparkTimer >= 0.7) {
        this.victorySparkTimer = 0;
        const pc = this.pyramidCenter;
        this._spawnParticles(
          new THREE.Vector3(
            pc.x + (Math.random() - 0.5) * 3.4,
            FOUNDATION_Y + 2.2 + Math.random() * 1.4,
            pc.z + (Math.random() - 0.5) * 2.8
          ),
          {
            count: 3,
            material: Math.random() < 0.6 ? this.mats.royalSpark : this.mats.crimsonConfetti,
            speed: 0.75,
            upSpeed: 1.6,
            scale: 0.68,
            life: 1.0,
          }
        );
      }
    }
  }

  dispose() {
    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.dispose === 'function') {
      this.cozyFoliageSystem.dispose();
      this.cozyFoliageSystem = null;
    }
    if (this.contactShadows && typeof this.contactShadows.dispose === 'function') {
      this.contactShadows.dispose();
      this.contactShadows = null;
    }
    super.dispose();
  }
}
