/**
 * Workd Builder — Level 7: Modern Contemporary Era — "La Villa Moderne (Brique, Béton Blanc & Verre)" (54 Blocks)
 * Sculpted 128x128 Contemporary Landscaped Terrain featuring:
 *  - Manicured terraced suburban/coastal hills around the perimeter, white-limestone & terracotta-clay
 *    quarry pit in the North-West, sleek turquoise Infinity Swimming Pool & honey-teak sun-deck in the
 *    North-East, and flat compacted architectural construction pads
 *  - Multi-layer crisp PBR splatting (Manicured Vibrant Lawn Grass, Smooth Poured Concrete Driveway &
 *    Slate Stepping-Stone Walkway, Crushed White Aggregate & Red Clay Quarry Dust, Warm Teak Sun-Deck)
 *    + cozy Outlanders instanced 3D lawn tufts, white garden pebbles, ornamental blooms & soft AO shadows
 *  - Stylized 3D olive & columnar cypress trees, trimmed ornamental hedges, and glowing warm garden bollards
 *  - 4-Station Tactile Logistics Loop:
 *      1) Zone 1 — La Carrière d'Argile, Calcaire Blanc & Sable Siliceux (NW): stepped limestone & clay cliff
 *      2) Zone 2 — Les Chariots de Chantier sur Rails (W & Center): steel-and-timber flatbeds with yellow-black levers
 *      3) Zone 3 — L'Atelier de Préfabrication Moderne (SW): recessed/open-front cantilevered roof (raycast disabled)
 *      4) Zone 4 — Chantier de la Villa Moderne (East — 54 Zero-Gap Connected Blocks across 4 Tiers):
 *           Tier 1 (18): Dalle en Béton Blanc & Terrasse Piscine
 *           Tier 2 (16): Rez-de-Chaussée : Murs en Brique & Grandes Baies Vitrées
 *           Tier 3 (12): Étage en Porte-à-Faux : Béton Blanc & Verre + Garde-Corps Vitrés
 *           Tier 4 (8):  Toit-Terrasse Plat, Pergola & Brise-Soleil
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
  createOrganicFoliageBlobGeo,
  buildStylizedRomanCypress,
  createRootedTrunk,
  createMatteFoliageMaterial,
} from '../foliageAndGround.js';

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const VILLA_STEP = BLOCK_W; // Exact zero-gap grid step matching outer block width/depth
const VILLA_CENTER = new THREE.Vector3(3.45, 0, -0.72);
const FOUNDATION_Y = 0.28;

const TERRAIN_W = 20.5;
const TERRAIN_D = 19.5;
const TERRAIN_SEGS = 128;
const POOL_WATER_Y = -0.14;

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
 * Unified 128x128 sculpted Contemporary Landscaped Terrain heightfield:
 *  - Manicured terraced coastal/suburban hills around the North, West & East perimeter
 *  - Excavated white-limestone & terracotta-clay quarry pit in North-West
 *  - Sleek sunken Infinity Swimming Pool & wooden sun-deck plateau in North-East
 *  - Flat compacted architectural construction pads for Workshop, Tracks, Staging & Modern Villa
 */
function sampleModernTerrainHeight(x, z) {
  let h =
    Math.sin(x * 0.22 + 0.5) * Math.cos(z * 0.24 - 0.3) * 0.14 +
    Math.sin(x * 0.42 - z * 0.32) * 0.05;

  // Manicured terraced coastal garden hills framing North, West & East edges
  const northTerrace1 = smoothstep(-5.5, -7.2, z) * 0.65;
  const northTerrace2 = smoothstep(-7.4, -9.2, z) * 0.72;
  const westHill = smoothstep(-7.0, -9.8, x) * 0.58;
  const eastHill = smoothstep(7.8, 10.0, x) * 0.44;
  const southLip = smoothstep(7.4, 9.5, z) * 0.24;
  h += northTerrace1 + northTerrace2 + westHill + eastHill + southLip;

  // Excavated white limestone & red-clay quarry pit in North-West
  const pitDist = Math.hypot((x + 5.1) * 0.86, (z + 4.95) * 1.08);
  h -= (1.0 - smoothstep(1.25, 3.05, pitDist)) * 0.42;

  // Rectangular sunken Infinity Swimming Pool basin in North-East (x: 5.5..8.9, z: -7.1..-4.3)
  const poolMask = rectFlatMask(x, z, 7.25, -5.75, 1.45, 1.05, 0.45);
  h = h * (1.0 - poolMask) + -0.58 * poolMask;

  // Flat poolside sun-deck surround & architectural construction pads
  const flatMask = clamp01(
    Math.max(
      rectFlatMask(x, z, 7.15, -5.65, 2.35, 1.85, 1.15) * (1.0 - poolMask), // Teak pool sun-deck
      rectFlatMask(x, z, -4.6, -3.25, 2.45, 1.35, 1.35), // Quarry output pad
      rectFlatMask(x, z, -4.6, 4.35, 2.4, 2.0, 1.4), // Modern Prefab Workshop pad
      rectFlatMask(x, z, 3.6, 4.45, 2.15, 1.45, 1.35), // Staging pad
      rectFlatMask(x, z, VILLA_CENTER.x, VILLA_CENTER.z, 3.45, 3.15, 1.35), // Modern Villa Site
      rectFlatMask(x, z, -4.55, 0.3, 1.35, 3.55, 1.25), // Track A corridor
      rectFlatMask(x, z, 0.4, 4.65, 3.35, 1.35, 1.25) // Track B corridor
    )
  );
  h *= 1.0 - flatMask * 0.96;

  // Clean beveled island rim
  const rimT = Math.max(smoothstep(9.5, 10.2, Math.abs(x)), smoothstep(8.9, 9.6, Math.abs(z)));
  h -= rimT * 0.22;
  return h;
}

/**
 * 4-Biome Contemporary Villa Terrain Splat Weights:
 *   w0 = Manicured Vibrant Coastal Lawn Grass (surrounding garden hills & edges)
 *   w1 = Smooth Poured Concrete Driveway & Slate Stepping-Stone Walkway (tracks & villa approach)
 *   w2 = Crushed White Aggregate & Red-Clay Quarry Dust (NW quarry & SW prefab workshop)
 *   w3 = Warm Honey-Teak Poolside Sun-Deck (NE infinity swimming pool terrace)
 */
