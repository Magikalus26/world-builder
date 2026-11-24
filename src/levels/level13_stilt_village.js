/**
 * Workd Builder — Level 13: Lakeside & Lagoon Era ("Le Village sur Pilotis")
 *
 * Built on an expanded 192x192 wide-spacing lagoon terrain board (42x38 world units),
 * optimized for locked 60 FPS on iPhone 16e Safari (390x844, devicePixelRatio capped at 2).
 *
 * Composition (114 blocks across 4 multi-part stilt-village zones, buildable in ANY order):
 *  - Structure A — La Grande Maison sur Pilotis du Chef (NE Lagoon Focal Point, 26 blocks):
 *      10 elevated stilt deck & South veranda blocks -> 8 woven bamboo walls ->
 *      6 lower palm-thatch roof blocks -> 2 upper peaked palm-thatch roof blocks + carved finials.
 *  - Structure B — Les 4 Maisons sur Pilotis Espacées (4 × 14 = 56 blocks):
 *      4 widely spaced lagoon stilt dwellings (`stilt_nw`, `stilt_cw`, `stilt_ce`, `stilt_south`),
 *      each with 5 elevated stilt deck + porch blocks, 4 woven bamboo walls & 5 welded palm-thatch roofs.
 *  - Structure C — La Tour de Guet & Phare Lagunaire (SE Lagoon Edge, 14 blocks):
 *      4 stilt deck -> 4 timber shaft & ladder trim -> 4 lookout gallery & glowing beacon -> 2 peaked thatch roof.
 *  - Structure D — Le Réseau de Pontons en Bois sur l'Eau (18 blocks):
 *      18 elevated wooden boardwalk pier modules on dark hardwood pilings bridging the Shoreline Staging
 *      Dock, all 4 spaced stilt houses, the SE Watchtower, and the NE Chief's Lodge.
 *  - Bottom Zone Selector Bar ("Tout", "Maison du Chef", "4 Maisons Pilotis", "Pontons & Tour")
 *    smoothly glides camera focus and filters/highlights active blueprint slots using equipped skins.
 */

import * as THREE from 'three';
import { Level1Pyramid } from './level1_pyramid.js';
import { getLevelTierSpec } from './cityLevelBuilder.js';
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
  createRootedTrunk,
} from '../foliageAndGround.js';

const BASE_TIER_SPEC = getLevelTierSpec(13);
const TIER_SPEC = {
  ...BASE_TIER_SPEC,
  terrainSegments: 192,
  boardWidth: 42.0,
  boardDepth: 38.0,
};

const TERRAIN_W = TIER_SPEC.boardWidth;         // 42.0 (Wide-Spacing Lagoon Board)
const TERRAIN_D = TIER_SPEC.boardDepth;         // 38.0
const TERRAIN_SEGS = TIER_SPEC.terrainSegments; // 192x192 sculpted lagoon mesh

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const GRID_STEP = BLOCK_W;

const WATER_LEVEL = 0.0;
const SHORE_Y = 0.42;
const DECK_TOP_Y = 0.88;
const DECK_BLOCK_H = 0.36; // House/Tower stilt deck: [0.52 .. 0.88] flush with boardwalks!
const PIER_W = 1.65;
const PIER_D = 1.65;
const PIER_H = 0.24;       // Boardwalk pier deck: [0.64 .. 0.88]

const CHIEF_CENTER = { x: 10.6, z: -8.15 };
const TOWER_CENTER = { x: 14.85, z: 7.8 };
const STAGE_CENTER = { x: 0.35, z: 7.8 };

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

function rectFlatMask(x, z, cx, cz, hw, hd, feather = 1.5) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return 1.0 - smoothstep(0, feather, Math.hypot(dx, dz));
}

/**
 * Computes the organic curving shoreline x-coordinate dividing the West dry peninsula
 * from the vast Central & Eastern crystal-turquoise lagoon.
 */
function shorelineXAtZ(z) {
  // Dry shore extends out to x ≈ 1.4 around the South Staging Pier (z ≈ 7.8) and recedes NW
  const pierCape = (1.0 - smoothstep(2.2, 6.2, Math.abs(z - 7.8))) * 3.15;
  const nwCape = smoothstep(-5.5, -14.5, z) * 2.2;
  const wave = Math.sin(z * 0.24 + 0.5) * 0.85 + Math.cos(z * 0.42 - 0.8) * 0.38;
  return -1.45 + pierCape + nwCape + wave;
}

/**
 * Unified 192x192 Sculpted Lagoon & Stilt-Village Peninsula Heightfield.
 * West/NW Peninsula sits dry at y >= 0.42; Central & Eastern Lagoon dips smoothly beneath
 * WATER_LEVEL = 0.0 with luminous sandy shoals and outer palm sandbar islets.
 */
function sampleLagoonTerrainHeight(x, z) {
  const shoreX = shorelineXAtZ(z);
  const lagoonT = smoothstep(shoreX - 2.35, shoreX + 2.65, x);

  // West peninsula dry rolling coastal hills
  let landH =
    SHORE_Y +
    Math.sin(x * 0.19 + 0.4) * Math.cos(z * 0.17 - 0.2) * 0.16 +
    Math.sin(x * 0.41 - z * 0.33) * 0.04;

  // Coastal stone & hardwood quarry ridge in the North-West & Western hillside
  const nwCliff = smoothstep(-13.8, -19.2, x) * smoothstep(-4.0, -13.2, z) * 2.15;
  const northRidge = smoothstep(-12.6, -18.2, z) * smoothstep(2.0, -8.5, x) * 1.45;
  const westRidge = smoothstep(-16.0, -20.4, x) * 1.15;
  const swBank = smoothstep(12.2, 18.0, z) * smoothstep(2.5, -9.0, x) * 0.85;
  landH += nwCliff + northRidge + westRidge + swBank;

  // Shallow sandy quarry extraction hollow in front of NW cliff
  const qPitDist = Math.hypot((x + 14.6) * 0.82, (z + 10.2) * 0.92);
  landH -= (1.0 - smoothstep(1.5, 3.8, qPitDist)) * 0.24;

  // Turquoise lagoon seabed with subtle luminous sandy shoals
  const shoalRipple =
    Math.sin(x * 0.26 + z * 0.21) * 0.14 + Math.cos(x * 0.44 - z * 0.36) * 0.07;
  let seabedH = -0.96 + shoalRipple;

  // Gentle shallow sandbars near outer lagoon perimeter (NE, Far N, SE) hosting palm islets
  const neIslet = 1.0 - smoothstep(1.4, 4.4, Math.hypot(x - 18.0, z + 15.0));
  const nIslet = 1.0 - smoothstep(1.2, 3.8, Math.hypot(x - 5.2, z + 16.4));
  const seIslet = 1.0 - smoothstep(1.5, 4.5, Math.hypot(x - 18.2, z - 15.2));
  const swSandbar = 1.0 - smoothstep(1.4, 3.9, Math.hypot(x - 9.4, z - 16.2));
  const isletMask = clamp01(Math.max(neIslet, nIslet, seIslet, swSandbar));
  seabedH += isletMask * 1.38;

  let h = landH * (1.0 - lagoonT) + seabedH * lagoonT;

  // Flatten the 4-station logistics & workshop pads cleanly on the dry West peninsula
  const flatMask = clamp01(
    Math.max(
      rectFlatMask(x, z, -13.4, -6.4, 3.1, 2.0, 1.4),  // Quarry output storage pad
      rectFlatMask(x, z, -13.4, 0.6, 2.0, 5.6, 1.25),  // Track A corridor
      rectFlatMask(x, z, -13.4, 7.8, 3.1, 2.6, 1.45),  // Carpenter & Stonemason Workshop
      rectFlatMask(x, z, -6.6, 7.8, 5.8, 2.0, 1.3),    // Track B corridor
      rectFlatMask(x, z, STAGE_CENTER.x, STAGE_CENTER.z, 2.35, 2.05, 1.3) // Shoreline Staging Hub
    )
  );
  h = h * (1.0 - flatMask) + SHORE_Y * flatMask;

  // Subtle tapered diorama bevel along board edge
  const rimX = smoothstep(TERRAIN_W * 0.475, TERRAIN_W * 0.5, Math.abs(x));
  const rimZ = smoothstep(TERRAIN_D * 0.475, TERRAIN_D * 0.5, Math.abs(z));
  h -= Math.max(rimX, rimZ) * (1.0 - lagoonT * 0.7) * 0.14;

  return h;
}

/**
 * Computes 4-layer Lagoon & Riverbank terrain splat weights:
 *  w0: Lush Riverbank Grass & Tropical Ferns
 *  w1: Warm Golden-Sand Beach Shorelines & Compacted Sandy Paths
 *  w2: Compacted Timber-and-Gravel Quarry & Workshop Ground
 *  w3: Submerged Turquoise Lagoon Sandbars & River Pebbles
 */
function sampleLagoonBiomeWeights(x, z, h) {
  const qYard = 1.0 - smoothstep(2.5, 5.8, Math.hypot(x + 14.0, z + 8.4));
  const wsYard = rectFlatMask(x, z, -13.4, 7.8, 2.7, 2.3, 1.4) * 0.9;
  const wQuarry = clamp01(Math.max(qYard, wsYard));

  // Sandy compacted paths linking Quarry -> Track A -> Workshop -> Track B -> Staging Dock
  const dTrackA = segmentDist(x, z, -13.4, -5.8, -13.4, 6.4);
  const dTrackB = segmentDist(x, z, -10.8, 7.8, 1.8, 7.8);
  const pathDist = Math.min(dTrackA, dTrackB);
  const wPath = 1.0 - smoothstep(0.95, 2.2, pathDist);

  // Golden beach band framing the shoreline transition (y ∈ [-0.15 .. +0.46])
  const beachBand =
    smoothstep(-0.34, 0.08, h) * (1.0 - smoothstep(0.32, 0.62, h));

  // Submerged lagoon seabed sandbars (y < 0.04)
  const wSubmerged = 1.0 - smoothstep(-0.22, 0.16, h);

  let w3 = wSubmerged;
  let w2 = wQuarry * (1.0 - wSubmerged * 0.85);
  let w1 = clamp01(Math.max(beachBand * 0.92, wPath * 0.85)) * (1.0 - wSubmerged * 0.75) * (1.0 - w2 * 0.45);
  let w0 = Math.max(0.04, 1.0 - clamp01(w1 + w2 + w3));

  const sum = w0 + w1 + w2 + w3 || 1;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(WATER_LEVEL - 0.06, WATER_LEVEL + 0.34, h);
  return { w0, w1, w2, w3, wetness };
}

/**
 * Creates a stylized curved Tropical Lagoon Palm Tree with fanning emerald fronds.
 */
