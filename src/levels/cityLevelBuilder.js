/**
 * Workd Builder — Modular Milestone City / Village Template (`CityLevelBuilder`)
 *
 * Reusable "Niveau Palier Ville" architecture designed for Level 10 (Village Médiéval)
 * and all future multiple-of-10 City Milestones (Level 20 Cité Romaine, Level 30 Village Japonais,
 * Level 40 Cité Maya, etc.) simply by supplying a declarative architectural theme & district config.
 *
 * Key Mobile-First Optimizations (iPhone 16e Safari 390x844, locked 60 FPS, DPR <= 2):
 *  - Placed masonry rendered via ONE `THREE.InstancedMesh` per block type (~6-7 draw calls for 700+ bricks)
 *  - Blueprint ghosts rendered via ONE shared `THREE.InstancedMesh` + ONE batched `THREE.LineSegments`
 *    using the player's equipped Blueprint Ghost Skin (Classic Cyan, RGB Prism, Solar Gold, Jade, Ruby)
 *  - Zone-by-Zone OR Proximity-Radius ghost activation keeps the 390x844 mobile viewport crystal clear
 *  - Single deduplicated `(gx, gy, gz)` coordinate registry guarantees exact global brick counter sync
 *    across all sub-structures with zero double-counting
 *  - Full Workd Builder 4-station tactile pipeline (Quarry -> Sled A -> Stonecutter -> Sled B -> Village)
 */

import * as THREE from 'three';
import { Level1Pyramid } from './level1_pyramid.js';
import { updateBlueprintSkinUniforms } from '../blueprintSkins.js';

export const CITY_STEP = 0.72;
export const CITY_BRICK_W = 0.72;
export const CITY_BRICK_H = 0.48;
export const CITY_BRICK_D = 0.72;
export const CITY_SLAB_H = 0.16;

/* ============================================================================
 * PARAMETRIC BLUEPRINT GENERATORS (Reusable for Levels 10, 20, 30, 40...)
 * ========================================================================== */

/**
 * Generates a hollow square stone well rim (margelle) around an open central shaft.
 */
export function buildWellBlueprint({
  originGx = -2,
  originGz = -2,
  outerSize = 4,
  height = 2,
  blockType = 'well_stone',
} = {}) {
  const cells = [];
  for (let gy = 0; gy < height; gy++) {
    for (let dx = 0; dx < outerSize; dx++) {
      for (let dz = 0; dz < outerSize; dz++) {
        const isEdge =
          dx === 0 || dx === outerSize - 1 || dz === 0 || dz === outerSize - 1;
        if (!isEdge) continue;
        cells.push({
          gx: originGx + dx,
          gy,
          gz: originGz + dz,
          blockType,
          isSlab: false,
          pieceRole: 'well_rim',
        });
      }
    }
  }
  return cells;
}

/**
 * Generates hollow perimeter walls for a rectangular house / barn / workshop
 * with optional doorway openings and exterior stone buttresses (contreforts).
 * Doors format: { side: 'south'|'north'|'east'|'west', start: number, width: number, height: number }
 */
export function buildRectBuildingBlueprint({
  originGx,
  originGz,
  width,
  depth,
  height = 2,
  doors = [],
  buttresses = [],
  blockType = 'wall_stone',
  upperBlockType = null,
} = {}) {
  const cells = [];
  const isDoorCutout = (dx, dz, gy) => {
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      const dh = d.height ?? 1;
      if (gy >= dh) continue;
      if (d.side === 'south' && dz === depth - 1 && dx >= d.start && dx < d.start + d.width) {
        return true;
      }
      if (d.side === 'north' && dz === 0 && dx >= d.start && dx < d.start + d.width) {
        return true;
      }
      if (d.side === 'west' && dx === 0 && dz >= d.start && dz < d.start + d.width) {
        return true;
      }
      if (d.side === 'east' && dx === width - 1 && dz >= d.start && dz < d.start + d.width) {
        return true;
      }
    }
    return false;
  };

  for (let gy = 0; gy < height; gy++) {
    const bt = upperBlockType && gy >= 1 ? upperBlockType : blockType;
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < depth; dz++) {
        const isPerimeter = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1;
        if (!isPerimeter) continue;
        if (isDoorCutout(dx, dz, gy)) continue;
        cells.push({
          gx: originGx + dx,
          gy,
          gz: originGz + dz,
          blockType: bt,
          isSlab: false,
          pieceRole: 'wall',
        });
      }
    }
  }

  // Optional exterior buttresses (contreforts): [{ dx, dz, height }]
  buttresses.forEach((b) => {
    const bh = Math.min(height, b.height ?? height - 1);
    for (let gy = 0; gy < bh; gy++) {
      cells.push({
        gx: originGx + b.dx,
        gy,
        gz: originGz + b.dz,
        blockType,
        isSlab: false,
        pieceRole: 'buttress',
      });
    }
  });

  return cells;
}

/**
 * Generates a low or tall perimeter enclosure wall (cultivated fields 1-high, cemetery 2-high)
 * with configurable entrance gate openings.
 */
export function buildPerimeterWallBlueprint({
  originGx,
  originGz,
  width,
  depth,
  height = 1,
  gates = [],
  blockType = 'low_wall',
} = {}) {
  return buildRectBuildingBlueprint({
    originGx,
    originGz,
    width,
    depth,
    height,
    doors: gates,
    blockType,
  }).map((c) => ({ ...c, pieceRole: 'enclosure_wall' }));
}