function computeModernSplatWeights(x, z) {
  // Biome 2: Crushed white limestone aggregate & terracotta red-clay quarry dust
  const quarryZone = 1.0 - smoothstep(2.2, 4.4, Math.hypot(x + 4.8, z + 4.6));
  const wsYard = rectFlatMask(x, z, -4.6, 4.4, 2.1, 1.75, 1.2) * 0.86;
  const wQuarry = clamp01(Math.max(quarryZone, wsYard));

  // Biome 1: Smooth poured concrete driveway & architectural walkway beneath tracks & villa site
  const dTrackA = segmentDist(x, z, -4.6, -2.6, -4.6, 2.8);
  const dTrackB = segmentDist(x, z, -2.5, 4.75, 3.6, 4.75);
  const dConnector = segmentDist(x, z, 3.6, 2.1, 3.6, 4.75);
  const dGardenWalk = segmentDist(x, z, -1.3, 0.2, 1.1, 0.2);
  const pathDist = Math.min(dTrackA, dTrackB, dConnector, dGardenWalk * 1.15);
  const villaPad = rectFlatMask(x, z, VILLA_CENTER.x, VILLA_CENTER.z, 3.05, 2.75, 1.25) * 0.94;
  const wConcrete = clamp01(Math.max(1.0 - smoothstep(0.85, 1.95, pathDist), villaPad));

  // Biome 3: Warm honey-teak poolside sun-deck around NE infinity pool
  const wTeak = rectFlatMask(x, z, 7.15, -5.65, 2.25, 1.75, 0.9);

  // Biome 0: Manicured vibrant lawn grass across surrounding terraced garden slopes
  const used = clamp01(wQuarry * 0.94 + wConcrete * 0.92 + wTeak * 0.95);
  let w0 = Math.max(0.05, 1.0 - used);
  let w1 = wConcrete * (1.0 - wTeak * 0.65);
  let w2 = wQuarry * (1.0 - wConcrete * 0.48);
  let w3 = wTeak;

  // Crisp Outlanders-style transition sharpening (w * w)
  w0 *= w0;
  w1 *= w1;
  w2 *= w2;
  w3 *= w3;
  const sum = w0 + w1 + w2 + w3 || 1;
  return [w0 / sum, w1 / sum, w2 / sum, w3 / sum];
}

/**
 * Generates a stylized sculpted Mediterranean Olive Tree (gnarled rooted trunk + silvery-olive canopy puffs).
 */
function buildSculptedOliveTree({ x, z, groundY, scale = 1.0, seed = 701, barkMat, foliageMat, trackGeo }) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.04, z);
  tree.rotation.y = (seed % 7) * 0.9;

  const trunkGroup = createRootedTrunk({
    height: 1.05 * scale,
    topR: 0.075 * scale,
    botR: 0.145 * scale,
    rootCount: 4,
    rootSpread: 0.28 * scale,
    rootHeight: 0.24 * scale,
    barkMat,
    trackGeo,
  });
  tree.add(trunkGroup);

  const crown = new THREE.Group();
  crown.position.y = 0.98 * scale;
  const puffs = [
    [0.0, 0.22, 0.0, 0.54, 0.36, 0.52, seed + 11],
    [-0.3, 0.08, 0.16, 0.38, 0.28, 0.36, seed + 23],
    [0.28, 0.12, -0.14, 0.39, 0.29, 0.38, seed + 37],
    [0.08, 0.42, 0.08, 0.36, 0.24, 0.34, seed + 53],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pz, rx, ry, rz, s] = puffs[i];
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: 1.0,
        detail: 1,
        squashY: 0.85,
        irregularity: 0.18,
        seed: s,
        baseColor: '#3f6236',
        midColor: '#6f9254',
        topColor: '#b7ce88',
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.scale.set(rx * scale, ry * scale, rz * scale);
    mesh.position.set(px * scale, py * scale, pz * scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  }
  tree.add(crown);
  return { tree, crown };
}

export class Level7Modern extends Level1Pyramid {
  static meta = {
    id: 'level7_modern',
    title: 'Niveau 7 : La Villa Moderne',
    hudLabel: 'Villa Moderne',
    totalGoal: 54,
    rewardCoins: 280,
    rewardTokens: 35,
  };

  constructor(options) {
    super(options);
  }

  _beforeBuild() {
    this.modern = this.textures.ensureModernPack();
    this.cartWheels = [];
    this.bollardLights = [];
    this.poolWaterMesh = null;
    this.cozyFoliageSystem = null;
    this.balconyRailGroup = null;
    this.slotGridMap = new Map();
    this.shimmerSparkTimer = 0;
  }