function createLagoonPalmTree(x, z, groundY, trunkMat, frondMat, trackGeo, seed = 1) {
  const group = new THREE.Group();
  group.position.set(x, groundY - 0.08, z);
  const rotY = (seed * 1.73) % (Math.PI * 2);
  group.rotation.y = rotY;
  const sc = 0.88 + (seed % 4) * 0.11;
  group.scale.setScalar(sc);

  const trunk = createRootedTrunk({
    height: 2.35,
    botR: 0.17,
    topR: 0.085,
    barkMat: trunkMat,
    trackGeo,
    seed: seed + 17,
  });
  trunk.rotation.z = 0.11 + (seed % 3) * 0.035;
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(-0.26, 2.32, 0);

  // Small cluster of coconuts tucked beneath the palm crown
  const nutGeo = trackGeo(new THREE.SphereGeometry(0.11, 7, 6));
  const nutMat = trunkMat;
  for (let c = 0; c < 3; c++) {
    const ca = (c / 3) * Math.PI * 2;
    const nut = new THREE.Mesh(nutGeo, nutMat);
    nut.position.set(Math.cos(ca) * 0.13, -0.06, Math.sin(ca) * 0.13);
    crown.add(nut);
  }

  // Arching 2-segment tapered palm fronds (inner lift + outer graceful droop)
  const innerGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.96, 4));
  innerGeo.scale(1.0, 1.0, 0.22);
  innerGeo.rotateX(Math.PI * 0.5);
  innerGeo.translate(0, 0, 0.44);

  const outerGeo = trackGeo(new THREE.ConeGeometry(0.22, 1.05, 4));
  outerGeo.scale(1.0, 1.0, 0.2);
  outerGeo.rotateX(Math.PI * 0.5);
  outerGeo.translate(0, 0, 0.48);

  const frondCount = 8;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + (seed % 5) * 0.22;
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = angle;

    const inner = new THREE.Mesh(innerGeo, frondMat);
    inner.rotation.x = -0.14 + (i % 2) * 0.14;
    inner.castShadow = true;
    frondPivot.add(inner);

    const tipPivot = new THREE.Group();
    tipPivot.position.set(0, 0.08 - (i % 2) * 0.1, 0.82);
    tipPivot.rotation.x = 0.52 + (i % 2) * 0.12;
    const outer = new THREE.Mesh(outerGeo, frondMat);
    outer.castShadow = true;
    tipPivot.add(outer);
    frondPivot.add(tipPivot);

    crown.add(frondPivot);
  }
  group.add(crown);
  return group;
}

/* ============================================================================
 * LEVEL 13 — LAKESIDE & LAGOON ERA ("LE VILLAGE SUR PILOTIS")
 * ========================================================================== */
export class Level13StiltVillage extends Level1Pyramid {
  static meta = {
    id: 'level13_stilt_village',
    title: 'Niveau 13 : Lagon & Rivière — Le Village sur Pilotis',
    hudLabel: 'Village Pilotis',
    totalGoal: 114,
    tier: 1,
  };

  constructor(options = {}) {
    super(options);
    this.cameraController = options.cameraController || null;
  }

