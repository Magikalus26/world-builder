/**
 * Workd Builder — Level 11: Viking Era ("Le Village Viking du Fjord")
 *
 * Establishes the 10-Level Tier Scaling Architecture (Tier 1: Levels 11–20 = Compact Multi-Building
 * Villages on an expanded 160x160 sculpted terrain board, 34x32 world units), optimized for locked
 * 60 FPS on iPhone 16e Safari (390x844, devicePixelRatio capped at 2).
 *
 * Composition (94 blocks across 4 multi-part village zones, buildable in ANY order):
 *  - Structure A — La Grande Salle du Chef / Jarl (Center-North, 28 blocks):
 *      10 carved dry-stone plinth blocks -> 8 thick Nordic log wall blocks with painted round shields
 *      & carved portico pillars -> 10 welded steep pitched turf-and-shingle roofs + dragon-head finials.
 *  - Structure B — Les 3 Maisons Vikings (West, South & East Cluster around Firepit Square, 3 × 14 = 42 blocks):
 *      Each cozy Nordic cottage has 5 dry-stone foundations -> 4 carved plank walls -> 5 welded pitched
 *      shingle/sod roof blocks & hearth chimney.
 *  - Structure C — Le Champ de Blé & Enclos Agricole (South-East, 12 blocks):
 *      4×3 fenced fertile farm plot of welded plowed soil blocks sprouting swaying golden wheat stalks.
 *  - Structure D — Chemins en Pierres & Ponton du Fjord (12 blocks):
 *      Flagstone village walkways connecting the 3 houses, wheat field, Jarl's Hall & Fjord Longship Dock.
 *  - Bottom Zone Selector Bar ("Tout", "Salle du Chef", "3 Maisons", "Champ & Chemins") smoothly glides
 *    camera focus and filters/highlights active blueprint ghost slots using the player's equipped skin.
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
  createMatteFoliageMaterial,
  createRootedTrunk,
  createIrregularConiferTierGeo,
} from '../foliageAndGround.js';

const TIER_SPEC = getLevelTierSpec(11);
const TERRAIN_W = TIER_SPEC.boardWidth;       // 34.0 (expanded Tier 1 Village board)
const TERRAIN_D = TIER_SPEC.boardDepth;       // 32.0
const TERRAIN_SEGS = TIER_SPEC.terrainSegments; // 160x160 sculpted terrain mesh

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const GRID_STEP = BLOCK_W;
const FARM_BLOCK_H = 0.34;
const PATH_BLOCK_H = 0.18;

const FJORD_WATER_Y = -0.32;
const HALL_CENTER = { x: 6.4, z: -4.2 };
const HALL_ELEV = 0.18;
const FIREPIT_CENTER = { x: 6.4, z: 0.85 };
const FARM_CENTER = { x: 11.4, z: 4.6 };

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

function rectFlatMask(x, z, cx, cz, hw, hd, feather = 1.4) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return 1.0 - smoothstep(0, feather, Math.hypot(dx, dz));
}

/**
 * Unified 160x160 Sculpted Nordic Fjord & Highland Village Heightfield.
 */
function sampleVikingTerrainHeight(x, z) {
  // Rolling Nordic highland heather hills around the outer perimeter
  let h =
    Math.sin(x * 0.18 + 0.6) * Math.cos(z * 0.16 - 0.4) * 0.18 +
    Math.sin(x * 0.42 - z * 0.36) * 0.05;

  // Dramatic Northern & Western snow-dusted pine cliffs (except where NE fjord carves inward)
  const northCliff = smoothstep(-9.2, -14.8, z) * smoothstep(8.2, 2.2, x) * 2.15;
  const nwQuarryRidge = smoothstep(-11.5, -15.6, x) * smoothstep(-3.0, -10.5, z) * 1.45;
  const westHills = smoothstep(-12.2, -16.2, x) * 1.15;
  const southRidge = smoothstep(10.8, 15.2, z) * 0.78;
  const eastHill = smoothstep(13.8, 16.6, x) * smoothstep(-3.2, 2.5, z) * 1.05;
  h += northCliff + nwQuarryRidge + westHills + southRidge + eastHill;

  // Shallow dark-granite quarry excavation basin in North-West
  const pitDist = Math.hypot((x + 10.6) * 0.78, (z + 8.0) * 0.95);
  h -= (1.0 - smoothstep(1.4, 3.6, pitDist)) * 0.46;

  // Deep Turquoise Nordic Fjord Inlet carving into the North-East coastline
  const fjordDist = Math.min(
    segmentDist(x, z, 11.2, -9.2, 16.2, -14.8),
    segmentDist(x, z, 13.8, -6.5, 16.5, -10.2),
    Math.hypot((x - 13.4) * 0.78, (z + 10.8) * 0.88)
  );
  const fjordMask = 1.0 - smoothstep(2.1, 4.4, fjordDist);
  h = h * (1.0 - fjordMask) + -1.18 * fjordMask;

  // Slightly elevated ceremonial stone terrace for the Jarl's Longhouse (Center-North)
  const hallTerrace = rectFlatMask(x, z, HALL_CENTER.x, HALL_CENTER.z, 2.75, 2.15, 1.45);

  // Flat village plateau + NW/SW 4-station logistics yard so tracks, cottages, farm & paths sit flush
  const villageFlat = clamp01(
    Math.max(
      rectFlatMask(x, z, 6.8, 2.1, 6.6, 5.2, 1.85),    // Village cluster (3 houses, firepit, wheat field)
      rectFlatMask(x, z, 6.4, -3.5, 3.6, 3.2, 1.5),    // Longhouse approach & plaza
      rectFlatMask(x, z, -9.4, -5.2, 2.8, 1.8, 1.2),   // Quarry output storage pad
      rectFlatMask(x, z, -9.4, 1.0, 1.75, 5.2, 1.05),  // Track A corridor
      rectFlatMask(x, z, -9.4, 7.6, 2.8, 2.4, 1.25),   // Viking Carpenter & Stonecutter Workshop
      rectFlatMask(x, z, -2.8, 7.6, 5.6, 1.8, 1.15),   // Track B timber rail corridor
      rectFlatMask(x, z, 2.6, 7.6, 2.4, 1.9, 1.15)     // Village staging pad
    )
  );
  h *= 1.0 - villageFlat;

  // Apply gentle elevated Jarl Longhouse plinth terrace cleanly above the flat village floor
  h = h * (1.0 - hallTerrace) + HALL_ELEV * hallTerrace;

  // Crisp diorama edge taper along outer borders (except fjord outflow)
  const rimX = smoothstep(TERRAIN_W * 0.47, TERRAIN_W * 0.5, Math.abs(x));
  const rimZ = smoothstep(TERRAIN_D * 0.47, TERRAIN_D * 0.5, Math.abs(z));
  const rim = Math.max(rimX, rimZ) * (1.0 - fjordMask);
  h -= rim * 0.18;

  return h;
}

/**
 * Computes 4-layer Nordic terrain splat weights:
 *  w0: Nordic Mossy Grass & Purple-Rose Heather
 *  w1: Compacted Muddy / Cobblestone Village Paths
 *  w2: Crushed Cold Grey Fjord Granite Quarry Dust
 *  w3: Plowed Dark-Brown Fertile Soil for the Farm Field
 */
function sampleVikingBiomeWeights(x, z, h) {
  // Crushed granite dust around NW Quarry & SW Workshop
  const qDust = 1.0 - smoothstep(2.4, 5.4, Math.hypot(x + 10.2, z + 6.8));
  const wsDust = rectFlatMask(x, z, -9.4, 7.6, 2.4, 2.1, 1.3) * 0.82;
  const cliffRock = smoothstep(0.95, 1.85, h) * 0.78;
  const wGranite = clamp01(Math.max(qDust, wsDust, cliffRock));

  // Plowed fertile soil under & bordering the SE Wheat Field
  const wSoil = rectFlatMask(x, z, FARM_CENTER.x, FARM_CENTER.z, 2.35, 1.85, 0.95);

  // Compacted village muddy/cobblestone paths linking all stations, houses, firepit, hall & dock
  const dTrackA = segmentDist(x, z, -9.4, -4.8, -9.4, 6.2);
  const dTrackB = segmentDist(x, z, -6.5, 7.6, 3.2, 7.6);
  const dEntry = segmentDist(x, z, 2.6, 7.6, 6.4, 0.85);
  const dNorth = segmentDist(x, z, 6.4, 0.85, 6.4, -4.0);
  const dWest = segmentDist(x, z, 2.4, 0.7, 6.4, 0.85);
  const dEast = segmentDist(x, z, 6.4, 0.85, 11.0, 0.2);
  const dSouth = segmentDist(x, z, 6.4, 0.85, 6.4, 4.6);
  const dFarm = segmentDist(x, z, 6.4, 2.8, 10.5, 4.5);
  const dDock = segmentDist(x, z, 7.8, -4.2, 10.6, -6.8);
  const pathDist = Math.min(dTrackA, dTrackB, dEntry, dNorth, dWest, dEast, dSouth, dFarm, dDock);
  const fireSquare = 1.0 - smoothstep(1.3, 2.6, Math.hypot(x - FIREPIT_CENTER.x, z - FIREPIT_CENTER.z));
  const wPath = clamp01(Math.max(1.0 - smoothstep(0.85, 2.05, pathDist), fireSquare * 0.9));

  let w3 = wSoil;
  let w2 = wGranite * (1.0 - wSoil * 0.85);
  let w1 = wPath * (1.0 - wSoil * 0.85) * (1.0 - wGranite * 0.45);
  let w0 = Math.max(0.04, 1.0 - clamp01(w1 + w2 + w3));

  const sum = w0 + w1 + w2 + w3 || 1;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  // Wet shoreline sheen near fjord water level
  const wetness = 1.0 - smoothstep(FJORD_WATER_Y - 0.05, FJORD_WATER_Y + 0.32, h);
  return { w0, w1, w2, w3, wetness: clamp01(wetness) };
}

