/**
 * Workd Builder — Level 5: « Pénitencier Américain – Années 1800 » (50 Blocks)
 * Old West / Eastern State Penitentiary inspired 19th-century stone & dark-red-brick
 * prison compound featuring:
 *  - Sculpted 128x128 dusty ochre-brown frontier terrain with grey crushed gravel paths
 *    and soft American West morning mist
 *  - Timber log stockade palisade, grey stone perimeter walls, corner wooden watchtower
 *    (mirador), dry western pines, and granite boulders
 *  - Grey Granite & Red Clay Quarry with wooden scaffolding, pulley hoist, and open-sided
 *    patinated corrugated-tin canopy (zero obstructing side walls)
 *  - Automatic 19th-century two-wheeled wooden handcarts (chariots à bras à deux roues)
 *    with spinning spoked wheels shuttling raw blocks from quarry to workshop
 *  - Open-roof Stonecutter & Blacksmith Forge Workshop (anvil, workbench, glowing embers)
 *  - 5-Stage Progressive Zero-Gap Connected Penitentiary Monument:
 *      1) Massive grey granite foundations framing a central gravel inner courtyard
 *      2) Thick cut grey granite perimeter walls with narrow loopholes & stone buttresses
 *      3) Dark-red brick cellblock wings with black wrought-iron barred cell doors
 *      4) Double-pitched dark slate roof & twin brick chimneys
 *      5) Octagonal central guard tower with bronze bell, glowing lantern & 1800s US flag (stars in a circle)
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
} from '../foliageAndGround.js';

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;
const GRID_STEP = BLOCK_W;
const PRISON_CENTER = new THREE.Vector3(3.6, 0, -0.8);
const FOUNDATION_Y = 0.24;

const TERRAIN_W = 20.4;
const TERRAIN_D = 19.2;
const TERRAIN_SEGS = 128;

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
 * Unified 128x128 American Old West frontier plateau heightfield.
 * Gentle dusty mesa ridges around perimeter, excavated grey granite & red clay quarry pit in NW,
 * and level compacted gravel pads for the workshop, wheel-tracks, and penitentiary yard.
 */
function samplePenitentiaryTerrainHeight(x, z) {
  const ridgeWave =
    Math.sin(x * 0.28 + z * 0.22 + 0.4) * 0.28 +
    Math.cos(x * 0.21 - z * 0.29) * 0.24 +
    Math.sin(x * 0.62 + z * 0.48) * 0.08;

  const edgeX = smoothstep(6.2, 10.1, Math.abs(x));
  const edgeZ = smoothstep(5.6, 9.5, Math.abs(z));
  const mesaRing = clamp01(Math.max(edgeX, edgeZ));
  let h = (0.22 + ridgeWave) * mesaRing + mesaRing * mesaRing * 0.92;

  // Flat compacted pads under all 4 stations & central penitentiary yard
  const flatQuarryPad = rectFlatMask(x, z, -4.6, -3.15, 2.95, 1.4, 1.2);
  const flatTrackA = rectFlatMask(x, z, -4.6, 0.2, 1.5, 2.85, 1.05);
  const flatWorkshop = rectFlatMask(x, z, -4.6, 5.0, 2.8, 2.3, 1.25);
  const flatTrackB = rectFlatMask(x, z, -0.3, 4.75, 2.85, 1.45, 1.1);
  const flatPallet = rectFlatMask(x, z, 4.1, 4.75, 1.9, 1.7, 1.15);
  const flatPrison = rectFlatMask(x, z, PRISON_CENTER.x, PRISON_CENTER.z + 0.15, 3.65, 3.65, 1.35);

  const flatMask = Math.max(
    flatQuarryPad,
    flatTrackA,
    flatWorkshop,
    flatTrackB,
    flatPallet,
    flatPrison
  );
  h *= 1.0 - flatMask;

  // Excavated Grey Granite & Red Clay quarry bench in NW
  const qDist = Math.hypot((x + 4.6) / 3.0, (z + 4.8) / 1.45);
  const qPit = 1.0 - smoothstep(0.62, 1.15, qDist);
  h -= qPit * 0.2;

  const cliffBack =
    smoothstep(-5.1, -7.4, z) * (1.0 - smoothstep(2.5, 5.4, Math.abs(x + 4.6)));
  h += cliffBack * 0.88;

  return h;
}

/**
 * 4-Biome GPU splat weights for Level 5 (1800s American Penitentiary):
 *   w0 = Dusty ochre-brown frontier earth
 *   w1 = Compacted grey crushed gravel paths & prison courtyard
 *   w2 = Grey granite dust & red clay quarry floor
 *   w3 = Parched frontier scrub & pine verge along outer perimeter
 */
function computePenitentiarySplatWeights(x, z) {
  // Quarry & blacksmith dust zone
  const quarryZone = 1.0 - smoothstep(2.2, 4.5, Math.hypot(x + 4.6, z + 4.5));
  const wsZone = 1.0 - smoothstep(2.0, 3.7, Math.hypot(x + 4.6, z - 5.0));
  const wQuarry = clamp01(Math.max(quarryZone, wsZone * 0.65));

  // Grey crushed gravel paths along both cart tracks & penitentiary compound yard
  const dTrackA = segmentDist(x, z, -4.6, -2.6, -4.6, 2.8);
  const dTrackB = segmentDist(x, z, -2.5, 4.8, 3.8, 4.8);
  const dYardRoad = segmentDist(x, z, 3.6, 2.1, 3.6, 4.8);
  const yardZone = 1.0 - smoothstep(2.9, 4.4, Math.hypot(x - PRISON_CENTER.x, z - PRISON_CENTER.z));
  const roadDist = Math.min(dTrackA, dTrackB, dYardRoad);
  const wGravel = clamp01(Math.max(1.0 - smoothstep(0.85, 1.95, roadDist), yardZone * 0.94));

  // Parched frontier scrub near outer mesa edges
  const edge = Math.max(smoothstep(6.0, 9.2, Math.abs(x)), smoothstep(5.4, 8.6, Math.abs(z)));
  const wScrub = clamp01(edge * 0.88);

  const used = clamp01(wQuarry * 0.92 + wGravel * 0.94 + wScrub * 0.82);
  let w0 = Math.max(0.16, 1.0 - used); // Dusty ochre-brown earth everywhere
  let w1 = wGravel;
  let w2 = wQuarry * (1.0 - wGravel * 0.55);
  let w3 = wScrub * (1.0 - wGravel * 0.7);

  const sum = w0 + w1 + w2 + w3;
  return { w0: w0 / sum, w1: w1 / sum, w2: w2 / sum, w3: w3 / sum };
}

/**
 * Builds a clean double-pitched (gable) dark slate roof block geometry (zero-gap fit on BLOCK_W x BLOCK_D).
 */
function createDoublePitchedSlateGeometry(w = BLOCK_W, h = BLOCK_H, d = BLOCK_D) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const eaveY = -h * 0.5 + 0.14;
  const ridgeY = h * 0.5 + 0.08;
  const botY = -h * 0.5;

  // Extrude triangular gable cross-section along X (ridge running along X; rotateY(PI/2) for Z wings)
  const shape = new THREE.Shape();
  shape.moveTo(-hd, botY);
  shape.lineTo(hd, botY);
  shape.lineTo(hd, eaveY);
  shape.lineTo(0, ridgeY);
  shape.lineTo(-hd, eaveY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: w,
    bevelEnabled: false,
    steps: 1,
  });
  geo.translate(0, 0, -hw);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Defines the 50-block, 5-Stage Progressive Blueprint for « Pénitencier Américain – Années 1800 »:
 *   Stage 1 (layer 0 — 16 blocks): Massive grey granite foundations framing the open central courtyard (5x5 perimeter)
 *   Stage 2 (layer 1 — 14 blocks): Thick cut grey granite outer walls with narrow loopholes (open sallyport gate at [0, 2])
 *   Stage 3 (layer 2 — 10 blocks): Dark-red brick cellblock wings with black wrought-iron barred doors (North + West + East wings)
 *   Stage 4 (layer 3 —  9 blocks): Double-pitched dark slate roofing covering the cellblock wings + twin brick chimneys
 *   Stage 5 (layer 4 —  1 block ): Crowning Octagonal Central Guard Tower with bronze bell, lantern & 1800s US flag!
 */
