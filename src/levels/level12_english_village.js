/**
 * Workd Builder — Level 12: Edwardian England (1900s Era — "Le Village Anglais 1900")
 *
 * Built on the Tier 1 Village Architecture (160x160 sculpted terrain mesh, 34x32 world board),
 * optimized for locked 60 FPS on iPhone 16e Safari (390x844, devicePixelRatio capped at 2).
 *
 * Composition (104 blocks across 4 multi-part Edwardian village zones, buildable in ANY order):
 *  - Structure A — La Tour de l'Horloge Édouardienne (Center-North, 26 blocks):
 *      9 honey-limestone plinth -> 4 + 4 Edwardian red-brick shaft -> 4 glowing brass-and-white
 *      clockfaces -> 4 welded Welsh-slate spire base -> 1 steep slate spire peak & golden weathervane.
 *  - Structure B — Les 3 Cottages Anglais & Le Pub "The Crown" (4 × 14 = 56 blocks):
 *      Three brick-and-half-timbered Cotswold cottages + corner village pub "The Crown" with bay
 *      windows, warm glowing panes, welded Welsh-slate pitched roofs & tall red-brick chimneys.
 *  - Structure C — Le Square du Village & Kiosque à Musique (Center Plaza, 10 blocks):
 *      Octagonal-cross white-and-green Victorian garden bandstand ringed by boxwood hedges & flowers.
 *  - Structure D — Rues Pavées & Pont de Pierre sur le Ruisseau (12 blocks):
 *      9 cobblestone village lanes + 3 arched honey-stone brook footbridge blocks across the NE brook.
 *  - Bottom Zone Selector Bar ("Tout", "Tour de l'Horloge", "3 Cottages & Pub", "Jardin & Chemins")
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
  createMatteFoliageMaterial,
  createRootedTrunk,
  createOrganicFoliageBlobGeo,
} from '../foliageAndGround.js';

const TIER_SPEC = getLevelTierSpec(12);
const TERRAIN_W = TIER_SPEC.boardWidth;         // 34.0
const TERRAIN_D = TIER_SPEC.boardDepth;         // 32.0
const TERRAIN_SEGS = TIER_SPEC.terrainSegments; // 160x160 sculpted countryside mesh

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const GRID_STEP = BLOCK_W;
const LANE_BLOCK_H = 0.18;
const BRIDGE_BLOCK_H = 0.34;

const BROOK_WATER_Y = -0.30;
const CLOCK_CENTER = { x: 6.4, z: -4.6 };
const GAZEBO_CENTER = { x: 6.4, z: 1.0 };

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

function distToEnglishBrook(x, z) {
  return Math.min(
    segmentDist(x, z, 8.6, -15.2, 10.6, -9.2),
    segmentDist(x, z, 10.6, -9.2, 10.8, -5.8),
    segmentDist(x, z, 10.8, -5.8, 13.6, -3.4),
    segmentDist(x, z, 13.6, -3.4, 16.4, -2.0)
  );
}

/**
 * Unified 160x160 Sculpted Cotswold / Yorkshire 1900s English Countryside Heightfield.
 */
function sampleEnglishTerrainHeight(x, z) {
  // Gentle rolling English countryside hills
  let h =
    Math.sin(x * 0.16 + 0.5) * Math.cos(z * 0.15 - 0.35) * 0.16 +
    Math.sin(x * 0.38 - z * 0.32) * 0.04;

  // Cotswold green hills framing outer perimeter
  const northHill = smoothstep(-9.4, -14.8, z) * smoothstep(9.0, 2.5, x) * 1.65;
  const nwQuarryBank = smoothstep(-11.8, -15.6, x) * smoothstep(-3.0, -10.5, z) * 1.15;
  const westHill = smoothstep(-12.2, -16.2, x) * 0.98;
  const southHill = smoothstep(10.8, 15.2, z) * 0.72;
  const eastHill = smoothstep(13.6, 16.6, x) * smoothstep(-1.5, 4.5, z) * 0.92;
  h += northHill + nwQuarryBank + westHill + southHill + eastHill;

  // Honey-limestone & red-brick clay quarry pit in the North-West
  const pitDist = Math.hypot((x + 10.6) * 0.8, (z + 8.0) * 0.95);
  h -= (1.0 - smoothstep(1.35, 3.5, pitDist)) * 0.42;

  // Meandering turquoise English countryside brook curving across the North-East
  const brookD = distToEnglishBrook(x, z);
  const brookMask = 1.0 - smoothstep(0.95, 2.35, brookD);
  h = h * (1.0 - brookMask) + -0.82 * brookMask;

  // Manicured flat English village green & 4-station production yard
  const flatMask = clamp01(
    Math.max(
      rectFlatMask(x, z, 6.2, 0.8, 6.9, 6.3, 1.75),    // Village green, clocktower, 3 cottages, pub & gazebo
      rectFlatMask(x, z, -9.4, -5.35, 2.9, 1.9, 1.2),  // Quarry output storage pad
      rectFlatMask(x, z, -9.4, 1.0, 1.75, 5.2, 1.05),  // Track A corridor
      rectFlatMask(x, z, -9.4, 7.6, 2.8, 2.4, 1.25),   // Stonemason & Carpenter workshop
      rectFlatMask(x, z, -2.8, 7.6, 5.6, 1.8, 1.15),   // Track B corridor
      rectFlatMask(x, z, 3.25, 7.6, 2.4, 1.9, 1.15)    // Village staging pad
    )
  );
  // Keep brook carved cleanly through the NE corner even near the plateau edge
  const effectiveFlat = flatMask * (1.0 - brookMask * 0.92);
  h *= 1.0 - effectiveFlat;

  const rimX = smoothstep(TERRAIN_W * 0.47, TERRAIN_W * 0.5, Math.abs(x));
  const rimZ = smoothstep(TERRAIN_D * 0.47, TERRAIN_D * 0.5, Math.abs(z));
  h -= Math.max(rimX, rimZ) * (1.0 - brookMask) * 0.16;

  return h;
}

/**
 * Computes 4-layer English countryside terrain splat weights:
 *  w0: Lush English Meadow Grass & Clover
 *  w1: Compacted Cobblestone High Street & Gravel Country Lanes
 *  w2: Crushed Honey-Limestone & Brick-Clay Quarry Dust
 *  w3: Mossy Brook Bank & Garden Border Loam
 */
function sampleEnglishBiomeWeights(x, z, h) {
  const qDust = 1.0 - smoothstep(2.3, 5.3, Math.hypot(x + 10.2, z + 6.9));
  const wsDust = rectFlatMask(x, z, -9.4, 7.6, 2.4, 2.1, 1.3) * 0.82;
  const wQuarry = clamp01(Math.max(qDust, wsDust));

  const brookD = distToEnglishBrook(x, z);
  const wBrook = 1.0 - smoothstep(1.3, 3.0, brookD);

  // High Street & country lanes linking tracks, staging, village green, clocktower, cottages, pub & bridge
  const dTrackA = segmentDist(x, z, -9.4, -4.8, -9.4, 6.2);
  const dTrackB = segmentDist(x, z, -6.5, 7.6, 3.5, 7.6);
  const dEntry = segmentDist(x, z, 3.25, 7.6, 6.4, 1.0);
  const dHighStNS = segmentDist(x, z, 6.4, -4.6, 6.4, 5.2);
  const dHighStEW = segmentDist(x, z, 2.0, 0.8, 11.4, 1.2);
  const dNorthCot = segmentDist(x, z, 1.8, -4.4, 6.4, -4.4);
  const dBridge = segmentDist(x, z, 6.4, -4.6, 12.6, -6.4);
  const laneDist = Math.min(dTrackA, dTrackB, dEntry, dHighStNS, dHighStEW, dNorthCot, dBridge);
  const wLane = clamp01(1.0 - smoothstep(0.85, 2.0, laneDist));

  let w3 = wBrook;
  let w2 = wQuarry * (1.0 - wBrook * 0.7);
  let w1 = wLane * (1.0 - wBrook * 0.65) * (1.0 - wQuarry * 0.45);
  let w0 = Math.max(0.05, 1.0 - clamp01(w1 + w2 + w3));

  const sum = w0 + w1 + w2 + w3 || 1;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = (1.0 - smoothstep(BROOK_WATER_Y - 0.04, BROOK_WATER_Y + 0.28, h)) * clamp01(wBrook * 1.4);
  return { w0, w1, w2, w3, wetness };
}

