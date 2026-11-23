/**
 * Workd Builder — Grand 100-Level Tactile 3D World Map Tabletop Archipelago
 * Elongated carved mahogany & burnished gold expedition board (24 x 186 units)
 * spanning 10 regional civilization biomes across 100 sequential levels, with:
 *  - Levels 1–4: Full playable 3D miniature islands (Égypte, Rome, Japon, Maya)
 *  - Levels 5–100: Stylized instanced "Bientôt" islands with timber scaffolding & mist
 *  - Every 10th Level (10, 20, ..., 100): Grand 2.2x Village / City Milestone Islands
 *  - Instanced winding dotted stone & sea-buoy route for minimal draw calls
 *  - Pooled frustum- & distance-culled HTML floating labels for locked 60 FPS on iPhone 16e
 */

import * as THREE from 'three';

export const WORLD_MAP_WIDTH = 24.0;
export const WORLD_MAP_DEPTH = 186.0;

export const WORLD_CHAPTERS = [
  {
    index: 0,
    rangeLabel: '1–10',
    biomeName: 'Égypte — Sables de Gizeh',
    shortRegion: 'Égypte',
    milestoneCity: 'Cité de Thèbes',
    archetype: 'egypt',
    groundHex: '#e6c07b',
    wallHex: '#e8d5a8',
    roofHex: '#d89b38',
    propHex: '#4f8241',
    seaHex: '#1fa4b8',
    deepHex: '#0f596b',
  },
  {
    index: 1,
    rangeLabel: '11–20',
    biomeName: 'Rome — Collines Impériales',
    shortRegion: 'Rome',
    milestoneCity: 'Forum Impérial',
    archetype: 'rome',
    groundHex: '#869c5b',
    wallHex: '#e4ddd0',
    roofHex: '#b8593a',
    propHex: '#395c34',
    seaHex: '#1c9bb8',
    deepHex: '#10546a',
  },
  {
    index: 2,
    rangeLabel: '21–30',
    biomeName: 'Japon — Montagnes Féodales',
    shortRegion: 'Japon',
    milestoneCity: 'Cité de Kyoto',
    archetype: 'japan',
    groundHex: '#638d5b',
    wallHex: '#f5ead1',
    roofHex: '#344254',
    propHex: '#f3a9c0',
    seaHex: '#1e95ad',
    deepHex: '#114d61',
  },
  {
    index: 3,
    rangeLabel: '31–40',
    biomeName: 'Maya — Jungle du Yucatán',
    shortRegion: 'Maya',
    milestoneCity: 'Cité de Tikal',
    archetype: 'maya',
    groundHex: '#3f7f44',
    wallHex: '#cfc39c',
    roofHex: '#ad412d',
    propHex: '#2f6a34',
    seaHex: '#169e97',
    deepHex: '#0c5253',
  },
  {
    index: 4,
    rangeLabel: '41–50',
    biomeName: 'Vikings — Fjords du Nord',
    shortRegion: 'Vikings',
    milestoneCity: 'Port de Kattegat',
    archetype: 'viking',
    groundHex: '#6a7f7a',
    wallHex: '#947e65',
    roofHex: '#4a3529',
    propHex: '#2f5244',
    seaHex: '#217b98',
    deepHex: '#124359',
  },
  {
    index: 5,
    rangeLabel: '51–60',
    biomeName: 'Europe — Terres Médiévales',
    shortRegion: 'Europe',
    milestoneCity: 'Citadelle Royale',
    archetype: 'medieval',
    groundHex: '#6f9452',
    wallHex: '#cbc6bb',
    roofHex: '#3d587a',
    propHex: '#3d6b38',
    seaHex: '#2287a4',
    deepHex: '#124c64',
  },
  {
    index: 6,
    rangeLabel: '61–70',
    biomeName: 'Arabie — Oasis des Sables',
    shortRegion: 'Arabie',
    milestoneCity: "Cité d'Al-Qasr",
    archetype: 'arabian',
    groundHex: '#e4b37a',
    wallHex: '#f4ead8',
    roofHex: '#d8a238',
    propHex: '#4e8445',
    seaHex: '#1ba6af',
    deepHex: '#0f5966',
  },
  {
    index: 7,
    rangeLabel: '71–80',
    biomeName: "Grèce — Îles de l'Égée",
    shortRegion: 'Grèce',
    milestoneCity: "Acropole d'Athènes",
    archetype: 'greek',
    groundHex: '#d5cfc0',
    wallHex: '#f7f6f2',
    roofHex: '#2568b8',
    propHex: '#637f4b',
    seaHex: '#1d86cc',
    deepHex: '#104978',
  },
  {
    index: 8,
    rangeLabel: '81–90',
    biomeName: 'Indus — Vallée Sacrée',
    shortRegion: 'Indus',
    milestoneCity: 'Cité de Mohenjo',
    archetype: 'indus',
    groundHex: '#c68a5e',
    wallHex: '#ddb892',
    roofHex: '#9f4531',
    propHex: '#4d7c3f',
    seaHex: '#1d939d',
    deepHex: '#10505b',
  },
  {
    index: 9,
    rangeLabel: '91–100',
    biomeName: 'Empire — Capitale Impériale',
    shortRegion: 'Empire',
    milestoneCity: 'Capitale Impériale',
    archetype: 'imperial',
    groundHex: '#d2c6aa',
    wallHex: '#f6efe0',
    roofHex: '#e2ae38',
    propHex: '#3d6942',
    seaHex: '#1d8cb8',
    deepHex: '#104a6c',
  },
];

const REGULAR_ISLAND_RADIUS = 0.96;
const MILESTONE_ISLAND_RADIUS = 2.15; // 2.24x regular island radius
const HERO_ISLAND_RADIUS = 2.15;
const LABEL_POOL_SIZE = 22;

/**
 * Sculpted smooth organic island mound geometry shared across hero, milestone, and instanced islands.
 */