function buildPenitentiaryBlueprintTiers() {
  // Stage 1 (layer 0 — 16 blocks): 5x5 perimeter foundation framing open inner courtyard
  const stage1 = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) === 2 || Math.abs(gz) === 2) {
        stage1.push({ dx: gx, dz: gz, pieceType: 'foundation', rotY: 0 });
      }
    }
  }

  // Stage 2 (layer 1 — 14 blocks): Thick grey granite outer walls with narrow loopholes
  // Leaves [0, 2] open as the main front arched iron sallyport entrance, and [±1, 2] as flanking gate towers
  const stage2 = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) !== 2 && Math.abs(gz) !== 2) continue;
      if (gx === 0 && gz === 2) continue; // Arched prison sallyport entrance
      if (Math.abs(gx) === 2 && gz === 2) continue; // Chamfered front entry plaza corners (keeps 14 blocks!)
      stage2.push({ dx: gx, dz: gz, pieceType: 'granite_wall', rotY: 0 });
    }
  }
  // Ensure exact 14 blocks: 5x5 perimeter = 16 -> minus [0,2], minus [-2,2] & [2,2]? Wait: 16 - 3 = 13!
  // Let's keep ALL 4 corners and only leave [0, 2] open + add inner courtyard entrance piers? Wait: 16 - 1 = 15, or leave [-1,2] & [1,2]?
  // Better: Keep all 4 fortress corners so the perimeter wall looks rock-solid & imposing!
  // 5x5 perimeter = 16 -> omit [0, 2] (main sallyport gate) = 15 blocks! Let's check total: 16 + 15 + 10 + 8 + 1 = 50 blocks exact!
  stage2.length = 0;
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) !== 2 && Math.abs(gz) !== 2) continue;
      if (gx === 0 && gz === 2) continue; // Main front wrought-iron sallyport gate
      stage2.push({ dx: gx, dz: gz, pieceType: 'granite_wall', rotY: 0 });
    }
  }
  // stage2 = 15 blocks!

  // Stage 3 (layer 2 — 9 blocks): U-shaped Dark-Red Brick Cellblock Wings (North + West + East wings)
  const stage3 = [
    // North main cellblock row (5 blocks along gz = -2)
    { dx: -2, dz: -2, pieceType: 'brick_cell', rotY: 0 },
    { dx: -1, dz: -2, pieceType: 'brick_cell', rotY: 0 },
    { dx: 0, dz: -2, pieceType: 'brick_cell', rotY: 0 },
    { dx: 1, dz: -2, pieceType: 'brick_cell', rotY: 0 },
    { dx: 2, dz: -2, pieceType: 'brick_cell', rotY: 0 },
    // West & East cellblock wings (gz = -1, 0)
    { dx: -2, dz: -1, pieceType: 'brick_cell', rotY: Math.PI / 2 },
    { dx: -2, dz: 0, pieceType: 'brick_cell', rotY: Math.PI / 2 },
    { dx: 2, dz: -1, pieceType: 'brick_cell', rotY: -Math.PI / 2 },
    { dx: 2, dz: 0, pieceType: 'brick_cell', rotY: -Math.PI / 2 },
  ];
  // stage3 = 9 blocks!

  // Stage 4 (layer 3 — 9 blocks): Double-pitched dark slate roof covering 100% of all 9 cellblock wings
  const stage4 = [
    // North wing pitched slate roof (ridge along X)
    { dx: -2, dz: -2, pieceType: 'slate_roof', rotY: 0 },
    { dx: -1, dz: -2, pieceType: 'slate_roof', rotY: 0 },
    { dx: 0, dz: -2, pieceType: 'slate_roof', rotY: 0 },
    { dx: 1, dz: -2, pieceType: 'slate_roof', rotY: 0 },
    { dx: 2, dz: -2, pieceType: 'slate_roof', rotY: 0 },
    // West & East wing pitched slate roofs (ridge along Z)
    { dx: -2, dz: -1, pieceType: 'slate_roof', rotY: Math.PI / 2 },
    { dx: -2, dz: 0, pieceType: 'slate_roof', rotY: Math.PI / 2 },
    { dx: 2, dz: -1, pieceType: 'slate_roof', rotY: Math.PI / 2 },
    { dx: 2, dz: 0, pieceType: 'slate_roof', rotY: Math.PI / 2 },
  ];
  // stage4 = 9 blocks! (16 + 15 + 9 + 9 = 49 blocks + 1 guard tower = 50 blocks exact!)

  // Stage 5 (layer 4 — 1 crowning block = 50th block!): Central Octagonal Guard Tower
  // Placed directly over the center of the courtyard hub [0, 0] rising high above the compound!
  const stage5 = [{ dx: 0, dz: 0, pieceType: 'guard_tower', rotY: 0 }];

  return [stage1, stage2, stage3, stage4, stage5];
}

export class Level5Penitentiary extends Level1Pyramid {
  static meta = {
    id: 'level5_penitentiary',
    title: 'Niveau 5 : Pénitencier Américain – Années 1800 (50 blocs)',
    hudLabel: 'Pénitencier 1800',
    skyColor: '#dfd0b8',
    totalGoal: 50,
    rewardCoins: 225,
    firstCompletionTokens: 30,
    rewardFurniture: ['item_13', 'item_14'],
  };

  constructor(opts) {
    super({
      ...opts,
      runConfig: null,
    });
    this.root.name = 'Level5PenitentiaryRoot';
    this.totalGoal = Level5Penitentiary.meta.totalGoal;
    this.hudLabel = Level5Penitentiary.meta.hudLabel;
  }

  _beforeBuild() {
    this.pen = this.textures.ensurePenitentiaryPack();
    this.totalGoal = Level5Penitentiary.meta.totalGoal;
    this.hudLabel = Level5Penitentiary.meta.hudLabel;
    this.pyramidCenter = new THREE.Vector3(this._mx(PRISON_CENTER.x), 0, PRISON_CENTER.z);

    // Animated & staged elements
    this.handcartWheels = [];
    this.handcartAutoTimers = new Map();
    this.forgeEmberMesh = null;
    this.forgeSparks = [];
    this.watchtowerLantern = null;
    this.buttressMeshes = [];
    this.catwalkMeshes = [];
    this.chimneyMeshes = [];
    this.chimneySmoke = [];
    this.sallyportGateMesh = null;
    this.centralTowerGroup = null;
    this.towerBellPivot = null;
    this.towerLanternMat = null;
    this.towerFlagMesh = null;
    this.victoryMotes = [];
    this.quarrySpawnCounter = 0;
  }