/**
 * Creates a stylized English Broadleaf Countryside Oak Tree.
 */
function createEnglishOakTree(x, z, groundY, trunkMat, foliageMat, trackGeo, seed = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.rotation.y = (seed % 9) * 0.78;
  const sc = 0.94 + (seed % 4) * 0.09;
  tree.scale.setScalar(sc);

  const trunk = createRootedTrunk({
    height: 1.22,
    botR: 0.17,
    topR: 0.09,
    barkMat: trunkMat,
    trackGeo,
    seed: seed + 31,
  });
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 1.22;
  const puffs = [
    [0.0, 0.34, 0.0, 0.72],
    [-0.44, 0.06, 0.22, 0.52],
    [0.44, 0.1, -0.2, 0.54],
    [0.16, 0.14, 0.42, 0.48],
    [-0.2, 0.08, -0.38, 0.46],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pz, r] = puffs[i];
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: r,
        detail: 1,
        squashY: 0.85,
        irregularity: 0.22,
        seed: seed * 19 + i * 13,
        baseColor: '#245224',
        midColor: '#3f7f34',
        topColor: '#7cb94b',
      })
    );
    const m = new THREE.Mesh(geo, foliageMat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    crown.add(m);
  }
  tree.add(crown);
  return tree;
}

/* ============================================================================
 * LEVEL 12 — EDWARDIAN ENGLAND 1900s ("LE VILLAGE ANGLAIS 1900")
 * ========================================================================== */
export class Level12EnglishVillage extends Level1Pyramid {
  static meta = {
    id: 'level12_english_village',
    title: 'Niveau 12 : Angleterre 1900 — Le Village Anglais',
    hudLabel: 'Village Anglais',
    totalGoal: 104,
    tier: 1,
  };

  constructor(options = {}) {
    super(options);
    this.cameraController = options.cameraController || null;
  }