/**
 * Generates a medieval stone Church with nave, exterior side buttresses (contreforts),
 * portal doorway, and a tall front bell tower (clocher haut) built brick by brick.
 */
export function buildChurchBlueprint({
  originGx,
  originGz,
  naveW = 7,
  naveD = 10,
  naveH = 3,
  towerSize = 3,
  towerH = 6,
  blockType = 'church_stone',
} = {}) {
  const cells = [];
  const seen = new Set();
  const pushUnique = (gx, gy, gz, pieceRole) => {
    const key = `${gx},${gy},${gz}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({
      gx,
      gy,
      gz,
      blockType,
      isSlab: false,
      pieceRole,
    });
  };

  const doorStart = Math.floor((naveW - 1) / 2);
  // 1. Stone Nave perimeter with South portal opening (1 wide x 2 high)
  for (let gy = 0; gy < naveH; gy++) {
    for (let dx = 0; dx < naveW; dx++) {
      for (let dz = 0; dz < naveD; dz++) {
        const isEdge = dx === 0 || dx === naveW - 1 || dz === 0 || dz === naveD - 1;
        if (!isEdge) continue;
        if (dz === naveD - 1 && dx === doorStart && gy < 2) continue;
        pushUnique(originGx + dx, gy, originGz + dz, 'church_nave');
      }
    }
  }

  // 2. Projecting exterior stone buttresses (contreforts) along East & West flanks (3 pairs)
  const buttressRows = [2, 5, 8];
  buttressRows.forEach((dz) => {
    for (let gy = 0; gy < Math.max(2, naveH - 1); gy++) {
      pushUnique(originGx - 1, gy, originGz + dz, 'church_buttress');
      pushUnique(originGx + naveW, gy, originGz + dz, 'church_buttress');
    }
  });

  // 3. Tall Stone Bell Tower (Clocher) centered on the South entrance end (towerSize x towerSize, up to towerH)
  const tStartX = originGx + Math.floor((naveW - towerSize) / 2);
  const tStartZ = originGz + naveD - towerSize;
  for (let gy = naveH; gy < towerH; gy++) {
    for (let dx = 0; dx < towerSize; dx++) {
      for (let dz = 0; dz < towerSize; dz++) {
        const isEdge =
          dx === 0 || dx === towerSize - 1 || dz === 0 || dz === towerSize - 1;
        if (!isEdge) continue;
        // Arched belfry sound louvers on the top tower course
        if (
          gy === towerH - 1 &&
          ((dx === 1 && (dz === 0 || dz === towerSize - 1)) ||
            (dz === 1 && (dx === 0 || dx === towerSize - 1)))
        ) {
          continue;
        }
        pushUnique(tStartX + dx, gy, tStartZ + dz, 'church_tower');
      }
    }
  }

  return cells;
}

/**
 * Generates a deduplicated 2-block-wide paved road network connecting the central plaza
 * to every village building, automatically excluding any building footprint rects.
 * Corridors format: { x0, z0, x1, z1, width = 2 } (axis-aligned segments)
 */
export function buildRoadNetworkBlueprint({
  corridors = [],
  blockType = 'paving_slab',
  excludeRects = [],
} = {}) {
  const cells = [];
  const seen = new Set();

  const isExcluded = (gx, gz) => {
    for (let i = 0; i < excludeRects.length; i++) {
      const r = excludeRects[i];
      if (gx >= r.minGx && gx <= r.maxGx && gz >= r.minGz && gz <= r.maxGz) {
        return true;
      }
    }
    return false;
  };

  corridors.forEach((seg) => {
    const w = seg.width ?? 2;
    const minX = Math.min(seg.x0, seg.x1);
    const maxX = Math.max(seg.x0, seg.x1);
    const minZ = Math.min(seg.z0, seg.z1);
    const maxZ = Math.max(seg.z0, seg.z1);

    const isHorizontal = maxX - minX >= maxZ - minZ;
    const xEnd = isHorizontal ? maxX : minX + w - 1;
    const zEnd = isHorizontal ? minZ + w - 1 : maxZ;

    for (let gx = minX; gx <= xEnd; gx++) {
      for (let gz = minZ; gz <= zEnd; gz++) {
        if (isExcluded(gx, gz)) continue;
        const key = `${gx},0,${gz}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({
          gx,
          gy: 0,
          gz,
          blockType,
          isSlab: true,
          pieceRole: 'road_slab',
        });
      }
    }
  });

  return cells;
}

/* ============================================================================
 * REUSABLE MILESTONE CITY LEVEL BUILDER (`CityLevelBuilder`)
 * ========================================================================== */

const _tmpMat4 = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);

// 12 edges of a unit cube [-0.5..0.5]^3 (24 vertex offsets) for ultra-fast batched LineSegments
const UNIT_CUBE_EDGES = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5], [0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  [-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5],

  [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5], [0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],

  [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5],
  [0.5, -0.5, -0.5], [0.5, 0.5, -0.5],
  [0.5, -0.5, 0.5], [0.5, 0.5, 0.5],
  [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5],
];

export class CityLevelBuilder extends Level1Pyramid {
  constructor(options = {}) {
    super(options);
    this.cameraController = options.cameraController || null;
  }