  _beforeBuild() {
    this.tierSpec = TIER_SPEC;
    this.lagoon = this.textures.ensureLagoonPack();
    this.hudLabel = Level13StiltVillage.meta.hudLabel;
    this.carvedBlockMat = this.lagoon.materials.deckPlanks;

    this.cartWheels = [];
    this.lanternGlows = [];
    this.floatingCanoes = [];
    this.placedBoardwalkBounds = [];
    this.victorySparkTimer = 0;

    // Multi-zone tracking (4 Bottom Zone Selector pills, 7 independent vertical sub-structures)
    this.villageZones = [];
    this.zoneById = new Map();
    this.subGroups = [];
    this.subGroupById = new Map();
    this.slotKeyMap = new Map();
    this.activeZoneFilter = 'all'; // 'all' | 'chief_lodge' | 'stilt_houses' | 'boardwalks_tower'

    this.zoneHudEl = null;
    this.zoneHudChips = new Map();
    this.quarryHintEl = null;
    this._quarryHintTimer = null;

    this.pyramidSnapRadius = this.upgrades.pyramidion_aura ? 1.56 : 1.28;
    this.pyramidCenter = new THREE.Vector3(8.4, DECK_TOP_Y, 1.2);

    this.lagoonGeos = {
      deckBlock: this._trackGeo(new THREE.BoxGeometry(BLOCK_W, DECK_BLOCK_H, BLOCK_D)),
      pierBlock: this._trackGeo(new THREE.BoxGeometry(PIER_W, PIER_H, PIER_D)),
      pilingPost: this._trackGeo(new THREE.CylinderGeometry(0.072, 0.088, 1.85, 7)),
      pierPilingPost: this._trackGeo(new THREE.CylinderGeometry(0.082, 0.098, 1.95, 7)),
      crossBrace: this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.88, 0.065, 0.065)),
      pierBraceX: this._trackGeo(new THREE.BoxGeometry(PIER_W * 0.86, 0.07, 0.07)),
      pierBraceZ: this._trackGeo(new THREE.BoxGeometry(0.07, 0.07, PIER_D * 0.86)),
      roofPreview: this._trackGeo(
        this.masonryCache.getPitchedRoofGeometry(BLOCK_W, BLOCK_H * 1.24, BLOCK_D, 0, {
          style: 'gable',
          defaultAxis: 'x',
          eaveOverhang: 0.06,
        })
      ),
      chiefPeakCap: this._trackGeo(
        this.masonryCache.getPitchedRoofGeometry(BLOCK_W, BLOCK_H * 1.32, BLOCK_D, 0, {
          style: 'gable',
          defaultAxis: 'x',
          eaveOverhang: 0.08,
        })
      ),
    };

    this.lagoonFxMats = {
      chipWood: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xb9915d, roughness: 0.86 })),
      chipBamboo: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xd8c38c, roughness: 0.84 })),
      chipThatch: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xc2984c, roughness: 0.9 })),
      waterSparkle: this._trackMat(
        new THREE.MeshBasicMaterial({ color: 0xaef8ff, transparent: true, opacity: 0.92 })
      ),
    };
  }

  _getRawBlockMaterial() {
    return this.lagoon ? this.lagoon.materials.rawLagoonQuarry : super._getRawBlockMaterial();
  }

  getTerrainHeight(x, z) {
    return sampleLagoonTerrainHeight(x, z);
  }

  /**
   * Returns elevated boardwalk deck surface when placing 3D decorations along built wooden
   * boardwalk piers or shoreline staging apron, otherwise returns natural shoreline terrain height.
   */
  getDecorationElevation(x, z) {
    for (let i = 0; i < this.placedBoardwalkBounds.length; i++) {
      const b = this.placedBoardwalkBounds[i];
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return DECK_TOP_Y + 0.015;
      }
    }
    return sampleLagoonTerrainHeight(x, z);
  }

  getDragBounds() {
    return {
      minX: -19.2,
      maxX: 19.2,
      minZ: -17.2,
      maxZ: 17.2,
    };
  }

  getDecorationBlockedBoxes() {
    return [
      { minX: -17.8, maxX: -10.8, minZ: -13.2, maxZ: -4.2 }, // NW Quarry & 6-slot storage pad
      { minX: -15.2, maxX: -11.4, minZ: -4.4, maxZ: 5.4 },   // Track A
      { minX: -16.4, maxX: -10.4, minZ: 5.2, maxZ: 10.6 },   // Open-Top Workshop
      { minX: -10.4, maxX: -1.8, minZ: 6.0, maxZ: 9.6 },     // Track B
      { minX: -1.8, maxX: 2.3, minZ: 6.2, maxZ: 9.4 },       // Shoreline Staging Hub
      { minX: 8.5, maxX: 12.7, minZ: -9.4, maxZ: -6.1 },     // Chief's Lodge
      { minX: 4.1, maxX: 7.4, minZ: -6.6, maxZ: -4.2 },      // Stilt House NW
      { minX: 2.5, maxX: 5.7, minZ: 0.0, maxZ: 2.4 },        // Stilt House CW
      { minX: 10.5, maxX: 13.7, minZ: 0.0, maxZ: 2.4 },      // Stilt House CE
      { minX: 3.6, maxX: 6.0, minZ: 8.6, maxZ: 11.8 },       // Stilt House South
      { minX: 13.6, maxX: 16.1, minZ: 6.6, maxZ: 9.0 },      // Lagoon Watchtower
    ];
  }

  getCameraPreset() {
    return {
      target: new THREE.Vector3(3.2, 0.5, 1.0),
      elevationDeg: 52,
      azimuth: 0.06,
      minDistance: 12.0,
      maxDistance: 78.0,
      panBounds: { minX: -17.5, maxX: 17.5, minZ: -16.0, maxZ: 16.0 },
      distanceScale: 1.56,
    };
  }

  /* ============================================================================
   * 1. SCULPTED 192x192 LAGOON TERRAIN, CRYSTAL WATER, PALMS, REEDS & CANOE
   * ========================================================================== */
  _buildDioramaBase() {
    const terrainGeo = this._trackGeo(
      new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEGS, TERRAIN_SEGS)
    );
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const splatAttr = new Float32Array(pos.count * 4);
    const wetAttr = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = sampleLagoonTerrainHeight(x, z);
      pos.setY(i, y);

      const { w0, w1, w2, w3, wetness } = sampleLagoonBiomeWeights(x, z, y);
      splatAttr[i * 4 + 0] = w0;
      splatAttr[i * 4 + 1] = w1;
      splatAttr[i * 4 + 2] = w2;
      splatAttr[i * 4 + 3] = w3;
      wetAttr[i] = wetness;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splatAttr, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetAttr, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.lagoon.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    terrainMesh.raycast = () => {};
    this.root.add(terrainMesh);

    // Geological plinth skirt framing the 42x38 lagoon board
    const skirtGeo = this._trackGeo(new THREE.BoxGeometry(TERRAIN_W, 2.2, TERRAIN_D));
    const skirt = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirt.position.set(0, -1.68, 0);
    skirt.raycast = () => {};
    this.root.add(skirt);
    this.plinthMesh = skirt;

    // Vast Crystal-Turquoise Lagoon Water Sheet with animated normal ripples
    const waterGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W - 0.16, TERRAIN_D - 0.16, 12, 12));
    waterGeo.rotateX(-Math.PI / 2);
    this.lagoonWaterMesh = new THREE.Mesh(waterGeo, this.lagoon.materials.lagoonWater);
    this.lagoonWaterMesh.position.set(0, WATER_LEVEL, 0);
    this.lagoonWaterMesh.receiveShadow = true;
    this.lagoonWaterMesh.raycast = () => {};
    this.root.add(this.lagoonWaterMesh);

    this._buildLagoonEnvironmentProps();
  }

  _buildLagoonEnvironmentProps() {
    const lm = this.lagoon.materials;
    const frondMat = this._trackMat(
      new THREE.MeshStandardMaterial({ color: '#398842', roughness: 0.78, metalness: 0.02 })
    );
    const shadowEntries = [];
    const focalPoints = [];

    // Tropical Palms along the West/NW shoreline ridge & outer lagoon sandbar islets
    const palmCoords = [
      [-18.4, -14.8],
      [-12.2, -15.6],
      [-5.6, -15.2],
      [-18.8, -6.2],
      [-18.6, 1.4],
      [-18.2, 9.8],
      [-16.4, 15.2],
      [-9.8, 15.4],
      [-3.4, 14.6],
      [5.2, -16.4],   // North lagoon islet
      [18.0, -15.0],  // NE lagoon islet
      [18.2, 15.2],   // SE lagoon islet
      [9.4, 16.2],    // South sandbar islet
    ];
    palmCoords.forEach(([px, pz], idx) => {
      const py = sampleLagoonTerrainHeight(px, pz);
      if (py < WATER_LEVEL + 0.08) return;
      const palm = createLagoonPalmTree(
        px,
        pz,
        py,
        lm.stiltPilings,
        frondMat,
        (g) => this._trackGeo(g),
        idx + 13
      );
      this.root.add(palm);
      shadowEntries.push({ x: px, z: pz, radius: 1.45, opacity: 0.36 });
      focalPoints.push({ x: px, z: pz, radius: 2.5, weight: 0.85 });
    });

    // Reed & Cattail Clusters emerging from shallow water along shoreline coves & islets
    const reedSpots = [
      [-0.6, -11.4],
      [-1.4, -6.8],
      [-1.6, -1.8],
      [-0.8, 3.2],
      [0.4, 12.6],
      [4.0, -14.2],
      [16.2, -12.8],
      [17.8, -4.4],
      [17.6, 3.2],
      [16.8, 13.0],
      [10.8, 14.2],
    ];
    const stalkGeo = this._trackGeo(new THREE.CylinderGeometry(0.025, 0.042, 1.15, 5));
    const headGeo = this._trackGeo(new THREE.CylinderGeometry(0.048, 0.048, 0.24, 6));
    reedSpots.forEach(([rx, rz], idx) => {
      const ry = sampleLagoonTerrainHeight(rx, rz);
      const cluster = new THREE.Group();
      cluster.position.set(rx, Math.max(ry, WATER_LEVEL - 0.35), rz);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + idx * 0.5;
        const r = 0.18 + (i % 3) * 0.18;
        const stalk = new THREE.Mesh(stalkGeo, lm.reedGreen);
        stalk.position.set(Math.cos(a) * r, 0.42, Math.sin(a) * r);
        stalk.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.12;
        cluster.add(stalk);

        if (i % 2 === 0) {
          const head = new THREE.Mesh(headGeo, lm.cattailBrown);
          head.position.set(Math.cos(a) * r, 0.92, Math.sin(a) * r);
          cluster.add(head);
        }
      }
      this.root.add(cluster);
    });

    // Two carved wooden lagoon pirogue canoes gently bobbing in open turquoise water
    const canoeSpots = [
      { x: 1.6, z: -2.2, rot: 0.45, phase: 0.0 },
      { x: 11.4, z: 4.5, rot: -0.68, phase: 2.1 },
    ];
    canoeSpots.forEach((cs) => {
      const canoe = new THREE.Group();
      canoe.position.set(cs.x, WATER_LEVEL + 0.05, cs.z);
      canoe.rotation.y = cs.rot;

      const hull = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(2.1, 0.24, 0.56)),
        lm.canoeWood
      );
      hull.castShadow = true;
      hull.receiveShadow = true;
      canoe.add(hull);

      [-1.08, 1.08].forEach((endX) => {
        const prow = new THREE.Mesh(
          this._trackGeo(new THREE.ConeGeometry(0.32, 0.56, 4)),
          lm.canoeWood
        );
        prow.rotation.z = endX > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
        prow.rotation.x = Math.PI * 0.25;
        prow.position.set(endX, 0.06, 0);
        canoe.add(prow);
      });

      const seat = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.32, 0.06, 0.48)),
        lm.deckPlanks
      );
      seat.position.set(0, 0.12, 0);
      canoe.add(seat);

      this.root.add(canoe);
      this.floatingCanoes.push({ group: canoe, baseY: WATER_LEVEL + 0.05, phase: cs.phase });
    });

    // Warm shoreline bamboo tiki torches framing the Lagoon Staging Pier
    [
      [STAGE_CENTER.x + 1.95, STAGE_CENTER.z - 1.35],
      [STAGE_CENTER.x + 1.95, STAGE_CENTER.z + 1.35],
    ].forEach(([tx, tz], idx) => {
      const ty = sampleLagoonTerrainHeight(tx, tz);
      const torch = new THREE.Group();
      torch.position.set(tx, ty, tz);

      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.045, 0.06, 1.55, 6)),
        lm.stiltPilings
      );
      post.position.y = 0.78;
      post.castShadow = true;
      torch.add(post);

      const flame = new THREE.Mesh(
        this._trackGeo(new THREE.OctahedronGeometry(0.14, 0)),
        lm.lanternGlow
      );
      flame.position.y = 1.64;
      torch.add(flame);
      this.lanternGlows.push({ mesh: flame, phase: idx * 1.9 });

      this.root.add(torch);
    });

    this.contactShadows = createContactShadowSystem(
      this.root,
      shadowEntries,
      (x, z) => sampleLagoonTerrainHeight(x, z)
    );

    // Instanced tropical riverbank grass & beach pebbles on dry West peninsula
    this.cozyFoliageSystem = createCozyGroundFoliageSystem({
      parent: this.root,
      getTerrainHeight: (x, z) => sampleLagoonTerrainHeight(x, z),
      isBlocked: (x, z) => {
        if (x > -2.4) return true;
        if (x > -17.4 && x < -10.0 && z > -13.0 && z < 11.2) return true;
        if (x > -11.2 && x < 2.6 && z > 5.2 && z < 10.4) return true;
        return false;
      },
      getGrassWeight: (x, z) => {
        const y = sampleLagoonTerrainHeight(x, z);
        if (y < WATER_LEVEL + 0.36) return 0;
        return 0.86;
      },
      focalPoints,
      waterLevel: WATER_LEVEL + 0.28,
      halfW: TERRAIN_W * 0.47,
      halfD: TERRAIN_D * 0.47,
      grassCount: 520,
      pebbleCount: 72,
      flowerCount: 56,
      grassPalette: ['#3d8a3c', '#4fa044', '#6ab54e', '#82c45e'],
      flowerPalette: ['#ffdb66', '#ff8c69', '#ffffff', '#f5b841'],
      seed: 1313,
    });
  }

  /* ============================================================================
   * 2. ZONE 1 — CARRIÈRE CÔTIÈRE & CHANTIER DE BOIS (NW, STRICT 6-SLOT TRACKING)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarry = new THREE.Group();
    const lm = this.lagoon.materials;
    this.quarryNodes = [];
    this.quarrySlots = [];

    const qx = -14.6;
    const qz = -10.2;

    // Stepped coastal grey-stone & weathered hardwood cliff outcrop
    [
      [-1.7, 1.25, -1.65, 3.9, 2.55, 2.45],
      [1.35, 1.0, -1.85, 3.1, 2.05, 2.05],
      [-2.55, 0.88, 0.6, 2.1, 1.65, 2.55],
    ].forEach(([ox, oy, oz, w, h, d]) => {
      const cliff = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(w, h, d)),
        lm.rawLagoonQuarry
      );
      cliff.position.set(qx + ox, oy, qz + oz);
      cliff.castShadow = true;
      cliff.receiveShadow = true;
      cliff.raycast = () => {};
      quarry.add(cliff);
    });

    // Stacked hardwood logs ready for carving beside the NW quarry
    [
      [-17.0, 0.22, -7.2],
      [-17.0, 0.22, -6.5],
      [-17.0, 0.52, -6.85],
    ].forEach(([lx, ly, lz]) => {
      const log = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.18, 0.2, 1.75, 8)),
        lm.stiltPilings
      );
      log.rotation.z = Math.PI * 0.5;
      log.position.set(lx, sampleLagoonTerrainHeight(lx, lz) + ly, lz);
      log.castShadow = true;
      log.receiveShadow = true;
      quarry.add(log);
    });

    // 3 Extractable Quarry Rock / Timber-Stone Nodes
    [
      [-1.35, 0.2],
      [0.05, -0.1],
      [1.4, 0.25],
    ].forEach(([ox, oz], idx) => {
      const nx = qx + ox;
      const nz = qz + oz;
      const ny = sampleLagoonTerrainHeight(nx, nz) + 0.36;
      const group = new THREE.Group();
      group.position.set(nx, ny, nz);

      const mesh = new THREE.Mesh(this.geos.rawBlock, lm.rawLagoonQuarry);
      mesh.scale.set(1.14, 0.88, 1.06);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const node = {
        id: `lagoon_quarry_${idx}`,
        group,
        mesh,
        basePos: new THREE.Vector3(nx, ny, nz),
        hits: 0,
        maxHits: this.quarryMaxHits,
        depleted: false,
        regenTimer: 0,
        shakeTime: 0,
      };
      group.userData.interact = { type: 'quarry-node', node };
      mesh.userData.interact = { type: 'quarry-node', node };
      quarry.add(group);
      this.quarryNodes.push(node);
    });

    // 6 Spacious Ground Quarry Output Storage Slots (3x2 grid -> zero overlapping!)
    const padCx = -13.4;
    const padCz = -6.4;
    const padY = sampleLagoonTerrainHeight(padCx, padCz);
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.3, 0.14, 2.75)),
      lm.deckPlanks
    );
    pad.position.set(padCx, padY + 0.07, padCz);
    pad.receiveShadow = true;
    pad.raycast = () => {};
    quarry.add(pad);

    [
      [-1.32, -0.68],
      [0.0, -0.68],
      [1.32, -0.68],
      [-1.32, 0.68],
      [0.0, 0.68],
      [1.32, 0.68],
    ].forEach(([ox, oz], idx) => {
      const sx = padCx + ox;
      const sz = padCz + oz;
      const marker = this._createSlotMarker(quarry, sx, padY + 0.155, sz);
      this.quarrySlots.push({
        index: idx,
        id: `quarry_slot_${idx}`,
        zoneType: 'quarry',
        accepts: ['raw'],
        position: new THREE.Vector3(sx, padY + 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: padY + 0.15,
        marker,
        occupied: false,
        block: null,
      });
    });

    this.root.add(quarry);
  }

  _findFreeQuarrySpawnSlot() {
    for (let i = 0; i < this.quarrySlots.length; i++) {
      const slot = this.quarrySlots[i];
      if (!slot || slot.occupied !== false || slot.block !== null) continue;
      if (this._isQuarrySlotBlockedByMesh(slot)) continue;
      return slot;
    }
    return undefined;
  }

  _showQuarryFullHint() {
    if (typeof document === 'undefined') return;
    const rootEl = document.getElementById('game-root') || document.body;
    if (!this.quarryHintEl) {
      const pill = document.createElement('div');
      pill.id = 'lagoon-quarry-full-hint';
      pill.style.cssText =
        'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 64px);left:50%;transform:translateX(-50%);' +
        'z-index:35;padding:7px 14px;border-radius:999px;pointer-events:none;' +
        'background:rgba(16,66,76,0.95);border:1.5px solid #59e3dc;color:#ecfffe;' +
        'font-family:var(--font-ui,system-ui,sans-serif);font-size:12px;font-weight:800;' +
        'white-space:nowrap;box-shadow:0 6px 16px rgba(0,0,0,0.42);transition:opacity 0.22s ease;';
      rootEl.appendChild(pill);
      this.quarryHintEl = pill;
    }
    this.quarryHintEl.textContent = '⛏️ Stockage plein ! Déplacez un bloc sur le chariot';
    this.quarryHintEl.style.opacity = '1';
    clearTimeout(this._quarryHintTimer);
    this._quarryHintTimer = setTimeout(() => {
      if (this.quarryHintEl) this.quarryHintEl.style.opacity = '0';
    }, 1700);
  }

  _removeQuarryFullHint() {
    clearTimeout(this._quarryHintTimer);
    this._quarryHintTimer = null;
    if (this.quarryHintEl && this.quarryHintEl.parentNode) {
      this.quarryHintEl.parentNode.removeChild(this.quarryHintEl);
    }
    this.quarryHintEl = null;
  }

  chipQuarryNode(node) {
    if (!node || node.depleted || this.isComplete) return;

    const freeSlot = this._findFreeQuarrySpawnSlot();
    if (freeSlot === undefined) {
      node.shakeTime = 0.28;
      if (this.audio && typeof this.audio.playHeavyThud === 'function') {
        this.audio.playHeavyThud();
      }
      this._spawnParticles(node.basePos, {
        count: 6,
        material: this.lagoonFxMats ? this.lagoonFxMats.chipWood : this.mats.dustLimestone,
        speed: 1.5,
        upSpeed: 2.1,
        scale: 0.72,
      });
      this._showQuarryFullHint();
      return;
    }

    super.chipQuarryNode(node);
  }

  onBlockDragStart(block) {
    const prevSlot = block ? block.slot : null;
    const res = super.onBlockDragStart(block);
    if (res && prevSlot && prevSlot.zoneType === 'quarry') {
      prevSlot.occupied = false;
      prevSlot.block = null;
    }
    return res;
  }

  onBlockDragCancel(block) {
    const origin = block ? block.originSlot : null;
    super.onBlockDragCancel(block);
    if (block && block.slot && block.slot.zoneType === 'quarry') {
      block.slot.occupied = true;
      block.slot.block = block;
    } else if (origin && origin.zoneType === 'quarry' && origin.block === block) {
      origin.occupied = true;
    }
  }

  /* ============================================================================
   * 3. ZONE 2 — CHARIOTS PORTUAIRES SUR RAILS DE BOIS (WEST SHORELINE)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    this.sleds = [];
    this.cartWheels = [];
    const leverDist = this.sledCapacity === 4 ? 2.28 : 1.82;

    // Track A: NW Quarry Storage -> SW Carpenter Workshop along X = -13.4
    this._createTrackAndSled({
      id: 'sledA',
      axis: 'z',
      fixedCoord: -13.4,
      startPos: -3.2,
      endPos: 4.1,
      trackStart: -4.05,
      trackEnd: 4.95,
      accepts: ['raw', 'carved', 'capstone'],
      primaryKind: 'raw',
      leverLocalPos: new THREE.Vector3(leverDist, 0.34, 0),
    });

    // Track B: SW Carpenter Workshop -> Lagoon Pier Staging Hub along Z = 7.8
    this._createTrackAndSled({
      id: 'sledB',
      axis: 'x',
      fixedCoord: 7.8,
      startPos: -9.4,
      endPos: -3.15,
      trackStart: -10.25,
      trackEnd: -2.35,
      accepts: ['carved', 'capstone', 'raw'],
      primaryKind: 'carved',
      leverLocalPos: new THREE.Vector3(0, 0.34, leverDist),
    });

    // Dress both dockside carts in weathered hardwood side rails, hemp rope & timber wheels
    const lm = this.lagoon.materials;
    const wheelGeo = this._trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.11, 12));
    wheelGeo.rotateZ(Math.PI * 0.5);

    this.sleds.forEach((sled) => {
      const alongX = sled.axis === 'x';
      const wheelCoords = alongX
        ? [
            [-0.95, 0.22, -0.68],
            [0.95, 0.22, -0.68],
            [-0.95, 0.22, 0.68],
            [0.95, 0.22, 0.68],
          ]
        : [
            [-0.68, 0.22, -0.95],
            [0.68, 0.22, -0.95],
            [-0.68, 0.22, 0.95],
            [0.68, 0.22, 0.95],
          ];

      wheelCoords.forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wheelGeo, lm.hardwoodDark);
        wheel.position.set(wx, wy, wz);
        if (alongX) wheel.rotation.y = Math.PI * 0.5;
        wheel.castShadow = true;
        sled.group.add(wheel);

        const rim = new THREE.Mesh(
          this._trackGeo(new THREE.TorusGeometry(0.2, 0.024, 6, 12)),
          lm.ropeHemp
        );
        rim.rotation.y = Math.PI * 0.5;
        wheel.add(rim);

        this.cartWheels.push({
          mesh: wheel,
          sled,
          lastCoord: sled.axis === 'z' ? sled.group.position.z : sled.group.position.x,
        });
      });

      [-1, 1].forEach((side) => {
        const rail = new THREE.Mesh(
          this._trackGeo(
            new THREE.BoxGeometry(alongX ? 2.48 : 0.1, 0.22, alongX ? 0.1 : 2.48)
          ),
          lm.stiltPilings
        );
        rail.position.set(alongX ? 0 : side * 0.68, 0.34, alongX ? side * 0.68 : 0);
        sled.group.add(rail);

        const rope = new THREE.Mesh(
          this._trackGeo(
            new THREE.BoxGeometry(alongX ? 2.52 : 0.12, 0.048, alongX ? 0.12 : 2.52)
          ),
          lm.ropeHemp
        );
        rope.position.set(alongX ? 0 : side * 0.68, 0.47, alongX ? side * 0.68 : 0);
        sled.group.add(rope);
      });
    });
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DU CHARPENTIER & TAILLEUR LACUSTRE (SW, OPEN-TOP!)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const lm = this.lagoon.materials;
    const wx = -13.4;
    const wz = 7.8;
    const wy = sampleLagoonTerrainHeight(wx, wz);

    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.6, 0.16, 4.0)),
      lm.deckPlanks
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.raycast = () => {};
    ws.add(floor);

    // Timber-and-palm-thatch workshop with rear ~35% cutaway roof (mesh.raycast = () => {})
    [-2.05, 2.05].forEach((ox) => {
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 2.38, 8)),
        lm.stiltPilings
      );
      post.position.set(wx + ox, wy + 1.24, wz - 1.62);
      post.castShadow = true;
      post.raycast = () => {};
      ws.add(post);
    });
    const thatchAwning = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.65, 0.22, 1.42)),
      lm.palmThatch
    );
    thatchAwning.position.set(wx, wy + 2.45, wz - 1.28);
    thatchAwning.rotation.x = 0.24;
    thatchAwning.raycast = () => {};
    ws.add(thatchAwning);

    const ridgeBeam = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 4.82, 7)),
      lm.hardwoodDark
    );
    ridgeBeam.rotation.z = Math.PI * 0.5;
    ridgeBeam.position.set(wx, wy + 2.66, wz - 1.82);
    ridgeBeam.raycast = () => {};
    ws.add(ridgeBeam);

    // Open-Top Carpenter & Stonemason Workbench Anvil (100% unobstructed from top-down camera)
    const anvilX = wx - 0.55;
    const anvilZ = wz + 0.18;
    const anvilBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.44, 0.72, 1.44)),
      lm.stiltPilings
    );
    anvilBase.position.set(anvilX, wy + 0.52, anvilZ);
    anvilBase.castShadow = true;
    anvilBase.receiveShadow = true;
    ws.add(anvilBase);

    const anvilTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.52, 0.08, 1.52)),
      lm.deckPlanks
    );
    anvilTop.position.set(anvilX, wy + 0.86, anvilZ);
    ws.add(anvilTop);

    const wbMarker = this._createSlotMarker(ws, anvilX, wy + 0.915, anvilZ);
    this.workbenchSlot = {
      id: 'workbench',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(anvilX, wy + 0.9 + BLOCK_H * 0.5 + 0.002, anvilZ),
      dropIndicatorY: wy + 0.905,
      marker: wbMarker,
      occupied: false,
      block: null,
    };

    const carveHitbox = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.78, 1.68, 1.78)),
      this._trackMat(new THREE.MeshBasicMaterial({ visible: false }))
    );
    carveHitbox.position.set(anvilX, wy + 1.24, anvilZ);
    carveHitbox.userData.interact = { type: 'workbench-carve' };
    ws.add(carveHitbox);
    this.workbenchCarveHitbox = carveHitbox;

    // 3 Golden Carving Stage Pips
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(new THREE.MeshBasicMaterial({ color: 0xffe49a }));
      const pip = new THREE.Mesh(
        this._trackGeo(new THREE.OctahedronGeometry(0.13, 0)),
        pipMat
      );
      pip.position.set(anvilX + (i - 1) * 0.42, wy + 2.02, anvilZ - 0.54);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 4 Workshop Output Slots
    this.outputSlots = [];
    [
      [1.06, -0.58],
      [1.06, 0.58],
      [2.12, -0.58],
      [2.12, 0.58],
    ].forEach(([ox, oz], idx) => {
      const sx = wx + ox;
      const sz = wz + oz;
      const oMarker = this._createSlotMarker(ws, sx, wy + 0.175, sz);
      this.outputSlots.push({
        id: `ws_out_${idx}`,
        zoneType: 'workshop_output',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(sx, wy + 0.16 + BLOCK_H * 0.5, sz),
        dropIndicatorY: wy + 0.17,
        marker: oMarker,
        occupied: false,
        block: null,
      });
    });

    // 6 Shoreline Lagoon Pier Staging Slots (cleanly clear of Track B rail end = -2.35)
    const stageX = STAGE_CENTER.x;
    const stageZ = STAGE_CENTER.z;
    const stageY = sampleLagoonTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.95, 0.22, 2.55)),
      lm.deckPlanks
    );
    stagePad.position.set(stageX, stageY + 0.11, stageZ);
    stagePad.castShadow = true;
    stagePad.receiveShadow = true;
    stagePad.raycast = () => {};
    ws.add(stagePad);

    // Timber ramp connecting Staging Pier smoothly up to the first Lagoon Boardwalk pier (x = 2.33 -> 3.15)
    const ramp = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.86, 0.14, 1.56)),
      lm.deckPlanks
    );
    ramp.position.set(stageX + 2.04, (stageY + 0.22 + DECK_TOP_Y) * 0.5 - 0.04, stageZ);
    ramp.rotation.z = 0.24;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    ramp.raycast = () => {};
    ws.add(ramp);

    this.stagingSlots = [];
    [
      [-1.18, -0.58],
      [0.0, -0.58],
      [1.18, -0.58],
      [-1.18, 0.58],
      [0.0, 0.58],
      [1.18, 0.58],
    ].forEach(([dx, dz], idx) => {
      const sx = stageX + dx;
      const sz = stageZ + dz;
      const sMarker = this._createSlotMarker(ws, sx, stageY + 0.235, sz);
      this.stagingSlots.push({
        id: `staging_${idx}`,
        zoneType: 'staging',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(sx, stageY + 0.22 + BLOCK_H * 0.5, sz),
        dropIndicatorY: stageY + 0.23,
        marker: sMarker,
        occupied: false,
        block: null,
      });
    });

    this.root.add(ws);
  }

  /* ============================================================================
   * 5. ZONE 4 — WIDE-SPACED LAGOON STILT VILLAGE (114 BLOCKS ACROSS 4 ZONES)
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidSlots = [];
    this.villageZones = [];
    this.zoneById.clear();
    this.subGroups = [];
    this.subGroupById.clear();
    this.slotKeyMap.clear();
    this.placedBoardwalkBounds = [];

    const site = new THREE.Group();
    site.name = 'StiltVillageSite';
    this.root.add(site);
    this.villageSite = site;

    // 4 Bottom Zone Selector groups ("Tout" + 3 focused Lagoon zones)
    const zoneDefs = [
      {
        id: 'chief_lodge',
        label: 'Maison du Chef',
        icon: '👑',
        focus: new THREE.Vector3(CHIEF_CENTER.x, 1.5, CHIEF_CENTER.z),
        distance: 18.5,
      },
      {
        id: 'stilt_houses',
        label: '4 Maisons Pilotis',
        icon: '🛖',
        focus: new THREE.Vector3(7.6, 0.9, 1.6),
        distance: 28.0,
      },
      {
        id: 'boardwalks_tower',
        label: 'Pontons & Tour',
        icon: '🌉',
        focus: new THREE.Vector3(9.4, 0.9, 3.2),
        distance: 27.0,
      },
    ];
    zoneDefs.forEach((zd) => {
      const z = { ...zd, slots: [], placedCount: 0, totalCount: 0 };
      this.villageZones.push(z);
      this.zoneById.set(z.id, z);
    });

    let globalSlotIdx = 0;

    const registerSubGroup = (id, zoneId, specs) => {
      const subGroup = {
        id,
        zoneId,
        slots: [],
        activeLayer: 0,
        maxLayer: 0,
        placedCount: 0,
        totalCount: 0,
        completed: false,
        completionGroup: new THREE.Group(),
      };
      subGroup.completionGroup.visible = false;
      site.add(subGroup.completionGroup);

      const zone = this.zoneById.get(zoneId);

      specs.forEach((sp) => {
        const h = sp.blockH || BLOCK_H;
        const w = sp.blockW || BLOCK_W;
        const d = sp.blockD || BLOCK_D;

        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(sp.x, sp.y + 0.02, sp.z);

        const gGeo =
          h === BLOCK_H && w === BLOCK_W && d === BLOCK_D
            ? this.geos.ghostBox
            : this._trackGeo(new THREE.BoxGeometry(w * 0.96, h * 0.96, d * 0.96));
        const gEdges =
          h === BLOCK_H && w === BLOCK_W && d === BLOCK_D
            ? this.geos.ghostBoxEdges
            : this._trackGeo(new THREE.EdgesGeometry(gGeo));

        const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
        ghostMesh.renderOrder = 5;
        const ghostLines = new THREE.LineSegments(gEdges, this.mats.ghostLineNormal);
        ghostLines.renderOrder = 6;
        ghostGroup.add(ghostMesh, ghostLines);
        ghostGroup.visible = sp.layer === 0;
        site.add(ghostGroup);

        const slot = {
          id: `${id}_L${sp.layer}_${globalSlotIdx}`,
          index: globalSlotIdx++,
          zoneType: 'pyramid',
          zoneId,
          subGroupId: id,
          subGroup,
          layer: sp.layer,
          gridX: sp.gx,
          gridY: sp.layer,
          gridZ: sp.gz,
          blockW: w,
          blockH: h,
          blockD: d,
          pieceType: sp.pieceType,
          roofAxis: sp.roofAxis || 'x',
          houseVariant: sp.houseVariant || 0,
          isCapstone: false,
          accepts: ['carved', 'capstone'],
          position: new THREE.Vector3(sp.x, sp.y, sp.z),
          dropIndicatorY: sp.y - h * 0.5 + 0.015,
          ghostGroup,
          ghostMesh,
          ghostLines,
          occupied: false,
          block: null,
        };

        this.pyramidSlots.push(slot);
        subGroup.slots.push(slot);
        if (sp.layer > subGroup.maxLayer) subGroup.maxLayer = sp.layer;
        if (zone) zone.slots.push(slot);

        this.slotKeyMap.set(`${id}:${sp.gx},${sp.layer},${sp.gz}`, slot);
      });

      subGroup.totalCount = subGroup.slots.length;
      if (zone) zone.totalCount = zone.slots.length;

      this.subGroups.push(subGroup);
      this.subGroupById.set(id, subGroup);
      return subGroup;
    };

    const deckCenterY = DECK_TOP_Y - DECK_BLOCK_H * 0.5;

    /* ------------------------------------------------------------------------
     * STRUCTURE A — LA GRANDE MAISON SUR PILOTIS DU CHEF (NE LAGOON, 26 BLOCKS!)
     *   Layer 0: 10 elevated stilt deck blocks (4x2 main lodge + 2x1 South veranda)
     *   Layer 1: 8 woven bamboo & carved timber walls (4x2)
     *   Layer 2: 6 lower palm-thatch roof tier blocks (3x2)
     *   Layer 3: 2 upper peaked palm-thatch roof blocks (2x1) + carved finials
     * ---------------------------------------------------------------------- */
    const chiefSpecs = [];
    // Layer 0 (10 blocks)
    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        chiefSpecs.push({
          gx,
          gz,
          layer: 0,
          x: CHIEF_CENTER.x + (gx - 1.5) * GRID_STEP,
          y: deckCenterY,
          z: CHIEF_CENTER.z + (gz - 0.5) * GRID_STEP,
          blockW: BLOCK_W,
          blockH: DECK_BLOCK_H,
          blockD: BLOCK_D,
          pieceType: 'stilt_deck',
        });
      }
    }
    // 2x1 South Veranda connecting directly onto Boardwalk Pier P18
    for (let gx = 1; gx <= 2; gx++) {
      chiefSpecs.push({
        gx,
        gz: 2,
        layer: 0,
        x: CHIEF_CENTER.x + (gx - 1.5) * GRID_STEP,
        y: deckCenterY,
        z: CHIEF_CENTER.z + 1.5 * GRID_STEP,
        blockW: BLOCK_W,
        blockH: DECK_BLOCK_H,
        blockD: BLOCK_D,
        pieceType: 'stilt_veranda',
      });
    }
    // Layer 1 (8 blocks): 4x2 Woven Bamboo & Reed Chief's Lodge Walls
    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        chiefSpecs.push({
          gx,
          gz,
          layer: 1,
          x: CHIEF_CENTER.x + (gx - 1.5) * GRID_STEP,
          y: DECK_TOP_Y + BLOCK_H * 0.5,
          z: CHIEF_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'chief_wall',
        });
      }
    }
    // Layer 2 (6 blocks): 3x2 Lower Palm-Thatch Roof Tier
    for (let gx = 0; gx < 3; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        chiefSpecs.push({
          gx,
          gz,
          layer: 2,
          x: CHIEF_CENTER.x + (gx - 1.0) * GRID_STEP,
          y: DECK_TOP_Y + BLOCK_H * 1.5,
          z: CHIEF_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'chief_roof_lower',
          roofAxis: 'x',
        });
      }
    }
    // Layer 3 (2 blocks): 2x1 Upper Steep Peaked Palm-Thatch Crown
    for (let gx = 0; gx < 2; gx++) {
      chiefSpecs.push({
        gx,
        gz: 0,
        layer: 3,
        x: CHIEF_CENTER.x + (gx - 0.5) * GRID_STEP,
        y: DECK_TOP_Y + BLOCK_H * 2.5,
        z: CHIEF_CENTER.z,
        pieceType: 'chief_roof_upper',
        roofAxis: 'x',
      });
    }

    const chiefSub = registerSubGroup('chief_lodge', 'chief_lodge', chiefSpecs);
    this._buildChiefLodgeCompletionDecor(chiefSub.completionGroup);

    /* ------------------------------------------------------------------------
     * STRUCTURE B — LES 4 MAISONS SUR PILOTIS ESPACÉES (4 × 14 = 56 BLOCKS!)
     * Generously separated across 4 lagoon sectors with 6–10 units of open water
     * between houses, each connected to the wooden boardwalk network.
     * ---------------------------------------------------------------------- */
    const stiltHouseConfigs = [
      {
        id: 'stilt_nw',
        cx: 5.35,
        cz: -5.4,
        porchCell: [2, 0], // East porch meeting Boardwalk P15 (8.10, -5.40)
        roofAxis: 'z',
        variant: 0,
      },
      {
        id: 'stilt_cw',
        cx: 3.7,
        cz: 1.2,
        porchCell: [2, 1], // East porch meeting Boardwalk P16 (6.45, 1.20)
        roofAxis: 'z',
        variant: 1,
      },
      {
        id: 'stilt_ce',
        cx: 12.5,
        cz: 1.2,
        porchCell: [-1, 1], // West porch meeting Boardwalk P17 (9.75, 1.20)
        roofAxis: 'z',
        variant: 2,
      },
      {
        id: 'stilt_south',
        cx: 4.8,
        cz: 10.55,
        porchCell: [0, -1], // North porch meeting Boardwalk P2 (4.80, 7.80)
        roofAxis: 'x',
        variant: 3,
      },
    ];

    stiltHouseConfigs.forEach((hc) => {
      const specs = [];
      const [pgx, pgz] = hc.porchCell;

      // Layer 0 (5 blocks): 2x2 elevated stilt plank deck + 1 boardwalk-linked porch
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          specs.push({
            gx,
            gz,
            layer: 0,
            x: hc.cx + (gx - 0.5) * GRID_STEP,
            y: deckCenterY,
            z: hc.cz + (gz - 0.5) * GRID_STEP,
            blockW: BLOCK_W,
            blockH: DECK_BLOCK_H,
            blockD: BLOCK_D,
            pieceType: 'stilt_deck',
            houseVariant: hc.variant,
          });
        }
      }
      specs.push({
        gx: pgx,
        gz: pgz,
        layer: 0,
        x: hc.cx + (pgx - 0.5) * GRID_STEP,
        y: deckCenterY,
        z: hc.cz + (pgz - 0.5) * GRID_STEP,
        blockW: BLOCK_W,
        blockH: DECK_BLOCK_H,
        blockD: BLOCK_D,
        pieceType: 'stilt_veranda',
        houseVariant: hc.variant,
      });

      // Layer 1 (4 blocks): 2x2 Bamboo & Woven Reed Walls
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          specs.push({
            gx,
            gz,
            layer: 1,
            x: hc.cx + (gx - 0.5) * GRID_STEP,
            y: DECK_TOP_Y + BLOCK_H * 0.5,
            z: hc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'house_bamboo',
            houseVariant: hc.variant,
          });
        }
      }

      // Layer 2 (5 blocks): 2x2 + 1 porch welded steep palm-thatch pitched roofs
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          specs.push({
            gx,
            gz,
            layer: 2,
            x: hc.cx + (gx - 0.5) * GRID_STEP,
            y: DECK_TOP_Y + BLOCK_H * 1.5,
            z: hc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'house_thatch',
            roofAxis: hc.roofAxis,
            houseVariant: hc.variant,
          });
        }
      }
      specs.push({
        gx: pgx,
        gz: pgz,
        layer: 2,
        x: hc.cx + (pgx - 0.5) * GRID_STEP,
        y: DECK_TOP_Y + BLOCK_H * 1.5,
        z: hc.cz + (pgz - 0.5) * GRID_STEP,
        pieceType: 'house_thatch',
        roofAxis: hc.roofAxis,
        houseVariant: hc.variant,
      });

      const sub = registerSubGroup(hc.id, 'stilt_houses', specs);
      this._buildStiltHouseCompletionDecor(sub.completionGroup, hc);
    });

    /* ------------------------------------------------------------------------
     * STRUCTURE C — LA TOUR DE GUET & PHARE LAGUNAIRE (SE LAGOON, 14 BLOCKS!)
     *   Layer 0: 4 stilt deck blocks (2x2)
     *   Layer 1: 4 timber-framed stilt tower shaft blocks (2x2)
     *   Layer 2: 4 lookout gallery & glowing warm lantern beacon blocks (2x2)
     *   Layer 3: 2 peaked palm-thatch lookout roof blocks (2x1)
     * ---------------------------------------------------------------------- */
    const towerSpecs = [];
    for (let gx = 0; gx < 2; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        towerSpecs.push({
          gx,
          gz,
          layer: 0,
          x: TOWER_CENTER.x + (gx - 0.5) * GRID_STEP,
          y: deckCenterY,
          z: TOWER_CENTER.z + (gz - 0.5) * GRID_STEP,
          blockW: BLOCK_W,
          blockH: DECK_BLOCK_H,
          blockD: BLOCK_D,
          pieceType: 'stilt_deck',
        });
      }
    }
    for (let gx = 0; gx < 2; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        towerSpecs.push({
          gx,
          gz,
          layer: 1,
          x: TOWER_CENTER.x + (gx - 0.5) * GRID_STEP,
          y: DECK_TOP_Y + BLOCK_H * 0.5,
          z: TOWER_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'tower_shaft',
        });
      }
    }
    for (let gx = 0; gx < 2; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        towerSpecs.push({
          gx,
          gz,
          layer: 2,
          x: TOWER_CENTER.x + (gx - 0.5) * GRID_STEP,
          y: DECK_TOP_Y + BLOCK_H * 1.5,
          z: TOWER_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'tower_beacon',
        });
      }
    }
    for (let gx = 0; gx < 2; gx++) {
      towerSpecs.push({
        gx,
        gz: 0,
        layer: 3,
        x: TOWER_CENTER.x + (gx - 0.5) * GRID_STEP,
        y: DECK_TOP_Y + BLOCK_H * 2.5,
        z: TOWER_CENTER.z,
        pieceType: 'tower_roof',
        roofAxis: 'x',
      });
    }
    const towerSub = registerSubGroup('watchtower', 'boardwalks_tower', towerSpecs);
    this._buildWatchtowerCompletionDecor(towerSub.completionGroup);

    /* ------------------------------------------------------------------------
     * STRUCTURE D — LE RÉSEAU DE PONTONS EN BOIS SUR L'EAU (18 BLOCKS EXACT!)
     * Elevated sun-bleached wooden boardwalk piers on dark hardwood pilings
     * linking the Shoreline Staging Hub, all 4 spaced stilt houses, the SE
     * Watchtower, and the NE Chief's Lodge.
     * ---------------------------------------------------------------------- */
    const pierCenterY = DECK_TOP_Y - PIER_H * 0.5;
    const boardwalkCells = [
      // Shoreline Staging Pier -> South-Central Crossroads (4)
      [3.15, 7.8, 0, 0],
      [4.8, 7.8, 1, 0],  // Junction -> South Stilt House
      [6.45, 7.8, 2, 0],
      [8.1, 7.8, 3, 0],  // Main Lagoon Crossroads
      // East Pier -> SE Lagoon Watchtower (3)
      [9.75, 7.8, 4, 0],
      [11.4, 7.8, 5, 0],
      [13.05, 7.8, 6, 0],
      // Main North-South Lagoon Boardwalk Spine (8)
      [8.1, 6.15, 3, -1],
      [8.1, 4.5, 3, -2],
      [8.1, 2.85, 3, -3],
      [8.1, 1.2, 3, -4],  // Central Houses Junction
      [8.1, -0.45, 3, -5],
      [8.1, -2.1, 3, -6],
      [8.1, -3.75, 3, -7],
      [8.1, -5.4, 3, -8], // North Crossroads -> NW Stilt House & NE Chief's Lodge
      // 3 Side Spurs -> CW House, CE House, and Chief's Lodge Veranda (3)
      [6.45, 1.2, 2, -4],
      [9.75, 1.2, 4, -4],
      [9.75, -5.4, 4, -8],
    ];

    const boardwalkSpecs = boardwalkCells.map(([px, pz, gx, gz]) => ({
      gx,
      gz,
      layer: 0,
      x: px,
      y: pierCenterY,
      z: pz,
      blockW: PIER_W,
      blockH: PIER_H,
      blockD: PIER_D,
      pieceType: 'boardwalk_pier',
    }));

    const boardwalkSub = registerSubGroup('boardwalks', 'boardwalks_tower', boardwalkSpecs);
    this._buildBoardwalkCompletionDecor(boardwalkSub.completionGroup, boardwalkCells);

    this.totalGoal = this.pyramidSlots.length; // Exactly 114 blocks!
    this.maxLayerIndex = 3;

    this._syncZoneGhostVisibility();
    this._mountZoneSelectorHud();
  }

  /**
   * Crowns the Chief's Stilt Lodge with carved wooden ridge finials, wrap-around veranda
   * railing posts, and hanging crimson & teal lagoon tribal banners.
   */
  _buildChiefLodgeCompletionDecor(group) {
    const lm = this.lagoon.materials;
    const cx = CHIEF_CENTER.x;
    const cz = CHIEF_CENTER.z;
    const ridgeY = DECK_TOP_Y + BLOCK_H * 2.5 + BLOCK_H * 1.32 * 0.5 - 0.04;

    const ridge = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 2.24, 0.14, 0.16)),
      lm.hardwoodDark
    );
    ridge.position.set(cx, ridgeY, cz);
    group.add(ridge);

    // Carved sweeping wooden finials at both ends of the Chief's Lodge ridge
    [-BLOCK_W * 1.16, BLOCK_W * 1.16].forEach((ox) => {
      const finial = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.11, 0.56, 5)),
        lm.hardwoodDark
      );
      finial.position.set(cx + ox, ridgeY + 0.22, cz);
      finial.rotation.z = ox > 0 ? -0.34 : 0.34;
      group.add(finial);
    });

    // Veranda hardwood balustrade posts + tribal banners flanking Chief's entrance
    [-0.92, 0.92].forEach((ox, idx) => {
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.055, 0.068, 1.05, 7)),
        lm.stiltPilings
      );
      post.position.set(cx + ox, DECK_TOP_Y + 0.52, cz + 1.82);
      post.castShadow = true;
      group.add(post);

      const banner = new THREE.Mesh(
        this._trackGeo(new THREE.PlaneGeometry(0.32, 0.56)),
        idx === 0 ? lm.tribalBannerRed : lm.tribalBannerTeal
      );
      banner.position.set(cx + ox, DECK_TOP_Y + 0.45, cz + 1.9);
      group.add(banner);
    });

    // Warm golden chief's doorway lantern
    const lantern = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.14, 0)),
      lm.lanternGlow
    );
    lantern.position.set(cx, DECK_TOP_Y + 0.92, cz + 1.04);
    group.add(lantern);
    this.lanternGlows.push({ mesh: lantern, phase: 0.7 });
  }

  /**
   * Adds flush bamboo ridge beam, carved gable tips, and a tied wooden mooring bollard
   * to each of the 4 spaced stilt houses.
   */
  _buildStiltHouseCompletionDecor(group, hc) {
    const lm = this.lagoon.materials;
    const ridgeY = DECK_TOP_Y + BLOCK_H * 1.5 + BLOCK_H * 1.24 * 0.5 - 0.04;

    const ridge = new THREE.Mesh(
      this._trackGeo(
        new THREE.BoxGeometry(
          hc.roofAxis === 'x' ? BLOCK_W * 2.18 : 0.14,
          0.14,
          hc.roofAxis === 'z' ? BLOCK_D * 2.18 : 0.14
        )
      ),
      lm.hardwoodDark
    );
    ridge.position.set(hc.cx, ridgeY, hc.cz);
    group.add(ridge);

    // Porch wooden mooring bollard with hemp rope collar
    const [pgx, pgz] = hc.porchCell;
    const bx = hc.cx + (pgx - 0.5) * GRID_STEP + (pgx > 1 ? 0.34 : pgx < 0 ? -0.34 : 0.34);
    const bz = hc.cz + (pgz - 0.5) * GRID_STEP + (pgz < 0 ? -0.34 : 0.34);
    const bollard = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.065, 0.078, 0.48, 7)),
      lm.stiltPilings
    );
    bollard.position.set(bx, DECK_TOP_Y + 0.24, bz);
    group.add(bollard);

    const ropeWrap = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(0.075, 0.024, 6, 10)),
      lm.ropeHemp
    );
    ropeWrap.rotation.x = Math.PI * 0.5;
    ropeWrap.position.set(bx, DECK_TOP_Y + 0.34, bz);
    group.add(ropeWrap);
  }

  /**
   * Crowns the SE Lagoon Watchtower with a wooden lookout railing, side ladder rungs,
   * glowing beacon lantern, and carved roof finial.
   */
  _buildWatchtowerCompletionDecor(group) {
    const lm = this.lagoon.materials;
    const tx = TOWER_CENTER.x;
    const tz = TOWER_CENTER.z;

    // Wrap-around timber lookout balcony rail around Layer 2
    const railY = DECK_TOP_Y + BLOCK_H * 1.14;
    [
      [0, railY, 1.06, 2.16, 0.08, 0.08],
      [0, railY, -1.06, 2.16, 0.08, 0.08],
      [1.06, railY, 0, 0.08, 0.08, 2.16],
      [-1.06, railY, 0, 0.08, 0.08, 2.16],
    ].forEach(([ox, oy, oz, w, h, d]) => {
      const rail = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(w, h, d)), lm.hardwoodDark);
      rail.position.set(tx + ox, oy, tz + oz);
      group.add(rail);
    });

    // Timber ladder descending West side facing the boardwalk pier
    [-0.18, 0.18].forEach((oz) => {
      const stile = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.028, 0.028, BLOCK_H * 2.05, 6)),
        lm.hardwoodDark
      );
      stile.position.set(tx - BLOCK_W - 0.06, DECK_TOP_Y + BLOCK_H, tz + oz);
      group.add(stile);
    });
    for (let r = 0; r < 5; r++) {
      const rung = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.05, 0.04, 0.36)),
        lm.deckPlanks
      );
      rung.position.set(tx - BLOCK_W - 0.06, DECK_TOP_Y + 0.22 + r * 0.24, tz);
      group.add(rung);
    }

    // Glowing Lagoon Lighthouse Beacon Orb suspended beneath the Watchtower roof
    const beacon = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.24, 0)),
      lm.lanternGlow
    );
    beacon.position.set(tx, DECK_TOP_Y + BLOCK_H * 1.72, tz);
    group.add(beacon);
    this.lanternGlows.push({ mesh: beacon, phase: 2.8 });

    // Carved lookout finial atop peaked thatch roof
    const topY = DECK_TOP_Y + BLOCK_H * 2.5 + BLOCK_H * 1.24 * 0.5;
    const pole = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.032, 0.052, 0.72, 6)),
      lm.hardwoodDark
    );
    pole.position.set(tx, topY + 0.3, tz);
    group.add(pole);

    const pennant = new THREE.Mesh(
      this._trackGeo(new THREE.PlaneGeometry(0.46, 0.22)),
      lm.tribalBannerRed
    );
    pennant.position.set(tx + 0.24, topY + 0.52, tz);
    group.add(pennant);
  }

  /**
   * Adds rustic timber mooring bollards & glowing reed lanterns at key boardwalk junctions.
   */
  _buildBoardwalkCompletionDecor(group, boardwalkCells) {
    const lm = this.lagoon.materials;
    // Place wooden mooring posts + warm lanterns at the 4 major boardwalk junctions
    const junctionIndices = [1, 3, 10, 14];
    junctionIndices.forEach((ji, idx) => {
      const cell = boardwalkCells[ji];
      if (!cell) return;
      const [px, pz] = cell;
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.055, 0.068, 0.92, 7)),
        lm.stiltPilings
      );
      post.position.set(px + 0.68, DECK_TOP_Y + 0.46, pz - 0.68);
      post.castShadow = true;
      group.add(post);

      const orb = new THREE.Mesh(
        this._trackGeo(new THREE.OctahedronGeometry(0.11, 0)),
        lm.lanternGlow
      );
      orb.position.set(px + 0.68, DECK_TOP_Y + 0.98, pz - 0.68);
      group.add(orb);
      this.lanternGlows.push({ mesh: orb, phase: idx * 1.5 });
    });
  }

  /* ============================================================================
   * 6. MULTI-ZONE FREE-ORDER GHOSTS, DROP VALIDATION & CONNECTED STILT MASONRY
   * ========================================================================== */
  _isSlotCurrentlyActive(slot) {
    return Boolean(
      slot &&
        !slot.block &&
        !slot.occupied &&
        slot.subGroup &&
        slot.layer === slot.subGroup.activeLayer
    );
  }

  _syncZoneGhostVisibility() {
    for (let i = 0; i < this.pyramidSlots.length; i++) {
      const s = this.pyramidSlots[i];
      if (!s.ghostGroup) continue;
      if (!this._isSlotCurrentlyActive(s)) {
        s.ghostGroup.visible = false;
        continue;
      }
      const matchesFilter =
        this.activeZoneFilter === 'all' || s.zoneId === this.activeZoneFilter;
      s.ghostGroup.visible = matchesFilter;
      if (matchesFilter) {
        if (s.ghostMesh) s.ghostMesh.material = this.mats.ghostNormal;
        if (s.ghostLines) s.ghostLines.material = this.mats.ghostLineNormal;
      }
    }
  }

  setActiveZoneFilter(zoneId, panCamera = false) {
    const valid = zoneId === 'all' || this.zoneById.has(zoneId);
    this.activeZoneFilter = valid ? zoneId : 'all';
    this._syncZoneGhostVisibility();
    this._syncZoneSelectorHud();

    if (panCamera && this.cameraController) {
      if (this.activeZoneFilter === 'all') {
        this.cameraController.desiredTarget.set(7.4, 0.7, 1.2);
        this.cameraController.desiredDistance = 30.0;
      } else {
        const z = this.zoneById.get(this.activeZoneFilter);
        if (z) {
          this.cameraController.desiredTarget.copy(z.focus);
          this.cameraController.desiredDistance = z.distance;
        }
      }
    }
  }

  _getValidSlotsForBlock(block) {
    const valid = [];

    if (block.kind === 'raw') {
      this.sleds.forEach((s) => {
        if (s.id === 'sledA') {
          s.slots.forEach((slot) => {
            this._syncSledSlotWorldPos(s, slot);
            if (!slot.occupied && !slot.block) valid.push(slot);
          });
        }
      });
      if (this.workbenchSlot && !this.workbenchSlot.occupied && !this.workbenchSlot.block) {
        valid.push(this.workbenchSlot);
      }
      this.quarrySlots.forEach((slot) => {
        if (
          slot.occupied === false &&
          slot.block === null &&
          !this._isQuarrySlotBlockedByMesh(slot, block)
        ) {
          valid.push(slot);
        }
      });
      return valid;
    }

    this.sleds.forEach((s) => {
      if (s.id === 'sledB') {
        s.slots.forEach((slot) => {
          this._syncSledSlotWorldPos(s, slot);
          if (!slot.occupied && !slot.block) valid.push(slot);
        });
      }
    });
    this.outputSlots.forEach((slot) => {
      if (!slot.occupied && !slot.block) valid.push(slot);
    });
    this.stagingSlots.forEach((slot) => {
      if (!slot.occupied && !slot.block) valid.push(slot);
    });

    for (let i = 0; i < this.pyramidSlots.length; i++) {
      const slot = this.pyramidSlots[i];
      if (this._isSlotCurrentlyActive(slot)) {
        valid.push(slot);
      }
    }

    return valid;
  }

  _isDropTargetStrictlyValid(block, targetSlot) {
    if (!block || !targetSlot) return false;
    if (targetSlot.occupied || targetSlot.block) return false;

    if (targetSlot.zoneType === 'pyramid') {
      if (block.kind === 'raw') return false;
      return this._isSlotCurrentlyActive(targetSlot);
    }
    return super._isDropTargetStrictlyValid(block, targetSlot);
  }

  clearDropHighlights() {
    this.slotMarkers.forEach((m) => {
      m.material = this.mats.slotIdle;
      m.scale.setScalar(1);
    });
    this.pyramidSlots.forEach((s) => {
      if (this._isSlotCurrentlyActive(s)) {
        if (s.ghostMesh) s.ghostMesh.material = this.mats.ghostNormal;
        if (s.ghostLines) s.ghostLines.material = this.mats.ghostLineNormal;
        if (s.ghostGroup) s.ghostGroup.scale.setScalar(1);
      }
    });
  }

  _shouldForgeCapstone() {
    return false;
  }

  _pickNextCarvedPieceType() {
    const preferred = this.pyramidSlots.filter(
      (s) =>
        this._isSlotCurrentlyActive(s) &&
        (this.activeZoneFilter === 'all' || s.zoneId === this.activeZoneFilter)
    );
    const pool =
      preferred.length > 0
        ? preferred
        : this.pyramidSlots.filter((s) => this._isSlotCurrentlyActive(s));

    if (
      pool.some(
        (s) =>
          s.pieceType === 'house_thatch' ||
          s.pieceType === 'chief_roof_lower' ||
          s.pieceType === 'chief_roof_upper' ||
          s.pieceType === 'tower_roof'
      )
    ) {
      return 'house_thatch';
    }
    if (pool.some((s) => s.pieceType === 'house_bamboo' || s.pieceType === 'chief_wall')) {
      return 'house_bamboo';
    }
    if (pool.some((s) => s.pieceType === 'tower_shaft' || s.pieceType === 'tower_beacon')) {
      return 'tower_shaft';
    }
    if (pool.some((s) => s.pieceType === 'boardwalk_pier')) return 'boardwalk_pier';
    return 'stilt_deck';
  }

  _resolveCarvingTargetMaterial() {
    const pieceType = this._pickNextCarvedPieceType();
    const lm = this.lagoon.materials;
    if (pieceType === 'house_thatch') return lm.palmThatch;
    if (pieceType === 'house_bamboo') return lm.bambooWalls;
    if (pieceType === 'tower_shaft') return lm.stiltPilings;
    return lm.deckPlanks || this.carvedBlockMat;
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyLagoonPieceVisual(block, pieceType, null, false);
    }
    return stillRaw;
  }

  _clearCustomAttach(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  /**
   * Attaches thick weathered dark hardwood pilings + cross-bracing beneath any placed
   * Layer 0 stilt deck or wooden boardwalk block so stilts plunge straight into the lagoon.
   */
  _attachStiltPilings(block, slot) {
    const lm = this.lagoon.materials;
    const isPier = slot.pieceType === 'boardwalk_pier';
    const g = new THREE.Group();

    const halfX = (isPier ? PIER_W : BLOCK_W) * 0.36;
    const halfZ = (isPier ? PIER_D : BLOCK_D) * 0.36;
    const dropY = isPier ? -1.02 : -1.04;
    const postGeo = isPier ? this.lagoonGeos.pierPilingPost : this.lagoonGeos.pilingPost;

    [
      [-halfX, dropY, -halfZ],
      [halfX, dropY, -halfZ],
      [-halfX, dropY, halfZ],
      [halfX, dropY, halfZ],
    ].forEach(([px, py, pz]) => {
      const post = new THREE.Mesh(postGeo, lm.stiltPilings);
      post.position.set(px, py, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      g.add(post);
    });

    // Horizontal timber tie-beams just above waterline
    const braceY = isPier ? -0.34 : -0.38;
    const bx = new THREE.Mesh(
      isPier ? this.lagoonGeos.pierBraceX : this.lagoonGeos.crossBrace,
      lm.hardwoodDark
    );
    bx.position.set(0, braceY, halfZ);
    g.add(bx);

    const bx2 = new THREE.Mesh(
      isPier ? this.lagoonGeos.pierBraceX : this.lagoonGeos.crossBrace,
      lm.hardwoodDark
    );
    bx2.position.set(0, braceY, -halfZ);
    g.add(bx2);

    if (isPier) {
      const bz = new THREE.Mesh(this.lagoonGeos.pierBraceZ, lm.hardwoodDark);
      bz.position.set(0, braceY, 0);
      g.add(bz);
    }

    block.mesh.add(g);
    block.customAttach = g;
  }

  _attachBambooWindowGlow(block) {
    const lm = this.lagoon.materials;
    const g = new THREE.Group();
    [
      [0, 0.04, BLOCK_D * 0.5 + 0.014, 0],
      [0, 0.04, -(BLOCK_D * 0.5 + 0.014), Math.PI],
      [BLOCK_W * 0.5 + 0.014, 0.04, 0, Math.PI * 0.5],
      [-(BLOCK_W * 0.5 + 0.014), 0.04, 0, -Math.PI * 0.5],
    ].forEach(([px, py, pz, ry]) => {
      const frame = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.42, 0.3, 0.03)),
        lm.hardwoodDark
      );
      frame.position.set(px, py, pz);
      frame.rotation.y = ry;
      g.add(frame);

      const glow = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.04)),
        lm.lanternGlow
      );
      glow.position.set(px, py, pz);
      glow.rotation.y = ry;
      g.add(glow);
    });
    block.mesh.add(g);
    block.customAttach = g;
  }

  _applyLagoonPieceVisual(block, pieceType, slot = null, isPlaced = false) {
    const lm = this.lagoon.materials;
    block.pieceType = pieceType;
    this._clearCustomAttach(block);

    if (pieceType === 'chief_roof_upper') {
      block.mesh.geometry = this.lagoonGeos.chiefPeakCap;
      block.mesh.material = lm.palmThatchDeep;
      return;
    }

    if (
      pieceType === 'house_thatch' ||
      pieceType === 'chief_roof_lower' ||
      pieceType === 'tower_roof'
    ) {
      block.mesh.geometry = this.lagoonGeos.roofPreview;
      block.mesh.material =
        slot && slot.houseVariant % 2 === 1 ? lm.palmThatchDeep : lm.palmThatch;
      return;
    }

    if (pieceType === 'boardwalk_pier') {
      block.mesh.geometry = this.lagoonGeos.pierBlock;
      block.mesh.material = lm.deckPlanks;
      if (isPlaced && slot) {
        this._attachStiltPilings(block, slot);
      }
      return;
    }

    if (pieceType === 'stilt_deck' || pieceType === 'stilt_veranda') {
      block.mesh.geometry = this.lagoonGeos.deckBlock;
      block.mesh.material = lm.deckPlanks;
      if (isPlaced && slot) {
        this._attachStiltPilings(block, slot);
      }
      return;
    }

    if (pieceType === 'chief_wall' || pieceType === 'house_bamboo') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material =
        pieceType === 'chief_wall' || (slot && slot.houseVariant % 2 === 1)
          ? lm.bambooWallsWarm
          : lm.bambooWalls;
      return;
    }

    if (pieceType === 'tower_beacon') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = lm.stiltPilings;
      if (isPlaced) {
        this._attachBambooWindowGlow(block);
      }
      return;
    }

    if (pieceType === 'tower_shaft') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = lm.stiltPilings;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = lm.deckPlanks;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyLagoonPieceVisual(block, slot.pieceType, slot, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const chipMat = slot.pieceType.includes('thatch') || slot.pieceType.includes('roof')
      ? this.lagoonFxMats.chipThatch
      : slot.pieceType.includes('bamboo') || slot.pieceType === 'chief_wall'
        ? this.lagoonFxMats.chipBamboo
        : this.lagoonFxMats.chipWood;

    this._spawnParticles(slot.position, {
      count: 10,
      material: chipMat,
      speed: 2.1,
      upSpeed: 2.6,
      scale: 0.86,
      life: 0.48,
    });
  }

  _isConnectableMasonrySlot(slot) {
    if (!slot || !slot.block) return false;
    return (
      slot.pieceType === 'stilt_deck' ||
      slot.pieceType === 'stilt_veranda' ||
      slot.pieceType === 'chief_wall' ||
      slot.pieceType === 'house_bamboo' ||
      slot.pieceType === 'tower_shaft' ||
      slot.pieceType === 'tower_beacon' ||
      slot.pieceType === 'boardwalk_pier'
    );
  }

  _computeMasonryNeighborMask(slot) {
    if (!this._isConnectableMasonrySlot(slot)) return 0;
    const { subGroupId: sid, gridX: gx, gridY: gy, gridZ: gz } = slot;
    let mask = 0;
    const check = (nx, ny, nz) => {
      const nb = this.slotKeyMap.get(`${sid}:${nx},${ny},${nz}`);
      return nb && this._isConnectableMasonrySlot(nb) && nb.blockH === slot.blockH;
    };
    if (check(gx + 1, gy, gz)) mask |= NEIGHBOR_PX;
    if (check(gx - 1, gy, gz)) mask |= NEIGHBOR_NX;
    if (check(gx, gy, gz + 1)) mask |= NEIGHBOR_PZ;
    if (check(gx, gy, gz - 1)) mask |= NEIGHBOR_NZ;
    if (check(gx, gy + 1, gz)) mask |= NEIGHBOR_PY;
    if (check(gx, gy - 1, gz)) mask |= NEIGHBOR_NY;
    return mask;
  }

  _applyConnectedMasonry(slot) {
    if (!this._isConnectableMasonrySlot(slot)) return;
    const mask = this._computeMasonryNeighborMask(slot);
    if (slot.block.masonryMask === mask) return;
    slot.block.masonryMask = mask;
    slot.block.mesh.geometry = this.masonryCache.getBlockGeometry(
      slot.blockW,
      slot.blockH,
      slot.blockD,
      mask,
      slot.pieceType === 'boardwalk_pier' ? 0.024 : 0.036
    );
  }

  _updateConnectedMasonryAround(slot) {
    if (!slot) return;
    const { subGroupId: sid, gridX: gx, gridY: gy, gridZ: gz } = slot;
    const candidates = [
      slot,
      this.slotKeyMap.get(`${sid}:${gx + 1},${gy},${gz}`),
      this.slotKeyMap.get(`${sid}:${gx - 1},${gy},${gz}`),
      this.slotKeyMap.get(`${sid}:${gx},${gy},${gz + 1}`),
      this.slotKeyMap.get(`${sid}:${gx},${gy},${gz - 1}`),
      this.slotKeyMap.get(`${sid}:${gx},${gy + 1},${gz}`),
      this.slotKeyMap.get(`${sid}:${gx},${gy - 1},${gz}`),
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]) this._applyConnectedMasonry(candidates[i]);
    }
  }

  _isRoofSlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        (slot.pieceType === 'house_thatch' ||
          slot.pieceType === 'chief_roof_lower' ||
          slot.pieceType === 'chief_roof_upper' ||
          slot.pieceType === 'tower_roof')
    );
  }

  _applyConnectedRoof(slot) {
    if (!this._isRoofSlot(slot)) return;
    const { subGroupId: sid, gridX: gx, gridY: gy, gridZ: gz } = slot;
    let mask = 0;
    if (this._isRoofSlot(this.slotKeyMap.get(`${sid}:${gx + 1},${gy},${gz}`))) mask |= NEIGHBOR_PX;
    if (this._isRoofSlot(this.slotKeyMap.get(`${sid}:${gx - 1},${gy},${gz}`))) mask |= NEIGHBOR_NX;
    if (this._isRoofSlot(this.slotKeyMap.get(`${sid}:${gx},${gy},${gz + 1}`))) mask |= NEIGHBOR_PZ;
    if (this._isRoofSlot(this.slotKeyMap.get(`${sid}:${gx},${gy},${gz - 1}`))) mask |= NEIGHBOR_NZ;

    slot.block.roofMask = mask;
    slot.block.mesh.rotation.set(0, 0, 0);
    const heightScale = slot.pieceType === 'chief_roof_upper' ? 1.32 : 1.24;
    slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
      BLOCK_W,
      BLOCK_H * heightScale,
      BLOCK_D,
      mask,
      { style: 'gable', defaultAxis: slot.roofAxis || 'x', eaveOverhang: 0.06 }
    );
  }

  _updateConnectedRoofAround(slot) {
    if (!this._isRoofSlot(slot)) return;
    const { subGroupId: sid, gridX: gx, gridY: gy, gridZ: gz } = slot;
    const candidates = [
      slot,
      this.slotKeyMap.get(`${sid}:${gx + 1},${gy},${gz}`),
      this.slotKeyMap.get(`${sid}:${gx - 1},${gy},${gz}`),
      this.slotKeyMap.get(`${sid}:${gx},${gy},${gz + 1}`),
      this.slotKeyMap.get(`${sid}:${gx},${gy},${gz - 1}`),
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]) this._applyConnectedRoof(candidates[i]);
    }
  }

  _onPyramidBlockPlaced(slot) {
    this.placedCount += 1;
    this.audio.playBlueprintSnap(slot.layer);

    if (slot.pieceType === 'boardwalk_pier') {
      this.placedBoardwalkBounds.push({
        minX: slot.position.x - PIER_W * 0.5,
        maxX: slot.position.x + PIER_W * 0.5,
        minZ: slot.position.z - PIER_D * 0.5,
        maxZ: slot.position.z + PIER_D * 0.5,
      });
    }

    this._updateConnectedMasonryAround(slot);
    this._updateConnectedRoofAround(slot);

    const sub = slot.subGroup;
    const zone = this.zoneById.get(slot.zoneId);
    if (sub) sub.placedCount += 1;
    if (zone) zone.placedCount += 1;

    if (this.onProgress) {
      this.onProgress(this.placedCount, this.totalGoal);
    }

    if (sub) {
      const layerDone = sub.slots
        .filter((s) => s.layer === sub.activeLayer)
        .every((s) => Boolean(s.block));

      if (layerDone) {
        if (sub.activeLayer < sub.maxLayer) {
          const finishedTier = sub.activeLayer;
          sub.activeLayer += 1;
          this.audio.playLayerComplete(finishedTier);
          this._syncZoneGhostVisibility();
          sub.slots.forEach((s) => {
            if (s.layer === sub.activeLayer && s.ghostGroup && s.ghostGroup.visible) {
              s.ghostGroup.scale.setScalar(0.18);
            }
          });
        } else if (!sub.completed && sub.placedCount >= sub.totalCount) {
          sub.completed = true;
          if (sub.completionGroup && sub.completionGroup.children.length > 0) {
            sub.completionGroup.visible = true;
          }
          this.audio.playLayerComplete(3);
          this._spawnParticles(slot.position, {
            count: 22,
            material: this.mats.dustGold,
            speed: 3.2,
            upSpeed: 4.1,
            scale: 0.9,
            life: 0.85,
          });
        }
      }
    }

    this._syncZoneSelectorHud();

    if (this.placedCount >= this.totalGoal && !this.isComplete) {
      this._triggerCompletionSequence();
    }
  }

  /* ============================================================================
   * 7. BOTTOM ZONE SELECTOR BAR ("Tout", "Maison du Chef", "4 Maisons Pilotis", "Pontons & Tour")
   * ========================================================================== */
  _mountZoneSelectorHud() {
    this._unmountZoneSelectorHud();
    if (typeof document === 'undefined') return;
    const rootEl = document.getElementById('game-root') || document.body;

    const bar = document.createElement('div');
    bar.id = 'lagoon-zone-bar';
    bar.className = 'city-district-bar';
    bar.setAttribute('aria-label', 'Zones du Village sur Pilotis');

    const scroller = document.createElement('div');
    scroller.className = 'city-district-scroll';

    const items = [
      { id: 'all', icon: '🧭', label: 'Tout' },
      ...this.villageZones.map((z) => ({ id: z.id, icon: z.icon, label: z.label })),
    ];

    items.forEach((item) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'city-district-chip';
      chip.dataset.zoneId = item.id;
      chip.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.setActiveZoneFilter(item.id, true);
      });
      scroller.appendChild(chip);
      this.zoneHudChips.set(item.id, chip);
    });

    bar.appendChild(scroller);
    rootEl.appendChild(bar);
    this.zoneHudEl = bar;
    this._syncZoneSelectorHud();
  }

  _syncZoneSelectorHud() {
    if (!this.zoneHudEl) return;

    const allChip = this.zoneHudChips.get('all');
    if (allChip) {
      const allDone = this.placedCount >= this.totalGoal;
      allChip.classList.toggle('is-active', this.activeZoneFilter === 'all');
      allChip.classList.toggle('is-complete', allDone);
      allChip.textContent = allDone
        ? '🧭 Tout ✓'
        : `🧭 Tout ${this.placedCount}/${this.totalGoal}`;
    }

    this.villageZones.forEach((z) => {
      const chip = this.zoneHudChips.get(z.id);
      if (!chip) return;
      const done = z.placedCount >= z.totalCount;
      chip.classList.toggle('is-active', this.activeZoneFilter === z.id);
      chip.classList.toggle('is-complete', done);
      chip.textContent = done
        ? `${z.icon} ${z.label} ✓`
        : `${z.icon} ${z.label} ${z.placedCount}/${z.totalCount}`;
    });
  }

  _unmountZoneSelectorHud() {
    if (this.zoneHudEl && this.zoneHudEl.parentNode) {
      this.zoneHudEl.parentNode.removeChild(this.zoneHudEl);
    }
    this.zoneHudEl = null;
    this.zoneHudChips.clear();
  }

  /* ============================================================================
   * 8. GOLDEN SUNBEAM & WATER-SPARKLE CELEBRATION (+520 PIÈCES D'OR, +65 ÉCLATS)
   * ========================================================================== */
  _triggerCompletionSequence() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.clearDropHighlights();
    this._updateCarvingPips();
    if (this.zoneHudEl) {
      this.zoneHudEl.hidden = true;
      this.zoneHudEl.style.display = 'none';
    }
    this.audio.playVictoryFanfare();

    this.subGroups.forEach((sub) => {
      if (sub.completionGroup) sub.completionGroup.visible = true;
    });

    const pc = new THREE.Vector3(CHIEF_CENTER.x, 1.4, CHIEF_CENTER.z + 2.4);
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.copy(pc);

    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffe89c,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.85, 3.4, 14.0, 20, 1, true)),
      innerMat
    );
    this.victoryBeamInner.position.y = 6.0;
    this.victoryGroup.add(this.victoryBeamInner);

    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0x8ef2ff,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(1.5, 4.9, 14.5, 22, 1, true)),
      outerMat
    );
    this.victoryBeamOuter.position.y = 6.2;
    this.victoryGroup.add(this.victoryBeamOuter);

    this.root.add(this.victoryGroup);

    this._spawnParticles(new THREE.Vector3(CHIEF_CENTER.x, 3.8, CHIEF_CENTER.z), {
      count: 24,
      material: this.mats.dustGold,
      speed: 3.8,
      upSpeed: 4.8,
      scale: 0.96,
      life: 1.25,
    });
    this._spawnParticles(new THREE.Vector3(8.4, 1.4, 1.4), {
      count: 20,
      material: this.lagoonFxMats.waterSparkle,
      speed: 3.4,
      upSpeed: 4.2,
      scale: 0.84,
      life: 1.15,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level13StiltVillage.meta.id,
        focusPoint: new THREE.Vector3(8.4, 1.8, 0.4),
        rewardCoins: 520,
        firstCompletionTokens: 65,
      });
    }
  }

  /* ============================================================================
   * 9. REAL-TIME ANIMATION LOOP (LAGOON RIPPLES, WHEELS, CANOES & LANTERNS)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    for (let i = 0; i < this.cartWheels.length; i++) {
      const cw = this.cartWheels[i];
      const coord = cw.sled.axis === 'z' ? cw.sled.group.position.z : cw.sled.group.position.x;
      const delta = coord - cw.lastCoord;
      cw.lastCoord = coord;
      if (Math.abs(delta) > 0.0001) {
        cw.mesh.rotation.x += delta / 0.22;
      }
    }

    if (
      this.lagoonWaterMesh &&
      this.lagoonWaterMesh.material &&
      this.lagoonWaterMesh.material.normalMap
    ) {
      this.lagoonWaterMesh.material.normalMap.offset.x = (elapsed * 0.014) % 1;
      this.lagoonWaterMesh.material.normalMap.offset.y = (elapsed * 0.011) % 1;
    }

    for (let i = 0; i < this.floatingCanoes.length; i++) {
      const c = this.floatingCanoes[i];
      c.group.position.y = c.baseY + Math.sin(elapsed * 1.8 + c.phase) * 0.04;
      c.group.rotation.z = Math.sin(elapsed * 1.4 + c.phase) * 0.035;
    }

    for (let i = 0; i < this.lanternGlows.length; i++) {
      const lg = this.lanternGlows[i];
      const s = 0.93 + Math.sin(elapsed * 5.0 + lg.phase) * 0.08;
      lg.mesh.scale.setScalar(s);
    }

    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.update === 'function') {
      this.cozyFoliageSystem.update(elapsed);
    }

    if (this.isComplete) {
      this.victorySparkTimer += dt;
      if (this.victorySparkTimer >= 0.7) {
        this.victorySparkTimer = 0;
        this._spawnParticles(
          new THREE.Vector3(
            8.4 + (Math.random() - 0.5) * 9.0,
            1.6 + Math.random() * 2.2,
            0.8 + (Math.random() - 0.5) * 10.0
          ),
          {
            count: 3,
            material: Math.random() < 0.5 ? this.mats.dustGold : this.lagoonFxMats.waterSparkle,
            speed: 0.9,
            upSpeed: 1.8,
            scale: 0.72,
            life: 1.0,
          }
        );
      }
    }
  }

  dispose() {
    this._unmountZoneSelectorHud();
    this._removeQuarryFullHint();
    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.dispose === 'function') {
      this.cozyFoliageSystem.dispose();
      this.cozyFoliageSystem = null;
    }
    if (this.contactShadows && typeof this.contactShadows.dispose === 'function') {
      this.contactShadows.dispose();
      this.contactShadows = null;
    }
    this.villageZones.length = 0;
    this.zoneById.clear();
    this.subGroups.length = 0;
    this.subGroupById.clear();
    this.slotKeyMap.clear();
    this.placedBoardwalkBounds.length = 0;
    super.dispose();
  }
}