  _initSharedGeometries() {
    super._initSharedGeometries();
    this.geos.rawBlock = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.94, BLOCK_H * 0.94, BLOCK_D * 0.94));
    this.geos.carvedBlock = this._trackGeo(new THREE.BoxGeometry(BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.slabRoof = this._trackGeo(new THREE.BoxGeometry(BLOCK_W, BLOCK_H * 0.44, BLOCK_D));
    this.geos.ghostBox = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.97, BLOCK_H * 0.97, BLOCK_D * 0.97));
    this.geos.ghostBoxEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostBox));
    this.geos.louverSlat = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 0.96, 0.055, 0.085));
    this.geos.fasciaTrim = this._trackGeo(new THREE.BoxGeometry(BLOCK_W * 1.01, 0.09, BLOCK_D * 1.01));
    this.geos.glassMullionBar = this._trackGeo(new THREE.BoxGeometry(0.055, BLOCK_H * 1.01, 0.055));
    this.geos.cartWheel = this._trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14));
    this.geos.cartWheel.rotateZ(Math.PI / 2);

    // Contemporary construction particle dust & sunlit glass shimmer materials
    this.mats.dustConcrete = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf1eee7, transparent: true, opacity: 0.86 })
    );
    this.mats.dustBrick = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xb6573b, transparent: true, opacity: 0.84 })
    );
    this.mats.dustGlass = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xa8e8ff, transparent: true, opacity: 0.82 })
    );
    this.mats.sunSpark = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffe88c, transparent: true, opacity: 0.94 })
    );
    this.mats.oliveTrunk = this._trackMat(
      new THREE.MeshStandardMaterial({ color: '#6f5c4a', roughness: 0.92, metalness: 0.02 })
    );
    this.mats.modernFoliage = this._trackMat(createMatteFoliageMaterial());
  }

  getTerrainHeight(x, z) {
    return sampleModernTerrainHeight(x, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 LANDSCAPED TERRAIN, INFINITY POOL & GARDEN DIORAMA
   * ========================================================================== */
  _buildDioramaBase() {
    const diorama = new THREE.Group();

    const terrainGeo = this._trackGeo(
      new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEGS, TERRAIN_SEGS)
    );
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const count = posAttr.count;
    const wAttr = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = sampleModernTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      const [w0, w1, w2, w3] = computeModernSplatWeights(vx, vz);
      wAttr[i * 4] = w0;
      wAttr[i * 4 + 1] = w1;
      wAttr[i * 4 + 2] = w2;
      wAttr[i * 4 + 3] = w3;
    }
    terrainGeo.setAttribute('aSplatWeights', new THREE.BufferAttribute(wAttr, 4));
    terrainGeo.computeVertexNormals();

    // Unified 4-layer crisp PBR splatting shader (roughness: 0.9, metalness: 0.0)
    const splatMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: this.modern.materials.terrainLawn.map,
        normalMap: this.modern.materials.terrainLawn.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.9,
        metalness: 0.0,
      })
    );
    splatMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTexConcrete = { value: this.modern.materials.terrainConcrete.map };
      shader.uniforms.uTexQuarry = { value: this.modern.materials.terrainQuarry.map };
      shader.uniforms.uTexTeak = { value: this.modern.materials.terrainTeak.map };
      shader.uniforms.uTileScale = { value: 6.2 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute vec4 aSplatWeights;
           varying vec4 vSplatWeights;
           varying vec3 vWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vSplatWeights = aSplatWeights;
           vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D uTexConcrete;
           uniform sampler2D uTexQuarry;
           uniform sampler2D uTexTeak;
           uniform float uTileScale;
           varying vec4 vSplatWeights;
           varying vec3 vWorldPos;`
        )
        .replace(
          '#include <map_fragment>',
          `vec2 tiledUv = vMapUv * uTileScale;
           vec4 cLawn = texture2D(map, tiledUv);
           vec4 cConc = texture2D(uTexConcrete, tiledUv * 1.15);
           vec4 cQuar = texture2D(uTexQuarry, tiledUv * 1.1);
           vec4 cTeak = texture2D(uTexTeak, tiledUv * 1.35);
           vec4 w = vSplatWeights;
           float microVar = sin(vWorldPos.x * 0.9 + vWorldPos.z * 0.7) * 0.035;
           cLawn.rgb *= vec3(1.0 + microVar, 1.0 + microVar * 0.8, 1.0 - microVar * 0.5);
           vec4 blended = cLawn * w.x + cConc * w.y + cQuar * w.z + cTeak * w.w;
           diffuseColor *= blended;`
        );
    };

    const terrainMesh = new THREE.Mesh(terrainGeo, splatMat);
    terrainMesh.receiveShadow = true;
    diorama.add(terrainMesh);
    this.terrainMesh = terrainMesh;

    // Geological plinth side skirt (white limestone & red-clay strata via MaterialFactory)
    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(TERRAIN_W - 0.08, 1.9, TERRAIN_D - 0.08));
    this.plinthMesh = new THREE.Mesh(
      plinthGeo,
      this._trackMat(new THREE.MeshStandardMaterial({ color: '#cfc7ba', roughness: 0.88, metalness: 0.02 }))
    );
    this.plinthMesh.position.y = -1.16;
    this.plinthMesh.receiveShadow = true;
    diorama.add(this.plinthMesh);

    // 1. Sleek Turquoise Infinity Swimming Pool & Sun-Deck in North-East
    this._buildInfinityPool(diorama);

    // 2. Contemporary Garden Trees (Olive & Cypress), Trimmed Hedges & Glowing Garden Bollards
    this._buildGardenLandscaping(diorama);

    // 3. Cozy Outlanders-style Instanced 3D Lawn Tufts, White Pebbles & Ornamental Blooms
    const focalPoints = [
      ...(this._treeAnchors || []).map((t) => ({ x: t.x, z: t.z, innerRadius: 0.34, radius: 1.9 })),
      { x: 5.2, z: -5.6, innerRadius: 0.35, radius: 1.85 },
      { x: 7.4, z: -3.2, innerRadius: 0.35, radius: 1.85 },
    ];
    this.cozyFoliageSystem = createCozyGroundFoliageSystem({
      parent: diorama,
      getTerrainHeight: (x, z) => sampleModernTerrainHeight(x, z),
      isBlocked: (x, z) => {
        if (this._isBlockedForFoliage(x, z)) return true;
        if (rectFlatMask(x, z, VILLA_CENTER.x, VILLA_CENTER.z, 3.2, 2.9, 0.45) > 0.25) return true;
        if (rectFlatMask(x, z, 7.15, -5.7, 2.5, 2.0, 0.35) > 0.25) return true;
        return false;
      },
      getGrassWeight: (x, z) => {
        const [wLawn, wConcrete, wQuarry, wTeak] = computeModernSplatWeights(x, z);
        if (wConcrete > 0.28 || wQuarry > 0.36 || wTeak > 0.28) return 0;
        return wLawn;
      },
      focalPoints,
      waterLevel: POOL_WATER_Y,
      halfW: TERRAIN_W * 0.5,
      halfD: TERRAIN_D * 0.5,
      grassCount: 920,
      pebbleCount: 110,
      flowerCount: 82,
      grassPalette: ['#4a8c3e', '#3c7a36', '#68ad4a', '#8cc458', '#33682e'],
      pebblePalette: ['#e6e4de', '#d2cfc7', '#bfc4ca', '#f0eee8'],
      flowerPalette: ['#ffffff', '#fff7d4', '#ffe97a', '#e0f4ff'],
      seed: 707,
    });

    this.root.add(diorama);
  }

  _buildInfinityPool(parent) {
    const pool = new THREE.Group();
    const cx = 7.25;
    const cz = -5.75;
    pool.position.set(cx, 0, cz);

    // Recessed turquoise pool tile basin liner
    const liner = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.96, 0.46, 2.16)),
      this.modern.materials.poolTileLiner
    );
    liner.position.y = -0.44;
    liner.receiveShadow = true;
    pool.add(liner);

    // Crisp white architectural concrete coping frame around 3 edges (infinity edge on East!)
    const copingTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.26, 0.14, 0.24)),
      this.modern.materials.whiteConcrete
    );
    copingTop.position.set(0, -0.04, -1.16);
    copingTop.castShadow = true;
    copingTop.receiveShadow = true;
    pool.add(copingTop);

    const copingBot = copingTop.clone();
    copingBot.position.set(0, -0.04, 1.16);
    pool.add(copingBot);

    const copingWest = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.24, 0.14, 2.56)),
      this.modern.materials.whiteConcrete
    );
    copingWest.position.set(-1.52, -0.04, 0);
    copingWest.castShadow = true;
    copingWest.receiveShadow = true;
    pool.add(copingWest);

    // Sleek infinity weir lip on East edge
    const weirLip = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.1, 0.12, 2.34)),
      this.modern.materials.darkAluminum
    );
    weirLip.position.set(1.5, -0.09, 0);
    pool.add(weirLip);

    // Animated sparkling turquoise infinity pool surface
    const waterGeo = this._trackGeo(new THREE.PlaneGeometry(2.96, 2.16, 12, 10));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.modern.materials.infinityPoolWater);
    water.position.y = POOL_WATER_Y;
    water.receiveShadow = true;
    pool.add(water);
    this.poolWaterMesh = water;

    // Warm Honey-Teak Sun-Deck terrace apron alongside the pool
    const deck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.42, 0.12, 2.86)),
      this.modern.materials.teakDeck
    );
    deck.position.set(-2.28, -0.01, 0.08);
    deck.castShadow = true;
    deck.receiveShadow = true;
    pool.add(deck);

    // Pair of sleek contemporary white-and-teak poolside sun loungers
    [-0.58, 0.64].forEach((lz) => {
      const lounger = new THREE.Group();
      lounger.position.set(-2.26, 0.08, lz);
      const frame = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.86, 0.07, 0.42)),
        this.modern.materials.teakDeck
      );
      frame.castShadow = true;
      lounger.add(frame);

      const pad = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.82, 0.055, 0.38)),
        this.modern.materials.whiteConcrete
      );
      pad.position.y = 0.05;
      lounger.add(pad);

      const backrest = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.28, 0.055, 0.38)),
        this.modern.materials.whiteConcrete
      );
      backrest.position.set(-0.34, 0.14, 0);
      backrest.rotation.z = -0.52;
      lounger.add(backrest);
      pool.add(lounger);
    });

    parent.add(pool);
  }

  _buildGardenLandscaping(parent) {
    const garden = new THREE.Group();
    const aoEntries = [];
    this._treeAnchors = [];

    // Stylized Mediterranean Olive Trees framing the contemporary villa garden
    const oliveSpots = [
      [-8.2, -7.2, 1.05, 701],
      [-8.5, 0.6, 0.96, 709],
      [-7.9, 7.6, 1.08, 719],
      [0.6, -7.8, 1.12, 727],
      [8.3, 2.4, 1.02, 733],
      [7.6, 7.4, 0.98, 743],
    ];
    oliveSpots.forEach(([tx, tz, sc, seed]) => {
      const ty = sampleModernTerrainHeight(tx, tz);
      const built = buildSculptedOliveTree({
        x: tx,
        z: tz,
        groundY: ty,
        scale: sc,
        seed,
        barkMat: this.mats.oliveTrunk,
        foliageMat: this.mats.modernFoliage,
        trackGeo: (g) => this._trackGeo(g),
      });
      this.palmFronds.push({ group: built.crown, phase: tx * 0.55 + tz * 0.45 });
      garden.add(built.tree);
      this._treeAnchors.push({ x: tx, z: tz });
      aoEntries.push({ x: tx, z: tz, radius: 1.08 * sc, strength: 0.9 });
    });

    // Sleek Columnar Cypress Trees along the northern terrace & driveway edge
    const cypressSpots = [
      [-2.1, -7.6, 1.06, 751],
      [-1.1, -8.1, 0.92, 757],
      [2.5, -7.9, 1.02, 761],
      [3.6, -8.2, 0.88, 769],
      [8.8, -1.8, 1.0, 773],
      [8.9, -0.4, 0.9, 787],
      [-8.6, 4.4, 0.94, 797],
    ];
    cypressSpots.forEach(([tx, tz, sc, seed]) => {
      const ty = sampleModernTerrainHeight(tx, tz);
      const built = buildStylizedRomanCypress({
        x: tx,
        z: tz,
        groundY: ty,
        scale: sc,
        seed,
        barkMat: this.mats.oliveTrunk,
        foliageMat: this.mats.modernFoliage,
        trackGeo: (g) => this._trackGeo(g),
      });
      this.palmFronds.push({ group: built.crown, phase: tx * 0.45 + tz * 0.65 });
      garden.add(built.tree);
      this._treeAnchors.push({ x: tx, z: tz });
      aoEntries.push({ x: tx, z: tz, radius: 0.72 * sc, strength: 0.88 });
    });

    // Trimmed architectural boxwood hedges along the villa approach & garden terraces
    const hedges = [
      [0.3, -3.55, 2.2, 0.48, 0.44],
      [7.4, 0.65, 0.46, 0.48, 2.3],
      [-1.3, 6.95, 2.6, 0.45, 0.46],
      [5.5, 6.95, 2.3, 0.45, 0.46],
    ];
    hedges.forEach(([hx, hz, hw, hh, hd]) => {
      const hy = sampleModernTerrainHeight(hx, hz);
      const hedge = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(hw, hh, hd)),
        this.modern.materials.hedgeGreen
      );
      hedge.position.set(hx, hy + hh * 0.44, hz);
      hedge.castShadow = true;
      hedge.receiveShadow = true;
      garden.add(hedge);
    });

    // Sleek dark-aluminum architectural Garden Bollards with warm LED glow strips
    const bollardCoords = [
      [-2.2, 2.85],
      [0.15, 2.85],
      [1.85, 2.45],
      [5.2, 2.45],
      [4.9, -3.55],
      [-2.2, -2.9],
    ];
    const postGeo = this._trackGeo(new THREE.BoxGeometry(0.11, 0.46, 0.11));
    const glowGeo = this._trackGeo(new THREE.BoxGeometry(0.118, 0.085, 0.118));
    bollardCoords.forEach(([bx, bz], idx) => {
      const by = sampleModernTerrainHeight(bx, bz);
      const bollard = new THREE.Group();
      bollard.position.set(bx, by, bz);

      const post = new THREE.Mesh(postGeo, this.modern.materials.darkAluminum);
      post.position.y = 0.23;
      post.castShadow = true;
      bollard.add(post);

      const led = new THREE.Mesh(glowGeo, this.modern.materials.bollardGlow);
      led.position.y = 0.38;
      bollard.add(led);
      this.bollardLights.push({ mesh: led, phase: idx * 1.15 });

      garden.add(bollard);
    });

    // Crisp slate stepping stones across the central lawn shortcut
    const stepGeo = this._trackGeo(new THREE.BoxGeometry(0.68, 0.06, 0.42));
    for (let i = 0; i < 4; i++) {
      const sx = -1.15 + i * 0.72;
      const sz = 0.25 + Math.sin(i * 0.9) * 0.12;
      const sy = sampleModernTerrainHeight(sx, sz);
      const stone = new THREE.Mesh(stepGeo, this.modern.materials.darkAluminum);
      stone.position.set(sx, sy + 0.02, sz);
      stone.receiveShadow = true;
      garden.add(stone);
    }

    // Soft circular AO contact shadows under trees, quarry, workshop & modern villa
    aoEntries.push(
      { x: -4.7, z: -5.2, radiusX: 3.2, radiusZ: 1.5, strength: 0.68 },
      { x: -4.6, z: 4.35, radiusX: 2.35, radiusZ: 2.05, strength: 0.68 },
      { x: VILLA_CENTER.x, z: VILLA_CENTER.z, radiusX: 3.15, radiusZ: 2.85, strength: 0.76 }
    );
    this.contactShadows = createContactShadowSystem(garden, aoEntries, (x, z) =>
      sampleModernTerrainHeight(x, z)
    );

    parent.add(garden);
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE D'ARGILE, CALCAIRE BLANC & SABLE SILICEUX (NW)
   * ========================================================================== */
  _buildQuarryStation() {
    const qGroup = new THREE.Group();
    const qBaseY = sampleModernTerrainHeight(-4.8, -5.0);

    // Stepped white limestone & terracotta red-clay stratified quarry cliff
    const ledges = [
      { pos: [-5.1, qBaseY + 0.38, -6.35], size: [5.4, 0.85, 1.55], mat: this.modern.materials.quarryLimestone },
      { pos: [-5.3, qBaseY + 1.08, -6.72], size: [4.6, 0.72, 1.15], mat: this.modern.materials.quarryClay },
      { pos: [-5.0, qBaseY + 1.62, -6.95], size: [3.6, 0.54, 0.88], mat: this.modern.materials.quarryLimestone },
      { pos: [-7.05, qBaseY + 0.56, -5.05], size: [1.35, 1.05, 3.3], mat: this.modern.materials.quarryClay },
    ];
    ledges.forEach((l) => {
      const mesh = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(...l.size)), l.mat);
      mesh.position.set(...l.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      qGroup.add(mesh);
    });

    // Sleek yellow-and-black steel quarry sign & material sample shelter frame
    const frameL = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.11, 1.65, 0.11)),
      this.modern.materials.darkAluminum
    );
    frameL.position.set(-6.55, qBaseY + 0.82, -5.35);
    frameL.castShadow = true;
    frameL.raycast = () => {};
    qGroup.add(frameL);

    const frameR = frameL.clone();
    frameR.position.set(-2.95, qBaseY + 0.82, -5.35);
    frameR.raycast = () => {};
    qGroup.add(frameR);

    const crossBeam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.8, 0.12, 0.12)),
      this.modern.materials.safetyYellow
    );
    crossBeam.position.set(-4.75, qBaseY + 1.66, -5.35);
    crossBeam.castShadow = true;
    crossBeam.raycast = () => {};
    qGroup.add(crossBeam);

    // 3 Extractable Raw Architectural Material Nodes (White Limestone, Red Clay & Silica Aggregate)
    const nodeCoords = [
      [-5.95, -4.75],
      [-4.65, -4.65],
      [-3.35, -4.75],
    ];
    const nodeGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.64, 1));
    const hitSphereGeo = this._trackGeo(new THREE.SphereGeometry(0.76, 8, 8));
    const hitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    nodeCoords.forEach(([nx, nz], idx) => {
      const ny = sampleModernTerrainHeight(nx, nz);
      const g = new THREE.Group();
      g.position.set(nx, ny + 0.54, nz);

      const nodeMat =
        idx === 1 ? this.modern.materials.quarryClay : this.modern.materials.quarryLimestone;
      const core = new THREE.Mesh(nodeGeo, nodeMat);
      core.scale.set(1.08, 0.88, 0.96);
      core.rotation.set(0.22 * idx, 0.95 * idx, 0.16);
      core.castShadow = true;
      core.receiveShadow = true;
      g.add(core);

      const sub = new THREE.Mesh(
        this._trackGeo(new THREE.DodecahedronGeometry(0.32, 0)),
        idx === 1 ? this.modern.materials.quarryLimestone : this.modern.materials.quarryClay
      );
      sub.position.set(0.34 * (idx % 2 === 0 ? 1 : -1), -0.18, 0.24);
      sub.castShadow = true;
      g.add(sub);

      const hitbox = new THREE.Mesh(hitSphereGeo, hitMat);
      g.add(hitbox);
      qGroup.add(g);

      const nodeObj = {
        index: idx,
        id: `modern_quarry_${idx}`,
        group: g,
        mesh: core,
        basePos: new THREE.Vector3(nx, ny + 0.54, nz),
        baseScale: new THREE.Vector3(1.08, 0.88, 0.96),
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

    // Quarry Output Staging Pad (5 distinct ground slots directly ahead of the mineral nodes)
    // Raycast disabled on decorative pad so stored raw blocks are 100% unobstructed on touch!
    const outPadY = sampleModernTerrainHeight(-4.6, -3.28);
    const outPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.45, 0.14, 1.42)),
      this.modern.materials.whiteConcrete
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
    return this.modern.materials.rawAggregate;
  }

  /* ============================================================================
   * 3. ZONE 2 — LES CHARIOTS DE CHANTIER SUR RAILS (STEEL & YELLOW-BLACK LEVERS)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();

    // Reskin tracks & sleds into modern brushed-steel guided tracks & sleek steel-and-timber flatbeds
    const railMat = this.modern.materials.brushedSteel;
    const frameMat = this.modern.materials.darkAluminum;
    const deckMat = this.modern.materials.teakDeck;
    const yellowMat = this.modern.materials.safetyYellow;

    for (let i = 0; i < this.sleds.length; i++) {
      const sled = this.sleds[i];
      const g = sled.group;
      if (!g) continue;

      g.traverse((child) => {
        if (!child.isMesh) return;
        // Preserve invisible generous touch hitboxes!
        if (!child.visible || (child.material && child.material.visible === false)) return;
        if (child.userData && child.userData.interact && child.userData.interact.type === 'sled-lever') {
          child.material = yellowMat;
        } else {
          child.material = frameMat;
        }
      });

      // Add warm honey-teak flatbed deck plate cleanly above frame (zero z-fighting)
      const isTrackA = sled.axis === 'z';
      const deckW = isTrackA ? 3.16 : 1.08;
      const deckD = isTrackA ? 1.08 : 3.16;
      const flatbed = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(deckW, 0.06, deckD)),
        deckMat
      );
      flatbed.position.y = 0.255;
      flatbed.castShadow = true;
      flatbed.receiveShadow = true;
      g.add(flatbed);

      // Sleek yellow-and-black industrial safety rail bumpers on cart ends
      const bumperGeo = this._trackGeo(
        new THREE.BoxGeometry(isTrackA ? deckW + 0.04 : 0.12, 0.08, isTrackA ? 0.12 : deckD + 0.04)
      );
      [-1, 1].forEach((side) => {
        const bumper = new THREE.Mesh(bumperGeo, yellowMat);
        if (isTrackA) bumper.position.set(0, 0.22, side * (deckD * 0.5 + 0.03));
        else bumper.position.set(side * (deckW * 0.5 + 0.03), 0.22, 0);
        g.add(bumper);
      });

      // Yellow-and-black industrial lever handle accent on the visible lever knob
      if (sled.leverMesh) {
        sled.leverMesh.material = yellowMat;
      }

      // 4 Rotating Steel Wheels mounted underneath the cart
      const wheelOffsets = isTrackA
        ? [[-1.18, -0.42], [1.18, -0.42], [-1.18, 0.42], [1.18, 0.42]]
        : [[-0.42, -1.18], [0.42, -1.18], [-0.42, 1.18], [0.42, 1.18]];
      wheelOffsets.forEach(([wx, wz]) => {
        const w = new THREE.Mesh(this.geos.cartWheel, railMat);
        w.position.set(wx, 0.06, wz);
        if (!isTrackA) w.rotation.y = Math.PI / 2;
        w.castShadow = true;
        g.add(w);
        this.cartWheels.push({ mesh: w, sled, lastCoord: isTrackA ? g.position.z : g.position.x });
      });
    }
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DE PRÉFABRICATION MODERNE (OPEN-TOP VISIBILITY)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const wx = -4.6;
    const wz = 4.35;
    const wy = sampleModernTerrainHeight(wx, wz);

    // Smooth poured white-concrete workshop foundation slab
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.35, 0.16, 3.65)),
      this.modern.materials.whiteConcrete
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.castShadow = true;
    ws.add(floor);

    // Architectural warm modern brick accent back wall (behind workbench, never blocks view)
    const backWall = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.2, 1.75, 0.24)),
      this.modern.materials.modernBrick
    );
    backWall.position.set(wx, wy + 0.95, wz - 1.66);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    ws.add(backWall);

    // Sleek dark-aluminum H-beam steel corner columns
    const colGeo = this._trackGeo(new THREE.BoxGeometry(0.14, 1.98, 0.14));
    [
      [wx - 2.04, wz - 1.64],
      [wx + 2.04, wz - 1.64],
      [wx - 2.04, wz - 0.56],
      [wx + 2.04, wz - 0.56],
    ].forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeo, this.modern.materials.darkAluminum);
      col.position.set(cx, wy + 1.06, cz);
      col.castShadow = true;
      ws.add(col);
    });

    // OPEN-TOP / RECESSED CANTILEVERED ROOF: covers ONLY rear ~34% edge behind the workbench
    // All canopy meshes disable raycast so tapping/dragging the workbench block is 100% unobstructed!
    const rearCanopy = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.48, 0.14, 1.24)),
      this.modern.materials.whiteConcreteRoof
    );
    rearCanopy.position.set(wx, wy + 2.1, wz - 1.18);
    rearCanopy.castShadow = true;
    rearCanopy.raycast = () => {};
    ws.add(rearCanopy);

    // Sleek dark-aluminum cantilevered pergola louver beams extending subtly on the rear rim
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(4.42, 0.06, 0.08)),
        this.modern.materials.darkAluminum
      );
      beam.position.set(wx, wy + 2.12, wz - 1.68 + i * 0.34);
      beam.raycast = () => {};
      ws.add(beam);
    }

    // Modern steel-and-concrete Prefabrication Workbench right in the open sunlit front bay
    const benchX = wx - 0.52;
    const benchZ = wz + 0.35;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.48, 0.58, 1.48)),
      this.modern.materials.darkAluminum
    );
    benchBase.position.set(benchX, wy + 0.45, benchZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.38, 0.08, 1.38)),
      this.modern.materials.brushedSteel
    );
    benchTop.position.set(benchX, wy + 0.78, benchZ);
    benchTop.receiveShadow = true;
    ws.add(benchTop);

    // Subtle yellow architectural precision laser guide corners around the anvil
    const cornerGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 0.04, 0.16));
    [
      [-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58],
    ].forEach(([ox, oz]) => {
      const c = new THREE.Mesh(cornerGeo, this.modern.materials.safetyYellow);
      c.position.set(benchX + ox, wy + 0.83, benchZ + oz);
      ws.add(c);
    });

    const wbMarker = this._createSlotMarker(ws, benchX, wy + 0.84, benchZ);
    this.workbenchSlot = {
      id: 'workbench',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(benchX, wy + 0.83 + BLOCK_H * 0.5, benchZ),
      dropIndicatorY: wy + 0.84,
      marker: wbMarker,
      occupied: false,
      block: null,
    };

    // Generous invisible carve-swipe hitbox over the prefabrication anvil (active when raw block sits on it)
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.9, 1.35, 1.9));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(benchX, wy + 1.28, benchZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Carving Progress Pips floating neatly beside the prefabrication workbench
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x9be8ff,
          emissive: 0x2ba8d9,
          emissiveIntensity: 0.65,
          roughness: 0.28,
        })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(benchX + (i - 1) * 0.36, wy + 1.98, benchZ - 0.55);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Prefab Finished Output Slots on the East side of the open workshop floor
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

    // 4 Staging Slots at the East end of Track B (next to the Modern Villa construction site)
    const stageX = 3.6;
    const stageZ = 4.45;
    const stageY = sampleModernTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.65, 0.14, 2.35)),
      this.modern.materials.whiteConcrete
    );
    stagePad.position.set(stageX, stageY + 0.07, stageZ);
    stagePad.receiveShadow = true;
    stagePad.castShadow = true;
    ws.add(stagePad);

    this.stagingSlots = [];
    [
      [3.08, 3.92],
      [4.12, 3.92],
      [3.08, 4.98],
      [4.12, 4.98],
    ].forEach(([sx, sz], idx) => {
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
   * 5. ZONE 4 — CHANTIER DE LA VILLA MODERNE (54 ZERO-GAP BLOCKS, 4 TIERS)
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidCenter = VILLA_CENTER.clone();
    this.pyramidSlots = [];
    this.slotGridMap = new Map();

    const siteGroup = new THREE.Group();
    const pc = this.pyramidCenter;

    // Subtle crisp architectural concrete base apron framing the 5x4 Villa grid
    const padW = 5 * VILLA_STEP + 0.56;
    const padD = 4 * VILLA_STEP + 0.56;
    const sitePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(padW, FOUNDATION_Y, padD)),
      this.modern.materials.terrainConcrete
    );
    sitePad.position.set(pc.x, FOUNDATION_Y * 0.5, pc.z);
    sitePad.receiveShadow = true;
    sitePad.castShadow = true;
    siteGroup.add(sitePad);

    // Subtle glowing warm interior living-room floor plate (revealed once Tier 2 ground floor begins)
    const interiorGlow = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.75, 0.04, 2.75)),
      this.modern.materials.interiorFloorGlow
    );
    interiorGlow.position.set(pc.x, FOUNDATION_Y + BLOCK_H + 0.015, pc.z - 0.15);
    interiorGlow.visible = false;
    siteGroup.add(interiorGlow);
    this.interiorGlowMesh = interiorGlow;

    const slabRoofEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.slabRoof));

    // Helper: converts integer grid coords (gx ∈ [0..4], gy ∈ [0..3], gz ∈ [0..3]) to exact flush world pos
    const gridToWorld = (gx, gy, gz, customH = BLOCK_H) => {
      const wx = pc.x + (gx - 2.0) * VILLA_STEP;
      const wz = pc.z + (gz - 1.5) * VILLA_STEP;
      const wy = FOUNDATION_Y + gy * BLOCK_H + customH * 0.5;
      return new THREE.Vector3(wx, wy, wz);
    };

    const addVillaSlot = (layer, gx, gz, pieceType) => {
      const gy = layer;
      const isSlab = pieceType === 'roof_slab' || pieceType === 'roof_pergola';
      const slotH = isSlab ? BLOCK_H * 0.44 : BLOCK_H;
      const pos = gridToWorld(gx, gy, gz, slotH);

      const ghostGroup = new THREE.Group();
      ghostGroup.position.copy(pos);

      const ghostMesh = new THREE.Mesh(
        isSlab ? this.geos.slabRoof : this.geos.ghostBox,
        this.mats.ghostNormal
      );
      const ghostLines = new THREE.LineSegments(
        isSlab ? slabRoofEdges : this.geos.ghostBoxEdges,
        this.mats.ghostLineNormal
      );
      ghostGroup.add(ghostMesh, ghostLines);
      ghostGroup.visible = layer === 0;
      siteGroup.add(ghostGroup);

      const idx = this.pyramidSlots.length;
      const slot = {
        id: `villa_slot_${idx}`,
        index: idx,
        zoneType: 'pyramid',
        accepts: ['carved', 'capstone'],
        layer,
        gridX: gx,
        gridY: gy,
        gridZ: gz,
        isCapstone: false,
        pieceType,
        position: pos,
        dropIndicatorY: FOUNDATION_Y + gy * BLOCK_H + 0.01,
        ghostGroup,
        ghostMesh,
        ghostLines,
        block: null,
      };
      this.pyramidSlots.push(slot);
      this.slotGridMap.set(`${gx},${gy},${gz}`, slot);
    };

    // ------------------------------------------------------------------------
    // TIER 1 (layer 0) — Dalle en Béton Blanc & Terrasse Piscine (18 blocks)
    // ------------------------------------------------------------------------
    for (let gz = 0; gz < 3; gz++) {
      for (let gx = 0; gx < 5; gx++) {
        addVillaSlot(0, gx, gz, 'concrete_base');
      }
    }
    // Crisp stepped South entrance terrace (3 blocks) -> 15 + 3 = 18 blocks
    for (let gx = 1; gx <= 3; gx++) {
      addVillaSlot(0, gx, 3, 'concrete_base');
    }

    // ------------------------------------------------------------------------
    // TIER 2 (layer 1) — Rez-de-Chaussée : Murs en Brique & Baies Vitrées (16 blocks)
    // ------------------------------------------------------------------------
    // North poolside facade (5 blocks: Brick corners + 3 floor-to-ceiling panoramic glass bays)
    addVillaSlot(1, 0, 0, 'brick');
    addVillaSlot(1, 1, 0, 'glass');
    addVillaSlot(1, 2, 0, 'glass');
    addVillaSlot(1, 3, 0, 'glass');
    addVillaSlot(1, 4, 0, 'brick');
    // Middle structural side walls + central contemporary brick hearth core (3 blocks)
    addVillaSlot(1, 0, 1, 'brick');
    addVillaSlot(1, 2, 1, 'brick');
    addVillaSlot(1, 4, 1, 'brick');
    // Garden-facing main living room wall (5 blocks: Brick anchors + 3 panoramic glass panels)
    addVillaSlot(1, 0, 2, 'brick');
    addVillaSlot(1, 1, 2, 'glass');
    addVillaSlot(1, 2, 2, 'glass');
    addVillaSlot(1, 3, 2, 'glass');
    addVillaSlot(1, 4, 2, 'brick');
    // South entrance pavilion (3 blocks: Glass + Brick entry + Glass) -> 5+3+5+3 = 16 blocks
    addVillaSlot(1, 1, 3, 'glass');
    addVillaSlot(1, 2, 3, 'brick');
    addVillaSlot(1, 3, 3, 'glass');

    // ------------------------------------------------------------------------
    // TIER 3 (layer 2) — Étage en Porte-à-Faux : Béton Blanc & Verre (12 blocks)
    // ------------------------------------------------------------------------
    // Cantilevered upper architectural white-concrete volume (4x3 = 12 blocks)
    // Leaves East column (gx=4) open as a sleek upper glass-railed sun balcony!
    addVillaSlot(2, 0, 0, 'concrete_upper');
    addVillaSlot(2, 1, 0, 'glass');
    addVillaSlot(2, 2, 0, 'glass');
    addVillaSlot(2, 3, 0, 'concrete_upper');

    addVillaSlot(2, 0, 1, 'glass');
    addVillaSlot(2, 1, 1, 'concrete_upper');
    addVillaSlot(2, 2, 1, 'concrete_upper');
    addVillaSlot(2, 3, 1, 'glass');

    addVillaSlot(2, 0, 2, 'concrete_upper');
    addVillaSlot(2, 1, 2, 'glass');
    addVillaSlot(2, 2, 2, 'glass');
    addVillaSlot(2, 3, 2, 'concrete_upper');

    // ------------------------------------------------------------------------
    // TIER 4 (layer 3) — Toit-Terrasse Plat, Pergola & Brise-Soleil (8 blocks)
    // ------------------------------------------------------------------------
    // North cantilevered flat white-concrete roof overhang (4 blocks)
    addVillaSlot(3, 0, 0, 'roof_slab');
    addVillaSlot(3, 1, 0, 'roof_slab');
    addVillaSlot(3, 2, 0, 'roof_slab');
    addVillaSlot(3, 3, 0, 'roof_slab');
    // Skylight side rim slabs (2 blocks)
    addVillaSlot(3, 0, 1, 'roof_slab');
    addVillaSlot(3, 3, 1, 'roof_slab');
    // South dark-aluminum Brise-Soleil Pergola louver roof slabs (2 blocks) -> 4+2+2 = 8 blocks
    addVillaSlot(3, 1, 2, 'roof_pergola');
    addVillaSlot(3, 2, 2, 'roof_pergola');

    // Wrap-around Glass Balcony Railings along the exposed East roof terrace (revealed at Tier 3!)
    this.balconyRailGroup = new THREE.Group();
    const railY = FOUNDATION_Y + 2 * BLOCK_H + 0.16;
    const eastEdgeX = pc.x + 2.46 * VILLA_STEP;
    const railEast = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.05, 0.3, 3 * VILLA_STEP - 0.06)),
      this.modern.materials.balconyGlass
    );
    railEast.position.set(eastEdgeX, railY, pc.z - 0.5 * VILLA_STEP);
    this.balconyRailGroup.add(railEast);

    const railEastTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.075, 0.045, 3 * VILLA_STEP)),
      this.modern.materials.darkAluminum
    );
    railEastTop.position.set(eastEdgeX, railY + 0.16, pc.z - 0.5 * VILLA_STEP);
    this.balconyRailGroup.add(railEastTop);

    const railNorth = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(VILLA_STEP, 0.3, 0.05)),
      this.modern.materials.balconyGlass
    );
    railNorth.position.set(pc.x + 2.0 * VILLA_STEP, railY, pc.z - 1.98 * VILLA_STEP);
    this.balconyRailGroup.add(railNorth);

    const railSouth = railNorth.clone();
    railSouth.position.set(pc.x + 2.0 * VILLA_STEP, railY, pc.z + 0.98 * VILLA_STEP);
    this.balconyRailGroup.add(railSouth);

    this.balconyRailGroup.visible = false;
    siteGroup.add(this.balconyRailGroup);

    this.root.add(siteGroup);
    this.totalGoal = this.pyramidSlots.length;
  }

  /* ============================================================================
   * 6. ZERO-GAP CONNECTED CONCRETE, BRICK & GLASS MERGING + PERGOLA LOUVERS
   * ========================================================================== */
  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.028 };
  }

  _isConnectableMasonrySlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        slot.pieceType !== 'roof_slab' &&
        slot.pieceType !== 'roof_pergola'
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
    if (remaining.some((s) => s.pieceType === 'roof_pergola')) return 'roof_pergola';
    if (remaining.some((s) => s.pieceType === 'roof_slab')) return 'roof_slab';
    if (remaining.some((s) => s.pieceType === 'glass')) return 'glass';
    if (remaining.some((s) => s.pieceType === 'brick')) return 'brick';
    if (remaining.some((s) => s.pieceType === 'concrete_upper')) return 'concrete_upper';
    return 'concrete_base';
  }

  carveWorkbenchBlock(swipeVec) {
    const handled = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (handled && block && block.kind === 'carved') {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyModernPieceVisual(block, pieceType, false);
    }
    return handled;
  }

  _clearCustomBlockAttachments(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  _applyModernPieceVisual(block, pieceType, isPlaced = false) {
    block.pieceType = pieceType;
    this._clearCustomBlockAttachments(block);

    if (pieceType === 'roof_pergola') {
      block.mesh.geometry = this.geos.slabRoof;
      block.mesh.material = this.modern.materials.whiteConcreteRoof;
      if (isPlaced) {
        this._attachPergolaLouvers(block);
      }
      return;
    }

    if (pieceType === 'roof_slab') {
      block.mesh.geometry = this.geos.slabRoof;
      block.mesh.material = this.modern.materials.whiteConcreteRoof;
      if (isPlaced) {
        this._attachRoofFasciaTrim(block);
      }
      return;
    }

    if (pieceType === 'glass') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.modern.materials.panoramicGlass;
      if (isPlaced) {
        this._attachAluminumMullions(block);
      }
      return;
    }

    if (pieceType === 'brick') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.modern.materials.modernBrick;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = this.modern.materials.whiteConcrete;
  }

  _attachAluminumMullions(block) {
    const group = new THREE.Group();
    const halfW = BLOCK_W * 0.485;
    const halfD = BLOCK_D * 0.485;
    [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
    ].forEach(([ox, oz]) => {
      const bar = new THREE.Mesh(this.geos.glassMullionBar, this.modern.materials.darkAluminum);
      bar.position.set(ox, 0, oz);
      bar.castShadow = true;
      group.add(bar);
    });
    block.mesh.add(group);
    block.customAttach = group;
  }

  _attachRoofFasciaTrim(block) {
    const trim = new THREE.Mesh(this.geos.fasciaTrim, this.modern.materials.darkAluminum);
    trim.position.y = 0.08;
    block.mesh.add(trim);
    block.customAttach = trim;
  }

  _attachPergolaLouvers(block) {
    const group = new THREE.Group();
    const trim = new THREE.Mesh(this.geos.fasciaTrim, this.modern.materials.darkAluminum);
    trim.position.y = 0.08;
    group.add(trim);

    for (let i = -2; i <= 2; i++) {
      const slat = new THREE.Mesh(this.geos.louverSlat, this.modern.materials.darkAluminum);
      slat.position.set(0, 0.165, i * 0.19);
      slat.castShadow = true;
      group.add(slat);
    }
    block.mesh.add(group);
    block.customAttach = group;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyModernPieceVisual(block, slot.pieceType, true);

    // Reveal the warm living-room interior glow once Tier 2 begins
    if (slot.layer >= 1 && this.interiorGlowMesh && !this.interiorGlowMesh.visible) {
      this.interiorGlowMesh.visible = true;
    }

    // Reveal the sleek wrap-around glass balcony railings once Tier 3 begins!
    if (slot.layer >= 2 && this.balconyRailGroup && !this.balconyRailGroup.visible) {
      this.balconyRailGroup.visible = true;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const dustMat =
      slot.pieceType === 'brick'
        ? this.mats.dustBrick
        : slot.pieceType === 'glass'
          ? this.mats.dustGlass
          : this.mats.dustConcrete;

    this._spawnParticles(slot.position, {
      count: 10,
      material: dustMat,
      speed: 2.1,
      upSpeed: 2.7,
      scale: 0.88,
      life: 0.5,
    });
  }

  /* ============================================================================
   * 7. COMPLETION CELEBRATION (+280 OR, +35 ÉCLATS, SUNLIGHT & GLASS SHIMMER)
   * ========================================================================== */
  _triggerCompletionSequence() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    if (this.balconyRailGroup) this.balconyRailGroup.visible = true;

    const pc = this.pyramidCenter;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(pc.x, FOUNDATION_Y + 3.2, pc.z);

    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.54, 1.85, 6.8, 18, 1, true));
    innerGeo.translate(0, 2.8, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xfff0b2,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.92, 2.45, 6.4, 18, 1, true));
    outerGeo.translate(0, 2.6, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0x9be8ff,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.84, 1.68, 30));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe89e,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.25;
    this.victoryGroup.add(this.victoryHalo);

    this.root.add(this.victoryGroup);

    // Burst of golden sunlight rays & crystal glass-shimmer sparkles
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 2.5, pc.z), {
      count: 24,
      material: this.mats.sunSpark,
      speed: 3.5,
      upSpeed: 4.3,
      scale: 0.9,
      life: 1.15,
    });
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 2.0, pc.z), {
      count: 18,
      material: this.mats.dustGlass,
      speed: 2.9,
      upSpeed: 3.6,
      scale: 0.85,
      life: 1.05,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level7Modern.meta.id,
        focusPoint: new THREE.Vector3(pc.x, FOUNDATION_Y + 1.85, pc.z),
        rewardCoins: 280,
        firstCompletionTokens: 35,
      });
    }
  }

  /* ============================================================================
   * 8. REAL-TIME ANIMATION LOOP (CART WHEELS, INFINITY POOL RIPPLE & BOLLARDS)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Spin flatbed cart wheels proportionally to guided track movement
    for (let i = 0; i < this.cartWheels.length; i++) {
      const cw = this.cartWheels[i];
      const coord = cw.sled.axis === 'z' ? cw.sled.group.position.z : cw.sled.group.position.x;
      const delta = coord - cw.lastCoord;
      cw.lastCoord = coord;
      if (Math.abs(delta) > 0.0001) {
        cw.mesh.rotation.x += delta / 0.17;
      }
    }

    // 2. Subtle animated sunlight water shimmer across the turquoise infinity pool
    if (this.poolWaterMesh && this.poolWaterMesh.material && this.poolWaterMesh.material.normalMap) {
      this.poolWaterMesh.material.normalMap.offset.x = (elapsed * 0.022) % 1;
      this.poolWaterMesh.material.normalMap.offset.y = (elapsed * 0.015) % 1;
    }

    // 3. Gentle warm architectural glow pulse on garden bollards
    for (let i = 0; i < this.bollardLights.length; i++) {
      const b = this.bollardLights[i];
      const pulse = 0.92 + Math.sin(elapsed * 2.1 + b.phase) * 0.08;
      b.mesh.scale.setScalar(pulse);
    }

    // 4. Cozy 3D grass wind animation
    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.update === 'function') {
      this.cozyFoliageSystem.update(elapsed);
    }

    // 5. Post-completion subtle sunlight & glass shimmer sparkles
    if (this.isComplete) {
      this.shimmerSparkTimer += dt;
      if (this.shimmerSparkTimer >= 0.72) {
        this.shimmerSparkTimer = 0;
        const pc = this.pyramidCenter;
        this._spawnParticles(
          new THREE.Vector3(
            pc.x + (Math.random() - 0.5) * 3.2,
            FOUNDATION_Y + 1.8 + Math.random() * 1.1,
            pc.z + (Math.random() - 0.5) * 2.4
          ),
          {
            count: 3,
            material: Math.random() < 0.5 ? this.mats.sunSpark : this.mats.dustGlass,
            speed: 0.7,
            upSpeed: 1.5,
            scale: 0.65,
            life: 0.95,
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
