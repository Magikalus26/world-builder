/**
 * Workd Builder — Level 6: Industrial Mining Era — "La Mine de Charbon & Chevalement" (50 Blocks)
 * Sculpted 128x128 Northern Coal Basin terrain featuring:
 *  - Conical dark-slate Coal Slag Heap (Terril) in the background, deep excavated anthracite &
 *    shale open-pit quarry in the North-West, cooling water canal/reservoir in the North-East,
 *    and flat compacted industrial yard pads
 *  - Multi-layer crisp PBR splatting (Hardy Northern Meadow Grass, Rusty-Brown Cinder & Steel Rail
 *    Gravel, Crushed Black Coal Dust & Dark Grey Shale, Wet Cooling Canal Rim) + cozy Outlanders
 *    instanced 3D northern grass, flat shale pebbles, discreet wildflowers & soft contact AO shadows
 *  - 4-Station Tactile Logistics Loop:
 *      1) Zone 1 — La Veine de Charbon & Fosse d'Extraction (NW): glossy anthracite coal cliff & 3 nodes
 *      2) Zone 2 — Les Wagonnets sur Rails d'Acier (W & Center): twin riveted-iron minecarts on steel rails
 *      3) Zone 3 — L'Atelier de Taille & Briqueterie (SW): open-front cutaway zinc roof (raycast disabled)
 *      4) Zone 4 — Chantier de la Mine & Chevalement (East — 50 Zero-Gap Connected Blocks across 4 Tiers):
 *           Tier 1 (16): Dalle Béton & Entrée de Galerie Souterraine
 *           Tier 2 (14): Salle des Machines en Briques Rouges (fenêtres cintrées & base cheminée)
 *           Tier 3 (12): Beffroi & Charpente Métallique du Chevalement + cheminée
 *           Tier 4 (8):  Toiture en Zinc & Grandes Poulies (Molettes) Spoked Steel Wheels
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
  buildStylizedFrontierPine,
  createOrganicFoliageBlobGeo,
  createRootedTrunk,
} from '../foliageAndGround.js';

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const MINE_STEP = BLOCK_W; // Exact zero-gap grid step matching outer block width/depth
const MINE_CENTER = new THREE.Vector3(3.6, 0, -0.75);
const FOUNDATION_Y = 0.28;

const TERRAIN_W = 20.5;
const TERRAIN_D = 19.5;
const TERRAIN_SEGS = 128;
const WATER_LEVEL = -0.36;

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

function rectFlatMask(x, z, cx, cz, hw, hd, feather = 1.45) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return 1.0 - smoothstep(0, feather, Math.hypot(dx, dz));
}

/**
 * Unified 128x128 sculpted Coal Mining Basin terrain heightfield:
 *  - Dark-slate conical Terril (coal slag heap) rising in North background
 *  - Excavated black-coal & shale open-pit quarry in North-West
 *  - Cooling water canal/reservoir basin in North-East
 *  - Flat compacted industrial yard pads for workshop, tracks, staging, and mine shaft site
 */
function sampleCoalMineTerrainHeight(x, z) {
  let h =
    Math.sin(x * 0.22 + 0.7) * Math.cos(z * 0.24 - 0.4) * 0.16 +
    Math.sin(x * 0.44 - z * 0.36) * 0.07;

  // Iconic conical-ridged dark-slate Terril (Coal Slag Heap) in the Northern background
  const terrilDist1 = Math.hypot((x + 0.4) * 0.72, (z + 8.65) * 1.12);
  const terrilDist2 = Math.hypot((x + 3.1) * 0.85, (z + 8.4) * 1.15);
  h += (1.0 - smoothstep(0.0, 3.8, terrilDist1)) * 2.55;
  h += (1.0 - smoothstep(0.0, 3.1, terrilDist2)) * 1.65;

  // Northern outer ridge behind quarry & east flank
  const northRidge = smoothstep(-5.2, -9.2, z) * 0.88;
  const westRidge = smoothstep(-6.8, -9.8, x) * 0.62;
  const eastRidge = smoothstep(7.2, 9.9, x) * 0.56;
  const southLip = smoothstep(7.2, 9.5, z) * 0.28;
  h += northRidge + westRidge + eastRidge + southLip;

  // Deep excavated open-pit coal & shale quarry basin in NW
  const pitDist = Math.hypot((x + 5.1) * 0.86, (z + 4.95) * 1.08);
  h -= (1.0 - smoothstep(1.3, 3.1, pitDist)) * 0.42;

  // Sunken industrial Cooling Water Canal / Reservoir in North-East
  const canalDist = Math.hypot((x - 7.55) * 0.86, (z + 5.85) * 0.92);
  const canalBasin = 1.0 - smoothstep(1.35, 3.05, canalDist);
  h = h * (1.0 - canalBasin) + -0.78 * canalBasin;

  // Compacted flat industrial work pads (Quarry output, Tracks A/B, Workshop, Staging, Mine Site)
  const flatMask = clamp01(
    Math.max(
      rectFlatMask(x, z, -4.6, -3.25, 2.5, 1.35, 1.35), // Quarry output pad
      rectFlatMask(x, z, -4.6, 4.35, 2.4, 2.0, 1.4), // Brick & Iron Workshop pad
      rectFlatMask(x, z, 3.6, 4.45, 2.15, 1.45, 1.35), // Staging pad
      rectFlatMask(x, z, MINE_CENTER.x, MINE_CENTER.z, 3.35, 3.35, 1.45), // Mine Shaft site
      rectFlatMask(x, z, -4.55, 0.3, 1.35, 3.55, 1.25), // Track A corridor
      rectFlatMask(x, z, 0.4, 4.65, 3.35, 1.35, 1.25) // Track B corridor
    )
  );
  h *= 1.0 - flatMask * 0.96;

  // Gentle beveled island rim
  const rimT = Math.max(smoothstep(9.5, 10.2, Math.abs(x)), smoothstep(8.9, 9.6, Math.abs(z)));
  h -= rimT * 0.24;
  return h;
}

/**
 * 4-Biome Coal Mining Terrain Splat Weights:
 *   w0 = Hardy Northern Meadow Grass & Pine Edge (outer perimeter)
 *   w1 = Compacted Rusty-Brown Cinder & Steel Rail Gravel (minecart tracks & walkways)
 *   w2 = Crushed Black Coal Dust & Dark Grey Shale Gravel (quarry, terril slag heap, yard)
 *   w3 = Wet Slate Cooling Canal Rim & Northern Moss (NE cooling reservoir)
 */
function computeCoalMineSplatWeights(x, z, h) {
  // Biome 2: Crushed black coal dust & shale across NW quarry, N terril slag heap & mine yard
  const terrilZone = 1.0 - smoothstep(2.2, 5.2, Math.hypot((x + 1.1) * 0.72, (z + 8.4) * 1.0));
  const quarryZone = 1.0 - smoothstep(2.4, 4.8, Math.hypot(x + 4.7, z + 4.5));
  const mineYard = rectFlatMask(x, z, MINE_CENTER.x, MINE_CENTER.z, 3.05, 3.05, 1.55) * 0.92;
  const wsYard = rectFlatMask(x, z, -4.6, 4.4, 2.15, 1.85, 1.35) * 0.85;
  const wCoal = clamp01(Math.max(terrilZone, quarryZone, mineYard, wsYard));

  // Biome 1: Compacted rusty-brown cinder & steel rail gravel beneath minecart tracks & main avenues
  const dTrackA = segmentDist(x, z, -4.6, -2.6, -4.6, 2.8);
  const dTrackB = segmentDist(x, z, -2.5, 4.75, 3.6, 4.75);
  const dConnector = segmentDist(x, z, 3.6, 2.1, 3.6, 4.75);
  const dMidPath = segmentDist(x, z, -1.6, -1.0, 1.2, 1.8);
  const railDist = Math.min(dTrackA, dTrackB, dConnector, dMidPath * 1.1);
  const wCinder = clamp01(1.0 - smoothstep(0.85, 2.05, railDist));

  // Biome 3: Wet slate cooling canal rim & northern moss around NE reservoir
  const canalDist = Math.hypot((x - 7.55) * 0.88, (z + 5.85) * 0.92);
  const wCanal = clamp01(1.0 - smoothstep(1.9, 3.8, canalDist));

  // Biome 0: Hardy northern meadow grass around outer basin edges
  const used = clamp01(wCoal * 0.94 + wCinder * 0.92 + wCanal * 0.86);
  let w0 = Math.max(0.06, 1.0 - used);
  let w1 = wCinder * (1.0 - wCanal * 0.55);
  let w2 = wCoal * (1.0 - wCinder * 0.52);
  let w3 = wCanal;

  const sum = w0 + w1 + w2 + w3 || 1;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(WATER_LEVEL - 0.04, WATER_LEVEL + 0.16, h);
  return { w0, w1, w2, w3, wetness };
}

