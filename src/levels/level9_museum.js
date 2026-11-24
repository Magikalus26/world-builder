/**
 * Workd Builder — Level 9: Classical Cultural Era ("Le Grand Musée National")
 *
 * Tactile 4-station neoclassical Beaux-Arts museum construction diorama (58 blocks across 4 tiers):
 *  - Sculpted 128x128 botanical park & flagstone esplanade terrain with manicured outer hills,
 *    NW pale-cream limestone & white Carrara marble quarry cliff, NE turquoise reflecting pool
 *    with marble curbing & fountain jet, trimmed cypress/linden trees, boxwood hedges, outdoor
 *    marble sculpture plinths & classic wrought-iron lampposts.
 *  - Zone 1 (NW): Stepped cream-limestone & white-marble quarry with 3 rock nodes & 5 tracked slots.
 *  - Zone 2 (W/C): Two brass-and-oak museum transport carts on guided tracks with brass levers.
 *  - Zone 3 (SW): Classical stone-and-iron sculptor workshop with open-front cutaway roof (rear ~34%,
 *    raycast disabled) and progressive 512x512 carving PBR stages (Stage 0 -> 1 -> 2 -> 3).
 *  - Zone 4 (E): Zero-gap 58-block Grand Museum (18 podium & monumental staircase -> 16 fluted white
 *    marble portico colonnade & arched gallery wings -> 14 carved classical frieze & triangular pediment ->
 *    10 welded Beaux-Arts wing slate roofs & seamless central translucent glass-and-iron Verrière dome).
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
const MUSEUM_STEP = BLOCK_W; // Zero-gap exact outer block width/depth

const MUSEUM_CENTER = { x: 3.45, z: -0.95 };
const FOUNDATION_Y = 0.34;
const POOL_WATER_Y = -0.22;

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
 * Unified 128x128 Manicured Botanical Park, Marble Quarry, Reflecting Pool & Esplanade heightfield.
 */
function sampleMuseumTerrainHeight(x, z) {
  let h =
    Math.sin(x * 0.22 + 0.3) * Math.cos(z * 0.2 - 0.4) * 0.08 +
    Math.sin(x * 0.46 - z * 0.4) * 0.03;

  // Manicured botanical park hills framing the museum esplanade
  const northPark = smoothstep(-5.8, -9.2, z) * 0.88;
  const westPark = smoothstep(-7.0, -10.0, x) * 0.64;
  const eastPark = smoothstep(8.1, 10.4, x) * 0.48;
  const southLip = smoothstep(7.6, 9.8, z) * 0.2;
  h += northPark + westPark + eastPark + southLip;

  // Shallow pale-cream limestone & Carrara marble quarry pit in North-West
  const pitDist = Math.hypot((x + 5.1) * 0.86, (z + 4.95) * 1.06);
  h -= (1.0 - smoothstep(1.25, 3.05, pitDist)) * 0.42;

  // Recessed serene Reflecting Pool basin in the North-East
  const poolMask = rectFlatMask(x, z, 7.2, -5.55, 1.55, 1.15, 0.48);
  h = h * (1.0 - poolMask) + -0.56 * poolMask;

  // Flat compacted flagstone plaza pads for Workshop, Quarry staging, Tracks & Grand Museum Esplanade
  const flatMask = clamp01(
    Math.max(
      rectFlatMask(x, z, -4.6, -3.28, 2.95, 1.05, 0.95),
      rectFlatMask(x, z, -4.6, 0.1, 1.55, 3.35, 0.85),
      rectFlatMask(x, z, -4.6, 4.35, 2.55, 2.1, 1.05),
      rectFlatMask(x, z, -0.5, 4.75, 3.55, 1.55, 0.9),
      rectFlatMask(x, z, 3.55, 3.55, 1.95, 1.75, 0.95),
      rectFlatMask(x, z, MUSEUM_CENTER.x, MUSEUM_CENTER.z, 3.25, 3.1, 1.25)
    )
  );
  h *= 1.0 - flatMask;

  const rimT = Math.max(smoothstep(9.6, 10.35, Math.abs(x)), smoothstep(9.0, 9.75, Math.abs(z)));
  h *= 1.0 - rimT * 0.24;

  return h;
}

/**
 * Computes 4-biome terrain splat weights:
 *  w0: Manicured Royal Park Lawn, Boxwood Green & Flowerbeds
 *  w1: Smooth Cream Flagstone Promenade & Gravel Esplanade
 *  w2: Crushed White Carrara Marble & Cream Limestone Quarry Dust
 *  w3: Reflecting Pool Bank Moss & Pale Marble Gravel Border
 */
function sampleMuseumBiomeWeights(x, z, h) {
  const quarryZone = 1.0 - smoothstep(2.15, 4.35, Math.hypot(x + 4.85, z + 4.7));
  const wsDust = rectFlatMask(x, z, -4.6, 4.35, 2.15, 1.75, 1.15) * 0.86;
  const wQuarry = clamp01(Math.max(quarryZone, wsDust));

  const dTrackA = segmentDist(x, z, -4.6, -2.6, -4.6, 2.9);
  const dTrackB = segmentDist(x, z, -2.5, 4.75, 3.55, 4.75);
  const dApproach = segmentDist(x, z, 3.55, 1.85, 3.55, 4.75);
  const dPromenade = segmentDist(x, z, 3.45, -3.5, 7.2, -5.55);
  const pathDist = Math.min(dTrackA, dTrackB, dApproach, dPromenade * 1.12);
  const museumPad = rectFlatMask(x, z, MUSEUM_CENTER.x, MUSEUM_CENTER.z, 3.2, 3.0, 1.2) * 0.95;
  const wPlaza = clamp01(Math.max(1.0 - smoothstep(0.88, 1.98, pathDist), museumPad));

  const wPool = rectFlatMask(x, z, 7.2, -5.55, 2.35, 1.85, 0.95);

  const used = clamp01(wQuarry * 0.94 + wPlaza * 0.92 + wPool * 0.95);
  let w0 = Math.max(0.05, 1.0 - used);
  let w1 = wPlaza * (1.0 - wPool * 0.55);
  let w2 = wQuarry * (1.0 - wPlaza * 0.45);
  let w3 = wPool;

  const sum = w0 + w1 + w2 + w3 || 1;
  w0 /= sum;
  w1 /= sum;
  w2 /= sum;
  w3 /= sum;

  const wetness = 1.0 - smoothstep(POOL_WATER_Y - 0.04, POOL_WATER_Y + 0.18, h);
  return { w0, w1, w2, w3, wetness: wetness * wPool };
}

/**
 * Stylized European Trimmed Linden Tree (rooted bark trunk + lush sculpted park crown).
 */
function createTrimmedLindenTree(x, z, groundY, trunkMat, foliageMat, trackGeo, seed = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.04, z);
  tree.rotation.y = (seed % 7) * 0.85;

  const trunkGroup = createRootedTrunk({
    height: 1.06 + (seed % 3) * 0.12,
    botR: 0.14,
    topR: 0.08,
    barkMat: trunkMat,
    trackGeo,
    seed,
  });
  tree.add(trunkGroup);

  const crown = new THREE.Group();
  crown.position.y = 1.04 + (seed % 3) * 0.1;
  const puffs = [
    [0, 0.24, 0, 0.54],
    [-0.32, 0.02, 0.18, 0.4],
    [0.32, 0.04, -0.18, 0.42],
    [0.14, 0.08, 0.3, 0.36],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pz, r] = puffs[i];
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: r,
        detail: 1,
        squashY: 0.88,
        irregularity: 0.16,
        seed: seed * 19 + i * 13,
        baseColor: '#25522c',
        midColor: '#45843c',
        topColor: '#86c254',
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

/**
 * Stylized Tall Trimmed Classical Park Cypress Tree.
 */
