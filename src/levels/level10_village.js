/**
 * Workd Builder — Level 10: Village Médiéval (First "Niveau Palier Ville" Milestone)
 *
 * Built atop the reusable `CityLevelBuilder` template so future multiples of 10
 * (Level 20 Cité Romaine, Level 30 Village Japonais, Level 40 Cité Maya, etc.)
 * can duplicate this exact multi-district city pipeline by swapping the theme & district config.
 *
 * Exact Level 10 Village Composition:
 *  - Place centrale & Puits: 4x4 stone well with 2-brick-high rim (margelle) around water shaft
 *  - Chemins pavés: 2-block-wide cobblestone alleys connecting the Well Plaza to every building
 *  - 6 Houses: 2 small cottages (4x5), 2 medium houses (6x6), 1 artisan house (6x7), 1 two-story house (7x8)
 *  - Grande Ferme: imposing 9x11 barn/farmhouse with 3x2 cart doorway (porte charretière)
 *  - 2 Champs cultivés: ploughed soil plots adjacent to the farm with 1-brick-high perimeter walls
 *  - Église: 7x10 stone nave with 6 exterior buttresses (contreforts) + tall 6-brick bell tower (clocher)
 *  - Cimetière: beside the church with pre-placed tombs/crosses, 2-brick-high enclosure wall & 2-block gate
 *  - Full Workd Builder loop: SW Quarry -> Sled A -> Stonecutter Workshop -> Sled B -> Village Staging Yard
 */

import * as THREE from 'three';
import {
  CityLevelBuilder,
  CITY_STEP,
  CITY_BRICK_H,
  buildWellBlueprint,
  buildRectBuildingBlueprint,
  buildPerimeterWallBlueprint,
  buildChurchBlueprint,
  buildRoadNetworkBlueprint,
} from './cityLevelBuilder.js';
import {
  createCozyGroundFoliageSystem,
  createContactShadowSystem,
  createMatteFoliageMaterial,
  createRootedTrunk,
  createOrganicFoliageBlobGeo,
  createIrregularConiferTierGeo,
} from '../foliageAndGround.js';

const TERRAIN_W = 44.0;
const TERRAIN_D = 42.0;
const TERRAIN_SEGS = 128;

const BLOCK_W = 0.96;
const BLOCK_H = 0.64;
const BLOCK_D = 0.96;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function rectFlatMask(x, z, cx, cz, hw, hd, feather = 1.6) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return 1.0 - smoothstep(0, feather, Math.hypot(dx, dz));
}

function sampleVillageTerrainHeight(x, z) {
  // Rolling medieval countryside hills around outer village rim
  let h =
    Math.sin(x * 0.16 + 0.4) * Math.cos(z * 0.15 - 0.3) * 0.14 +
    Math.sin(x * 0.38 - z * 0.32) * 0.04;

  const northRidge = smoothstep(-14.2, -19.5, z) * 1.35;
  const southRidge = smoothstep(15.2, 20.0, z) * 0.62;
  const westRidge = smoothstep(-17.8, -21.5, x) * 1.1;
  const eastRidge = smoothstep(16.6, 21.5, x) * 1.05;
  h += northRidge + southRidge + westRidge + eastRidge;

  // Shallow grey-limestone quarry excavation in South-West yard
  const pitDist = Math.hypot((x + 14.5) * 0.85, (z - 1.2) * 0.95);
  h -= (1.0 - smoothstep(1.3, 3.2, pitDist)) * 0.42;

  // Flat village plateau + SW production yard so every brick & road slab sits flush at y = 0
  const villageFlat = Math.max(
    rectFlatMask(x, z, -0.5, -1.5, 17.5, 13.5, 2.2),
    rectFlatMask(x, z, -9.5, 10.5, 8.2, 5.2, 1.8)
  );
  h *= 1.0 - villageFlat;

  // Subtle rim taper
  const edgeX = smoothstep(TERRAIN_W * 0.46, TERRAIN_W * 0.5, Math.abs(x));
  const edgeZ = smoothstep(TERRAIN_D * 0.46, TERRAIN_D * 0.5, Math.abs(z));
  h -= Math.max(edgeX, edgeZ) * 0.14;
  return h;
}

/* ============================================================================
 * REUSABLE MEDIEVAL ROOF, BASE & DECOR BUILDERS
 * ========================================================================== */

function addPitchedRoof(group, { cx, cz, widthWorld, depthWorld, wallTopY, ridgeH, mat, trimMat, ridgeAlongX = false, hasChimney = true, stoneMat = null, trackGeo }) {
  const overhang = 0.34;
  const rw = widthWorld + overhang * 2;
  const rd = depthWorld + overhang * 2;

  // Build pitched prism roof using ExtrudeGeometry for crisp gable triangles
  const span = ridgeAlongX ? rd : rw;
  const length = ridgeAlongX ? rw : rd;
  const halfSpan = span * 0.5;

  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, 0);
  shape.lineTo(halfSpan, 0);
  shape.lineTo(0, ridgeH);
  shape.closePath();

  const extrudeGeo = trackGeo(
    new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: false,
    })
  );
  extrudeGeo.translate(0, 0, -length * 0.5);
  if (ridgeAlongX) {
    extrudeGeo.rotateY(Math.PI * 0.5);
  }

  const roofMesh = new THREE.Mesh(extrudeGeo, mat);
  roofMesh.position.set(cx, wallTopY - 0.02, cz);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  // Dark oak ridge beam crowning the roof peak
  const beamGeo = trackGeo(
    new THREE.BoxGeometry(
      ridgeAlongX ? length + 0.14 : 0.16,
      0.16,
      ridgeAlongX ? 0.16 : length + 0.14
    )
  );
  const beam = new THREE.Mesh(beamGeo, trimMat);
  beam.position.set(cx, wallTopY + ridgeH + 0.02, cz);
  beam.castShadow = true;
  group.add(beam);

  // Optional cozy stone chimney
  if (hasChimney && stoneMat) {
    const chimGeo = trackGeo(new THREE.BoxGeometry(0.46, ridgeH * 0.72 + 0.45, 0.46));
    const chim = new THREE.Mesh(chimGeo, stoneMat);
    chim.position.set(cx + rw * 0.24, wallTopY + ridgeH * 0.55, cz - rd * 0.16);
    chim.castShadow = true;
    group.add(chim);

    const capGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.1, 0.56));
    const cap = new THREE.Mesh(capGeo, trimMat);
    cap.position.set(cx + rw * 0.24, wallTopY + ridgeH * 0.55 + (ridgeH * 0.72 + 0.45) * 0.5 + 0.04, cz - rd * 0.16);
    group.add(cap);
  }
}