/**
 * Builds a clean zero-gap sloped corrugated zinc roof prism geometry matching BLOCK_W x BLOCK_D.
 */
function createSlopedZincRoofGeometry(w = BLOCK_W, h = BLOCK_H, d = BLOCK_D) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  // Asymmetric industrial shed/pent slope (high back eaves -> lower front eaves)
  const positions = new Float32Array([
    // Bottom face
    -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh,  hd,
    -hw, -hh, -hd,  hw, -hh,  hd, -hw, -hh,  hd,
    // Sloped top zinc roof deck (high along -Z, slopes gently down toward +Z)
    -hw,  hh, -hd, -hw, -hh * 0.12,  hd,  hw, -hh * 0.12,  hd,
    -hw,  hh, -hd,  hw, -hh * 0.12,  hd,  hw,  hh, -hd,
    // Back vertical fascia (-Z)
    -hw, -hh, -hd, -hw,  hh, -hd,  hw,  hh, -hd,
    -hw, -hh, -hd,  hw,  hh, -hd,  hw, -hh, -hd,
    // Front low eave fascia (+Z)
    -hw, -hh,  hd,  hw, -hh,  hd,  hw, -hh * 0.12,  hd,
    -hw, -hh,  hd,  hw, -hh * 0.12,  hd, -hw, -hh * 0.12,  hd,
    // Left gable (-X)
    -hw, -hh, -hd, -hw, -hh,  hd, -hw, -hh * 0.12,  hd,
    -hw, -hh, -hd, -hw, -hh * 0.12,  hd, -hw,  hh, -hd,
    // Right gable (+X)
    hw, -hh,  hd,  hw, -hh, -hd,  hw,  hh, -hd,
    hw, -hh,  hd,  hw,  hh, -hd,  hw, -hh * 0.12,  hd,
  ]);

  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
    0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1,
    0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0,
    0, 0, 1, 0, 1, 0.5, 0, 0, 1, 0.5, 0, 0.5,
    0, 0, 1, 0, 1, 0.5, 0, 0, 1, 0.5, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0.5,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a stylized Northern Silver Birch tree (pale ringed bark + airy deformed light-green/gold foliage)
 * to pair with Northern Pines along the coal basin perimeter.
 */
function buildNorthernBirchTree({ x, z, groundY, scale = 1.0, seed = 1, barkMat, foliageMat, trackGeo }) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.scale.setScalar(scale);

  const trunk = createRootedTrunk({
    height: 1.55,
    topR: 0.065,
    botR: 0.145,
    rootCount: 4,
    rootSpread: 0.28,
    rootHeight: 0.24,
    barkMat,
    leanX: Math.sin(seed * 1.7) * 0.08,
    leanZ: Math.cos(seed * 1.3) * 0.05,
    seed,
    trackGeo,
  });
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(Math.sin(seed * 1.7) * 0.06, 1.5, Math.cos(seed * 1.3) * 0.04);

  const puffs = [
    [0.0, 0.34, 0.0, 0.85, 0.72, 0.82],
    [-0.42, 0.08, 0.2, 0.68, 0.58, 0.66],
    [0.44, 0.12, -0.18, 0.66, 0.56, 0.68],
    [0.08, 0.55, 0.12, 0.54, 0.48, 0.54],
  ];
  puffs.forEach(([px, py, pz, sx, sy, sz], i) => {
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: 0.52,
        detail: 1,
        squashY: 0.78,
        irregularity: 0.25,
        seed: seed * 19 + i * 5.3,
        baseColor: '#366832',
        midColor: '#699e42',
        topColor: '#c2cc58',
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0.06 * (i % 2 ? 1 : -1), i * 1.25 + seed, 0.05);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  tree.add(crown);
  return { tree, crown };
}

export class Level6CoalMine extends Level1Pyramid {
  static meta = {
    id: 'level6_coalmine',
    title: 'Niveau 6 : La Mine de Charbon (50 blocs)',
    hudLabel: 'Mine de Charbon',
    totalGoal: 50,
    skyColor: '#c9d6de',
  };

  constructor(options) {
    super(options);
  }