  /**
   * Subclasses override this to return the declarative City / Village theme & district layout.
   */
  _getCityConfig() {
    throw new Error('CityLevelBuilder subclass must implement _getCityConfig()');
  }

  /**
   * Subclasses override this to return a map of blockType -> THREE.Material for instanced masonry.
   */
  _getCityBlockMaterials() {
    return {
      default: this.textures.materials.carvedBlock,
    };
  }

  getDragBounds() {
    const cfg = this.cityConfig;
    return (
      (cfg && cfg.dragBounds) || {
        minX: -19.5,
        maxX: 19.5,
        minZ: -18.5,
        maxZ: 18.5,
      }
    );
  }

  getCameraPreset() {
    const cfg = this.cityConfig;
    return (
      (cfg && cfg.cameraPreset) || {
        target: new THREE.Vector3(-0.5, 0.35, 0.5),
        elevationDeg: 52,
        azimuth: 0.08,
        minDistance: 11.5,
        maxDistance: 72.0,
        panBounds: { minX: -18.0, maxX: 18.0, minZ: -16.5, maxZ: 16.5 },
        distanceScale: 1.48,
      }
    );
  }

  _beforeBuild() {
    if (typeof this._initCityThemeAssets === 'function') {
      this._initCityThemeAssets();
    }
    this.cityConfig = this._getCityConfig();
    this.hudLabel =
      (this.constructor && this.constructor.meta && this.constructor.meta.hudLabel) ||
      this.cityConfig.hudLabel ||
      'Village';
    this.cityStep = this.cityConfig.gridStep || CITY_STEP;
    this.cityBrickW = this.cityConfig.brickW || CITY_BRICK_W;
    this.cityBrickH = this.cityConfig.brickH || CITY_BRICK_H;
    this.cityBrickD = this.cityConfig.brickD || CITY_BRICK_D;
    this.citySlabH = this.cityConfig.slabH || CITY_SLAB_H;
    this.cityGroundY = this.cityConfig.groundY ?? 0.04;

    this.districts = [];
    this.districtById = new Map();
    this.citySlotMap = new Map();
    this.instancedBatches = new Map();
    this.instancedPopAnims = [];
    this.roofRevealAnims = [];

    this.ghostMode = 'zone'; // 'zone' | 'proximity'
    this.activeDistrictId = null;
    this.proximityRadius = this.cityConfig.proximityRadius || 7.8;
    this._lastProxTarget = new THREE.Vector3(999, 0, 999);
    this._activeGhostSlots = [];
    this._hoveredCitySlot = null;

    this.cityHudEl = null;
    this.cityHudChips = new Map();
    this.cityModeBtn = null;

    // Slightly tighter snap radius scaled to village grid step so adjacent bricks snap cleanly
    this.pyramidSnapRadius = this.upgrades.pyramidion_aura ? 1.28 : 1.04;
    this.pyramidCenter = new THREE.Vector3(
      this.cityConfig.plazaCenter ? this.cityConfig.plazaCenter.x : 0,
      0,
      this.cityConfig.plazaCenter ? this.cityConfig.plazaCenter.z : 0
    );
  }

  /**
   * Converts integer village grid coordinates `(gx, gz)` into world `(x, z)`.
   */
  gridToWorldXZ(gx, gz) {
    return {
      x: gx * this.cityStep,
      z: gz * this.cityStep,
    };
  }

  /**
   * Returns world `(x, y, z)` center for a city brick or paving slab cell.
   */
  cellToWorldPos(gx, gy, gz, isSlab = false) {
    const { x, z } = this.gridToWorldXZ(gx, gz);
    const baseY = this.getTerrainHeight ? this.getTerrainHeight(x, z) : this.cityGroundY;
    const h = isSlab ? this.citySlabH : this.cityBrickH;
    const y = baseY + (isSlab ? h * 0.5 : gy * this.cityBrickH + h * 0.5);
    return new THREE.Vector3(x, y, z);
  }

