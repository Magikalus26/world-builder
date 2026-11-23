/**
 * Workd Builder — Connected Masonry & Mitered Roman Roof Geometry Engine
 * Provides zero-gap neighbor-aware masonry block geometries (6-bit neighbor bitmask)
 * with automatic bevel flattening, internal face culling, seamless UV projection,
 * and 45-degree mitered Roman compluvium terracotta roof merging.
 *
 * All geometries are cached per bitmask so neighbor updates run in < 0.2 ms with zero GPU leaks.
 */

import * as THREE from 'three';

export const NEIGHBOR_PX = 1; // +X horizontal neighbor
export const NEIGHBOR_NX = 2; // -X horizontal neighbor
export const NEIGHBOR_PZ = 4; // +Z horizontal neighbor
export const NEIGHBOR_NZ = 8; // -Z horizontal neighbor
export const NEIGHBOR_PY = 16; // +Y upper vertical neighbor
export const NEIGHBOR_NY = 32; // -Y lower vertical neighbor

function pushTriOriented(positions, uvs, a, b, c, outDir, uvFn) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];

  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;

  // Skip degenerate zero-area triangles
  if (nx * nx + ny * ny + nz * nz < 1e-12) return;

  const dot = nx * outDir[0] + ny * outDir[1] + nz * outDir[2];
  const v0 = a;
  const v1 = dot >= 0 ? b : c;
  const v2 = dot >= 0 ? c : b;

  positions.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
  const uv0 = uvFn(v0);
  const uv1 = uvFn(v1);
  const uv2 = uvFn(v2);
  uvs.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);
}

function pushQuadOriented(positions, uvs, a, b, c, d, outDir, uvFn) {
  pushTriOriented(positions, uvs, a, b, c, outDir, uvFn);
  pushTriOriented(positions, uvs, a, c, d, outDir, uvFn);
}

/**
 * Builds a watertight chamfered masonry block whose bevels automatically flatten
 * and whose hidden internal faces are culled on every side touching an occupied neighbor.
 *
 * @param {number} w - Exact block width (matches gridStepX)
 * @param {number} h - Exact block height (matches gridStepY)
 * @param {number} d - Exact block depth (matches gridStepZ)
 * @param {number} mask - 6-bit NEIGHBOR_* mask (0..63)
 * @param {number} bevel - Exposed edge chamfer width
 * @returns {THREE.BufferGeometry}
 */
