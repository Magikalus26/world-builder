/**
 * Workd Builder — Cozy Diorama Ground Foliage, Contact AO Shadows & Stylized Biome Trees
 * Outlanders / Pocket Build inspired hand-crafted mobile aesthetic locked at 60 FPS on iPhone Safari:
 *  - Single-draw-call 3D Instanced Grass (800–1200 3-blade stylized tufts) with GPU vertex wind sway
 *  - Single-draw-call Instanced Flat Pebbles & Discreet Wildflower Clusters (white/yellow)
 *  - Single-draw-call Soft Circular Contact Shadows (Ambient Occlusion) under trees, rocks & buildings
 *  - Stylized Organic Trees with irregular deformed foliage volumes, vertical cool-to-warm color gradients,
 *    thickened flared trunks with exposed roots, and gentle breeze sway.
 */

import * as THREE from 'three';
import { applyCrispTextureSettings } from './graphicsCore.js';

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z, seed = 13) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return n - Math.floor(n);
}

/* ============================================================================
 * 1. VERTEX-COLORED VERTICAL FOLIAGE GRADIENT & DEFORMED ORGANIC GEOMETRIES
 * ========================================================================== */

/**
 * Applies a vertical color gradient across a geometry's local Y bounds:
 * cool, deeper shaded base -> vibrant mid -> warm, sunlit luminous crown.
 */
export function applyVerticalFoliageGradient(geometry, baseHex, midHex, topHex) {
  const pos = geometry.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(maxY - minY, 0.001);

  const cBase = new THREE.Color(baseHex);
  const cMid = new THREE.Color(midHex);
  const cTop = new THREE.Color(topHex);
  const tmp = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = THREE.MathUtils.clamp((y - minY) / span, 0, 1);
    // Subtle organic sun-facing warmth bias (+x, +z)
    const sunBias = THREE.MathUtils.clamp((x * 0.12 + z * 0.1), -0.08, 0.08);
    const t = THREE.MathUtils.clamp(ny + sunBias, 0, 1);

    if (t < 0.5) {
      tmp.copy(cBase).lerp(cMid, t * 2.0);
    } else {
      tmp.copy(cMid).lerp(cTop, (t - 0.5) * 2.0);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Creates a stylized, irregularly deformed icosphere foliage cushion (non-spherical,
 * hand-sculpted soft-faceted Outlanders look) with vertical cool-to-warm vertex color gradient.
 */
export function createOrganicFoliageBlobGeo({
  radius = 0.58,
  detail = 1,
  squashY = 0.72,
  irregularity = 0.22,
  seed = 101,
  baseColor = '#214d2c',
  midColor = '#4a8538',
  topColor = '#8fc44c',
} = {}) {
  const baseGeo = new THREE.IcosahedronGeometry(radius, detail);
  const geo = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo;
  if (baseGeo.index) baseGeo.dispose();

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.max(Math.hypot(vx, vy, vz), 0.0001);
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;

    // Multi-lobe organic sculpting noise so silhouette feels hand-carved, never spherical
    const lobe1 = Math.sin(nx * 3.2 + seed * 0.7) * Math.cos(nz * 3.1 - seed * 0.5);
    const lobe2 = Math.sin((nx + nz) * 4.5 + ny * 2.8 + seed * 1.3);
    const disp = 1.0 + (lobe1 * 0.6 + lobe2 * 0.4) * irregularity;

    // Slightly flatten bottom & puff top slightly for cozy diorama canopy posture
    const yScale = ny < 0 ? squashY * 0.86 : squashY * 1.06;
    pos.setXYZ(i, vx * disp, vy * disp * yScale, vz * disp);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  applyVerticalFoliageGradient(geo, baseColor, midColor, topColor);
  return geo;
}

/**
 * Creates an irregular, slightly asymmetric foliage tier for cypresses & western pines
 * (replaces smooth ConeGeometry with sculpted layered organic boughs).
 */
export function createIrregularConiferTierGeo({
  radiusBottom = 0.52,
  radiusTop = 0.1,
  height = 1.0,
  radialSegments = 9,
  heightSegments = 3,
  jaggedness = 0.19,
  droop = 0.08,
  seed = 42,
  baseColor = '#1e3e26',
  midColor = '#3c6833',
  topColor = '#7aa446',
} = {}) {
  const baseGeo = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments,
    false
  );
  const geo = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo;
  if (baseGeo.index) baseGeo.dispose();

  const pos = geo.attributes.position;
  const halfH = height * 0.5;
  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const t = THREE.MathUtils.clamp((vy + halfH) / height, 0, 1); // 0 bottom -> 1 top
    const ang = Math.atan2(vz, vx);
    const rad = Math.hypot(vx, vz);

    if (rad > 0.005) {
      // Scalloped bough lobes around the perimeter
      const wave =
        Math.sin(ang * 4.0 + seed + t * 1.7) * 0.55 +
        Math.cos(ang * 7.0 - seed * 1.4) * 0.45;
      const radialBoost = 1.0 + wave * jaggedness * (1.15 - t * 0.55);
      // Slight organic bulge in lower-mid section
      const profileBulge = 1.0 + Math.sin(t * Math.PI) * 0.14;
      vx *= radialBoost * profileBulge;
      vz *= radialBoost * profileBulge;
      // Gentle drooping bough tips near the skirt
      vy -= (1.0 - t) * Math.max(0, wave) * droop;
    } else if (t > 0.9) {
      // Slightly offset organic peak
      vx += Math.sin(seed) * 0.03;
      vz += Math.cos(seed) * 0.03;
    }

    pos.setXYZ(i, vx, vy, vz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  applyVerticalFoliageGradient(geo, baseColor, midColor, topColor);
  return geo;
}

/**
 * Shared matte foliage PBR material reading vertex colors (roughness 0.86, metalness 0).
 */
export function createMatteFoliageMaterial(options = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: options.roughness ?? 0.86,
    metalness: 0.0,
    flatShading: options.flatShading ?? true,
  });
}