  _initSharedGeometries() {
    super._initSharedGeometries();

    // Swap default raw & carved materials to 1800s grey granite & dark brick
    this.rawGraniteMat = this.pen.materials.rawGranite;
    this.rawClayMat = this.pen.materials.rawRedClay;
    this.carvedBlockMat = this.pen.materials.dressedGranite;

    // Double-pitched dark slate roof geometry + ghost preview
    this.geos.slateRoof = this._trackGeo(createDoublePitchedSlateGeometry(BLOCK_W, BLOCK_H, BLOCK_D));
    this.geos.ghostSlate = this._trackGeo(
      createDoublePitchedSlateGeometry(BLOCK_W * 0.94, BLOCK_H * 0.92, BLOCK_D * 0.94)
    );
    this.geos.ghostSlateEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostSlate));

    // Octagonal Guard Tower preview geometry for workbench crafting & ghost slot
    this.geos.towerPreview = this._trackGeo(new THREE.CylinderGeometry(0.42, 0.5, 0.88, 8));
    this.geos.ghostTower = this._trackGeo(new THREE.CylinderGeometry(0.54, 0.68, 2.35, 8));
    this.geos.ghostTowerEdges = this._trackGeo(new THREE.EdgesGeometry(this.geos.ghostTower));

    // Stone dust & ember particle materials
    this.mats.dustGranite = this._trackMat(
      new THREE.MeshStandardMaterial({ color: 0xa5a8ab, roughness: 0.94 })
    );
    this.mats.dustBrick = this._trackMat(
      new THREE.MeshStandardMaterial({ color: 0x9b4534, roughness: 0.92 })
    );
    this.mats.forgeSpark = this._trackMat(
      new THREE.MeshBasicMaterial({ color: 0xffa638, transparent: true, opacity: 0.9 })
    );
  }

  getTerrainHeight(x, z) {
    return samplePenitentiaryTerrainHeight(x * this.mirrorX, z);
  }

  /* ============================================================================
   * 1. DUSTY OCHRE-BROWN FRONTIER TERRAIN, PALISADE, STONE WALLS & WATCHTOWER
   * ========================================================================== */
  _buildDioramaBase() {
    const env = new THREE.Group();
    this.root.add(env);

    // 1. Unified 128x128 sculpted Old West frontier terrain with 4-biome GPU splatting
    const terrainGeo = this._trackGeo(
      new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEGS, TERRAIN_SEGS)
    );
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const count = pos.count;
    const splats = new Float32Array(count * 4);
    const wetness = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const wx = pos.getX(i);
      const sx = wx * this.mirrorX;
      const wz = pos.getZ(i);
      const h = samplePenitentiaryTerrainHeight(sx, wz);
      pos.setY(i, h);

      const { w0, w1, w2, w3 } = computePenitentiarySplatWeights(sx, wz);
      splats[i * 4] = w0;
      splats[i * 4 + 1] = w1;
      splats[i * 4 + 2] = w2;
      splats[i * 4 + 3] = w3;
      wetness[i] = 0.0;
    }

    pos.needsUpdate = true;
    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splats, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetness, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.pen.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    env.add(terrainMesh);

    // 2. Contoured geological plinth skirt
    const skirt = new THREE.Mesh(this._buildContouredPlinthSkirt(), this.textures.materials.plinth);
    skirt.receiveShadow = true;
    env.add(skirt);

    const bottomCapGeo = this._trackGeo(new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D));
    bottomCapGeo.rotateX(Math.PI / 2);
    const bottomCap = new THREE.Mesh(bottomCapGeo, this.textures.materials.plinth);
    bottomCap.position.y = -2.25;
    env.add(bottomCap);

    // 3. Perimeter Wooden Log Stockade Palisade (InstancedMesh) & Stone Compound Boundary Walls
    this._buildPerimeterPalisadeAndWalls(env);

    // 4. Corner Wooden Guard Watchtower (Mirador en bois, North-East)
    this._buildCornerWatchtower(env, this._mx(7.85), -6.85);

    // 5. Dry Western Pines & Rough Grey Granite Boulders
    this._buildDryPinesAndRocks(env);
  }

  _buildPerimeterPalisadeAndWalls(parent) {
    // Timber log palisade stakes along West edge & South-West/North-West frontier edges
    const stakePositions = [];
    // West stockade line (x = -9.15, z from -6.6 to 7.4)
    for (let z = -6.6; z <= 7.45; z += 0.36) {
      stakePositions.push([this._mx(-9.15), z, 1.38 + (Math.abs(Math.sin(z * 3.1)) * 0.24)]);
    }
    // South stockade line (z = 8.45, x from -8.8 to 2.2)
    for (let x = -8.8; x <= 2.25; x += 0.36) {
      stakePositions.push([this._mx(x), 8.45, 1.32 + (Math.abs(Math.cos(x * 2.7)) * 0.22)]);
    }

    const stakeGeo = this._trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 1.0, 6));
    const tipGeo = this._trackGeo(new THREE.ConeGeometry(0.11, 0.24, 6));
    const stakeInst = new THREE.InstancedMesh(
      stakeGeo,
      this.pen.materials.palisadeLog,
      stakePositions.length
    );
    const tipInst = new THREE.InstancedMesh(
      tipGeo,
      this.pen.materials.darkOak,
      stakePositions.length
    );
    stakeInst.castShadow = true;
    stakeInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < stakePositions.length; i++) {
      const [wx, wz, h] = stakePositions[i];
      const gy = this.getTerrainHeight(wx, wz);
      dummy.position.set(wx, gy + h * 0.5 - 0.08, wz);
      dummy.rotation.set(0, (i * 0.7) % 3, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      stakeInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(wx, gy + h + 0.04, wz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tipInst.setMatrixAt(i, dummy.matrix);
    }
    stakeInst.instanceMatrix.needsUpdate = true;
    tipInst.instanceMatrix.needsUpdate = true;
    parent.add(stakeInst, tipInst);

    // Grey Stone Perimeter Boundary Wall sections along North & East edges of the penitentiary compound
    const wallSpecs = [
      { x: 3.5, z: -8.35, w: 8.6, h: 1.45, d: 0.55 }, // North granite wall
      { x: 9.15, z: -1.8, w: 0.55, h: 1.45, d: 11.4 }, // East granite wall
      { x: 6.8, z: 8.45, w: 4.9, h: 1.35, d: 0.55 }, // South-East granite boundary wall
    ];
    wallSpecs.forEach((ws) => {
      const wx = this._mx(ws.x);
      const gy = this.getTerrainHeight(wx, ws.z);
      const wall = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(ws.w, ws.h, ws.d)),
        this.pen.materials.dressedGranite
      );
      wall.position.set(wx, gy + ws.h * 0.5 - 0.12, ws.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      parent.add(wall);

      // Cut stone coping cap on top of boundary wall
      const cap = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(ws.w + 0.14, 0.14, ws.d + 0.14)),
        this.pen.materials.graniteCliff
      );
      cap.position.set(wx, gy + ws.h - 0.05, ws.z);
      cap.castShadow = true;
      parent.add(cap);
    });
  }

  _buildCornerWatchtower(parent, x, z) {
    const gy = this.getTerrainHeight(x, z);
    const tower = new THREE.Group();
    tower.position.set(x, gy - 0.05, z);

    // 4 heavy timber legs + diagonal X-bracing
    const legGeo = this._trackGeo(new THREE.BoxGeometry(0.14, 2.55, 0.14));
    [
      [-0.56, -0.56],
      [0.56, -0.56],
      [-0.56, 0.56],
      [0.56, 0.56],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, this.pen.materials.darkOak);
      leg.position.set(lx, 1.25, lz);
      leg.castShadow = true;
      tower.add(leg);
    });

    // Horizontal cross-braces
    const braceGeo = this._trackGeo(new THREE.BoxGeometry(1.18, 0.09, 0.09));
    [0.75, 1.55].forEach((by) => {
      [-0.56, 0.56].forEach((bz) => {
        const b = new THREE.Mesh(braceGeo, this.pen.materials.palisadeLog);
        b.position.set(0, by, bz);
        tower.add(b);
      });
    });

    // Elevated wooden sentry platform & plank parapet railing
    const deck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.62, 0.14, 1.62)),
      this.pen.materials.palisadeLog
    );
    deck.position.y = 2.48;
    deck.castShadow = true;
    deck.receiveShadow = true;
    tower.add(deck);

    const railNS = this._trackGeo(new THREE.BoxGeometry(1.58, 0.48, 0.08));
    const railEW = this._trackGeo(new THREE.BoxGeometry(0.08, 0.48, 1.58));
    [
      [railNS, 0, -0.74],
      [railNS, 0, 0.74],
      [railEW, -0.74, 0],
      [railEW, 0.74, 0],
    ].forEach(([geo, rx, rz]) => {
      const r = new THREE.Mesh(geo, this.pen.materials.darkOak);
      r.position.set(rx, 2.78, rz);
      r.castShadow = true;
      tower.add(r);
    });

    // 4 upper corner canopy posts + pitched dark slate lookout roof
    const upGeo = this._trackGeo(new THREE.BoxGeometry(0.09, 1.05, 0.09));
    [
      [-0.68, -0.68],
      [0.68, -0.68],
      [-0.68, 0.68],
      [0.68, 0.68],
    ].forEach(([ux, uz]) => {
      const p = new THREE.Mesh(upGeo, this.pen.materials.darkOak);
      p.position.set(ux, 3.32, uz);
      tower.add(p);
    });

    const roof = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(1.38, 0.78, 4)),
      this.pen.materials.darkSlateRoof
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.18;
    roof.castShadow = true;
    tower.add(roof);

    // Hanging glowing guard lantern under roof eaves
    const lantern = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6)),
      this.pen.materials.lanternGlow
    );
    lantern.position.set(-0.62, 3.62, 0.62);
    tower.add(lantern);
    this.watchtowerLantern = lantern;

    parent.add(tower);
  }

  _buildDryPinesAndRocks(parent) {
    // Sculpted Western Ponderosa Pines with irregular jagged bough strata & exposed roots
    const foliageMat = this._getSharedFoliageMaterial();
    const pineSpecs = [
      [-8.2, -7.2, 1.1],
      [-0.8, -7.8, 0.95],
      [8.35, 3.6, 1.05],
      [8.4, 6.8, 0.92],
      [-8.3, 2.2, 0.88],
      [-7.6, 7.6, 1.0],
    ];
    pineSpecs.forEach(([px, pz, sc], idx) => {
      const wx = this._mx(px);
      const groundY = this.getTerrainHeight(wx, pz);
      const { tree, crown } = buildStylizedFrontierPine({
        x: wx,
        z: pz,
        groundY,
        scale: sc,
        seed: idx + 1,
        barkMat: this.pen.materials.darkOak,
        foliageMat,
        trackGeo: (g) => this._trackGeo(g),
      });
      this.palmFronds.push({ group: crown, phase: wx * 0.55 + pz * 0.45 });
      parent.add(tree);
    });

    // Scattered rugged grey granite rocks along frontier edges
    const rockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.42, 0));
    const rockSpecs = [
      [-7.8, -3.5, 1.15, 0.72, 0.95],
      [-1.5, -5.8, 0.92, 0.65, 0.82],
      [7.9, -4.1, 0.95, 0.58, 0.88],
      [8.2, 1.2, 0.85, 0.55, 0.78],
      [-7.6, 6.8, 0.82, 0.5, 0.75],
    ];
    rockSpecs.forEach(([rx, rz, sx, sy, sz], idx) => {
      const wx = this._mx(rx);
      const gy = this.getTerrainHeight(wx, rz);
      const rock = new THREE.Mesh(rockGeo, this.pen.materials.graniteCliff);
      rock.position.set(wx, gy + sy * 0.22, rz);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(idx * 0.4, idx * 1.1, idx * 0.25);
      rock.castShadow = true;
      rock.receiveShadow = true;
      parent.add(rock);
    });

    // Cozy 3D Instanced Frontier Sage/Golden Grass (860 tufts), Flat Granite Pebbles & Prairie Flowers
    const focalPoints = [
      ...pineSpecs.map(([px, pz]) => ({ x: this._mx(px), z: pz, innerRadius: 0.34, radius: 1.95 })),
      ...rockSpecs.map(([rx, rz]) => ({ x: this._mx(rx), z: rz, innerRadius: 0.4, radius: 1.55 })),
      { x: this._mx(7.1), z: -6.4, innerRadius: 0.95, radius: 2.3 },
    ];
    this.cozyGround = createCozyGroundFoliageSystem({
      parent,
      getTerrainHeight: (x, z) => this.getTerrainHeight(x, z),
      isBlocked: (x, z) => this._isBlockedForFoliage(x, z),
      getGrassWeight: (x, z) => {
        const sx = x * this.mirrorX;
        const { w0: wDirt, w1: wGravel, w2: wQuarry, w3: wScrub } = computePenitentiarySplatWeights(sx, z);
        if (wGravel > 0.28 || wQuarry > 0.34) return 0;
        const borderDist = Math.max(Math.abs(x), Math.abs(z));
        return Math.max(wScrub * 1.35, borderDist > 6.2 ? 0.38 : wDirt * 0.24);
      },
      focalPoints,
      waterLevel: -1.5,
      halfW: TERRAIN_W * 0.5,
      halfD: TERRAIN_D * 0.5,
      grassCount: 860,
      pebbleCount: 125,
      flowerCount: 62,
      grassPalette: ['#7e8d44', '#637538', '#999c4a', '#b3a352', '#566934'],
      pebblePalette: ['#8e8e8b', '#a89f90', '#73767a', '#b8ab96'],
      flowerPalette: ['#fff9e8', '#ffe46b', '#f7cf54'],
      seed: 505,
    });

    // Soft Circular Contact Shadows (AO) under pines, granite boulders, watchtower, quarry, forge & Prison
    const aoEntries = [
      ...pineSpecs.map(([px, pz, sc]) => ({ x: this._mx(px), z: pz, radius: 1.05 * sc, strength: 0.96 })),
      ...rockSpecs.map(([rx, rz, sx, , sz]) => ({
        x: this._mx(rx),
        z: rz,
        radiusX: 0.6 * sx,
        radiusZ: 0.6 * sz,
        strength: 0.95,
      })),
      { x: this._mx(7.1), z: -6.4, radius: 1.45, strength: 0.92 },
      { x: this._mx(-4.7), z: -5.2, radiusX: 3.3, radiusZ: 1.55, strength: 0.72 },
      { x: this._mx(-4.6), z: 4.15, radiusX: 2.35, radiusZ: 2.15, strength: 0.7 },
      { x: this.pyramidCenter.x, z: this.pyramidCenter.z, radiusX: 3.15, radiusZ: 3.15, strength: 0.8 },
    ];
    this.contactShadows = createContactShadowSystem(parent, aoEntries, (x, z) => this.getTerrainHeight(x, z));
  }

  /* ============================================================================
   * 2. STATION 1 — CARRIÈRE DE PIERRE GRISE & ARGILE (NORTH-WEST)
   *    Wooden scaffolding, pulley hoist, open patinated tin roof (NO side walls!)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarryGroup = new THREE.Group();
    this.root.add(quarryGroup);

    // Granite & clay quarry back cliff ledge
    const cliffSpecs = [
      { pos: [-6.5, 0.56, -5.9], size: [2.1, 1.12, 1.8], mat: this.pen.materials.graniteCliff },
      { pos: [-4.6, 0.68, -6.2], size: [2.6, 1.36, 1.9], mat: this.pen.materials.graniteCliff },
      { pos: [-2.7, 0.52, -5.85], size: [2.0, 1.04, 1.7], mat: this.pen.materials.rawRedClay },
    ];
    cliffSpecs.forEach((c) => {
      const m = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(...c.size)), c.mat);
      m.position.set(this._mx(c.pos[0]), c.pos[1], c.pos[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      quarryGroup.add(m);
    });

    // Open-sided wooden quarry scaffolding + pulley hoist + patinated tin/wood canopy (NO side walls!)
    const scaffoldGroup = new THREE.Group();
    quarryGroup.add(scaffoldGroup);

    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.075, 0.09, 2.35, 7));
    const qx = this._mx(-4.6);
    [
      [qx - 2.35, -6.35],
      [qx + 2.35, -6.35],
      [qx - 2.35, -5.15],
      [qx + 2.35, -5.15],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(postGeo, this.pen.materials.darkOak);
      p.position.set(px, 1.25, pz);
      p.castShadow = true;
      scaffoldGroup.add(p);
    });

    // Cross-beams & wooden quarry walkway plank
    const beamX = this._trackGeo(new THREE.BoxGeometry(5.1, 0.11, 0.12));
    [-6.35, -5.15].forEach((bz) => {
      const b = new THREE.Mesh(beamX, this.pen.materials.darkOak);
      b.position.set(qx, 2.34, bz);
      b.castShadow = true;
      scaffoldGroup.add(b);
    });

    // Slanted patinated corrugated-tin quarry roof tucked strictly over rear cliff (leaves rock nodes 100% open!)
    const tinRoof = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.35, 0.08, 1.55)),
      this.pen.materials.corrugatedTin
    );
    tinRoof.position.set(qx, 2.52, -5.85);
    tinRoof.rotation.x = -0.24;
    tinRoof.castShadow = true;
    scaffoldGroup.add(tinRoof);

    // Timber crane boom & iron pulley wheel hoisting over the quarry nodes
    const hoistBeam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.14, 0.14, 1.85)),
      this.pen.materials.darkOak
    );
    hoistBeam.position.set(this._mx(-4.6), 2.28, -5.0);
    hoistBeam.castShadow = true;
    scaffoldGroup.add(hoistBeam);

    const pulleyWheel = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(0.16, 0.04, 7, 14)),
      this.pen.materials.wroughtIron
    );
    pulleyWheel.position.set(this._mx(-4.6), 2.12, -4.3);
    pulleyWheel.rotation.y = Math.PI / 2;
    scaffoldGroup.add(pulleyWheel);

    const hoistRope = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 6)),
      this.textures.materials.timber
    );
    hoistRope.position.set(this._mx(-4.6), 1.72, -4.3);
    scaffoldGroup.add(hoistRope);

    const hoistHook = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(0.075, 0.022, 6, 10, Math.PI * 1.4)),
      this.pen.materials.wroughtIron
    );
    hoistHook.position.set(this._mx(-4.6), 1.32, -4.3);
    scaffoldGroup.add(hoistHook);

    // Disable raycast on decorative quarry scaffolding & canopy so chipping is 100% clear
    const noopRaycast = () => {};
    scaffoldGroup.traverse((ch) => {
      if (ch.isMesh) ch.raycast = noopRaycast;
    });

    // 3 Extractable Quarry Nodes: 2 Grey Granite Nodes + 1 Red Clay Bank
    const nodeSpecs = [
      { x: -6.05, z: -4.52, isClay: false },
      { x: -4.6, z: -4.75, isClay: false },
      { x: -3.15, z: -4.52, isClay: true },
    ];

    const nodeGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.62, 0));
    const hitSphereGeo = this._trackGeo(new THREE.SphereGeometry(0.86, 8, 6));
    const hitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    nodeSpecs.forEach((spec, idx) => {
      const wx = this._mx(spec.x);
      const pos = new THREE.Vector3(wx, this.getTerrainHeight(wx, spec.z) + 0.46, spec.z);
      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(pos);

      const mat = this._trackMat(
        (spec.isClay ? this.pen.materials.rawRedClay : this.pen.materials.rawGranite).clone()
      );
      mat.emissive = new THREE.Color(spec.isClay ? 0x3b1810 : 0x20262c);
      mat.emissiveIntensity = 0.08;

      const rockMesh = new THREE.Mesh(nodeGeo, mat);
      rockMesh.scale.set(1.12, 0.86, 1.04);
      rockMesh.rotation.set(idx * 0.4, idx * 1.1, idx * 0.25);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      nodeGroup.add(rockMesh);

      const nodeData = {
        index: idx,
        isClay: spec.isClay,
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

    // Quarry Gravel Staging Pad (5 slots for Raw Granite & Red Clay blocks)
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.6, 0.14, 1.35)),
      this.pen.materials.gravelSlab
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

  _getRawBlockMaterial() {
    const isClay = this.quarrySpawnCounter % 3 === 2;
    this.quarrySpawnCounter++;
    return isClay ? this.rawClayMat : this.rawGraniteMat;
  }

  /* ============================================================================
   * 3. STATION 2 — CHARIOTS À BRAS EN BOIS À DEUX ROUES (AUTO-PUSH SHUTTLES!)
   * ========================================================================== */
  _buildTransportTracksAndSleds() {
    super._buildTransportTracksAndSleds();

    // Upgrade both sleds visually into 19th-century two-wheeled wooden handcarts
    const wheelRimGeo = this._trackGeo(new THREE.TorusGeometry(0.36, 0.045, 7, 16));
    const spokeGeo = this._trackGeo(new THREE.BoxGeometry(0.68, 0.045, 0.04));
    const hubGeo = this._trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 8));
    const handleGeo = this._trackGeo(new THREE.CylinderGeometry(0.042, 0.048, 0.72, 6));

    this.sleds.forEach((sled) => {
      if (!sled.group) return;
      const isZ = sled.axis === 'z';

      // Darken timber & iron trim for 1800s industrial feel
      sled.group.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (child.material === this.textures.materials.timberDark) {
          child.material = this.pen.materials.darkOak;
        }
      });

      // Attach 2 large spoked wooden wheels with black wrought-iron tires on each handcart!
      const wheelPair = [];
      const wheelSpread = this.sledCapacity === 4 ? 2.12 : 1.66;
      [-wheelSpread, wheelSpread].forEach((sideOff) => {
        const wheel = new THREE.Group();
        if (isZ) {
          wheel.position.set(sideOff, 0.24, 0);
          wheel.rotation.y = Math.PI / 2;
        } else {
          wheel.position.set(0, 0.24, sideOff);
        }

        const rim = new THREE.Mesh(wheelRimGeo, this.pen.materials.wroughtIron);
        rim.castShadow = true;
        wheel.add(rim);

        for (let s = 0; s < 4; s++) {
          const sp = new THREE.Mesh(spokeGeo, this.pen.materials.palisadeLog);
          sp.rotation.z = (s * Math.PI) / 4;
          wheel.add(sp);
        }

        const hub = new THREE.Mesh(hubGeo, this.pen.materials.wroughtIron);
        hub.rotation.x = Math.PI / 2;
        wheel.add(hub);

        sled.group.add(wheel);
        wheelPair.push(wheel);
      });

      // Twin wooden push-handles protruding from the rear of the handcart
      [-0.45, 0.45].forEach((hOff) => {
        const h = new THREE.Mesh(handleGeo, this.pen.materials.darkOak);
        if (isZ) {
          h.rotation.x = Math.PI / 2;
          h.position.set(hOff, 0.34, -0.82);
        } else {
          h.rotation.z = Math.PI / 2;
          h.position.set(-0.82, 0.34, hOff);
        }
        h.castShadow = true;
        sled.group.add(h);
      });

      this.handcartWheels.push({ sled, wheels: wheelPair, lastProgress: sled.progress });
      this.handcartAutoTimers.set(sled.id, 0);
    });
  }

  /* ============================================================================
   * 4. STATION 3 — ATELIER DE TAILLE & FERRONNERIE (OPEN DARK-WOOD ROOF + FORGE)
   * ========================================================================== */
  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    this.root.add(ws);

    const cx = this._mx(-4.6);
    const cz = 5.0;

    // Compacted grey granite & timber workshop floor slab
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.5, 0.14, 3.25)),
      this.pen.materials.gravelSlab
    );
    floor.position.set(cx, 0.07, cz);
    floor.receiveShadow = true;
    ws.add(floor);

    // Open-front dark-wood timber workshop frame (2 tall rear posts + 2 low iron-capped front bollards)
    const frameGroup = new THREE.Group();
    ws.add(frameGroup);

    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.2, 0.32));
    const rearPostGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 2.22, 0.16));
    const frontPostGeo = this._trackGeo(new THREE.BoxGeometry(0.15, 1.24, 0.15));
    const ironCapGeo = this._trackGeo(new THREE.BoxGeometry(0.2, 0.08, 0.2));

    [
      [cx - 1.9, cz - 1.3, true],
      [cx + 1.9, cz - 1.3, true],
      [cx - 1.9, cz + 1.3, false],
      [cx + 1.9, cz + 1.3, false],
    ].forEach(([px, pz, isRear]) => {
      const pl = new THREE.Mesh(plinthGeo, this.pen.materials.graniteCliff);
      pl.position.set(px, 0.2, pz);
      frameGroup.add(pl);

      const post = new THREE.Mesh(isRear ? rearPostGeo : frontPostGeo, this.pen.materials.darkOak);
      post.position.set(px, isRear ? 1.4 : 0.9, pz);
      post.castShadow = true;
      frameGroup.add(post);

      if (!isRear) {
        const cap = new THREE.Mesh(ironCapGeo, this.pen.materials.wroughtIron);
        cap.position.set(px, 1.56, pz);
        frameGroup.add(cap);
      }
    });

    // Cutaway Open-Front Dark-Wood & Slate Rear Awning (covers ONLY rear ~35% behind workbench & forge!)
    const canopyGroup = new THREE.Group();
    canopyGroup.position.set(cx, 2.48, cz);

    const rearBeam = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.35, 0.14, 0.16)),
      this.pen.materials.darkOak
    );
    rearBeam.position.set(0, 0.05, -1.3);
    canopyGroup.add(rearBeam);

    const openRoof = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.65, 0.12, 1.04)),
      this.pen.materials.darkOak
    );
    openRoof.position.set(0, 0.24, -1.24);
    openRoof.rotation.x = -0.28;
    openRoof.castShadow = true;
    canopyGroup.add(openRoof);

    const slateTrim = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.72, 0.06, 0.98)),
      this.pen.materials.darkSlateRoof
    );
    slateTrim.position.set(0, 0.31, -1.25);
    slateTrim.rotation.x = -0.28;
    canopyGroup.add(slateTrim);

    // Disable raycast on ALL decorative workshop roof/framing meshes so carving is 100% unobstructed!
    const noopRaycast = () => {};
    frameGroup.traverse((ch) => {
      if (ch.isMesh) ch.raycast = noopRaycast;
    });
    canopyGroup.traverse((ch) => {
      if (ch.isMesh) ch.raycast = noopRaycast;
    });
    this.canopyMesh = canopyGroup;
    ws.add(canopyGroup);

    // Glowing Brick Blacksmith Forge tucked neatly against the rear-left corner
    const forgeX = cx - this._mx(1.42);
    const forgeZ = cz - 0.85;
    const forgeHearth = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.95, 0.72, 0.82)),
      this.pen.materials.darkRedBrick
    );
    forgeHearth.position.set(forgeX, 0.5, forgeZ);
    forgeHearth.castShadow = true;
    ws.add(forgeHearth);

    const emberBed = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.66, 0.14, 0.54)),
      this.pen.materials.forgeEmber
    );
    emberBed.position.set(forgeX, 0.9, forgeZ);
    ws.add(emberBed);
    this.forgeEmberMesh = emberBed;

    // Iron chimney hood over the forge
    const hood = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.18, 0.42, 0.95, 4)),
      this.pen.materials.wroughtIron
    );
    hood.rotation.y = Math.PI / 4;
    hood.position.set(forgeX, 1.92, forgeZ);
    hood.raycast = noopRaycast;
    ws.add(hood);

    // Tiny rising orange forge ember sparks
    const sparkGeo = this._trackGeo(new THREE.OctahedronGeometry(0.045, 0));
    for (let s = 0; s < 5; s++) {
      const sp = new THREE.Mesh(sparkGeo, this.mats.forgeSpark);
      sp.position.set(forgeX, 1.0, forgeZ);
      ws.add(sp);
      this.forgeSparks.push({
        mesh: sp,
        baseX: forgeX,
        baseZ: forgeZ,
        phase: s * 1.25,
      });
    }

    // Heavy Wrought-Iron Blacksmith Anvil beside the stonecutter workbench
    const anvilX = cx - this._mx(1.42);
    const anvilZ = cz + 0.58;
    const anvilStump = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.28, 0.32, 0.48, 8)),
      this.pen.materials.darkOak
    );
    anvilStump.position.set(anvilX, 0.38, anvilZ);
    anvilStump.castShadow = true;
    ws.add(anvilStump);

    const anvilBody = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.56, 0.22, 0.28)),
      this.pen.materials.wroughtIron
    );
    anvilBody.position.set(anvilX, 0.72, anvilZ);
    anvilBody.castShadow = true;
    ws.add(anvilBody);

    const anvilHorn = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.11, 0.28, 6)),
      this.pen.materials.wroughtIron
    );
    anvilHorn.rotation.z = -Math.PI / 2;
    anvilHorn.position.set(anvilX + this._mx(0.36), 0.75, anvilZ);
    ws.add(anvilHorn);

    // Central Stonecutter Carving Workbench
    const wbX = cx - this._mx(0.25);
    const wbZ = cz - 0.08;
    const benchBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.56, 0.62, 1.38)),
      this.pen.materials.darkOak
    );
    benchBase.position.set(wbX, 0.44, wbZ);
    benchBase.castShadow = true;
    benchBase.receiveShadow = true;
    ws.add(benchBase);

    const benchTop = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.7, 0.14, 1.5)),
      this.pen.materials.dressedGranite
    );
    benchTop.position.set(wbX, 0.8, wbZ);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    ws.add(benchTop);

    // Forged blacksmith hammer & iron chisel resting on bench
    const chiselMat = this.upgrades.golden_chisel
      ? this.textures.materials.capstoneGold
      : this.pen.materials.wroughtIron;
    const chisel = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.38)), chiselMat);
    chisel.position.set(wbX + this._mx(0.62), 0.9, wbZ - 0.42);
    chisel.rotation.y = -0.35;
    ws.add(chisel);

    // Active Workbench Slot
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

    const carveHitGeo = this._trackGeo(new THREE.BoxGeometry(1.92, 1.35, 1.92));
    const carveHitMat = this._trackMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.workbenchCarveHitbox = new THREE.Mesh(carveHitGeo, carveHitMat);
    this.workbenchCarveHitbox.position.set(wbX, wbY + 0.45, wbZ);
    this.workbenchCarveHitbox.visible = false;
    ws.add(this.workbenchCarveHitbox);

    // 3 Diegetic Forge-Amber Carving Progress Pips
    const pipGeo = this._trackGeo(new THREE.OctahedronGeometry(0.095, 0));
    this.carvingPips = [];
    for (let i = 0; i < 3; i++) {
      const pipMat = this._trackMat(
        new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.38 })
      );
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(wbX + (i - 1) * 0.32, wbY + 1.24, wbZ);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 2 Finished Masonry / Ironwork Output Slots
    const outPositions = [
      [cx + this._mx(1.18), cz - 0.55],
      [cx + this._mx(1.18), cz + 0.55],
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
   * 5. STATION 4 — CHANTIER DU PÉNITENCIER AMÉRICAIN (50 BLOCKS, 5 STAGES)
   * ========================================================================== */
  _buildPyramidSite() {
    const site = new THREE.Group();
    this.root.add(site);

    const pc = this.pyramidCenter;

    // 1. Massive Granite Plinth Base + Recessed Grey Gravel Prison Courtyard (Cour intérieure)
    const basePlatform = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(5.55, FOUNDATION_Y, 5.55)),
      this.pen.materials.graniteCliff
    );
    basePlatform.position.set(pc.x, FOUNDATION_Y * 0.5, pc.z);
    basePlatform.receiveShadow = true;
    basePlatform.castShadow = true;
    site.add(basePlatform);

    const courtyardPad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.1, 0.04, 3.1)),
      this.pen.materials.gravelSlab
    );
    courtyardPad.position.set(pc.x, FOUNDATION_Y + 0.02, pc.z);
    courtyardPad.receiveShadow = true;
    site.add(courtyardPad);

    // Central Octagonal Granite Guard Pedestal in the middle of the courtyard (foundation for Stage 5 Tower!)
    const centerBase = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.76, 0.88, 0.28, 8)),
      this.pen.materials.dressedGranite
    );
    centerBase.position.set(pc.x, FOUNDATION_Y + 0.14, pc.z);
    centerBase.castShadow = true;
    centerBase.receiveShadow = true;
    site.add(centerBase);

    // Aura du Pyramidion upgrade ring
    if (this.upgrades.pyramidion_aura) {
      const auraGeo = this._trackGeo(new THREE.RingGeometry(3.38, 3.68, 40));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffc66b,
          transparent: true,
          opacity: 0.38,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      this.auraRingMesh = new THREE.Mesh(auraGeo, auraMat);
      this.auraRingMesh.position.set(pc.x, FOUNDATION_Y + 0.03, pc.z);
      site.add(this.auraRingMesh);
    }

    // Staging Pallet beside Track B end (2x2 = 4 slots)
    const palletX = this._mx(4.1);
    const palletZ = 4.75;
    const pallet = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(2.35, 0.14, 2.35)),
      this.pen.materials.gravelSlab
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

    // ---- PROGRESSIVE ARCHITECTURAL DETAILS REVEALED AS EACH STAGE COMPLETES ----

    // Stage 2 Details: Sculpted Grey Granite Buttresses (Contreforts) + Wrought-Iron Sallyport Gate
    const buttressGeo = this._trackGeo(new THREE.BoxGeometry(0.28, BLOCK_H * 1.95, 0.34));
    const bY = FOUNDATION_Y + BLOCK_H;
    const outerDist = 2.5 * GRID_STEP + 0.08;
    [
      [-2 * GRID_STEP, -outerDist, 0],
      [0, -outerDist, 0],
      [2 * GRID_STEP, -outerDist, 0],
      [-outerDist, -GRID_STEP, Math.PI / 2],
      [-outerDist, GRID_STEP, Math.PI / 2],
      [outerDist, -GRID_STEP, Math.PI / 2],
      [outerDist, GRID_STEP, Math.PI / 2],
      [-2 * GRID_STEP, outerDist, 0],
      [2 * GRID_STEP, outerDist, 0],
    ].forEach(([ox, oz, ry]) => {
      const b = new THREE.Mesh(buttressGeo, this.pen.materials.graniteCliff);
      b.position.set(pc.x + ox, bY, pc.z + oz);
      b.rotation.y = ry;
      b.castShadow = true;
      b.receiveShadow = true;
      b.visible = false;
      site.add(b);
      this.buttressMeshes.push(b);
    });

    // Front wrought-iron barred sallyport gate filling [0, 2] on Stage 2
    const gateGroup = new THREE.Group();
    gateGroup.position.set(pc.x, FOUNDATION_Y + BLOCK_H * 1.5, pc.z + 2 * GRID_STEP);
    for (let bx = -0.34; bx <= 0.35; bx += 0.17) {
      const bar = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(0.025, 0.025, BLOCK_H * 1.05, 6)),
        this.pen.materials.wroughtIron
      );
      bar.position.set(bx, 0, 0);
      gateGroup.add(bar);
    }
    const crossBar = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.92, 0.07, 0.06)),
      this.pen.materials.wroughtIron
    );
    crossBar.position.set(0, 0.12, 0);
    gateGroup.add(crossBar);
    gateGroup.visible = false;
    site.add(gateGroup);
    this.sallyportGateMesh = gateGroup;

    // Stage 3 Details: Black Wrought-Iron Upper Cellblock Catwalk Balcony Railing
    const catY = FOUNDATION_Y + 2 * BLOCK_H + 0.12;
    const railGeoN = this._trackGeo(new THREE.BoxGeometry(3.2, 0.06, 0.06));
    const railN = new THREE.Mesh(railGeoN, this.pen.materials.wroughtIron);
    railN.position.set(pc.x, catY, pc.z - 1.46 * GRID_STEP);
    railN.visible = false;
    site.add(railN);
    this.catwalkMeshes.push(railN);

    // Stage 4 Details: Twin Dark-Red Brick Chimneys rising from the double-pitched slate roof
    const chimGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.72, 0.32));
    const chimCapGeo = this._trackGeo(new THREE.BoxGeometry(0.38, 0.08, 0.38));
    [-1.4, 1.4].forEach((cxOff, idx) => {
      const ch = new THREE.Group();
      ch.position.set(pc.x + cxOff, FOUNDATION_Y + 3.85 * BLOCK_H, pc.z - 2 * GRID_STEP);
      const body = new THREE.Mesh(chimGeo, this.pen.materials.darkRedBrick);
      body.castShadow = true;
      ch.add(body);
      const cap = new THREE.Mesh(chimCapGeo, this.pen.materials.graniteCliff);
      cap.position.y = 0.38;
      ch.add(cap);
      ch.visible = false;
      site.add(ch);
      this.chimneyMeshes.push(ch);

      // Soft chimney smoke puff
      const puff = new THREE.Mesh(
        this._trackGeo(new THREE.IcosahedronGeometry(0.14, 0)),
        this._trackMat(
          new THREE.MeshBasicMaterial({ color: 0xe6e0d8, transparent: true, opacity: 0.38, depthWrite: false })
        )
      );
      puff.position.set(pc.x + cxOff, FOUNDATION_Y + 4.45 * BLOCK_H, pc.z - 2 * GRID_STEP);
      puff.visible = false;
      site.add(puff);
      this.chimneySmoke.push({ mesh: puff, baseY: puff.position.y, phase: idx * 2.1 });
    });

    // Stage 5 Masterpiece: Octagonal Central Guard Tower (Bell + Glowing Lantern + 1800s Circular-Star US Flag!)
    this._buildOctagonalCentralGuardTower(site, pc);

    // Build all 50 progressive zero-gap blueprint slots across the 5 stages
    const tiers = buildPenitentiaryBlueprintTiers();
    this.maxLayerIndex = tiers.length - 1;
    let slotIdx = 0;

    tiers.forEach((tierCells, layer) => {
      const layerBaseY = FOUNDATION_Y + layer * BLOCK_H;

      tierCells.forEach((cell, cellIdx) => {
        const wx = pc.x + cell.dx * GRID_STEP;
        const wz = pc.z + cell.dz * GRID_STEP;
        const isSlate = cell.pieceType === 'slate_roof';
        const isTower = cell.pieceType === 'guard_tower';

        // Central Guard Tower sits directly on the central courtyard octagonal dais!
        const centerY = isTower ? FOUNDATION_Y + 1.45 : layerBaseY + BLOCK_H * 0.5;

        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(wx, centerY, wz);
        ghostGroup.rotation.y = cell.rotY || 0;

        const gGeo = isTower
          ? this.geos.ghostTower
          : isSlate
          ? this.geos.ghostSlate
          : this.geos.ghostBox;
        const gEdges = isTower
          ? this.geos.ghostTowerEdges
          : isSlate
          ? this.geos.ghostSlateEdges
          : this.geos.ghostBoxEdges;

        const ghostMesh = new THREE.Mesh(gGeo, this.mats.ghostNormal);
        const ghostLines = new THREE.LineSegments(gEdges, this.mats.ghostLineNormal);
        ghostGroup.add(ghostMesh);
        ghostGroup.add(ghostLines);
        ghostGroup.visible = layer === 0;
        site.add(ghostGroup);

        const slot = {
          id: `pen_L${layer}_${cellIdx}`,
          index: slotIdx++,
          zoneType: 'pyramid',
          layer,
          gridX: cell.dx,
          gridZ: cell.dz,
          isCapstone: isTower,
          pieceType: cell.pieceType,
          rotY: cell.rotY || 0,
          accepts: ['carved', 'capstone'],
          position: new THREE.Vector3(wx, centerY, wz),
          dropIndicatorY: isTower ? FOUNDATION_Y + 0.3 : layerBaseY + 0.01,
          ghostGroup,
          ghostMesh,
          ghostLines,
          block: null,
        };
        this.pyramidSlots.push(slot);
        this._registerSlotInGrid(slot);
      });
    });

    this.totalGoal = this.pyramidSlots.length; // 50 blocks exact
  }

  /**
   * Builds the crowning Stage 5 Octagonal Central Guard Tower (revealed when the 50th block snaps in!):
   *   - Tall octagonal grey-granite base & red-brick upper watch gallery
   *   - Octagonal slate cupola roof
   *   - Swinging aged-bronze prison alarm bell
   *   - Glowing warm wrought-iron guard lantern
   *   - Waving 1800s American flag (13 stripes + circle of white stars)
   */
  _buildOctagonalCentralGuardTower(site, pc) {
    const tower = new THREE.Group();
    tower.position.set(pc.x, FOUNDATION_Y + 0.24, pc.z);
    tower.visible = false;

    // Lower octagonal granite shaft rising out of the central courtyard
    const lowerShaft = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.64, 0.74, 1.85, 8)),
      this.pen.materials.graniteLoophole
    );
    lowerShaft.position.y = 0.92;
    lowerShaft.castShadow = true;
    lowerShaft.receiveShadow = true;
    tower.add(lowerShaft);

    // Cornice ledge + upper dark-red brick octagonal guardroom
    const ledge = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.76, 0.68, 0.16, 8)),
      this.pen.materials.dressedGranite
    );
    ledge.position.y = 1.9;
    ledge.castShadow = true;
    tower.add(ledge);

    const upperRoom = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.62, 0.64, 0.72, 8)),
      this.pen.materials.darkRedBrick
    );
    upperRoom.position.y = 2.32;
    upperRoom.castShadow = true;
    tower.add(upperRoom);

    // 8 slender wrought-iron belfry columns framing the bell & lantern cupola
    const colGeo = this._trackGeo(new THREE.CylinderGeometry(0.028, 0.032, 0.56, 6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const col = new THREE.Mesh(colGeo, this.pen.materials.wroughtIron);
      col.position.set(Math.cos(a) * 0.48, 2.94, Math.sin(a) * 0.48);
      tower.add(col);
    }

    // Swinging Aged-Bronze Alarm Bell (Cloche en bronze) inside the open belfry
    const bellPivot = new THREE.Group();
    bellPivot.position.set(0, 3.16, 0);
    const bellBody = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.18, 0.28, 10)),
      this.pen.materials.agedBronze
    );
    bellBody.position.y = -0.16;
    bellBody.castShadow = true;
    bellPivot.add(bellBody);
    const clapper = new THREE.Mesh(
      this._trackGeo(new THREE.SphereGeometry(0.05, 6, 6)),
      this.pen.materials.wroughtIron
    );
    clapper.position.y = -0.3;
    bellPivot.add(clapper);
    tower.add(bellPivot);
    this.towerBellPivot = bellPivot;

    // Glowing Wrought-Iron Sentry Lantern mounted on the front balcony
    const lanternMat = this.pen.materials.lanternGlow.clone();
    this._trackMat(lanternMat);
    const lantern = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 6)),
      lanternMat
    );
    lantern.position.set(0, 2.86, 0.58);
    tower.add(lantern);
    this.towerLanternMat = lanternMat;

    // Octagonal Dark-Slate Cupola Roof
    const cupola = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.8, 0.68, 8)),
      this.pen.materials.darkSlateRoof
    );
    cupola.position.y = 3.54;
    cupola.castShadow = true;
    tower.add(cupola);

    // Tall Iron Flagpole + Gently Waving 1800s American Flag (13 stars in a circle!)
    const pole = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.024, 0.032, 1.38, 6)),
      this.pen.materials.wroughtIron
    );
    pole.position.y = 4.46;
    tower.add(pole);

    const finial = new THREE.Mesh(
      this._trackGeo(new THREE.SphereGeometry(0.06, 8, 6)),
      this.pen.materials.agedBronze
    );
    finial.position.y = 5.18;
    tower.add(finial);

    const flagGeo = this._trackGeo(new THREE.PlaneGeometry(0.92, 0.56, 8, 2));
    flagGeo.translate(0.46, 0, 0); // Pivot cleanly at flagpole edge
    const flagMesh = new THREE.Mesh(flagGeo, this.pen.materials.usFlag1800s);
    flagMesh.position.set(0.02, 4.82, 0);
    flagMesh.castShadow = true;
    tower.add(flagMesh);
    this.towerFlagMesh = flagMesh;

    site.add(tower);
    this.centralTowerGroup = tower;
  }

  /* ============================================================================
   * 6. CONNECTED MASONRY, PROGRESSIVE STAGE REVEALS & HAPTIC SNAP FEEDBACK
   * ========================================================================== */
  _isConnectableMasonrySlot(slot) {
    if (!slot || !slot.block) return false;
    return (
      slot.pieceType === 'foundation' ||
      slot.pieceType === 'granite_wall' ||
      slot.pieceType === 'brick_cell' ||
      slot.pieceType === 'gate_lintel'
    );
  }

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

  _isRoofSlot(slot) {
    return Boolean(slot && slot.block && slot.pieceType === 'slate_roof');
  }

  _computeRoofNeighborMask(slot) {
    if (!this._isRoofSlot(slot)) return 0;
    const { gridX: gx, layer, gridZ: gz } = slot;
    let mask = 0;
    if (this._isRoofSlot(this._getGridSlot(gx + 1, layer, gz))) mask |= NEIGHBOR_PX;
    if (this._isRoofSlot(this._getGridSlot(gx - 1, layer, gz))) mask |= NEIGHBOR_NX;
    if (this._isRoofSlot(this._getGridSlot(gx, layer, gz + 1))) mask |= NEIGHBOR_PZ;
    if (this._isRoofSlot(this._getGridSlot(gx, layer, gz - 1))) mask |= NEIGHBOR_NZ;
    return mask;
  }

  _applyConnectedRoof(slot) {
    if (!this._isRoofSlot(slot)) return;
    const mask = this._computeRoofNeighborMask(slot);
    const defaultAxis = slot.gridZ === -2 ? 'x' : 'z';
    slot.block.roofMask = mask;
    slot.block.mesh.rotation.set(0, 0, 0);
    slot.block.mesh.geometry = this.masonryCache.getPitchedRoofGeometry(
      BLOCK_W,
      BLOCK_H,
      BLOCK_D,
      mask,
      { style: 'gable', defaultAxis, eaveOverhang: 0.02 }
    );
  }

  _updateConnectedRoofAround(slot) {
    if (!slot || slot.gridX === undefined || slot.gridZ === undefined) return;
    if (slot.pieceType !== 'slate_roof') return;
    const { gridX: gx, layer, gridZ: gz } = slot;
    const candidates = [
      slot,
      this._getGridSlot(gx + 1, layer, gz),
      this._getGridSlot(gx - 1, layer, gz),
      this._getGridSlot(gx, layer, gz + 1),
      this._getGridSlot(gx, layer, gz - 1),
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i]) this._applyConnectedRoof(candidates[i]);
    }
  }

  _onConnectedMasonryUpdated(_slot) {
    // Stage 2 done -> reveal granite buttresses (contreforts) & wrought-iron sallyport gate
    const stage2Done = this.pyramidSlots
      .filter((s) => s.layer === 1)
      .every((s) => Boolean(s.block));
    if (stage2Done && this.buttressMeshes.length > 0 && !this.buttressMeshes[0].visible) {
      this.buttressMeshes.forEach((m) => (m.visible = true));
      if (this.sallyportGateMesh) this.sallyportGateMesh.visible = true;
    }

    // Stage 3 done -> reveal iron catwalk balcony railing
    const stage3Done = this.pyramidSlots
      .filter((s) => s.layer === 2)
      .every((s) => Boolean(s.block));
    if (stage3Done && this.catwalkMeshes.length > 0 && !this.catwalkMeshes[0].visible) {
      this.catwalkMeshes.forEach((m) => (m.visible = true));
    }

    // Stage 4 done -> reveal twin brick chimneys & morning smoke wisps
    const stage4Done = this.pyramidSlots
      .filter((s) => s.layer === 3)
      .every((s) => Boolean(s.block));
    if (stage4Done && this.chimneyMeshes.length > 0 && !this.chimneyMeshes[0].visible) {
      this.chimneyMeshes.forEach((m) => (m.visible = true));
      this.chimneySmoke.forEach((s) => (s.mesh.visible = true));
    }

    // Stage 5 (50th block) placed -> reveal the full Octagonal Central Guard Tower!
    const towerSlot = this.pyramidSlots.find((s) => s.pieceType === 'guard_tower');
    if (towerSlot && towerSlot.block && this.centralTowerGroup && !this.centralTowerGroup.visible) {
      towerSlot.block.mesh.visible = false; // Replaced seamlessly by the full detailed guard tower
      this.centralTowerGroup.visible = true;
    }
  }

  _shouldForgeCapstone() {
    return false;
  }

  _pickNextCarvedPieceType() {
    const remaining = this.pyramidSlots.filter((s) => s.layer === this.activeLayer && !s.block);
    if (remaining.some((s) => s.pieceType === 'guard_tower')) return 'guard_tower';
    if (remaining.some((s) => s.pieceType === 'slate_roof')) return 'slate_roof';
    if (remaining.some((s) => s.pieceType === 'brick_cell')) return 'brick_cell';
    if (remaining.some((s) => s.pieceType === 'gate_lintel')) return 'gate_lintel';
    if (remaining.some((s) => s.pieceType === 'granite_wall')) return 'granite_wall';
    return 'foundation';
  }

  carveWorkbenchBlock(swipeVec) {
    const stillRaw = super.carveWorkbenchBlock(swipeVec);
    const block = this.workbenchSlot ? this.workbenchSlot.block : null;
    if (block && block.kind === 'carved' && !stillRaw) {
      const pieceType = this._pickNextCarvedPieceType();
      this._applyPenitentiaryPieceVisual(block, pieceType);
    }
    return stillRaw;
  }

  _applyPenitentiaryPieceVisual(block, pieceType) {
    block.pieceType = pieceType;
    if (pieceType === 'slate_roof') {
      block.mesh.geometry = this.geos.slateRoof;
      block.mesh.material = this.pen.materials.darkSlateRoof;
    } else if (pieceType === 'guard_tower') {
      block.mesh.geometry = this.geos.towerPreview;
      block.mesh.material = this.pen.materials.dressedGranite;
    } else if (pieceType === 'brick_cell') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.pen.materials.brickCellBars;
    } else if (pieceType === 'gate_lintel') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.pen.materials.darkRedBrick;
    } else if (pieceType === 'granite_wall') {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.pen.materials.graniteLoophole;
    } else {
      block.mesh.geometry = this.geos.carvedBlock;
      block.mesh.material = this.pen.materials.dressedGranite;
    }
  }

  _fitPlacedBlock(block, slot) {
    if (!slot || !slot.pieceType) return;
    this._applyPenitentiaryPieceVisual(block, slot.pieceType);
    // Subtle mobile haptic confirmation pulse + grey granite/brick dust puff
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(14);
      } catch (_) {
        // Ignore on unsupported browsers
      }
    }
    const dustMat =
      slot.pieceType === 'brick_cell' || slot.pieceType === 'gate_lintel'
        ? this.mats.dustBrick
        : this.mats.dustGranite;
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
   * 7. COMPLETION CELEBRATION (+225 OR, +30 ÉCLATS & 2 DECORATION REWARDS!)
   * ========================================================================== */
  _triggerCompletionSequence() {
    if (this.isComplete) return;
    this.isComplete = true;
    this.clearDropHighlights();
    this.audio.playVictoryFanfare();

    const pc = this.pyramidCenter;
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(pc.x, FOUNDATION_Y + 4.8, pc.z);

    // Subtle warm frontier golden sunrise shafts framing the completed watchtower & 1800s flag cleanly
    const innerGeo = this._trackGeo(new THREE.CylinderGeometry(0.45, 1.55, 7.2, 18, 1, true));
    innerGeo.translate(0, 3.2, 0);
    const innerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffd991,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(innerGeo, innerMat);
    this.victoryGroup.add(this.victoryBeamInner);

    const outerGeo = this._trackGeo(new THREE.CylinderGeometry(0.8, 2.25, 6.8, 18, 1, true));
    outerGeo.translate(0, 3.0, 0);
    const outerMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffb862,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(outerGeo, outerMat);
    this.victoryGroup.add(this.victoryBeamOuter);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(0.72, 1.45, 28));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffdc88,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryHalo = new THREE.Mesh(haloGeo, haloMat);
    this.victoryHalo.position.y = -0.35;
    this.victoryGroup.add(this.victoryHalo);

    const moteGeo = this._trackGeo(new THREE.OctahedronGeometry(0.08, 0));
    for (let i = 0; i < 28; i++) {
      const mote = new THREE.Mesh(
        moteGeo,
        i % 2 === 0 ? this.mats.dustGold : this.mats.forgeSpark
      );
      const ang = (i / 28) * Math.PI * 2;
      const rad = 1.2 + (i % 5) * 0.44;
      const yBase = -1.2 + (i % 6) * 0.55;
      mote.position.set(Math.cos(ang) * rad, yBase, Math.sin(ang) * rad);
      this.victoryGroup.add(mote);
      this.victoryMotes.push({
        mesh: mote,
        angle: ang,
        radius: rad,
        yBase,
        speed: 0.55 + (i % 4) * 0.18,
      });
    }

    this.root.add(this.victoryGroup);

    if (this.onComplete) {
      const goldMult = this.upgrades.royal_gold_stone ? 1.25 : 1.0;
      const rewardCoins = Math.round(Level5Penitentiary.meta.rewardCoins * goldMult);
      this.onComplete({
        levelId: Level5Penitentiary.meta.id,
        focusPoint: new THREE.Vector3(pc.x, FOUNDATION_Y + 2.35, pc.z),
        rewardCoins,
        firstCompletionTokens: Level5Penitentiary.meta.firstCompletionTokens,
        rewardFurniture: Level5Penitentiary.meta.rewardFurniture,
      });
    }
  }

  /* ============================================================================
   * 8. PER-FRAME ANIMATIONS (AUTO-PUSH HANDCARTS, WHEELS, FORGE, BELL, FLAG!)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Automatic 19th-century two-wheeled handcart shuttle + spinning spoked wheels!
    for (let i = 0; i < this.handcartWheels.length; i++) {
      const entry = this.handcartWheels[i];
      const s = entry.sled;
      const dp = s.progress - entry.lastProgress;
      entry.lastProgress = s.progress;

      if (Math.abs(dp) > 0.0001) {
        const spin = dp * 9.5;
        for (let w = 0; w < entry.wheels.length; w++) {
          entry.wheels[w].rotation.z -= spin;
        }
      }

      // Auto-push handcarts smoothly when loaded at start dock or emptied at end dock
      if (!s.isDragging && !s.isAutoGliding) {
        const occupied = s.slots.filter((sl) => Boolean(sl.block)).length;
        const atStart = s.progress < 0.06;
        const atEnd = s.progress > 0.94;
        const prevTimer = this.handcartAutoTimers.get(s.id) || 0;

        if (atStart && occupied > 0) {
          const nextT = prevTimer + dt;
          if (nextT >= (occupied >= s.slots.length ? 0.22 : 0.72)) {
            this.handcartAutoTimers.set(s.id, 0);
            s.targetProgress = 1;
            s.targetLeverAngle = 0.42;
            s.isAutoGliding = true;
          } else {
            this.handcartAutoTimers.set(s.id, nextT);
          }
        } else if (atEnd && occupied === 0) {
          const nextT = prevTimer + dt;
          if (nextT >= 0.45) {
            this.handcartAutoTimers.set(s.id, 0);
            s.targetProgress = 0;
            s.targetLeverAngle = -0.42;
            s.isAutoGliding = true;
          } else {
            this.handcartAutoTimers.set(s.id, nextT);
          }
        } else {
          this.handcartAutoTimers.set(s.id, 0);
        }
      }
    }

    // 2. Flickering blacksmith forge embers & rising sparks
    if (this.forgeEmberMesh) {
      this.pen.materials.forgeEmber.emissiveIntensity =
        1.35 + Math.sin(elapsed * 8.5) * 0.25 + Math.cos(elapsed * 13.0) * 0.14;
    }
    for (let i = 0; i < this.forgeSparks.length; i++) {
      const sp = this.forgeSparks[i];
      const cycle = (elapsed * 0.85 + sp.phase) % 1;
      sp.mesh.position.set(
        sp.baseX + Math.sin(elapsed * 4 + sp.phase) * 0.18,
        0.96 + cycle * 0.82,
        sp.baseZ + Math.cos(elapsed * 3.5 + sp.phase) * 0.14
      );
      sp.mesh.scale.setScalar(Math.max(0.01, 1 - cycle));
    }

    // 3. Corner watchtower lantern gentle sway
    if (this.watchtowerLantern) {
      this.watchtowerLantern.rotation.z = Math.sin(elapsed * 1.8) * 0.08;
    }

    // 4. Twin brick chimney smoke wisps
    for (let i = 0; i < this.chimneySmoke.length; i++) {
      const sm = this.chimneySmoke[i];
      if (!sm.mesh.visible) continue;
      const cyc = (elapsed * 0.35 + sm.phase) % 1;
      sm.mesh.position.y = sm.baseY + cyc * 0.85;
      sm.mesh.scale.setScalar(0.75 + cyc * 0.9);
      sm.mesh.material.opacity = (1 - cyc) * 0.38;
    }

    // 5. Central Guard Tower: swinging bronze bell, flickering lantern & waving 1800s US flag!
    if (this.centralTowerGroup && this.centralTowerGroup.visible) {
      if (this.towerBellPivot) {
        const amp = this.isComplete ? 0.24 : 0.08;
        this.towerBellPivot.rotation.z = Math.sin(elapsed * 3.2) * amp;
      }
      if (this.towerLanternMat) {
        this.towerLanternMat.emissiveIntensity = 1.2 + Math.sin(elapsed * 6.8) * 0.24;
      }
      if (this.towerFlagMesh) {
        const pos = this.towerFlagMesh.geometry.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          const x = pos.getX(v); // 0 at pole -> 0.92 at tip
          const wave = Math.sin(x * 5.8 - elapsed * 4.8) * 0.08 * (x / 0.92);
          pos.setZ(v, wave);
        }
        pos.needsUpdate = true;
      }
    }

    // 6. Victory orbiting golden frontier motes
    for (let i = 0; i < this.victoryMotes.length; i++) {
      const m = this.victoryMotes[i];
      const ang = m.angle + elapsed * m.speed;
      const yOff = m.yBase + Math.sin(elapsed * 2.1 + i) * 0.32;
      m.mesh.position.set(Math.cos(ang) * m.radius, yOff, Math.sin(ang) * m.radius);
      m.mesh.rotation.y += dt * 2.2;
    }
  }

  dispose() {
    this.handcartWheels.length = 0;
    this.handcartAutoTimers.clear();
    this.forgeSparks.length = 0;
    this.buttressMeshes.length = 0;
    this.catwalkMeshes.length = 0;
    this.chimneyMeshes.length = 0;
    this.chimneySmoke.length = 0;
    this.victoryMotes.length = 0;
    this.forgeEmberMesh = null;
    this.watchtowerLantern = null;
    this.sallyportGateMesh = null;
    this.centralTowerGroup = null;
    this.towerBellPivot = null;
    this.towerLanternMat = null;
    this.towerFlagMesh = null;
    super.dispose();
  }
}