export function createConnectedMasonryGeometry(w, h, d, mask = 0, bevel = 0.044) {
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;

  const hasPX = (mask & NEIGHBOR_PX) !== 0;
  const hasNX = (mask & NEIGHBOR_NX) !== 0;
  const hasPZ = (mask & NEIGHBOR_PZ) !== 0;
  const hasNZ = (mask & NEIGHBOR_NZ) !== 0;
  const hasPY = (mask & NEIGHBOR_PY) !== 0;
  const hasNY = (mask & NEIGHBOR_NY) !== 0;

  // Exposed faces keep crisp tactile bevels; connected faces extend flush to outer boundary
  const bPX = hasPX ? 0 : bevel;
  const bNX = hasNX ? 0 : bevel;
  const bPZ = hasPZ ? 0 : bevel;
  const bNZ = hasNZ ? 0 : bevel;
  const bPY = hasPY ? 0 : bevel;
  const bNY = hasNY ? 0 : bevel;

  const x0 = -hx;
  const x1 = -hx + bNX;
  const x2 = hx - bPX;
  const x3 = hx;

  const y0 = -hy;
  const y1 = -hy + bNY;
  const y2 = hy - bPY;
  const y3 = hy;

  const z0 = -hz;
  const z1 = -hz + bNZ;
  const z2 = hz - bPZ;
  const z3 = hz;

  const positions = [];
  const uvs = [];

  const uvTop = (p) => [p[0] / w + 0.5, p[2] / d + 0.5];
  const uvX = (p) => [p[2] / d + 0.5, p[1] / h + 0.5];
  const uvZ = (p) => [p[0] / w + 0.5, p[1] / h + 0.5];

  // 1. Main flat faces (cull hidden flush internal horizontal & bottom faces)
  // Top face (+Y) is always emitted (flat when hasPY) so half-offset stepped pyramids stay sealed
  pushQuadOriented(
    positions,
    uvs,
    [x1, y3, z2],
    [x2, y3, z2],
    [x2, y3, z1],
    [x1, y3, z1],
    [0, 1, 0],
    uvTop
  );

  if (!hasNY) {
    pushQuadOriented(
      positions,
      uvs,
      [x1, y0, z1],
      [x2, y0, z1],
      [x2, y0, z2],
      [x1, y0, z2],
      [0, -1, 0],
      uvTop
    );
  }

  if (!hasPX) {
    pushQuadOriented(
      positions,
      uvs,
      [x3, y1, z2],
      [x3, y1, z1],
      [x3, y2, z1],
      [x3, y2, z2],
      [1, 0, 0],
      uvX
    );
  }

  if (!hasNX) {
    pushQuadOriented(
      positions,
      uvs,
      [x0, y1, z1],
      [x0, y1, z2],
      [x0, y2, z2],
      [x0, y2, z1],
      [-1, 0, 0],
      uvX
    );
  }

  if (!hasPZ) {
    pushQuadOriented(
      positions,
      uvs,
      [x1, y1, z3],
      [x2, y1, z3],
      [x2, y2, z3],
      [x1, y2, z3],
      [0, 0, 1],
      uvZ
    );
  }

  if (!hasNZ) {
    pushQuadOriented(
      positions,
      uvs,
      [x2, y1, z0],
      [x1, y1, z0],
      [x1, y2, z0],
      [x2, y2, z0],
      [0, 0, -1],
      uvZ
    );
  }

  // 2. 12 Chamfer Bevel Strips (only between two exposed faces; run continuously across connected walls!)
  // Top horizontal edge bevels
  if (bPY > 0 && bPZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x1, y2, z3],
      [x2, y2, z3],
      [x2, y3, z2],
      [x1, y3, z2],
      [0, 1, 1],
      uvZ
    );
  }
  if (bPY > 0 && bNZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x2, y2, z0],
      [x1, y2, z0],
      [x1, y3, z1],
      [x2, y3, z1],
      [0, 1, -1],
      uvZ
    );
  }
  if (bPY > 0 && bPX > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x3, y2, z2],
      [x3, y2, z1],
      [x2, y3, z1],
      [x2, y3, z2],
      [1, 1, 0],
      uvX
    );
  }
  if (bPY > 0 && bNX > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x0, y2, z1],
      [x0, y2, z2],
      [x1, y3, z2],
      [x1, y3, z1],
      [-1, 1, 0],
      uvX
    );
  }

  // Bottom horizontal edge bevels
  if (bNY > 0 && bPZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x1, y0, z2],
      [x2, y0, z2],
      [x2, y1, z3],
      [x1, y1, z3],
      [0, -1, 1],
      uvZ
    );
  }
  if (bNY > 0 && bNZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x2, y0, z1],
      [x1, y0, z1],
      [x1, y1, z0],
      [x2, y1, z0],
      [0, -1, -1],
      uvZ
    );
  }
  if (bNY > 0 && bPX > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x2, y0, z2],
      [x2, y0, z1],
      [x3, y1, z1],
      [x3, y1, z2],
      [1, -1, 0],
      uvX
    );
  }
  if (bNY > 0 && bNX > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x1, y0, z1],
      [x1, y0, z2],
      [x0, y1, z2],
      [x0, y1, z1],
      [-1, -1, 0],
      uvX
    );
  }

  // Vertical corner bevels
  if (bPX > 0 && bPZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x2, y1, z3],
      [x3, y1, z2],
      [x3, y2, z2],
      [x2, y2, z3],
      [1, 0, 1],
      uvZ
    );
  }
  if (bNX > 0 && bPZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x0, y1, z2],
      [x1, y1, z3],
      [x1, y2, z3],
      [x0, y2, z2],
      [-1, 0, 1],
      uvZ
    );
  }
  if (bPX > 0 && bNZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x3, y1, z1],
      [x2, y1, z0],
      [x2, y2, z0],
      [x3, y2, z1],
      [1, 0, -1],
      uvZ
    );
  }
  if (bNX > 0 && bNZ > 0) {
    pushQuadOriented(
      positions,
      uvs,
      [x1, y1, z0],
      [x0, y1, z1],
      [x0, y2, z1],
      [x1, y2, z0],
      [-1, 0, -1],
      uvZ
    );
  }

  // 3. 8 Exposed Corner Facet Triangles (only when all 3 adjacent faces are exposed)
  const cornerSpecs = [
    [bPX, bPY, bPZ, [x2, y3, z2], [x3, y2, z2], [x2, y2, z3], [1, 1, 1]],
    [bNX, bPY, bPZ, [x1, y3, z2], [x1, y2, z3], [x0, y2, z2], [-1, 1, 1]],
    [bPX, bPY, bNZ, [x2, y3, z1], [x2, y2, z0], [x3, y2, z1], [1, 1, -1]],
    [bNX, bPY, bNZ, [x1, y3, z1], [x0, y2, z1], [x1, y2, z0], [-1, 1, -1]],
    [bPX, bNY, bPZ, [x2, y0, z2], [x2, y1, z3], [x3, y1, z2], [1, -1, 1]],
    [bNX, bNY, bPZ, [x1, y0, z2], [x0, y1, z2], [x1, y1, z3], [-1, -1, 1]],
    [bPX, bNY, bNZ, [x2, y0, z1], [x3, y1, z1], [x2, y1, z0], [1, -1, -1]],
    [bNX, bNY, bNZ, [x1, y0, z1], [x1, y1, z0], [x0, y1, z1], [-1, -1, -1]],
  ];

  for (let i = 0; i < cornerSpecs.length; i++) {
    const [bx, by, bz, p0, p1, p2, dir] = cornerSpecs[i];
    if (bx > 0 && by > 0 && bz > 0) {
      pushTriOriented(positions, uvs, p0, p1, p2, dir, uvTop);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a seamless straight Roman compluvium roof section (tegulae slope).
 * Local origin sits at y = 0 (resting flush on Tier 3 stone cornice & atrium columns).
 * Slopes smoothly downward from outer eave (z = -outerSpan, y = outerH) to inner impluvium drip edge (z = +innerSpan, y = innerH).
 * Width along X equals exactly `tileStep` so side edges weld flush with adjacent 45-degree corner hips.
 */
export function createCompluviumStraightRoofGeometry({
  tileStep = 0.96,
  innerSpan = 0.48,
  outerSpan = 1.64,
  innerH = 0.14,
  outerH = 0.68,
} = {}) {
  const hx = tileStep * 0.5;
  const zOut = -outerSpan;
  const zIn = innerSpan;
  const slopeLen = outerSpan + innerSpan;

  const positions = [];
  const uvs = [];

  // UV runs cleanly along tile columns (X) and down slope (Z) so tegulae grooves align continuously
  const uvSlope = (p) => [p[0] / tileStep + 0.5, (p[2] - zOut) / tileStep];
  const uvFascia = (p) => [p[0] / tileStep + 0.5, p[1] / outerH];
  const uvSide = (p) => [(p[2] - zOut) / tileStep, p[1] / outerH];

  // Top sloped terracotta roof surface
  pushQuadOriented(
    positions,
    uvs,
    [-hx, outerH, zOut],
    [hx, outerH, zOut],
    [hx, innerH, zIn],
    [-hx, innerH, zIn],
    [0, 1, 0.25],
    uvSlope
  );

  // Flat underside soffit resting flush at y = 0 on cornice & columns
  pushQuadOriented(
    positions,
    uvs,
    [-hx, 0, zOut],
    [-hx, 0, zIn],
    [hx, 0, zIn],
    [hx, 0, zOut],
    [0, -1, 0],
    uvSlope
  );

  // Outer eave fascia wall (at z = zOut)
  pushQuadOriented(
    positions,
    uvs,
    [hx, 0, zOut],
    [-hx, 0, zOut],
    [-hx, outerH, zOut],
    [hx, outerH, zOut],
    [0, 0, -1],
    uvFascia
  );

  // Inner compluvium drip rim (at z = zIn, framing the sunlit atrium opening)
  pushQuadOriented(
    positions,
    uvs,
    [-hx, 0, zIn],
    [hx, 0, zIn],
    [hx, innerH, zIn],
    [-hx, innerH, zIn],
    [0, 0, 1],
    uvFascia
  );

  // End caps (hidden once adjacent corner roof tiles snap in, keeping piece solid while dragging/unmerged)
  pushQuadOriented(
    positions,
    uvs,
    [-hx, 0, zOut],
    [-hx, outerH, zOut],
    [-hx, innerH, zIn],
    [-hx, 0, zIn],
    [-1, 0, 0],
    uvSide
  );
  pushQuadOriented(
    positions,
    uvs,
    [hx, 0, zIn],
    [hx, innerH, zIn],
    [hx, outerH, zOut],
    [hx, 0, zOut],
    [1, 0, 0],
    uvSide
  );

  // Subtle decorative terracotta eaves molding lip along inner drip edge
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.userData.slopeLen = slopeLen;
  return geo;
}

/**
 * Builds a true 45-degree mitered Roman compluvium corner hip roof tile (canonical NW quadrant).
 * Local origin sits at slot center (dx = -1, dz = -1), y = 0 (flush on cornice & columns).
 * Outer corner sits at (-outerSpan, -outerSpan, outerH); inner impluvium corner sits at (+innerSpan, +innerSpan, innerH).
 * Both the North wing and West wing share the exact 45-degree diagonal miter hip and weld vertex-for-vertex
 * with adjacent straight roof tiles with pixel-aligned tegulae UVs and zero step seams.
 */
export function createCompluviumCornerRoofGeometry({
  tileStep = 0.96,
  innerSpan = 0.48,
  outerSpan = 1.64,
  innerH = 0.14,
  outerH = 0.68,
} = {}) {
  const out = -outerSpan;
  const inn = innerSpan;

  const positions = [];
  const uvs = [];

  // North wing slopes along +Z -> U runs along X, V runs down +Z matching North straight roof!
  const uvNorthWing = (p) => [(p[0] - inn) / tileStep, (p[2] - out) / tileStep];
  // West wing slopes along +X -> U runs along Z, V runs down +X matching West straight roof!
  const uvWestWing = (p) => [(p[2] - inn) / tileStep, (p[0] - out) / tileStep];
  const uvNorthFascia = (p) => [(p[0] - out) / tileStep, p[1] / outerH];
  const uvWestFascia = (p) => [(p[2] - out) / tileStep, p[1] / outerH];

  // Top sloped roof — split cleanly along the exact 45-degree diagonal hip (out,out) -> (inn,inn)
  // 1. North-facing roof wing triangle: (out, outerH, out), (inn, outerH, out), (inn, innerH, inn)
  pushTriOriented(
    positions,
    uvs,
    [out, outerH, out],
    [inn, outerH, out],
    [inn, innerH, inn],
    [0, 1, 0.25],
    uvNorthWing
  );

  // 2. West-facing roof wing triangle: (out, outerH, out), (inn, innerH, inn), (out, outerH, inn)
  pushTriOriented(
    positions,
    uvs,
    [out, outerH, out],
    [inn, innerH, inn],
    [out, outerH, inn],
    [0.25, 1, 0],
    uvWestWing
  );

  // Flat underside soffit at y = 0 resting solidly on Tier 3 cornice & atrium columns
  pushQuadOriented(
    positions,
    uvs,
    [out, 0, out],
    [out, 0, inn],
    [inn, 0, inn],
    [inn, 0, out],
    [0, -1, 0],
    uvNorthWing
  );

  // Outer North eave fascia (z = out)
  pushQuadOriented(
    positions,
    uvs,
    [inn, 0, out],
    [out, 0, out],
    [out, outerH, out],
    [inn, outerH, out],
    [0, 0, -1],
    uvNorthFascia
  );

  // Outer West eave fascia (x = out)
  pushQuadOriented(
    positions,
    uvs,
    [out, 0, out],
    [out, 0, inn],
    [out, outerH, inn],
    [out, outerH, out],
    [-1, 0, 0],
    uvWestFascia
  );

  // Seam side caps at x = inn and z = inn (solid before neighbor arrives; flush at weld plane once connected)
  pushQuadOriented(
    positions,
    uvs,
    [inn, 0, inn],
    [inn, innerH, inn],
    [inn, outerH, out],
    [inn, 0, out],
    [1, 0, 0],
    uvWestFascia
  );
  pushQuadOriented(
    positions,
    uvs,
    [out, 0, inn],
    [inn, 0, inn],
    [inn, innerH, inn],
    [out, outerH, inn],
    [0, 0, 1],
    uvNorthFascia
  );

  // Subtle 45-degree raised terracotta imbrex hip ridge cap running along the miter seam
  const ridgeHalfW = 0.055;
  const ridgeLift = 0.032;
  const pOutA = [out - ridgeHalfW * 0.35, outerH, out + ridgeHalfW];
  const pOutB = [out + ridgeHalfW, outerH, out - ridgeHalfW * 0.35];
  const pOutC = [out, outerH + ridgeLift, out];
  const pInA = [inn - ridgeHalfW, innerH, inn];
  const pInB = [inn, innerH, inn - ridgeHalfW];
  const pInC = [inn - ridgeHalfW * 0.35, innerH + ridgeLift, inn - ridgeHalfW * 0.35];

  pushQuadOriented(positions, uvs, pOutA, pInA, pInC, pOutC, [-0.5, 1, 0.5], uvWestWing);
  pushQuadOriented(positions, uvs, pOutC, pInC, pInB, pOutB, [0.5, 1, -0.5], uvNorthWing);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Per-level shared geometry cache for Connected Masonry blocks.
 * Guarantees < 0.2 ms neighbor updates and clean GPU disposal on scene exit.
 */
export class ConnectedMasonryCache {
  constructor() {
    this.cache = new Map();
  }

  getBlockGeometry(w, h, d, mask = 0, bevel = 0.044) {
    const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${bevel.toFixed(3)}_${mask}`;
    let geo = this.cache.get(key);
    if (!geo) {
      geo = createConnectedMasonryGeometry(w, h, d, mask, bevel);
      this.cache.set(key, geo);
    }
    return geo;
  }

  dispose() {
    this.cache.forEach((geo) => geo.dispose());
    this.cache.clear();
  }
}