/**
 * Builds a thickened, gently flared tree trunk with sculpted exposed surface roots gripping the ground.
 */
export function createRootedTrunk({
  height = 1.4,
  topR = 0.1,
  botR = 0.22,
  rootCount = 4,
  rootSpread = 0.36,
  rootHeight = 0.34,
  barkMat,
  leanX = 0,
  leanZ = 0,
  seed = 1,
  trackGeo = (g) => g,
}) {
  const group = new THREE.Group();

  // Tapered organic trunk with subtle flare at base
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(topR, botR, height, 7, 3));
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const t = (vy + height * 0.5) / height; // 0 bottom -> 1 top
    const flare = 1.0 + Math.pow(Math.max(0, 1.0 - t * 2.2), 2.0) * 0.42;
    const curveX = Math.sin(t * Math.PI * 0.85) * leanX;
    const curveZ = Math.sin(t * Math.PI * 0.85) * leanZ;
    pos.setXYZ(i, vx * flare + curveX, vy, vz * flare + curveZ);
  }
  pos.needsUpdate = true;
  trunkGeo.computeVertexNormals();

  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
  trunkMesh.position.y = height * 0.5;
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // Exposed surface root buttresses radiating from the flared collar into the terrain
  const rootGeo = trackGeo(new THREE.CylinderGeometry(botR * 0.22, botR * 0.54, rootSpread * 1.15, 5));
  for (let r = 0; r < rootCount; r++) {
    const ang = (r / rootCount) * Math.PI * 2 + (hash3(r, seed, 3) - 0.5) * 0.45;
    const root = new THREE.Mesh(rootGeo, barkMat);
    const dist = botR * 0.72 + rootSpread * 0.32;
    root.position.set(Math.cos(ang) * dist, rootHeight * 0.36, Math.sin(ang) * dist);
    root.rotation.order = 'YXZ';
    root.rotation.y = -ang + Math.PI * 0.5;
    root.rotation.x = 1.08 + (r % 2) * 0.08;
    root.scale.set(1.0, 0.88 + (r % 3) * 0.14, 0.82);
    root.castShadow = true;
    root.receiveShadow = true;
    group.add(root);
  }

  return group;
}

/* ============================================================================
 * 2. STYLIZED BIOME TREES (ROME CYPRESS & PINE, MAYA CEIBA, JAPAN SAKURA, WEST PINE)
 * ========================================================================== */

/**
 * Rome Biome: Sculpted irregular Mediterranean Cypress with stacked slightly-tilted organic foliage strata,
 * exposed roots, and cool-shaded-base to warm-sunlit-tip vertical gradient.
 */