/**
 * Creates a stylized Snow-Dusted Nordic Pine Tree (rooted trunk + 3 conifer tiers + frost cap).
 */
function createNordicPineTree(x, z, groundY, trunkMat, foliageMat, snowMat, trackGeo, seed = 1, snowDusted = true) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.rotation.y = (seed % 11) * 0.65;
  const sc = 0.92 + (seed % 5) * 0.09;
  tree.scale.setScalar(sc);

  const trunk = createRootedTrunk({
    height: 1.05,
    botR: 0.14,
    topR: 0.065,
    barkMat: trunkMat,
    trackGeo,
    seed: seed + 17,
  });
  tree.add(trunk);

  const tiers = [
    { y: 0.88, rb: 0.68, rt: 0.16, h: 0.84 },
    { y: 1.42, rb: 0.52, rt: 0.12, h: 0.78 },
    { y: 1.92, rb: 0.34, rt: 0.03, h: 0.68 },
  ];
  tiers.forEach((t, idx) => {
    const geo = trackGeo(
      createIrregularConiferTierGeo({
        radiusBottom: t.rb,
        radiusTop: t.rt,
        height: t.h,
        radialSegments: 8,
        heightSegments: 2,
        jaggedness: 0.25,
        droop: 0.08,
        seed: seed * 23 + idx * 9,
        baseColor: '#193529',
        midColor: '#29543e',
        topColor: snowDusted && idx === 2 ? '#b8d4d8' : '#4a7a58',
      })
    );
    const m = new THREE.Mesh(geo, foliageMat);
    m.position.y = t.y;
    m.castShadow = true;
    m.receiveShadow = true;
    tree.add(m);
  });

  if (snowDusted) {
    const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.16, 0.24, 7)), snowMat);
    cap.position.y = 2.22;
    tree.add(cap);
  }

  return tree;
}

/* ============================================================================
 * LEVEL 11 — VIKING ERA ("LE VILLAGE VIKING DU FJORD")
 * ========================================================================== */
export class Level11Viking extends Level1Pyramid {
  static meta = {
    id: 'level11_viking',
    title: 'Niveau 11 : Ère Viking — Le Village du Fjord',
    hudLabel: 'Village Viking',
    totalGoal: 94,
    tier: 1,
  };

  constructor(options = {}) {
    super(options);
    this.cameraController = options.cameraController || null;
  }