  _beforeBuild() {
    this.coal = this.textures.ensureCoalMinePack();
    this.totalGoal = Level6CoalMine.meta.totalGoal;
    this.hudLabel = Level6CoalMine.meta.hudLabel;
    this.pyramidCenter = new THREE.Vector3(this._mx(MINE_CENTER.x), 0, MINE_CENTER.z);

    this.minecartWheels = [];
    this.pulleyWheels = [];
    this.lanternFlames = [];
    this.steamPuffs = [];
    this.steamAccum = 0;
    this.smokestackTopPos = new THREE.Vector3(
      this.pyramidCenter.x + this._mx(-2 * MINE_STEP),
      FOUNDATION_Y + BLOCK_H * 4.25,
      this.pyramidCenter.z - 2 * MINE_STEP
    );
    this.birchBarkMat = this._trackMat(
      new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.88, metalness: 0.02 })
    );
  }

  _initSharedGeometries() {
    super._initSharedGeometries();

    // Raw blocks are glossy faceted anthracite coal & shale
    this.rawCoalMat = this.coal.materials.anthraciteCoal;
    this.carvedBlockMat = this.coal.materials.concrete;

    // Zero-gap sloped corrugated zinc roof prism + ghost
    this.geos.zincRoof = this._trackGeo(createSlopedZincRoofGeometry(BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.ghostZinc = this._trackGeo(
      createSlopedZincRoofGeometry(BLOCK_W * 0.94, BLOCK_H * 0.92, BLOCK_D * 0.94)
    );
    this.geos.ghostZincEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostZinc));

    // Spoked steel headframe pulley wheel (molette) preview & ghost
    this.geos.pulleyPreview = this._trackGeo(new THREE.TorusGeometry(0.36, 0.075, 8, 18));
    this.geos.ghostPulley = this._trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 14));
    this.geos.ghostPulley.rotateZ(Math.PI / 2);
    this.geos.ghostPulleyEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostPulley));

    // Coal, brick, steel & steam particle materials
    this.mats.dustCoal = this._trackMat(
      new THREE.MeshStandardMaterial({ color: 0x262a30, roughness: 0.65, metalness: 0.2 })
    );
    this.mats.dustBrick = this._trackMat(
      new THREE.MeshStandardMaterial({ color: 0x9c4534, roughness: 0.9 })
    );
    this.mats.dustSteel = this._trackMat(
      new THREE.MeshStandardMaterial({ color: 0x626c76, roughness: 0.48, metalness: 0.72 })
    );
    this.mats.steamPuff = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf4f7fa,
        roughness: 0.96,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      })
    );
    this.mats.goldenSpark = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffc852, transparent: true, opacity: 0.95 })
    );
  }

  getTerrainHeight(x, z) {
    return sampleCoalMineTerrainHeight(x * this.mirrorX, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 COAL MINING BASIN, TERRIL SLAG HEAP, COOLING CANAL & PROPS
   * ========================================================================== */
  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // 1. Unified 128x128 sculpted Coal Basin terrain mesh with 4-biome crisp splatting
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
      const h = sampleCoalMineTerrainHeight(sx, z);
      pos.setY(i, h);

      const { w0, w1, w2, w3, wetness } = computeCoalMineSplatWeights(sx, z, h);
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

    const terrainMesh = new THREE.Mesh(terrainGeo, this.coal.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    env.add(terrainMesh);

    // 2. Contoured geological plinth skirt (automatically upgraded to 1024x1024 coal strata by main.js)
    const skirtMesh = new THREE.Mesh(this._buildContouredPlinthSkirt(), this.textures.materials.plinth);
    skirtMesh.receiveShadow = true;
    env.add(skirtMesh);

    const bottomCapGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D));
    bottomCapGeo.rotateX(Math.PI / 2);
    const bottomCap = new THREE.Mesh(bottomCapGeo, this.textures.materials.plinth);
    bottomCap.position.y = -1.65;
    env.add(bottomCap);

    // 3. Industrial Cooling Water Canal / Reservoir with concrete embankment curb in NE
    this._buildCoolingCanal(env);

    // 4. Stylized Northern Pines & Silver Birches along the outer basin perimeter
    const foliageMat = this._getSharedFoliageMaterial();
    const treeSpecs = [
      [4.2, -7.8, 1.05, 'pine'],
      [8.45, -2.2, 1.02, 'birch'],
      [8.05, 5.75, 1.08, 'pine'],
      [-8.1, 6.2, 0.98, 'birch'],
      [-8.4, -1.6, 1.04, 'pine'],
      [-7.9, -7.4, 0.92, 'pine'],
      [8.2, 2.35, 0.94, 'birch'],
    ];
    treeSpecs.forEach(([tx, tz, sc, kind], idx) => {
      const wx = this._mx(tx);
      const groundY = this.getTerrainHeight(wx, tz);
      const built =
        kind === 'birch'
          ? buildNorthernBirchTree({
              x: wx,
              z: tz,
              groundY,
              scale: sc,
              seed: idx + 11,
              barkMat: this.birchBarkMat,
              foliageMat,
              trackGeo: (g) => this._trackGeo(g),
            })
          : buildStylizedFrontierPine({
              x: wx,
              z: tz,
              groundY,
              scale: sc,
              seed: idx + 61,
              barkMat: this.coal.materials.mineTimber,
              foliageMat,
              trackGeo: (g) => this._trackGeo(g),
            });
      this.palmFronds.push({ group: built.crown, phase: wx * 0.55 + tz * 0.45 });
      env.add(built.tree);
    });

    // 5. Stylized 3D Glossy Anthracite Coal Piles, Stacked Mine Timbers & Glowing Iron Lanterns
    const coalPiles = this._buildIndustrialProps(env);

    // 6. Cozy Outlanders 3D Instanced Northern Grass (920 tufts), Dark Shale Pebbles & Wildflowers
    const focalPoints = [
      ...treeSpecs.map(([tx, tz]) => ({ x: this._mx(tx), z: tz, innerRadius: 0.34, radius: 1.95 })),
      ...coalPiles.map(([cx, cz]) => ({ x: this._mx(cx), z: cz, innerRadius: 0.55, radius: 1.55 })),
      { x: this._mx(5.6), z: -4.6, innerRadius: 0.35, radius: 2.0 },
      { x: this._mx(7.1), z: -3.5, innerRadius: 0.35, radius: 1.85 },
    ];
    this.cozyGround = createCozyGroundFoliageSystem({
      parent: env,
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      isBlocked: (x, z) => this._isBlockedForFoliage(x, z),
      getGrassWeight: (x, z, y) => {
        const sx = x * this.mirrorX;
        const { w0: wGrass, w1: wCinder, w2: wCoal, w3: wCanal } = computeCoalMineSplatWeights(sx, z, y);
        if (wCinder > 0.28 || wCoal > 0.42) return 0;
        return Math.max(wGrass, wCanal * 0.85);
      },
      focalPoints,
      waterLevel: WATER_LEVEL,
      halfW: TERRAIN_W * 0.5,
      halfD: TERRAIN_D * 0.5,
      grassCount: 920,
      pebbleCount: 130,
      flowerCount: 74,
      grassPalette: ['#5c8c3e', '#487434', '#729e44', '#8ea64a', '#3d632e'],
      pebblePalette: ['#4a4f57', '#676d75', '#32363d', '#84898f'],
      flowerPalette: ['#fffcf2', '#fff4d6', '#ffe359', '#f8d04a'],
      seed: 606,
    });

    // 7. Soft Circular Contact AO Shadows under trees, coal piles, timber stacks, lanterns, quarry, workshop & mine
    const aoEntries = [
      ...treeSpecs.map(([tx, tz, sc]) => ({ x: this._mx(tx), z: tz, radius: 1.08 * sc, strength: 0.94 })),
      ...coalPiles.map(([cx, cz, sc]) => ({ x: this._mx(cx), z: cz, radius: 0.78 * sc, strength: 0.95 })),
      { x: this._mx(-4.7), z: -5.2, radiusX: 3.3, radiusZ: 1.55, strength: 0.72 },
      { x: this._mx(-4.6), z: 4.15, radiusX: 2.35, radiusZ: 2.15, strength: 0.7 },
      { x: this.pyramidCenter.x, z: this.pyramidCenter.z, radiusX: 3.15, radiusZ: 3.15, strength: 0.82 },
    ];
    this.contactShadows = createContactShadowSystem(env, aoEntries, (x, z) => this.getTerrainHeight(x, z));
  }

  _buildCoolingCanal(parent) {
    const cx = this._mx(7.55);
    const cz = -5.85;

    const waterGeo = this._trackGeo(new THREE.CircleGeometry(2.95, 30));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.coal.materials.coolingWater);
    water.position.set(cx, WATER_LEVEL, cz);
    water.scale.set(1.06, 1, 0.86);
    water.receiveShadow = true;
    parent.add(water);
    this.nileWaterMesh = water;

    // Industrial poured-concrete canal embankment walls & iron discharge pipe
    const curbGeo = this._trackGeo(new THREE.BoxGeometry(1.15, 0.28, 0.34));
    [
      [4.85, -5.05, 0.56],
      [5.6, -3.95, 1.02],
      [6.8, -3.45, 1.48],
      [8.0, -3.4, 1.66],
    ].forEach(([bx, bz, rot]) => {
      const wx = this._mx(bx);
      const y = Math.max(this.getTerrainHeight(wx, bz), WATER_LEVEL + 0.02);
      const curb = new THREE.Mesh(curbGeo, this.coal.materials.concrete);
      curb.position.set(wx, y + 0.09, bz);
      curb.rotation.y = rot * this.mirrorX;
      curb.castShadow = true;
      curb.receiveShadow = true;
      parent.add(curb);
    });

    // Cast-iron cooling return pipe feeding into the reservoir
    const pipe = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 1.35, 10)),
      this.coal.materials.rivetedIron
    );
    pipe.position.set(this._mx(5.65), WATER_LEVEL + 0.32, -4.35);
    pipe.rotation.z = Math.PI * 0.44 * this.mirrorX;
    pipe.rotation.y = 0.65 * this.mirrorX;
    pipe.castShadow = true;
    parent.add(pipe);
  }

  _buildIndustrialProps(parent) {
    // Glossy faceted anthracite coal heaps along the yard perimeter
    const coalHeapGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.56, 0));
    const coalPiles = [
      [-7.7, -3.2, 1.15],
      [-1.35, -5.8, 0.96],
      [7.45, 3.85, 0.92],
      [-7.25, 4.95, 0.88],
    ];
    coalPiles.forEach(([cx, cz, sc], idx) => {
      const wx = this._mx(cx);
      const y = this.getTerrainHeight(wx, cz);
      const heap = new THREE.Group();
      heap.position.set(wx, y, cz);
      heap.scale.setScalar(sc);

      const main = new THREE.Mesh(coalHeapGeo, this.coal.materials.anthraciteCoal);
      main.position.y = 0.24;
      main.scale.set(1.25, 0.68, 1.1);
      main.rotation.y = idx * 1.1;
      main.castShadow = true;
      main.receiveShadow = true;
      heap.add(main);

      for (let k = 0; k < 3; k++) {
        const chunk = new THREE.Mesh(coalHeapGeo, this.coal.materials.anthraciteCoal);
        const a = (k / 3) * Math.PI * 2 + idx;
        chunk.position.set(Math.cos(a) * 0.48, 0.14, Math.sin(a) * 0.42);
        chunk.scale.setScalar(0.42 + (k % 2) * 0.14);
        chunk.castShadow = true;
        heap.add(chunk);
      }
      parent.add(heap);
    });

    // Stacked pit-prop mine timbers (bois de soutènement) near workshop & staging pad
    const logGeo = this._trackGeo(new THREE.CylinderGeometry(0.08, 0.085, 1.38, 6));
    logGeo.rotateZ(Math.PI / 2);
    [
      [-7.35, 2.35, 0.25],
      [6.85, 4.95, -0.32],
    ].forEach(([lx, lz, rot]) => {
      const wx = this._mx(lx);
      const y = this.getTerrainHeight(wx, lz);
      const stack = new THREE.Group();
      stack.position.set(wx, y, lz);
      stack.rotation.y = rot * this.mirrorX;
      [
        [0, 0.08, -0.17],
        [0, 0.08, 0.0],
        [0, 0.08, 0.17],
        [0, 0.22, -0.085],
        [0, 0.22, 0.085],
        [0, 0.35, 0.0],
      ].forEach(([ox, oy, oz]) => {
        const log = new THREE.Mesh(logGeo, this.coal.materials.mineTimber);
        log.position.set(ox, oy, oz);
        log.castShadow = true;
        log.receiveShadow = true;
        stack.add(log);
      });
      parent.add(stack);
    });

    // Warm industrial cast-iron yard lanterns along work routes & mine entrance
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.045, 0.065, 1.45, 6));
    const capGeo = this._trackGeo(new THREE.ConeGeometry(0.18, 0.14, 6));
    const lampGeo = this._trackGeo(new THREE.CylinderGeometry(0.09, 0.075, 0.22, 6));
    [
      [-1.75, 2.65],
      [1.05, 2.55],
      [6.25, 2.55],
      [-1.55, -2.55],
    ].forEach(([px, pz], idx) => {
      const wx = this._mx(px);
      const y = this.getTerrainHeight(wx, pz);
      const lamp = new THREE.Group();
      lamp.position.set(wx, y, pz);

      const post = new THREE.Mesh(postGeo, this.coal.materials.rivetedIron);
      post.position.y = 0.72;
      post.castShadow = true;
      lamp.add(post);

      const housing = new THREE.Mesh(lampGeo, this.coal.materials.lanternGlow);
      housing.position.y = 1.46;
      lamp.add(housing);
      this.lanternFlames.push({ mesh: housing, phase: idx * 1.4 });

      const cap = new THREE.Mesh(capGeo, this.coal.materials.rivetedIron);
      cap.position.y = 1.62;
      cap.castShadow = true;
      lamp.add(cap);

      parent.add(lamp);
    });

    return coalPiles;
  }

  /* ============================================================================
   * 2. ZONE 1 — LA VEINE DE CHARBON & FOSSE D'EXTRACTION (NORTH-WEST)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    // Stepped black anthracite coal seam & dark shale cliff face
    const terraces = [
      { x: -4.7, y: 0.45, z: -5.9, w: 6.4, h: 0.9, d: 2.3, mat: this.coal.materials.shaleRock },
      { x: -4.95, y: 1.15, z: -6.2, w: 5.5, h: 0.85, d: 1.75, mat: this.coal.materials.anthraciteCoal },
      { x: -5.3, y: 1.85, z: -6.55, w: 4.1, h: 0.78, d: 1.25, mat: this.coal.materials.shaleRock },
      { x: -7.1, y: 0.72, z: -4.95, w: 1.55, h: 1.44, d: 2.8, mat: this.coal.materials.anthraciteCoal },
    ];
    terraces.forEach((t) => {
      const m = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(t.w, t.h, t.d)), t.mat);
      m.position.set(this._mx(t.x), t.y, t.z);
      m.castShadow = true;
      m.receiveShadow = true;
      quarryGroup.add(m);
    });

    // Timber pit-prop gantry beams bracing the coal seam face (open top, zero obstruction!)
    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 1.55, 0.16));
    const beamGeo = this._trackGeo(new THREE.BoxGeometry(5.2, 0.16, 0.18));
    [-6.65, -2.55].forEach((px) => {
      const p = new THREE.Mesh(postGeo, this.coal.materials.mineTimber);
      p.position.set(this._mx(px), 1.45, -5.0);
      p.castShadow = true;
      quarryGroup.add(p);
    });
    const topBeam = new THREE.Mesh(beamGeo, this.coal.materials.mineTimber);
    topBeam.position.set(this._mx(-4.6), 2.18, -5.0);
    topBeam.castShadow = true;
    quarryGroup.add(topBeam);

    // 3 Extractable Glossy Anthracite Coal & Shale Nodes
    const nodeOffsets = [-5.8, -4.6, -3.4];
    const hitSphereGeo = this._trackGeo(new THREE.SphereGeometry(0.86, 8, 6));
    const hitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    nodeOffsets.forEach((nx, i) => {
      const wx = this._mx(nx);
      const nz = -4.75;
      const g = new THREE.Group();
      g.position.set(wx, 0.56, nz);

      const core = new THREE.Mesh(
        this._trackGeo(new THREE.DodecahedronGeometry(0.62, 0)),
        this.coal.materials.anthraciteCoal
      );
      core.scale.set(1.12, 0.94, 0.95);
      core.rotation.set(i * 0.55, i * 1.15, 0.25);
      core.castShadow = true;
      core.receiveShadow = true;
      g.add(core);

      const sub = new THREE.Mesh(
        this._trackGeo(new THREE.DodecahedronGeometry(0.35, 0)),
        this.coal.materials.shaleRock
      );
      sub.position.set(0.36 * (i % 2 === 0 ? 1 : -1), -0.18, 0.26);
      sub.castShadow = true;
      g.add(sub);

      const hitbox = new THREE.Mesh(hitSphereGeo, hitMat);
      g.add(hitbox);
      quarryGroup.add(g);

      const nodeObj = {
        index: i,
        id: `quarry_${i}`,
        group: g,
        mesh: core,
        basePos: new THREE.Vector3(wx, 0.56, nz),
        baseScale: new THREE.Vector3(1.12, 0.94, 0.95),
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

    // Concrete Quarry Output Pad (5 slots for freshly extracted Raw Coal & Shale Blocks)
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.45, 0.14, 1.38)),
      this.coal.materials.concrete
    );
    pad.position.set(this._mx(-4.6), 0.07, -3.28);
    pad.receiveShadow = true;
    pad.raycast = () => {};
    quarryGroup.add(pad);

    for (let i = 0; i < 5; i++) {
      const sx = this._mx(-6.6 + i * 1.0);
      const sz = -3.28;
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

  _getRawBlockMaterial() {
    return this.coal.materials.anthraciteCoal;
  }

  /* ============================================================================
   * 3. ZONE 2 — LES WAGONNETS SUR RAILS D'ACIER (WEST & CENTER)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();

    // Restyle tracks with twin metallic steel rails & upgrade both sleds into riveted cast-iron minecarts
    const wheelGeo = this._trackGeo(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 12));
    const flangeGeo = this._trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12));
    const lipH = 0.2;

    this.sleds.forEach((sled) => {
      if (!sled.group) return;
      const isZ = sled.axis === 'z';
      const deckW = isZ ? (this.sledCapacity === 4 ? 3.5 : 2.65) : 1.16;
      const deckD = isZ ? 1.16 : (this.sledCapacity === 4 ? 3.5 : 2.65);

      // Convert wooden sled deck into riveted cast-iron wagonnet chassis
      sled.group.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (
          child.material === this.textures.materials.timber ||
          child.material === this.textures.materials.timberDark
        ) {
          child.material = this.coal.materials.mineCartIron;
        }
      });

      // Add low riveted iron side walls around the wagonnet hopper bed
      const frontLip = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(deckW + 0.06, lipH, 0.07)),
        this.coal.materials.rivetedIron
      );
      frontLip.position.set(0, 0.34, deckD * 0.5);
      frontLip.castShadow = true;
      sled.group.add(frontLip);

      const backLip = frontLip.clone();
      backLip.position.z = -deckD * 0.5;
      sled.group.add(backLip);

      const sideLipGeo = this._trackGeo(new THREE.BoxGeometry(0.07, lipH, deckD));
      [-1, 1].forEach((s) => {
        const sl = new THREE.Mesh(sideLipGeo, this.coal.materials.rivetedIron);
        sl.position.set(s * (deckW * 0.5), 0.34, 0);
        sl.castShadow = true;
        sled.group.add(sl);
      });

      // Add 4 spinning flanged cast-iron railway wheels
      const wheels = [];
      const railSpread = 0.58;
      const axleSpread = 0.42;
      [-railSpread, railSpread].forEach((rOff) => {
        [-axleSpread, axleSpread].forEach((aOff) => {
          const wGroup = new THREE.Group();
          if (isZ) {
            wGroup.position.set(rOff, 0.16, aOff);
            wGroup.rotation.z = Math.PI / 2;
          } else {
            wGroup.position.set(aOff, 0.16, rOff);
            wGroup.rotation.x = Math.PI / 2;
          }
          const tire = new THREE.Mesh(wheelGeo, this.coal.materials.pulleySteel);
          tire.castShadow = true;
          wGroup.add(tire);
          const fl = new THREE.Mesh(flangeGeo, this.coal.materials.steelRail);
          fl.position.y = rOff > 0 ? -0.045 : 0.045;
          wGroup.add(fl);
          sled.group.add(wGroup);
          wheels.push(wGroup);
        });
      });

      // Add twin metallic steel rails along the track corridor
      const span = Math.abs(sled.endPos - sled.startPos) + 2.4;
      const midV = (sled.startPos + sled.endPos) * 0.5;
      const railGeo = this._trackGeo(
        isZ ? new THREE.BoxGeometry(0.075, 0.08, span) : new THREE.BoxGeometry(span, 0.08, 0.075)
      );
      [-railSpread, railSpread].forEach((rOff) => {
        const rail = new THREE.Mesh(railGeo, this.coal.materials.steelRail);
        if (isZ) rail.position.set(sled.fixedCoord + rOff, 0.095, midV);
        else rail.position.set(midV, 0.095, sled.fixedCoord + rOff);
        rail.castShadow = true;
        rail.receiveShadow = true;
        this.root.add(rail);
      });

      sled.wheels = wheels;
      sled.prevProgress = sled.progress;
      this.minecartWheels.push(sled);
    });
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DE TAILLE & BRIQUETERIE (SW — OPEN-TOP VISIBILITY!)
   *    Recessed rear-35% corrugated zinc awning with raycast disabled on roof meshes
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const wsGroup = new THREE.Group();
    this.root.add(wsGroup);

    const wx = this._mx(-4.6);
    const wz = 4.65;

    // Poured concrete foundry floor apron
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.15, 0.14, 3.65)),
      this.coal.materials.concrete
    );
    floor.position.set(wx, 0.07, wz);
    floor.receiveShadow = true;
    wsGroup.add(floor);

    // Low weathered red-brick rear backwall ONLY (along -Z rear edge, zero front/side occlusion)
    const rearWall = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.85, 1.55, 0.28)),
      this.coal.materials.industrialBrick
    );
    rearWall.position.set(wx, 0.84, wz - 1.58);
    rearWall.castShadow = true;
    rearWall.receiveShadow = true;
    wsGroup.add(rearWall);

    // 4 Riveted Cast-Iron Support Columns (rear 2 taller supporting the cutaway awning)
    const colGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 2.05, 0.16));
    const frontPostGeo = this._trackGeo(new THREE.BoxGeometry(0.14, 0.92, 0.14));
    [
      [-1.82, -1.52, true],
      [1.82, -1.52, true],
      [-1.82, 1.48, false],
      [1.82, 1.48, false],
    ].forEach(([ox, oz, isTall]) => {
      const col = new THREE.Mesh(isTall ? colGeo : frontPostGeo, this.coal.materials.rivetedIron);
      col.position.set(wx + this._mx(ox), isTall ? 1.1 : 0.54, wz + oz);
      col.castShadow = true;
      wsGroup.add(col);
    });

    // OPEN-FRONT CUTAWAY CORRUGATED ZINC ROOF (covers ONLY rear ~35% behind anvil, raycast disabled!)
    const awningGroup = new THREE.Group();
    awningGroup.position.set(wx, 2.08, wz - 1.12);
    const roofSheet = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.2, 0.1, 1.24)),
      this.coal.materials.corrugatedZinc
    );
    roofSheet.rotation.x = 0.16;
    roofSheet.castShadow = true;
    awningGroup.add(roofSheet);

    const fascia = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.26, 0.12, 0.1)),
      this.coal.materials.rivetedIron
    );
    fascia.position.set(0, -0.09, 0.6);
    awningGroup.add(fascia);

    // Disable raycast on every child of the cutaway roof so top-down taps hit the workbench 100% cleanly
    awningGroup.traverse((child) => {
      child.raycast = () => {};
    });
    wsGroup.add(awningGroup);
    this.canopyMesh = null;

    // Industrial Stonecutter & Brick-Press Anvil Workbench (100% visible from top-down view!)
    const benchX = wx;
    const benchZ = wz + 0.18;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.58, 0.62, 1.38)),
      this.coal.materials.concrete
    );
    benchBase.position.set(benchX, 0.44, benchZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    wsGroup.add(benchBase);

    const steelPlate = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.48, 0.1, 1.28)),
      this.coal.materials.rivetedIron
    );
    steelPlate.position.set(benchX, 0.78, benchZ);
    steelPlate.castShadow = true;
    steelPlate.receiveShadow = true;
    wsGroup.add(steelPlate);

    // Decorative blacksmith hammer resting on the bench edge
    const handle = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.028, 0.032, 0.46, 6)),
      this.coal.materials.mineTimber
    );
    handle.position.set(benchX + this._mx(0.56), 0.86, benchZ + 0.34);
    handle.rotation.z = Math.PI * 0.48;
    handle.rotation.y = 0.4;
    wsGroup.add(handle);

    const hammerHead = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.12, 0.1, 0.22)),
      this.coal.materials.rivetedIron
    );
    hammerHead.position.set(benchX + this._mx(0.36), 0.87, benchZ + 0.42);
    hammerHead.rotation.y = 0.4;
    wsGroup.add(hammerHead);

    // Workbench active carving slot
    const wbMarker = this._createSlotMarker(wsGroup, benchX, 0.845, benchZ);
    this.workbenchSlot = {
      id: 'workbench',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(benchX, 0.84 + BLOCK_H * 0.5, benchZ),
      dropIndicatorY: 0.85,
      marker: wbMarker,
      occupied: false,
      block: null,
    };

    // Generous invisible carve-swipe hitbox over anvil (active whenever a raw block sits on it)
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.9, 1.35, 1.9));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(benchX, 1.29, benchZ);
    this.workbenchCarveHitbox.visible = false;
    wsGroup.add(this.workbenchCarveHitbox);

    // 3 Carving Progress Pips floating neatly beside the anvil
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xffe28a,
          emissive: 0xd98a22,
          emissiveIntensity: 0.65,
          roughness: 0.3,
        })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(benchX + (i - 1) * 0.36, 1.98, benchZ - 0.55);
      pip.visible = false;
      wsGroup.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Workshop Output Slots beside Track B
    this.outputSlots = [];
    [
      [benchX + this._mx(1.42), wz - 0.68],
      [benchX + this._mx(1.42), wz + 0.52],
    ].forEach(([ox, oz], idx) => {
      const marker = this._createSlotMarker(wsGroup, ox, 0.155, oz);
      this.outputSlots.push({
        id: `ws_out_${idx}`,
        zoneType: 'workshop_output',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(ox, 0.14 + BLOCK_H * 0.5, oz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    });

    // 4 Staging Slots at the Eastern end of Track B (next to the Coal Mine Construction Site)
    const stagPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.65, 0.14, 2.35)),
      this.coal.materials.concrete
    );
    stagPad.position.set(this._mx(3.6), 0.07, 4.45);
    stagPad.receiveShadow = true;
    wsGroup.add(stagPad);

    this.stagingSlots = [];
    [
      [3.08, 3.92],
      [4.12, 3.92],
      [3.08, 4.98],
      [4.12, 4.98],
    ].forEach(([sx, sz], idx) => {
      const wxPos = this._mx(sx);
      const marker = this._createSlotMarker(wsGroup, wxPos, 0.155, sz);
      this.stagingSlots.push({
        id: `staging_${idx}`,
        zoneType: 'staging',
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(wxPos, 0.14 + BLOCK_H * 0.5, sz),
        dropIndicatorY: 0.15,
        marker,
        block: null,
      });
    });
  }

  /* ============================================================================
   * 5. ZONE 4 — CHANTIER DE LA MINE DE CHARBON & CHEVALEMENT (50 BLOCKS, 4 TIERS)
   *    Zero-Gap Connected Masonry, Red Brick Engine House, Cast-Iron Lattice & Pulleys
   * ========================================================================== */
  _buildPyramidSite() {
    const site = new THREE.Group();
    this.root.add(site);

    const pc = this.pyramidCenter;
    const baseFootprint = 5 * MINE_STEP; // 4.80 exact outer span

    // Heavy industrial concrete apron surrounding the sunken underground mine shaft
    const apron = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(baseFootprint + 0.52, FOUNDATION_Y, baseFootprint + 0.52)),
      this.coal.materials.concrete
    );
    apron.position.set(pc.x, FOUNDATION_Y * 0.5, pc.z);
    apron.receiveShadow = true;
    site.add(apron);

    // Dark recessed underground mine-shaft entrance pit (3x3 center) with timber lining & steel collar
    const shaftOpening = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.55, 0.06, 2.55)),
      this.coal.materials.shaftVoid
    );
    shaftOpening.position.set(pc.x, FOUNDATION_Y + 0.005, pc.z);
    site.add(shaftOpening);

    // Heavy riveted steel collar beams framing the recessed shaft opening
    const collarBeamGeoX = this._trackGeo(new THREE.BoxGeometry(2.72, 0.14, 0.18));
    const collarBeamGeoZ = this._trackGeo(new THREE.BoxGeometry(0.18, 0.14, 2.72));
    [-1.28, 1.28].forEach((off) => {
      const bx = new THREE.Mesh(collarBeamGeoX, this.coal.materials.rivetedIron);
      bx.position.set(pc.x, FOUNDATION_Y + 0.07, pc.z + off);
      bx.castShadow = true;
      site.add(bx);

      const bz = new THREE.Mesh(collarBeamGeoZ, this.coal.materials.rivetedIron);
      bz.position.set(pc.x + off, FOUNDATION_Y + 0.07, pc.z);
      bz.castShadow = true;
      site.add(bz);
    });

    // 4 vertical steel shaft guide stanchions rising from the shaft pit floor up to Tier 3 base
    const stanchionH = BLOCK_H * 2;
    const stanchionGeo = this._trackGeo(new THREE.BoxGeometry(0.18, stanchionH, 0.18));
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([gx, gz]) => {
      const st = new THREE.Mesh(stanchionGeo, this.coal.materials.rivetedIron);
      st.position.set(
        pc.x + this._mx(gx * MINE_STEP),
        FOUNDATION_Y + stanchionH * 0.5,
        pc.z + gz * MINE_STEP
      );
      st.castShadow = true;
      site.add(st);
    });

    // Twin short steel hoist guide rails leading into the recessed shaft opening
    const guideRailGeo = this._trackGeo(new THREE.BoxGeometry(0.07, 0.06, 2.45));
    [-0.45, 0.45].forEach((ox) => {
      const gr = new THREE.Mesh(guideRailGeo, this.coal.materials.steelRail);
      gr.position.set(pc.x + ox, FOUNDATION_Y + 0.04, pc.z);
      site.add(gr);
    });

    // 4-Tier 50-Block Architectural Blueprint (ZERO air gaps, exact 16 + 14 + 12 + 8 = 50 blocks)
    const blueprint = [];

    // TIER 1 (layer 0, gy = 0) — 16 Blocks: Reinforced Concrete Foundation Perimeter
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -2; gz <= 2; gz++) {
        if (Math.abs(gx) === 2 || Math.abs(gz) === 2) {
          blueprint.push({ layer: 0, gx, gy: 0, gz, pieceType: 'concrete' });
        }
      }
    }

    // TIER 2 (layer 1, gy = 1) — 14 Blocks: Weathered Red Industrial Brick Engine House + Smokestack Base
    const tier2Cells = [
      [-2, 2, 'brick'],
      [-1, 2, 'brick_window'],
      [0, 2, 'brick'],
      [1, 2, 'brick_window'],
      [2, 2, 'brick'],
      [-2, -2, 'smokestack'],
      [-2, -1, 'brick'],
      [-2, 0, 'brick_window'],
      [-2, 1, 'brick'],
      [2, -1, 'brick'],
      [2, 0, 'brick_window'],
      [2, 1, 'brick'],
      [-1, -2, 'brick'],
      [1, -2, 'brick'],
    ];
    tier2Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 1, gx, gy: 1, gz, pieceType });
    });

    // TIER 3 (layer 2, gy = 2..3) — 12 Blocks: Riveted Cast-Iron Chevalement Lattice + Smokestack Shaft
    const tier3Cells = [
      [-1, 2, -1, 'headframe'],
      [1, 2, -1, 'headframe'],
      [-1, 2, 1, 'headframe'],
      [1, 2, 1, 'headframe'],
      [0, 2, -1, 'headframe'],
      [0, 2, 1, 'headframe'],
      [-1, 2, 0, 'headframe'],
      [1, 2, 0, 'headframe'],
      [-2, 2, 1, 'headframe'],
      [2, 2, 1, 'headframe'],
      [-2, 2, -2, 'smokestack'],
      [-2, 3, -2, 'smokestack'],
    ];
    tier3Cells.forEach(([gx, gy, gz, pieceType]) => {
      blueprint.push({ layer: 2, gx, gy, gz, pieceType });
    });

    // TIER 4 (layer 3, gy = 2..3) — 8 Blocks: Sloped Corrugated Zinc Roofs + Twin Spoked Steel Pulley Wheels
    const tier4Cells = [
      [-2, 2, 2, 'roof_zinc'],
      [-1, 2, 2, 'roof_zinc'],
      [0, 2, 2, 'roof_zinc'],
      [1, 2, 2, 'roof_zinc'],
      [2, 2, 2, 'roof_zinc'],
      [2, 2, 0, 'roof_zinc'],
      [-1, 3, 0, 'pulley_wheel'],
      [1, 3, 0, 'pulley_wheel'],
    ];
    tier4Cells.forEach(([gx, gy, gz, pieceType]) => {
      blueprint.push({ layer: 3, gx, gy, gz, pieceType });
    });

    this.pyramidSlots = [];
    this.slotGridMap.clear();
    this.activeLayer = 0;
    this.maxLayerIndex = 3;

    blueprint.forEach((cell, idx) => {
      const worldX = pc.x + this._mx(cell.gx * MINE_STEP);
      const layerBaseY = FOUNDATION_Y + cell.gy * BLOCK_H;
      const worldY = layerBaseY + BLOCK_H * 0.5;
      const worldZ = pc.z + cell.gz * MINE_STEP;
      const isRoof = cell.pieceType === 'roof_zinc';
      const isPulley = cell.pieceType === 'pulley_wheel';

      const ghostGroup = new THREE.Group();
      ghostGroup.position.set(worldX, worldY + 0.02, worldZ);

      const gGeo = isRoof
        ? this.geos.ghostZinc
        : isPulley
          ? this.geos.ghostPulley
          : this.geos.ghostBox;
      const eGeo = isRoof
        ? this.geos.ghostZincEdges
        : isPulley
          ? this.geos.ghostPulleyEdges
          : this.geos.ghostBoxEdges;

      const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
      ghostMesh.renderOrder = 5;
      const ghostLines = new THREE.LineSegments(eGeo, this.mats.ghostLineNormal);
      ghostLines.renderOrder = 5;
      ghostGroup.add(ghostMesh, ghostLines);
      ghostGroup.visible = cell.layer === 0;
      site.add(ghostGroup);

      const slot = {
        id: `coal_slot_${idx}`,
        index: idx,
        zoneType: 'pyramid',
        layer: cell.layer,
        gridX: cell.gx,
        gridY: cell.gy,
        gridZ: cell.gz,
        isCapstone: false,
        pieceType: cell.pieceType,
        accepts: ['carved', 'capstone'],
        position: new THREE.Vector3(worldX, worldY, worldZ),
        dropIndicatorY: layerBaseY + 0.01,
        ghostGroup,
        ghostMesh,
        ghostLines,
        block: null,
      };

      this.pyramidSlots.push(slot);
      this.slotGridMap.set(`${cell.gx},${cell.gy},${cell.gz}`, slot);
    });
    this.totalGoal = this.pyramidSlots.length;
  }

  /* ============================================================================
   * 6. ZERO-GAP CONNECTED MASONRY, RIVETED STEEL LATTICE & SPOKED PULLEY WHEELS
   * ========================================================================== */
  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.032 };
  }

  _isConnectableMasonrySlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        slot.pieceType !== 'roof_zinc' &&
        slot.pieceType !== 'pulley_wheel'
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

  _shouldForgeCapstone() {
    return false;
  }

  _pickNextCarvedPieceType() {
    const remaining = this.pyramidSlots.filter((s) => s.layer === this.activeLayer && !s.block);
    if (remaining.some((s) => s.pieceType === 'pulley_wheel')) return 'pulley_wheel';
    if (remaining.some((s) => s.pieceType === 'roof_zinc')) return 'roof_zinc';
    if (remaining.some((s) => s.pieceType === 'headframe')) return 'headframe';
    if (remaining.some((s) => s.pieceType === 'smokestack')) return 'smokestack';
    if (remaining.some((s) => s.pieceType === 'brick_window')) return 'brick_window';
    if (remaining.some((s) => s.pieceType === 'brick')) return 'brick';
    return 'concrete';
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyCoalMinePieceVisual(block, pieceType, false);
    }
    return stillRaw;
  }

  _clearCustomBlockAttachments(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  _applyCoalMinePieceVisual(block, pieceType, isPlaced = false) {
    block.pieceType = pieceType;
    this._clearCustomBlockAttachments(block);

    if (pieceType === 'roof_zinc') {
      block.mesh.geometry = this.geos.zincRoof;
      block.mesh.material = this.coal.materials.corrugatedZinc;
      return;
    }

    if (pieceType === 'pulley_wheel') {
      block.mesh.geometry = this.geos.pulleyPreview;
      block.mesh.material = this.coal.materials.pulleySteel;
      if (isPlaced) {
        this._attachHeadframePulleyAssembly(block);
      }
      return;
    }

    if (pieceType === 'headframe') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.coal.materials.rivetedIron;
      if (isPlaced) {
        this._attachHeadframeLatticeBracing(block);
      }
      return;
    }

    if (pieceType === 'smokestack') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.coal.materials.industrialBrick;
      return;
    }

    if (pieceType === 'brick_window') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.coal.materials.industrialBrickWindow;
      return;
    }

    if (pieceType === 'brick') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.coal.materials.industrialBrick;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = this.coal.materials.concrete;
  }

  _isRoofSlot(slot) {
    return Boolean(slot && slot.block && slot.pieceType === 'roof_zinc');
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
    slot.block.roofMask = mask;
    slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
      BLOCK_W,
      BLOCK_H,
      BLOCK_D,
      mask,
      { style: 'shed', eaveOverhang: 0.02 }
    );
  }

  _applyHeadframeBracing(slot) {
    if (!slot || !slot.block || slot.pieceType !== 'headframe') return;
    const block = slot.block;
    this._clearCustomBlockAttachments(block);

    const { gridX: gx, gridY: gy, gridZ: gz } = slot;
    const nPX = this.slotGridMap.get(`${gx + 1},${gy},${gz}`);
    const nNX = this.slotGridMap.get(`${gx - 1},${gy},${gz}`);
    const nPZ = this.slotGridMap.get(`${gx},${gy},${gz + 1}`);
    const nNZ = this.slotGridMap.get(`${gx},${gy},${gz - 1}`);
    const hasPX = Boolean(nPX && nPX.block);
    const hasNX = Boolean(nNX && nNX.block);
    const hasPZ = Boolean(nPZ && nPZ.block);
    const hasNZ = Boolean(nNZ && nNZ.block);

    const braceGroup = new THREE.Group();
    if (!this.geos.headframeStrut) {
      this.geos.headframeStrut = this._trackGeo(new THREE.BoxGeometry(0.085, BLOCK_H * 0.96, 0.085));
    }
    if (!this.geos.headframeDiag) {
      this.geos.headframeDiag = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.84, 0.062, 0.022));
    }

    // Exposed outer corner iron flanges only (zero overlap inside welded ConnectedMasonry seams!)
    const corners = [
      [-0.43, -0.43, !hasNX && !hasNZ],
      [0.43, -0.43, !hasPX && !hasNZ],
      [-0.43, 0.43, !hasNX && !hasPZ],
      [0.43, 0.43, !hasPX && !hasPZ],
    ];
    for (let i = 0; i < corners.length; i++) {
      const [ox, oz, exposed] = corners[i];
      if (!exposed) continue;
      const post = new THREE.Mesh(this.geos.headframeStrut, this.coal.materials.rivetedIron);
      post.position.set(ox, 0, oz);
      post.castShadow = true;
      braceGroup.add(post);
    }

    // Diagonal steel X-bracing ONLY on exposed ±Z outer faces, staggered cleanly proud (zero z-fighting!)
    const exposedSigns = [];
    if (!hasPZ) exposedSigns.push(1);
    if (!hasNZ) exposedSigns.push(-1);
    for (let i = 0; i < exposedSigns.length; i++) {
      const sign = exposedSigns[i];
      const d1 = new THREE.Mesh(this.geos.headframeDiag, this.coal.materials.pulleySteel);
      d1.position.set(0, 0, sign * 0.491);
      d1.rotation.z = 0.46;
      braceGroup.add(d1);

      const d2 = new THREE.Mesh(this.geos.headframeDiag, this.coal.materials.pulleySteel);
      d2.position.set(0, 0, sign * 0.503);
      d2.rotation.z = -0.46;
      braceGroup.add(d2);
    }

    block.mesh.add(braceGroup);
    block.customAttach = braceGroup;
  }

  _updateConnectedRoofAround(slot) {
    if (!slot) return;
    const { gridX: gx, gridY: gy, gridZ: gz } = slot;
    const candidates = [
      slot,
      this.slotGridMap.get(`${gx + 1},${gy},${gz}`),
      this.slotGridMap.get(`${gx - 1},${gy},${gz}`),
      this.slotGridMap.get(`${gx},${gy},${gz + 1}`),
      this.slotGridMap.get(`${gx},${gy},${gz - 1}`),
    ];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c || !c.block) continue;
      if (c.pieceType === 'roof_zinc') {
        this._applyConnectedRoof(c);
      } else if (c.pieceType === 'headframe') {
        this._applyHeadframeBracing(c);
      }
    }
  }

  /**
   * Adds exposed-face riveted cast-iron cross-truss ribs & corner flanges to placed Headframe blocks.
   */
  _attachHeadframeLatticeBracing(block) {
    if (block && block.slot) {
      this._applyHeadframeBracing(block.slot);
      return;
    }
    const braceGroup = new THREE.Group();
    if (!this.geos.headframeStrut) {
      this.geos.headframeStrut = this._trackGeo(new THREE.BoxGeometry(0.09, BLOCK_H * 0.98, 0.09));
    }
    [-0.42, 0.42].forEach((ox) => {
      [-0.42, 0.42].forEach((oz) => {
        const post = new THREE.Mesh(this.geos.headframeStrut, this.coal.materials.rivetedIron);
        post.position.set(ox, 0, oz);
        post.castShadow = true;
        braceGroup.add(post);
      });
    });
    block.mesh.add(braceGroup);
    block.customAttach = braceGroup;
  }

  /**
   * Mounts the iconic spoked cast-steel Headframe Pulley Wheel (Molette), A-frame axle cradle,
   * and descending hoist cable right on top of the Chevalement tower!
   */
  _attachHeadframePulleyAssembly(block) {
    const assembly = new THREE.Group();

    // Base steel pillow-block pedestal resting flush on Tier 3 truss
    const base = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.96, 0.16, BLOCK_D * 0.88)),
      this.coal.materials.rivetedIron
    );
    base.position.y = -BLOCK_H * 0.36;
    base.castShadow = true;
    assembly.add(base);

    // Twin A-frame bearing supports holding the pulley axle
    const legGeo = this._trackGeo(new THREE.BoxGeometry(0.1, 0.88, 0.12));
    [-0.28, 0.28].forEach((ox) => {
      const leg = new THREE.Mesh(legGeo, this.coal.materials.rivetedIron);
      leg.position.set(ox, 0.1, 0);
      leg.castShadow = true;
      assembly.add(leg);
    });

    // Spinning Spoked Steel Pulley Wheel (Molette)
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(0, 0.44, 0);

    const rim = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(0.56, 0.07, 10, 24)),
      this.coal.materials.pulleySteel
    );
    rim.rotation.y = Math.PI / 2;
    rim.castShadow = true;
    wheelPivot.add(rim);

    const hub = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10)),
      this.coal.materials.rustAccent
    );
    hub.rotation.z = Math.PI / 2;
    wheelPivot.add(hub);

    const spokeGeo = this._trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 1.08, 6));
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(spokeGeo, this.coal.materials.steelRail);
      spoke.rotation.x = (s / 4) * Math.PI;
      wheelPivot.add(spoke);
    }

    assembly.add(wheelPivot);
    this.pulleyWheels.push(wheelPivot);

    // Steel hoist cable dropping vertically down from the pulley into the dark mine shaft
    const cable = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 2.55, 6)),
      this.coal.materials.steelRail
    );
    cable.position.set(0, -0.82, 0.32);
    assembly.add(cable);

    // Hide the raw preview torus so our detailed spinning Molette assembly shines cleanly
    block.mesh.geometry = this._trackGeo(new THREE.BoxGeometry(0.01, 0.01, 0.01));
    block.mesh.add(assembly);
    block.customAttach = assembly;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyCoalMinePieceVisual(block, slot.pieceType, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const dustMat =
      slot.pieceType === 'brick' || slot.pieceType === 'brick_window' || slot.pieceType === 'smokestack'
        ? this.mats.dustBrick
        : slot.pieceType === 'headframe' || slot.pieceType === 'pulley_wheel' || slot.pieceType === 'roof_zinc'
          ? this.mats.dustSteel
          : this.mats.dustCoal;

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
   * 7. COMPLETION CELEBRATION (+240 OR, +30 ÉCLATS, GOLDEN SPARKS & STEAM PLUMES)
   * ========================================================================== */
  _triggerCompletionSequence() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    const pc = this.pyramidCenter;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(pc.x, FOUNDATION_Y + 3.6, pc.z);

    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.48, 1.65, 6.8, 18, 1, true));
    innerGeo.translate(0, 2.8, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffd98a,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.84, 2.3, 6.4, 18, 1, true));
    outerGeo.translate(0, 2.6, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffb85c,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.76, 1.52, 28));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffde88,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.35;
    this.victoryGroup.add(this.victoryHalo);

    this.root.add(this.victoryGroup);

    // Burst of celebratory golden foundry sparks & industrial white steam
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 2.8, pc.z), {
      count: 26,
      material: this.mats.goldenSpark,
      speed: 3.6,
      upSpeed: 4.5,
      scale: 0.9,
      life: 1.15,
    });
    this._spawnParticles(this.smokestackTopPos, {
      count: 16,
      material: this.mats.steamPuff,
      speed: 1.4,
      upSpeed: 2.8,
      scale: 1.65,
      life: 1.4,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level6CoalMine.meta.id,
        focusPoint: new THREE.Vector3(pc.x, FOUNDATION_Y + 2.1, pc.z),
        rewardCoins: 240,
        firstCompletionTokens: 30,
      });
    }
  }

  /* ============================================================================
   * 8. REAL-TIME ANIMATION LOOP (MINECART WHEELS, SPINNING MOLETTES, STEAM & WIND)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Spin flanged cast-iron minecart wheels proportional to track travel
    for (let i = 0; i < this.minecartWheels.length; i++) {
      const s = this.minecartWheels[i];
      const delta = s.progress - (s.prevProgress ?? s.progress);
      s.prevProgress = s.progress;
      if (Math.abs(delta) > 0.00005 && s.wheels) {
        const spin = delta * 18.0;
        for (let w = 0; w < s.wheels.length; w++) {
          if (s.axis === 'z') s.wheels[w].rotation.x += spin;
          else s.wheels[w].rotation.z -= spin;
        }
      }
    }

    // 2. Continuously spin the twin spoked steel headframe pulley wheels (molettes)
    const wheelSpeed = this.isComplete ? 2.65 : 1.15;
    for (let i = 0; i < this.pulleyWheels.length; i++) {
      this.pulleyWheels[i].rotation.x += dt * wheelSpeed * (i % 2 === 0 ? 1 : -1);
    }

    // 3. Subtle warm flicker on industrial yard lanterns
    for (let i = 0; i < this.lanternFlames.length; i++) {
      const l = this.lanternFlames[i];
      const pulse = 0.94 + Math.sin(elapsed * 5.2 + l.phase) * 0.06;
      l.mesh.scale.setScalar(pulse);
    }

    // 4. Gentle rising white steam puffs once the smokestack reaches Tier 3 or on completion
    const stackBuilt = this.activeLayer >= 2 || this.isComplete;
    if (stackBuilt) {
      this.steamAccum += dt;
      const interval = this.isComplete ? 0.24 : 0.48;
      if (this.steamAccum >= interval) {
        this.steamAccum = 0;
        this._spawnParticles(this.smokestackTopPos, {
          count: 1,
          material: this.mats.steamPuff,
          speed: 0.45,
          upSpeed: 1.55,
          gravity: -0.35,
          scale: 1.35,
          life: 1.35,
        });
      }
    }
  }

  dispose() {
    this.minecartWheels.length = 0;
    this.pulleyWheels.length = 0;
    this.lanternFlames.length = 0;
    this.steamPuffs.length = 0;
    super.dispose();
  }
}