  _beforeBuild() {
    this.tierSpec = TIER_SPEC;
    this.eng = this.textures.ensureEnglishVillagePack();
    this.hudLabel = Level12EnglishVillage.meta.hudLabel;
    this.carvedBlockMat = this.eng.materials.edwardianBrick;

    this.cartWheels = [];
    this.lampGlows = [];
    this.weathervane = null;
    this.victorySparkTimer = 0;

    // Multi-zone tracking (4 Bottom Zone Selector pills, 7 independent vertical sub-structures)
    this.villageZones = [];
    this.zoneById = new Map();
    this.subGroups = [];
    this.subGroupById = new Map();
    this.slotKeyMap = new Map();
    this.activeZoneFilter = 'all'; // 'all' | 'clocktower' | 'cottages' | 'garden_lanes'

    this.zoneHudEl = null;
    this.zoneHudChips = new Map();
    this.quarryHintEl = null;
    this._quarryHintTimer = null;

    this.pyramidSnapRadius = this.upgrades.pyramidion_aura ? 1.42 : 1.16;
    this.pyramidCenter = new THREE.Vector3(GAZEBO_CENTER.x, 0.1, GAZEBO_CENTER.z);

    this.engGeos = {
      unitBox: this._trackGeo(new THREE.BoxGeometry(1, 1, 1)),
      roofPreview: this._trackGeo(
        this.masonryCache.getPitchedRoofGeometry(BLOCK_W, BLOCK_H * 1.18, BLOCK_D, 0, {
          style: 'gable',
          defaultAxis: 'x',
          eaveOverhang: 0.04,
        })
      ),
      spireCap: this._trackGeo(new THREE.ConeGeometry(BLOCK_W * 0.72, BLOCK_H * 2.15, 4)),
      gazeboCap: this._trackGeo(new THREE.ConeGeometry(BLOCK_W * 0.68, BLOCK_H * 1.15, 8)),
      laneBlock: this._trackGeo(new THREE.BoxGeometry(BLOCK_W, LANE_BLOCK_H, BLOCK_D)),
      bridgeBlock: this._trackGeo(new THREE.BoxGeometry(BLOCK_W, BRIDGE_BLOCK_H, BLOCK_D)),
    };
    this.engGeos.spireCap.rotateY(Math.PI * 0.25);

    this.engFxMats = {
      chipStone: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xd9c293, roughness: 0.88 })),
      chipBrick: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xb44c38, roughness: 0.86 })),
      chipSlate: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x48505b, roughness: 0.72 })),
    };
  }

  _getRawBlockMaterial() {
    return this.eng ? this.eng.materials.rawEnglishQuarry : super._getRawBlockMaterial();
  }

  getTerrainHeight(x, z) {
    return sampleEnglishTerrainHeight(x, z);
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
      { minX: -12.0, maxX: -6.8, minZ: 5.2, maxZ: 10.0 },   // English Workshop
      { minX: -6.8, maxX: 1.8, minZ: 5.8, maxZ: 9.4 },      // Track B
      { minX: 1.3, maxX: 5.2, minZ: 6.2, maxZ: 9.0 },       // Staging pad
      { minX: 4.8, maxX: 8.0, minZ: -6.2, maxZ: -3.0 },     // Edwardian Clocktower
      { minX: 0.4, maxX: 3.7, minZ: -5.6, maxZ: -3.2 },     // Cottage North-West
      { minX: 0.8, maxX: 4.1, minZ: -0.8, maxZ: 1.6 },      // Cottage West
      { minX: 5.2, maxX: 7.6, minZ: 3.3, maxZ: 6.4 },       // Cottage South
      { minX: 9.4, maxX: 12.6, minZ: 0.2, maxZ: 2.6 },      // Pub "The Crown"
      { minX: 5.0, maxX: 7.8, minZ: -0.4, maxZ: 2.4 },      // Village Bandstand Gazebo
    ];
  }

  getCameraPreset() {
    return {
      target: new THREE.Vector3(2.2, 0.4, 0.8),
      elevationDeg: 52,
      azimuth: 0.08,
      minDistance: 10.5,
      maxDistance: 68.0,
      panBounds: { minX: -14.2, maxX: 14.2, minZ: -13.5, maxZ: 13.5 },
      distanceScale: 1.44,
    };
  }

  /* ============================================================================
   * 1. SCULPTED 160x160 1900s ENGLISH COUNTRYSIDE TERRAIN, BROOK & GARDENS
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
      const y = sampleEnglishTerrainHeight(x, z);
      pos.setY(i, y);

      const { w0, w1, w2, w3, wetness } = sampleEnglishBiomeWeights(x, z, y);
      splatAttr[i * 4 + 0] = w0;
      splatAttr[i * 4 + 1] = w1;
      splatAttr[i * 4 + 2] = w2;
      splatAttr[i * 4 + 3] = w3;
      wetAttr[i] = wetness;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splatAttr, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetAttr, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.eng.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    terrainMesh.raycast = () => {};
    this.root.add(terrainMesh);

    const skirtGeo = this._trackGeo(new THREE.BoxGeometry(TERRAIN_W, 1.8, TERRAIN_D));
    const skirt = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirt.position.set(0, -1.04, 0);
    skirt.raycast = () => {};
    this.root.add(skirt);
    this.plinthMesh = skirt;

    // Meandering Turquoise Countryside Brook in the North-East
    const brookGeo = this._trackGeo(new THREE.PlaneGeometry(11.4, 15.2, 8, 8));
    brookGeo.rotateX(-Math.PI / 2);
    this.brookWaterMesh = new THREE.Mesh(brookGeo, this.eng.materials.brookWater);
    this.brookWaterMesh.position.set(11.6, BROOK_WATER_Y, -8.4);
    this.brookWaterMesh.receiveShadow = true;
    this.brookWaterMesh.raycast = () => {};
    this.root.add(this.brookWaterMesh);

    // Manicured Boxwood Hedges, Victorian Gas Streetlamps & English Oaks
    this._buildEnglishCountrysideProps();
  }

  _buildEnglishCountrysideProps() {
    const em = this.eng.materials;
    const foliageMat = this._trackMat(createMatteFoliageMaterial());
    const shadowEntries = [];
    const focalPoints = [];

    // Stylized Broadleaf English Oaks framing the rolling Cotswold hills & brook
    const oakCoords = [
      [-14.5, -13.0],
      [-9.8, -13.8],
      [-4.8, -13.0],
      [0.6, -13.4],
      [5.4, -12.8],
      [-15.0, -6.4],
      [-14.8, 0.2],
      [-14.4, 6.2],
      [-13.8, 12.6],
      [-8.0, 13.4],
      [-1.8, 13.0],
      [4.2, 12.8],
      [10.2, 12.2],
      [14.6, 8.8],
      [15.0, 3.2],
      [14.6, -0.4],
      [13.4, -11.4],
      [-3.6, -9.2],
    ];
    oakCoords.forEach(([tx, tz], idx) => {
      const ty = sampleEnglishTerrainHeight(tx, tz);
      const oak = createEnglishOakTree(
        tx,
        tz,
        ty,
        em.darkOak,
        foliageMat,
        (g) => this._trackGeo(g),
        idx + 12
      );
      this.root.add(oak);
      shadowEntries.push({ x: tx, z: tz, radius: 1.4, opacity: 0.42 });
      focalPoints.push({ x: tx, z: tz, radius: 2.6, weight: 0.85 });
    });

    // Trimmed Boxwood Hedges & Victorian Flowerbeds ringing the Village Green Plaza
    const gx = GAZEBO_CENTER.x;
    const gz = GAZEBO_CENTER.z;
    const flowerMats = [em.flowerRose, em.flowerLavender, em.flowerMarigold];
    [
      [gx - 2.05, gz - 1.95],
      [gx + 2.05, gz - 1.95],
      [gx - 2.05, gz + 1.95],
      [gx + 2.05, gz + 1.95],
    ].forEach(([hx, hz], idx) => {
      const hy = sampleEnglishTerrainHeight(hx, hz);
      const hedge = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.86, 0.36, 0.86)),
        em.boxwoodHedge
      );
      hedge.position.set(hx, hy + 0.18, hz);
      hedge.castShadow = true;
      hedge.receiveShadow = true;
      this.root.add(hedge);

      // Colorful cottage-garden blossoms perched atop each flowerbed corner
      for (let f = 0; f < 4; f++) {
        const a = (f / 4) * Math.PI * 2 + idx * 0.6;
        const fl = new THREE.Mesh(
          this._trackGeo(new THREE.DodecahedronGeometry(0.11, 0)),
          flowerMats[(idx + f) % flowerMats.length]
        );
        fl.position.set(hx + Math.cos(a) * 0.24, hy + 0.39, hz + Math.sin(a) * 0.24);
        this.root.add(fl);
      }
    });

    // Ornate 1900s Cast-Iron Victorian Gas Streetlamps flanking the Village Green & Clocktower
    [
      [4.55, -2.55],
      [8.25, -2.55],
      [4.55, 3.05],
      [8.65, 2.75],
    ].forEach(([lx, lz], idx) => {
      const ly = sampleEnglishTerrainHeight(lx, lz);
      const lamp = new THREE.Group();
      lamp.position.set(lx, ly, lz);

      const post = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.036, 0.064, 1.75, 7)),
        em.wroughtIron
      );
      post.position.y = 0.88;
      post.castShadow = true;
      lamp.add(post);

      const globe = new THREE.Mesh(
        this._trackGeo(new THREE.OctahedronGeometry(0.13, 0)),
        em.warmWindowGlow
      );
      globe.position.y = 1.82;
      lamp.add(globe);
      this.lampGlows.push({ mesh: globe, phase: idx * 1.4 });

      const cap = new THREE.Mesh(
        this._trackGeo(new THREE.ConeGeometry(0.16, 0.14, 6)),
        em.wroughtIron
      );
      cap.position.y = 1.96;
      lamp.add(cap);

      this.root.add(lamp);
    });

    this.contactShadows = createContactShadowSystem(
      this.root,
      shadowEntries,
      (x, z) => sampleEnglishTerrainHeight(x, z)
    );

    // Instanced English meadow clover, buttercups & gravel pebbles outside functional zones
    this.cozyFoliageSystem = createCozyGroundFoliageSystem({
      parent: this.root,
      getTerrainHeight: (x, z) => sampleEnglishTerrainHeight(x, z),
      isBlocked: (x, z) => {
        if (x > -0.6 && x < 13.8 && z > -7.2 && z < 8.8) return true;
        if (x > -12.8 && x < -6.2 && z > -9.6 && z < 10.2) return true;
        if (x > -7.2 && x < 5.4 && z > 5.2 && z < 9.8) return true;
        if (distToEnglishBrook(x, z) < 2.2) return true;
        return false;
      },
      getGrassWeight: (x, z) => {
        const y = sampleEnglishTerrainHeight(x, z);
        if (y < BROOK_WATER_Y + 0.24) return 0;
        return 0.88;
      },
      focalPoints,
      waterLevel: BROOK_WATER_Y + 0.12,
      halfW: TERRAIN_W * 0.47,
      halfD: TERRAIN_D * 0.47,
      grassCount: 680,
      pebbleCount: 80,
      flowerCount: 84,
      grassPalette: ['#447f38', '#569442', '#6ca84c', '#82b656'],
      flowerPalette: ['#f7f3dc', '#f5ce4c', '#e6788e', '#a482d8'],
      seed: 1212,
    });
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE PIERRE & BRIQUETERIE (NW, STRICT SLOT OCCUPANCY)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarry = new THREE.Group();
    const em = this.eng.materials;
    this.quarryNodes = [];
    this.quarrySlots = [];

    const qx = -10.5;
    const qz = -8.0;

    // Stepped honey-limestone & red-brick clay quarry cliff
    [
      [-1.5, 1.0, -1.55, 3.6, 2.4, 2.3],
      [1.25, 0.78, -1.75, 2.9, 1.9, 1.9],
      [-2.35, 0.65, 0.55, 2.0, 1.55, 2.4],
    ].forEach(([ox, oy, oz, w, h, d]) => {
      const cliff = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(w, h, d)),
        em.rawEnglishQuarry
      );
      cliff.position.set(qx + ox, oy, qz + oz);
      cliff.castShadow = true;
      cliff.receiveShadow = true;
      cliff.raycast = () => {};
      quarry.add(cliff);
    });

    // Stacked red-brick kiln pallets beside the Briqueterie
    [
      [-13.0, 0.24, -5.85],
      [-13.0, 0.24, -4.95],
      [-13.0, 0.72, -5.4],
    ].forEach(([bx, by, bz]) => {
      const stack = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.92, 0.46, 0.72)),
        em.edwardianBrick
      );
      stack.position.set(bx, sampleEnglishTerrainHeight(bx, bz) + by, bz);
      stack.castShadow = true;
      stack.receiveShadow = true;
      quarry.add(stack);
    });

    // 3 Extractable Quarry Rock Nodes
    [
      [-1.3, 0.15],
      [0.05, -0.15],
      [1.35, 0.2],
    ].forEach(([ox, oz], idx) => {
      const nx = qx + ox;
      const nz = qz + oz;
      const ny = sampleEnglishTerrainHeight(nx, nz) + 0.36;
      const group = new THREE.Group();
      group.position.set(nx, ny, nz);

      const mesh = new THREE.Mesh(this.geos.rawBlock, em.rawEnglishQuarry);
      mesh.scale.set(1.12, 0.86, 1.04);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const node = {
        id: `english_quarry_${idx}`,
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

    // 6 Explicit Ground Quarry Output Storage Slots (spacious 3x2 grid -> zero stacking!)
    const padCx = -9.4;
    const padCz = -5.35;
    const padY = sampleEnglishTerrainHeight(padCx, padCz);
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.2, 0.14, 2.65)),
      em.cobbleRoadBlock
    );
    pad.position.set(padCx, padY + 0.07, padCz);
    pad.receiveShadow = true;
    pad.raycast = () => {};
    quarry.add(pad);

    [
      [-1.28, -0.66],
      [0.0, -0.66],
      [1.28, -0.66],
      [-1.28, 0.66],
      [0.0, 0.66],
      [1.28, 0.66],
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
      pill.id = 'english-quarry-full-hint';
      pill.style.cssText =
        'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 64px);left:50%;transform:translateX(-50%);' +
        'z-index:35;padding:7px 14px;border-radius:999px;pointer-events:none;' +
        'background:rgba(24,52,36,0.94);border:1.5px solid #e8c25c;color:#fff6dc;' +
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
        material: this.engFxMats ? this.engFxMats.chipStone : this.mats.dustLimestone,
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
   * 3. ZONE 2 — LES CHARIOTS ANGLAIS SUR RAILS (BRITISH GREEN & BRASS TRIM)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    this.sleds = [];
    this.cartWheels = [];
    const leverDist = this.sledCapacity === 4 ? 2.28 : 1.82;

    // Track A: Quarry Storage -> English Workshop along X = -9.4
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

    // Track B: English Workshop -> Village Construction Hub along Z = 7.6
    this._createTrackAndSled({
      id: 'sledB',
      axis: 'x',
      fixedCoord: 7.6,
      startPos: -5.6,
      endPos: 0.55,
      trackStart: -6.45,
      trackEnd: 1.32,
      accepts: ['carved', 'capstone', 'raw'],
      primaryKind: 'carved',
      leverLocalPos: new THREE.Vector3(0, 0.34, leverDist),
    });

    // Dress both carts in heritage British racing-green timber trim, spoked wheels & brass rails
    const em = this.eng.materials;
    const wheelGeo = this._trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12));
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
        const wheel = new THREE.Mesh(wheelGeo, em.britishGreen);
        wheel.position.set(wx, wy, wz);
        if (alongX) wheel.rotation.y = Math.PI * 0.5;
        wheel.castShadow = true;
        sled.group.add(wheel);

        const rim = new THREE.Mesh(
          this._trackGeo(new THREE.TorusGeometry(0.21, 0.024, 6, 12)),
          em.brassTrim
        );
        rim.rotation.y = Math.PI * 0.5;
        wheel.add(rim);

        this.cartWheels.push({
          mesh: wheel,
          sled,
          lastCoord: sled.axis === 'z' ? sled.group.position.z : sled.group.position.x,
        });
      });

      // Dark-green side panels with brass trim strip
      [-1, 1].forEach((side) => {
        const panel = new THREE.Mesh(
          this._trackGeo(
            new THREE.BoxGeometry(alongX ? 2.45 : 0.09, 0.22, alongX ? 0.09 : 2.45)
          ),
          em.britishGreen
        );
        panel.position.set(alongX ? 0 : side * 0.68, 0.34, alongX ? side * 0.68 : 0);
        sled.group.add(panel);

        const brassBar = new THREE.Mesh(
          this._trackGeo(
            new THREE.BoxGeometry(alongX ? 2.5 : 0.11, 0.045, alongX ? 0.11 : 2.5)
          ),
          em.brassTrim
        );
        brassBar.position.set(alongX ? 0 : side * 0.68, 0.46, alongX ? side * 0.68 : 0);
        sled.group.add(brassBar);
      });
    });
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DU MAÎTRE MAÇON & CHARPENTIER (SW, OPEN-TOP!)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const em = this.eng.materials;
    const wx = -9.4;
    const wz = 7.6;
    const wy = sampleEnglishTerrainHeight(wx, wz);

    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.5, 0.16, 3.9)),
      em.cobbleRoadBlock
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.raycast = () => {};
    ws.add(floor);

    // Brick-and-slate English workshop with recessed/open-front cutaway roof (rear ~35%, raycast disabled)
    [-2.0, 2.0].forEach((ox) => {
      const pier = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.28, 2.35, 0.28)),
        em.edwardianBrick
      );
      pier.position.set(wx + ox, wy + 1.24, wz - 1.58);
      pier.castShadow = true;
      pier.raycast = () => {};
      ws.add(pier);
    });
    const backAwning = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.5, 0.18, 1.38)),
      em.welshSlate
    );
    backAwning.position.set(wx, wy + 2.44, wz - 1.28);
    backAwning.rotation.x = 0.24;
    backAwning.raycast = () => {};
    ws.add(backAwning);

    const fascia = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.62, 0.14, 0.14)),
      em.victorianWhite
    );
    fascia.position.set(wx, wy + 2.64, wz - 1.82);
    fascia.raycast = () => {};
    ws.add(fascia);

    // Master Mason & Carpenter Workbench Anvil (100% unobstructed from top-down view)
    const anvilX = wx - 0.55;
    const anvilZ = wz + 0.18;
    const anvilBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.42, 0.72, 1.42)),
      em.cotswoldStone
    );
    anvilBase.position.set(anvilX, wy + 0.52, anvilZ);
    anvilBase.castShadow = true;
    anvilBase.receiveShadow = true;
    ws.add(anvilBase);

    const anvilTrim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.5, 0.08, 1.5)),
      em.brassTrim
    );
    anvilTrim.position.set(anvilX, wy + 0.86, anvilZ);
    ws.add(anvilTrim);

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

    // 6 Village Construction Hub Staging Slots cleanly clear of Track B rail end
    const stageX = 3.25;
    const stageZ = 7.6;
    const stageY = sampleEnglishTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.8, 0.14, 2.35)),
      em.cobbleRoadBlock
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
   * 5. ZONE 4 — CHANTIER DU VILLAGE ANGLAIS 1900 (104 BLOCKS ACROSS 4 ZONES)
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidSlots = [];
    this.villageZones = [];
    this.zoneById.clear();
    this.subGroups = [];
    this.subGroupById.clear();
    this.slotKeyMap.clear();

    const site = new THREE.Group();
    site.name = 'EnglishVillageSite';
    this.root.add(site);
    this.villageSite = site;

    // 4 Bottom Zone Selector groups ("Tout" + 3 focused 1900s English village clusters)
    const zoneDefs = [
      {
        id: 'clocktower',
        label: "Tour de l'Horloge",
        icon: '🕰️',
        focus: new THREE.Vector3(CLOCK_CENTER.x, 1.4, CLOCK_CENTER.z),
        distance: 16.5,
      },
      {
        id: 'cottages',
        label: '3 Cottages & Pub',
        icon: '🏘️',
        focus: new THREE.Vector3(5.6, 0.45, 0.6),
        distance: 21.5,
      },
      {
        id: 'garden_lanes',
        label: 'Jardin & Chemins',
        icon: '🌳',
        focus: new THREE.Vector3(7.6, 0.4, -1.2),
        distance: 19.5,
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
          h === BLOCK_H && w === BLOCK_W
            ? this.geos.ghostBox
            : this._trackGeo(new THREE.BoxGeometry(w * 0.96, h * 0.96, d * 0.96));
        const gEdges =
          h === BLOCK_H && w === BLOCK_W
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
          isPub: Boolean(sp.isPub),
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
     * STRUCTURE A — LA TOUR DE L'HORLOGE ÉDOUARDIENNE (26 blocks EXACT!)
     *   Layer 0: 9 honey-limestone plinth & arched base (3x3)
     *   Layer 1: 4 red-brick lower shaft (2x2)
     *   Layer 2: 4 red-brick & honey-stone mid shaft (2x2)
     *   Layer 3: 4 glowing brass-and-white clockface belfry blocks (2x2)
     *   Layer 4: 4 welded steep Welsh-slate spire base blocks (2x2)
     *   Layer 5: 1 pointed Welsh-slate spire peak + golden weathervane
     * ---------------------------------------------------------------------- */
    const clockBaseY = sampleEnglishTerrainHeight(CLOCK_CENTER.x, CLOCK_CENTER.z) + 0.05;
    const clockPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 3.4, 0.1, BLOCK_D * 3.4)),
      this.eng.materials.cotswoldStone
    );
    clockPad.position.set(CLOCK_CENTER.x, clockBaseY - 0.02, CLOCK_CENTER.z);
    clockPad.receiveShadow = true;
    clockPad.raycast = () => {};
    site.add(clockPad);

    const clockSpecs = [];
    // Layer 0 (9 blocks): 3x3 Cotswold honey-limestone plinth
    for (let gx = 0; gx < 3; gx++) {
      for (let gz = 0; gz < 3; gz++) {
        clockSpecs.push({
          gx,
          gz,
          layer: 0,
          x: CLOCK_CENTER.x + (gx - 1) * GRID_STEP,
          y: clockBaseY + BLOCK_H * 0.5,
          z: CLOCK_CENTER.z + (gz - 1) * GRID_STEP,
          pieceType: 'clock_base',
        });
      }
    }
    // Layers 1..4 (4 blocks each): 2x2 centered tower shaft -> dials -> slate spire base
    const layerPieces = [null, 'clock_shaft', 'clock_shaft', 'clock_dial', 'clock_spire'];
    for (let ly = 1; ly <= 4; ly++) {
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          clockSpecs.push({
            gx,
            gz,
            layer: ly,
            x: CLOCK_CENTER.x + (gx - 0.5) * GRID_STEP,
            y: clockBaseY + BLOCK_H * (ly + 0.5),
            z: CLOCK_CENTER.z + (gz - 0.5) * GRID_STEP,
            pieceType: layerPieces[ly],
            roofAxis: 'x',
          });
        }
      }
    }
    // Layer 5 (1 block): Steep pointed Welsh-slate spire cap + golden weathervane
    clockSpecs.push({
      gx: 0,
      gz: 0,
      layer: 5,
      x: CLOCK_CENTER.x,
      y: clockBaseY + BLOCK_H * 5.65,
      z: CLOCK_CENTER.z,
      pieceType: 'clock_cap',
    });

    const clockSub = registerSubGroup('clocktower', 'clocktower', clockSpecs);
    this._buildClocktowerCompletionDecor(clockSub.completionGroup, clockBaseY);

    /* ------------------------------------------------------------------------
     * STRUCTURE B — LES 3 COTTAGES ANGLAIS & LE PUB "THE CROWN" (4 × 14 = 56!)
     * Each: 5 brick/stone base + bay entrance -> 4 half-timber walls -> 5 Welsh slate roofs
     * ---------------------------------------------------------------------- */
    const cottageConfigs = [
      {
        id: 'cottage_north',
        cx: 1.6,
        cz: -4.4,
        porchCell: [2, 1], // Facing East toward Clocktower
        roofAxis: 'z',
        variant: 0,
        isPub: false,
      },
      {
        id: 'cottage_west',
        cx: 2.0,
        cz: 0.4,
        porchCell: [2, 1], // Facing East toward Gazebo Square
        roofAxis: 'z',
        variant: 1,
        isPub: false,
      },
      {
        id: 'cottage_south',
        cx: 6.4,
        cz: 5.2,
        porchCell: [0, -1], // Facing North toward Gazebo Square
        roofAxis: 'x',
        variant: 2,
        isPub: false,
      },
      {
        id: 'pub_crown',
        cx: 11.4,
        cz: 1.4,
        porchCell: [-1, 0], // Corner Pub "The Crown" facing West toward Gazebo Square
        roofAxis: 'z',
        variant: 3,
        isPub: true,
      },
    ];

    cottageConfigs.forEach((cc) => {
      const baseY = sampleEnglishTerrainHeight(cc.cx, cc.cz) + 0.03;
      const cPad = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 2.45, 0.08, BLOCK_D * 2.45)),
        this.eng.materials.cobbleRoadBlock
      );
      cPad.position.set(cc.cx, baseY - 0.01, cc.cz);
      cPad.receiveShadow = true;
      cPad.raycast = () => {};
      site.add(cPad);

      const specs = [];
      const [pgx, pgz] = cc.porchCell;

      // Layer 0 (5 blocks): 2x2 brick/limestone ground floor + 1 bay-window porch
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          specs.push({
            gx,
            gz,
            layer: 0,
            x: cc.cx + (gx - 0.5) * GRID_STEP,
            y: baseY + BLOCK_H * 0.5,
            z: cc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'cottage_base',
            houseVariant: cc.variant,
            isPub: cc.isPub,
          });
        }
      }
      specs.push({
        gx: pgx,
        gz: pgz,
        layer: 0,
        x: cc.cx + (pgx - 0.5) * GRID_STEP,
        y: baseY + BLOCK_H * 0.5,
        z: cc.cz + (pgz - 0.5) * GRID_STEP,
        pieceType: 'cottage_bay',
        houseVariant: cc.variant,
        isPub: cc.isPub,
      });

      // Layer 1 (4 blocks): 2x2 black-and-white half-timbered (`colombages`) upper walls
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          specs.push({
            gx,
            gz,
            layer: 1,
            x: cc.cx + (gx - 0.5) * GRID_STEP,
            y: baseY + BLOCK_H * 1.5,
            z: cc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'cottage_timber',
            houseVariant: cc.variant,
            isPub: cc.isPub,
          });
        }
      }

      // Layer 2 (5 blocks): 2x2 + 1 bay-porch welded steep pitched Welsh slate roofs
      for (let gx = 0; gx < 2; gx++) {
        for (let gz = 0; gz < 2; gz++) {
          specs.push({
            gx,
            gz,
            layer: 2,
            x: cc.cx + (gx - 0.5) * GRID_STEP,
            y: baseY + BLOCK_H * 2.5,
            z: cc.cz + (gz - 0.5) * GRID_STEP,
            pieceType: 'cottage_roof',
            roofAxis: cc.roofAxis,
            houseVariant: cc.variant,
            isPub: cc.isPub,
          });
        }
      }
      specs.push({
        gx: pgx,
        gz: pgz,
        layer: 2,
        x: cc.cx + (pgx - 0.5) * GRID_STEP,
        y: baseY + BLOCK_H * 2.5,
        z: cc.cz + (pgz - 0.5) * GRID_STEP,
        pieceType: 'cottage_roof',
        roofAxis: cc.roofAxis,
        houseVariant: cc.variant,
        isPub: cc.isPub,
      });

      const sub = registerSubGroup(cc.id, 'cottages', specs);
      this._buildCottageCompletionDecor(sub.completionGroup, cc, baseY);
    });

    /* ------------------------------------------------------------------------
     * STRUCTURE C — LE SQUARE DU VILLAGE & KIOSQUE À MUSIQUE (10 blocks EXACT!)
     * Octagonal-cross Victorian white-and-green bandstand on the village green:
     *   Layer 0: 5 white-trimmed limestone podium blocks (center + 4 cardinals)
     *   Layer 1: 5 Welsh-slate Victorian cupola & columned gazebo roof blocks
     * ---------------------------------------------------------------------- */
    const gazBaseY = sampleEnglishTerrainHeight(GAZEBO_CENTER.x, GAZEBO_CENTER.z) + 0.03;
    const gazApron = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(2.12, 2.18, 0.08, 8)),
      this.eng.materials.cobbleRoadBlock
    );
    gazApron.position.set(GAZEBO_CENTER.x, gazBaseY - 0.01, GAZEBO_CENTER.z);
    gazApron.receiveShadow = true;
    gazApron.raycast = () => {};
    site.add(gazApron);

    const gazCross = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const gazSpecs = [];
    gazCross.forEach(([gx, gz]) => {
      gazSpecs.push({
        gx,
        gz,
        layer: 0,
        x: GAZEBO_CENTER.x + gx * GRID_STEP,
        y: gazBaseY + BLOCK_H * 0.5,
        z: GAZEBO_CENTER.z + gz * GRID_STEP,
        pieceType: 'gazebo_base',
      });
    });
    gazCross.forEach(([gx, gz]) => {
      gazSpecs.push({
        gx,
        gz,
        layer: 1,
        x: GAZEBO_CENTER.x + gx * GRID_STEP,
        y: gazBaseY + BLOCK_H * 1.5,
        z: GAZEBO_CENTER.z + gz * GRID_STEP,
        pieceType: gx === 0 && gz === 0 ? 'gazebo_cupola' : 'gazebo_roof',
        roofAxis: gx !== 0 ? 'x' : 'z',
      });
    });
    const gazSub = registerSubGroup('gazebo', 'garden_lanes', gazSpecs);
    this._buildGazeboCompletionDecor(gazSub.completionGroup, gazBaseY);

    /* ------------------------------------------------------------------------
     * STRUCTURE D — RUES PAVÉES & PONT DE PIERRE SUR LE RUISSEAU (12 blocks!)
     * 9 cobblestone village lanes + 3 arched Cotswold-stone brook footbridge blocks
     * ---------------------------------------------------------------------- */
    const laneCoords = [
      // North High Street: Gazebo Plaza -> Edwardian Clocktower (2)
      [6.4, -1.45, 0, -2],
      [6.4, -2.41, 0, -3],
      // South Lane: Gazebo Plaza -> South Cottage (2)
      [5.92, 2.68, -1, 2],
      [5.92, 3.64, -1, 3],
      // West Lane: Gazebo Plaza -> West Cottage (1)
      [4.56, 0.88, -2, 0],
      // East Lane: Gazebo Plaza -> Pub "The Crown" (2)
      [8.25, 1.0, 2, 0],
      [9.21, 1.0, 3, 0],
      // North-West Lane: Clocktower -> Cottage North-West (2)
      [4.56, -4.4, -2, -5],
      [3.6, -4.4, -3, -5],
    ];
    const laneSpecs = laneCoords.map(([lx, lz, gx, gz]) => {
      const ly = sampleEnglishTerrainHeight(lx, lz) + 0.02;
      return {
        gx,
        gz,
        layer: 0,
        x: lx,
        y: ly + LANE_BLOCK_H * 0.5,
        z: lz,
        blockW: BLOCK_W,
        blockH: LANE_BLOCK_H,
        blockD: BLOCK_D,
        pieceType: 'lane_cobble',
      };
    });

    // 3 Arched Cotswold-stone Footbridge blocks spanning the NE turquoise countryside brook!
    const bridgeCells = [
      [9.55, -5.55, 6, -6, 0.04],
      [10.45, -6.1, 7, -6, 0.24], // Raised central bridge keystone arch
      [11.35, -6.65, 8, -6, 0.04],
    ];
    bridgeCells.forEach(([bx, bz, gx, gz, archY]) => {
      laneSpecs.push({
        gx,
        gz,
        layer: 0,
        x: bx,
        y: archY + BRIDGE_BLOCK_H * 0.5,
        z: bz,
        blockW: BLOCK_W * 1.08,
        blockH: BRIDGE_BLOCK_H,
        blockD: BLOCK_D * 1.15,
        pieceType: 'bridge_stone',
      });
    });

    const lanesSub = registerSubGroup('lanes', 'garden_lanes', laneSpecs);
    this._buildBridgeParapets(lanesSub.completionGroup);

    this.totalGoal = this.pyramidSlots.length; // Exactly 104 blocks!
    this.maxLayerIndex = 5;

    this._syncZoneGhostVisibility();
    this._mountZoneSelectorHud();
  }

  /**
   * Crowns the Edwardian Clocktower with ornate brass cornices, 4 arched base keystones,
   * and a rotating golden Victorian weathervane atop the Welsh-slate spire.
   */
  _buildClocktowerCompletionDecor(group, baseY) {
    const em = this.eng.materials;

    // Brass balcony cornice below clockfaces & eaves trim above
    [BLOCK_H * 3.02, BLOCK_H * 4.02].forEach((cy) => {
      const cornice = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 2.24, 0.1, BLOCK_D * 2.24)),
        em.cotswoldStone
      );
      cornice.position.set(CLOCK_CENTER.x, baseY + cy, CLOCK_CENTER.z);
      cornice.castShadow = true;
      group.add(cornice);
    });

    // Golden Edwardian finial spire & rotating weathervane arrow at tower apex
    const spireTopY = baseY + BLOCK_H * 5.65 + BLOCK_H * 1.08;
    const pole = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.025, 0.04, 0.88, 7)),
      em.brassTrim
    );
    pole.position.set(CLOCK_CENTER.x, spireTopY + 0.36, CLOCK_CENTER.z);
    group.add(pole);

    const orb = new THREE.Mesh(
      this._trackGeo(new THREE.SphereGeometry(0.085, 10, 8)),
      em.brassTrim
    );
    orb.position.set(CLOCK_CENTER.x, spireTopY + 0.52, CLOCK_CENTER.z);
    group.add(orb);

    const vane = new THREE.Group();
    vane.position.set(CLOCK_CENTER.x, spireTopY + 0.78, CLOCK_CENTER.z);
    const arrowBar = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.68, 0.05, 0.04)),
      em.brassTrim
    );
    vane.add(arrowBar);
    const arrowTip = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.075, 0.18, 4)),
      em.brassTrim
    );
    arrowTip.rotation.z = -Math.PI * 0.5;
    arrowTip.position.x = 0.38;
    vane.add(arrowTip);
    group.add(vane);
    this.weathervane = vane;
  }

  /**
   * Builds flush slate ridge beams, tall Edwardian red-brick chimneys with clay chimney pots,
   * white bay-window lintels, and the golden hanging "The Crown" pub sign.
   */
  _buildCottageCompletionDecor(group, cc, baseY) {
    const em = this.eng.materials;
    const ridgeY = baseY + BLOCK_H * 2.5 + BLOCK_H * 1.18 * 0.5 - 0.04;

    const ridge = new THREE.Mesh(
      this._trackGeo(
        new THREE.BoxGeometry(
          cc.roofAxis === 'x' ? BLOCK_W * 2.12 : 0.14,
          0.14,
          cc.roofAxis === 'z' ? BLOCK_D * 2.12 : 0.14
        )
      ),
      em.welshSlate
    );
    ridge.position.set(cc.cx, ridgeY, cc.cz);
    group.add(ridge);

    // Tall Edwardian red-brick chimney stack with twin terracotta chimney pots
    const chimPositions = cc.isPub
      ? [
          [cc.cx + 0.45, cc.cz - 0.42],
          [cc.cx + 0.45, cc.cz + 0.42],
        ]
      : [[cc.cx + 0.38, cc.cz - 0.32]];

    chimPositions.forEach(([chx, chz]) => {
      const stack = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.36, 0.76, 0.36)),
        em.edwardianBrick
      );
      stack.position.set(chx, ridgeY + 0.1, chz);
      stack.castShadow = true;
      group.add(stack);

      [-0.08, 0.08].forEach((po) => {
        const pot = new THREE.Mesh(
          this._trackGeo(new THREE.CylinderGeometry(0.055, 0.068, 0.22, 7)),
          em.clayPot
        );
        pot.position.set(chx + po, ridgeY + 0.55, chz);
        group.add(pot);
      });
    });

    // Hanging golden crown tavern sign & warm lantern outside Pub "The Crown"
    if (cc.isPub) {
      const signPost = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.042, 0.052, 1.55, 7)),
        em.wroughtIron
      );
      signPost.position.set(cc.cx - BLOCK_W * 1.65, baseY + 0.78, cc.cz + 0.45);
      signPost.castShadow = true;
      group.add(signPost);

      const bracket = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.55, 0.05, 0.05)),
        em.wroughtIron
      );
      bracket.position.set(cc.cx - BLOCK_W * 1.9, baseY + 1.48, cc.cz + 0.45);
      group.add(bracket);

      const signBoard = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.42, 0.34, 0.07)),
        em.britishGreen
      );
      signBoard.position.set(cc.cx - BLOCK_W * 1.92, baseY + 1.24, cc.cz + 0.45);
      group.add(signBoard);

      const crownEmblem = new THREE.Mesh(
        this._trackGeo(new THREE.OctahedronGeometry(0.095, 0)),
        em.brassTrim
      );
      crownEmblem.position.set(cc.cx - BLOCK_W * 1.92, baseY + 1.24, cc.cz + 0.45);
      group.add(crownEmblem);
    }
  }

  /**
   * Builds Victorian white lattice railings, British-green iron columns & golden cupola finial
   * for the Village Square Bandstand Gazebo.
   */
  _buildGazeboCompletionDecor(group, baseY) {
    const em = this.eng.materials;
    const gx = GAZEBO_CENTER.x;
    const gz = GAZEBO_CENTER.z;

    // 8 slender white-and-green Victorian bandstand columns around the octagonal rim
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const col = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.045, 0.052, BLOCK_H * 1.12, 7)),
        i % 2 === 0 ? em.victorianWhite : em.britishGreen
      );
      col.position.set(gx + Math.cos(a) * 1.12, baseY + BLOCK_H * 1.15, gz + Math.sin(a) * 1.12);
      col.castShadow = true;
      group.add(col);
    }

    // Golden finial atop central bandstand cupola
    const fin = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.09, 0.36, 6)),
      em.brassTrim
    );
    fin.position.set(gx, baseY + BLOCK_H * 2.55, gz);
    group.add(fin);
  }

  /**
   * Adds charming low Cotswold-stone arched bridge parapets flanking the 3 brook bridge blocks.
   */
  _buildBridgeParapets(group) {
    const em = this.eng.materials;
    const bridgeCenter = new THREE.Vector3(10.45, 0.42, -6.1);
    const angle = Math.atan2(-1.1, 1.8); // Bridge heading across the brook

    const holder = new THREE.Group();
    holder.position.copy(bridgeCenter);
    holder.rotation.y = -angle;

    [-0.58, 0.58].forEach((sideZ) => {
      const wall = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(2.95, 0.32, 0.16)),
        em.cotswoldStone
      );
      wall.position.set(0, 0.08, sideZ);
      wall.castShadow = true;
      wall.receiveShadow = true;
      holder.add(wall);
    });
    group.add(holder);
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
        this.cameraController.desiredTarget.set(5.8, 0.45, 0.6);
        this.cameraController.desiredDistance = 25.0;
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

    if (pool.some((s) => s.pieceType === 'clock_dial')) return 'clock_dial';
    if (
      pool.some(
        (s) =>
          s.pieceType === 'cottage_roof' ||
          s.pieceType === 'clock_spire' ||
          s.pieceType === 'clock_cap' ||
          s.pieceType === 'gazebo_roof' ||
          s.pieceType === 'gazebo_cupola'
      )
    ) {
      return 'cottage_roof';
    }
    if (pool.some((s) => s.pieceType === 'cottage_timber')) return 'cottage_timber';
    if (pool.some((s) => s.pieceType === 'cottage_base' || s.pieceType === 'clock_shaft')) {
      return 'cottage_base';
    }
    if (pool.some((s) => s.pieceType === 'lane_cobble')) return 'lane_cobble';
    return 'clock_base';
  }

  _resolveCarvingTargetMaterial() {
    const pieceType = this._pickNextCarvedPieceType();
    const em = this.eng.materials;
    if (pieceType === 'clock_dial') return em.clockFace;
    if (pieceType === 'cottage_roof') return em.welshSlate;
    if (pieceType === 'cottage_timber') return em.halfTimber;
    if (pieceType === 'cottage_base') return em.edwardianBrick;
    if (pieceType === 'lane_cobble') return em.cobbleRoadBlock;
    return em.cotswoldStone || this.carvedBlockMat;
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyEnglishPieceVisual(block, pieceType, null, false);
    }
    return stillRaw;
  }

  _clearCustomAttach(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  _applyEnglishPieceVisual(block, pieceType, slot = null, isPlaced = false) {
    const em = this.eng.materials;
    block.pieceType = pieceType;
    this._clearCustomAttach(block);

    if (pieceType === 'clock_cap') {
      block.mesh.geometry = this.engGeos.spireCap;
      block.mesh.material = em.welshSlate;
      return;
    }

    if (pieceType === 'gazebo_cupola') {
      block.mesh.geometry = this.engGeos.gazeboCap;
      block.mesh.material = em.welshSlate;
      return;
    }

    if (
      pieceType === 'cottage_roof' ||
      pieceType === 'clock_spire' ||
      pieceType === 'gazebo_roof'
    ) {
      block.mesh.geometry = this.engGeos.roofPreview;
      block.mesh.material = em.welshSlate;
      return;
    }

    if (pieceType === 'clock_dial') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = em.clockFace;
      return;
    }

    if (pieceType === 'cottage_timber') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = em.halfTimber;
      return;
    }

    if (pieceType === 'cottage_bay') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = slot && slot.isPub ? em.britishGreen : em.edwardianBrick;
      if (isPlaced) {
        this._attachBayWindowPanes(block, slot);
      }
      return;
    }

    if (pieceType === 'cottage_base' || pieceType === 'clock_shaft') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material =
        slot && slot.houseVariant === 1 ? em.cotswoldStone : em.edwardianBrick;
      return;
    }

    if (pieceType === 'gazebo_base') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = em.victorianWhite;
      return;
    }

    if (pieceType === 'lane_cobble') {
      block.mesh.geometry = this.engGeos.laneBlock;
      block.mesh.material = em.cobbleRoadBlock;
      return;
    }

    if (pieceType === 'bridge_stone') {
      block.mesh.geometry = this.engGeos.bridgeBlock;
      block.mesh.material = em.cotswoldStone;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = em.cotswoldStone;
  }

  /**
   * Adds warm illuminated Edwardian multi-pane bay windows & white mullions to cottage & pub bays.
   */
  _attachBayWindowPanes(block, slot) {
    const em = this.eng.materials;
    const g = new THREE.Group();
    const isPub = Boolean(slot && slot.isPub);

    [
      [0, 0, BLOCK_D * 0.5 + 0.014, 0],
      [0, 0, -(BLOCK_D * 0.5 + 0.014), Math.PI],
      [BLOCK_W * 0.5 + 0.014, 0, 0, Math.PI * 0.5],
      [-(BLOCK_W * 0.5 + 0.014), 0, 0, -Math.PI * 0.5],
    ].forEach(([px, py, pz, ry]) => {
      const frame = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.54, 0.36, 0.03)),
        isPub ? em.brassTrim : em.victorianWhite
      );
      frame.position.set(px, py + 0.04, pz);
      frame.rotation.y = ry;
      g.add(frame);

      const pane = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.44, 0.26, 0.04)),
        em.warmWindowGlow
      );
      pane.position.set(px, py + 0.04, pz);
      pane.rotation.y = ry;
      g.add(pane);
    });

    block.mesh.add(g);
    block.customAttach = g;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyEnglishPieceVisual(block, slot.pieceType, slot, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const chipMat =
      slot.pieceType.includes('roof') || slot.pieceType.includes('spire')
        ? this.engFxMats.chipSlate
        : slot.pieceType.includes('base') || slot.pieceType === 'clock_shaft'
          ? this.engFxMats.chipBrick
          : this.engFxMats.chipStone;

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
      slot.pieceType === 'clock_base' ||
      slot.pieceType === 'clock_shaft' ||
      slot.pieceType === 'clock_dial' ||
      slot.pieceType === 'cottage_base' ||
      slot.pieceType === 'cottage_bay' ||
      slot.pieceType === 'cottage_timber' ||
      slot.pieceType === 'gazebo_base' ||
      slot.pieceType === 'lane_cobble' ||
      slot.pieceType === 'bridge_stone'
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
      slot.pieceType === 'lane_cobble' ? 0.022 : 0.036
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
        (slot.pieceType === 'cottage_roof' ||
          slot.pieceType === 'clock_spire' ||
          slot.pieceType === 'gazebo_roof')
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
   * 7. BOTTOM ZONE SELECTOR BAR ("Tout", "Tour de l'Horloge", "3 Cottages & Pub", "Jardin & Chemins")
   * ========================================================================== */
  _mountZoneSelectorHud() {
    this._unmountZoneSelectorHud();
    if (typeof document === 'undefined') return;
    const rootEl = document.getElementById('game-root') || document.body;

    const bar = document.createElement('div');
    bar.id = 'english-zone-bar';
    bar.className = 'city-district-bar';
    bar.setAttribute('aria-label', 'Zones du Village Anglais 1900');

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
   * 8. GOLDEN SUNBEAM & CLOCK CHIME CELEBRATION (+480 PIÈCES D'OR, +60 ÉCLATS)
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

    const pc = new THREE.Vector3(CLOCK_CENTER.x, 1.4, CLOCK_CENTER.z + 1.5);
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
      this._trackGeo(new THREE.CylinderGeometry(0.75, 3.0, 13.0, 20, 1, true)),
      innerMat
    );
    this.victoryBeamInner.position.y = 5.6;
    this.victoryGroup.add(this.victoryBeamInner);

    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffd268,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(1.3, 4.4, 13.5, 22, 1, true)),
      outerMat
    );
    this.victoryBeamOuter.position.y = 5.8;
    this.victoryGroup.add(this.victoryBeamOuter);

    this.root.add(this.victoryGroup);

    this._spawnParticles(new THREE.Vector3(CLOCK_CENTER.x, 4.2, CLOCK_CENTER.z), {
      count: 32,
      material: this.mats.dustGold,
      speed: 3.8,
      upSpeed: 4.8,
      scale: 0.96,
      life: 1.25,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level12EnglishVillage.meta.id,
        focusPoint: new THREE.Vector3(CLOCK_CENTER.x, 2.2, GAZEBO_CENTER.z - 1.6),
        rewardCoins: 480,
        firstCompletionTokens: 60,
      });
    }
  }

  /* ============================================================================
   * 9. REAL-TIME ANIMATION LOOP (BROOK, WHEELS, GAS LAMPS & WEATHERVANE)
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

    if (this.brookWaterMesh && this.brookWaterMesh.material && this.brookWaterMesh.material.normalMap) {
      this.brookWaterMesh.material.normalMap.offset.x = (elapsed * 0.02) % 1;
      this.brookWaterMesh.material.normalMap.offset.y = (elapsed * 0.016) % 1;
    }

    for (let i = 0; i < this.lampGlows.length; i++) {
      const lg = this.lampGlows[i];
      const s = 0.94 + Math.sin(elapsed * 5.2 + lg.phase) * 0.07;
      lg.mesh.scale.setScalar(s);
    }

    if (this.weathervane) {
      this.weathervane.rotation.y = Math.sin(elapsed * 0.65) * 0.6 + elapsed * 0.18;
    }

    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.update === 'function') {
      this.cozyFoliageSystem.update(elapsed);
    }

    if (this.isComplete) {
      this.victorySparkTimer += dt;
      if (this.victorySparkTimer >= 0.72) {
        this.victorySparkTimer = 0;
        this._spawnParticles(
          new THREE.Vector3(
            CLOCK_CENTER.x + (Math.random() - 0.5) * 5.0,
            3.2 + Math.random() * 1.8,
            GAZEBO_CENTER.z - 1.5 + (Math.random() - 0.5) * 4.5
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
    super.dispose();
  }
}