  /* ============================================================================
   * MULTI-DISTRICT INSTANCED CITY CONSTRUCTION SITE
   * ========================================================================== */
  _buildPyramidSite() {
    this.pyramidSlots = [];
    this.districts = [];
    this.districtById.clear();
    this.citySlotMap.clear();
    this.instancedBatches.clear();

    const cityRoot = new THREE.Group();
    cityRoot.name = 'CityMilestoneRoot';
    this.root.add(cityRoot);
    this.cityRoot = cityRoot;

    const blockMaterials = this._getCityBlockMaterials();
    const defaultMat =
      blockMaterials.wall_stone ||
      blockMaterials.default ||
      this.textures.materials.carvedBlock;

    // Shared placed masonry geometries (1 brick geo + 1 paving slab geo -> InstancedMesh!)
    this.cityBrickGeo = this._trackGeo(
      new THREE.BoxGeometry(this.cityBrickW * 0.985, this.cityBrickH * 0.985, this.cityBrickD * 0.985)
    );
    this.citySlabGeo = this._trackGeo(
      new THREE.BoxGeometry(this.cityBrickW * 0.98, this.citySlabH, this.cityBrickD * 0.98)
    );
    this.cityGhostUnitGeo = this._trackGeo(new THREE.BoxGeometry(1, 1, 1));
    this.cityGhostUnitEdges = this._trackGeo(new THREE.EdgesGeometry(this.cityGhostUnitGeo));

    // 1. Register every district & deduplicate all brick/slab cells across the entire city
    const slotsByBatchKey = new Map();
    let globalIdx = 0;

    (this.cityConfig.districts || []).forEach((dDef) => {
      const districtGroup = new THREE.Group();
      districtGroup.name = `District_${dDef.id}`;
      cityRoot.add(districtGroup);

      const roofGroup = new THREE.Group();
      roofGroup.name = `Roof_${dDef.id}`;
      roofGroup.visible = false;
      districtGroup.add(roofGroup);

      const district = {
        id: dDef.id,
        name: dDef.name,
        shortName: dDef.shortName || dDef.name,
        icon: dDef.icon || '🏠',
        category: dDef.category || 'building',
        slots: [],
        maxLayer: 0,
        activeLayer: 0,
        placedCount: 0,
        totalCount: 0,
        completed: false,
        group: districtGroup,
        roofGroup,
        center: new THREE.Vector3(),
        def: dDef,
      };

      const rawCells = Array.isArray(dDef.cells) ? dDef.cells : [];
      let sumX = 0;
      let sumZ = 0;

      rawCells.forEach((cell) => {
        const key = `${cell.gx},${cell.gy},${cell.gz}`;
        if (this.citySlotMap.has(key)) return; // Strictly prevent any duplicate cell / double-count

        const isSlab = Boolean(cell.isSlab);
        const pos = this.cellToWorldPos(cell.gx, cell.gy, cell.gz, isSlab);
        const h = isSlab ? this.citySlabH : this.cityBrickH;
        const blockType = cell.blockType || dDef.blockType || 'wall_stone';
        const batchKey = `${blockType}::${isSlab ? 'slab' : 'brick'}`;

        const slot = {
          id: `${dDef.id}_${cell.gx}_${cell.gy}_${cell.gz}`,
          index: globalIdx++,
          zoneType: 'pyramid',
          districtId: dDef.id,
          district,
          layer: cell.gy,
          gridX: cell.gx,
          gridY: cell.gy,
          gridZ: cell.gz,
          blockType,
          batchKey,
          isSlab,
          brickW: this.cityBrickW,
          brickH: h,
          brickD: this.cityBrickD,
          pieceRole: cell.pieceRole || 'wall',
          isCapstone: false,
          accepts: ['carved', 'capstone'],
          position: pos,
          dropIndicatorY: pos.y - h * 0.5 + 0.02,
          occupied: false,
          block: null,
          instIndex: -1,
          ghostGroup: null,
          ghostMesh: null,
          ghostLines: null,
        };

        this.citySlotMap.set(key, slot);
        this.pyramidSlots.push(slot);
        district.slots.push(slot);
        if (cell.gy > district.maxLayer) district.maxLayer = cell.gy;

        if (!slotsByBatchKey.has(batchKey)) {
          slotsByBatchKey.set(batchKey, []);
        }
        slotsByBatchKey.get(batchKey).push(slot);

        sumX += pos.x;
        sumZ += pos.z;
      });

      district.totalCount = district.slots.length;
      if (district.slots.length > 0) {
        district.center.set(sumX / district.slots.length, 0.3, sumZ / district.slots.length);
      } else if (dDef.centerGx !== undefined && dDef.centerGz !== undefined) {
        const c = this.gridToWorldXZ(dDef.centerGx, dDef.centerGz);
        district.center.set(c.x, 0.3, c.z);
      }

      // Build persistent base props (foundations, tilled fields, well pit, cemetery tombstones)
      if (typeof dDef.buildBase === 'function') {
        dDef.buildBase(districtGroup, { level: this, district });
      }
      // Build hidden completion roof/canopy (revealed automatically when all district walls finish!)
      if (typeof dDef.buildRoof === 'function') {
        dDef.buildRoof(roofGroup, { level: this, district });
      }

      this.districts.push(district);
      this.districtById.set(district.id, district);
    });

    // Exact global brick total === exact sum of every deduplicated sub-structure slot!
    this.totalGoal = this.pyramidSlots.length;
    this.maxLayerIndex = this.districts.reduce((m, d) => Math.max(m, d.maxLayer), 0);

    // 2. Create ONE InstancedMesh per (blockType, brick|slab) for placed masonry (locked 60 FPS!)
    slotsByBatchKey.forEach((slots, batchKey) => {
      const [blockType, shapeKind] = batchKey.split('::');
      const geo = shapeKind === 'slab' ? this.citySlabGeo : this.cityBrickGeo;
      const mat = blockMaterials[blockType] || defaultMat;
      const inst = new THREE.InstancedMesh(geo, mat, slots.length);
      inst.castShadow = shapeKind !== 'slab';
      inst.receiveShadow = true;
      inst.frustumCulled = false;

      for (let i = 0; i < slots.length; i++) {
        slots[i].instIndex = i;
        inst.setMatrixAt(i, _zeroMat4);
      }
      inst.instanceMatrix.needsUpdate = true;
      cityRoot.add(inst);
      this.instancedBatches.set(batchKey, inst);
    });

    // 3. Create ONE shared InstancedMesh + ONE batched LineSegments for active blueprint ghosts
    const maxVisibleGhosts = Math.max(160, Math.min(480, this.totalGoal));
    this.maxVisibleGhosts = maxVisibleGhosts;

    this.ghostInstMesh = new THREE.InstancedMesh(
      this.cityGhostUnitGeo,
      this.mats.ghostNormal,
      maxVisibleGhosts
    );
    this.ghostInstMesh.count = 0;
    this.ghostInstMesh.renderOrder = 5;
    this.ghostInstMesh.frustumCulled = false;
    this.ghostInstMesh.raycast = () => {};
    cityRoot.add(this.ghostInstMesh);

    const wirePosArr = new Float32Array(maxVisibleGhosts * 24 * 3);
    this.ghostWireGeo = this._trackGeo(new THREE.BufferGeometry());
    this.ghostWireGeo.setAttribute('position', new THREE.BufferAttribute(wirePosArr, 3));
    this.ghostWireGeo.setDrawRange(0, 0);

    this.ghostWireMesh = new THREE.LineSegments(this.ghostWireGeo, this.mats.ghostLineNormal);
    this.ghostWireMesh.renderOrder = 6;
    this.ghostWireMesh.frustumCulled = false;
    this.ghostWireMesh.raycast = () => {};
    cityRoot.add(this.ghostWireMesh);

    // Dedicated luminous hover highlight ghost box (for active magnetic drag target)
    this.ghostHoverGroup = new THREE.Group();
    this.ghostHoverMesh = new THREE.Mesh(this.cityGhostUnitGeo, this.mats.ghostHighlight);
    this.ghostHoverMesh.renderOrder = 6;
    this.ghostHoverLines = new THREE.LineSegments(
      this.cityGhostUnitEdges,
      this.mats.ghostLineHighlight
    );
    this.ghostHoverLines.renderOrder = 7;
    this.ghostHoverGroup.add(this.ghostHoverMesh, this.ghostHoverLines);
    this.ghostHoverGroup.visible = false;
    cityRoot.add(this.ghostHoverGroup);

    // Activate the first district by default & build compact mobile district switcher HUD
    if (this.districts.length > 0) {
      this.activeDistrictId = this.districts[0].id;
    }
    this._rebuildActiveGhostVisuals();
    this._mountCityHud();
  }