function createIslandMoundGeometry(radiusX, radiusZ, height, seed = 1, radialSegs = 20) {
  const geo = new THREE.CylinderGeometry(radiusX * 0.78, radiusX * 1.06, height, radialSegs, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const radialScale =
      1 + Math.sin(angle * 3 + seed) * 0.08 + Math.cos(angle * 5 - seed * 1.7) * 0.045;
    const nx = x * radialScale;
    const nz = z * (radiusZ / radiusX) * radialScale;
    let ny = y;
    if (y > height * 0.35) {
      const rNorm = Math.min(1, Math.hypot(x / radiusX, z / radiusX));
      ny += (1 - rNorm * rNorm) * 0.22;
    }
    pos.setXYZ(i, nx, ny, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Deterministic winding S-curve layout for all 100 levels along the 24 x 186 tabletop board.
 * Guarantees zero overlap between hero playable islands (1–4), regular islands, and 2.2x Milestone cities.
 */
function computeAll100LevelCoords() {
  const coords = new Array(100);

  // Chapter 1 (Levels 1–10): 5 generous hero playable islands + 4 regular + Lv 10 Grand City
  const ch1 = [
    [-4.3, 85.4], // 1: Égypte (Playable)
    [3.0, 82.8],  // 2: Rome (Playable)
    [-4.2, 79.4], // 3: Japon (Playable)
    [3.2, 76.6],  // 4: Maya (Playable)
    [-4.0, 73.2], // 5: Pénitencier 1800 (Playable)
    [3.2, 70.6],  // 6
    [-2.2, 69.0], // 7
    [-7.0, 67.6], // 8
    [-4.6, 64.6], // 9
    [0.6, 63.6],  // 10: Milestone City (Cité de Thèbes)
  ];
  for (let i = 0; i < 10; i++) {
    coords[i] = { x: ch1[i][0], z: ch1[i][1] };
  }

  // Chapters 2–10 (Levels 11–100): 9 repeating mirrored organic S-curve chapters
  const chapterSpanZ = 16.48;
  const templateOffsets = [
    [4.6, -2.25],   // k = 1
    [7.3, -4.3],    // k = 2
    [3.8, -5.7],    // k = 3
    [-0.8, -6.55],  // k = 4
    [-5.4, -7.65],  // k = 5
    [-7.4, -10.05], // k = 6
    [-3.8, -11.45], // k = 7
    [0.8, -12.35],  // k = 8
    [4.9, -13.95],  // k = 9
    [0.6, -16.48],  // k = 10 (Milestone City)
  ];

  for (let c = 1; c < 10; c++) {
    const z0 = 63.6 - (c - 1) * chapterSpanZ;
    // Flip horizontal direction every chapter so the curve continues seamlessly out of each Milestone City
    const dir = c % 2 === 1 ? 1 : -1;
    for (let k = 0; k < 10; k++) {
      const levelIdx = c * 10 + k;
      const [ox, oz] = templateOffsets[k];
      let x = ox * dir;
      // Center the grand Lv 100 Imperial Capital symmetrically at the Northern summit
      if (levelIdx === 99) x = 0.0;
      coords[levelIdx] = { x, z: z0 + oz };
    }
  }

  return coords;
}

export class WorldMapScene {
  constructor({ scene, textures, audio, cameraController, onSelectNode, onClearSelection }) {
    this.scene = scene;
    this.textures = textures;
    this.audio = audio;
    this.cameraController = cameraController;
    this.onSelectNode = onSelectNode;
    this.onClearSelection = onClearSelection;

    this.root = new THREE.Group();
    this.root.name = 'WorldMapRoot';
    this.scene.add(this.root);

    this.ownedGeometries = [];
    this.ownedMaterials = [];
    this.ownedTextures = [];

    this.nodes = [];
    this.hitTargets = [];
    this.selectedNode = null;
    this.animatedProps = [];
    this.shoreRings = [];
    this.unlockedRings = [];
    this.milestoneRings = [];
    this.sailboats = [];
    this.oceanGeo = null;

    // Pooled DOM labels + frustum culling scratch structures (zero per-frame allocations)
    this.labelsLayer = document.getElementById('worldmap-labels-layer');
    this.labelsVisible = false;
    this.labelPool = [];
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    this._projVec = new THREE.Vector3();
    this._visibleCandidates = [];

    // Selection highlight ring for instanced "Bientôt" islands
    this.selectionRing = null;

    this.levelCoords = computeAll100LevelCoords();
    this.chapterBounds = this._computeChapterBounds();

    this._initMaterials();
    this._buildTabletopFrameAndCompasses();
    this._buildBiomeOceanAndSeabed();
    this._buildAll100Nodes();
    this._buildInstancedWindingRoute();
    this._buildCoastalDecorAndSailboats();
    this._buildSelectionRing();
    this._initLabelPool();
    this._collectHitTargets();
  }

  _trackGeo(g) {
    this.ownedGeometries.push(g);
    return g;
  }

  _trackMat(m) {
    this.ownedMaterials.push(m);
    return m;
  }

  _trackTex(t) {
    this.ownedTextures.push(t);
    return t;
  }

  _computeChapterBounds() {
    const bounds = [];
    for (let c = 0; c < 10; c++) {
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let k = 0; k < 10; k++) {
        const z = this.levelCoords[c * 10 + k].z;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      const milestone = this.levelCoords[c * 10 + 9];
      bounds.push({
        index: c,
        minZ,
        maxZ,
        centerZ: c === 0 ? 77.6 : (minZ + maxZ) * 0.5,
        milestonePos: milestone,
      });
    }
    return bounds;
  }

  _initMaterials() {
    this.mats = {
      seabed: this._trackMat(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.92,
          metalness: 0.04,
        })
      ),
      ocean: this._trackMat(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          normalMap: this.textures.maps.waterNormal,
          normalScale: new THREE.Vector2(0.45, 0.45),
          roughness: 0.17,
          metalness: 0.16,
          transparent: true,
          opacity: 0.89,
        })
      ),
      // Hero playable island materials (Levels 1–4)
      desertSand: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#e6c07b', roughness: 0.88, metalness: 0.02 })
      ),
      mediterraneanGrass: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#869c5b', roughness: 0.88, metalness: 0.02 })
      ),
      romanMarble: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#dcd5c6', roughness: 0.65, metalness: 0.05 })
      ),
      cypressGreen: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#395c34', roughness: 0.84 })
      ),
      terracotta: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#b8593a', roughness: 0.78 })
      ),
      jadeMountain: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#668d5e', roughness: 0.88 })
      ),
      bambooGreen: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#5f9c4a', roughness: 0.68 })
      ),
      sakuraPink: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#f7b4c8', roughness: 0.72 })
      ),
      sakuraLight: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#ffd9e5', roughness: 0.68 })
      ),
      shojiCream: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#f5ead1',
          emissive: '#5a421c',
          emissiveIntensity: 0.16,
          roughness: 0.65,
        })
      ),
      cedarDark: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#4f3324', roughness: 0.8 })
      ),
      kawaraSlate: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#344254', roughness: 0.5, metalness: 0.18 })
      ),
      mayaJungle: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#3f7f44', roughness: 0.86 })
      ),
      mayaStone: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#cfc39c', roughness: 0.82 })
      ),
      mayaRedOchre: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#ad412d', roughness: 0.7 })
      ),
      mayaJade: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#22b47c',
          emissive: '#0c4c34',
          emissiveIntensity: 0.25,
          roughness: 0.28,
          metalness: 0.2,
        })
      ),
      frontierOchre: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#b98b5b', roughness: 0.9 })
      ),
      prisonGranite: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#8a8e92', roughness: 0.82 })
      ),
      prisonBrick: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#7d3427', roughness: 0.82 })
      ),
      prisonSlate: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#353e48', roughness: 0.62, metalness: 0.14 })
      ),
      lockStone: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#9e978b', roughness: 0.78, metalness: 0.12 })
      ),
      lockMetal: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#c8a768', roughness: 0.35, metalness: 0.72 })
      ),
      // Instanced white base materials (tinted per instance via setColorAt)
      instancedGround: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, metalness: 0.03 })
      ),
      instancedStone: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.76, metalness: 0.06 })
      ),
      instancedRoof: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.64, metalness: 0.1 })
      ),
      instancedProp: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.02 })
      ),
      scaffoldWood: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#9f7648', roughness: 0.86, metalness: 0.02 })
      ),
      mistCloud: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#f2f6f8',
          roughness: 0.95,
          transparent: true,
          opacity: 0.56,
          depthWrite: false,
        })
      ),
      sailCanvas: this._trackMat(
        new THREE.MeshStandardMaterial({ color: '#fbf4e2', roughness: 0.8, side: THREE.DoubleSide })
      ),
      shoreFoam: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xe6fbff,
          transparent: true,
          opacity: 0.44,
          depthWrite: false,
        })
      ),
      goldRing: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffcf40,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      goldHalo: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffe478,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      milestoneRing: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xf7be48,
          transparent: true,
          opacity: 0.86,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      milestoneHalo: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffe396,
          transparent: true,
          opacity: 0.34,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      selectRing: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xfff0a8,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      ),
      hitbox: this._trackMat(new THREE.MeshBasicMaterial({ visible: false })),
    };
  }

  /* ============================================================================
   * 1. GRAND CARVED MAHOGANY & BURNISHED GOLD TABLETOP FRAME (24 x 186)
   * ========================================================================== */
  _buildTabletopFrameAndCompasses() {
    const frameGroup = new THREE.Group();
    this.root.add(frameGroup);

    const hw = WORLD_MAP_WIDTH * 0.5;
    const hd = WORLD_MAP_DEPTH * 0.5;
    const borderT = 1.15;
    const borderH = 1.6;

    // Carved dark mahogany outer rails
    const northSouthGeo = this._trackGeo(
      new THREE.BoxGeometry(WORLD_MAP_WIDTH + borderT * 2, borderH, borderT)
    );
    const eastWestGeo = this._trackGeo(new THREE.BoxGeometry(borderT, borderH, WORLD_MAP_DEPTH));

    const northRail = new THREE.Mesh(northSouthGeo, this.textures.materials.timberDark);
    northRail.position.set(0, -0.2, -hd - borderT * 0.5);
    northRail.receiveShadow = true;
    frameGroup.add(northRail);

    const southRail = new THREE.Mesh(northSouthGeo, this.textures.materials.timberDark);
    southRail.position.set(0, -0.2, hd + borderT * 0.5);
    southRail.receiveShadow = true;
    frameGroup.add(southRail);

    const westRail = new THREE.Mesh(eastWestGeo, this.textures.materials.timberDark);
    westRail.position.set(-hw - borderT * 0.5, -0.2, 0);
    westRail.receiveShadow = true;
    frameGroup.add(westRail);

    const eastRail = new THREE.Mesh(eastWestGeo, this.textures.materials.timberDark);
    eastRail.position.set(hw + borderT * 0.5, -0.2, 0);
    eastRail.receiveShadow = true;
    frameGroup.add(eastRail);

    // Gleaming inlaid golden trim strips along all 4 wooden borders
    const goldNSGeo = this._trackGeo(new THREE.BoxGeometry(WORLD_MAP_WIDTH + 0.7, 0.09, 0.16));
    const goldEWGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 0.09, WORLD_MAP_DEPTH + 0.7));
    [-hd - 0.42, hd + 0.42].forEach((z) => {
      const strip = new THREE.Mesh(goldNSGeo, this.textures.materials.capstoneGold);
      strip.position.set(0, 0.62, z);
      frameGroup.add(strip);
    });
    [-hw - 0.42, hw + 0.42].forEach((x) => {
      const strip = new THREE.Mesh(goldEWGeo, this.textures.materials.capstoneGold);
      strip.position.set(x, 0.62, 0);
      frameGroup.add(strip);
    });

    // 4 Ornate Golden Corner Medallions
    const cornerGeo = this._trackGeo(new THREE.CylinderGeometry(0.56, 0.64, 0.18, 8));
    const cornerGemGeo = this._trackGeo(new THREE.OctahedronGeometry(0.26, 0));
    [
      [-hw - 0.54, -hd - 0.54],
      [hw + 0.54, -hd - 0.54],
      [-hw - 0.54, hd + 0.54],
      [hw + 0.54, hd + 0.54],
    ].forEach(([cx, cz]) => {
      const med = new THREE.Mesh(cornerGeo, this.textures.materials.capstoneGold);
      med.position.set(cx, 0.65, cz);
      frameGroup.add(med);

      const gem = new THREE.Mesh(cornerGemGeo, this.textures.materials.capstoneGold);
      gem.position.set(cx, 0.82, cz);
      frameGroup.add(gem);
    });

    // Instanced golden chapter brass brackets along East & West rails (marking each 10-level region)
    const bracketGeo = this._trackGeo(new THREE.BoxGeometry(0.62, 0.22, 0.36));
    const bracketInst = new THREE.InstancedMesh(
      bracketGeo,
      this.textures.materials.capstoneGold,
      20
    );
    const dummy = new THREE.Object3D();
    let bIdx = 0;
    for (let c = 0; c < 10; c++) {
      const mz = this.chapterBounds[c].milestonePos.z;
      for (let side = -1; side <= 1; side += 2) {
        dummy.position.set(side * (hw + 0.54), 0.64, mz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bracketInst.setMatrixAt(bIdx++, dummy.matrix);
      }
    }
    bracketInst.instanceMatrix.needsUpdate = true;
    frameGroup.add(bracketInst);

    // Sculpted 3D Golden Compass Rose in the South-East start bay + Imperial Compass in North-West bay
    const buildCompass = (x, z, scale = 1.0) => {
      const compass = new THREE.Group();
      compass.position.set(x, 0.08, z);
      compass.scale.setScalar(scale);

      const ringGeo = this._trackGeo(new THREE.TorusGeometry(1.15, 0.07, 8, 28));
      ringGeo.rotateX(Math.PI / 2);
      compass.add(new THREE.Mesh(ringGeo, this.textures.materials.capstoneGold));

      const innerRingGeo = this._trackGeo(new THREE.TorusGeometry(0.74, 0.042, 6, 20));
      innerRingGeo.rotateX(Math.PI / 2);
      compass.add(new THREE.Mesh(innerRingGeo, this.textures.materials.capstoneGold));

      const cardinalGeo = this._trackGeo(new THREE.ConeGeometry(0.18, 1.14, 4));
      cardinalGeo.rotateX(Math.PI / 2);
      cardinalGeo.translate(0, 0, 0.57);

      const ordinalGeo = this._trackGeo(new THREE.ConeGeometry(0.12, 0.7, 4));
      ordinalGeo.rotateX(Math.PI / 2);
      ordinalGeo.translate(0, 0, 0.35);

      for (let i = 0; i < 4; i++) {
        const needle = new THREE.Mesh(cardinalGeo, this.textures.materials.capstoneGold);
        needle.rotation.y = (i * Math.PI) / 2;
        needle.scale.y = 0.35;
        compass.add(needle);

        const sub = new THREE.Mesh(ordinalGeo, this.mats.lockMetal);
        sub.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
        sub.scale.y = 0.32;
        compass.add(sub);
      }

      const hub = new THREE.Mesh(
        this._trackGeo(new THREE.SphereGeometry(0.24, 10, 8)),
        this.textures.materials.capstoneGold
      );
      hub.scale.y = 0.55;
      compass.add(hub);
      return compass;
    };

    frameGroup.add(buildCompass(7.8, 86.2, 1.15));
    frameGroup.add(buildCompass(-7.6, -86.6, 1.1));
  }

  /* ============================================================================
   * 2. VERTEX-COLORED 10-BIOME SEABED & ANIMATED TURQUOISE OCEAN
   * ========================================================================== */
  _sampleSeaColor(z, isDeep = false, outColor = new THREE.Color()) {
    // Map z ∈ [+93, -93] smoothly across chapters 0..9
    const t = THREE.MathUtils.clamp((90 - z) / 180, 0, 0.999) * (WORLD_CHAPTERS.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(WORLD_CHAPTERS.length - 1, i0 + 1);
    const f = t - i0;
    const c0 = new THREE.Color(isDeep ? WORLD_CHAPTERS[i0].deepHex : WORLD_CHAPTERS[i0].seaHex);
    const c1 = new THREE.Color(isDeep ? WORLD_CHAPTERS[i1].deepHex : WORLD_CHAPTERS[i1].seaHex);
    return outColor.copy(c0).lerp(c1, f);
  }

  _buildBiomeOceanAndSeabed() {
    const tmpCol = new THREE.Color();

    // Deep seabed slab tinted per regional ocean biome
    const bedGeo = this._trackGeo(new THREE.PlaneGeometry(WORLD_MAP_WIDTH + 0.4, WORLD_MAP_DEPTH + 0.4, 4, 40));
    bedGeo.rotateX(-Math.PI / 2);
    const bedPos = bedGeo.attributes.position;
    const bedColors = new Float32Array(bedPos.count * 3);
    for (let i = 0; i < bedPos.count; i++) {
      this._sampleSeaColor(bedPos.getZ(i), true, tmpCol);
      bedColors[i * 3] = tmpCol.r;
      bedColors[i * 3 + 1] = tmpCol.g;
      bedColors[i * 3 + 2] = tmpCol.b;
    }
    bedGeo.setAttribute('color', new THREE.BufferAttribute(bedColors, 3));
    const bed = new THREE.Mesh(bedGeo, this.mats.seabed);
    bed.position.y = -0.58;
    bed.receiveShadow = true;
    this.root.add(bed);

    // Animated subdivided turquoise ocean surface (12 x 60 = 793 vertices — lighter than the old 32x32!)
    const oceanGeo = this._trackGeo(
      new THREE.PlaneGeometry(WORLD_MAP_WIDTH, WORLD_MAP_DEPTH, 12, 60)
    );
    oceanGeo.rotateX(-Math.PI / 2);
    const oPos = oceanGeo.attributes.position;
    const oColors = new Float32Array(oPos.count * 3);
    for (let i = 0; i < oPos.count; i++) {
      this._sampleSeaColor(oPos.getZ(i), false, tmpCol);
      // Subtle shallow turquoise brightening near the center S-curve channel
      const edgeFade = Math.min(1, Math.abs(oPos.getX(i)) / (WORLD_MAP_WIDTH * 0.5));
      tmpCol.multiplyScalar(1.06 - edgeFade * 0.14);
      oColors[i * 3] = tmpCol.r;
      oColors[i * 3 + 1] = tmpCol.g;
      oColors[i * 3 + 2] = tmpCol.b;
    }
    oceanGeo.setAttribute('color', new THREE.BufferAttribute(oColors, 3));
    // Repeat water normal nicely along the elongated 24x186 surface
    if (this.textures.maps.waterNormal) {
      this.textures.maps.waterNormal.repeat.set(3, 22);
    }
    this.oceanGeo = oceanGeo;

    const oceanMesh = new THREE.Mesh(oceanGeo, this.mats.ocean);
    oceanMesh.position.y = 0.0;
    oceanMesh.receiveShadow = true;
    this.root.add(oceanMesh);
  }

  /* ============================================================================
   * 3. ALL 100 SEQUENTIAL LEVEL NODES
   *    - Levels 1–4: Full 3D Playable Hero Miniature Islands
   *    - Levels 5–99 (non-10): Instanced "Bientôt" Islands + Scaffolding + Mist
   *    - Levels 10, 20, ..., 100: Grand 2.2x Village / City Milestone Islands
   * ========================================================================== */
  _buildAll100Nodes() {
    // 1. Build the 5 full 3D Playable Hero Islands (Levels 1–5)
    this._buildHeroEgyptIsland(this.levelCoords[0]);
    this._buildHeroRomeIsland(this.levelCoords[1]);
    this._buildHeroJapanIsland(this.levelCoords[2]);
    this._buildHeroMayaIsland(this.levelCoords[3]);
    this._buildHeroPenitentiaryIsland(this.levelCoords[4]);

    // 2. Collect regular "Bientôt" nodes (85) and Milestone Village/City nodes (10)
    const regularEntries = [];
    const milestoneEntries = [];

    for (let i = 5; i < 100; i++) {
      const levelNum = i + 1;
      const chapterIdx = Math.floor(i / 10);
      const chapter = WORLD_CHAPTERS[chapterIdx];
      const { x, z } = this.levelCoords[i];
      const isMilestone = levelNum % 10 === 0;

      if (isMilestone) {
        milestoneEntries.push({ levelIndex: i, levelNum, chapter, x, z });
      } else {
        regularEntries.push({ levelIndex: i, levelNum, chapter, x, z });
      }
    }

    // 3. Build all 86 Regular "Bientôt" Islands via InstancedMesh (minimal draw calls!)
    this._buildInstancedRegularIslands(regularEntries);

    // 4. Build all 10 Grand Village / City Milestone Islands (Levels 10, 20, ..., 100)
    this._buildMilestoneCityIslands(milestoneEntries);

    // Sort this.nodes strictly by levelNum (1..100)
    this.nodes.sort((a, b) => a.levelNum - b.levelNum);
  }

  _addShoreFoamRing(parent, radiusX, radiusZ, phase = 0) {
    const geo = this._trackGeo(new THREE.RingGeometry(radiusX * 0.96, radiusX * 1.14, 24));
    geo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(geo, this.mats.shoreFoam);
    ring.position.y = 0.03;
    ring.scale.set(1, 1, radiusZ / radiusX);
    parent.add(ring);
    this.shoreRings.push({ mesh: ring, baseSX: 1, baseSZ: radiusZ / radiusX, phase });
  }

  _createMiniPalm(parent, x, y, z, scale = 0.45, lean = 0.14) {
    const palm = new THREE.Group();
    palm.position.set(x, y, z);
    palm.scale.setScalar(scale);

    const trunkGeo = this._trackGeo(new THREE.CylinderGeometry(0.12, 0.18, 1.5, 6));
    const trunk = new THREE.Mesh(trunkGeo, this.textures.materials.palmTrunk);
    trunk.position.y = 0.72;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    palm.add(trunk);

    const crown = new THREE.Group();
    crown.position.set(-Math.sin(lean) * 0.72, 1.42, 0);
    const frondGeo = this._trackGeo(new THREE.ConeGeometry(0.24, 1.15, 4));
    frondGeo.scale(1, 1, 0.22);
    frondGeo.translate(0, 0.55, 0);

    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(frondGeo, this.textures.materials.palmLeaf);
      frond.rotation.y = (f / 5) * Math.PI * 2;
      frond.rotation.z = 1.08;
      crown.add(frond);
    }
    palm.add(crown);
    this.animatedProps.push({ obj: crown, type: 'sway', phase: x + z });
    parent.add(palm);
  }

  _addUnlockedGoldRing(group, nodeId, radiusX, radiusZ, phase) {
    const ringGeo = this._trackGeo(new THREE.RingGeometry(radiusX, radiusX + 0.24, 32));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.mats.goldRing);
    ringMesh.position.y = 0.11;
    ringMesh.scale.set(1, 1, radiusZ / radiusX);
    group.add(ringMesh);

    const haloGeo = this._trackGeo(new THREE.RingGeometry(radiusX + 0.24, radiusX + 0.62, 32));
    haloGeo.rotateX(-Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, this.mats.goldHalo);
    haloMesh.position.y = 0.095;
    haloMesh.scale.set(1, 1, radiusZ / radiusX);
    group.add(haloMesh);

    this.unlockedRings.push({
      nodeId,
      ringMesh,
      haloMesh,
      ratioZ: radiusZ / radiusX,
      phase,
    });
  }

  /**
   * Level 1 — Égypte : La Petite Pyramide (UNLOCKED & PLAYABLE)
   */
  _buildHeroEgyptIsland(coord) {
    const pos = new THREE.Vector3(coord.x, 0, coord.z);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.35, 2.15, 0.64, 1.2, 22));
    const mound = new THREE.Mesh(moundGeo, this.mats.desertSand);
    mound.position.y = 0.12;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.46, 2.25, 0.4);
    this._addUnlockedGoldRing(group, 'level1_pyramid', 2.52, 2.3, 0);

    // 5-tier stepped sandstone pyramid + golden pyramidion capstone
    const pyrGroup = new THREE.Group();
    pyrGroup.position.set(0.45, 0.54, -0.1);
    const tierWidths = [1.44, 1.14, 0.86, 0.56];
    const tierH = 0.21;
    for (let t = 0; t < 4; t++) {
      const mesh = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(tierWidths[t], tierH, tierWidths[t])),
        this.textures.materials.carvedBlock
      );
      mesh.position.y = t * tierH + tierH * 0.5;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pyrGroup.add(mesh);
    }
    const capGeo = this._trackGeo(new THREE.ConeGeometry(0.34 / Math.SQRT2, 0.32, 4));
    capGeo.rotateY(Math.PI / 4);
    const cap = new THREE.Mesh(capGeo, this.textures.materials.capstoneGold);
    cap.position.y = 4 * tierH + 0.16;
    cap.castShadow = true;
    pyrGroup.add(cap);
    group.add(pyrGroup);

    // Quarry cliff + sled + oasis + palms
    const cliff1 = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.02, 0.38, 0.62)),
      this.textures.materials.limestone
    );
    cliff1.position.set(-1.02, 0.68, -0.72);
    cliff1.castShadow = true;
    group.add(cliff1);

    const miniTrack = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.95, 0.05, 0.34)),
      this.textures.materials.timberDark
    );
    miniTrack.position.set(-0.82, 0.56, 0.48);
    miniTrack.rotation.y = 0.25;
    group.add(miniTrack);

    const miniSled = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.42, 0.08, 0.28)),
      this.textures.materials.timber
    );
    miniSled.position.set(-0.8, 0.62, 0.48);
    miniSled.rotation.y = 0.25;
    miniSled.castShadow = true;
    group.add(miniSled);

    const pool = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12)),
      this.textures.materials.oasisWater
    );
    pool.position.set(1.24, 0.53, -0.84);
    group.add(pool);

    this._createMiniPalm(group, 0.92, 0.54, -1.1, 0.4, 0.16);
    this._createMiniPalm(group, 1.5, 0.5, -0.58, 0.34, -0.18);
    this._createMiniPalm(group, -1.35, 0.48, 0.92, 0.36, 0.14);

    const hitbox = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(2.55, 2.65, 2.4, 10)),
      this.mats.hitbox
    );
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level1_pyramid',
      levelIndex: 0,
      levelNum: 1,
      chapter: WORLD_CHAPTERS[0],
      unlocked: true,
      isMilestone: false,
      title: 'Niveau 1 : La Petite Pyramide (55 blocs)',
      shortLabel: 'Égypte',
      labelText: 'Niveau 1 • Jouable',
      position: pos,
      labelAnchor: new THREE.Vector3(pos.x, 2.35, pos.z),
      focusDistance: 17.5,
      focusElevation: 42,
      focusAzimuth: 0.12,
      group,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 2 — Rome : La Domus Romaine (UNLOCKED & PLAYABLE)
   */
  _buildHeroRomeIsland(coord) {
    const pos = new THREE.Vector3(coord.x, 0, coord.z);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.25, 2.08, 0.68, 3.7, 22));
    const mound = new THREE.Mesh(moundGeo, this.mats.mediterraneanGrass);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.38, 2.18, 1.6);
    this._addUnlockedGoldRing(group, 'level2_rome', 2.46, 2.26, 1.55);

    // Roman Aqueduct
    const aqGroup = new THREE.Group();
    aqGroup.position.set(-0.18, 0.64, -0.58);
    aqGroup.rotation.y = -0.22;
    const pierGeo = this._trackGeo(new THREE.BoxGeometry(0.16, 0.62, 0.2));
    const archGeo = this._trackGeo(new THREE.TorusGeometry(0.22, 0.06, 6, 12, Math.PI));
    const spacing = 0.56;
    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * spacing;
      const pier = new THREE.Mesh(pierGeo, this.mats.romanMarble);
      pier.position.set(px, 0.31, 0);
      pier.castShadow = true;
      aqGroup.add(pier);
      if (i < 3) {
        const arch = new THREE.Mesh(archGeo, this.mats.romanMarble);
        arch.position.set(px + spacing * 0.5, 0.48, 0);
        aqGroup.add(arch);
      }
    }
    const deck = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.94, 0.12, 0.23)),
      this.mats.romanMarble
    );
    deck.position.y = 0.7;
    aqGroup.add(deck);
    group.add(aqGroup);

    // Roman Domus Villa + terracotta compluvium roof + impluvium
    const domusGroup = new THREE.Group();
    domusGroup.position.set(0.14, 0.64, 0.38);
    domusGroup.rotation.y = 0.18;
    const domusBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.12, 0.32, 1.02)),
      this.mats.romanMarble
    );
    domusBase.position.y = 0.16;
    domusBase.castShadow = true;
    domusGroup.add(domusBase);

    const roofNS = this._trackGeo(new THREE.BoxGeometry(1.2, 0.15, 0.3));
    const roofEW = this._trackGeo(new THREE.BoxGeometry(0.3, 0.15, 0.48));
    [
      [0, 0.39, -0.38, roofNS],
      [0, 0.39, 0.38, roofNS],
      [-0.44, 0.39, 0, roofEW],
      [0.44, 0.39, 0, roofEW],
    ].forEach(([rx, ry, rz, g]) => {
      const rMesh = new THREE.Mesh(g, this.mats.terracotta);
      rMesh.position.set(rx, ry, rz);
      rMesh.castShadow = true;
      domusGroup.add(rMesh);
    });
    const miniImpluvium = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.34, 0.05, 0.3)),
      this.textures.materials.oasisWater
    );
    miniImpluvium.position.y = 0.33;
    domusGroup.add(miniImpluvium);
    group.add(domusGroup);

    // Slender Italian Cypress trees
    const cypressGeo = this._trackGeo(new THREE.ConeGeometry(0.15, 0.88, 6));
    [
      [-1.22, 0.86, -0.4],
      [-1.05, 0.82, 0.6],
      [1.22, 0.84, 0.5],
      [0.62, 0.96, -0.95],
      [1.38, 0.82, -0.32],
    ].forEach(([cx, cy, cz], idx) => {
      const tree = new THREE.Mesh(cypressGeo, this.mats.cypressGreen);
      tree.position.set(cx, cy, cz);
      tree.scale.setScalar(0.84 + (idx % 3) * 0.12);
      tree.castShadow = true;
      group.add(tree);
    });

    const hitbox = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(2.45, 2.55, 2.4, 10)),
      this.mats.hitbox
    );
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level2_rome',
      levelIndex: 1,
      levelNum: 2,
      chapter: WORLD_CHAPTERS[0],
      unlocked: true,
      isMilestone: false,
      title: 'Niveau 2 : La Domus Romaine (48 blocs)',
      shortLabel: 'Rome',
      labelText: 'Niveau 2 • Jouable',
      position: pos,
      labelAnchor: new THREE.Vector3(pos.x, 2.3, pos.z),
      focusDistance: 17.5,
      focusElevation: 42,
      focusAzimuth: -0.12,
      group,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 3 — Japon : La Maison Ancienne Japonaise (UNLOCKED & PLAYABLE)
   */
  _buildHeroJapanIsland(coord) {
    const pos = new THREE.Vector3(coord.x, 0, coord.z);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.25, 2.08, 0.66, 6.4, 22));
    const mound = new THREE.Mesh(moundGeo, this.mats.jadeMountain);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.38, 2.18, 2.9);
    this._addUnlockedGoldRing(group, 'level3_japan', 2.46, 2.26, 3.1);

    const miniPond = new THREE.Mesh(
      this._trackGeo(new THREE.CircleGeometry(0.42, 12)),
      this.textures.materials.oasisWater
    );
    miniPond.rotation.x = -Math.PI / 2;
    miniPond.position.set(1.12, 0.65, 0.48);
    group.add(miniPond);

    // Traditional Japanese Minka House
    const minka = new THREE.Group();
    minka.position.set(0.08, 0.66, -0.08);
    minka.rotation.y = 0.16;

    const stoneBase = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.1, 0.16, 1.0)),
      this.mats.lockStone
    );
    stoneBase.position.y = 0.08;
    minka.add(stoneBase);

    const engawa = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.22, 0.06, 1.12)),
      this.textures.materials.timber
    );
    engawa.position.y = 0.17;
    minka.add(engawa);

    const walls = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.92, 0.42, 0.82)),
      this.mats.shojiCream
    );
    walls.position.y = 0.4;
    walls.castShadow = true;
    minka.add(walls);

    const lowerRoof = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(1.06, 0.46, 4)),
      this.mats.kawaraSlate
    );
    lowerRoof.position.y = 0.8;
    lowerRoof.rotation.y = Math.PI / 4;
    lowerRoof.scale.set(1.05, 1.0, 0.96);
    lowerRoof.castShadow = true;
    minka.add(lowerRoof);

    const ridge = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.64, 0.1, 0.12)),
      this.mats.kawaraSlate
    );
    ridge.position.y = 1.02;
    minka.add(ridge);
    group.add(minka);

    // Blooming Pink Sakura Trees
    const sTrunkGeo = this._trackGeo(new THREE.CylinderGeometry(0.05, 0.08, 0.52, 6));
    const sPuffGeo = this._trackGeo(new THREE.IcosahedronGeometry(0.3, 1));
    [
      [1.1, 0.62, -0.62, 1.02],
      [-0.95, 0.62, -0.7, 0.88],
    ].forEach(([sx, sy, sz, sc], idx) => {
      const sak = new THREE.Group();
      sak.position.set(sx, sy, sz);
      sak.scale.setScalar(sc);
      const tr = new THREE.Mesh(sTrunkGeo, this.mats.cedarDark);
      tr.position.y = 0.24;
      sak.add(tr);
      [
        [0, 0.58, 0, 1.0, 0.7, 1.0, false],
        [-0.22, 0.48, 0.12, 0.74, 0.55, 0.74, true],
      ].forEach(([px, py, pz, rx, ry, rz, isLight]) => {
        const pf = new THREE.Mesh(sPuffGeo, isLight ? this.mats.sakuraLight : this.mats.sakuraPink);
        pf.position.set(px, py, pz);
        pf.scale.set(rx, ry, rz);
        pf.castShadow = true;
        sak.add(pf);
      });
      this.animatedProps.push({ obj: sak, type: 'sway', phase: 1.9 + idx });
      group.add(sak);
    });

    // Bamboo grove
    const bambooGroup = new THREE.Group();
    bambooGroup.position.set(-1.18, 0.54, 0.4);
    const stalkGeo = this._trackGeo(new THREE.CylinderGeometry(0.03, 0.04, 0.96, 5));
    for (let b = 0; b < 5; b++) {
      const angle = (b / 5) * Math.PI * 2;
      const stalk = new THREE.Mesh(stalkGeo, this.mats.bambooGreen);
      stalk.position.set(Math.cos(angle) * 0.22, 0.48, Math.sin(angle) * 0.22);
      bambooGroup.add(stalk);
    }
    this.animatedProps.push({ obj: bambooGroup, type: 'sway', phase: 2.7 });
    group.add(bambooGroup);

    const hitbox = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(2.45, 2.55, 2.4, 10)),
      this.mats.hitbox
    );
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level3_japan',
      levelIndex: 2,
      levelNum: 3,
      chapter: WORLD_CHAPTERS[0],
      unlocked: true,
      isMilestone: false,
      title: 'Niveau 3 : La Maison Ancienne Japonaise (46 blocs)',
      shortLabel: 'Japon',
      labelText: 'Niveau 3 • Jouable',
      position: pos,
      labelAnchor: new THREE.Vector3(pos.x, 2.3, pos.z),
      focusDistance: 17.5,
      focusElevation: 42,
      focusAzimuth: 0.12,
      group,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 4 — Maya : Le Temple Maya de Kukulcán (UNLOCKED & PLAYABLE)
   */
  _buildHeroMayaIsland(coord) {
    const pos = new THREE.Vector3(coord.x, 0, coord.z);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.25, 2.08, 0.68, 9.2, 22));
    const mound = new THREE.Mesh(moundGeo, this.mats.mayaJungle);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.38, 2.18, 4.1);
    this._addUnlockedGoldRing(group, 'level4_maya', 2.46, 2.26, 4.65);

    const cenote = new THREE.Mesh(
      this._trackGeo(new THREE.CircleGeometry(0.46, 14)),
      this.textures.materials.oasisWater
    );
    cenote.rotation.x = -Math.PI / 2;
    cenote.position.set(1.02, 0.68, -0.52);
    group.add(cenote);

    // Mayan Stepped Temple of Kukulcán
    const temple = new THREE.Group();
    temple.position.set(-0.2, 0.68, 0.12);
    temple.rotation.y = -0.18;

    [
      { w: 1.38, h: 0.22, y: 0.11, mat: this.mats.mayaStone },
      { w: 1.04, h: 0.22, y: 0.33, mat: this.mats.mayaStone },
      { w: 0.72, h: 0.2, y: 0.54, mat: this.mats.mayaRedOchre },
    ].forEach((t) => {
      const tier = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(t.w, t.h, t.w)), t.mat);
      tier.position.y = t.y;
      tier.castShadow = true;
      temple.add(tier);
    });

    const stair = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.3, 0.66, 0.5)),
      this.mats.mayaStone
    );
    stair.position.set(0, 0.32, 0.52);
    stair.rotation.x = -0.52;
    temple.add(stair);

    const shrine = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.48, 0.26, 0.4)),
      this.mats.mayaRedOchre
    );
    shrine.position.set(0, 0.77, -0.04);
    shrine.castShadow = true;
    temple.add(shrine);

    const jadeJewel = new THREE.Mesh(
      this._trackGeo(new THREE.OctahedronGeometry(0.085, 0)),
      this.mats.mayaJade
    );
    jadeJewel.position.set(0, 1.04, -0.06);
    temple.add(jadeJewel);
    group.add(temple);

    this._createMiniPalm(group, -1.2, 0.62, 0.52, 0.7, 0.18);
    this._createMiniPalm(group, 1.14, 0.62, 0.62, 0.66, -0.18);
    this._createMiniPalm(group, -1.08, 0.64, -0.74, 0.72, 0.12);

    const hitbox = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(2.45, 2.55, 2.4, 10)),
      this.mats.hitbox
    );
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level4_maya',
      levelIndex: 3,
      levelNum: 4,
      chapter: WORLD_CHAPTERS[0],
      unlocked: true,
      isMilestone: false,
      title: 'Niveau 4 : Le Temple Maya de Kukulcán (52 blocs)',
      shortLabel: 'Maya',
      labelText: 'Niveau 4 • Jouable',
      position: pos,
      labelAnchor: new THREE.Vector3(pos.x, 2.3, pos.z),
      focusDistance: 17.5,
      focusElevation: 42,
      focusAzimuth: -0.14,
      group,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Level 5 — Pénitencier Américain – Années 1800 (UNLOCKED & PLAYABLE — 50 blocs)
   */
  _buildHeroPenitentiaryIsland(coord) {
    const pos = new THREE.Vector3(coord.x, 0, coord.z);
    const group = new THREE.Group();
    group.position.copy(pos);
    this.root.add(group);

    // Dusty ochre-brown Old West mesa island mound
    const moundGeo = this._trackGeo(createIslandMoundGeometry(2.25, 2.08, 0.68, 11.4, 22));
    const mound = new THREE.Mesh(moundGeo, this.mats.frontierOchre);
    mound.position.y = 0.14;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);
    this._addShoreFoamRing(group, 2.38, 2.18, 5.2);
    this._addUnlockedGoldRing(group, 'level5_penitentiary', 2.46, 2.26, 6.1);

    // Miniature 1800s American Penitentiary fortress compound
    const compound = new THREE.Group();
    compound.position.set(0.05, 0.68, 0.05);
    compound.rotation.y = 0.14;

    // Massive grey granite perimeter wall enclosure + open gravel courtyard
    const wallNS = this._trackGeo(new THREE.BoxGeometry(1.36, 0.34, 0.18));
    const wallEW = this._trackGeo(new THREE.BoxGeometry(0.18, 0.34, 1.24));
    [
      [wallNS, 0, 0.17, -0.58],
      [wallNS, 0, 0.17, 0.58],
      [wallEW, -0.59, 0.17, 0],
      [wallEW, 0.59, 0.17, 0],
    ].forEach(([g, wx, wy, wz]) => {
      const m = new THREE.Mesh(g, this.mats.prisonGranite);
      m.position.set(wx, wy, wz);
      m.castShadow = true;
      compound.add(m);
    });

    // Dark-red brick upper cellblock wing along North wall + double-pitched dark slate roof
    const brickWing = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(1.28, 0.28, 0.36)),
      this.mats.prisonBrick
    );
    brickWing.position.set(0, 0.48, -0.46);
    brickWing.castShadow = true;
    compound.add(brickWing);

    const slateRoofGeo = this._trackGeo(new THREE.CylinderGeometry(0.02, 0.34, 1.34, 3));
    slateRoofGeo.rotateZ(Math.PI / 2);
    const slateRoof = new THREE.Mesh(slateRoofGeo, this.mats.prisonSlate);
    slateRoof.scale.set(1.0, 0.72, 0.78);
    slateRoof.position.set(0, 0.72, -0.46);
    slateRoof.castShadow = true;
    compound.add(slateRoof);

    // Central Octagonal Guard Tower + Slate Cupola + Tiny 1800s American Flag
    const towerBase = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 0.72, 8)),
      this.mats.prisonGranite
    );
    towerBase.position.set(0, 0.36, 0.04);
    towerBase.castShadow = true;
    compound.add(towerBase);

    const towerTop = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 8)),
      this.mats.prisonBrick
    );
    towerTop.position.set(0, 0.88, 0.04);
    compound.add(towerTop);

    const cupola = new THREE.Mesh(
      this._trackGeo(new THREE.ConeGeometry(0.28, 0.28, 8)),
      this.mats.prisonSlate
    );
    cupola.position.set(0, 1.18, 0.04);
    cupola.castShadow = true;
    compound.add(cupola);

    const pole = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.015, 0.018, 0.48, 6)),
      this.mats.lockStone
    );
    pole.position.set(0, 1.52, 0.04);
    compound.add(pole);

    const miniFlag = new THREE.Mesh(
      this._trackGeo(new THREE.BoxGeometry(0.32, 0.19, 0.02)),
      this.mats.mayaRedOchre
    );
    miniFlag.position.set(0.16, 1.66, 0.04);
    compound.add(miniFlag);

    group.add(compound);

    // Miniature timber corner watchtower & dry western pines
    const pineGeo = this._trackGeo(new THREE.ConeGeometry(0.18, 0.72, 6));
    [
      [-1.18, 0.86, 0.56],
      [1.16, 0.84, 0.52],
      [-1.12, 0.88, -0.68],
    ].forEach(([px, py, pz]) => {
      const pine = new THREE.Mesh(pineGeo, this.mats.cypressGreen);
      pine.position.set(px, py, pz);
      pine.castShadow = true;
      group.add(pine);
    });

    const hitbox = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(2.45, 2.55, 2.4, 10)),
      this.mats.hitbox
    );
    hitbox.position.y = 1.1;
    group.add(hitbox);

    const node = {
      id: 'level5_penitentiary',
      levelIndex: 4,
      levelNum: 5,
      chapter: WORLD_CHAPTERS[0],
      unlocked: true,
      isMilestone: false,
      title: 'Niveau 5 : Pénitencier Américain – Années 1800 (50 blocs)',
      shortLabel: 'Pénitencier 1800',
      labelText: 'Niveau 5 • Jouable',
      position: pos,
      labelAnchor: new THREE.Vector3(pos.x, 2.45, pos.z),
      focusDistance: 17.5,
      focusElevation: 42,
      focusAzimuth: 0.14,
      group,
      hitbox,
      bounceTime: 0,
    };

    hitbox.userData.interact = { type: 'map-node', node };
    this.nodes.push(node);
  }

  /**
   * Builds all 86 regular "Bientôt" islands using shared InstancedMesh batches
   * (mounds, shoreline foam, stone foundation plinths, timber scaffolding, soft mist, biome props).
   */
  _buildInstancedRegularIslands(entries) {
    const count = entries.length;
    if (count === 0) return;

    const moundGeo = this._trackGeo(
      createIslandMoundGeometry(REGULAR_ISLAND_RADIUS, REGULAR_ISLAND_RADIUS * 0.92, 0.48, 2.4, 14)
    );
    const foamGeo = this._trackGeo(
      new THREE.RingGeometry(REGULAR_ISLAND_RADIUS * 0.98, REGULAR_ISLAND_RADIUS * 1.18, 16)
    );
    foamGeo.rotateX(-Math.PI / 2);

    const plinthGeo = this._trackGeo(new THREE.BoxGeometry(0.76, 0.18, 0.76));
    const postGeo = this._trackGeo(new THREE.CylinderGeometry(0.032, 0.038, 0.62, 5));
    const beamGeo = this._trackGeo(new THREE.BoxGeometry(0.68, 0.045, 0.055));
    const mistGeo = this._trackGeo(new THREE.IcosahedronGeometry(0.36, 1));
    const propGeo = this._trackGeo(new THREE.ConeGeometry(0.16, 0.56, 6));
    const hitGeo = this._trackGeo(new THREE.CylinderGeometry(1.42, 1.5, 1.9, 8));

    const moundInst = new THREE.InstancedMesh(moundGeo, this.mats.instancedGround, count);
    moundInst.castShadow = true;
    moundInst.receiveShadow = true;

    const foamInst = new THREE.InstancedMesh(foamGeo, this.mats.shoreFoam, count);
    const plinthInst = new THREE.InstancedMesh(plinthGeo, this.mats.instancedStone, count);
    plinthInst.castShadow = true;
    plinthInst.receiveShadow = true;

    const postsInst = new THREE.InstancedMesh(postGeo, this.mats.scaffoldWood, count * 4);
    const beamsInst = new THREE.InstancedMesh(beamGeo, this.mats.scaffoldWood, count * 2);
    const mistInst = new THREE.InstancedMesh(mistGeo, this.mats.mistCloud, count * 2);
    const propsInst = new THREE.InstancedMesh(propGeo, this.mats.instancedProp, count * 2);
    propsInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const postOffsets = [
      [-0.28, -0.28],
      [0.28, -0.28],
      [-0.28, 0.28],
      [0.28, 0.28],
    ];

    for (let i = 0; i < count; i++) {
      const e = entries[i];
      const rotY = ((e.levelNum * 1.37) % (Math.PI * 2));
      const scaleVar = 0.94 + ((e.levelNum * 17) % 13) * 0.011;

      // 1. Sculpted island mound colored by biome
      dummy.position.set(e.x, 0.1, e.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scaleVar, 1.0, scaleVar);
      dummy.updateMatrix();
      moundInst.setMatrixAt(i, dummy.matrix);
      tmpColor.set(e.chapter.groundHex);
      moundInst.setColorAt(i, tmpColor);

      // 2. Shoreline foam ring
      dummy.position.set(e.x, 0.03, e.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scaleVar, 1, scaleVar * 0.92);
      dummy.updateMatrix();
      foamInst.setMatrixAt(i, dummy.matrix);

      // 3. Stone construction foundation plinth
      dummy.position.set(e.x, 0.46, e.z);
      dummy.rotation.set(0, rotY * 0.5, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      plinthInst.setMatrixAt(i, dummy.matrix);
      tmpColor.set(e.chapter.wallHex).multiplyScalar(0.92);
      plinthInst.setColorAt(i, tmpColor);

      // 4. Miniature timber construction scaffolding (4 posts + 2 crossbeams)
      for (let p = 0; p < 4; p++) {
        const [ox, oz] = postOffsets[p];
        dummy.position.set(e.x + ox, 0.72, e.z + oz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 0.85 + (p % 2) * 0.18, 1);
        dummy.updateMatrix();
        postsInst.setMatrixAt(i * 4 + p, dummy.matrix);
      }
      for (let b = 0; b < 2; b++) {
        dummy.position.set(e.x, 0.92 + b * 0.1, e.z + (b === 0 ? -0.28 : 0.28));
        dummy.rotation.set(0, b === 0 ? 0 : Math.PI * 0.5, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        beamsInst.setMatrixAt(i * 2 + b, dummy.matrix);
      }

      // 5. Soft stylized "Bientôt" mist clouds hovering gently above the site
      for (let m = 0; m < 2; m++) {
        const ma = rotY + m * 2.6;
        dummy.position.set(
          e.x + Math.cos(ma) * 0.26,
          1.12 + m * 0.12,
          e.z + Math.sin(ma) * 0.22
        );
        dummy.rotation.set(0, ma, 0);
        dummy.scale.set(1.25 - m * 0.24, 0.56, 1.05 - m * 0.18);
        dummy.updateMatrix();
        mistInst.setMatrixAt(i * 2 + m, dummy.matrix);
      }

      // 6. Miniature biome trees / cypresses / boulders flanking each island
      for (let t = 0; t < 2; t++) {
        const ta = rotY + 0.9 + t * 2.85;
        dummy.position.set(
          e.x + Math.cos(ta) * 0.58 * scaleVar,
          0.62,
          e.z + Math.sin(ta) * 0.52 * scaleVar
        );
        dummy.rotation.set(0, ta, 0);
        const ts = 0.78 + t * 0.22;
        dummy.scale.set(ts, ts, ts);
        dummy.updateMatrix();
        propsInst.setMatrixAt(i * 2 + t, dummy.matrix);
        tmpColor.set(e.chapter.propHex);
        propsInst.setColorAt(i * 2 + t, tmpColor);
      }

      // 7. Invisible lightweight touch hitbox (0 draw calls!)
      const hitbox = new THREE.Mesh(hitGeo, this.mats.hitbox);
      hitbox.position.set(e.x, 0.9, e.z);
      this.root.add(hitbox);

      const pos = new THREE.Vector3(e.x, 0, e.z);
      const node = {
        id: `level_${e.levelNum}`,
        levelIndex: e.levelIndex,
        levelNum: e.levelNum,
        chapter: e.chapter,
        unlocked: false,
        isMilestone: false,
        title: `Niveau ${e.levelNum} — Bientôt disponible`,
        subtitle: `Chapitre ${e.chapter.index + 1} • ${e.chapter.biomeName}`,
        shortLabel: e.chapter.shortRegion,
        labelText: `Niveau ${e.levelNum} • Bientôt`,
        position: pos,
        labelAnchor: new THREE.Vector3(e.x, 1.62, e.z),
        focusDistance: 17.0,
        focusElevation: 44,
        focusAzimuth: 0.06,
        group: null,
        hitbox,
        bounceTime: 0,
      };
      hitbox.userData.interact = { type: 'map-node', node };
      this.nodes.push(node);
    }

    moundInst.instanceMatrix.needsUpdate = true;
    moundInst.instanceColor.needsUpdate = true;
    foamInst.instanceMatrix.needsUpdate = true;
    plinthInst.instanceMatrix.needsUpdate = true;
    plinthInst.instanceColor.needsUpdate = true;
    postsInst.instanceMatrix.needsUpdate = true;
    beamsInst.instanceMatrix.needsUpdate = true;
    mistInst.instanceMatrix.needsUpdate = true;
    propsInst.instanceMatrix.needsUpdate = true;
    propsInst.instanceColor.needsUpdate = true;

    this.root.add(moundInst, foamInst, plinthInst, postsInst, beamsInst, mistInst, propsInst);
  }

  /**
   * Builds all 10 special Grand Village / City Milestone Islands (Levels 10, 20, ..., 100):
   *  - 2.2x larger island radius (2.15 vs 0.96)
   *  - Golden-crowned beacon ring + pulsing halo + raised golden milestone crown
   *  - Fortified citadel terrace + clustered village houses (InstancedMesh)
   *  - Civilization-specific central landmark monument per region
   */
  _buildMilestoneCityIslands(entries) {
    const count = entries.length;
    if (count === 0) return;

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    // Shared InstancedMesh batches for all 10 Milestone Cities (houses, roofs, perimeter bastions, harbor piers)
    const housesPerCity = 7;
    const bastionsPerCity = 8;

    const houseBodyGeo = this._trackGeo(new THREE.BoxGeometry(0.38, 0.28, 0.34));
    const houseRoofGeo = this._trackGeo(new THREE.ConeGeometry(0.32, 0.24, 4));
    houseRoofGeo.rotateY(Math.PI / 4);
    const bastionGeo = this._trackGeo(new THREE.BoxGeometry(0.24, 0.34, 0.24));
    const wallRingGeo = this._trackGeo(new THREE.TorusGeometry(1.42, 0.085, 6, 16));
    wallRingGeo.rotateX(Math.PI / 2);

    const houseBodyInst = new THREE.InstancedMesh(
      houseBodyGeo,
      this.mats.instancedStone,
      count * housesPerCity
    );
    houseBodyInst.castShadow = true;
    houseBodyInst.receiveShadow = true;

    const houseRoofInst = new THREE.InstancedMesh(
      houseRoofGeo,
      this.mats.instancedRoof,
      count * housesPerCity
    );
    houseRoofInst.castShadow = true;

    const bastionInst = new THREE.InstancedMesh(
      bastionGeo,
      this.mats.instancedStone,
      count * bastionsPerCity
    );
    bastionInst.castShadow = true;

    const wallRingInst = new THREE.InstancedMesh(wallRingGeo, this.mats.instancedStone, count);
    wallRingInst.castShadow = true;

    const moundGeo = this._trackGeo(
      createIslandMoundGeometry(MILESTONE_ISLAND_RADIUS, MILESTONE_ISLAND_RADIUS * 0.94, 0.74, 5.1, 22)
    );
    const ringGeo = this._trackGeo(new THREE.RingGeometry(2.38, 2.66, 36));
    ringGeo.rotateX(-Math.PI / 2);
    const haloGeo = this._trackGeo(new THREE.RingGeometry(2.66, 3.08, 36));
    haloGeo.rotateX(-Math.PI / 2);
    const crownBandGeo = this._trackGeo(new THREE.TorusGeometry(1.76, 0.06, 6, 28));
    crownBandGeo.rotateX(Math.PI / 2);
    const hitGeo = this._trackGeo(new THREE.CylinderGeometry(2.65, 2.75, 2.8, 10));

    let houseIdx = 0;
    let bastionIdx = 0;

    for (let c = 0; c < count; c++) {
      const e = entries[c];
      const pos = new THREE.Vector3(e.x, 0, e.z);
      const group = new THREE.Group();
      group.position.copy(pos);
      this.root.add(group);

      // 1. Grand 2.2x sculpted biome island mound
      const moundMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          color: e.chapter.groundHex,
          roughness: 0.86,
          metalness: 0.03,
        })
      );
      const mound = new THREE.Mesh(moundGeo, moundMat);
      mound.position.y = 0.14;
      mound.castShadow = true;
      mound.receiveShadow = true;
      group.add(mound);

      this._addShoreFoamRing(group, 2.28, 2.14, c * 1.1);

      // 2. Golden-Crowned Beacon Ring + Outer Expanding Halo + Elevated Gold Trim Crown
      const ringMesh = new THREE.Mesh(ringGeo, this.mats.milestoneRing);
      ringMesh.position.y = 0.11;
      ringMesh.scale.set(1, 1, 0.94);
      group.add(ringMesh);

      const haloMesh = new THREE.Mesh(haloGeo, this.mats.milestoneHalo);
      haloMesh.position.y = 0.095;
      haloMesh.scale.set(1, 1, 0.94);
      group.add(haloMesh);

      const goldCrown = new THREE.Mesh(crownBandGeo, this.textures.materials.capstoneGold);
      goldCrown.position.y = 0.66;
      goldCrown.scale.set(1, 1, 0.94);
      group.add(goldCrown);

      this.milestoneRings.push({
        nodeId: `level_${e.levelNum}`,
        ringMesh,
        haloMesh,
        ratioZ: 0.94,
        phase: c * 0.95,
      });

      // 3. Citadel perimeter stone wall ring & 8 corner bastions (in world instanced batch)
      dummy.position.set(e.x, 0.72, e.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1.6, 0.94);
      dummy.updateMatrix();
      wallRingInst.setMatrixAt(c, dummy.matrix);
      tmpColor.set(e.chapter.wallHex).multiplyScalar(0.88);
      wallRingInst.setColorAt(c, tmpColor);

      for (let b = 0; b < bastionsPerCity; b++) {
        const a = (b / bastionsPerCity) * Math.PI * 2 + 0.25;
        dummy.position.set(e.x + Math.cos(a) * 1.42, 0.84, e.z + Math.sin(a) * 1.33);
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(1, 1 + (b % 2) * 0.22, 1);
        dummy.updateMatrix();
        bastionInst.setMatrixAt(bastionIdx, dummy.matrix);
        bastionInst.setColorAt(bastionIdx, tmpColor);
        bastionIdx++;
      }

      // 4. Clustered ring of 7 miniature Village / City houses around the central monument
      const wallCol = new THREE.Color(e.chapter.wallHex);
      const roofCol = new THREE.Color(e.chapter.roofHex);
      for (let h = 0; h < housesPerCity; h++) {
        const a = (h / housesPerCity) * Math.PI * 2 + 0.45 + c * 0.3;
        const rad = 0.92 + (h % 2) * 0.24;
        const hx = e.x + Math.cos(a) * rad;
        const hz = e.z + Math.sin(a) * rad * 0.92;
        const hs = 0.86 + (h % 3) * 0.14;

        dummy.position.set(hx, 0.76, hz);
        dummy.rotation.set(0, -a + 0.3, 0);
        dummy.scale.set(hs, hs, hs);
        dummy.updateMatrix();
        houseBodyInst.setMatrixAt(houseIdx, dummy.matrix);
        houseBodyInst.setColorAt(houseIdx, wallCol);

        dummy.position.set(hx, 0.76 + 0.25 * hs, hz);
        dummy.rotation.set(0, -a + 0.3, 0);
        dummy.scale.set(hs * 1.06, hs, hs * 1.06);
        dummy.updateMatrix();
        houseRoofInst.setMatrixAt(houseIdx, dummy.matrix);
        houseRoofInst.setColorAt(houseIdx, roofCol);
        houseIdx++;
      }

      // 5. Distinct Central Landmark Monument tailored to the chapter's civilization!
      this._buildMilestoneMonument(group, e.chapter);

      // 6. Floating Golden Beacon Spire Crest above the city centerpiece
      const crest = new THREE.Mesh(
        this._trackGeo(new THREE.OctahedronGeometry(0.18, 0)),
        this.textures.materials.capstoneGold
      );
      crest.position.set(0, 2.38, 0);
      group.add(crest);
      this.animatedProps.push({ obj: crest, type: 'spin', phase: c * 1.3 });

      // 7. Generous touch hitbox
      const hitbox = new THREE.Mesh(hitGeo, this.mats.hitbox);
      hitbox.position.y = 1.25;
      group.add(hitbox);

      const node = {
        id: `level_${e.levelNum}`,
        levelIndex: e.levelIndex,
        levelNum: e.levelNum,
        chapter: e.chapter,
        unlocked: false,
        isMilestone: true,
        milestoneCity: e.chapter.milestoneCity,
        title: `Niveau ${e.levelNum} • Grand Chantier Village/Ville — Bientôt`,
        subtitle: `🏛️ ${e.chapter.milestoneCity} • ${e.chapter.biomeName}`,
        shortLabel: e.chapter.milestoneCity,
        labelText: `🏛️ Village/Ville • Niv. ${e.levelNum}`,
        position: pos,
        labelAnchor: new THREE.Vector3(e.x, 2.85, e.z),
        focusDistance: 19.0,
        focusElevation: 41,
        focusAzimuth: c % 2 === 0 ? 0.14 : -0.14,
        group,
        hitbox,
        bounceTime: 0,
      };
      hitbox.userData.interact = { type: 'map-node', node };
      this.nodes.push(node);
    }

    houseBodyInst.instanceMatrix.needsUpdate = true;
    houseBodyInst.instanceColor.needsUpdate = true;
    houseRoofInst.instanceMatrix.needsUpdate = true;
    houseRoofInst.instanceColor.needsUpdate = true;
    bastionInst.instanceMatrix.needsUpdate = true;
    bastionInst.instanceColor.needsUpdate = true;
    wallRingInst.instanceMatrix.needsUpdate = true;
    wallRingInst.instanceColor.needsUpdate = true;

    this.root.add(houseBodyInst, houseRoofInst, bastionInst, wallRingInst);
  }

  /**
   * Builds a lightweight, iconic central 3D monument for each of the 10 Milestone Cities.
   */
  _buildMilestoneMonument(parent, chapter) {
    const mon = new THREE.Group();
    mon.position.set(0, 0.68, 0);

    const wallMat = this._trackMat(
      new THREE.MeshStandardMaterial({ color: chapter.wallHex, roughness: 0.72 })
    );
    const roofMat = this._trackMat(
      new THREE.MeshStandardMaterial({ color: chapter.roofHex, roughness: 0.58, metalness: 0.14 })
    );
    const goldMat = this.textures.materials.capstoneGold;

    // Raised stone citadel dais
    const dais = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(0.68, 0.82, 0.22, 8)),
      wallMat
    );
    dais.position.y = 0.11;
    dais.castShadow = true;
    mon.add(dais);

    switch (chapter.archetype) {
      case 'egypt': {
        // Grand Pyramid Sanctuary + Twin Golden-Tipped Obelisks
        const pyr = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.68, 0.96, 4)), wallMat);
        pyr.rotation.y = Math.PI / 4;
        pyr.position.y = 0.7;
        pyr.castShadow = true;
        mon.add(pyr);
        const cap = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.22, 0.28, 4)), goldMat);
        cap.rotation.y = Math.PI / 4;
        cap.position.y = 1.08;
        mon.add(cap);
        [-0.48, 0.48].forEach((ox) => {
          const ob = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.11, 0.78, 0.11)), goldMat);
          ob.position.set(ox, 0.58, 0.45);
          mon.add(ob);
        });
        break;
      }
      case 'rome': {
        // Circular Imperial Forum Rotunda / Colosseum + Terracotta Dome
        const drum = new THREE.Mesh(
          this._trackGeo(new THREE.CylinderGeometry(0.58, 0.62, 0.58, 12)),
          wallMat
        );
        drum.position.y = 0.5;
        drum.castShadow = true;
        mon.add(drum);
        const dome = new THREE.Mesh(
          this._trackGeo(new THREE.SphereGeometry(0.54, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)),
          roofMat
        );
        dome.position.y = 0.78;
        mon.add(dome);
        const finial = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 6)), goldMat);
        finial.position.y = 1.36;
        mon.add(finial);
        break;
      }
      case 'japan': {
        // 3-Tier Feudal Tenshukaku Castle Pagoda with Sweeping Kawara Eaves
        for (let t = 0; t < 3; t++) {
          const s = 1 - t * 0.24;
          const body = new THREE.Mesh(
            this._trackGeo(new THREE.BoxGeometry(0.64 * s, 0.28, 0.64 * s)),
            wallMat
          );
          body.position.y = 0.34 + t * 0.36;
          body.castShadow = true;
          mon.add(body);
          const eave = new THREE.Mesh(
            this._trackGeo(new THREE.ConeGeometry(0.64 * s, 0.22, 4)),
            roofMat
          );
          eave.rotation.y = Math.PI / 4;
          eave.position.y = 0.54 + t * 0.36;
          mon.add(eave);
        }
        const spire = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.03, 0.05, 0.34, 6)), goldMat);
        spire.position.y = 1.54;
        mon.add(spire);
        break;
      }
      case 'maya': {
        // Grand Stepped Pyramid Citadel + Red-Ochre Temple + Jade Crest
        for (let t = 0; t < 3; t++) {
          const w = 0.92 - t * 0.22;
          const tier = new THREE.Mesh(
            this._trackGeo(new THREE.BoxGeometry(w, 0.24, w)),
            t === 2 ? roofMat : wallMat
          );
          tier.position.y = 0.34 + t * 0.24;
          tier.castShadow = true;
          mon.add(tier);
        }
        const shrine = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.38, 0.28, 0.34)), roofMat);
        shrine.position.y = 1.08;
        mon.add(shrine);
        const jade = new THREE.Mesh(this._trackGeo(new THREE.OctahedronGeometry(0.12, 0)), this.mats.mayaJade);
        jade.position.y = 1.34;
        mon.add(jade);
        break;
      }
      case 'viking': {
        // Grand Nordic Longhouse Hall + Twin Timber Watchtowers
        const hall = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.92, 0.38, 0.54)), wallMat);
        hall.position.y = 0.4;
        hall.castShadow = true;
        mon.add(hall);
        const gable = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.68, 0.42, 4)), roofMat);
        gable.rotation.y = Math.PI / 4;
        gable.scale.set(1.15, 1, 0.72);
        gable.position.y = 0.78;
        mon.add(gable);
        const tower = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 0.95, 6)), wallMat);
        tower.position.set(0, 0.7, -0.35);
        mon.add(tower);
        const cap = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.24, 0.32, 6)), roofMat);
        cap.position.set(0, 1.32, -0.35);
        mon.add(cap);
        break;
      }
      case 'medieval': {
        // Royal Stone Keep + 4 Corner Slate-Blue Spire Turrets
        const keep = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.68, 0.76, 0.68)), wallMat);
        keep.position.y = 0.58;
        keep.castShadow = true;
        mon.add(keep);
        const mainSpire = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.42, 0.52, 6)), roofMat);
        mainSpire.position.y = 1.22;
        mon.add(mainSpire);
        [
          [-0.36, -0.36],
          [0.36, -0.36],
          [-0.36, 0.36],
          [0.36, 0.36],
        ].forEach(([tx, tz]) => {
          const tur = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.88, 6)), wallMat);
          tur.position.set(tx, 0.64, tz);
          mon.add(tur);
          const cone = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.14, 0.28, 6)), roofMat);
          cone.position.set(tx, 1.2, tz);
          mon.add(cone);
        });
        break;
      }
      case 'arabian': {
        // Gilded Onion-Dome Desert Palace + 2 Tall Minarets
        const pal = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.84, 0.48, 0.78)), wallMat);
        pal.position.y = 0.46;
        pal.castShadow = true;
        mon.add(pal);
        const dome = new THREE.Mesh(this._trackGeo(new THREE.SphereGeometry(0.42, 12, 10)), goldMat);
        dome.scale.set(1, 1.15, 1);
        dome.position.y = 0.86;
        mon.add(dome);
        [-0.48, 0.48].forEach((mx) => {
          const min = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 1.05, 8)), wallMat);
          min.position.set(mx, 0.74, -0.34);
          mon.add(min);
          const tip = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.1, 0.24, 8)), goldMat);
          tip.position.set(mx, 1.38, -0.34);
          mon.add(tip);
        });
        break;
      }
      case 'greek': {
        // White Marble Parthenon Acropolis + Cobalt Cycladic Dome
        const base = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.96, 0.16, 0.68)), wallMat);
        base.position.y = 0.3;
        mon.add(base);
        const colGeo = this._trackGeo(new THREE.CylinderGeometry(0.045, 0.05, 0.46, 6));
        for (let cx = -0.36; cx <= 0.361; cx += 0.24) {
          [-0.24, 0.24].forEach((cz) => {
            const col = new THREE.Mesh(colGeo, wallMat);
            col.position.set(cx, 0.6, cz);
            mon.add(col);
          });
        }
        const ped = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.66, 0.32, 4)), roofMat);
        ped.rotation.y = Math.PI / 4;
        ped.scale.set(1.1, 1, 0.78);
        ped.position.y = 0.98;
        mon.add(ped);
        break;
      }
      case 'indus': {
        // Stepped Terracotta Brick Citadel + Sacred Turquoise Bath Courtyard
        const plat = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(0.98, 0.34, 0.9)), wallMat);
        plat.position.y = 0.38;
        plat.castShadow = true;
        mon.add(plat);
        const bath = new THREE.Mesh(
          this._trackGeo(new THREE.BoxGeometry(0.46, 0.06, 0.36)),
          this.textures.materials.oasisWater
        );
        bath.position.set(0, 0.57, 0.18);
        mon.add(bath);
        const spire = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.14, 0.34, 0.78, 8)), roofMat);
        spire.position.set(0, 0.9, -0.2);
        spire.castShadow = true;
        mon.add(spire);
        break;
      }
      case 'imperial':
      default: {
        // Level 100 Grand Imperial Capital — Gold-Domed Palace Complex + 4 Golden Spires
        const base = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(1.04, 0.46, 1.04)), wallMat);
        base.position.y = 0.44;
        base.castShadow = true;
        mon.add(base);
        const drum = new THREE.Mesh(
          this._trackGeo(new THREE.CylinderGeometry(0.46, 0.52, 0.44, 12)),
          wallMat
        );
        drum.position.y = 0.88;
        mon.add(drum);
        const dome = new THREE.Mesh(this._trackGeo(new THREE.SphereGeometry(0.46, 12, 10)), goldMat);
        dome.position.y = 1.18;
        mon.add(dome);
        [
          [-0.48, -0.48],
          [0.48, -0.48],
          [-0.48, 0.48],
          [0.48, 0.48],
        ].forEach(([sx, sz]) => {
          const sp = new THREE.Mesh(this._trackGeo(new THREE.CylinderGeometry(0.07, 0.1, 0.92, 6)), wallMat);
          sp.position.set(sx, 0.68, sz);
          mon.add(sp);
          const tip = new THREE.Mesh(this._trackGeo(new THREE.ConeGeometry(0.11, 0.3, 6)), goldMat);
          tip.position.set(sx, 1.28, sz);
          mon.add(tip);
        });
        break;
      }
    }

    parent.add(mon);
  }

  /* ============================================================================
   * 4. INSTANCED WINDING DOTTED STONE & SEA-BUOY ROUTE (LEVELS 1 → 100)
   * ========================================================================== */
  _buildInstancedWindingRoute() {
    const stonePositions = [];
    const buoyPositions = [];

    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const perp = new THREE.Vector3();

    for (let i = 0; i < this.nodes.length - 1; i++) {
      const a = this.nodes[i];
      const b = this.nodes[i + 1];
      p0.copy(a.position);
      p1.copy(b.position);

      const dist = p0.distanceTo(p1);
      const rA = a.unlocked ? HERO_ISLAND_RADIUS : a.isMilestone ? MILESTONE_ISLAND_RADIUS : REGULAR_ISLAND_RADIUS;
      const rB = b.unlocked ? HERO_ISLAND_RADIUS : b.isMilestone ? MILESTONE_ISLAND_RADIUS : REGULAR_ISLAND_RADIUS;

      const clearDist = Math.max(0.8, dist - rA - rB);
      const steps = Math.max(2, Math.min(6, Math.round(clearDist / 0.72)));

      // Subtle organic bend perpendicular to the segment
      mid.addVectors(p0, p1).multiplyScalar(0.5);
      perp.set(-(p1.z - p0.z), 0, p1.x - p0.x).normalize();
      mid.addScaledVector(perp, (i % 2 === 0 ? 1 : -1) * Math.min(0.85, clearDist * 0.22));

      const curve = new THREE.QuadraticBezierCurve3(p0.clone(), mid.clone(), p1.clone());
      const tStart = Math.min(0.38, (rA + 0.35) / Math.max(dist, 0.1));
      const tEnd = Math.max(0.62, 1 - (rB + 0.35) / Math.max(dist, 0.1));

      const isUnlockedPath = a.unlocked && b.unlocked;
      const isMilestoneApproach = b.isMilestone;

      for (let s = 0; s < steps; s++) {
        const frac = steps === 1 ? 0.5 : s / (steps - 1);
        const t = THREE.MathUtils.lerp(tStart, tEnd, frac);
        const pt = curve.getPoint(t);
        stonePositions.push({
          x: pt.x,
          z: pt.z,
          rotY: (i * 1.1 + s * 0.7) % (Math.PI * 2),
          isUnlockedPath,
          isMilestoneApproach,
        });
        // Add small brass sea buoy cap on midpoint of milestone approaches
        if (isMilestoneApproach && s === Math.floor(steps * 0.5)) {
          buoyPositions.push({ x: pt.x, z: pt.z });
        }
      }
    }

    // 1 single InstancedMesh for ALL dotted route stepping stones across 100 levels!
    const stoneGeo = this._trackGeo(new THREE.CylinderGeometry(0.19, 0.24, 0.18, 7));
    const stoneInst = new THREE.InstancedMesh(
      stoneGeo,
      this.mats.instancedStone,
      stonePositions.length
    );
    stoneInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const colUnlocked = new THREE.Color('#e8c37a');
    const colMilestone = new THREE.Color('#f4cb66');
    const colSoon = new THREE.Color('#c5beaf');

    for (let i = 0; i < stonePositions.length; i++) {
      const sp = stonePositions[i];
      dummy.position.set(sp.x, 0.04, sp.z);
      dummy.rotation.set(0, sp.rotY, 0);
      const sc = sp.isUnlockedPath ? 1.12 : sp.isMilestoneApproach ? 1.08 : 0.92;
      dummy.scale.set(sc, 1, sc * 0.88);
      dummy.updateMatrix();
      stoneInst.setMatrixAt(i, dummy.matrix);
      stoneInst.setColorAt(
        i,
        sp.isUnlockedPath ? colUnlocked : sp.isMilestoneApproach ? colMilestone : colSoon
      );
    }
    stoneInst.instanceMatrix.needsUpdate = true;
    stoneInst.instanceColor.needsUpdate = true;
    this.root.add(stoneInst);

    // Golden sea-buoy beacons leading into every 10th Milestone City
    if (buoyPositions.length > 0) {
      const buoyGeo = this._trackGeo(new THREE.OctahedronGeometry(0.13, 0));
      const buoyInst = new THREE.InstancedMesh(
        buoyGeo,
        this.textures.materials.capstoneGold,
        buoyPositions.length
      );
      for (let i = 0; i < buoyPositions.length; i++) {
        dummy.position.set(buoyPositions[i].x, 0.24, buoyPositions[i].z);
        dummy.rotation.set(0, i * 0.8, 0);
        dummy.scale.set(1, 1.3, 1);
        dummy.updateMatrix();
        buoyInst.setMatrixAt(i, dummy.matrix);
      }
      buoyInst.instanceMatrix.needsUpdate = true;
      this.root.add(buoyInst);
    }
  }

  /* ============================================================================
   * 5. COASTAL BIOME REEFS & MINIATURE WOODEN SAILBOATS (INSTANCED)
   * ========================================================================== */
  _buildCoastalDecorAndSailboats() {
    // Decorative coastal rock islets hugging the East & West wooden board borders (far from nodes)
    const rockCoords = [];
    for (let c = 0; c < 10; c++) {
      const ch = WORLD_CHAPTERS[c];
      const zBase = this.chapterBounds[c].centerZ;
      for (let r = 0; r < 4; r++) {
        const side = r % 2 === 0 ? -1 : 1;
        const rx = side * (9.7 + ((c * 7 + r * 3) % 4) * 0.35);
        const rz = zBase + (r - 1.5) * 4.1;
        // Verify clear distance from all level nodes
        let clear = true;
        for (let n = 0; n < this.nodes.length; n++) {
          const dx = this.nodes[n].position.x - rx;
          const dz = this.nodes[n].position.z - rz;
          if (dx * dx + dz * dz < 6.5) {
            clear = false;
            break;
          }
        }
        if (clear) rockCoords.push({ x: rx, z: rz, ch, seed: c * 5 + r });
      }
    }

    if (rockCoords.length > 0) {
      const rockGeo = this._trackGeo(new THREE.DodecahedronGeometry(0.55, 0));
      const rockInst = new THREE.InstancedMesh(rockGeo, this.mats.instancedGround, rockCoords.length);
      const dummy = new THREE.Object3D();
      const tmpColor = new THREE.Color();

      for (let i = 0; i < rockCoords.length; i++) {
        const rc = rockCoords[i];
        dummy.position.set(rc.x, 0.02, rc.z);
        dummy.rotation.set(0, rc.seed * 1.1, 0);
        dummy.scale.set(1.1 + (rc.seed % 3) * 0.25, 0.45, 0.95 + (rc.seed % 2) * 0.25);
        dummy.updateMatrix();
        rockInst.setMatrixAt(i, dummy.matrix);
        tmpColor.set(rc.ch.groundHex).multiplyScalar(0.84);
        rockInst.setColorAt(i, tmpColor);
      }
      rockInst.instanceMatrix.needsUpdate = true;
      rockInst.instanceColor.needsUpdate = true;
      this.root.add(rockInst);
    }

    // 8 charming miniature wooden explorer sailboats gently bobbing along the 100-level ocean
    const hullGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.14, 0.68));
    const sailGeo = this._trackGeo(new THREE.ConeGeometry(0.28, 0.56, 3));
    for (let s = 0; s < 8; s++) {
      const z = 79 - s * 22.5;
      const x = s % 2 === 0 ? 8.8 : -8.8;
      const boat = new THREE.Group();
      boat.position.set(x, 0.06, z);
      boat.rotation.y = s % 2 === 0 ? -0.35 : 0.42;

      const hull = new THREE.Mesh(hullGeo, this.textures.materials.timber);
      hull.position.y = 0.05;
      boat.add(hull);

      const sail = new THREE.Mesh(sailGeo, this.mats.sailCanvas);
      sail.position.set(0, 0.42, 0.04);
      sail.rotation.y = Math.PI * 0.5;
      boat.add(sail);

      this.root.add(boat);
      this.sailboats.push({ obj: boat, baseZ: z, phase: s * 1.4 });
    }
  }

  _buildSelectionRing() {
    const geo = this._trackGeo(new THREE.RingGeometry(1.16, 1.38, 28));
    geo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(geo, this.mats.selectRing);
    ring.position.y = 0.12;
    ring.visible = false;
    this.root.add(ring);
    this.selectionRing = ring;
  }

  /* ============================================================================
   * 6. POOLED FRUSTUM- & DISTANCE-CULLED FLOATING HTML LABELS (60 FPS)
   * ========================================================================== */
  _initLabelPool() {
    if (!this.labelsLayer) return;
    this.labelsLayer.innerHTML = '';
    this.labelPool = [];

    for (let i = 0; i < LABEL_POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'map-node-label';
      el._boundNodeId = null;
      el._boundSelected = false;
      el._visible = false;
      this.labelsLayer.appendChild(el);
      this.labelPool.push(el);
    }
  }

  setLabelsVisible(visible) {
    this.labelsVisible = Boolean(visible);
    if (!this.labelsLayer) return;
    this.labelsLayer.hidden = !this.labelsVisible;
    if (!this.labelsVisible) {
      for (let i = 0; i < this.labelPool.length; i++) {
        const el = this.labelPool[i];
        if (el._visible) {
          el.style.transform = 'translate3d(-9999px, -9999px, 0)';
          el._visible = false;
        }
      }
    }
  }

  _updateCulledLabels(camera) {
    if (!this.labelsVisible || !this.labelsLayer || !camera || this.labelPool.length === 0) return;

    const vw = window.innerWidth || 390;
    const vh = window.innerHeight || 844;

    // Build frustum once per frame
    this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    const camPos = camera.position;
    const targetPos = this.cameraController.target;
    const candidates = this._visibleCandidates;
    candidates.length = 0;

    // Frustum + distance cull all 100 nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const anchor = n.labelAnchor;
      const isSelected = this.selectedNode === n;

      // Fast Z distance pre-filter relative to camera target before full frustum check
      const dzTarget = Math.abs(anchor.z - targetPos.z);
      const maxTargetZ = n.unlocked || n.isMilestone ? 34 : 22;
      if (!isSelected && dzTarget > maxTargetZ) continue;

      const distSq = camPos.distanceToSquared(anchor);
      const maxDistSq = isSelected ? 9000 : n.unlocked || n.isMilestone ? 4200 : 2400;
      if (distSq > maxDistSq) continue;

      if (!this._frustum.containsPoint(anchor)) continue;

      // Project to viewport coordinates
      this._projVec.copy(anchor).project(camera);
      if (this._projVec.z < -1 || this._projVec.z > 1) continue;

      const sx = (this._projVec.x * 0.5 + 0.5) * vw;
      const sy = (-this._projVec.y * 0.5 + 0.5) * vh;

      // Keep clear of top HUD & bottom chapter jump bar
      if (sx < -24 || sx > vw + 24 || sy < 94 || sy > vh - 76) continue;

      const priority = isSelected ? 0 : n.unlocked ? 1 : n.isMilestone ? 2 : 3;
      candidates.push({ node: n, sx, sy, distSq, priority });
    }

    // Sort by priority (selected > playable > milestone > nearest regular)
    candidates.sort((a, b) => a.priority - b.priority || a.distSq - b.distSq);

    const activeCount = Math.min(candidates.length, this.labelPool.length);
    for (let i = 0; i < activeCount; i++) {
      const c = candidates[i];
      const n = c.node;
      const el = this.labelPool[i];
      const isSelected = this.selectedNode === n;

      if (el._boundNodeId !== n.id || el._boundSelected !== isSelected) {
        el._boundNodeId = n.id;
        el._boundSelected = isSelected;

        let cls = 'map-node-label';
        if (n.unlocked) cls += ' is-playable';
        else if (n.isMilestone) cls += ' is-milestone';
        else cls += ' is-soon';
        if (isSelected) cls += ' is-selected';
        el.className = cls;

        if (n.isMilestone) {
          el.innerHTML = `${n.labelText}<span class="map-node-soon-chip">Bientôt</span>`;
        } else {
          el.textContent = n.labelText;
        }
      }

      const halfMargin = n.isMilestone ? 104 : n.unlocked ? 78 : 68;
      const px = Math.round(THREE.MathUtils.clamp(c.sx, halfMargin, vw - halfMargin));
      const py = Math.round(c.sy);
      el.style.transform = `translate3d(${px}px, ${py}px, 0) translate3d(-50%, -100%, 0)`;
      el._visible = true;
    }

    // Park unused pooled elements offscreen
    for (let i = activeCount; i < this.labelPool.length; i++) {
      const el = this.labelPool[i];
      if (el._visible) {
        el.style.transform = 'translate3d(-9999px, -9999px, 0)';
        el._visible = false;
      }
    }
  }

  /* ============================================================================
   * 7. INTERACTION HOOKS & CHAPTER JUMP NAVIGATION
   * ========================================================================== */
  _collectHitTargets() {
    // Flat array of 100 lightweight invisible cylinders (0 draw calls, <0.15ms raycast on tap)
    this.hitTargets = this.nodes.map((n) => n.hitbox);
  }

  getHitTargets() {
    return this.hitTargets;
  }

  getChapterMeta(chapterIndex) {
    return WORLD_CHAPTERS[THREE.MathUtils.clamp(chapterIndex, 0, WORLD_CHAPTERS.length - 1)];
  }

  getChapterIndexForZ(z) {
    if (this.selectedNode && this.selectedNode.chapter) {
      return this.selectedNode.chapter.index;
    }
    for (let i = 0; i < this.chapterBounds.length; i++) {
      const b = this.chapterBounds[i];
      if (z <= b.maxZ + 0.8 && z >= b.minZ - 0.8) {
        return i;
      }
    }
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.chapterBounds.length; i++) {
      const d = Math.abs(this.chapterBounds[i].centerZ - z);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  jumpToChapter(chapterIndex) {
    const idx = THREE.MathUtils.clamp(chapterIndex, 0, this.chapterBounds.length - 1);
    const b = this.chapterBounds[idx];
    this.selectedNode = null;
    if (this.selectionRing) this.selectionRing.visible = false;
    if (this.onClearSelection) this.onClearSelection();

    const focusZ = idx === 0 ? 77.6 : b.centerZ;
    this.cameraController.flyTo({
      target: new THREE.Vector3(0.0, 0.25, focusZ),
      distance: idx === 0 ? 37.5 : 35.5,
      elevationDeg: 52,
      azimuth: 0.05,
    });
    return WORLD_CHAPTERS[idx];
  }

  onMapNodeTap(node) {
    if (!node) return;
    this.selectedNode = node;
    node.bounceTime = 0.42;

    if (this.selectionRing) {
      if (!node.unlocked && !node.isMilestone) {
        this.selectionRing.position.set(node.position.x, 0.12, node.position.z);
        this.selectionRing.visible = true;
      } else {
        this.selectionRing.visible = false;
      }
    }

    this.audio.playMapTap(!node.unlocked);
    this.audio.playCameraWhoosh();

    this.cameraController.flyTo({
      target: new THREE.Vector3(node.position.x, 0.55, node.position.z + 0.3),
      distance: node.focusDistance,
      elevationDeg: node.focusElevation,
      azimuth: node.focusAzimuth,
    });

    if (this.onSelectNode) {
      this.onSelectNode(node);
    }
  }

  onEmptyGroundTap() {
    if (!this.selectedNode) return;
    this.selectedNode = null;
    if (this.selectionRing) this.selectionRing.visible = false;
    this.audio.playCameraWhoosh();
    // Gently pull back camera in-place without jumping back to Level 1
    this.cameraController.flyTo({
      target: this.cameraController.target.clone(),
      distance: 36.0,
      elevationDeg: 52,
      azimuth: 0.05,
    });
    if (this.onClearSelection) {
      this.onClearSelection();
    }
  }

  /* ============================================================================
   * 8. PER-FRAME ANIMATION & CLEAN DISPOSAL
   * ========================================================================== */
  update(dt, elapsed, camera = null) {
    // 1. Scroll turquoise ocean normal ripples & gentle wave swell (793 verts -> <0.1ms)
    if (this.textures.maps.waterNormal) {
      this.textures.maps.waterNormal.offset.x = (elapsed * 0.025) % 1;
      this.textures.maps.waterNormal.offset.y = (elapsed * 0.016) % 1;
    }

    if (this.oceanGeo) {
      const pos = this.oceanGeo.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < pos.count; i++) {
        const idx = i * 3;
        const x = arr[idx];
        const z = arr[idx + 2];
        arr[idx + 1] =
          Math.sin(x * 0.55 + elapsed * 1.4) * 0.042 +
          Math.cos(z * 0.35 - elapsed * 1.1) * 0.036;
      }
      pos.needsUpdate = true;
    }

    // 2. Pulsing golden base rings around all 4 unlocked playable islands
    for (let i = 0; i < this.unlockedRings.length; i++) {
      const r = this.unlockedRings[i];
      const isSelected = this.selectedNode && this.selectedNode.id === r.nodeId;
      const selectedBoost = isSelected ? 1.07 : 1.0;
      const pulse = 1 + Math.sin(elapsed * 3.1 + r.phase) * 0.035;
      r.ringMesh.scale.set(pulse * selectedBoost, 1, r.ratioZ * pulse * selectedBoost);

      const haloPhase = (elapsed * 0.45 + r.phase * 0.25) % 1;
      const haloPulse = 1 + haloPhase * 0.16;
      r.haloMesh.scale.set(haloPulse, 1, r.ratioZ * haloPulse);
    }
    if (this.unlockedRings.length > 0) {
      this.mats.goldRing.opacity = 0.72 + Math.sin(elapsed * 3.1) * 0.22;
      this.mats.goldHalo.opacity = (1 - ((elapsed * 0.45) % 1)) * 0.42;
    }

    // 3. Pulsing golden-crowned beacon rings around all 10 Milestone Village/City islands
    for (let i = 0; i < this.milestoneRings.length; i++) {
      const r = this.milestoneRings[i];
      const isSelected = this.selectedNode && this.selectedNode.id === r.nodeId;
      const boost = isSelected ? 1.08 : 1.0;
      const pulse = 1 + Math.sin(elapsed * 2.4 + r.phase) * 0.03;
      r.ringMesh.scale.set(pulse * boost, 1, r.ratioZ * pulse * boost);

      const haloPhase = (elapsed * 0.36 + r.phase * 0.2) % 1;
      const haloPulse = 1 + haloPhase * 0.15;
      r.haloMesh.scale.set(haloPulse, 1, r.ratioZ * haloPulse);
    }
    this.mats.milestoneRing.opacity = 0.68 + Math.sin(elapsed * 2.4) * 0.2;
    this.mats.milestoneHalo.opacity = (1 - ((elapsed * 0.36) % 1)) * 0.34;

    // Selection ring pulse for tapped regular "Bientôt" islands
    if (this.selectionRing && this.selectionRing.visible) {
      const s = 1 + Math.sin(elapsed * 4.5) * 0.06;
      this.selectionRing.scale.set(s, 1, s * 0.92);
    }

    // 4. Soft breathing shoreline foam around hero & milestone islands
    for (let i = 0; i < this.shoreRings.length; i++) {
      const sr = this.shoreRings[i];
      const s = 1 + Math.sin(elapsed * 2.0 + sr.phase) * 0.024;
      sr.mesh.scale.set(sr.baseSX * s, 1, sr.baseSZ * s);
    }

    // 5. Gentle breeze on miniature palms, bamboo, and spinning Milestone golden crests
    for (let i = 0; i < this.animatedProps.length; i++) {
      const p = this.animatedProps[i];
      if (p.type === 'spin') {
        p.obj.rotation.y = elapsed * 1.15 + p.phase;
        p.obj.position.y = 2.38 + Math.sin(elapsed * 2.2 + p.phase) * 0.08;
      } else {
        p.obj.rotation.z = Math.sin(elapsed * 1.6 + p.phase) * 0.05;
      }
    }

    // 6. Gentle bobbing & Z-horizon culling of coastal wooden explorer sailboats
    const targetZ = this.cameraController.target.z;
    for (let i = 0; i < this.sailboats.length; i++) {
      const b = this.sailboats[i];
      const near = Math.abs(b.baseZ - targetZ) < 76;
      b.obj.visible = near;
      if (!near) continue;
      b.obj.position.y = 0.05 + Math.sin(elapsed * 1.9 + b.phase) * 0.035;
      b.obj.rotation.z = Math.sin(elapsed * 1.5 + b.phase) * 0.07;
    }

    // 7. Z-horizon culling + tactile tap bounce on hero & milestone islands (slashes draw calls!)
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (!n.group) continue;
      const inRange = Math.abs(n.position.z - targetZ) < 74;
      n.group.visible = inRange;
      if (!inRange) continue;
      if (n.bounceTime > 0) {
        n.bounceTime = Math.max(0, n.bounceTime - dt);
        const t = 1 - n.bounceTime / 0.42;
        n.group.position.y = Math.sin(t * Math.PI) * 0.2;
      } else {
        n.group.position.y = Math.sin(elapsed * 1.25 + n.levelNum * 0.7) * 0.022;
      }
    }

    // 8. Update frustum- & distance-culled pooled HTML floating labels
    if (camera) {
      this._updateCulledLabels(camera);
    }
  }

  dispose() {
    this.setLabelsVisible(false);
    if (this.labelsLayer) {
      this.labelsLayer.innerHTML = '';
    }
    this.labelPool.length = 0;
    this.nodes.length = 0;
    this.hitTargets.length = 0;
    this.animatedProps.length = 0;
    this.shoreRings.length = 0;
    this.unlockedRings.length = 0;
    this.milestoneRings.length = 0;
    this.sailboats.length = 0;
    this.selectedNode = null;

    // Reset shared waterNormal repeat cleanly for level scenes
    if (this.textures.maps.waterNormal) {
      this.textures.maps.waterNormal.repeat.set(1, 1);
    }

    this.scene.remove(this.root);

    this.ownedGeometries.forEach((g) => g.dispose());
    this.ownedMaterials.forEach((m) => m.dispose());
    this.ownedTextures.forEach((t) => t.dispose());
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.ownedTextures.length = 0;
  }
}