function createTrimmedCypressTree(x, z, groundY, trunkMat, foliageMat, trackGeo, seed = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.04, z);
  tree.rotation.y = (seed % 9) * 0.65;

  const trunkGroup = createRootedTrunk({
    height: 0.68,
    botR: 0.1,
    topR: 0.055,
    barkMat: trunkMat,
    trackGeo,
    seed: seed + 51,
  });
  tree.add(trunkGroup);

  const geo = trackGeo(
    createIrregularConiferTierGeo({
      radiusBottom: 0.3,
      radiusTop: 0.035,
      height: 1.72,
      radialSegments: 9,
      heightSegments: 4,
      jaggedness: 0.14,
      droop: 0.02,
      seed: seed * 23,
      baseColor: '#1d4429',
      midColor: '#316a3b',
      topColor: '#66a850',
    })
  );
  const m = new THREE.Mesh(geo, foliageMat);
  m.position.y = 1.24;
  m.castShadow = true;
  m.receiveShadow = true;
  tree.add(m);
  return tree;
}

/**
 * Builds a clean zero-gap 4-step classical marble staircase block ascending from +Z to -Z.
 */
function createGrandStairBlockGeometry(w = BLOCK_W, h = BLOCK_H, d = BLOCK_D, steps = 4) {
  const positions = [];
  const uvs = [];
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;
  const stepH = h / steps;
  const stepD = d / steps;

  const pushQuad = (a, b, c, dPt, uvFn) => {
    const pts = [a, b, c, a, c, dPt];
    for (let i = 0; i < pts.length; i++) {
      positions.push(pts[i][0], pts[i][1], pts[i][2]);
      const uv = uvFn(pts[i]);
      uvs.push(uv[0], uv[1]);
    }
  };
  const uvTop = (p) => [p[0] / w + 0.5, p[2] / d + 0.5];
  const uvFront = (p) => [p[0] / w + 0.5, p[1] / w + 0.5];
  const uvSide = (p) => [p[2] / d + 0.5, p[1] / w + 0.5];

  // Bottom + back wall
  pushQuad([-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], uvTop);
  pushQuad([hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], uvFront);

  // Ascending treads & risers from front (+hz) to back (-hz)
  for (let s = 0; s < steps; s++) {
    const y0 = -hy + s * stepH;
    const y1 = y0 + stepH;
    const zFront = hz - s * stepD;
    const zBack = zFront - stepD;
    // Riser (+Z)
    pushQuad([-hx, y0, zFront], [hx, y0, zFront], [hx, y1, zFront], [-hx, y1, zFront], uvFront);
    // Tread (+Y)
    pushQuad([-hx, y1, zFront], [hx, y1, zFront], [hx, y1, zBack], [-hx, y1, zBack], uvTop);
    // Left & Right side step profiles
    pushQuad([-hx, -hy, zBack], [-hx, -hy, zFront], [-hx, y1, zFront], [-hx, y1, zBack], uvSide);
    pushQuad([hx, -hy, zFront], [hx, -hy, zBack], [hx, y1, zBack], [hx, y1, zFront], uvSide);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sculpted classical fluted white Carrara marble column (plinth + fluted cylinder + Doric/Ionic abacus).
 */
function createFlutedColonnadeGeometry(h = BLOCK_H) {
  const geo = new THREE.CylinderGeometry(0.24, 0.27, h * 0.996, 14, 1, false);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * 1.0, uv.getY(i) * 1.0);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds one section (left, center, or right) of a seamless 3-block classical triangular pediment ("fronton").
 * Exact bottom clearance +0.002 so it sits flush on top of the portico entablature with zero z-fighting.
 */
function createPedimentSectionGeometry(variant = 'center', w = BLOCK_W, h = BLOCK_H, d = BLOCK_D) {
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;
  const y0 = -hy + 0.002;
  const baseBandH = h * 0.34; // Solid lower classical cornice frieze band across all 3 blocks
  const yBase = y0 + baseBandH;
  const peakRise = h * 0.96;

  // Height of sloped triangular gable ridge at local x
  const slopeY = (lx) => {
    if (variant === 'left') {
      const t = clamp01((lx + hx) / w); // 0 at left eave -> 1 at inner right edge
      return yBase + t * (peakRise * 0.66);
    }
    if (variant === 'right') {
      const t = clamp01((hx - lx) / w); // 0 at right eave -> 1 at inner left edge
      return yBase + t * (peakRise * 0.66);
    }
    // Center peak rises cleanly from 0.66*peakRise at ±hx up to 1.0*peakRise at x = 0!
    const dist = Math.abs(lx) / hx;
    return yBase + (1.0 - dist * 0.34) * peakRise;
  };

  const positions = [];
  const uvs = [];
  const pushQuad = (a, b, c, dPt, uvFn) => {
    const pts = [a, b, c, a, c, dPt];
    for (let i = 0; i < pts.length; i++) {
      positions.push(pts[i][0], pts[i][1], pts[i][2]);
      const uv = uvFn(pts[i]);
      uvs.push(uv[0], uv[1]);
    }
  };
  const uvFront = (p) => [p[0] / w + 0.5, (p[1] + hy) / w];
  const uvTop = (p) => [p[0] / w + 0.5, p[2] / d + 0.5];
  const uvSide = (p) => [p[2] / d + 0.5, (p[1] + hy) / w];

  const xStops = variant === 'center' ? [-hx, 0, hx] : [-hx, hx];
  for (let s = 0; s < xStops.length - 1; s++) {
    const xL = xStops[s];
    const xR = xStops[s + 1];
    const yL = slopeY(xL);
    const yR = slopeY(xR);

    // Front (+Z) & Back (-Z) sculpted tympanum + cornice band
    pushQuad([xL, y0, hz], [xR, y0, hz], [xR, yR, hz], [xL, yL, hz], uvFront);
    pushQuad([xR, y0, -hz], [xL, y0, -hz], [xL, yL, -hz], [xR, yR, -hz], uvFront);
    // Raking cornice top slope (+Y)
    pushQuad([xL, yL, hz], [xR, yR, hz], [xR, yR, -hz], [xL, yL, -hz], uvTop);
    // Underside soffit (-Y)
    pushQuad([xL, y0, -hz], [xR, y0, -hz], [xR, y0, hz], [xL, y0, hz], uvTop);
  }

  // Outer exposed side caps only (internal seams between left/center/right are culled so zero z-fighting!)
  if (variant === 'left') {
    const yL = slopeY(-hx);
    pushQuad([-hx, y0, -hz], [-hx, y0, hz], [-hx, yL, hz], [-hx, yL, -hz], uvSide);
  } else if (variant === 'right') {
    const yR = slopeY(hx);
    pushQuad([hx, y0, hz], [hx, y0, -hz], [hx, yR, -hz], [hx, yR, hz], uvSide);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

export class Level9Museum extends Level1Pyramid {
  static meta = {
    id: 'level9_museum',
    title: 'Niveau 9 : Le Grand Musée National',
    hudLabel: 'Grand Musée',
    totalGoal: 58,
    rewardCoins: 360,
    rewardTokens: 45,
  };

  constructor(options) {
    super(options);
  }

  _beforeBuild() {
    this.museum = this.textures.ensureMuseumPack();
    this.cartWheels = [];
    this.lampGlobes = [];
    this.poolWaterMesh = null;
    this.fountainRings = [];
    this.cozyFoliageSystem = null;
    this.rotundaCupolaGroup = null;
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

    // Monumental 4-step white marble entrance staircase block
    this.geos.grandStair = this._trackGeo(createGrandStairBlockGeometry(BLOCK_W, BLOCK_H, BLOCK_D, 4));
    this.geos.ghostStairEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.grandStair, 20));

    // Fluted white Carrara marble column shaft + compact preview
    this.geos.flutedCol = this._trackGeo(createFlutedColonnadeGeometry(BLOCK_H));
    this.geos.colCap = this._trackGeo(new THREE.BoxGeometry(0.62, 0.1, 0.62));
    this.geos.colBase = this._trackGeo(new THREE.BoxGeometry(0.64, 0.1, 0.64));
    this.geos.ghostCol = this._trackGeo(new THREE.CylinderGeometry(0.28, 0.3, BLOCK_H * 0.96, 12));
    this.geos.ghostColEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostCol, 20));

    // Seamless 3-piece Classical Triangular Pediment (Left, Center, Right)
    this.geos.pedimentLeft = this._trackGeo(createPedimentSectionGeometry('left', BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.pedimentCenter = this._trackGeo(createPedimentSectionGeometry('center', BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.pedimentRight = this._trackGeo(createPedimentSectionGeometry('right', BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.ghostPedimentLeftEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.pedimentLeft, 20));
    this.geos.ghostPedimentCenterEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.pedimentCenter, 20));
    this.geos.ghostPedimentRightEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.pedimentRight, 20));

    // Previews for wing slate roof & translucent glass-and-iron skylight roof
    this.geos.wingRoofPreview = this._trackGeo(
      this.masonryCache.getPitchedRoofGeometry(BLOCK_W * 0.94, BLOCK_H * 0.85, BLOCK_D * 0.94, 0, {
        style: 'gable',
        defaultAxis: 'z',
        eaveOverhang: 0.02,
      })
    );
    this.geos.verrierePreview = this._trackGeo(
      this.masonryCache.getPitchedRoofGeometry(BLOCK_W * 0.94, BLOCK_H * 0.82, BLOCK_D * 0.94, 0, {
        style: 'gable',
        defaultAxis: 'x',
        eaveOverhang: 0.02,
      })
    );
    this.geos.ghostRoof = this._trackGeo(
      this.masonryCache.getPitchedRoofGeometry(BLOCK_W * 0.97, BLOCK_H * 0.9, BLOCK_D * 0.97, 0, {
        style: 'gable',
        defaultAxis: 'x',
        eaveOverhang: 0.02,
      })
    );
    this.geos.ghostRoofEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostRoof, 22));

    // Brass-hubbed museum cart wheel
    this.geos.cartWheel = this._trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.085, 14));
    this.geos.cartWheel.rotateZ(Math.PI / 2);

    // Sculptor dust, crystal glass shimmer & royal gold celebration particle materials
    this.mats.dustMarble = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf4efe4, transparent: true, opacity: 0.88 })
    );
    this.mats.dustGlass = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xaeeaff, transparent: true, opacity: 0.84 })
    );
    this.mats.goldSpark = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffe06e, transparent: true, opacity: 0.95 })
    );
    this.mats.parkBark = this._trackMat(
      new THREE.MeshStandardMaterial({ color: '#644c36', roughness: 0.9, metalness: 0.02 })
    );
    this.mats.parkFoliage = this._trackMat(createMatteFoliageMaterial());
  }

  getTerrainHeight(x, z) {
    return sampleMuseumTerrainHeight(x, z);
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 MUSEUM ESPLANADE, REFLECTING POOL & BOTANICAL PARK
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
      const h = sampleMuseumTerrainHeight(x, z);
      pos.setY(i, h);

      const { w0, w1, w2, w3, wetness } = sampleMuseumBiomeWeights(x, z, h);
      splat[i * 4] = w0;
      splat[i * 4 + 1] = w1;
      splat[i * 4 + 2] = w2;
      splat[i * 4 + 3] = w3;
      wet[i] = wetness;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wet, 1));
    terrainGeo.computeVertexNormals();

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.museum.materials.terrainSplat);
    this.terrainMesh.receiveShadow = true;
    base.add(this.terrainMesh);

    // Contoured geological plinth skirt framing the classical botanical diorama
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
        const topY = sampleMuseumTerrainHeight(ex, ez) + 0.015;
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

    this.plinthSkirtMesh = new THREE.Mesh(skirtGeo, this.museum.materials.podiumStone);
    this.plinthSkirtMesh.castShadow = true;
    this.plinthSkirtMesh.receiveShadow = true;
    base.add(this.plinthSkirtMesh);

    const bottomCap = new THREE.Mesh(
      this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D)),
      this.museum.materials.podiumStone
    );
    bottomCap.rotation.x = Math.PI / 2;
    bottomCap.position.y = skirtBottom;
    base.add(bottomCap);

    // Serene Turquoise Reflecting Pool with White Carrara Marble Edging in North-East
    this._buildReflectingPool(base);

    // Stylized Cypress/Linden Trees, Boxwood Hedges, Outdoor Marble Plinths & Wrought-Iron Lampposts
    this._buildBotanicalParkScenery(base);

    this.root.add(base);
  }

  _buildReflectingPool(parent) {
    const pool = new THREE.Group();
    const px = 7.2;
    const pz = -5.55;

    // White Carrara marble coping curbs framing the rectangular reflecting basin
    const curbNS = this._trackGeo(new THREE.BoxGeometry(3.48, 0.24, 0.28));
    const curbEW = this._trackGeo(new THREE.BoxGeometry(0.28, 0.24, 2.38));
    [-1.24, 1.24].forEach((dz) => {
      const m = new THREE.Mesh(curbNS, this.museum.materials.flutedMarble);
      m.position.set(px, -0.04, pz + dz);
      m.castShadow = true;
      m.receiveShadow = true;
      pool.add(m);
    });
    [-1.6, 1.6].forEach((dx) => {
      const m = new THREE.Mesh(curbEW, this.museum.materials.flutedMarble);
      m.position.set(px + dx, -0.04, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      pool.add(m);
    });

    // Shimmering turquoise reflecting water surface
    const waterGeo = this._trackGeo(new THREE.PlaneGeometry(3.04, 2.24, 12, 10));
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.museum.materials.reflectingWater);
    water.position.set(px, POOL_WATER_Y, pz);
    water.receiveShadow = true;
    pool.add(water);
    this.poolWaterMesh = water;

    // Classical tiered marble centerpiece pedestal & animated ripple rings inside the reflecting pool
    const fBase = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.28, 0.36, 0.42, 12)),
      this.museum.materials.flutedMarble
    );
    fBase.position.set(px, POOL_WATER_Y + 0.14, pz);
    fBase.castShadow = true;
    pool.add(fBase);

    const fBowl = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.46, 0.2, 0.14, 12)),
      this.museum.materials.flutedMarble
    );
    fBowl.position.set(px, POOL_WATER_Y + 0.38, pz);
    fBowl.castShadow = true;
    pool.add(fBowl);

    const fFinial = new THREE.Mesh(
      this._trackGeo(new THREE.SphereGeometry(0.11, 8, 6)),
      this.museum.materials.brassMetal
    );
    fFinial.position.set(px, POOL_WATER_Y + 0.54, pz);
    pool.add(fFinial);

    const ringGeo = this._trackGeo(new THREE.RingGeometry(0.42, 0.49, 20));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xe6fbff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(ringGeo, ringMat);
      r.position.set(px, POOL_WATER_Y + 0.015, pz);
      pool.add(r);
      this.fountainRings.push({ mesh: r, phase: i * 0.5 });
    }

    parent.add(pool);
  }

  _buildBotanicalParkScenery(parent) {
    const contactEntries = [];

    // Stylized Trimmed Linden Trees around the botanical park slopes
    const lindens = [
      [-8.8, -7.8, 13],
      [-9.1, -1.6, 21],
      [-8.7, 7.1, 29],
      [0.4, -8.2, 37],
      [8.8, 6.4, 43],
      [9.1, 1.4, 51],
    ];
    lindens.forEach(([tx, tz, seed]) => {
      const gy = sampleMuseumTerrainHeight(tx, tz);
      const t = createTrimmedLindenTree(
        tx,
        tz,
        gy,
        this.mats.parkBark,
        this.mats.parkFoliage,
        (g) => this._trackGeo(g),
        seed
      );
      parent.add(t);
      contactEntries.push({ x: tx, z: tz, radius: 0.9 });
    });

    // Tall Sculpted Classical Park Cypresses framing the reflecting pool & museum approaches
    const cypresses = [
      [-7.2, -8.5, 61],
      [-2.1, -8.4, 67],
      [2.6, -8.4, 73],
      [9.1, -7.6, 79],
      [9.2, -3.5, 83],
      [7.4, 7.2, 89],
    ];
    cypresses.forEach(([tx, tz, seed]) => {
      const gy = sampleMuseumTerrainHeight(tx, tz);
      const c = createTrimmedCypressTree(
        tx,
        tz,
        gy,
        this.mats.parkBark,
        this.mats.parkFoliage,
        (g) => this._trackGeo(g),
        seed
      );
      parent.add(c);
      contactEntries.push({ x: tx, z: tz, radius: 0.52 });
    });

    // Trimmed Royal Boxwood Hedges bordering the esplanade and park edge
    const hedgeSpecs = [
      [-1.1, 7.5, 2.35, 0.42, 0.46],
      [5.9, 7.4, 2.2, 0.42, 0.46],
      [-8.4, 3.2, 0.46, 0.42, 2.6],
      [4.5, -6.8, 1.85, 0.4, 0.44],
    ];
    hedgeSpecs.forEach(([hx, hz, w, h, d]) => {
      const gy = sampleMuseumTerrainHeight(hx, hz);
      const hedge = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(w, h, d)),
        this.museum.materials.boxwoodHedge
      );
      hedge.position.set(hx, gy + h * 0.48, hz);
      hedge.castShadow = true;
      hedge.receiveShadow = true;
      parent.add(hedge);
    });

    // Outdoor Marble Exhibition Plinths crowned with Golden Classical Urns / Busts
    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(0.46, 0.68, 0.46));
    const capGeo = this._trackGeo(new THREE.BoxGeometry(0.54, 0.08, 0.54));
    const urnGeo = this._trackGeo(new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.08, 0),
        new THREE.Vector2(0.14, 0.08),
        new THREE.Vector2(0.08, 0.18),
        new THREE.Vector2(0.18, 0.34),
        new THREE.Vector2(0.13, 0.44),
      ],
      10
    ));
    [
      [1.05, 3.35],
      [6.15, 3.35],
      [6.85, -3.55],
    ].forEach(([ox, oz]) => {
      const oy = sampleMuseumTerrainHeight(ox, oz);
      const plinth = new THREE.Mesh(plinthGeo, this.museum.materials.flutedMarble);
      plinth.position.set(ox, oy + 0.34, oz);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      parent.add(plinth);

      const cap = new THREE.Mesh(capGeo, this.museum.materials.flutedMarble);
      cap.position.set(ox, oy + 0.72, oz);
      parent.add(cap);

      const urn = new THREE.Mesh(urnGeo, this.museum.materials.brassMetal);
      urn.position.set(ox, oy + 0.76, oz);
      urn.castShadow = true;
      parent.add(urn);
    });

    // Classic Parisian Wrought-Iron Lampposts with Warm Glowing Globes
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.035, 0.06, 1.55, 8));
    const baseGeo = this._trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 0.24, 8));
    const globeGeo = this._trackGeo(new THREE.SphereGeometry(0.12, 10, 8));
    [
      [-1.95, 3.1],
      [1.45, 6.25],
      [5.75, 6.25],
      [5.25, -4.35],
    ].forEach(([lx, lz], idx) => {
      const ly = sampleMuseumTerrainHeight(lx, lz);
      const b = new THREE.Mesh(baseGeo, this.museum.materials.wroughtIron);
      b.position.set(lx, ly + 0.12, lz);
      parent.add(b);

      const p = new THREE.Mesh(postGeo, this.museum.materials.wroughtIron);
      p.position.set(lx, ly + 0.88, lz);
      p.castShadow = true;
      parent.add(p);

      const g = new THREE.Mesh(globeGeo, this.museum.materials.lampGlow);
      g.position.set(lx, ly + 1.72, lz);
      parent.add(g);
      this.lampGlobes.push({ mesh: g, phase: idx * 1.4 });
    });

    // Cozy 3D Instanced Park Grass, Pebbles & Garden Blossoms (strictly on manicured lawns!)
    this.cozyFoliageSystem = createCozyGroundFoliageSystem({
      parent,
      getTerrainHeight: sampleMuseumTerrainHeight,
      waterLevel: POOL_WATER_Y + 0.08,
      isBlocked: (gx, gz) => {
        const h = sampleMuseumTerrainHeight(gx, gz);
        if (h < POOL_WATER_Y + 0.12) return true;
        const bw = sampleMuseumBiomeWeights(gx, gz, h);
        return bw.w1 > 0.26 || bw.w2 > 0.26 || bw.w3 > 0.35;
      },
      getGrassWeight: (gx, gz) => {
        const h = sampleMuseumTerrainHeight(gx, gz);
        return sampleMuseumBiomeWeights(gx, gz, h).w0;
      },
      grassCount: 900,
      pebbleCount: 85,
      flowerCount: 100,
      grassPalette: ['#4d8a3c', '#3e7733', '#609e46', '#7eb652', '#35682c'],
      flowerPalette: ['#fffaf0', '#ffe4ee', '#ffe26a', '#f7b2c4'],
      seed: 909,
    });

    contactEntries.push({ x: MUSEUM_CENTER.x, z: MUSEUM_CENTER.z, radius: 3.15 });
    contactEntries.push({ x: -4.6, z: 4.35, radius: 2.3 });
    this.contactShadows = createContactShadowSystem(parent, contactEntries, sampleMuseumTerrainHeight);
  }

  /* ============================================================================
   * 2. ZONE 1 — LA CARRIÈRE DE MARBRE & PIERRE DE TAILLE (NORTH-WEST)
   *    Stepped cream-limestone & white Carrara marble cliff + 5 tracked slots
   * ========================================================================== */
  _buildQuarryStation() {
    const qGroup = new THREE.Group();
    this.quarryNodes = [];
    this.quarrySlots = [];

    // Stepped cream-limestone & white Carrara marble cliff terrace backdrop
    const cliffLayers = [
      { pos: [-5.1, -6.55], size: [6.4, 2.05, 1.9], mat: this.museum.materials.rawMarbleRock },
      { pos: [-5.5, -5.65], size: [4.8, 1.15, 1.5], mat: this.museum.materials.flutedMarble },
      { pos: [-2.7, -5.8], size: [2.2, 1.35, 1.4], mat: this.museum.materials.museumLimestone },
    ];
    cliffLayers.forEach((l) => {
      const m = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(...l.size)), l.mat);
      const gy = sampleMuseumTerrainHeight(l.pos[0], l.pos[1]);
      m.position.set(l.pos[0], gy + l.size[1] * 0.44, l.pos[1]);
      m.castShadow = true;
      m.receiveShadow = true;
      qGroup.add(m);
    });

    // Brass-and-oak marble quarry derrick hoist behind the rock nodes
    const craneY = sampleMuseumTerrainHeight(-7.35, -5.05);
    const mast = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.16, 2.35, 0.16)),
      this.museum.materials.oakCartWood
    );
    mast.position.set(-7.35, craneY + 1.15, -5.05);
    mast.castShadow = true;
    qGroup.add(mast);

    const jib = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.1, 0.13, 0.13)),
      this.museum.materials.oakCartWood
    );
    jib.position.set(-6.45, craneY + 2.15, -5.05);
    jib.rotation.z = 0.14;
    jib.castShadow = true;
    qGroup.add(jib);

    const pulley = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10)),
      this.museum.materials.brassMetal
    );
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(-5.55, craneY + 2.18, -5.05);
    qGroup.add(pulley);

    // 3 Extractable Cream-Limestone & White-Marble Quarry Nodes
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
      const ny = sampleMuseumTerrainHeight(nx, nz);
      const g = new THREE.Group();
      g.position.set(nx, ny + 0.52, nz);

      const core = new THREE.Mesh(rockGeo, this.museum.materials.rawMarbleRock);
      core.scale.set(1.1, 0.88, 0.96);
      core.rotation.set(0.2 + idx * 0.4, idx * 1.1, 0.12);
      core.castShadow = true;
      core.receiveShadow = true;
      g.add(core);

      const sub = new THREE.Mesh(subRockGeo, this.museum.materials.flutedMarble);
      sub.position.set(0.36 * (idx % 2 === 0 ? 1 : -1), -0.18, 0.24);
      sub.castShadow = true;
      g.add(sub);

      const hitbox = new THREE.Mesh(hitGeo, hitMat);
      g.add(hitbox);
      qGroup.add(g);

      const nodeObj = {
        index: idx,
        id: `museum_quarry_${idx}`,
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
    const outPadY = sampleMuseumTerrainHeight(-4.6, -3.28);
    const outPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.45, 0.14, 1.42)),
      this.museum.materials.podiumStone
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
    return this.museum.materials.rawMarbleRock;
  }

  /* ============================================================================
   * 3. ZONE 2 — LES CHARIOTS D'ART & PIERRES SUR RAILS (BRASS & OAK)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();

    const oakMat = this.museum.materials.oakCartWood;
    const brassMat = this.museum.materials.brassMetal;
    const ironMat = this.museum.materials.wroughtIron;

    for (let i = 0; i < this.sleds.length; i++) {
      const sled = this.sleds[i];
      const g = sled.group;
      if (!g) continue;

      g.traverse((child) => {
        if (!child.isMesh) return;
        if (!child.visible || (child.material && child.material.visible === false)) return;
        if (child.userData && child.userData.interact && child.userData.interact.type === 'sled-lever') {
          child.material = brassMat;
        } else {
          child.material = ironMat;
        }
      });

      const isTrackA = sled.axis === 'z';
      const deckW = isTrackA ? (this.sledCapacity === 4 ? 3.5 : 3.16) : 1.08;
      const deckD = isTrackA ? 1.08 : (this.sledCapacity === 4 ? 3.5 : 3.16);

      // Oiled oak museum flatbed deck cleanly above chassis
      const flatbed = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(deckW, 0.06, deckD)),
        oakMat
      );
      flatbed.position.y = 0.255;
      flatbed.castShadow = true;
      flatbed.receiveShadow = true;
      g.add(flatbed);

      // Polished brass end-rail trims framing the museum art cart
      const trimGeo = this._trackGeo(
        new THREE.BoxGeometry(isTrackA ? deckW + 0.05 : 0.09, 0.085, isTrackA ? 0.09 : deckD + 0.05)
      );
      [-1, 1].forEach((side) => {
        const trim = new THREE.Mesh(trimGeo, brassMat);
        if (isTrackA) trim.position.set(0, 0.23, side * (deckD * 0.5 + 0.02));
        else trim.position.set(side * (deckW * 0.5 + 0.02), 0.23, 0);
        g.add(trim);
      });

      // Twin wrought-iron guided rails along the flagstone promenade (using startPos/endPos!)
      const span = Math.abs(sled.endPos - sled.startPos) + 2.3;
      const midV = (sled.startPos + sled.endPos) * 0.5;
      const railGeo = this._trackGeo(
        isTrackA ? new THREE.BoxGeometry(0.08, 0.07, span) : new THREE.BoxGeometry(span, 0.07, 0.08)
      );
      [-0.44, 0.44].forEach((rOff) => {
        const rail = new THREE.Mesh(railGeo, ironMat);
        if (isTrackA) rail.position.set(sled.fixedCoord + rOff, 0.085, midV);
        else rail.position.set(midV, 0.085, sled.fixedCoord + rOff);
        rail.receiveShadow = true;
        this.root.add(rail);
      });

      // 4 Rotating Brass-Hubbed Cart Wheels
      const wheelOffsets = isTrackA
        ? [[-1.18, -0.44], [1.18, -0.44], [-1.18, 0.44], [1.18, 0.44]]
        : [[-0.44, -1.18], [0.44, -1.18], [-0.44, 1.18], [0.44, 1.18]];
      wheelOffsets.forEach(([wx, wz]) => {
        const w = new THREE.Mesh(this.geos.cartWheel, brassMat);
        w.position.set(wx, 0.075, wz);
        if (!isTrackA) w.rotation.y = Math.PI / 2;
        w.castShadow = true;
        g.add(w);
        this.cartWheels.push({ mesh: w, sled, lastCoord: isTrackA ? g.position.z : g.position.x });
      });
    }
  }

  /* ============================================================================
   * 4. ZONE 3 — L'ATELIER DU SCULPTEUR & TAILLEUR DE MARBRE (OPEN-TOP VISIBILITY)
   *    Recessed rear-34% iron-and-glass awning with raycast disabled on roof meshes
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const wx = -4.6;
    const wz = 4.35;
    const wy = sampleMuseumTerrainHeight(wx, wz);

    // Cream limestone sculptor studio floor slab
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.35, 0.16, 3.65)),
      this.museum.materials.podiumStone
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.castShadow = true;
    ws.add(floor);

    // Neoclassical carved stone rear gallery wall behind the anvil
    const backWall = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.15, 1.72, 0.24)),
      this.museum.materials.museumLimestone
    );
    backWall.position.set(wx, wy + 0.94, wz - 1.66);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    ws.add(backWall);

    // Wrought-iron classical atelier columns supporting the recessed rear overhang
    const colGeo = this._trackGeo(new THREE.CylinderGeometry(0.08, 0.095, 2.04, 10));
    [
      [wx - 2.02, wz - 1.62],
      [wx + 2.02, wz - 1.62],
      [wx - 2.02, wz - 0.56],
      [wx + 2.02, wz - 0.56],
    ].forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeo, this.museum.materials.wroughtIron);
      col.position.set(cx, wy + 1.1, cz);
      col.castShadow = true;
      ws.add(col);
    });

    // OPEN-TOP / CUTAWAY BEAUX-ARTS IRON & GLASS AWNING: covers ONLY rear ~34% behind the workbench!
    // Raycast disabled on ALL canopy meshes so tapping/dragging the block is 100% unobstructed.
    const canopyGroup = new THREE.Group();
    const frontBeam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.42, 0.12, 0.12)),
      this.museum.materials.wroughtIron
    );
    frontBeam.position.set(wx, wy + 2.08, wz - 0.58);
    canopyGroup.add(frontBeam);

    const rearGlassAwning = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.52, 0.09, 1.28)),
      this.museum.materials.verriereGlass
    );
    rearGlassAwning.position.set(wx, wy + 2.24, wz - 1.18);
    rearGlassAwning.rotation.x = 0.2;
    canopyGroup.add(rearGlassAwning);

    const brassTrim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.56, 0.08, 0.1)),
      this.museum.materials.brassMetal
    );
    brassTrim.position.set(wx, wy + 2.38, wz - 1.78);
    canopyGroup.add(brassTrim);

    canopyGroup.traverse((obj) => {
      if (obj.isMesh) obj.raycast = () => {};
    });
    ws.add(canopyGroup);

    // Master Sculptor's Marble Carving Anvil in the sunlit open front bay
    const benchX = wx - 0.52;
    const benchZ = wz + 0.35;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.52, 0.6, 1.48)),
      this.museum.materials.wroughtIron
    );
    benchBase.position.set(benchX, wy + 0.46, benchZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchSlab = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.42, 0.1, 1.38)),
      this.museum.materials.flutedMarble
    );
    benchSlab.position.set(benchX, wy + 0.8, benchZ);
    benchSlab.receiveShadow = true;
    ws.add(benchSlab);

    // Sculptor's brass-ferruled chisel resting neatly beside the block
    const chisel = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.055, 0.045, 0.36)),
      this.museum.materials.brassMetal
    );
    chisel.position.set(benchX + 0.54, wy + 0.87, benchZ + 0.36);
    chisel.rotation.y = 0.46;
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

    // Generous invisible carve-swipe hitbox over the sculptor's anvil
    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.92, 1.35, 1.92));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(benchX, wy + 1.3, benchZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Golden Sculpting Progress Pips floating above the anvil
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xffe484,
          emissive: 0xd9a126,
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

    // 2 Finished Marble Output Slots on the East side of the open workshop floor
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

    // 4 Esplanade Staging Slots at the East end of Track B
    const stageX = 3.55;
    const stageZ = 3.55;
    const stageY = sampleMuseumTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.65, 0.14, 2.35)),
      this.museum.materials.podiumStone
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
   * 5. ZONE 4 — CHANTIER DU GRAND MUSÉE NATIONAL (EAST — 58 BLOCKS, 4 TIERS)
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidCenter = new THREE.Vector3(MUSEUM_CENTER.x, 0, MUSEUM_CENTER.z);
    const pc = this.pyramidCenter;
    const site = new THREE.Group();

    // Sweeping cream-limestone museum esplanade plinth
    const padSpan = 5 * MUSEUM_STEP + 0.52;
    const basePlinth = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(padSpan, FOUNDATION_Y, padSpan)),
      this.museum.materials.podiumStone
    );
    basePlinth.position.set(pc.x, FOUNDATION_Y * 0.5, pc.z);
    basePlinth.receiveShadow = true;
    basePlinth.castShadow = true;
    site.add(basePlinth);

    // Warm sunlit golden atrium marble gallery floor visible beneath the central Glass Verrière!
    const atriumFloor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.05, 0.04, 2.7)),
      this.museum.materials.interiorGalleryGlow
    );
    atriumFloor.position.set(pc.x, FOUNDATION_Y + 0.015, pc.z - 0.2);
    atriumFloor.receiveShadow = true;
    site.add(atriumFloor);

    // Miniature central white-marble museum sculpture centerpiece visible through the glass skylight!
    const statuePed = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.56, 0.62, 0.56)),
      this.museum.materials.flutedMarble
    );
    statuePed.position.set(pc.x, FOUNDATION_Y + 0.34, pc.z - 0.45);
    statuePed.castShadow = true;
    site.add(statuePed);

    const statueGold = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.28, 1)),
      this.museum.materials.brassMetal
    );
    statueGold.scale.set(0.8, 1.35, 0.8);
    statueGold.position.set(pc.x, FOUNDATION_Y + 0.94, pc.z - 0.45);
    statueGold.castShadow = true;
    site.add(statueGold);

    // Crowning Ribbed Glass-and-Iron Rotunda Cupola Lantern revealed atop the central Verrière on completion!
    this.rotundaCupolaGroup = new THREE.Group();
    this.rotundaCupolaGroup.visible = false;
    const cupolaY = FOUNDATION_Y + 3 * BLOCK_H + BLOCK_H * 1.18;
    const drum = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.84, 0.9, 0.36, 16)),
      this.museum.materials.wroughtIron
    );
    drum.position.set(pc.x, cupolaY + 0.14, pc.z - 0.48);
    this.rotundaCupolaGroup.add(drum);

    const drumTrim = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(0.85, 0.032, 6, 20)),
      this.museum.materials.brassMetal
    );
    drumTrim.rotation.x = Math.PI / 2;
    drumTrim.position.set(pc.x, cupolaY + 0.31, pc.z - 0.48);
    this.rotundaCupolaGroup.add(drumTrim);

    const dome = new THREE.Mesh(
      this._trackGeo(new THREE.SphereGeometry(0.82, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      this.museum.materials.verriereGlass
    );
    dome.position.set(pc.x, cupolaY + 0.32, pc.z - 0.48);
    this.rotundaCupolaGroup.add(dome);

    const lanternFinial = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.03, 0.08, 0.48, 8)),
      this.museum.materials.brassMetal
    );
    lanternFinial.position.set(pc.x, cupolaY + 1.28, pc.z - 0.48);
    this.rotundaCupolaGroup.add(lanternFinial);

    site.add(this.rotundaCupolaGroup);

    // =========================================================================
    // EXACT 58-BLOCK GRAND MUSÉE NATIONAL BLUEPRINT (18 + 16 + 14 + 10 = 58)
    // =========================================================================
    const blueprint = [];

    // TIER 1 (layer 0, gy = 0) — 18 Blocks: Grand Podium & Escalier Monumental
    const tier1Cells = [
      // Back & Wing Cream-Stone Podium Bases (13 outer)
      [-2, -2, 'podium_base'],
      [-1, -2, 'podium_base'],
      [0, -2, 'podium_base'],
      [1, -2, 'podium_base'],
      [2, -2, 'podium_base'],
      [-2, -1, 'podium_base'],
      [-2, 0, 'podium_base'],
      [-2, 1, 'podium_base'],
      [-2, 2, 'podium_base'],
      [2, -1, 'podium_base'],
      [2, 0, 'podium_base'],
      [2, 1, 'podium_base'],
      [2, 2, 'podium_base'],
      // 2 Inner Atrium Gallery Piers
      [-1, -1, 'podium_base'],
      [1, -1, 'podium_base'],
      // 3 Sweeping Central Monumental White Marble Staircase Blocks across South front
      [-1, 2, 'grand_stair'],
      [0, 2, 'grand_stair'],
      [1, 2, 'grand_stair'],
    ];
    tier1Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 0, gx, gy: 0, gz, pieceType });
    });

    // TIER 2 (layer 1, gy = 1) — 16 Blocks: Péristyle à Colonnes & Galeries d'Exposition
    const tier2Cells = [
      // Rear Exhibition Gallery Wall with Tall Arched Windows (5)
      [-2, -2, 'gallery_wall'],
      [-1, -2, 'gallery_window'],
      [0, -2, 'gallery_window'],
      [1, -2, 'gallery_window'],
      [2, -2, 'gallery_wall'],
      // West Lateral Exhibition Wing (4)
      [-2, -1, 'gallery_window'],
      [-2, 0, 'gallery_window'],
      [-2, 1, 'gallery_window'],
      [-2, 2, 'gallery_wall'],
      // East Lateral Exhibition Wing (4)
      [2, -1, 'gallery_window'],
      [2, 0, 'gallery_window'],
      [2, 1, 'gallery_window'],
      [2, 2, 'gallery_wall'],
      // Grand Central Portico of 3 Fluted White Carrara Marble Columns (3)
      [-1, 2, 'fluted_column'],
      [0, 2, 'fluted_column'],
      [1, 2, 'fluted_column'],
    ];
    tier2Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 1, gx, gy: 1, gz, pieceType });
    });

    // TIER 3 (layer 2, gy = 2) — 14 Blocks: Entablement Sculpté & Fronton Triangulaire
    const tier3Cells = [
      // Continuous Carved Classical Frieze & Entablature Cornice (11)
      [-2, -2, 'frieze_cornice'],
      [-1, -2, 'frieze_cornice'],
      [0, -2, 'frieze_cornice'],
      [1, -2, 'frieze_cornice'],
      [2, -2, 'frieze_cornice'],
      [-2, -1, 'frieze_cornice'],
      [-2, 0, 'frieze_cornice'],
      [-2, 1, 'frieze_cornice'],
      [2, -1, 'frieze_cornice'],
      [2, 0, 'frieze_cornice'],
      [2, 1, 'frieze_cornice'],
      // Central Triangular Classical Pediment ("Fronton Triangulaire") crowning the Colonnade (3)
      [-1, 2, 'pediment_left'],
      [0, 2, 'pediment_center'],
      [1, 2, 'pediment_right'],
    ];
    tier3Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 2, gx, gy: 2, gz, pieceType });
    });

    // TIER 4 (layer 3, gy = 3) — 10 Blocks: Toitures des Ailes & Grande Verrière Centrale
    const tier4Cells = [
      // 4 Welded Beaux-Arts Blue-Grey Slate Roofs crowning the West & East Exhibition Wings
      [-2, -1, 'wing_roof'],
      [-2, 0, 'wing_roof'],
      [2, -1, 'wing_roof'],
      [2, 0, 'wing_roof'],
      // 6 Seamless Translucent Glass-and-Iron Atrium Skylight Vault Panels (3x2 Grande Verrière!)
      [-1, -1, 'verriere_glass'],
      [0, -1, 'verriere_glass'],
      [1, -1, 'verriere_glass'],
      [-1, 0, 'verriere_glass'],
      [0, 0, 'verriere_glass'],
      [1, 0, 'verriere_glass'],
    ];
    tier4Cells.forEach(([gx, gz, pieceType]) => {
      blueprint.push({ layer: 3, gx, gy: 3, gz, pieceType });
    });

    this.pyramidSlots = [];
    this.slotGridMap.clear();
    this.activeLayer = 0;
    this.maxLayerIndex = 3;

    blueprint.forEach((cell, idx) => {
      const worldX = pc.x + this._mx(cell.gx * MUSEUM_STEP);
      const layerBaseY = FOUNDATION_Y + cell.gy * BLOCK_H;
      const worldY = layerBaseY + BLOCK_H * 0.5;
      const worldZ = pc.z + cell.gz * MUSEUM_STEP;

      let gGeo = this.geos.ghostBox;
      let eGeo = this.geos.ghostBoxEdges;
      if (cell.pieceType === 'grand_stair') {
        gGeo = this.geos.grandStair;
        eGeo = this.geos.ghostStairEdges;
      } else if (cell.pieceType === 'fluted_column') {
        gGeo = this.geos.ghostCol;
        eGeo = this.geos.ghostColEdges;
      } else if (cell.pieceType === 'pediment_left') {
        gGeo = this.geos.pedimentLeft;
        eGeo = this.geos.ghostPedimentLeftEdges;
      } else if (cell.pieceType === 'pediment_center') {
        gGeo = this.geos.pedimentCenter;
        eGeo = this.geos.ghostPedimentCenterEdges;
      } else if (cell.pieceType === 'pediment_right') {
        gGeo = this.geos.pedimentRight;
        eGeo = this.geos.ghostPedimentRightEdges;
      } else if (cell.pieceType === 'wing_roof' || cell.pieceType === 'verriere_glass') {
        gGeo = this.geos.ghostRoof;
        eGeo = this.geos.ghostRoofEdges;
      }

      const ghostGroup = new THREE.Group();
      ghostGroup.position.set(worldX, worldY + 0.02, worldZ);

      const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
      ghostMesh.renderOrder = 5;
      const ghostLines = new THREE.LineSegments(eGeo, this.mats.ghostLineNormal);
      ghostLines.renderOrder = 6;
      ghostGroup.add(ghostMesh);
      ghostGroup.add(ghostLines);
      ghostGroup.visible = cell.layer === 0;
      site.add(ghostGroup);

      const slot = {
        id: `museum_${cell.layer}_${idx}`,
        zoneType: 'pyramid',
        layer: cell.layer,
        gridX: cell.gx,
        gridY: cell.gy,
        gridZ: cell.gz,
        pieceType: cell.pieceType,
        accepts: ['carved', 'capstone'],
        isCapstone: false,
        position: new THREE.Vector3(worldX, worldY, worldZ),
        dropIndicatorY: layerBaseY + 0.04,
        ghostGroup,
        ghostMesh,
        ghostLines,
        block: null,
      };

      this.pyramidSlots.push(slot);
      this.slotGridMap.set(`${cell.gx},${cell.gy},${cell.gz}`, slot);
    });

    this.totalGoal = this.pyramidSlots.length;
    this.root.add(site);
  }

  /* ============================================================================
   * 6. ZERO-GAP CONNECTED MASONRY, WING ROOFS & SEAMLESS GLASS VERRIÈRE MERGING
   * ========================================================================== */
  _getMasonryBlockDimensions() {
    return { w: BLOCK_W, h: BLOCK_H, d: BLOCK_D, bevel: 0.028 };
  }

  _isConnectableMasonrySlot(slot) {
    return Boolean(
      slot &&
        slot.block &&
        slot.pieceType !== 'grand_stair' &&
        slot.pieceType !== 'fluted_column' &&
        slot.pieceType !== 'pediment_left' &&
        slot.pieceType !== 'pediment_center' &&
        slot.pieceType !== 'pediment_right' &&
        slot.pieceType !== 'wing_roof' &&
        slot.pieceType !== 'verriere_glass'
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
    if (remaining.some((s) => s.pieceType === 'verriere_glass')) return 'verriere_glass';
    if (remaining.some((s) => s.pieceType === 'wing_roof')) return 'wing_roof';
    if (remaining.some((s) => s.pieceType === 'pediment_center')) return 'pediment_center';
    if (remaining.some((s) => s.pieceType === 'pediment_left')) return 'pediment_left';
    if (remaining.some((s) => s.pieceType === 'pediment_right')) return 'pediment_right';
    if (remaining.some((s) => s.pieceType === 'frieze_cornice')) return 'frieze_cornice';
    if (remaining.some((s) => s.pieceType === 'fluted_column')) return 'fluted_column';
    if (remaining.some((s) => s.pieceType === 'gallery_window')) return 'gallery_window';
    if (remaining.some((s) => s.pieceType === 'gallery_wall')) return 'gallery_wall';
    if (remaining.some((s) => s.pieceType === 'grand_stair')) return 'grand_stair';
    return 'podium_base';
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyMuseumPieceVisual(block, pieceType, false);
    }
    return stillRaw;
  }

  _clearCustomBlockAttachments(block) {
    if (!block || !block.customAttach) return;
    block.mesh.remove(block.customAttach);
    block.customAttach = null;
  }

  _applyMuseumPieceVisual(block, pieceType, isPlaced = false) {
    block.pieceType = pieceType;
    this._clearCustomBlockAttachments(block);

    if (pieceType === 'grand_stair') {
      block.mesh.geometry = this.geos.grandStair;
      block.mesh.material = this.museum.materials.flutedMarble;
      return;
    }

    if (pieceType === 'fluted_column') {
      block.mesh.geometry = this.geos.flutedCol;
      block.mesh.material = this.museum.materials.flutedMarble;
      if (isPlaced) {
        this._attachColumnCapitalAndPlinth(block);
      }
      return;
    }

    if (pieceType === 'pediment_left' || pieceType === 'pediment_center' || pieceType === 'pediment_right') {
      block.mesh.geometry =
        pieceType === 'pediment_left'
          ? this.geos.pedimentLeft
          : pieceType === 'pediment_right'
            ? this.geos.pedimentRight
            : this.geos.pedimentCenter;
      block.mesh.material = this.museum.materials.pedimentFrieze;
      if (isPlaced && pieceType === 'pediment_center') {
        this._attachPedimentGoldCrest(block);
      }
      return;
    }

    if (pieceType === 'verriere_glass') {
      block.mesh.geometry = this.geos.verrierePreview;
      block.mesh.material = this.museum.materials.verriereGlass;
      return;
    }

    if (pieceType === 'wing_roof') {
      block.mesh.geometry = this.geos.wingRoofPreview;
      block.mesh.material = this.museum.materials.wingSlateRoof;
      return;
    }

    if (pieceType === 'frieze_cornice') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.museum.materials.pedimentFrieze;
      return;
    }

    if (pieceType === 'gallery_window') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.museum.materials.galleryArchedWindow;
      return;
    }

    if (pieceType === 'gallery_wall') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.museum.materials.museumLimestone;
      return;
    }

    block.mesh.geometry = this.geos.carvedBlock;
    block.mesh.material = this.museum.materials.podiumStone;
  }

  _isRoofSlot(slot) {
    return Boolean(slot && slot.block && (slot.pieceType === 'wing_roof' || slot.pieceType === 'verriere_glass'));
  }

  _computeRoofNeighborMask(slot) {
    if (!this._isRoofSlot(slot)) return 0;
    const { gridX: gx, gridY: gy, gridZ: gz, pieceType } = slot;
    const matches = (nb) => Boolean(nb && nb.block && nb.pieceType === pieceType);
    let mask = 0;
    if (matches(this.slotGridMap.get(`${gx + 1},${gy},${gz}`))) mask |= NEIGHBOR_PX;
    if (matches(this.slotGridMap.get(`${gx - 1},${gy},${gz}`))) mask |= NEIGHBOR_NX;
    if (matches(this.slotGridMap.get(`${gx},${gy},${gz + 1}`))) mask |= NEIGHBOR_PZ;
    if (matches(this.slotGridMap.get(`${gx},${gy},${gz - 1}`))) mask |= NEIGHBOR_NZ;
    return mask;
  }

  _applyConnectedRoof(slot) {
    if (!this._isRoofSlot(slot)) return;
    const mask = this._computeRoofNeighborMask(slot);
    slot.block.roofMask = mask;
    slot.block.mesh.rotation.set(0, 0, 0);

    if (slot.pieceType === 'wing_roof') {
      // Seamless blue-grey Beaux-Arts pitched wing roofs welding along Z
      slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
        BLOCK_W,
        BLOCK_H * 0.9,
        BLOCK_D,
        mask,
        { style: 'gable', defaultAxis: 'z', eaveOverhang: 0.02 }
      );
    } else {
      // Seamless translucent Glass-and-Iron Atrium Verrière welding across all 6 central skylight panels!
      slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
        BLOCK_W,
        BLOCK_H * 0.96,
        BLOCK_D,
        mask,
        { style: 'gable', defaultAxis: 'x', eaveOverhang: 0.02 }
      );

      // Reveal the crowning central Glass-and-Iron Rotunda Cupola once all 6 Verrière bays lock in!
      if (this.rotundaCupolaGroup && !this.rotundaCupolaGroup.visible) {
        const allGlassDone = this.pyramidSlots
          .filter((s) => s.pieceType === 'verriere_glass')
          .every((s) => Boolean(s.block));
        if (allGlassDone) {
          this.rotundaCupolaGroup.visible = true;
        }
      }
    }
  }

  _updateConnectedRoofAround(slot) {
    if (!slot || (slot.pieceType !== 'wing_roof' && slot.pieceType !== 'verriere_glass')) return;
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

  _attachColumnCapitalAndPlinth(block) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(this.geos.colBase, this.museum.materials.flutedMarble);
    base.position.y = -BLOCK_H * 0.5 + 0.052;
    group.add(base);

    const cap = new THREE.Mesh(this.geos.colCap, this.museum.materials.flutedMarble);
    cap.position.y = BLOCK_H * 0.5 - 0.052;
    group.add(cap);

    block.mesh.add(group);
    block.customAttach = group;
  }

  _attachPedimentGoldCrest(block) {
    const group = new THREE.Group();
    const crest = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12)),
      this.museum.materials.brassMetal
    );
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 0.12, BLOCK_D * 0.5 + 0.015);
    group.add(crest);

    // Classical golden acroterion finial crowning the triangular pediment apex
    const apex = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.11, 0)),
      this.museum.materials.brassMetal
    );
    apex.position.set(0, BLOCK_H * 0.94, 0);
    group.add(apex);

    block.mesh.add(group);
    block.customAttach = group;
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyMuseumPieceVisual(block, slot.pieceType, true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }

    const dustMat =
      slot.pieceType === 'verriere_glass' ? this.mats.dustGlass : this.mats.dustMarble;

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
   * 7. COMPLETION CELEBRATION (+360 PIÈCES D'OR, +45 ÉCLATS & GOLDEN SPOTLIGHT)
   * ========================================================================== */
  _triggerCompletionSequence() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    if (this.rotundaCupolaGroup) this.rotundaCupolaGroup.visible = true;

    const pc = this.pyramidCenter;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(pc.x, FOUNDATION_Y + 3.4, pc.z);

    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.58, 2.05, 7.2, 18, 1, true));
    innerGeo.translate(0, 2.8, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xfff0b2,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(1.0, 2.65, 6.6, 18, 1, true));
    outerGeo.translate(0, 2.5, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xa4ecff,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.95, 1.88, 30));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe48a,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.25;
    this.victoryGroup.add(this.victoryHalo);

    this.root.add(this.victoryGroup);

    // Golden spotlight & skylight crystal celebration burst
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 2.9, pc.z), {
      count: 26,
      material: this.mats.goldSpark,
      speed: 3.6,
      upSpeed: 4.3,
      scale: 0.92,
      life: 1.2,
    });
    this._spawnParticles(new THREE.Vector3(pc.x, FOUNDATION_Y + 2.4, pc.z), {
      count: 18,
      material: this.mats.dustGlass,
      speed: 3.0,
      upSpeed: 3.7,
      scale: 0.85,
      life: 1.1,
    });

    if (this.onComplete) {
      this.onComplete({
        levelId: Level9Museum.meta.id,
        focusPoint: new THREE.Vector3(pc.x, FOUNDATION_Y + 2.05, pc.z),
        rewardCoins: 360,
        firstCompletionTokens: 45,
      });
    }
  }

  /* ============================================================================
   * 8. REAL-TIME ANIMATION LOOP (CARTS, REFLECTING POOL, FOUNTAIN & LAMPPOSTS)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Spin brass-hubbed museum cart wheels along guided tracks
    for (let i = 0; i < this.cartWheels.length; i++) {
      const cw = this.cartWheels[i];
      const coord = cw.sled.axis === 'z' ? cw.sled.group.position.z : cw.sled.group.position.x;
      const delta = coord - cw.lastCoord;
      cw.lastCoord = coord;
      if (Math.abs(delta) > 0.0001) {
        cw.mesh.rotation.x += delta / 0.17;
      }
    }

    // 2. Gentle sunlight shimmer across the turquoise reflecting pool
    if (this.poolWaterMesh && this.poolWaterMesh.material && this.poolWaterMesh.material.normalMap) {
      this.poolWaterMesh.material.normalMap.offset.x = (elapsed * 0.018) % 1;
      this.poolWaterMesh.material.normalMap.offset.y = (elapsed * 0.012) % 1;
    }

    // 3. Expanding tranquil concentric water ripples around the fountain centerpiece
    for (let i = 0; i < this.fountainRings.length; i++) {
      const fr = this.fountainRings[i];
      const t = (elapsed * 0.35 + fr.phase) % 1;
      const s = 0.65 + t * 1.45;
      fr.mesh.scale.set(s, s, 1);
    }

    // 4. Soft warm pulse on Parisian wrought-iron lamppost globes
    for (let i = 0; i < this.lampGlobes.length; i++) {
      const l = this.lampGlobes[i];
      const pulse = 0.94 + Math.sin(elapsed * 2.0 + l.phase) * 0.06;
      l.mesh.scale.setScalar(pulse);
    }

    // 5. Cozy 3D grass sway
    if (this.cozyFoliageSystem && typeof this.cozyFoliageSystem.update === 'function') {
      this.cozyFoliageSystem.update(elapsed);
    }

    // 6. Post-completion golden spotlight & skylight sparkles
    if (this.isComplete) {
      this.victorySparkTimer += dt;
      if (this.victorySparkTimer >= 0.72) {
        this.victorySparkTimer = 0;
        const pc = this.pyramidCenter;
        this._spawnParticles(
          new THREE.Vector3(
            pc.x + (Math.random() - 0.5) * 3.4,
            FOUNDATION_Y + 2.2 + Math.random() * 1.2,
            pc.z + (Math.random() - 0.5) * 2.6
          ),
          {
            count: 3,
            material: Math.random() < 0.55 ? this.mats.goldSpark : this.mats.dustGlass,
            speed: 0.75,
            upSpeed: 1.55,
            scale: 0.66,
            life: 0.98,
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