  /* ============================================================================
   * ZONE-BY-ZONE & PROXIMITY-RADIUS BLUEPRINT GHOST ACTIVATION
   * ========================================================================== */
  setActiveDistrict(districtId, panCamera = false) {
    if (!this.districtById.has(districtId)) return;
    this.activeDistrictId = districtId;
    this.ghostMode = 'zone';
    this._rebuildActiveGhostVisuals();
    this._syncCityHud();

    if (panCamera && this.cameraController) {
      const d = this.districtById.get(districtId);
      if (d) {
        this.cameraController.desiredTarget.set(d.center.x, 0.35, d.center.z);
        this.cameraController.desiredDistance = Math.min(
          Math.max(this.cameraController.desiredDistance, 14.5),
          23.5
        );
      }
    }
  }

  setGhostMode(mode) {
    this.ghostMode = mode === 'proximity' ? 'proximity' : 'zone';
    this._rebuildActiveGhostVisuals();
    this._syncCityHud();
  }

  getActiveDistrict() {
    return this.districtById.get(this.activeDistrictId) || this.districts[0] || null;
  }

  _collectVisibleActiveGhostSlots(focusPoint = null) {
    const out = [];
    if (this.ghostMode === 'zone') {
      const dist = this.getActiveDistrict();
      if (!dist || dist.completed) return out;
      for (let i = 0; i < dist.slots.length; i++) {
        const s = dist.slots[i];
        if (!s.occupied && !s.block && s.layer === dist.activeLayer) {
          out.push(s);
        }
      }
      return out;
    }

    // Proximity-radius mode: show all incomplete active-layer slots near camera target / dragged block
    const fx = focusPoint
      ? focusPoint.x
      : this.cameraController
        ? this.cameraController.target.x
        : this.pyramidCenter.x;
    const fz = focusPoint
      ? focusPoint.z
      : this.cameraController
        ? this.cameraController.target.z
        : this.pyramidCenter.z;
    const rSq = this.proximityRadius * this.proximityRadius;

    for (let dIdx = 0; dIdx < this.districts.length; dIdx++) {
      const d = this.districts[dIdx];
      if (d.completed) continue;
      for (let i = 0; i < d.slots.length; i++) {
        const s = d.slots[i];
        if (s.occupied || s.block || s.layer !== d.activeLayer) continue;
        const dx = s.position.x - fx;
        const dz = s.position.z - fz;
        if (dx * dx + dz * dz <= rSq) {
          out.push(s);
          if (out.length >= this.maxVisibleGhosts) return out;
        }
      }
    }
    return out;
  }

  _rebuildActiveGhostVisuals(focusPoint = null) {
    if (!this.ghostInstMesh || !this.ghostWireGeo) return;

    const slots = this._collectVisibleActiveGhostSlots(focusPoint);
    this._activeGhostSlots = slots;

    const count = Math.min(slots.length, this.maxVisibleGhosts);
    const wireAttr = this.ghostWireGeo.getAttribute('position');
    const arr = wireAttr.array;

    let ptr = 0;
    for (let i = 0; i < count; i++) {
      const s = slots[i];
      const sx = s.brickW * 0.96;
      const sy = s.brickH * 0.96;
      const sz = s.brickD * 0.96;
      const py = s.position.y + 0.02; // Clean +0.02 anti-z-fighting lift

      _tmpPos.set(s.position.x, py, s.position.z);
      _tmpScale.set(sx, sy, sz);
      _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
      this.ghostInstMesh.setMatrixAt(i, _tmpMat4);

      for (let e = 0; e < 24; e++) {
        const v = UNIT_CUBE_EDGES[e];
        arr[ptr++] = s.position.x + v[0] * sx;
        arr[ptr++] = py + v[1] * sy;
        arr[ptr++] = s.position.z + v[2] * sz;
      }
    }

    this.ghostInstMesh.count = count;
    this.ghostInstMesh.instanceMatrix.needsUpdate = true;
    wireAttr.needsUpdate = true;
    this.ghostWireGeo.setDrawRange(0, count * 24);
  }