  _beforeBuild() {
    this.tierSpec = TIER_SPEC;
    this.viking = this.textures.ensureVikingPack();
    this.hudLabel = Level11Viking.meta.hudLabel;
    this.carvedBlockMat = this.viking.materials.nordicTimber;

    this.cartWheels = [];
    this.fireFlames = [];
    this.wheatStalks = [];
    this.drakkarGroup = null;
    this.drakkarBaseY = FJORD_WATER_Y + 0.14;
    this.auroraRibbons = [];
    this.victorySparkTimer = 0;

    // Multi-zone tracking (4 selectable zone groups, 6 independent vertical sub-structures)
    this.villageZones = [];
    this.zoneById = new Map();
    this.subGroups = [];
    this.subGroupById = new Map();
    this.slotKeyMap = new Map();
    this.activeZoneFilter = 'all'; // 'all' | 'hall' | 'houses' | 'farm_paths'

    this.zoneHudEl = null;
    this.zoneHudChips = new Map();

    // Slightly wider village snap radius for smooth mobile drag-and-drop
    this.pyramidSnapRadius = this.upgrades.pyramidion_aura ? 1.42 : 1.16;
    this.pyramidCenter = new THREE.Vector3(FIREPIT_CENTER.x, 0.1, FIREPIT_CENTER.z);

    this.vikingGeos = {
      unitBox: this._trackGeo(new THREE.BoxGeometry(1, 1, 1)),
      shieldDisk: this._trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.055, 12)),
      shieldBoss: this._trackGeo(new THREE.SphereGeometry(0.065, 8, 6)),
      wheatStalk: this._trackGeo(new THREE.CylinderGeometry(0.014, 0.022, 0.44, 5)),
      wheatHead: this._trackGeo(new THREE.ConeGeometry(0.042, 0.16, 5)),
      roofPreview: this._trackGeo(
        this.masonryCache.getPitchedRoofGeometry(BLOCK_W, BLOCK_H * 1.12, BLOCK_D, 0, {
          style: 'gable',
          defaultAxis: 'x',
          eaveOverhang: 0.04,
        })
      ),
      farmBlock: this._trackGeo(new THREE.BoxGeometry(BLOCK_W, FARM_BLOCK_H, BLOCK_D)),
      pathBlock: this._trackGeo(new THREE.BoxGeometry(BLOCK_W, PATH_BLOCK_H, BLOCK_D)),
    };
    this.vikingGeos.shieldDisk.rotateX(Math.PI * 0.5);

    this.vikingFxMats = {
      chipGranite: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x7b8590, roughness: 0.9 })),
      chipTimber: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x7a5132, roughness: 0.86 })),
      chipWheat: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xe4b84a, roughness: 0.85 })),
      auroraEmerald: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x45f5a8,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      ),
      auroraCyan: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x52d4ff,
          transparent: true,
          opacity: 0.34,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      ),
      auroraViolet: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xb06cff,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      ),
    };
  }

  _getRawBlockMaterial() {
    return this.viking ? this.viking.materials.rawGranite : super._getRawBlockMaterial();
  }

  getTerrainHeight(x, z) {
    return sampleVikingTerrainHeight(x, z);
  }

  getDragBounds() {
    return {
      minX: -15.6,
      maxX: 15.6,
      minZ: -14.2,
      maxZ: 14.2,
    };
  }

  getDecorationBlockedBoxes() {
    return [
      { minX: -13.6, maxX: -7.2, minZ: -10.5, maxZ: -3.6 }, // Quarry & storage pad
      { minX: -11.0, maxX: -7.6, minZ: -3.6, maxZ: 5.4 },   // Track A
      { minX: -12.0, maxX: -6.8, minZ: 5.2, maxZ: 10.0 },   // Viking Workshop
      { minX: -6.8, maxX: 1.8, minZ: 5.8, maxZ: 9.4 },      // Track B
      { minX: 1.7, maxX: 5.6, minZ: 6.2, maxZ: 9.0 },       // Staging pad
      { minX: 4.3, maxX: 8.5, minZ: -5.4, maxZ: -2.2 },     // Jarl Longhouse
      { minX: 1.0, maxX: 4.1, minZ: -0.6, maxZ: 1.8 },      // West Cottage
      { minX: 5.2, maxX: 7.6, minZ: 2.9, maxZ: 5.9 },       // South Cottage
      { minX: 9.2, maxX: 12.4, minZ: -1.2, maxZ: 1.2 },     // East Cottage
      { minX: 9.3, maxX: 13.5, minZ: 3.0, maxZ: 6.2 },      // Wheat Field
    ];
  }

  getCameraPreset() {
    return {
      target: new THREE.Vector3(1.8, 0.35, 1.2),
      elevationDeg: 52,
      azimuth: 0.08,
      minDistance: 10.5,
      maxDistance: 68.0,
      panBounds: { minX: -14.2, maxX: 14.2, minZ: -13.5, maxZ: 13.5 },
      distanceScale: 1.42,
    };
  }

  /* ============================================================================
   * 1. EXPANDED 160x160 VIKING FJORD VILLAGE TERRAIN, LONGSHIP DOCK & PINES
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
      const y = sampleVikingTerrainHeight(x, z);
      pos.setY(i, y);

      const { w0, w1, w2, w3, wetness } = sampleVikingBiomeWeights(x, z, y);
      splatAttr[i * 4 + 0] = w0;
      splatAttr[i * 4 + 1] = w1;
      splatAttr[i * 4 + 2] = w2;
      splatAttr[i * 4 + 3] = w3;
      wetAttr[i] = wetness;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splatAttr, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetAttr, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.viking.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    terrainMesh.raycast = () => {};
    this.root.add(terrainMesh);

    // Geological plinth skirt framing the 34x32 Nordic fjord diorama board
    const skirtGeo = this._trackGeo(new THREE.BoxGeometry(TERRAIN_W, 1.8, TERRAIN_D));
    const skirt = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirt.position.set(0, -1.04, 0);
    skirt.raycast = () => {};
    this.root.add(skirt);
    this.plinthMesh = skirt;

    // Deep Turquoise Nordic Fjord Inlet Water Surface (North-East)
    const fjordWaterGeo = this._trackGeo(new THREE.PlaneGeometry(11.6, 12.2, 8, 8));
    fjordWaterGeo.rotateX(-Math.PI / 2);
    this.fjordWaterMesh = new THREE.Mesh(fjordWaterGeo, this.viking.materials.fjordWater);
    this.fjordWaterMesh.position.set(11.8, FJORD_WATER_Y, -10.2);
    this.fjordWaterMesh.receiveShadow = true;
    this.fjordWaterMesh.raycast = () => {};
    this.root.add(this.fjordWaterMesh);

    // Wooden Longship Dock & Moored Viking Drakkar Longship in the NE Fjord
    this._buildFjordDockAndLongship();

    // Central Village Firepit Square (gathering hearth surrounded by the 3 Viking Houses)
    this._buildVillageFirepitSquare();

    // Snow-Dusted Nordic Pine Cliffs, Boulders, Runestones & Heather Ground Foliage
    this._buildNordicForestAndCliffs();
  }

  _buildFjordDockAndLongship() {
    const dockGroup = new THREE.Group();
    const vm = this.viking.materials;

    // Timber pier extending from the village shore (9.8, -6.2) into the fjord (12.4, -8.8)
    const pierAngle = Math.PI * 0.25;
    const pier = new THREE.Group();
    pier.position.set(11.1, FJORD_WATER_Y + 0.34, -7.5);
    pier.rotation.y = pierAngle;

    const deck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.72, 0.14, 4.1)),
      vm.nordicTimber
    );
    deck.castShadow = true;
    deck.receiveShadow = true;
    pier.add(deck);

    // Timber pilings & mooring bollards
    [-0.72, 0.72].forEach((px) => {
      [-1.7, -0.55, 0.55, 1.7].forEach((pz) => {
        const piling = new THREE.Mesh(
          this._trackGeo(new THREE.CylinderGeometry(0.085, 0.105, 1.35, 7)),
          vm.darkTimber
        );
        piling.position.set(px, -0.35, pz);
        piling.castShadow = true;
        pier.add(piling);
      });
    });

    // Pier lantern post at dock tip
    const lanternPost = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 1.25, 6)),
      vm.darkTimber
    );
    lanternPost.position.set(0.66, 0.62, -1.72);
    pier.add(lanternPost);
    const lanternGlow = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.11, 0)),
      vm.fireGlow
    );
    lanternGlow.position.set(0.66, 1.24, -1.72);
    pier.add(lanternGlow);
    this.fireFlames.push({ mesh: lanternGlow, phase: 2.1 });

    dockGroup.add(pier);

    // Moored 3D Viking Drakkar Longship bobbing peacefully in the fjord cove!
    const ship = new THREE.Group();
    ship.position.set(13.3, this.drakkarBaseY, -10.5);
    ship.rotation.y = -0.62;

    // Clinker-built curved wooden hull
    const hull = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.18, 0.42, 3.6)),
      vm.darkTimber
    );
    hull.position.y = 0.08;
    hull.castShadow = true;
    hull.receiveShadow = true;
    ship.add(hull);

    // Tapered bow & stern prows with curved carved dragon head
    [-1, 1].forEach((dir) => {
      const prow = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.56, 1.25, 4)),
        vm.nordicTimber
      );
      prow.rotation.x = dir * Math.PI * 0.5;
      prow.rotation.y = Math.PI * 0.25;
      prow.scale.set(0.88, 1, 0.48);
      prow.position.set(0, 0.16, dir * 2.18);
      prow.castShadow = true;
      ship.add(prow);

      // Swept dragon neck & carved golden crest finial
      const neck = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.14, 0.72, 0.22)),
        vm.dragonCarvedTrim
      );
      neck.position.set(0, 0.66, dir * 2.66);
      neck.rotation.x = dir * 0.34;
      ship.add(neck);

      const head = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.13, 0.34, 5)),
        vm.shieldGold
      );
      head.position.set(0, 1.02, dir * 2.86);
      head.rotation.x = dir * Math.PI * 0.48;
      ship.add(head);
    });

    // Central pine mast, yardarm & iconic red-and-white striped Viking square sail
    const mast = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.05, 0.068, 2.45, 7)),
      vm.darkTimber
    );
    mast.position.set(0, 1.32, 0);
    mast.castShadow = true;
    ship.add(mast);

    const yard = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 2.05, 6)),
      vm.darkTimber
    );
    yard.rotation.z = Math.PI * 0.5;
    yard.position.set(0, 2.18, 0.06);
    ship.add(yard);

    // 5 vertical red/white alternating striped sail panels
    for (let s = 0; s < 5; s++) {
      const panel = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.36, 1.32, 0.045)),
        s % 2 === 0 ? vm.sailStripeRed : vm.sailStripeWhite
      );
      panel.position.set((s - 2) * 0.37, 1.48, 0.14 + Math.cos((s - 2) * 0.5) * 0.08);
      panel.castShadow = true;
      ship.add(panel);
    }

    // Row of painted round shields lining both gunwales
    [-0.62, 0.62].forEach((sx, sideIdx) => {
      [-1.05, -0.35, 0.35, 1.05].forEach((sz, idx) => {
        const shield = new THREE.Mesh(
          this.vikingGeos.shieldDisk,
          (idx + sideIdx) % 2 === 0 ? vm.shieldRed : vm.shieldBlue
        );
        shield.scale.setScalar(0.82);
        shield.rotation.z = Math.PI * 0.5;
        shield.position.set(sx, 0.28, sz);
        ship.add(shield);
      });
    });

    dockGroup.add(ship);
    this.drakkarGroup = ship;
    this.root.add(dockGroup);
  }

  _buildVillageFirepitSquare() {
    const sq = new THREE.Group();
    const vm = this.viking.materials;
    const fx = FIREPIT_CENTER.x;
    const fz = FIREPIT_CENTER.z;
    const fy = sampleVikingTerrainHeight(fx, fz);

    // Circular hearth stone ring
    const ringCount = 10;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      const stone = new THREE.Mesh(
        this._trackGeo(new THREE.DodecahedronGeometry(0.18, 0)),
        vm.vikingStone
      );
      stone.scale.set(1.15, 0.68, 1.05);
      stone.position.set(fx + Math.cos(a) * 0.64, fy + 0.1, fz + Math.sin(a) * 0.64);
      stone.castShadow = true;
      stone.receiveShadow = true;
      sq.add(stone);
    }

    // Charred timber logs + glowing Nordic bonfire flame
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.78, 6)),
        vm.darkTimber
      );
      log.position.set(fx, fy + 0.12, fz);
      log.rotation.z = Math.PI * 0.44;
      log.rotation.y = (i / 3) * Math.PI;
      sq.add(log);
    }

    const flame = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.24, 0.62, 6)),
      vm.fireGlow
    );
    flame.position.set(fx, fy + 0.42, fz);
    sq.add(flame);
    this.fireFlames.push({ mesh: flame, phase: 0.4 });

    // Carved wooden village benches flanking the firepit
    [
      [fx - 1.25, fz + 0.4, 0.25],
      [fx + 1.25, fz + 0.5, -0.3],
    ].forEach(([bx, bz, rot]) => {
      const bench = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.95, 0.24, 0.34)),
        vm.nordicTimber
      );
      bench.position.set(bx, fy + 0.14, bz);
      bench.rotation.y = rot;
      bench.castShadow = true;
      bench.receiveShadow = true;
      sq.add(bench);
    });

    this.root.add(sq);
  }

  _buildNordicForestAndCliffs() {
    const vm = this.viking.materials;
    const foliageMat = this._trackMat(createMatteFoliageMaterial());
    const shadowEntries = [];
    const focalPoints = [];

    // Perimeter snow-dusted pine trees framing the cliffs, fjord shoreline & hills
    const pineCoords = [
      [-14.6, -13.2, true],
      [-10.8, -13.8, true],
      [-6.5, -13.2, true],
      [-2.2, -13.6, true],
      [2.0, -13.0, true],
      [5.8, -12.6, true],
      [8.4, -12.2, true],
      [-15.0, -7.8, true],
      [-14.8, -2.5, false],
      [-14.6, 3.6, false],
      [-14.4, 9.8, false],
      [-12.2, 13.6, false],
      [-6.5, 13.4, false],
      [-1.0, 13.2, false],
      [4.2, 12.8, false],
      [9.6, 12.4, false],
      [14.4, 10.6, false],
      [15.2, 5.2, false],
      [15.0, -0.8, false],
      [14.4, -4.4, true],
      [-3.2, -9.8, true],
      [0.6, -9.4, true],
    ];

    pineCoords.forEach(([tx, tz, snowDusted], idx) => {
      const ty = sampleVikingTerrainHeight(tx, tz);
      const tree = createNordicPineTree(
        tx,
        tz,
        ty,
        vm.darkTimber,
        foliageMat,
        vm.snowCap,
        (g) => this._trackGeo(g),
        idx + 11,
        snowDusted
      );
      this.root.add(tree);
      shadowEntries.push({ x: tx, z: tz, radius: 1.15, opacity: 0.42 });
      focalPoints.push({ x: tx, z: tz, radius: 2.4, weight: 0.85 });
    });

    // Craggy Nordic granite boulders & carved runestones along the northern cliffs
    [
      [-5.2, -11.4, 1.35],
      [0.4, -11.6, 1.48],
      [4.2, -10.8, 1.22],
      [-13.8, 1.2, 1.15],
      [14.8, 2.2, 1.1],
      [9.4, -8.2, 0.95],
    ].forEach(([rx, rz, sc], idx) => {
      const ry = sampleVikingTerrainHeight(rx, rz);
      const rock = new THREE.Mesh(
        this._trackGeo(new THREE.DodecahedronGeometry(0.68 * sc, 0)),
        vm.rawGranite
      );
      rock.scale.set(1.25, 0.72, 1.05);
      rock.position.set(rx, ry + 0.25 * sc, rz);
      rock.rotation.set(idx * 0.4, idx * 1.1, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.root.add(rock);
    });

    // Two standing carved Viking runestones greeting the village square entrance
    [
      [4.2, 5.8, 0.24],
      [8.6, -1.6, -0.32],
    ].forEach(([rx, rz, rot]) => {
      const ry = sampleVikingTerrainHeight(rx, rz);
      const rune = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.42, 1.18, 0.18)),
        vm.dragonCarvedTrim
      );
      rune.position.set(rx, ry + 0.56, rz);
      rune.rotation.y = rot;
      rune.castShadow = true;
      rune.receiveShadow = true;
      this.root.add(rune);
    });

    this.contactShadows = createContactShadowSystem(
      this.root,
      shadowEntries,
      (x, z) => sampleVikingTerrainHeight(x, z)
    );

    // Instanced cozy Nordic grass tufts, heather blooms & pebbles outside functional areas
    this.cozyFoliageSystem = createCozyGroundFoliageSystem({
      parent: this.root,
      getTerrainHeight: (x, z) => sampleVikingTerrainHeight(x, z),
      isBlocked: (x, z) => {
        if (x > -0.5 && x < 14.0 && z > -7.2 && z < 8.8) return true;
        if (x > -12.6 && x < -6.2 && z > -9.6 && z < 10.2) return true;
        if (x > -7.2 && x < 4.8 && z > 5.2 && z < 9.8) return true;
        if (x > 8.2 && z < -5.2) return true; // Fjord & dock
        return false;
      },
      getGrassWeight: (x, z) => {
        const y = sampleVikingTerrainHeight(x, z);
        if (y < FJORD_WATER_Y + 0.28 || y > 1.35) return 0;
        return 0.85;
      },
      focalPoints,
      waterLevel: FJORD_WATER_Y + 0.15,
      halfW: TERRAIN_W * 0.47,
      halfD: TERRAIN_D * 0.47,
      grassCount: 680,
      pebbleCount: 84,
      flowerCount: 72,
      grassPalette: ['#3d6b45', '#4f8052', '#648f5a', '#7c9a62'],
      flowerPalette: ['#9f62a8', '#b876b8', '#e6d68a', '#d8e6f0'],
      seed: 1111,
    });
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE GRANIT & BOIS DU FJORD (NW, STRICT SLOT OCCUPANCY)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarry = new THREE.Group();
    const vm = this.viking.materials;
    this.quarryNodes = [];
    this.quarrySlots = [];

    const qx = -10.5;
    const qz = -8.0;

    // Stepped dark grey-granite fjord quarry cliff backdrop
    [
      [-1.5, 1.05, -1.55, 3.6, 2.5, 2.3],
      [1.25, 0.82, -1.75, 2.9, 1.95, 1.9],
      [-2.35, 0.68, 0.55, 2.0, 1.6, 2.4],
    ].forEach(([ox, oy, oz, w, h, d]) => {
      const cliff = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(w, h, d)), vm.rawGranite);
      cliff.position.set(qx + ox, oy, qz + oz);
      cliff.castShadow = true;
      cliff.receiveShadow = true;
      cliff.raycast = () => {};
      quarry.add(cliff);
    });

    // Stacked felled Nordic pine logs beside the granite quarry (Granit & Bois du Fjord)
    const logGeo = this._trackGeo(new THREE.CylinderGeometry(0.18, 0.2, 2.1, 8));
    logGeo.rotateZ(Math.PI * 0.5);
    [
      [-12.9, 0.2, -5.8],
      [-12.9, 0.2, -5.36],
      [-12.9, 0.52, -5.58],
    ].forEach(([lx, ly, lz]) => {
      const lg = new THREE.Mesh(logGeo, vm.nordicTimber);
      lg.position.set(lx, sampleVikingTerrainHeight(lx, lz) + ly, lz);
      lg.castShadow = true;
      lg.receiveShadow = true;
      quarry.add(lg);
    });

    // 3 Extractable Granite Quarry Rock Nodes
    [
      [-1.3, 0.15],
      [0.05, -0.15],
      [1.35, 0.2],
    ].forEach(([ox, oz], idx) => {
      const nx = qx + ox;
      const nz = qz + oz;
      const ny = sampleVikingTerrainHeight(nx, nz) + 0.36;
      const group = new THREE.Group();
      group.position.set(nx, ny, nz);

      const mesh = new THREE.Mesh(this.geos.rawBlock, vm.rawGranite);
      mesh.scale.set(1.12, 0.86, 1.04);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const node = {
        id: `viking_quarry_${idx}`,
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

    // 6 Explicit Ground Quarry Output Storage Slots (strict slot.occupied -> zero stacking!)
    const padCx = -9.4;
    const padCz = -5.2;
    const padY = sampleVikingTerrainHeight(padCx, padCz);
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.85, 0.14, 2.25)),
      vm.flagstonePath
    );
    pad.position.set(padCx, padY + 0.07, padCz);
    pad.receiveShadow = true;
    pad.raycast = () => {};
    quarry.add(pad);

    [
      [-1.16, -0.52],
      [0.0, -0.52],
      [1.16, -0.52],
      [-1.16, 0.52],
      [0.0, 0.52],
      [1.16, 0.52],
    ].forEach(([ox, oz], idx) => {
      const sx = padCx + ox;
      const sz = padCz + oz;
      const marker = this._createSlotMarker(quarry, sx, padY + 0.155, sz);
      this.quarrySlots.push({
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

  /* ============================================================================
   * 3. ZONE 2 — LES CHARIOTS VIKINGS SUR RAILS DE BOIS (WEST & CENTER)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    this.sleds = [];
    this.cartWheels = [];
    const leverDist = this.sledCapacity === 4 ? 2.28 : 1.82;

    // Track A: Quarry Storage (Z = -2.4) -> Viking Workshop (Z = 4.2) along X = -9.4
    this._createTrackAndSled({
      id: 'sledA',
      axis: 'z',
      fixedCoord: -9.4,
      startPos: -2.4,
      endPos: 4.2,
      trackStart: -3.25,
      trackEnd: 5.05,
      accepts: ['raw', 'carved', 'capstone'],
      primaryKind: 'raw',
      leverLocalPos: new THREE.Vector3(leverDist, 0.34, 0),
    });

    // Track B: Viking Workshop (X = -5.6) -> Village Construction Hub (X = 0.8) along Z = 7.6
    this._createTrackAndSled({
      id: 'sledB',
      axis: 'x',
      fixedCoord: 7.6,
      startPos: -5.6,
      endPos: 0.8,
      trackStart: -6.45,
      trackEnd: 1.65,
      accepts: ['carved', 'capstone', 'raw'],
      primaryKind: 'carved',
      leverLocalPos: new THREE.Vector3(0, 0.34, leverDist),
    });

    // Dress both transport carts with iron-banded Nordic wood, spoked wheels & side shields
    const vm = this.viking.materials;
    const wheelGeo = this._trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12));
    wheelGeo.rotateZ(Math.PI * 0.5);

    this.sleds.forEach((sled, sIdx) => {
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
        const wheel = new THREE.Mesh(wheelGeo, vm.darkTimber);
        wheel.position.set(wx, wy, wz);
        if (alongX) wheel.rotation.y = Math.PI * 0.5;
        wheel.castShadow = true;
        sled.group.add(wheel);

        const rim = new THREE.Mesh(
          this._trackGeo(new THREE.TorusGeometry(0.21, 0.024, 6, 12)),
          vm.wroughtIron
        );
        rim.rotation.y = Math.PI * 0.5;
        wheel.add(rim);

        this.cartWheels.push({
          mesh: wheel,
          sled,
          lastCoord: sled.axis === 'z' ? sled.group.position.z : sled.group.position.x,
        });
      });

      // Decorative painted Viking round shields mounted on cart flanks
      [-1, 1].forEach((side) => {
        const shield = new THREE.Mesh(
          this.vikingGeos.shieldDisk,
          sIdx === 0 ? vm.shieldRed : vm.shieldBlue
        );
        shield.scale.setScalar(0.86);
        if (alongX) {
          shield.position.set(0, 0.34, side * 0.72);
        } else {
          shield.rotation.z = Math.PI * 0.5;
          shield.position.set(side * 0.72, 0.34, 0);
        }
        sled.group.add(shield);
      });
    });
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DU CHARPENTIER & TAILLEUR VIKING (SW, OPEN-TOP!)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const vm = this.viking.materials;
    const wx = -9.4;
    const wz = 7.6;
    const wy = sampleVikingTerrainHeight(wx, wz);

    // Compacted stone & timber workshop deck
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.5, 0.16, 3.9)),
      vm.flagstonePath
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.raycast = () => {};
    ws.add(floor);

    // Open-front cutaway Nordic timber-and-shingle awning (rear ~35% ONLY, raycast disabled!)
    [-2.0, 2.0].forEach((ox) => {
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.22, 2.35, 0.22)),
        vm.darkTimber
      );
      post.position.set(wx + ox, wy + 1.24, wz - 1.58);
      post.castShadow = true;
      post.raycast = () => {};
      ws.add(post);
    });
    const backAwning = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.5, 0.18, 1.38)),
      vm.vikingRoof
    );
    backAwning.position.set(wx, wy + 2.44, wz - 1.28);
    backAwning.rotation.x = 0.24;
    backAwning.raycast = () => {};
    ws.add(backAwning);

    // Dragon-carved Nordic ridge beam crowning the rear workshop canopy
    const ridgeBeam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.7, 0.16, 0.18)),
      vm.dragonCarvedTrim
    );
    ridgeBeam.position.set(wx, wy + 2.66, wz - 1.82);
    ridgeBeam.raycast = () => {};
    ws.add(ridgeBeam);

    // Viking Carpenter & Stonecutter Anvil Workbench (100% open & unobstructed from above)
    const anvilX = wx - 0.55;
    const anvilZ = wz + 0.18;
    const anvilBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.42, 0.72, 1.42)),
      vm.vikingStone
    );
    anvilBase.position.set(anvilX, wy + 0.52, anvilZ);
    anvilBase.castShadow = true;
    anvilBase.receiveShadow = true;
    ws.add(anvilBase);

    const anvilTrim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.5, 0.08, 1.5)),
      vm.dragonCarvedTrim
    );
    anvilTrim.position.set(anvilX, wy + 0.86, anvilZ);
    ws.add(anvilTrim);

    const wbMarker = this._createSlotMarker(ws, anvilX, wy + 0.915, anvilZ);
    this.workbenchSlot = {
      id: 'workbench',
      zoneType: 'workbench',
      accepts: ['raw'],
      // Clean +0.002 clearance above anvil top so single active carving mesh has zero z-fighting
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

    // 4 Workshop Output Slots (right of anvil)
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

    // 6 Village Construction Hub Staging Slots at East end of Track B (cleanly clear of rail end)
    const stageX = 3.65;
    const stageZ = 7.6;
    const stageY = sampleVikingTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.85, 0.14, 2.35)),
      vm.flagstonePath
    );
    stagePad.position.set(stageX, stageY + 0.07, stageZ);
    stagePad.receiveShadow = true;
    stagePad.raycast = () => {};
    ws.add(stagePad);

    this.stagingSlots = [];
    [
      [-1.16, -0.56],
      [0.0, -0.56],
      [1.16, -0.56],
      [-1.16, 0.56],
      [0.0, 0.56],
      [1.16, 0.56],
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
        occupied: false,
        block: null,
      });
    });

    this.root.add(ws);
  }

  /* ============================================================================
   * 5. ZONE 4 — CHANTIER DU VILLAGE VIKING (94 BLOCKS ACROSS 4 STRUCTURES)
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidSlots = [];
    this.villageZones = [];
    this.zoneById.clear();
    this.subGroups = [];
    this.subGroupById.clear();
    this.slotKeyMap.clear();

    const site = new THREE.Group();
    site.name = 'VikingVillageSite';
    this.root.add(site);
    this.villageSite = site;

    // Define the 4 Bottom Zone Selector groups ("Tout" + 3 focused village clusters)
    const zoneDefs = [
      {
        id: 'hall',
        label: 'Salle du Chef',
        icon: '🐉',
        focus: new THREE.Vector3(HALL_CENTER.x, 0.5, HALL_CENTER.z),
        distance: 15.8,
      },
      {
        id: 'houses',
        label: '3 Maisons',
        icon: '🏡',
        focus: new THREE.Vector3(FIREPIT_CENTER.x, 0.4, FIREPIT_CENTER.z + 1.0),
        distance: 18.5,
      },
      {
        id: 'farm_paths',
        label: 'Champ & Chemins',
        icon: '🌾',
        focus: new THREE.Vector3(9.4, 0.35, 3.0),
        distance: 18.2,
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
          h === BLOCK_H
            ? this.geos.ghostBox
            : this._trackGeo(new THREE.BoxGeometry(w * 0.96, h * 0.96, d * 0.96));
        const gEdges =
          h === BLOCK_H
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
          shieldSide: sp.shieldSide || null,
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

    /* ------------------------------------------------------------------------
     * STRUCTURE A — LA GRANDE SALLE DU CHEF / JARL (28 blocks exact!)
     * Main Hall 4x2 + projecting South Grand Entrance Portico 2x1:
     *   Layer 0: 10 carved dry-stone plinth blocks
     *   Layer 1: 8 thick Nordic log walls (w/ painted shields along eaves & portico posts)
     *   Layer 2: 10 welded steep pitched turf-and-shingle roofs + dragon-head finials
     * ---------------------------------------------------------------------- */
    const hallSpecs = [];
    const hallFloorY = HALL_ELEV + 0.06;
    const hallPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 4.35, 0.12, BLOCK_D * 3.35)),
      this.viking.materials.flagstonePath
    );
    hallPad.position.set(HALL_CENTER.x, HALL_ELEV, HALL_CENTER.z + 0.42);
    hallPad.receiveShadow = true;
    hallPad.raycast = () => {};
    site.add(hallPad);

    // Layer 0 (10 blocks): 4x2 main plinth + 2 South portico threshold blocks
    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        hallSpecs.push({
          gx,
          gz,
          layer: 0,
          x: HALL_CENTER.x + (gx - 1.5) * GRID_STEP,
          y: hallFloorY + BLOCK_H * 0.5,
          z: HALL_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'hall_foundation',
        });
      }
    }
    [1, 2].forEach((gx) => {
      hallSpecs.push({
        gx,
        gz: 2,
        layer: 0,
        x: HALL_CENTER.x + (gx - 1.5) * GRID_STEP,
        y: hallFloorY + BLOCK_H * 0.5,
        z: HALL_CENTER.z + 1.5 * GRID_STEP,
        pieceType: 'hall_foundation',
      });
    });

    // Layer 1 (8 blocks): 4x2 thick carved Nordic timber log walls + painted round shields
    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        hallSpecs.push({
          gx,
          gz,
          layer: 1,
          x: HALL_CENTER.x + (gx - 1.5) * GRID_STEP,
          y: hallFloorY + BLOCK_H * 1.5,
          z: HALL_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'hall_wall',
          shieldSide: gz === 1 ? 'south' : 'north',
        });
      }
    }

    // Layer 2 (10 blocks): 4x2 welded steep pitched roof + 2 South portico gable roof blocks
    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 2; gz++) {
        hallSpecs.push({
          gx,
          gz,
          layer: 2,
          x: HALL_CENTER.x + (gx - 1.5) * GRID_STEP,
          y: hallFloorY + BLOCK_H * 2.5,
          z: HALL_CENTER.z + (gz - 0.5) * GRID_STEP,
          pieceType: 'hall_roof',
          roofAxis: 'x',
        });
      }
    }
    [1, 2].forEach((gx) => {
      hallSpecs.push({
        gx,
        gz: 2,
        layer: 2,
        x: HALL_CENTER.x + (gx - 1.5) * GRID_STEP,
        y: hallFloorY + BLOCK_H * 2.5,
        z: HALL_CENTER.z + 1.5 * GRID_STEP,
        pieceType: 'hall_roof',
        roofAxis: 'z',
      });
    });

    const hallSub = registerSubGroup('hall', 'hall', hallSpecs);

    // Pre-build twin carved dragon-totem portico columns (revealed when Layer 0 finishes) &
    // crossed carved dragon-head gable finials (`drakkar` peaks) revealed when Hall finishes!
    this._buildHallCompletionFinials(hallSub.completionGroup, hallFloorY);

    /* ------------------------------------------------------------------------
     * STRUCTURE B — LES 3 MAISONS VIKINGS (3 × 14 = 42 blocks exact!)
     * West Cottage (porch East), South Cottage (porch North), East Cottage (porch West)
     * Each: 5 dry-stone foundation -> 4 timber plank walls -> 5 welded pitched roofs
     * ---------------------------------------------------------------------- */
    const houseConfigs = [
      {
        id: 'house_west',
        cx: 2.2,
        cz: 0.6,
        porchCell: [2, 1], // East doorstep facing Firepit Square
        roofAxis: 'z',
        variant: 0,
      },
      {
        id: 'house_south',
        cx: 6.4,
        cz: 4.7,
        porchCell: [0, -1], // North doorstep facing Firepit Square
        roofAxis: 'x',
        variant: 1,
      },
      {
        id: 'house_east',
        cx: 11.2,
        cz: 0.0,
        porchCell: [-1, 1], // West doorstep facing Firepit Square
        roofAxis: 'z',
        variant: 2,
      },
    ];

    houseConfigs.forEach((hc) => {
      const baseY = sampleVikingTerrainHeight(hc.cx, hc.cz) + 0.03;
      const hPad = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 2.4, 0.08, BLOCK_D * 2.4)),
        this.viking.materials.flagstonePath
      );
      hPad.position.set(hc.cx, baseY - 0.01, hc.cz);
      hPad.receiveShadow = true;
      hPad.raycast = () => {};
      site.add(hPad);

      const hSpecs = [];
      const [pgx, pgz] = hc.porchCell;

      // Layer 0 (5 blocks): 2x2 stone foundation + 1 front doorstep
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          hSpecs.push({
            gx,
            gz,
            layer: 0,
            x: hc.cx + (gx - 0.5) * GRID_STEP,
            y: baseY + BLOCK_H * 0.5,
            z: hc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'house_foundation',
            houseVariant: hc.variant,
          });
        }
      }
      hSpecs.push({
        gx: pgx,
        gz: pgz,
        layer: 0,
        x: hc.cx + (pgx - 0.5) * GRID_STEP,
        y: baseY + BLOCK_H * 0.5,
        z: hc.cz + (pgz - 0.5) * GRID_STEP,
        pieceType: 'house_foundation',
        houseVariant: hc.variant,
      });

      // Layer 1 (4 blocks): 2x2 carved Nordic wooden plank walls
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          hSpecs.push({
            gx,
            gz,
            layer: 1,
            x: hc.cx + (gx - 0.5) * GRID_STEP,
            y: baseY + BLOCK_H * 1.5,
            z: hc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'house_wall',
            houseVariant: hc.variant,
          });
        }
      }

      // Layer 2 (5 blocks): 2x2 + 1 porch welded pitched shingle/sod roofs
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          hSpecs.push({
            gx,
            gz,
            layer: 2,
            x: hc.cx + (gx - 0.5) * GRID_STEP,
            y: baseY + BLOCK_H * 2.5,
            z: hc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'house_roof',
            roofAxis: hc.roofAxis,
            houseVariant: hc.variant,
          });
        }
      }
      hSpecs.push({
        gx: pgx,
        gz: pgz,
        layer: 2,
        x: hc.cx + (pgx - 0.5) * GRID_STEP,
        y: baseY + BLOCK_H * 2.5,
        z: hc.cz + (pgz - 0.5) * GRID_STEP,
        pieceType: 'house_roof',
        roofAxis: hc.roofAxis,
        houseVariant: hc.variant,
      });

      const sub = registerSubGroup(hc.id, 'houses', hSpecs);
      this._buildHouseCompletionDecor(sub.completionGroup, hc, baseY);
    });

    /* ------------------------------------------------------------------------
     * STRUCTURE C — LE CHAMP DE BLÉ & ENCLOS AGRICOLE (South-East, 12 blocks!)
     * 4x3 fenced fertile farm plot of welded plowed soil blocks + swaying wheat
     * ---------------------------------------------------------------------- */
    const farmSpecs = [];
    const farmBaseY = sampleVikingTerrainHeight(FARM_CENTER.x, FARM_CENTER.z) + 0.02;
    this._buildFarmWoodenFence(site, FARM_CENTER.x, FARM_CENTER.z, farmBaseY);

    for (let gx = 0; gx < 4; gx++) {
      for (let gz = 0; gz < 3; gz++) {
        farmSpecs.push({
          gx,
          gz,
          layer: 0,
          x: FARM_CENTER.x + (gx - 1.5) * GRID_STEP,
          y: farmBaseY + FARM_BLOCK_H * 0.5,
          z: FARM_CENTER.z + (gz - 1.0) * GRID_STEP,
          blockW: BLOCK_W,
          blockH: FARM_BLOCK_H,
          blockD: BLOCK_D,
          pieceType: 'farm_plot',
        });
      }
    }
    registerSubGroup('farm', 'farm_paths', farmSpecs);

    /* ------------------------------------------------------------------------
     * STRUCTURE D — CHEMINS EN PIERRES & PONTON DU FJORD (12 blocks exact!)
     * Flagstone walkways linking the 3 houses, wheat field, Jarl's Hall & Dock
     * ---------------------------------------------------------------------- */
    const pathCoords = [
      // North spur: Firepit Square -> Chief's Longhouse Portico (2)
      [6.4, -0.5, 0, 0],
      [6.4, -1.46, 0, -1],
      // West spur: Firepit Square -> West Cottage (2)
      [5.06, 1.08, -2, 1],
      [4.1, 1.08, -3, 1],
      // South spur: Firepit Square -> South Cottage (2)
      [5.92, 2.02, -1, 2],
      [5.92, 2.98, -1, 3],
      // East spur: Firepit Square -> East Cottage (2)
      [7.86, 0.48, 2, 0],
      [8.82, 0.48, 3, 0],
      // South-East spur: Village Square -> Wheat Field Gate (2)
      [8.34, 3.64, 2, 4],
      [9.14, 4.3, 3, 4],
      // North-East spur: Longhouse East -> Fjord Longship Dock (2)
      [8.86, -4.35, 4, -4],
      [9.58, -5.18, 5, -5],
    ];
    const pathSpecs = pathCoords.map(([px, pz, gx, gz]) => {
      const py = sampleVikingTerrainHeight(px, pz) + 0.02;
      return {
        gx,
        gz,
        layer: 0,
        x: px,
        y: py + PATH_BLOCK_H * 0.5,
        z: pz,
        blockW: BLOCK_W,
        blockH: PATH_BLOCK_H,
        blockD: BLOCK_D,
        pieceType: 'path_stone',
      };
    });
    registerSubGroup('paths', 'farm_paths', pathSpecs);

    this.totalGoal = this.pyramidSlots.length; // Exactly 94 blocks!
    this.maxLayerIndex = 2;

    this._syncZoneGhostVisibility();
    this._mountZoneSelectorHud();
  }

  /**
   * Builds the crossed carved dragon-head gable finials (`drakkar` peaks), dragon ridge beam,
   * and twin carved portico pillars for the Chief's Longhouse.
   */
  _buildHallCompletionFinials(group, hallFloorY) {
    const vm = this.viking.materials;
    const ridgeY = hallFloorY + BLOCK_H * 2.5 + BLOCK_H * 1.18 * 0.5 - 0.04;

    // Dragon-carved ridge beam seated flush across the entire 4-block Main Hall peak
    const mainRidge = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 4.22, 0.16, 0.18)),
      vm.dragonCarvedTrim
    );
    mainRidge.position.set(HALL_CENTER.x, ridgeY, HALL_CENTER.z);
    mainRidge.castShadow = true;
    group.add(mainRidge);

    // Crossed carved dragon-head gable finials (`drakkar` roof peaks) on East & West gables
    [-1, 1].forEach((dir) => {
      const gx = HALL_CENTER.x + dir * (BLOCK_W * 2.04);
      [-1, 1].forEach((tilt) => {
        const horn = new THREE.Mesh(
          this._trackGeo(new THREE.BoxGeometry(0.14, 0.64, 0.14)),
          vm.dragonCarvedTrim
        );
        horn.position.set(gx + dir * 0.08, ridgeY + 0.18, HALL_CENTER.z + tilt * 0.16);
        horn.rotation.x = tilt * 0.48;
        horn.rotation.z = -dir * 0.22;
        horn.castShadow = true;
        group.add(horn);

        const crest = new THREE.Mesh(
          this._trackGeo(new THREE.ConeGeometry(0.085, 0.22, 5)),
          vm.shieldGold
        );
        crest.position.set(gx + dir * 0.16, ridgeY + 0.46, HALL_CENTER.z + tilt * 0.3);
        crest.rotation.z = -dir * 0.75;
        group.add(crest);
      });
    });

    // South Portico crossed dragon finial + twin carved entrance posts
    const portZ = HALL_CENTER.z + 1.98 * GRID_STEP;
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.085, 0.1, BLOCK_H * 1.15, 7)),
        vm.dragonCarvedTrim
      );
      post.position.set(HALL_CENTER.x + side * 0.78, hallFloorY + BLOCK_H * 1.48, portZ - 0.12);
      post.castShadow = true;
      group.add(post);

      const pFinial = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.11, 0.5, 0.11)),
        vm.shieldGold
      );
      pFinial.position.set(HALL_CENTER.x + side * 0.14, ridgeY + 0.14, portZ - 0.04);
      pFinial.rotation.z = -side * 0.45;
      group.add(pFinial);
    });
  }

  /**
   * Builds cozy completion trim (stone chimney, ridge beam & porch posts) for each Viking Cottage.
   */
  _buildHouseCompletionDecor(group, hc, baseY) {
    const vm = this.viking.materials;
    const ridgeY = baseY + BLOCK_H * 2.5 + BLOCK_H * 1.18 * 0.5 - 0.04;

    const ridge = new THREE.Mesh(
      this._trackGeo(
        new THREE.BoxGeometry(
          hc.roofAxis === 'x' ? BLOCK_W * 2.12 : 0.14,
          0.14,
          hc.roofAxis === 'z' ? BLOCK_D * 2.12 : 0.14
        )
      ),
      vm.dragonCarvedTrim
    );
    ridge.position.set(hc.cx, ridgeY, hc.cz);
    group.add(ridge);

    const chim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.36, 0.62, 0.36)),
      vm.vikingStone
    );
    chim.position.set(hc.cx + 0.42, ridgeY + 0.04, hc.cz - 0.32);
    chim.castShadow = true;
    group.add(chim);

    // Timber porch support posts on the open doorstep bay
    const [pgx, pgz] = hc.porchCell;
    const px = hc.cx + (pgx - 0.5) * GRID_STEP;
    const pz = hc.cz + (pgz - 0.5) * GRID_STEP;
    [-0.36, 0.36].forEach((off) => {
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.06, 0.072, BLOCK_H * 1.1, 6)),
        vm.darkTimber
      );
      post.position.set(
        px + (hc.roofAxis === 'x' ? off : 0),
        baseY + BLOCK_H * 1.5,
        pz + (hc.roofAxis === 'z' ? off : 0)
      );
      post.castShadow = true;
      group.add(post);
    });
  }

  /**
   * Builds the rustic wooden split-rail agricultural fence surrounding the 4x3 SE Wheat Field.
   */
  _buildFarmWoodenFence(site, cx, cz, baseY) {
    const vm = this.viking.materials;
    const hw = BLOCK_W * 2.08;
    const hd = BLOCK_D * 1.58;
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.052, 0.064, 0.62, 6));

    // Perimeter fence posts (leaving a West gateway facing the village square)
    const posts = [];
    for (let i = 0; i <= 4; i++) {
      const fx = cx - hw + (i / 4) * hw * 2;
      posts.push([fx, cz - hd], [fx, cz + hd]);
    }
    for (let j = 1; j < 3; j++) {
      const fz = cz - hd + (j / 3) * hd * 2;
      posts.push([cx + hw, fz]);
      if (j !== 1) posts.push([cx - hw, fz]); // Gateway opening on West side
    }

    posts.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, vm.darkTimber);
      post.position.set(px, baseY + 0.31, pz);
      post.castShadow = true;
      site.add(post);
    });

    // Horizontal split-timber fence rails
    const addRail = (x, z, len, alongZ) => {
      [0.24, 0.46].forEach((ry) => {
        const rail = new THREE.Mesh(
          this._trackGeo(
            new THREE.BoxGeometry(alongZ ? 0.065 : len, 0.065, alongZ ? len : 0.065)
          ),
          vm.nordicTimber
        );
        rail.position.set(x, baseY + ry, z);
        rail.castShadow = true;
        site.add(rail);
      });
    };
    addRail(cx, cz - hd, hw * 2, false);
    addRail(cx, cz + hd, hw * 2, false);
    addRail(cx + hw, cz, hd * 2, true);
    addRail(cx - hw, cz + hd * 0.56, hd * 0.88, true);
  }

  /* ============================================================================
   * 6. MULTI-ZONE FREE-ORDER GHOSTS, DROP VALIDATION & CONNECTED MASONRY
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
        this.cameraController.desiredTarget.set(5.4, 0.4, 0.8);
        this.cameraController.desiredDistance = 24.5;
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
        if (!slot.occupied && !slot.block) valid.push(slot);
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

    // All zones are buildable in ANY order! Include every currently active-layer village slot.
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
    // Prefer the currently focused zone tab when choosing the crafted architectural material
    const preferred = this.pyramidSlots.filter(
      (s) =>
        this._isSlotCurrentlyActive(s) &&
        (this.activeZoneFilter === 'all' || s.zoneId === this.activeZoneFilter)
    );
    const pool = preferred.length > 0
      ? preferred
      : this.pyramidSlots.filter((s) => this._isSlotCurrentlyActive(s));

    if (pool.some((s) => s.pieceType === 'hall_roof' || s.pieceType === 'house_roof')) {
      return 'hall_roof';
    }
    if (pool.some((s) => s.pieceType === 'hall_wall' || s.pieceType === 'house_wall')) {
      return 'hall_wall';
    }
    if (pool.some((s) => s.pieceType === 'farm_plot')) return 'farm_plot';
    if (pool.some((s) => s.pieceType === 'path_stone')) return 'path_stone';
    return 'hall_foundation';
  }

  _resolveCarvingTargetMaterial() {
    const pieceType = this._pickNextCarvedPieceType();
    const vm = this.viking.materials;
    if (pieceType === 'hall_roof' || pieceType === 'house_roof') return vm.vikingRoof;
    if (pieceType === 'hall_wall' || pieceType === 'house_wall') return vm.nordicTimber;
    if (pieceType === 'farm_plot') return vm.plowedSoilWheat;
    if (pieceType === 'path_stone') return vm.flagstonePath;
    return vm.vikingStone || this.carvedBlockMat;
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyVikingPieceVisual(block, pieceType, null, false);
    }
    return stillRaw;
  }

  _clearCustomAttach(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  _applyVikingPieceVisual(block, pieceType, slot = null, isPlaced = false) {
    const vm = this.viking.materials;
    block.pieceType = pieceType;
    this._clearCustomAttach(block);

    if (pieceType === 'hall_roof' || pieceType === 'house_roof') {
      block.mesh.geometry = this.vikingGeos.roofPreview;
      block.mesh.material =
        slot && slot.houseVariant === 1 ? vm.vikingRoofWarm : vm.vikingRoof;
      return;
    }

    if (pieceType === 'hall_wall' || pieceType === 'house_wall') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material =
        slot && slot.houseVariant === 2 ? vm.darkTimber : vm.nordicTimber;
      if (isPlaced && pieceType === 'hall_wall' && slot && slot.shieldSide) {
        this._attachLonghouseShield(block, slot);
      }
      return;
    }

    if (pieceType === 'farm_plot') {
      block.mesh.geometry = this.vikingGeos.farmBlock;
      block.mesh.material = vm.plowedSoilWheat;
      if (isPlaced) {
        this._attachWheatStalkCluster(block, slot);
      }
      return;
    }

    if (pieceType === 'path_stone') {
      block.mesh.geometry = this.vikingGeos.pathBlock;
      block.mesh.material = vm.flagstonePath;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = vm.vikingStone;
  }

  /**
   * Attaches decorative painted Viking round shields along the Jarl's Longhouse eaves.
   */
  _attachLonghouseShield(block, slot) {
    const vm = this.viking.materials;
    const g = new THREE.Group();
    const zSign = slot.shieldSide === 'south' ? 1 : -1;
    const shieldMat = (slot.gridX + slot.gridZ) % 2 === 0 ? vm.shieldRed : vm.shieldBlue;

    const disk = new THREE.Mesh(this.vikingGeos.shieldDisk, shieldMat);
    disk.position.set(0, 0.06, zSign * (BLOCK_D * 0.5 + 0.032));
    disk.castShadow = true;
    g.add(disk);

    const boss = new THREE.Mesh(this.vikingGeos.shieldBoss, vm.shieldGold);
    boss.position.set(0, 0.06, zSign * (BLOCK_D * 0.5 + 0.055));
    g.add(boss);

    block.mesh.add(g);
    block.customAttach = g;
  }

  /**
   * Sprouts a cluster of swaying golden 3D wheat stalks atop each placed farm plot block.
   */
  _attachWheatStalkCluster(block, slot) {
    const vm = this.viking.materials;
    const cluster = new THREE.Group();
    const offsets = [
      [-0.28, -0.24],
      [0.02, -0.26],
      [0.28, -0.22],
      [-0.24, 0.04],
      [0.06, 0.02],
      [0.3, 0.06],
      [-0.26, 0.26],
      [0.04, 0.24],
      [0.26, 0.26],
    ];
    const seedBase = (slot ? slot.index : 1) * 1.7;

    offsets.forEach(([ox, oz], idx) => {
      const stalkPivot = new THREE.Group();
      stalkPivot.position.set(ox, FARM_BLOCK_H * 0.5, oz);

      const stem = new THREE.Mesh(this.vikingGeos.wheatStalk, vm.goldWheat);
      stem.position.y = 0.2;
      stalkPivot.add(stem);

      const head = new THREE.Mesh(this.vikingGeos.wheatHead, vm.goldWheat);
      head.position.y = 0.44;
      stalkPivot.add(head);

      cluster.add(stalkPivot);
      this.wheatStalks.push({ mesh: stalkPivot, phase: seedBase + idx * 0.6 });
    });

    block.mesh.add(cluster);
    block.customAttach = cluster;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyVikingPieceVisual(block, slot.pieceType, slot, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const chipMat =
      slot.pieceType === 'farm_plot'
        ? this.vikingFxMats.chipWheat
        : slot.pieceType === 'hall_wall' || slot.pieceType === 'house_wall'
          ? this.vikingFxMats.chipTimber
          : this.vikingFxMats.chipGranite;

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
      slot.pieceType === 'hall_foundation' ||
      slot.pieceType === 'hall_wall' ||
      slot.pieceType === 'house_foundation' ||
      slot.pieceType === 'house_wall' ||
      slot.pieceType === 'farm_plot' ||
      slot.pieceType === 'path_stone'
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
      slot.pieceType === 'path_stone' ? 0.024 : 0.038
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
      slot && slot.block && (slot.pieceType === 'hall_roof' || slot.pieceType === 'house_roof')
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
    slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
      BLOCK_W,
      BLOCK_H * 1.18,
      BLOCK_D,
      mask,
      { style: 'gable', defaultAxis: slot.roofAxis || 'x', eaveOverhang: 0.04 }
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

    this._updateConnectedMasonryAround(slot);
    this._updateConnectedRoofAround(slot);

    const sub = slot.subGroup;
    const zone = this.zoneById.get(slot.zoneId);
    if (sub) sub.placedCount += 1;
    if (zone) zone.placedCount += 1;

    if (this.onProgress) {
      this.onProgress(this.placedCount, this.totalGoal);
    }

    // Independently unlock next vertical layer within this sub-structure!
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
   * 7. BOTTOM ZONE SELECTOR BAR ("Tout", "Salle du Chef", "3 Maisons", "Champ & Chemins")
   * ========================================================================== */
  _mountZoneSelectorHud() {
    this._unmountZoneSelectorHud();
    if (typeof document === 'undefined') return;
    const rootEl = document.getElementById('game-root') || document.body;

    const bar = document.createElement('div');
    bar.id = 'viking-zone-bar';
    bar.className = 'city-district-bar';
    bar.setAttribute('aria-label', 'Zones du Village Viking');

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
   * 8. NORTHERN LIGHTS & GOLDEN SUNBEAM CELEBRATION (+450 OR, +55 ÉCLATS)
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

    // Ensure all sub-structure celebration trim is visible
    this.subGroups.forEach((sub) => {
      if (sub.completionGroup) sub.completionGroup.visible = true;
    });

    const pc = new THREE.Vector3(HALL_CENTER.x, 1.2, FIREPIT_CENTER.z - 1.2);
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.copy(pc);

    // Golden victory sunbeams rising above the Viking village
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffe48c,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.75, 2.9, 12.5, 20, 1, true)),
      innerMat
    );
    this.victoryBeamInner.position.y = 5.4;
    this.victoryGroup.add(this.victoryBeamInner);

    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0x76ffd0,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(1.3, 4.2, 13.0, 22, 1, true)),
      outerMat
    );
    this.victoryBeamOuter.position.y = 5.6;
    this.victoryGroup.add(this.victoryBeamOuter);

    // Shimmering Northern Lights (Aurora Borealis) arched curtains over the fjord & village
    const ribbonSpecs = [
      { y: 7.4, z: -4.2, w: 18.0, h: 3.4, mat: this.vikingFxMats.auroraEmerald, phase: 0.0 },
      { y: 8.6, z: -2.2, w: 16.5, h: 2.8, mat: this.vikingFxMats.auroraCyan, phase: 1.7 },
      { y: 9.4, z: -5.8, w: 15.0, h: 2.5, mat: this.vikingFxMats.auroraViolet, phase: 3.1 },
    ];
    this.auroraRibbons = [];
    ribbonSpecs.forEach((rs) => {
      const geo = this._trackGeo(new THREE.PlaneGeometry(rs.w, rs.h, 24, 3));
      const mesh = new THREE.Mesh(geo, rs.mat);
      mesh.position.set(0, rs.y, rs.z);
      mesh.rotation.x = 0.16;
      this.victoryGroup.add(mesh);
      this.auroraRibbons.push({ mesh, geo, baseY: rs.y, phase: rs.phase });
    });

    this.root.add(this.victoryGroup);

    // Celebratory golden & emerald aurora burst
    this._spawnParticles(new THREE.Vector3(HALL_CENTER.x, 3.2, HALL_CENTER.z), {
      count: 30,
      material: this.mats.dustGold,
      speed: 3.8,
      upSpeed: 4.8,
      scale: 0.96,
      life: 1.25,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level11Viking.meta.id,
        focusPoint: new THREE.Vector3(HALL_CENTER.x, 2.0, FIREPIT_CENTER.z - 0.8),
        rewardCoins: 450,
        firstCompletionTokens: 55,
      });
    }
  }

  /* ============================================================================
   * 9. REAL-TIME ANIMATION LOOP (FJORD, DRAKKAR, CART WHEELS, WHEAT, FIRE & AURORA)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Spin Nordic transport cart wheels smoothly along wooden tracks
    for (let i = 0; i < this.cartWheels.length; i++) {
      const cw = this.cartWheels[i];
      const coord = cw.sled.axis === 'z' ? cw.sled.group.position.z : cw.sled.group.position.x;
      const delta = coord - cw.lastCoord;
      cw.lastCoord = coord;
      if (Math.abs(delta) > 0.0001) {
        cw.mesh.rotation.x += delta / 0.22;
      }
    }

    // 2. Animated Nordic fjord water ripples & gently bobbing Drakkar longship
    if (this.fjordWaterMesh && this.fjordWaterMesh.material && this.fjordWaterMesh.material.normalMap) {
      this.fjordWaterMesh.material.normalMap.offset.x = (elapsed * 0.022) % 1;
      this.fjordWaterMesh.material.normalMap.offset.y = (elapsed * 0.015) % 1;
    }
    if (this.drakkarGroup) {
      this.drakkarGroup.position.y = this.drakkarBaseY + Math.sin(elapsed * 1.45) * 0.055;
      this.drakkarGroup.rotation.z = Math.sin(elapsed * 1.15 + 0.6) * 0.045;
      this.drakkarGroup.rotation.x = Math.cos(elapsed * 0.95) * 0.025;
    }

    // 3. Flickering firepit & dock lantern flames
    for (let i = 0; i < this.fireFlames.length; i++) {
      const f = this.fireFlames[i];
      const fl = 0.86 + Math.sin(elapsed * 9.8 + f.phase) * 0.16;
      f.mesh.scale.set(fl * 0.92, fl * 1.22, fl * 0.92);
    }

    // 4. Gently swaying golden wheat stalks in the Nordic breeze
    for (let i = 0; i < this.wheatStalks.length; i++) {
      const w = this.wheatStalks[i];
      w.mesh.rotation.z = Math.sin(elapsed * 2.1 + w.phase) * 0.14;
      w.mesh.rotation.x = Math.cos(elapsed * 1.7 + w.phase * 0.8) * 0.07;
    }

    // 5. Cozy heather & grass foliage wind sway
    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.update === 'function') {
      this.cozyFoliageSystem.update(elapsed);
    }

    // 6. Animated Aurora Borealis ribbons & golden sparks after village completion
    if (this.isComplete && this.auroraRibbons.length > 0) {
      for (let r = 0; r < this.auroraRibbons.length; r++) {
        const rb = this.auroraRibbons[r];
        const posAttr = rb.geo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const px = posAttr.getX(i);
          const waveZ = Math.sin(px * 0.34 + elapsed * 1.2 + rb.phase) * 1.15;
          posAttr.setZ(i, waveZ);
        }
        posAttr.needsUpdate = true;
      }

      this.victorySparkTimer += dt;
      if (this.victorySparkTimer >= 0.72) {
        this.victorySparkTimer = 0;
        this._spawnParticles(
          new THREE.Vector3(
            HALL_CENTER.x + (Math.random() - 0.5) * 5.2,
            2.6 + Math.random() * 1.8,
            FIREPIT_CENTER.z + (Math.random() - 0.5) * 4.5
          ),
          {
            count: 3,
            material: this.mats.dustGold,
            speed: 0.8,
            upSpeed: 1.7,
            scale: 0.72,
            life: 1.0,
          }
        );
      }
    }
  }

  dispose() {
    this._unmountZoneSelectorHud();
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
    super.dispose();
  }
}