function addFoundationPad(group, { cx, cz, widthWorld, depthWorld, mat, trackGeo, y = 0.03 }) {
  const geo = trackGeo(new THREE.BoxGeometry(widthWorld + 0.18, 0.08, depthWorld + 0.18));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, y, cz);
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  group.add(mesh);
}

/* ============================================================================
 * LEVEL 10 — VILLAGE MÉDIÉVAL (DECLARATIVE CITY CONFIG + THEME)
 * ========================================================================== */

export class Level10Village extends CityLevelBuilder {
  static meta = {
    id: 'level10_village',
    title: 'Niveau 10 : Village Médiéval',
    hudLabel: 'Village',
    totalGoal: 782,
  };

  constructor(options) {
    super(options);
  }

  _initCityThemeAssets() {
    this.medieval = this.textures.ensureMedievalPack();
    const cm = this.medieval.materials;

    // Distinct stylized medieval PBR materials for each village architectural role
    this.villageMats = {
      well_stone: cm.castleAshlar,
      paving_slab: cm.cobbleCourt,
      wall_stone: this._trackMat(
        cm.castleBaseStone.clone()
      ),
      timber_plaster: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#eadcc2'),
          normalMap: cm.castleAshlar.normalMap,
          normalScale: new THREE.Vector2(0.55, 0.55),
          roughness: 0.88,
          metalness: 0.02,
        })
      ),
      barn_brick: this._trackMat(
        new THREE.MeshStandardMaterial({
          map: cm.castleAshlar.map,
          normalMap: cm.castleAshlar.normalMap,
          normalScale: new THREE.Vector2(1.25, 1.25),
          color: new THREE.Color('#c8825a'),
          roughness: 0.86,
          metalness: 0.04,
        })
      ),
      church_stone: cm.crenellationStone,
      low_wall: this._trackMat(
        new THREE.MeshStandardMaterial({
          map: cm.castleAshlar.map,
          normalMap: cm.castleAshlar.normalMap,
          normalScale: new THREE.Vector2(1.4, 1.4),
          color: new THREE.Color('#a8a397'),
          roughness: 0.92,
          metalness: 0.03,
        })
      ),
      thatchRoof: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#d2a44b'),
          roughness: 0.92,
          metalness: 0.02,
        })
      ),
      tileRoof: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#a44e34'),
          roughness: 0.78,
          metalness: 0.05,
        })
      ),
      slateRoof: cm.conicalSlate,
      barnRoof: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#7c4d30'),
          roughness: 0.86,
          metalness: 0.04,
        })
      ),
      ploughedSoil: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#6a4829'),
          roughness: 0.95,
          metalness: 0.0,
        })
      ),
      wheatGold: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#e2b84c'),
          roughness: 0.86,
          metalness: 0.02,
        })
      ),
      cropGreen: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#528a3d'),
          roughness: 0.88,
          metalness: 0.0,
        })
      ),
      tombStone: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#8e918d'),
          roughness: 0.9,
          metalness: 0.05,
        })
      ),
      cypressFoliage: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#2c5234'),
          roughness: 0.9,
          metalness: 0.0,
          flatShading: true,
        })
      ),
      matteFoliage: this._trackMat(createMatteFoliageMaterial()),
      goldCross: this.textures.materials.capstoneGold,
      oakTimber: cm.oakTimber,
      darkOak: cm.darkOak,
      wroughtIron: cm.wroughtIron,
      water: cm.moatWater,
      plazaStone: this._trackMat(
        new THREE.MeshStandardMaterial({
          map: cm.cobbleCourt.map,
          color: new THREE.Color('#d2cab8'),
          roughness: 0.9,
          metalness: 0.02,
        })
      ),
    };

    // Match carried carved bricks to warm dressed medieval stone
    this.carvedBlockMat = cm.castleAshlar;
  }

  _getCityBlockMaterials() {
    return this.villageMats;
  }

  _getRawBlockMaterial() {
    return this.medieval ? this.medieval.materials.rawQuarryStone : super._getRawBlockMaterial();
  }

  getTerrainHeight(x, z) {
    return sampleVillageTerrainHeight(x, z);
  }

  /**
   * Declarative City Configuration for Level 10: Village Médiéval.
   * Replicated effortlessly for Levels 20, 30, 40... by swapping district blueprints & materials!
   */
  _getCityConfig() {
    const step = CITY_STEP;
    const bh = CITY_BRICK_H;
    const trackGeo = (g) => this._trackGeo(g);

    const rectWorld = (ox, oz, w, d) => ({
      cx: (ox + (w - 1) * 0.5) * step,
      cz: (oz + (d - 1) * 0.5) * step,
      wWorld: w * step,
      dWorld: d * step,
    });

    // Exclude all building/enclosure footprints from the 2-wide cobblestone road network
    const excludeRects = [
      { minGx: -2, maxGx: 1, minGz: -2, maxGz: 1 },       // Puits
      { minGx: -17, maxGx: -9, minGz: -16, maxGz: -6 },   // Grande Ferme (9x11)
      { minGx: -25, maxGx: -19, minGz: -16, maxGz: -11 }, // Champ Nord
      { minGx: -25, maxGx: -19, minGz: -9, maxGz: -4 },   // Champ Sud
      { minGx: -7, maxGx: -4, minGz: -14, maxGz: -10 },   // Chaumière 1 (4x5)
      { minGx: 0, maxGx: 3, minGz: -14, maxGz: -10 },     // Chaumière 2 (4x5)
      { minGx: 5, maxGx: 13, minGz: -16, maxGz: -7 },     // Église + Contreforts
      { minGx: 15, maxGx: 21, minGz: -15, maxGz: -8 },    // Cimetière
      { minGx: 13, maxGx: 18, minGz: -2, maxGz: 4 },      // Maison d'Artisan (6x7)
      { minGx: -9, maxGx: -4, minGz: 4, maxGz: 9 },       // Maison Moyenne 1 (6x6)
      { minGx: 3, maxGx: 8, minGz: 4, maxGz: 9 },         // Maison Moyenne 2 (6x6)
      { minGx: 11, maxGx: 17, minGz: 6, maxGz: 13 },      // Grande Maison à Étage (7x8)
    ];

    const roadCells = buildRoadNetworkBlueprint({
      blockType: 'paving_slab',
      excludeRects,
      corridors: [
        // Main East-West Village Avenue (2 wide, gz = -5..-4) linking Fields, Ferme, Plaza, Church & Cemetery
        { x0: -18, z0: -5, x1: 18, z1: -4, width: 2 },
        // Central North-South Avenue (2 wide, gx = -1..0) from Main Avenue around Well Plaza down to Staging Yard
        { x0: -1, z0: -5, x1: 0, z1: 10, width: 2 },
        // Plaza Perimeter Loop around Well (2 wide on West & East of well)
        { x0: -4, z0: -3, x1: -3, z1: 2, width: 2 },
        { x0: 2, z0: -3, x1: 3, z1: 2, width: 2 },
        // Spurs North to Petite Chaumière 1 & Petite Chaumière 2 (2 wide)
        { x0: -6, z0: -9, x1: -5, z1: -6, width: 2 },
        { x0: 1, z0: -9, x1: 2, z1: -6, width: 2 },
        // Spur North to Église portal (2 wide)
        { x0: 8, z0: -6, x1: 9, z1: -6, width: 2 },
        // Spur North-East to Cimetière 2-wide entrance gate (2 wide)
        { x0: 17, z0: -7, x1: 18, z1: -6, width: 2 },
        // Spur East from Well Plaza to Maison d'Artisan doorway (2 wide)
        { x0: 4, z0: 0, x1: 12, z1: 1, width: 2 },
        // Spurs South-West & South-East to Maisons Moyennes 1 & 2 (2 wide)
        { x0: -8, z0: 2, x1: -2, z1: 3, width: 2 },
        { x0: 2, z0: 2, x1: 10, z1: 3, width: 2 },
        // Spur South-East to Grande Maison à Étage (2 wide)
        { x0: 9, z0: 4, x1: 10, z1: 9, width: 2 },
      ],
    });

    return {
      id: 'level10_village',
      themeId: 'medieval',
      plazaCenter: { x: -0.36, z: -0.36 },
      gridStep: step,
      brickW: step,
      brickH: bh,
      brickD: step,
      slabH: 0.16,
      groundY: 0.02,
      proximityRadius: 8.2,
      rewardCoins: 450,
      firstCompletionTokens: 80,
      dragBounds: { minX: -20.5, maxX: 19.5, minZ: -17.5, maxZ: 17.5 },
      cameraPreset: {
        target: new THREE.Vector3(-0.6, 0.35, 0.2),
        elevationDeg: 52,
        azimuth: 0.08,
        minDistance: 10.5,
        maxDistance: 74.0,
        panBounds: { minX: -18.5, maxX: 18.0, minZ: -16.0, maxZ: 16.5 },
        distanceScale: 1.55,
      },
      districts: [
        /* 1. PLACE CENTRALE & PUITS (2 bricks high rim around water shaft) */
        {
          id: 'puits',
          name: 'Place Centrale & Puits',
          shortName: 'Puits',
          icon: '⛲',
          blockType: 'well_stone',
          cells: buildWellBlueprint({ originGx: -2, originGz: -2, outerSize: 4, height: 2, blockType: 'well_stone' }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-2, -2, 4, 4);
            // Cobblestone plaza apron beneath the well
            addFoundationPad(group, {
              cx,
              cz,
              widthWorld: wWorld + 1.5,
              depthWorld: dWorld + 1.5,
              mat: this.villageMats.plazaStone,
              trackGeo,
              y: 0.02,
            });
            // Deep well shaft inner wall + sparkling turquoise water disk
            const shaft = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(step * 2.02, 0.22, step * 2.02)),
              this.villageMats.darkOak
            );
            shaft.position.set(cx, 0.08, cz);
            group.add(shaft);
            const water = new THREE.Mesh(
              trackGeo(new THREE.PlaneGeometry(step * 1.9, step * 1.9)),
              this.villageMats.water
            );
            water.rotation.x = -Math.PI / 2;
            water.position.set(cx, 0.22, cz);
            group.add(water);
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-2, -2, 4, 4);
            const rimTopY = bh * 2 + 0.04;
            // Twin oak support posts + windlass roller + rope + wooden bucket
            [-wWorld * 0.36, wWorld * 0.36].forEach((ox) => {
              const post = new THREE.Mesh(
                trackGeo(new THREE.BoxGeometry(0.18, 1.35, 0.18)),
                this.villageMats.oakTimber
              );
              post.position.set(cx + ox, rimTopY + 0.65, cz);
              post.castShadow = true;
              roofGroup.add(post);
            });
            const roller = new THREE.Mesh(
              trackGeo(new THREE.CylinderGeometry(0.08, 0.08, wWorld * 0.78, 8)),
              this.villageMats.darkOak
            );
            roller.rotation.z = Math.PI / 2;
            roller.position.set(cx, rimTopY + 0.62, cz);
            roofGroup.add(roller);
            const bucket = new THREE.Mesh(
              trackGeo(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8)),
              this.villageMats.oakTimber
            );
            bucket.position.set(cx, rimTopY + 0.14, cz);
            roofGroup.add(bucket);

            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld * 0.92,
              depthWorld: dWorld * 0.92,
              wallTopY: rimTopY + 1.25,
              ridgeH: 0.78,
              mat: this.villageMats.slateRoof,
              trimMat: this.villageMats.darkOak,
              ridgeAlongX: true,
              hasChimney: false,
              trackGeo,
            });
          },
        },

        /* 2. CHEMINS PAVÉS (2-block-wide cobblestone alleys connecting Well Plaza to all buildings) */
        {
          id: 'chemins',
          name: 'Chemins Pavés',
          shortName: 'Chemins',
          icon: '🛤️',
          blockType: 'paving_slab',
          cells: roadCells,
        },

        /* 3. PETITE CHAUMIÈRE 1 (4x5) */
        {
          id: 'chaumiere_1',
          name: 'Petite Chaumière Ouest (4×5)',
          shortName: 'Chaumière 1',
          icon: '🏡',
          blockType: 'wall_stone',
          cells: buildRectBuildingBlueprint({
            originGx: -7,
            originGz: -14,
            width: 4,
            depth: 5,
            height: 2,
            doors: [{ side: 'south', start: 1, width: 1, height: 1 }],
            blockType: 'wall_stone',
            upperBlockType: 'timber_plaster',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-7, -14, 4, 5);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-7, -14, 4, 5);
            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld,
              depthWorld: dWorld,
              wallTopY: bh * 2 + 0.04,
              ridgeH: 1.05,
              mat: this.villageMats.thatchRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.wall_stone,
              trackGeo,
            });
          },
        },

        /* 4. PETITE CHAUMIÈRE 2 (4x5) */
        {
          id: 'chaumiere_2',
          name: 'Petite Chaumière Est (4×5)',
          shortName: 'Chaumière 2',
          icon: '🏡',
          blockType: 'wall_stone',
          cells: buildRectBuildingBlueprint({
            originGx: 0,
            originGz: -14,
            width: 4,
            depth: 5,
            height: 2,
            doors: [{ side: 'south', start: 1, width: 1, height: 1 }],
            blockType: 'wall_stone',
            upperBlockType: 'timber_plaster',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(0, -14, 4, 5);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(0, -14, 4, 5);
            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld,
              depthWorld: dWorld,
              wallTopY: bh * 2 + 0.04,
              ridgeH: 1.05,
              mat: this.villageMats.thatchRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.wall_stone,
              trackGeo,
            });
          },
        },

        /* 5. MAISON MOYENNE 1 (6x6) */
        {
          id: 'maison_moy_1',
          name: 'Maison Moyenne Ouest (6×6)',
          shortName: 'Maison 1',
          icon: '🏠',
          blockType: 'wall_stone',
          cells: buildRectBuildingBlueprint({
            originGx: -9,
            originGz: 4,
            width: 6,
            depth: 6,
            height: 2,
            doors: [{ side: 'north', start: 2, width: 1, height: 1 }],
            blockType: 'wall_stone',
            upperBlockType: 'timber_plaster',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-9, 4, 6, 6);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-9, 4, 6, 6);
            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld,
              depthWorld: dWorld,
              wallTopY: bh * 2 + 0.04,
              ridgeH: 1.32,
              mat: this.villageMats.tileRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.wall_stone,
              trackGeo,
            });
          },
        },

        /* 6. MAISON MOYENNE 2 (6x6) */
        {
          id: 'maison_moy_2',
          name: 'Maison Moyenne Est (6×6)',
          shortName: 'Maison 2',
          icon: '🏠',
          blockType: 'wall_stone',
          cells: buildRectBuildingBlueprint({
            originGx: 3,
            originGz: 4,
            width: 6,
            depth: 6,
            height: 2,
            doors: [{ side: 'north', start: 2, width: 1, height: 1 }],
            blockType: 'wall_stone',
            upperBlockType: 'timber_plaster',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(3, 4, 6, 6);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(3, 4, 6, 6);
            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld,
              depthWorld: dWorld,
              wallTopY: bh * 2 + 0.04,
              ridgeH: 1.32,
              mat: this.villageMats.slateRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.wall_stone,
              ridgeAlongX: true,
              trackGeo,
            });
          },
        },

        /* 7. MAISON D'ARTISAN (6x7) */
        {
          id: 'maison_artisan',
          name: "Maison d'Artisan (6×7)",
          shortName: 'Artisan',
          icon: '⚒️',
          blockType: 'wall_stone',
          cells: buildRectBuildingBlueprint({
            originGx: 13,
            originGz: -2,
            width: 6,
            depth: 7,
            height: 2,
            doors: [{ side: 'west', start: 2, width: 2, height: 1 }],
            blockType: 'wall_stone',
            upperBlockType: 'timber_plaster',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(13, -2, 6, 7);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
            // Artisan anvil & guild sign post outside West doorway
            const post = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(0.14, 1.35, 0.14)),
              this.villageMats.darkOak
            );
            post.position.set(cx - wWorld * 0.5 - 0.35, 0.68, cz - 1.0);
            group.add(post);
            const sign = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(0.45, 0.32, 0.08)),
              this.villageMats.oakTimber
            );
            sign.position.set(cx - wWorld * 0.5 - 0.55, 1.15, cz - 1.0);
            group.add(sign);
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(13, -2, 6, 7);
            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld,
              depthWorld: dWorld,
              wallTopY: bh * 2 + 0.04,
              ridgeH: 1.45,
              mat: this.villageMats.tileRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.wall_stone,
              trackGeo,
            });
          },
        },

        /* 8. GRANDE MAISON À ÉTAGE (7x8, 3 bricks high!) */
        {
          id: 'grande_maison',
          name: 'Grande Maison à Étage (7×8)',
          shortName: 'Grande Maison',
          icon: '🏘️',
          blockType: 'wall_stone',
          cells: buildRectBuildingBlueprint({
            originGx: 11,
            originGz: 6,
            width: 7,
            depth: 8,
            height: 3,
            doors: [{ side: 'west', start: 2, width: 2, height: 2 }],
            blockType: 'wall_stone',
            upperBlockType: 'timber_plaster',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(11, 6, 7, 8);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(11, 6, 7, 8);
            // Half-timbered jetty overhang band between floor 1 & 2
            const band = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(wWorld + 0.22, 0.14, dWorld + 0.22)),
              this.villageMats.darkOak
            );
            band.position.set(cx, bh * 3 + 0.04, cz);
            roofGroup.add(band);

            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld + 0.12,
              depthWorld: dWorld + 0.12,
              wallTopY: bh * 3 + 0.1,
              ridgeH: 1.72,
              mat: this.villageMats.slateRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.wall_stone,
              trackGeo,
            });
          },
        },

        /* 9. GRANDE FERME (9x11, 3 bricks high + wide 3x2 porte charretière) */
        {
          id: 'grande_ferme',
          name: 'Grande Ferme (9×11)',
          shortName: 'Grande Ferme',
          icon: '🌾',
          blockType: 'barn_brick',
          cells: buildRectBuildingBlueprint({
            originGx: -17,
            originGz: -16,
            width: 9,
            depth: 11,
            height: 3,
            // Wide cart-doorway (porte charretière: 3 blocks wide x 2 high) facing South Avenue
            doors: [{ side: 'south', start: 3, width: 3, height: 2 }],
            blockType: 'barn_brick',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-17, -16, 9, 11);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld, depthWorld: dWorld, mat: this.villageMats.plazaStone, trackGeo });
            // Hay bales stacked beside the barn exterior
            const baleGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.62, 10));
            baleGeo.rotateZ(Math.PI / 2);
            [
              [cx + wWorld * 0.5 + 0.48, 0.32, cz + 1.4],
              [cx + wWorld * 0.5 + 0.48, 0.32, cz + 2.1],
              [cx + wWorld * 0.5 + 0.48, 0.86, cz + 1.75],
            ].forEach(([bx, by, bz]) => {
              const bale = new THREE.Mesh(baleGeo, this.villageMats.wheatGold);
              bale.position.set(bx, by, bz);
              bale.castShadow = true;
              group.add(bale);
            });
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-17, -16, 9, 11);
            // Timber lintel over the 3-wide porte charretière + hayloft hoist beam
            const hoist = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(0.22, 0.22, 1.4)),
              this.villageMats.darkOak
            );
            hoist.position.set(cx, bh * 3 + 1.35, cz + dWorld * 0.5 + 0.45);
            roofGroup.add(hoist);

            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld + 0.15,
              depthWorld: dWorld + 0.15,
              wallTopY: bh * 3 + 0.04,
              ridgeH: 2.15,
              mat: this.villageMats.barnRoof,
              trimMat: this.villageMats.darkOak,
              stoneMat: this.villageMats.barn_brick,
              hasChimney: false,
              trackGeo,
            });
          },
        },

        /* 10. CHAMP CULTIVÉ NORD (1-brick-high perimeter wall + furrowed wheat plot) */
        {
          id: 'champ_nord',
          name: 'Champ Cultivé Nord',
          shortName: 'Champ Nord',
          icon: '🌽',
          blockType: 'low_wall',
          cells: buildPerimeterWallBlueprint({
            originGx: -25,
            originGz: -16,
            width: 7,
            depth: 6,
            height: 1,
            gates: [{ side: 'east', start: 2, width: 1, height: 1 }],
            blockType: 'low_wall',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-25, -16, 7, 6);
            const soil = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(wWorld - step * 1.4, 0.09, dWorld - step * 1.4)),
              this.villageMats.ploughedSoil
            );
            soil.position.set(cx, 0.045, cz);
            soil.receiveShadow = true;
            group.add(soil);

            // Furrowed ploughed rows + golden wheat rows
            const rowGeo = trackGeo(new THREE.BoxGeometry(wWorld - step * 1.85, 0.24, 0.24));
            for (let r = -2; r <= 2; r++) {
              const row = new THREE.Mesh(rowGeo, this.villageMats.wheatGold);
              row.position.set(cx, 0.18, cz + r * 0.54);
              row.castShadow = true;
              group.add(row);
            }
          },
        },

        /* 11. CHAMP CULTIVÉ SUD (1-brick-high perimeter wall + vegetable furrows) */
        {
          id: 'champ_sud',
          name: 'Champ Cultivé Sud',
          shortName: 'Champ Sud',
          icon: '🥬',
          blockType: 'low_wall',
          cells: buildPerimeterWallBlueprint({
            originGx: -25,
            originGz: -9,
            width: 7,
            depth: 6,
            height: 1,
            gates: [{ side: 'east', start: 2, width: 1, height: 1 }],
            blockType: 'low_wall',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(-25, -9, 7, 6);
            const soil = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(wWorld - step * 1.4, 0.09, dWorld - step * 1.4)),
              this.villageMats.ploughedSoil
            );
            soil.position.set(cx, 0.045, cz);
            soil.receiveShadow = true;
            group.add(soil);

            // Ploughed vegetable mounds
            const bushGeo = trackGeo(new THREE.DodecahedronGeometry(0.18, 0));
            for (let rx = -2; rx <= 2; rx++) {
              for (let rz = -1; rz <= 1; rz++) {
                const plant = new THREE.Mesh(bushGeo, this.villageMats.cropGreen);
                plant.position.set(cx + rx * 0.65, 0.18, cz + rz * 0.78);
                group.add(plant);
              }
            }
          },
        },

        /* 12. ÉGLISE (7x10 stone nave + 6 contreforts + tall 6-high clocher) */
        {
          id: 'eglise',
          name: 'Église & Clocher',
          shortName: 'Église',
          icon: '⛪',
          blockType: 'church_stone',
          cells: buildChurchBlueprint({
            originGx: 6,
            originGz: -16,
            naveW: 7,
            naveD: 10,
            naveH: 3,
            towerSize: 3,
            towerH: 6,
            blockType: 'church_stone',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(6, -16, 7, 10);
            addFoundationPad(group, { cx, cz, widthWorld: wWorld + 0.85, depthWorld: dWorld + 0.3, mat: this.villageMats.plazaStone, trackGeo });
            // Sanctuary stone altar inside the north apse
            const altar = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(1.1, 0.52, 0.62)),
              this.villageMats.church_stone
            );
            altar.position.set(cx, 0.3, cz - dWorld * 0.32);
            group.add(altar);
          },
          buildRoof: (roofGroup) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(6, -16, 7, 10);
            // Steep Gothic slate nave roof spanning the entire stone nave (bell tower rises cleanly through!)
            addPitchedRoof(roofGroup, {
              cx,
              cz,
              widthWorld: wWorld,
              depthWorld: dWorld,
              wallTopY: bh * 3 + 0.04,
              ridgeH: 1.85,
              mat: this.villageMats.slateRoof,
              trimMat: this.villageMats.darkOak,
              hasChimney: false,
              trackGeo,
            });

            // Tall Gothic octagonal belfry spire atop the 6-brick-high clocher + bronze bell + golden cross
            const towerCx = (6 + 3) * step;
            const towerCz = (-16 + 8) * step;
            const towerTopY = bh * 6 + 0.04;

            const bell = new THREE.Mesh(
              trackGeo(new THREE.ConeGeometry(0.28, 0.38, 10)),
              this.villageMats.goldCross
            );
            bell.position.set(towerCx, towerTopY - 0.32, towerCz);
            roofGroup.add(bell);

            const spire = new THREE.Mesh(
              trackGeo(new THREE.ConeGeometry(step * 1.72, 2.85, 8)),
              this.villageMats.slateRoof
            );
            spire.rotation.y = Math.PI / 8;
            spire.position.set(towerCx, towerTopY + 1.4, towerCz);
            spire.castShadow = true;
            roofGroup.add(spire);

            // Gleaming golden cross crowning the church steeple
            const crossV = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(0.11, 0.72, 0.11)),
              this.villageMats.goldCross
            );
            crossV.position.set(towerCx, towerTopY + 3.05, towerCz);
            roofGroup.add(crossV);
            const crossH = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(0.46, 0.11, 0.11)),
              this.villageMats.goldCross
            );
            crossH.position.set(towerCx, towerTopY + 3.16, towerCz);
            roofGroup.add(crossH);
          },
        },

        /* 13. CIMETIÈRE (Beside church, pre-placed tombs/crosses + 2-brick enclosure wall w/ 2-block gate) */
        {
          id: 'cimetiere',
          name: 'Cimetière',
          shortName: 'Cimetière',
          icon: '🪦',
          blockType: 'low_wall',
          cells: buildPerimeterWallBlueprint({
            originGx: 15,
            originGz: -15,
            width: 7,
            depth: 8,
            height: 2,
            // Exact 2-block-wide entrance opening facing South Avenue!
            gates: [{ side: 'south', start: 2, width: 2, height: 2 }],
            blockType: 'low_wall',
          }),
          buildBase: (group) => {
            const { cx, cz, wWorld, dWorld } = rectWorld(15, -15, 7, 8);
            // Quiet mossy gravel yard inside cemetery
            const ground = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(wWorld - step * 1.4, 0.06, dWorld - step * 1.4)),
              this.villageMats.plazaStone
            );
            ground.position.set(cx, 0.03, cz);
            ground.receiveShadow = true;
            group.add(ground);

            // Pre-placed decorative medieval tombstones & stone crosses inside the cemetery!
            const slabGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.56, 0.12));
            const moundGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.1, 0.82));
            const crossVGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.62, 0.1));
            const crossHGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.09, 0.1));

            const tombCoords = [
              [-1.15, -1.25, false],
              [0.0, -1.25, true],
              [1.15, -1.25, false],
              [-1.15, 0.1, true],
              [0.0, 0.1, false],
              [1.15, 0.1, true],
              [-1.15, 1.3, false],
              [1.15, 1.3, false],
            ];
            tombCoords.forEach(([ox, oz, isCross], idx) => {
              const mound = new THREE.Mesh(moundGeo, this.villageMats.ploughedSoil);
              mound.position.set(cx + ox, 0.08, cz + oz + 0.34);
              group.add(mound);

              if (isCross) {
                const cv = new THREE.Mesh(crossVGeo, this.villageMats.tombStone);
                cv.position.set(cx + ox, 0.36, cz + oz - 0.05);
                cv.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.04;
                cv.castShadow = true;
                group.add(cv);
                const ch = new THREE.Mesh(crossHGeo, this.villageMats.tombStone);
                ch.position.set(cx + ox, 0.48, cz + oz - 0.05);
                ch.castShadow = true;
                group.add(ch);
              } else {
                const head = new THREE.Mesh(slabGeo, this.villageMats.tombStone);
                head.position.set(cx + ox, 0.32, cz + oz - 0.05);
                head.rotation.z = (idx % 3 - 1) * 0.05;
                head.castShadow = true;
                group.add(head);
              }
            });

            // Slender dark cemetery cypress trees in the rear corners
            [
              [cx - wWorld * 0.34, cz - dWorld * 0.34],
              [cx + wWorld * 0.34, cz - dWorld * 0.34],
            ].forEach(([tx, tz]) => {
              const cyp = new THREE.Mesh(
                trackGeo(new THREE.ConeGeometry(0.32, 1.95, 7)),
                this.villageMats.cypressFoliage
              );
              cyp.position.set(tx, 1.05, tz);
              cyp.castShadow = true;
              group.add(cyp);
            });
          },
          buildRoof: (roofGroup) => {
            // Wrought-iron gate arch lanterns crowning the 2-wide cemetery entrance once enclosed!
            const gateCx = (15 + 2.5) * step;
            const gateCz = (-15 + 7) * step;
            const arch = new THREE.Mesh(
              trackGeo(new THREE.TorusGeometry(step * 0.92, 0.06, 6, 16, Math.PI)),
              this.villageMats.wroughtIron
            );
            arch.position.set(gateCx, bh * 2 + 0.05, gateCz);
            roofGroup.add(arch);
          },
        },
      ],
    };
  }

  /* ============================================================================
   * 1. SCULPTED 128x128 MEDIEVAL VILLAGE TERRAIN, TREES & COZY FOLIAGE
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
      const y = sampleVillageTerrainHeight(x, z);
      pos.setY(i, y);

      // Weight 0: Lush meadow grass | Weight 1: Cobble/wagon path | Weight 2: Quarry dust | Weight 3: Mossy edge
      const quarryW = 1.0 - smoothstep(1.8, 4.4, Math.hypot(x + 14.2, z - 1.5));
      const yardPathW = Math.max(
        rectFlatMask(x, z, -12.6, 8.6, 1.5, 4.8, 1.1),
        rectFlatMask(x, z, -6.5, 12.6, 6.2, 1.4, 1.1),
        rectFlatMask(x, z, -0.4, -0.4, 3.2, 3.2, 1.3)
      );
      const mossW = smoothstep(0.65, 1.25, y) * 0.45;
      const grassW = Math.max(0.05, 1.0 - quarryW * 0.9 - yardPathW * 0.72 - mossW * 0.5);
      const sum = grassW + yardPathW + quarryW + mossW;

      splatAttr[i * 4 + 0] = grassW / sum;
      splatAttr[i * 4 + 1] = yardPathW / sum;
      splatAttr[i * 4 + 2] = quarryW / sum;
      splatAttr[i * 4 + 3] = mossW / sum;
      wetAttr[i] = 0.0;
    }

    terrainGeo.setAttribute('aSplat', new THREE.BufferAttribute(splatAttr, 4));
    terrainGeo.setAttribute('aWetness', new THREE.BufferAttribute(wetAttr, 1));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.medieval.materials.terrainSplat);
    terrainMesh.receiveShadow = true;
    terrainMesh.raycast = () => {};
    this.root.add(terrainMesh);

    // Geological plinth skirt framing the grand village island
    const skirtGeo = this._trackGeo(new THREE.BoxGeometry(TERRAIN_W, 1.65, TERRAIN_D));
    const skirt = new THREE.Mesh(skirtGeo, this.textures.materials.plinth);
    skirt.position.set(0, -0.96, 0);
    skirt.raycast = () => {};
    this.root.add(skirt);

    // Stylized medieval oaks & pines ringing the scenic village perimeter
    const shadowEntries = [];
    const focalPoints = [];
    const treeRing = [
      [-19.2, -16.5, 'oak', 1.15],
      [-12.0, -16.8, 'pine', 1.05],
      [-3.5, -16.2, 'oak', 1.1],
      [2.5, -16.6, 'pine', 1.0],
      [14.2, -16.5, 'oak', 1.12],
      [18.8, -14.2, 'pine', 1.15],
      [18.6, -5.8, 'oak', 1.08],
      [18.4, 3.2, 'pine', 1.05],
      [18.2, 12.8, 'oak', 1.18],
      [8.5, 15.2, 'pine', 1.05],
      [3.5, 15.6, 'oak', 1.0],
      [-18.8, -0.5, 'pine', 1.1],
      [-18.6, 8.8, 'oak', 1.15],
      [-17.8, 15.4, 'pine', 1.08],
      [-6.8, 16.4, 'oak', 1.05],
    ];

    treeRing.forEach(([tx, tz, kind, sc], idx) => {
      const ty = sampleVillageTerrainHeight(tx, tz);
      const tree = new THREE.Group();
      tree.position.set(tx, ty, tz);

      const trunk = createRootedTrunk({
        botR: 0.24 * sc,
        topR: 0.14 * sc,
        height: (kind === 'oak' ? 1.55 : 1.35) * sc,
        barkMat: this.villageMats.darkOak,
        trackGeo: (g) => this._trackGeo(g),
      });
      tree.add(trunk);

      if (kind === 'oak') {
        const crown = new THREE.Mesh(
          this._trackGeo(
            createOrganicFoliageBlobGeo({
              radius: 1.18 * sc,
              seed: idx * 17 + 3,
              baseColor: '#2f5d2c',
              topColor: '#6da344',
            })
          ),
          this.villageMats.matteFoliage
        );
        crown.position.y = 2.05 * sc;
        crown.castShadow = true;
        tree.add(crown);
      } else {
        for (let tier = 0; tier < 3; tier++) {
          const cone = new THREE.Mesh(
            this._trackGeo(
              createIrregularConiferTierGeo({
                radiusBottom: (1.05 - tier * 0.24) * sc,
                radiusTop: 0.12 * sc,
                height: 1.15 * sc,
                seed: idx * 13 + tier * 5 + 7,
                baseColor: '#23472c',
                topColor: '#487d44',
              })
            ),
            this.villageMats.matteFoliage
          );
          cone.position.y = (1.35 + tier * 0.72) * sc;
          cone.castShadow = true;
          tree.add(cone);
        }
      }

      this.root.add(tree);
      shadowEntries.push({ x: tx, z: tz, radius: 1.65 * sc, opacity: 0.42 });
      focalPoints.push({ x: tx, z: tz, radius: 2.8 * sc, weight: 0.9 });
    });

    this.contactShadows = createContactShadowSystem(
      this.root,
      shadowEntries,
      (x, z) => sampleVillageTerrainHeight(x, z)
    );

    // Instanced cozy meadow grass & wildflowers strictly outside village center & SW yard
    this.cozyGround = createCozyGroundFoliageSystem({
      parent: this.root,
      getTerrainHeight: (x, z) => sampleVillageTerrainHeight(x, z),
      isBlocked: (x, z) => {
        if (Math.abs(x) < 16.5 && z > -13.5 && z < 11.5) return true;
        if (x < -2.0 && z > 0.0 && z < 15.2) return true;
        return false;
      },
      getGrassWeight: () => 0.85,
      focalPoints,
      waterLevel: -2.0,
      halfW: TERRAIN_W * 0.48,
      halfD: TERRAIN_D * 0.48,
      grassCount: 720,
      pebbleCount: 90,
      flowerCount: 72,
      grassPalette: ['#4f853c', '#639b48', '#7ba84f', '#92b354'],
      seed: 1010,
    });
  }

  /* ============================================================================
   * 2. WORKD BUILDER 4-STATION PRODUCTION PIPELINE (SW VILLAGE ENTRANCE YARD)
   * ========================================================================== */
  _buildQuarryStation() {
    const quarry = new THREE.Group();
    this.quarryNodes = [];
    this.quarrySlots = [];

    const qx = -14.2;
    const qz = 1.2;

    // Stepped grey-limestone quarry cliff backdrop
    [
      [-1.4, 0.85, -1.45, 3.2, 2.2, 2.1],
      [1.1, 0.65, -1.65, 2.6, 1.75, 1.8],
      [-2.1, 0.55, 0.45, 1.8, 1.45, 2.2],
    ].forEach(([ox, oy, oz, w, h, d]) => {
      const cliff = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(w, h, d)),
        this.medieval.materials.rawQuarryStone
      );
      cliff.position.set(qx + ox, oy, qz + oz);
      cliff.castShadow = true;
      cliff.receiveShadow = true;
      cliff.raycast = () => {};
      quarry.add(cliff);
    });

    // 3 Extractable Quarry Rock Nodes
    const nodeOffsets = [
      [-1.15, -0.15],
      [0.15, -0.35],
      [1.35, -0.1],
    ];
    nodeOffsets.forEach(([ox, oz], idx) => {
      const nx = qx + ox;
      const nz = qz + oz;
      const ny = sampleVillageTerrainHeight(nx, nz) + 0.36;
      const group = new THREE.Group();
      group.position.set(nx, ny, nz);

      const mesh = new THREE.Mesh(this.geos.rawBlock, this.medieval.materials.rawQuarryStone);
      mesh.scale.set(1.12, 0.86, 1.04);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const node = {
        id: `village_quarry_${idx}`,
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
      quarry.add(group);
      this.quarryNodes.push(node);
    });

    // 6 Explicit Quarry Storage Slots (zero stacking!)
    const padCx = -12.6;
    const padCz = 3.2;
    const padY = sampleVillageTerrainHeight(padCx, padCz);
    const pad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.8, 0.14, 2.2)),
      this.villageMats.plazaStone
    );
    pad.position.set(padCx, padY + 0.07, padCz);
    pad.receiveShadow = true;
    pad.raycast = () => {};
    quarry.add(pad);

    [
      [-1.15, -0.52],
      [0.0, -0.52],
      [1.15, -0.52],
      [-1.15, 0.52],
      [0.0, 0.52],
      [1.15, 0.52],
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

  _buildTransportTracksAndSleds() {
    this.sleds = [];
    const leverDist = this.sledCapacity === 4 ? 2.28 : 1.82;

    // Track A: Quarry Storage (Z=4.9) -> Stonecutter Workshop (Z=10.0) along X = -12.6
    this._createTrackAndSled({
      id: 'sledA',
      axis: 'z',
      fixedCoord: -12.6,
      startPos: 5.2,
      endPos: 9.8,
      trackStart: 4.35,
      trackEnd: 10.65,
      accepts: ['raw', 'carved', 'capstone'],
      primaryKind: 'raw',
      leverLocalPos: new THREE.Vector3(leverDist, 0.34, 0),
    });

    // Track B: Stonecutter Workshop (X=-9.2) -> Village Construction Staging Yard (X=-3.2) along Z = 12.6
    this._createTrackAndSled({
      id: 'sledB',
      axis: 'x',
      fixedCoord: 12.6,
      startPos: -9.0,
      endPos: -3.2,
      trackStart: -9.85,
      trackEnd: -2.35,
      accepts: ['carved', 'capstone', 'raw'],
      primaryKind: 'carved',
      leverLocalPos: new THREE.Vector3(0, 0.34, leverDist),
    });
  }

  _buildStonecutterWorkshop() {
    const ws = new THREE.Group();
    const wx = -12.6;
    const wz = 12.6;
    const wy = sampleVillageTerrainHeight(wx, wz);

    // Compacted stone lodge floor
    const floor = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.4, 0.16, 3.8)),
      this.villageMats.plazaStone
    );
    floor.position.set(wx, wy + 0.08, wz);
    floor.receiveShadow = true;
    floor.raycast = () => {};
    ws.add(floor);

    // Open-front cutaway medieval stonemason roof (rear ~35% only, raycast disabled)
    [-1.95, 1.95].forEach((ox) => {
      const post = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.2, 2.25, 0.2)),
        this.villageMats.darkOak
      );
      post.position.set(wx + ox, wy + 1.2, wz - 1.55);
      post.castShadow = true;
      post.raycast = () => {};
      ws.add(post);
    });
    const backAwning = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(4.3, 0.16, 1.35)),
      this.villageMats.slateRoof
    );
    backAwning.position.set(wx, wy + 2.38, wz - 1.25);
    backAwning.rotation.x = 0.22;
    backAwning.raycast = () => {};
    ws.add(backAwning);

    // Stonecutter Anvil Workbench
    const anvilX = wx - 0.55;
    const anvilZ = wz + 0.15;
    const anvil = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.38, 0.72, 1.38)),
      this.medieval.materials.castleBaseStone
    );
    anvil.position.set(anvilX, wy + 0.52, anvilZ);
    anvil.castShadow = true;
    anvil.receiveShadow = true;
    ws.add(anvil);

    const wbMarker = this._createSlotMarker(ws, anvilX, wy + 0.895, anvilZ);
    this.workbenchSlot = {
      id: 'workbench',
      zoneType: 'workbench',
      accepts: ['raw'],
      position: new THREE.Vector3(anvilX, wy + 0.88 + BLOCK_H * 0.5, anvilZ),
      dropIndicatorY: wy + 0.89,
      marker: wbMarker,
      occupied: false,
      block: null,
    };

    const carveHitbox = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.75, 1.65, 1.75)),
      this._trackMat(new THREE.MeshBasicMaterial({ visible: false }))
    );
    carveHitbox.position.set(anvilX, wy + 1.2, anvilZ);
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
      pip.position.set(anvilX + (i - 1) * 0.42, wy + 1.95, anvilZ - 0.52);
      pip.visible = false;
      ws.add(pip);
      this.carvingPips.push({ mesh: pip, mat: pipMat });
    }

    // 4 Workshop Output Slots (right of anvil)
    this.outputSlots = [];
    [
      [1.05, -0.58],
      [1.05, 0.58],
      [2.1, -0.58],
      [2.1, 0.58],
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

    // 6 Village Construction Staging Slots at East end of Track B (foot of Central Well Avenue)
    const stageX = -0.35;
    const stageZ = 11.4;
    const stageY = sampleVillageTerrainHeight(stageX, stageZ);
    const stagePad = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(3.85, 0.14, 2.35)),
      this.villageMats.plazaStone
    );
    stagePad.position.set(stageX, stageY + 0.07, stageZ);
    stagePad.receiveShadow = true;
    stagePad.raycast = () => {};
    ws.add(stagePad);

    this.stagingSlots = [];
    [
      [-1.18, -0.56],
      [0.0, -0.56],
      [1.18, -0.56],
      [-1.18, 0.56],
      [0.0, 0.56],
      [1.18, 0.56],
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
}