  /* ============================================================================
   * STRICT DROP-ZONE VALIDATION & INSTANCED PLACEMENT (ZERO DOUBLE-COUNTING)
   * ========================================================================== */
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

    // Carved Brick / Slab: valid on Sled B, Workshop Output, Staging Pad, and currently active City Ghost Slots
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

    for (let i = 0; i < this._activeGhostSlots.length; i++) {
      const slot = this._activeGhostSlots[i];
      if (!slot.occupied && !slot.block) {
        valid.push(slot);
      }
    }

    return valid;
  }

  evaluateDropZones(block, dragPos) {
    // In proximity mode, dynamically refresh nearby active blueprint slots around the dragged brick
    if (block.kind !== 'raw' && this.ghostMode === 'proximity') {
      this._rebuildActiveGhostVisuals(dragPos);
    }

    this.clearDropHighlights();

    const validSlots = this._getValidSlotsForBlock(block);
    let bestSlot = null;
    let bestDistSq = Infinity;

    for (let i = 0; i < validSlots.length; i++) {
      const slot = validSlots[i];
      if (slot.zoneType !== 'pyramid' && slot.marker) {
        slot.marker.material = this.mats.slotValid;
      }
      const dx = dragPos.x - slot.position.x;
      const dz = dragPos.z - slot.position.z;
      const dSq = dx * dx + dz * dz;
      const snapRad =
        slot.zoneType === 'pyramid'
          ? this.pyramidSnapRadius
          : slot.zoneType === 'sled' || slot.zoneType === 'workbench'
            ? 1.15
            : 0.92;
      if (dSq < snapRad * snapRad && dSq < bestDistSq) {
        bestDistSq = dSq;
        bestSlot = slot;
      }
    }

    if (bestSlot) {
      if (bestSlot.zoneType === 'pyramid') {
        this._hoveredCitySlot = bestSlot;
        this.ghostHoverGroup.position.set(
          bestSlot.position.x,
          bestSlot.position.y + 0.025,
          bestSlot.position.z
        );
        this.ghostHoverGroup.scale.set(
          bestSlot.brickW * 1.02,
          bestSlot.brickH * 1.02,
          bestSlot.brickD * 1.02
        );
        this.ghostHoverGroup.visible = true;
      } else if (bestSlot.marker) {
        bestSlot.marker.material = this.mats.slotSnap;
        bestSlot.marker.scale.setScalar(1.16);
      }
    }

    let groundY = this.getTerrainHeight ? this.getTerrainHeight(dragPos.x, dragPos.z) : this.cityGroundY;
    if (bestSlot) {
      groundY = bestSlot.dropIndicatorY;
    }

    return { snapZone: bestSlot, groundY };
  }

  clearDropHighlights() {
    this.slotMarkers.forEach((m) => {
      m.material = this.mats.slotIdle;
      m.scale.setScalar(1);
    });
    this._hoveredCitySlot = null;
    if (this.ghostHoverGroup) {
      this.ghostHoverGroup.visible = false;
    }
  }

  onBlockDrop(block, targetSlot) {
    if (!this._isDropTargetStrictlyValid(block, targetSlot)) {
      this.onBlockDragCancel(block);
      return;
    }

    if (targetSlot.zoneType !== 'pyramid') {
      super.onBlockDrop(block, targetSlot);
      return;
    }

    // Valid drop onto a City Blueprint Ghost Slot!
    this._cancelBlockTweens(block);
    block.isDragging = false;
    block.originSlot = null;
    block.slot = targetSlot;
    block.locked = true;
    block.isTweening = true;
    targetSlot.occupied = true;
    targetSlot.block = block;

    block.mesh.userData.draggable = false;
    block.mesh.userData.state = 'placed';
    delete block.mesh.userData.interact;
    this._rebuildHitTargets();

    // Immediately hide this slot's ghost so no second brick can target it while flying in
    this._rebuildActiveGhostVisuals();

    this._addTween({
      block,
      from: block.mesh.position.clone(),
      to: targetSlot.position.clone(),
      duration: 0.16,
      arcHeight: 0.28,
      onDone: () => {
        block.isTweening = false;
        // Transfer carried mesh cleanly into the static InstancedMesh batch & remove temporary mesh!
        this.root.remove(block.mesh);
        const bIdx = this.blocks.indexOf(block);
        if (bIdx !== -1) this.blocks.splice(bIdx, 1);
        this._rebuildHitTargets();

        this._commitCitySlotPlacement(targetSlot, true);
      },
    });
  }

  /**
   * Single-source-of-truth slot placement & validation (shared by manual drops and auto-placement).
   * Guarantees exact global & per-district counter synchronization with zero double-counting.
   */
  _commitCitySlotPlacement(slot, playAudioAndFx = true) {
    if (!slot || slot._committed) return false;
    slot._committed = true;
    slot.occupied = true;
    if (!slot.block) {
      slot.block = { id: `inst_${slot.index}`, locked: true, slot };
    }

    // Reveal the brick/slab in its dedicated InstancedMesh with a juicy pop-in scale animation!
    const inst = this.instancedBatches.get(slot.batchKey);
    if (inst && slot.instIndex >= 0) {
      this.instancedPopAnims.push({
        inst,
        index: slot.instIndex,
        pos: slot.position,
        t: 0,
      });
      _tmpScale.set(1.16, 0.78, 1.16);
      _tmpMat4.compose(slot.position, _tmpQuat, _tmpScale);
      inst.setMatrixAt(slot.instIndex, _tmpMat4);
      inst.instanceMatrix.needsUpdate = true;
    }

    const dist = slot.district;
    dist.placedCount += 1;
    this.placedCount += 1;

    if (playAudioAndFx) {
      if (this.audio && typeof this.audio.playBlueprintSnap === 'function') {
        this.audio.playBlueprintSnap(slot.layer);
      }
      this._spawnParticles(slot.position, {
        count: 9,
        material: this.mats.dustGold,
        speed: 2.0,
        upSpeed: 2.3,
        scale: 0.72,
      });
    }

    // Check if the district's current vertical layer is complete -> unlock next layer!
    const currentLayerDone = dist.slots
      .filter((s) => s.layer === dist.activeLayer)
      .every((s) => s._committed || s.occupied);

    if (currentLayerDone) {
      if (dist.activeLayer < dist.maxLayer) {
        dist.activeLayer += 1;
        if (playAudioAndFx && this.audio && typeof this.audio.playLayerComplete === 'function') {
          this.audio.playLayerComplete(dist.activeLayer);
        }
      } else if (!dist.completed && dist.placedCount >= dist.totalCount) {
        dist.completed = true;
        this._onDistrictCompleted(dist, playAudioAndFx);
      }
    }

    if (this.onProgress) {
      this.onProgress(this.placedCount, this.totalGoal);
    }

    this._rebuildActiveGhostVisuals();
    this._syncCityHud();

    // Check global village completion!
    if (this.placedCount >= this.totalGoal && !this.isComplete) {
      this._triggerCityVictory();
    }
    return true;
  }

  /**
   * Programmatic / auto-placement helper using the exact same single-source-of-truth validation.
   */
  autoPlaceSlot(slot, playAudioAndFx = false) {
    if (!slot || slot._committed || slot.occupied) return false;
    return this._commitCitySlotPlacement(slot, playAudioAndFx);
  }

  _onDistrictCompleted(dist, playAudioAndFx = true) {
    // Reveal pitched roof / barn gable / church spire / well canopy with celebratory bounce!
    if (dist.roofGroup && dist.roofGroup.children.length > 0) {
      dist.roofGroup.visible = true;
      dist.roofGroup.scale.set(0.82, 0.12, 0.82);
      this.roofRevealAnims.push({ group: dist.roofGroup, t: 0 });
    }

    if (playAudioAndFx) {
      if (this.audio && typeof this.audio.playLayerComplete === 'function') {
        this.audio.playLayerComplete(3);
      }
      this._spawnParticles(dist.center, {
        count: 26,
        material: this.mats.dustGold,
        speed: 3.6,
        upSpeed: 4.5,
        life: 0.9,
        scale: 0.95,
        spread: 1.4,
      });
    }

    // Automatically focus the next incomplete district if we are in zone mode
    const nextDist = this.districts.find((d) => !d.completed);
    if (nextDist && this.ghostMode === 'zone') {
      this.activeDistrictId = nextDist.id;
    }
  }

  _triggerCityVictory() {
    this.isComplete = true;
    this.clearDropHighlights();
    this._updateCarvingPips();
    if (this.audio && typeof this.audio.playVictoryFanfare === 'function') {
      this.audio.playVictoryFanfare();
    }

    // Radiant golden victory sunbeam rising from the village central plaza
    this.victoryGroup = new THREE.Group();
    this.victoryGroup.position.set(this.pyramidCenter.x, 1.2, this.pyramidCenter.z);
    const innerBeamMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffdf78,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamInner = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.65, 3.2, 14.0, 20, 1, true)),
      innerBeamMat
    );
    this.victoryBeamInner.position.y = 6.2;
    this.victoryGroup.add(this.victoryBeamInner);

    const outerBeamMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.maps.sunbeam,
        color: 0xffc040,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.victoryBeamOuter = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(1.2, 4.8, 15.0, 22, 1, true)),
      outerBeamMat
    );
    this.victoryBeamOuter.position.y = 6.5;
    this.victoryGroup.add(this.victoryBeamOuter);
    this.root.add(this.victoryGroup);

    if (this.onComplete) {
      this.onComplete({
        levelId: this.cityConfig.id || 'level10_village',
        focusPoint: this.pyramidCenter.clone().add(new THREE.Vector3(0, 1.6, 0)),
        rewardCoins: this.cityConfig.rewardCoins || 450,
        firstCompletionTokens: this.cityConfig.firstCompletionTokens || 80,
      });
    }
  }

  /* ============================================================================
   * COMPACT MOBILE DISTRICT SELECTOR RIBBON (390x844 Safe-Area Friendly)
   * ========================================================================== */
  _mountCityHud() {
    this._unmountCityHud();
    if (typeof document === 'undefined') return;
    const rootEl = document.getElementById('game-root') || document.body;

    const bar = document.createElement('div');
    bar.id = 'city-district-bar';
    bar.className = 'city-district-bar';
    bar.setAttribute('aria-label', 'Quartiers du village');

    const modeBtn = document.createElement('button');
    modeBtn.type = 'button';
    modeBtn.className = 'city-mode-pill';
    modeBtn.dataset.cityModeToggle = 'true';
    modeBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playTabBounce();
      this.setGhostMode(this.ghostMode === 'zone' ? 'proximity' : 'zone');
    });
    bar.appendChild(modeBtn);
    this.cityModeBtn = modeBtn;

    const scroller = document.createElement('div');
    scroller.className = 'city-district-scroll';

    this.districts.forEach((d) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'city-district-chip';
      chip.dataset.districtId = d.id;
      chip.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.setActiveDistrict(d.id, true);
      });
      scroller.appendChild(chip);
      this.cityHudChips.set(d.id, chip);
    });

    bar.appendChild(scroller);
    rootEl.appendChild(bar);
    this.cityHudEl = bar;
    this._syncCityHud();
  }

  _syncCityHud() {
    if (!this.cityHudEl) return;
    if (this.cityModeBtn) {
      const isZone = this.ghostMode === 'zone';
      this.cityModeBtn.textContent = isZone ? '🎯 Zone' : '📡 Rayon';
      this.cityModeBtn.classList.toggle('is-proximity', !isZone);
    }
    this.districts.forEach((d) => {
      const chip = this.cityHudChips.get(d.id);
      if (!chip) return;
      const isActive = this.ghostMode === 'zone' && d.id === this.activeDistrictId;
      chip.classList.toggle('is-active', isActive);
      chip.classList.toggle('is-complete', d.completed);
      chip.textContent = d.completed
        ? `${d.icon} ${d.shortName} ✓`
        : `${d.icon} ${d.shortName} ${d.placedCount}/${d.totalCount}`;
    });
  }

  _unmountCityHud() {
    if (this.cityHudEl && this.cityHudEl.parentNode) {
      this.cityHudEl.parentNode.removeChild(this.cityHudEl);
    }
    this.cityHudEl = null;
    this.cityHudChips.clear();
    this.cityModeBtn = null;
  }

  /* ============================================================================
   * UPDATE LOOP (INSTANCED POP-INS, ROOF BOUNCE, PROXIMITY REFRESH & SHADER PULSE)
   * ========================================================================== */
  update(dt, elapsed) {
    super.update(dt, elapsed);

    // 1. Pop-in spring bounce for newly placed InstancedMesh bricks
    for (let i = this.instancedPopAnims.length - 1; i >= 0; i--) {
      const a = this.instancedPopAnims[i];
      a.t += dt;
      if (a.t >= 0.34) {
        _tmpScale.set(1, 1, 1);
        _tmpMat4.compose(a.pos, _tmpQuat, _tmpScale);
        a.inst.setMatrixAt(a.index, _tmpMat4);
        a.inst.instanceMatrix.needsUpdate = true;
        this.instancedPopAnims.splice(i, 1);
      } else {
        const osc = -Math.exp(-10.5 * a.t) * Math.cos(a.t * 25.0) * 0.22;
        const sy = Math.max(0.74, 1 + osc);
        const sxz = 1 / Math.sqrt(sy);
        _tmpScale.set(sxz, sy, sxz);
        _tmpMat4.compose(a.pos, _tmpQuat, _tmpScale);
        a.inst.setMatrixAt(a.index, _tmpMat4);
        a.inst.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Smooth roof pop-in reveal bounce on completed village houses/barn/church/well
    for (let i = this.roofRevealAnims.length - 1; i >= 0; i--) {
      const r = this.roofRevealAnims[i];
      r.t += dt;
      if (r.t >= 0.48) {
        r.group.scale.set(1, 1, 1);
        this.roofRevealAnims.splice(i, 1);
      } else {
        const p = Math.min(1, r.t / 0.48);
        const ease = 1 - Math.pow(1 - p, 3);
        const overshoot = Math.sin(p * Math.PI) * 0.1;
        r.group.scale.set(
          THREE.MathUtils.lerp(0.84, 1, ease) + overshoot * 0.4,
          Math.max(0.12, ease + overshoot),
          THREE.MathUtils.lerp(0.84, 1, ease) + overshoot * 0.4
        );
      }
    }

    // 3. In proximity mode, refresh visible ghosts whenever camera pans > 0.85 units
    if (this.ghostMode === 'proximity' && this.cameraController) {
      const tgt = this.cameraController.target;
      if (tgt.distanceToSquared(this._lastProxTarget) > 0.72) {
        this._lastProxTarget.copy(tgt);
        this._rebuildActiveGhostVisuals(tgt);
      }
    }

    // 4. Keep blueprint skin uniforms synced
    const isDraggingFinished = this.blocks.some((b) => b.isDragging && b.kind !== 'raw');
    updateBlueprintSkinUniforms(this.mats, elapsed, { isDraggingFinished });
  }

  dispose() {
    this._unmountCityHud();
    this.instancedBatches.clear();
    this.districts.length = 0;
    this.districtById.clear();
    this.citySlotMap.clear();
    super.dispose();
  }
}