export function buildStylizedRomanCypress({
  x,
  z,
  groundY,
  scale = 1.0,
  seed = 1,
  barkMat,
  foliageMat,
  trackGeo = (g) => g,
}) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.scale.setScalar(scale);

  const trunk = createRootedTrunk({
    height: 0.72,
    topR: 0.085,
    botR: 0.16,
    rootCount: 4,
    rootSpread: 0.28,
    rootHeight: 0.22,
    barkMat,
    leanX: Math.sin(seed) * 0.04,
    leanZ: Math.cos(seed) * 0.03,
    seed,
    trackGeo,
  });
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 0.55;

  // 4 stacked irregular, slightly offset & tilted foliage tiers forming a lively Tuscan cypress silhouette
  const strata = [
    { rb: 0.46, rt: 0.32, h: 0.92, y: 0.44, ox: 0.03, oz: -0.02, tiltX: 0.05, tiltZ: -0.04, b: '#1d4026', m: '#346331', t: '#659440' },
    { rb: 0.4, rt: 0.26, h: 0.96, y: 1.08, ox: -0.03, oz: 0.03, tiltX: -0.04, tiltZ: 0.06, b: '#22492a', m: '#3f7336', t: '#75a648' },
    { rb: 0.31, rt: 0.16, h: 0.88, y: 1.72, ox: 0.02, oz: 0.02, tiltX: 0.05, tiltZ: -0.05, b: '#29552f', m: '#4c843c', t: '#88b852' },
    { rb: 0.2, rt: 0.03, h: 0.72, y: 2.26, ox: -0.015, oz: -0.015, tiltX: -0.04, tiltZ: 0.04, b: '#336635', m: '#5d9543', t: '#9fcb5d' },
  ];

  strata.forEach((s, i) => {
    const geo = trackGeo(
      createIrregularConiferTierGeo({
        radiusBottom: s.rb,
        radiusTop: s.rt,
        height: s.h,
        radialSegments: 9,
        heightSegments: 3,
        jaggedness: 0.2,
        droop: 0.07,
        seed: seed * 11 + i * 7.3,
        baseColor: s.b,
        midColor: s.m,
        topColor: s.t,
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.position.set(s.ox * Math.cos(seed + i), s.y, s.oz * Math.sin(seed + i));
    mesh.rotation.set(s.tiltX, seed * 0.8 + i * 1.1, s.tiltZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  tree.add(crown);
  return { tree, crown };
}

/**
 * Rome Biome Accent: Sculpted Tuscan Stone Pine (Pinus pinea) with umbrella-like irregular puffy canopy.
 */
export function buildStylizedRomanStonePine({
  x,
  z,
  groundY,
  scale = 1.0,
  seed = 1,
  barkMat,
  foliageMat,
  trackGeo = (g) => g,
}) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.scale.setScalar(scale);

  const trunk = createRootedTrunk({
    height: 1.85,
    topR: 0.11,
    botR: 0.22,
    rootCount: 4,
    rootSpread: 0.34,
    rootHeight: 0.28,
    barkMat,
    leanX: Math.sin(seed * 2.1) * 0.12,
    leanZ: Math.cos(seed * 1.7) * 0.08,
    seed,
    trackGeo,
  });
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(Math.sin(seed * 2.1) * 0.08, 1.82, Math.cos(seed * 1.7) * 0.06);

  const puffs = [
    [0, 0.26, 0, 1.05, 0.52, 0.98],
    [-0.56, 0.08, 0.24, 0.72, 0.44, 0.68],
    [0.54, 0.12, -0.22, 0.7, 0.42, 0.72],
    [0.14, 0.06, 0.54, 0.64, 0.4, 0.62],
    [-0.2, 0.14, -0.52, 0.66, 0.42, 0.64],
  ];

  puffs.forEach(([px, py, pz, sx, sy, sz], i) => {
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: 0.66,
        detail: 1,
        squashY: 0.62,
        irregularity: 0.24,
        seed: seed * 17 + i * 5.7,
        baseColor: '#214c2b',
        midColor: '#487f39',
        topColor: '#98c452',
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0.08 * (i % 2 ? 1 : -1), i * 1.3 + seed, 0.06 * (i % 3 - 1));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  tree.add(crown);
  return { tree, crown };
}

/**
 * Maya Biome: Sculpted Ceiba Jungle Tree with multi-layered irregular organic foliage cushions,
 * wide flared buttress roots, and cool-emerald-base to warm-sunlit-chartreuse vertical gradient.
 */
export function buildStylizedCeibaTree({
  x,
  z,
  groundY,
  scale = 1.0,
  seed = 1,
  barkMat,
  foliageMat,
  trackGeo = (g) => g,
}) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.06, z);
  tree.scale.setScalar(scale);

  const trunk = createRootedTrunk({
    height: 1.75,
    topR: 0.14,
    botR: 0.29,
    rootCount: 5,
    rootSpread: 0.48,
    rootHeight: 0.42,
    barkMat,
    leanX: (seed % 2 === 0 ? 1 : -1) * 0.09,
    leanZ: Math.cos(seed) * 0.06,
    seed,
    trackGeo,
  });
  tree.add(trunk);

  // Two short angled upper limbs supporting the wide umbrella canopy
  const limbGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.11, 0.72, 5));
  [-1, 1].forEach((dir) => {
    const limb = new THREE.Mesh(limbGeo, barkMat);
    limb.position.set(dir * 0.34, 1.56, dir * 0.12);
    limb.rotation.z = -dir * 0.58;
    limb.rotation.x = dir * 0.22;
    limb.castShadow = true;
    tree.add(limb);
  });

  const crown = new THREE.Group();
  crown.position.set((seed % 2 === 0 ? 1 : -1) * 0.06, 1.74, 0);

  const clusters = [
    [0.0, 0.36, 0.0, 1.18, 0.68, 1.12, '#174d2c', '#2f823a', '#7bc747'],
    [-0.72, 0.08, 0.26, 0.88, 0.56, 0.82, '#154428', '#2a7637', '#6ec042'],
    [0.74, 0.14, -0.24, 0.84, 0.58, 0.88, '#19502e', '#35893d', '#84cc4c'],
    [0.18, 0.1, 0.68, 0.78, 0.52, 0.76, '#18492a', '#317f3a', '#76c245'],
    [-0.24, 0.18, -0.64, 0.82, 0.54, 0.78, '#164527', '#2c7938', '#72bf44'],
    [0.24, 0.52, 0.18, 0.62, 0.44, 0.58, '#236834', '#4a9e42', '#9cd856'],
  ];

  clusters.forEach(([px, py, pz, sx, sy, sz, cB, cM, cT], i) => {
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: 0.6,
        detail: 1,
        squashY: 0.72,
        irregularity: 0.26,
        seed: seed * 23 + i * 6.9,
        baseColor: cB,
        midColor: cM,
        topColor: cT,
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0.08 * (i % 2 ? 1 : -1), i * 1.15 + seed, 0.07 * ((i % 3) - 1));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  tree.add(crown);
  return { tree, crown };
}

/**
 * Japan Biome: Sculpted Cherry Blossom (Sakura) Tree with irregular deformed blossom puffs,
 * cool rosy-plum shadow underside -> luminous warm pale-pink/cream sunlit crown, & gnarled rooted trunk.
 */
export function buildStylizedSakuraTree({
  x,
  z,
  groundY,
  scale = 1.0,
  seed = 1,
  barkMat,
  foliageMat,
  trackGeo = (g) => g,
}) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.scale.setScalar(scale);

  const trunk = createRootedTrunk({
    height: 1.48,
    topR: 0.11,
    botR: 0.21,
    rootCount: 4,
    rootSpread: 0.36,
    rootHeight: 0.3,
    barkMat,
    leanX: (seed % 2 === 0 ? 1 : -1) * 0.13,
    leanZ: Math.sin(seed * 1.4) * 0.06,
    seed,
    trackGeo,
  });
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.set((seed % 2 === 0 ? 1 : -1) * 0.09, 1.46, 0);

  const puffs = [
    [0.0, 0.38, 0.0, 1.08, 0.72, 1.04],
    [-0.58, 0.1, 0.28, 0.86, 0.62, 0.84],
    [0.6, 0.16, -0.22, 0.84, 0.6, 0.88],
    [0.16, 0.12, 0.56, 0.78, 0.56, 0.78],
    [-0.24, 0.2, -0.54, 0.8, 0.58, 0.8],
    [0.12, 0.56, -0.1, 0.6, 0.48, 0.6],
  ];

  puffs.forEach(([px, py, pz, sx, sy, sz], i) => {
    const geo = trackGeo(
      createOrganicFoliageBlobGeo({
        radius: 0.54,
        detail: 1,
        squashY: 0.76,
        irregularity: 0.24,
        seed: seed * 19 + i * 4.7,
        baseColor: '#c46c8e',
        midColor: '#f2a4be',
        topColor: '#ffe5ee',
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0.06 * (i % 2 ? 1 : -1), i * 1.2 + seed, 0.06 * ((i % 3) - 1));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  tree.add(crown);
  return { tree, crown };
}

/**
 * Penitentiary 1800 Biome: Sculpted Western Ponderosa Pine with irregular jagged tilted bough tiers,
 * exposed roots, and cool deep-evergreen underside -> sunlit dusty-olive top gradient.
 */
export function buildStylizedFrontierPine({
  x,
  z,
  groundY,
  scale = 1.0,
  seed = 1,
  barkMat,
  foliageMat,
  trackGeo = (g) => g,
}) {
  const tree = new THREE.Group();
  tree.position.set(x, groundY - 0.05, z);
  tree.scale.setScalar(scale);

  const trunk = createRootedTrunk({
    height: 1.28,
    topR: 0.08,
    botR: 0.17,
    rootCount: 4,
    rootSpread: 0.3,
    rootHeight: 0.24,
    barkMat,
    leanX: Math.sin(seed * 1.9) * 0.05,
    leanZ: Math.cos(seed * 1.3) * 0.04,
    seed,
    trackGeo,
  });
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 1.0;

  const tiers = [
    { rb: 0.66, rt: 0.22, h: 0.92, y: 0.38, ox: 0.02, oz: -0.02, tiltX: 0.05, tiltZ: -0.05, b: '#1f3624', m: '#3c5733', t: '#6b7e46' },
    { rb: 0.52, rt: 0.16, h: 0.84, y: 0.96, ox: -0.03, oz: 0.03, tiltX: -0.05, tiltZ: 0.06, b: '#253f29', m: '#46643a', t: '#7a8e4e' },
    { rb: 0.34, rt: 0.03, h: 0.72, y: 1.48, ox: 0.02, oz: 0.01, tiltX: 0.04, tiltZ: -0.04, b: '#2e4c31', m: '#547342', t: '#8da158' },
  ];

  tiers.forEach((t, i) => {
    const geo = trackGeo(
      createIrregularConiferTierGeo({
        radiusBottom: t.rb,
        radiusTop: t.rt,
        height: t.h,
        radialSegments: 8,
        heightSegments: 3,
        jaggedness: 0.24,
        droop: 0.1,
        seed: seed * 13 + i * 8.1,
        baseColor: t.b,
        midColor: t.m,
        topColor: t.t,
      })
    );
    const mesh = new THREE.Mesh(geo, foliageMat);
    mesh.position.set(t.ox, t.y, t.oz);
    mesh.rotation.set(t.tiltX, seed * 0.7 + i * 1.35, t.tiltZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    crown.add(mesh);
  });

  tree.add(crown);
  return { tree, crown };
}

/* ============================================================================
 * 3. SOFT CIRCULAR CONTACT SHADOWS (AMBIENT OCCLUSION UNDER TREES/ROCKS/BUILDINGS)
 * ========================================================================== */

let _contactShadowTex = null;
function getContactShadowTexture() {
  if (_contactShadowTex) return _contactShadowTex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0.0, 'rgba(18, 24, 12, 0.46)');
  g.addColorStop(0.45, 'rgba(20, 26, 14, 0.26)');
  g.addColorStop(0.78, 'rgba(22, 28, 16, 0.08)');
  g.addColorStop(1.0, 'rgba(22, 28, 16, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _contactShadowTex = applyCrispTextureSettings(new THREE.CanvasTexture(c), { isColor: true, wrap: false });
  return _contactShadowTex;
}

/**
 * Single-draw-call InstancedMesh rendering soft circular ambient-occlusion contact shadows
 * conforming to the sculpted terrain slope beneath trees, rocks, and buildings.
 */
export function createContactShadowSystem(parent, entries, getTerrainHeight) {
  if (!entries || entries.length === 0) {
    return { mesh: null, dispose() {} };
  }

  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, entries.length);
  mesh.name = 'CozyContactAOShadows';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const qSlope = new THREE.Quaternion();
  const cTint = new THREE.Color();

  entries.forEach((e, idx) => {
    const x = e.x;
    const z = e.z;
    const y = getTerrainHeight(x, z);

    // Estimate smooth local terrain normal so contact shadow hugs slopes without clipping
    const eps = 0.28;
    const hx = getTerrainHeight(x + eps, z) - getTerrainHeight(x - eps, z);
    const hz = getTerrainHeight(x, z + eps) - getTerrainHeight(x, z - eps);
    normal.set(-hx, 2 * eps, -hz).normalize();
    qSlope.setFromUnitVectors(up, normal);

    dummy.position.set(x, y + (e.yOffset ?? 0.026), z);
    dummy.quaternion.copy(qSlope);
    const rx = e.radiusX ?? e.radius ?? 1.0;
    const rz = e.radiusZ ?? e.radius ?? 1.0;
    dummy.scale.set(rx * 2, 1, rz * 2);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);

    const strength = THREE.MathUtils.clamp(e.strength ?? 1.0, 0.3, 1.2);
    cTint.setRGB(strength, strength, strength);
    mesh.setColorAt(idx, cTint);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  parent.add(mesh);

  return {
    mesh,
    dispose() {
      parent.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}

/* ============================================================================
 * 4. 3D INSTANCED GRASS (800–1200 TUFTS, 3 BLADES EACH), PEBBLES & FLOWERS
 * ========================================================================== */

/**
 * Builds 1 stylized 3-blade curved grass tuft BufferGeometry with vertical vertex color gradient
 * (velvety shaded moss root -> bright warm meadow tip). Only 9 triangles total per tuft!
 */
function buildThreeBladeTuftGeometry() {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  // 3 stylized arched blades splayed at ~120 deg intervals with varied height & lean
  const blades = [
    { angle: 0.12, h: 0.26, w: 0.068, lean: 0.105, offset: 0.016 },
    { angle: 2.22, h: 0.21, w: 0.062, lean: 0.115, offset: 0.018 },
    { angle: 4.35, h: 0.24, w: 0.064, lean: 0.095, offset: 0.016 },
  ];

  // Bright velvet luminance ramp (multiplies cleanly with biome instanceColor without turning dark)
  const cRoot = new THREE.Color('#92ad74');
  const cMid = new THREE.Color('#d4e8aa');
  const cTip = new THREE.Color('#ffffff');

  let vOffset = 0;
  blades.forEach((b) => {
    const cosA = Math.cos(b.angle);
    const sinA = Math.sin(b.angle);
    const tx = -sinA;
    const tz = cosA;

    const ox = cosA * b.offset;
    const oz = sinA * b.offset;

    const hw0 = b.w * 0.5;
    const hw1 = b.w * 0.36;
    const midY = b.h * 0.54;
    const midLean = b.lean * 0.42;

    const verts = [
      [ox - tx * hw0, 0.0, oz - tz * hw0, cRoot],
      [ox + tx * hw0, 0.0, oz + tz * hw0, cRoot],
      [ox + cosA * midLean - tx * hw1, midY, oz + sinA * midLean - tz * hw1, cMid],
      [ox + cosA * midLean + tx * hw1, midY, oz + sinA * midLean + tz * hw1, cMid],
      [ox + cosA * b.lean, b.h, oz + sinA * b.lean, cTip],
    ];

    // Upward-facing stylized normals so grass catches warm skylight like Outlanders
    const nx = cosA * 0.18;
    const ny = 0.96;
    const nz = sinA * 0.18;

    verts.forEach(([px, py, pz, col]) => {
      positions.push(px, py, pz);
      normals.push(nx, ny, nz);
      colors.push(col.r, col.g, col.b);
    });

    indices.push(
      vOffset + 0, vOffset + 1, vOffset + 2,
      vOffset + 1, vOffset + 3, vOffset + 2,
      vOffset + 2, vOffset + 3, vOffset + 4
    );
    vOffset += 5;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds a flat, smooth irregular pebble geometry for instanced border stones.
 */
function buildFlatPebbleGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.11, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const jitter = 0.88 + hash3(x * 7, y * 7, z * 7, 51) * 0.28;
    pos.setXYZ(i, x * 1.18 * jitter, y * 0.42 * jitter, z * 0.95 * jitter);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a compact discreet wildflower geometry (tiny green stem + bright 5-petal blossom crown).
 */
function buildDiscreetFlowerGeometry() {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  const cStem = new THREE.Color('#7ca854');
  const cCenter = new THREE.Color('#fff099');
  const cPetal = new THREE.Color('#ffffff'); // Pure white tinted cleanly by instanceColor (white / yellow)

  let vOffset = 0;

  // Tiny crossed stem
  const sh = 0.17;
  const sw = 0.016;
  [0, Math.PI * 0.5].forEach((a) => {
    const c = Math.cos(a) * sw;
    const s = Math.sin(a) * sw;
    const pts = [
      [-c, 0, -s],
      [c, 0, s],
      [-c * 0.7, sh, -s * 0.7],
      [c * 0.7, sh, s * 0.7],
    ];
    pts.forEach(([px, py, pz]) => {
      positions.push(px, py, pz);
      normals.push(0, 1, 0);
      colors.push(cStem.r, cStem.g, cStem.b);
    });
    indices.push(vOffset, vOffset + 1, vOffset + 2, vOffset + 1, vOffset + 3, vOffset + 2);
    vOffset += 4;
  });

  // Crisp 5-petal stylized blossom disc facing skyward
  const centerIdx = vOffset;
  positions.push(0, sh + 0.022, 0);
  normals.push(0, 1, 0);
  colors.push(cCenter.r, cCenter.g, cCenter.b);
  vOffset += 1;

  const petals = 5;
  const outerR = 0.092;
  for (let p = 0; p < petals; p++) {
    const a0 = (p / petals) * Math.PI * 2;
    const a1 = ((p + 0.5) / petals) * Math.PI * 2;
    const a2 = ((p + 1.0) / petals) * Math.PI * 2;

    const p0 = vOffset;
    positions.push(Math.cos(a0) * outerR * 0.44, sh + 0.01, Math.sin(a0) * outerR * 0.44);
    normals.push(0, 1, 0);
    colors.push(cPetal.r, cPetal.g, cPetal.b);

    const p1 = vOffset + 1;
    positions.push(Math.cos(a1) * outerR, sh + 0.026, Math.sin(a1) * outerR);
    normals.push(0, 1, 0);
    colors.push(cPetal.r, cPetal.g, cPetal.b);

    const p2 = vOffset + 2;
    positions.push(Math.cos(a2) * outerR * 0.44, sh + 0.01, Math.sin(a2) * outerR * 0.44);
    normals.push(0, 1, 0);
    colors.push(cPetal.r, cPetal.g, cPetal.b);

    indices.push(centerIdx, p0, p1, centerIdx, p1, p2);
    vOffset += 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Creates a matte wind-swaying MeshStandardMaterial for instanced grass & flowers
 * with GPU vertex micro-breeze anchored strictly at y = 0 (zero CPU overhead!).
 */
function createWindSwayInstancedMaterial(uTimeUniform, windAmp = 0.055, cacheKey = 'cozy-grass-wind-v1') {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeUniform;
    shader.uniforms.uWindAmp = { value: windAmp };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindAmp;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float windMask = smoothstep(0.02, 0.24, position.y);
        vec2 instXZ = vec2(0.0);
        #ifdef USE_INSTANCING
          instXZ = instanceMatrix[3].xz;
        #endif
        float phase = instXZ.x * 0.65 + instXZ.y * 0.52;
        float swayX = sin(uTime * 1.55 + phase) * 0.72 + sin(uTime * 2.6 + phase * 1.9) * 0.28;
        float swayZ = cos(uTime * 1.25 + phase * 0.85) * 0.65;
        transformed.x += swayX * uWindAmp * windMask;
        transformed.z += swayZ * uWindAmp * 0.7 * windMask;`
      );

    // Prevent DoubleSide backface normal inversion so back-facing blades never turn dark!
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      normal = normalize(vNormal);`
    );
  };

  mat.customProgramCacheKey = () => `${cacheKey}-upnormal`;
  return mat;
}

/**
 * Generates the complete Cozy Mobile Diorama ground vegetation layer for any level:
 *  - 1 InstancedMesh of 800–1200 3-blade stylized grass tufts concentrated around trees,
 *    rocks, ponds/water rims, and terrain borders (strictly avoiding stone paths & buildings)
 *  - 1 InstancedMesh of flat border pebbles/stones
 *  - 1 InstancedMesh of discreet white & yellow wildflower groups
 *
 * Returns `{ root, grassMesh, pebbleMesh, flowerMesh, counts, update(elapsed), dispose() }`.
 */
export function createCozyGroundFoliageSystem({
  parent,
  getTerrainHeight,
  isBlocked = () => false,
  getGrassWeight = () => 1.0,
  focalPoints = [], // [{ x, z, radius, weight }] around trees, rocks, pond rim
  waterLevel = -1.5,
  halfW = 9.0,
  halfD = 9.0,
  grassCount = 960,
  pebbleCount = 110,
  flowerCount = 84,
  grassPalette = ['#689e3c', '#538534', '#7eb247', '#9cb848', '#487630'],
  pebblePalette = ['#9a968b', '#b5ad9c', '#7f7d77', '#c4b89f'],
  flowerPalette = ['#fffaf0', '#fff5dc', '#ffe262', '#ffd347'],
  seed = 1337,
} = {}) {
  const rng = seededRand(seed);
  const root = new THREE.Group();
  root.name = 'CozyGroundFoliage';
  const uTime = { value: 0 };

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();

  // Helper to check if a point is valid for grass/flowers (above water, not on path/building)
  const canPlaceFoliage = (x, z, minGrassWeight = 0.15) => {
    if (Math.abs(x) > halfW - 0.25 || Math.abs(z) > halfD - 0.25) return false;
    const y = getTerrainHeight(x, z);
    if (y < waterLevel + 0.09) return false;
    if (isBlocked(x, z)) return false;
    return getGrassWeight(x, z, y) >= minGrassWeight;
  };

  /* ------------------------------------------------------------------------
   * A. 3D INSTANCED GRASS TUFTS (1 draw call, ~850–1150 tufts of 3 blades)
   * ---------------------------------------------------------------------- */
  const grassSpots = [];
  const maxAttempts = grassCount * 7;

  // 1) ~58% concentrated organically around focal points (trees, rocks, pond rim)
  const focalTarget = Math.floor(grassCount * 0.58);
  if (focalPoints.length > 0) {
    let tries = 0;
    while (grassSpots.length < focalTarget && tries < maxAttempts) {
      tries++;
      const fp = focalPoints[Math.floor(rng() * focalPoints.length)];
      const ang = rng() * Math.PI * 2;
      const rMin = fp.innerRadius ?? 0.22;
      const rMax = fp.radius ?? 1.65;
      const dist = rMin + Math.pow(rng(), 0.72) * Math.max(0.25, rMax - rMin);
      const x = fp.x + Math.cos(ang) * dist;
      const z = fp.z + Math.sin(ang) * dist;
      if (!canPlaceFoliage(x, z, 0.12)) continue;
      grassSpots.push({ x, z, scaleBias: 0.92 + rng() * 0.45 });
    }
  }

  // 2) ~28% along lush outer island borders & scenic ridges
  const borderTarget = Math.floor(grassCount * 0.86);
  {
    let tries = 0;
    while (grassSpots.length < borderTarget && tries < maxAttempts) {
      tries++;
      let x, z;
      const side = Math.floor(rng() * 4);
      const edgeBand = 0.35 + Math.pow(rng(), 1.35) * 2.4;
      if (side === 0) {
        x = (rng() * 2 - 1) * (halfW - 0.35);
        z = -(halfD - edgeBand);
      } else if (side === 1) {
        x = (rng() * 2 - 1) * (halfW - 0.35);
        z = halfD - edgeBand;
      } else if (side === 2) {
        x = -(halfW - edgeBand);
        z = (rng() * 2 - 1) * (halfD - 0.35);
      } else {
        x = halfW - edgeBand;
        z = (rng() * 2 - 1) * (halfD - 0.35);
      }
      if (!canPlaceFoliage(x, z, 0.15)) continue;
      grassSpots.push({ x, z, scaleBias: 0.88 + rng() * 0.44 });
    }
  }

  // 3) Remaining ~14% scattered gently in tiny meadow pockets on open grassy areas
  {
    let tries = 0;
    while (grassSpots.length < grassCount && tries < maxAttempts) {
      tries++;
      const x = (rng() * 2 - 1) * (halfW - 0.4);
      const z = (rng() * 2 - 1) * (halfD - 0.4);
      if (!canPlaceFoliage(x, z, 0.32)) continue;
      grassSpots.push({ x, z, scaleBias: 0.78 + rng() * 0.36 });
    }
  }

  const grassGeo = buildThreeBladeTuftGeometry();
  const grassMat = createWindSwayInstancedMaterial(uTime, 0.052, 'cozy-grass-wind-v1');
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, Math.max(1, grassSpots.length));
  grassMesh.name = 'CozyInstancedGrass';
  grassMesh.castShadow = false;
  grassMesh.receiveShadow = true;
  grassMesh.frustumCulled = false;

  const paletteColors = grassPalette.map((hex) => new THREE.Color(hex));

  grassSpots.forEach((spot, i) => {
    const y = getTerrainHeight(spot.x, spot.z);
    dummy.position.set(spot.x, y - 0.018, spot.z);
    dummy.rotation.set(
      (rng() - 0.5) * 0.14,
      rng() * Math.PI * 2,
      (rng() - 0.5) * 0.14
    );
    const sx = spot.scaleBias * (0.85 + rng() * 0.34);
    const sy = spot.scaleBias * (0.82 + rng() * 0.48);
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);

    // Subtle meadow/moss/sunlit-gold tint variation per tuft
    const baseC = paletteColors[Math.floor(rng() * paletteColors.length)];
    cTmp.copy(baseC);
    cTmp.offsetHSL((rng() - 0.5) * 0.025, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.08);
    grassMesh.setColorAt(i, cTmp);
  });
  grassMesh.count = grassSpots.length;
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  root.add(grassMesh);

  /* ------------------------------------------------------------------------
   * B. FLAT INSTANCED PEBBLES & SMALL STONES ALONG BORDERS, PATHS & WATER
   * ---------------------------------------------------------------------- */
  const pebbleSpots = [];
  const pebbleTries = pebbleCount * 10;
  let pt = 0;
  while (pebbleSpots.length < pebbleCount && pt < pebbleTries) {
    pt++;
    let x, z;
    if (focalPoints.length > 0 && rng() < 0.65) {
      const fp = focalPoints[Math.floor(rng() * focalPoints.length)];
      const ang = rng() * Math.PI * 2;
      const dist = (fp.innerRadius ?? 0.3) + rng() * (fp.radius ?? 1.5);
      x = fp.x + Math.cos(ang) * dist;
      z = fp.z + Math.sin(ang) * dist;
    } else {
      x = (rng() * 2 - 1) * (halfW - 0.45);
      z = (rng() * 2 - 1) * (halfD - 0.45);
    }
    if (Math.abs(x) > halfW - 0.35 || Math.abs(z) > halfD - 0.35) continue;
    const y = getTerrainHeight(x, z);
    if (y < waterLevel + 0.04) continue;
    if (isBlocked(x, z)) continue;

    // Place small clusters of 2–3 pebbles together
    const clusterSize = Math.min(pebbleCount - pebbleSpots.length, 1 + Math.floor(rng() * 3));
    for (let k = 0; k < clusterSize; k++) {
      const px = x + (k === 0 ? 0 : (rng() - 0.5) * 0.36);
      const pz = z + (k === 0 ? 0 : (rng() - 0.5) * 0.36);
      if (Math.abs(px) > halfW - 0.3 || Math.abs(pz) > halfD - 0.3) continue;
      if (isBlocked(px, pz)) continue;
      pebbleSpots.push({ x: px, z: pz, sc: 0.62 + rng() * 0.78 });
    }
  }

  const pebbleGeo = buildFlatPebbleGeometry();
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });
  const pebbleMesh = new THREE.InstancedMesh(pebbleGeo, pebbleMat, Math.max(1, pebbleSpots.length));
  pebbleMesh.name = 'CozyInstancedPebbles';
  pebbleMesh.castShadow = false;
  pebbleMesh.receiveShadow = true;
  pebbleMesh.frustumCulled = false;

  const pebbleCols = pebblePalette.map((h) => new THREE.Color(h));
  pebbleSpots.forEach((p, i) => {
    const y = getTerrainHeight(p.x, p.z);
    dummy.position.set(p.x, y + 0.012, p.z);
    dummy.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
    dummy.scale.set(p.sc * (0.9 + rng() * 0.35), p.sc * (0.75 + rng() * 0.3), p.sc * (0.85 + rng() * 0.3));
    dummy.updateMatrix();
    pebbleMesh.setMatrixAt(i, dummy.matrix);

    cTmp.copy(pebbleCols[Math.floor(rng() * pebbleCols.length)]);
    cTmp.offsetHSL(0, 0, (rng() - 0.5) * 0.06);
    pebbleMesh.setColorAt(i, cTmp);
  });
  pebbleMesh.count = pebbleSpots.length;
  pebbleMesh.instanceMatrix.needsUpdate = true;
  if (pebbleMesh.instanceColor) pebbleMesh.instanceColor.needsUpdate = true;
  root.add(pebbleMesh);

  /* ------------------------------------------------------------------------
   * C. DISCREET WILDFLOWER CLUSTERS (WHITE & YELLOW) ON BORDERS & MEADOW EDGES
   * ---------------------------------------------------------------------- */
  const flowerSpots = [];
  if (flowerCount > 0) {
    let ft = 0;
    const maxFt = flowerCount * 12;
    while (flowerSpots.length < flowerCount && ft < maxFt) {
      ft++;
      let cx, cz;
      if (focalPoints.length > 0 && rng() < 0.55) {
        const fp = focalPoints[Math.floor(rng() * focalPoints.length)];
        const ang = rng() * Math.PI * 2;
        const dist = (fp.innerRadius ?? 0.35) + 0.25 + rng() * Math.max(0.4, (fp.radius ?? 1.6) - 0.2);
        cx = fp.x + Math.cos(ang) * dist;
        cz = fp.z + Math.sin(ang) * dist;
      } else {
        // Outer lush border ring
        const side = Math.floor(rng() * 4);
        const band = 0.55 + rng() * 2.1;
        if (side === 0) {
          cx = (rng() * 2 - 1) * (halfW - 0.6);
          cz = -(halfD - band);
        } else if (side === 1) {
          cx = (rng() * 2 - 1) * (halfW - 0.6);
          cz = halfD - band;
        } else if (side === 2) {
          cx = -(halfW - band);
          cz = (rng() * 2 - 1) * (halfD - 0.6);
        } else {
          cx = halfW - band;
          cz = (rng() * 2 - 1) * (halfD - 0.6);
        }
      }
      if (!canPlaceFoliage(cx, cz, 0.22)) continue;

      // Cozy bouquet of 3 to 5 discreet little flowers sharing a patch color tone
      const bouquetSize = Math.min(flowerCount - flowerSpots.length, 3 + Math.floor(rng() * 3));
      const colorHex = flowerPalette[Math.floor(rng() * flowerPalette.length)];
      for (let k = 0; k < bouquetSize; k++) {
        const fx = cx + (rng() - 0.5) * 0.42;
        const fz = cz + (rng() - 0.5) * 0.42;
        if (!canPlaceFoliage(fx, fz, 0.16)) continue;
        flowerSpots.push({ x: fx, z: fz, sc: 0.78 + rng() * 0.45, colorHex });
      }
    }
  }

  let flowerMesh = null;
  let flowerGeo = null;
  let flowerMat = null;
  if (flowerSpots.length > 0) {
    flowerGeo = buildDiscreetFlowerGeometry();
    flowerMat = createWindSwayInstancedMaterial(uTime, 0.044, 'cozy-flower-wind-v1');
    flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerSpots.length);
    flowerMesh.name = 'CozyInstancedFlowers';
    flowerMesh.castShadow = false;
    flowerMesh.receiveShadow = true;
    flowerMesh.frustumCulled = false;

    flowerSpots.forEach((f, i) => {
      const y = getTerrainHeight(f.x, f.z);
      dummy.position.set(f.x, y - 0.008, f.z);
      dummy.rotation.set((rng() - 0.5) * 0.18, rng() * Math.PI * 2, (rng() - 0.5) * 0.18);
      dummy.scale.setScalar(f.sc);
      dummy.updateMatrix();
      flowerMesh.setMatrixAt(i, dummy.matrix);

      cTmp.set(f.colorHex);
      flowerMesh.setColorAt(i, cTmp);
    });
    flowerMesh.instanceMatrix.needsUpdate = true;
    if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    root.add(flowerMesh);
  }

  parent.add(root);

  return {
    root,
    grassMesh,
    pebbleMesh,
    flowerMesh,
    counts: {
      grass: grassSpots.length,
      pebbles: pebbleSpots.length,
      flowers: flowerSpots.length,
    },
    update(elapsed) {
      uTime.value = elapsed;
    },
    dispose() {
      parent.remove(root);
      grassGeo.dispose();
      grassMat.dispose();
      pebbleGeo.dispose();
      pebbleMat.dispose();
      if (flowerGeo) flowerGeo.dispose();
      if (flowerMat) flowerMat.dispose();
    },
  };
}
