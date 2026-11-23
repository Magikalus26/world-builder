/**
 * Workd Builder — Procedural 512x512 PBR Texture & Material Generator
 * Generates tileable Diffuse (Albedo), Sobel-filtered Normal Maps, Roughness Maps,
 * and packed Normal+Roughness maps for 4-biome terrain splatting, limestone,
 * beveled hieroglyphic sandstone, weathered timber, golden capstone, and animated Nile water.
 * Zero external image files; memory-capped at 512x512 (anisotropy <= 4) for iPhone 16e 60 FPS.
 */

import * as THREE from 'three';

function makeCanvas(w = 512, h = w) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Deterministic integer hash in [0, 1] for seamlessly tileable lattice noise */
function hash2i(ix, iy, seed) {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}

/** Smoothly interpolated tileable 2D value noise with integer period */
function tileNoise2D(u, v, periodX, periodY, seed) {
  const fx = u * periodX;
  const fy = v * periodY;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const ix0 = ((x0 % periodX) + periodX) % periodX;
  const iy0 = ((y0 % periodY) + periodY) % periodY;
  const ix1 = (ix0 + 1) % periodX;
  const iy1 = (iy0 + 1) % periodY;

  const v00 = hash2i(ix0, iy0, seed);
  const v10 = hash2i(ix1, iy0, seed);
  const v01 = hash2i(ix0, iy1, seed);
  const v11 = hash2i(ix1, iy1, seed);

  return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy);
}

/** Seamless multi-octave FBM noise in [0, 1] */
function tileFBM(u, v, basePeriod, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += tileNoise2D(u, v, period, period, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

/** Seamless cellular Worley distance (F1 and F2-F1 edge) for stones, gravel & cracks */
function tileWorley(u, v, cells, seed) {
  const fx = u * cells;
  const fy = v * cells;
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  let d1 = 9;
  let d2 = 9;
  let cellId = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      const wx = ((nx % cells) + cells) % cells;
      const wy = ((ny % cells) + cells) % cells;
      const px = nx + 0.15 + 0.7 * hash2i(wx, wy, seed);
      const py = ny + 0.15 + 0.7 * hash2i(wx, wy, seed + 97);
      const d = Math.hypot(fx - px, fy - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cellId = hash2i(wx, wy, seed + 193);
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return { f1: d1, edge: d2 - d1, id: cellId };
}

function wrapTexture(canvas, { repeat = [1, 1], isColor = true, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sobel 3x3 filter converting a tileable Float32Array heightfield into a Tangent-Space Normal Map.
 * If roughnessField is provided, packs roughness into the Alpha channel (for GPU terrain splatting).
 */
function buildSobelNormalCanvas(heightField, size, strength = 2.6, roughnessField = null) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const mask = size - 1; // size is power of 2 (512)

  for (let y = 0; y < size; y++) {
    const ym = (y - 1) & mask;
    const yp = (y + 1) & mask;
    const rowM = ym * size;
    const row0 = y * size;
    const rowP = yp * size;

    for (let x = 0; x < size; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;

      const tl = heightField[rowM + xm];
      const tc = heightField[rowM + x];
      const tr = heightField[rowM + xp];
      const ml = heightField[row0 + xm];
      const mr = heightField[row0 + xp];
      const bl = heightField[rowP + xm];
      const bc = heightField[rowP + x];
      const br = heightField[rowP + xp];

      const dx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const dy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (row0 + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = roughnessField
        ? Math.round(clamp01(roughnessField[row0 + x]) * 255)
        : 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Builds a standalone grayscale Roughness canvas from a Float32Array */
function buildRoughnessCanvas(roughField, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const total = size * size;
  for (let i = 0; i < total; i++) {
    const g = Math.round(clamp01(roughField[i]) * 255);
    const idx = i * 4;
    data[idx] = g;
    data[idx + 1] = g;
    data[idx + 2] = g;
    data[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ============================================================================
 * 1. BIOME 0 — WIND-RIPPLED GOLDEN DESERT SAND (512x512 Albedo + Normal+Rough)
 * ========================================================================== */
function buildDesertSandPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // Flowing wind-blown sand ripples perturbed by seamless FBM
      const warp = tileFBM(u, v, 4, 3, 13) * 0.32;
      const ripplePhase = (v * 10 + u * 2 + warp * 3.2) * Math.PI * 2;
      // Asymmetric wind-dune wave profile (steeper leeward slope)
      const wave = Math.sin(ripplePhase) * 0.5 + Math.sin(ripplePhase * 2 - 0.6) * 0.14;
      const macroVar = tileFBM(u, v, 4, 3, 47);
      const grain = hash2i(x, y, 71);
      const fineNoise = tileNoise2D(u, v, 64, 64, 91);

      // Sparkling quartz micro-facets (small percentage of grains catch sunlight)
      const sparkle = grain > 0.968 ? 1.0 : 0.0;

      const h = clamp01(0.5 + wave * 0.34 + (macroVar - 0.5) * 0.14 + (fineNoise - 0.5) * 0.08 + (grain - 0.5) * 0.05);
      height[i] = h;

      // Warm golden ochre palette with luminous crests and deeper warm amber troughs
      const crest = smoothstep(-0.55, 0.65, wave);
      const r = lerp(206, 240, crest) + (macroVar - 0.5) * 18 + (grain - 0.5) * 14 + sparkle * 26;
      const g = lerp(156, 202, crest) + (macroVar - 0.5) * 14 + (grain - 0.5) * 12 + sparkle * 24;
      const b = lerp(94, 134, crest) + (macroVar - 0.5) * 10 + (grain - 0.5) * 10 + sparkle * 22;

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;

      // Sparkling specular sand micro-grains via lower roughness spots
      rough[i] = sparkle > 0.5 ? 0.32 : clamp01(0.84 - crest * 0.1 + (grain - 0.5) * 0.1);
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPackedCanvas = buildSobelNormalCanvas(height, size, 3.0, rough);

  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPackedCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 2. BIOME 1 — COMPACTED DUSTY EARTH & GRAVEL PATH (512x512)
 * ========================================================================== */
function buildEarthPathPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const dirt = tileFBM(u, v, 6, 4, 211);
      const pebbles = tileWorley(u, v, 22, 239);
      const grit = tileWorley(u, v, 44, 271);
      const grain = hash2i(x, y, 293);

      // Compacted river pebbles embedded in dry terracotta-ochre earth
      const pebbleMask = smoothstep(0.36, 0.12, pebbles.f1) * (pebbles.id > 0.35 ? 1 : 0.35);
      const gritBump = smoothstep(0.4, 0.15, grit.f1) * 0.35;

      const h = clamp01(0.42 + (dirt - 0.5) * 0.25 + pebbleMask * 0.34 + gritBump * 0.16 + (grain - 0.5) * 0.06);
      height[i] = h;

      // Warm compacted dusty earth mixed with pale ochre/grey pebbles
      let r = lerp(164, 198, dirt);
      let g = lerp(124, 155, dirt);
      let b = lerp(82, 108, dirt);

      if (pebbleMask > 0.05) {
        const tone = 0.78 + pebbles.id * 0.36;
        r = lerp(r, 178 * tone, pebbleMask * 0.72);
        g = lerp(g, 160 * tone, pebbleMask * 0.72);
        b = lerp(b, 132 * tone, pebbleMask * 0.72);
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + (grain - 0.5) * 14)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (grain - 0.5) * 12)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (grain - 0.5) * 10)));
      data[idx + 3] = 255;

      rough[i] = clamp01(0.92 - pebbleMask * 0.2 + (grain - 0.5) * 0.08);
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPackedCanvas = buildSobelNormalCanvas(height, size, 3.8, rough);

  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPackedCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 3. BIOME 2 — CRUSHED LIMESTONE & CRACKED QUARRY DUST (512x512)
 * ========================================================================== */
function buildQuarryDustPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const base = tileFBM(u, v, 5, 4, 311);
      const slab = tileWorley(u, v, 9, 349);
      const chips = tileWorley(u, v, 28, 383);
      const grain = hash2i(x, y, 401);

      // Dry quarry slab cracks + scattered sharp limestone rubble chips
      const crack = 1.0 - smoothstep(0.015, 0.075, slab.edge);
      const chipH = smoothstep(0.38, 0.1, chips.f1) * (chips.id > 0.42 ? 1.0 : 0.25);

      const h = clamp01(0.54 + (base - 0.5) * 0.2 - crack * 0.42 + chipH * 0.3 + (grain - 0.5) * 0.07);
      height[i] = h;

      // Chalky limestone grey-beige with dusty shadow in cracks
      let r = lerp(178, 212, base) + (slab.id - 0.5) * 14;
      let g = lerp(168, 200, base) + (slab.id - 0.5) * 12;
      let b = lerp(146, 176, base) + (slab.id - 0.5) * 10;

      // Highlight angular stone chips
      r = lerp(r, 224, chipH * 0.42);
      g = lerp(g, 214, chipH * 0.42);
      b = lerp(b, 192, chipH * 0.42);

      // Darken fracture cracks
      const crackShade = 1.0 - crack * 0.46;
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r * crackShade + (grain - 0.5) * 12)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * crackShade + (grain - 0.5) * 12)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * crackShade + (grain - 0.5) * 10)));
      data[idx + 3] = 255;

      rough[i] = clamp01(0.9 + crack * 0.08 - chipH * 0.14 + (grain - 0.5) * 0.06);
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPackedCanvas = buildSobelNormalCanvas(height, size, 4.2, rough);

  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPackedCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 4. BIOME 3 — LUSH RIVERBANK SILT & OASIS GRASS (512x512)
 * ========================================================================== */
function buildOasisGrassPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const lush = tileFBM(u, v, 5, 4, 431);
      const blades = tileFBM(u, v, 24, 3, 463);
      const tuft = tileWorley(u, v, 18, 491);
      const grain = hash2i(x, y, 521);

      // Grass tuft clusters emerging from fertile Nile silt
      const grassCover = smoothstep(0.32, 0.72, lush * 0.7 + (1.0 - tuft.f1) * 0.35);
      const bladeRelief = blades * grassCover;

      const h = clamp01(0.35 + (lush - 0.5) * 0.16 + bladeRelief * 0.45 + (grain - 0.5) * 0.08);
      height[i] = h;

      // Dark fertile riverbank silt -> lush warm emerald-olive oasis foliage
      const siltR = 102 + lush * 24;
      const siltG = 86 + lush * 20;
      const siltB = 58 + lush * 14;

      const grassR = lerp(84, 126, blades);
      const grassG = lerp(124, 166, blades);
      const grassB = lerp(52, 74, blades);

      const r = lerp(siltR, grassR, grassCover);
      const g = lerp(siltG, grassG, grassCover);
      const b = lerp(siltB, grassB, grassCover);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + (grain - 0.5) * 12)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (grain - 0.5) * 14)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (grain - 0.5) * 10)));
      data[idx + 3] = 255;

      // Silt is slightly damper/glossier; grass blades are softly matte
      rough[i] = clamp01(lerp(0.64, 0.84, grassCover) + (grain - 0.5) * 0.08);
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPackedCanvas = buildSobelNormalCanvas(height, size, 3.6, rough);

  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPackedCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 5. QUARRY CLIFF & RAW STONE LIMESTONE (512x512 Albedo + Normal + Roughness)
 * ========================================================================== */
function buildQuarryLimestonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // Stratified horizontal sedimentary bedding planes warped organically
      const warp = tileFBM(u, v, 4, 3, 601) * 0.14;
      const strataWave = Math.sin((v + warp) * Math.PI * 14);
      const strataBand = tileNoise2D(0.2, v + warp, 4, 16, 617);
      const rockFbm = tileFBM(u, v, 8, 4, 641);
      const fractures = tileWorley(u, v, 7, 673);
      const grain = hash2i(x, y, 701);

      const crevice = 1.0 - smoothstep(0.012, 0.068, fractures.edge);
      const beddingGroove = 1.0 - smoothstep(0.0, 0.22, Math.abs(strataWave));

      const h = clamp01(
        0.55 +
          strataWave * 0.14 +
          (rockFbm - 0.5) * 0.26 -
          crevice * 0.42 -
          beddingGroove * 0.14 +
          (grain - 0.5) * 0.08
      );
      height[i] = h;

      // Stratified grey-beige Egyptian limestone tones
      const shade = 1.0 - crevice * 0.48 - beddingGroove * 0.16;
      const r = (lerp(154, 198, strataBand) + (rockFbm - 0.5) * 26) * shade;
      const g = (lerp(144, 186, strataBand) + (rockFbm - 0.5) * 24) * shade;
      const b = (lerp(126, 162, strataBand) + (rockFbm - 0.5) * 20) * shade;

      // Mineral chalk speckles
      const speck = grain > 0.94 ? 22 : grain < 0.06 ? -20 : 0;

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + speck)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + speck)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + speck * 0.85)));
      data[idx + 3] = 255;

      rough[i] = clamp01(0.86 + crevice * 0.12 + (grain - 0.5) * 0.1);
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.4);
  const roughCanvas = buildRoughnessCanvas(rough, size);

  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 6. CARVED PYRAMID SANDSTONE (512x512 Albedo + Normal + Roughness + Cartouche)
 * ========================================================================== */
function buildCarvedSandstonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  // Pass 1: Sandstone micro-grain, diagonal chisel dressing marks, & weathered edges
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const stone = tileFBM(u, v, 6, 4, 733);
      const pores = tileFBM(u, v, 32, 2, 761);
      const grain = hash2i(x, y, 787);

      // Fine diagonal hand-chisel marks across dressed face
      const chisel = Math.sin((u * 38 + v * 38 + stone * 1.4) * Math.PI * 2) * 0.5 + 0.5;
      const edgeDist = Math.min(u, 1 - u, v, 1 - v);
      const bevelFrame = smoothstep(0.015, 0.065, edgeDist);
      const innerRecess = smoothstep(0.065, 0.09, edgeDist);

      let h = 0.62 + (stone - 0.5) * 0.12 + (chisel - 0.5) * 0.06 + (pores - 0.5) * 0.07 + (grain - 0.5) * 0.04;
      // Sculpted outer edge bevel & inset panel step
      h *= 0.72 + 0.28 * bevelFrame;
      h -= (1 - innerRecess) * bevelFrame * 0.08;
      height[i] = clamp01(h);

      // Rich warm golden sandstone albedo
      const edgeWeather = lerp(0.84, 1.0, bevelFrame);
      const r = (lerp(218, 244, stone) + (chisel - 0.5) * 10 + (grain - 0.5) * 12) * edgeWeather;
      const g = (lerp(170, 204, stone) + (chisel - 0.5) * 8 + (grain - 0.5) * 10) * edgeWeather;
      const b = (lerp(94, 130, stone) + (chisel - 0.5) * 6 + (grain - 0.5) * 8) * edgeWeather;

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;

      rough[i] = clamp01(0.68 - (stone - 0.5) * 0.14 + (1 - bevelFrame) * 0.18 + (grain - 0.5) * 0.08);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Pass 2: Draw crisp Egyptian cartouche & hieroglyphic border reliefs onto an offscreen relief mask
  // so both Albedo shading AND Sobel Normal relief share the exact carved geometry!
  const reliefCanvas = makeCanvas(size);
  const rctx = reliefCanvas.getContext('2d');
  rctx.clearRect(0, 0, size, size);
  rctx.strokeStyle = '#ffffff';
  rctx.fillStyle = '#ffffff';
  rctx.lineCap = 'round';
  rctx.lineJoin = 'round';

  // Crisp double dressed ashlar border recess
  rctx.lineWidth = 6;
  rctx.strokeRect(24, 24, size - 48, size - 48);

  // Upper & lower hieroglyphic frieze bands
  const drawFriezeBand = (yc) => {
    rctx.lineWidth = 3.5;
    rctx.beginPath();
    rctx.moveTo(42, yc - 22);
    rctx.lineTo(size - 42, yc - 22);
    rctx.moveTo(42, yc + 22);
    rctx.lineTo(size - 42, yc + 22);
    rctx.stroke();

    for (let cx = 74; cx <= size - 74; cx += 62) {
      const m = Math.floor(cx / 62) % 4;
      rctx.lineWidth = 3.5;
      if (m === 0) {
        // Solar disk
        rctx.beginPath();
        rctx.arc(cx, yc, 10, 0, Math.PI * 2);
        rctx.stroke();
        rctx.beginPath();
        rctx.arc(cx, yc, 3.5, 0, Math.PI * 2);
        rctx.fill();
      } else if (m === 1) {
        // Stylized Ankh
        rctx.beginPath();
        rctx.arc(cx, yc - 6, 5.5, 0, Math.PI * 2);
        rctx.moveTo(cx, yc - 0.5);
        rctx.lineTo(cx, yc + 13);
        rctx.moveTo(cx - 8, yc + 3.5);
        rctx.lineTo(cx + 8, yc + 3.5);
        rctx.stroke();
      } else if (m === 2) {
        // Royal Cartouche oval
        rctx.beginPath();
        rctx.roundRect(cx - 15, yc - 8.5, 30, 17, 8.5);
        rctx.stroke();
        rctx.beginPath();
        rctx.moveTo(cx + 18, yc - 10);
        rctx.lineTo(cx + 18, yc + 10);
        rctx.stroke();
      } else {
        // Nile wave & reed chevron
        rctx.beginPath();
        rctx.moveTo(cx - 13, yc + 5);
        rctx.lineTo(cx - 6, yc - 5);
        rctx.lineTo(cx, yc + 5);
        rctx.lineTo(cx + 6, yc - 5);
        rctx.lineTo(cx + 13, yc + 5);
        rctx.stroke();
      }
    }
  };

  drawFriezeBand(74);
  drawFriezeBand(size - 74);

  // Subtle central royal cartouche emblem
  rctx.lineWidth = 3.5;
  rctx.beginPath();
  rctx.roundRect(size * 0.5 - 46, size * 0.5 - 24, 92, 48, 24);
  rctx.stroke();
  rctx.beginPath();
  rctx.arc(size * 0.5 - 16, size * 0.5, 10, 0, Math.PI * 2);
  rctx.stroke();
  rctx.beginPath();
  rctx.moveTo(size * 0.5 + 4, size * 0.5 - 11);
  rctx.lineTo(size * 0.5 + 24, size * 0.5);
  rctx.lineTo(size * 0.5 + 4, size * 0.5 + 11);
  rctx.closePath();
  rctx.stroke();

  // Carve the relief mask into both the heightfield and subtle ambient-occluded albedo
  const reliefData = rctx.getImageData(0, 0, size, size).data;
  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aData = albedoImg.data;
  for (let i = 0; i < size * size; i++) {
    const carve = reliefData[i * 4 + 3] / 255;
    if (carve > 0.01) {
      height[i] = clamp01(height[i] - carve * 0.24);
      rough[i] = clamp01(rough[i] + carve * 0.16);
      const ao = 1.0 - carve * 0.28;
      aData[i * 4] = Math.round(aData[i * 4] * ao);
      aData[i * 4 + 1] = Math.round(aData[i * 4 + 1] * ao);
      aData[i * 4 + 2] = Math.round(aData[i * 4 + 2] * ao);
    }
  }
  ctx.putImageData(albedoImg, 0, 0);

  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  const roughCanvas = buildRoughnessCanvas(rough, size);

  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 7. INTERMEDIATE CARVING STAGES (STAGE 1 & STAGE 2, 256x256)
 * ========================================================================== */
function buildCarvingStageTexture(stage, anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const fbm = tileFBM(u, v, 6, 3, stage === 1 ? 811 : 853);
      const chisel = Math.sin((u * 26 + v * 26 + fbm * 2) * Math.PI * 2) * 0.5 + 0.5;
      const grain = hash2i(x, y, 881);
      const edge = smoothstep(0.04, 0.16, Math.min(u, 1 - u, v, 1 - v));

      height[i] = clamp01(0.5 + (fbm - 0.5) * 0.22 + (chisel - 0.5) * 0.16);
      const baseR = stage === 1 ? lerp(176, 212, edge) : lerp(206, 232, edge);
      const baseG = stage === 1 ? lerp(156, 184, edge) : lerp(164, 194, edge);
      const baseB = stage === 1 ? lerp(124, 134, edge) : lerp(104, 120, edge);

      const shade = 0.9 + chisel * 0.16 + (fbm - 0.5) * 0.12;
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(baseR * shade + (grain - 0.5) * 14)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG * shade + (grain - 0.5) * 12)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB * shade + (grain - 0.5) * 10)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.2);

  return {
    map: wrapTexture(canvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 8. GOLDEN PYRAMIDION CAPSTONE (512x512 Burnished Engraved Gold PBR)
 * ========================================================================== */
function buildGoldenCapstonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#fff4ba');
  grad.addColorStop(0.38, '#ffd454');
  grad.addColorStop(0.75, '#e8aa24');
  grad.addColorStop(1, '#c58316');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed metal micro-grain
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const brush = Math.sin((y / size) * Math.PI * 24) * 0.006;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const g = hash2i(x, y, 919);
      height[i] = 0.65 + brush + (g - 0.5) * 0.014;
      rough[i] = clamp01(0.18 + (g - 0.5) * 0.05 + Math.abs(brush) * 0.4);
      data[i * 4] = Math.min(255, Math.max(0, Math.round(data[i * 4] + (g - 0.5) * 8)));
      data[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(data[i * 4 + 1] + (g - 0.5) * 7)));
    }
  }
  ctx.putImageData(img, 0, 0);

  // Engraved solar emblem & winged sun relief
  const relief = makeCanvas(size);
  const rctx = relief.getContext('2d');
  rctx.strokeStyle = '#ffffff';
  rctx.lineWidth = 6;
  rctx.beginPath();
  rctx.arc(size * 0.5, size * 0.58, 46, 0, Math.PI * 2);
  rctx.stroke();
  rctx.beginPath();
  rctx.arc(size * 0.5, size * 0.58, 22, 0, Math.PI * 2);
  rctx.stroke();

  // Base royal trim bands
  [size - 56, size - 30].forEach((yy) => {
    rctx.beginPath();
    rctx.moveTo(0, yy);
    rctx.lineTo(size, yy);
    rctx.stroke();
  });

  const rData = relief.getContext('2d').getImageData(0, 0, size, size).data;
  const aImg = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const c = rData[i * 4 + 3] / 255;
    if (c > 0.01) {
      height[i] = clamp01(height[i] - c * 0.25);
      rough[i] = clamp01(rough[i] + c * 0.35);
      const shade = 1 - c * 0.28;
      aImg.data[i * 4] = Math.round(aImg.data[i * 4] * shade);
      aImg.data[i * 4 + 1] = Math.round(aImg.data[i * 4 + 1] * shade);
      aImg.data[i * 4 + 2] = Math.round(aImg.data[i * 4 + 2] * shade);
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const normalCanvas = buildSobelNormalCanvas(height, size, 3.2);
  const roughCanvas = buildRoughnessCanvas(rough, size);

  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 9. WEATHERED TIMBER PLANKS (512x512 Albedo + Normal + Roughness + Knots)
 * ========================================================================== */
function buildWeatheredTimberPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const plankCount = 4;

  // Deterministic knot centers on each plank
  const knots = [
    { x: 0.26, y: 0.125, r: 0.055 },
    { x: 0.72, y: 0.375, r: 0.048 },
    { x: 0.41, y: 0.625, r: 0.052 },
    { x: 0.81, y: 0.875, r: 0.045 },
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const plankIdx = Math.floor(v * plankCount);
    const plankV = (v * plankCount) % 1;
    const plankTone = (hash2i(plankIdx, 7, 947) - 0.5) * 24;

    // Deep dark groove between planks + dust accumulation along bevel
    const seamDist = Math.min(plankV, 1 - plankV);
    const seamCut = 1.0 - smoothstep(0.012, 0.045, seamDist);
    const dustEdge = smoothstep(0.02, 0.09, seamDist) * (1.0 - smoothstep(0.09, 0.2, seamDist));

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // Knot distortion pulls wood grain fibers organically around dark wood knots
      let knotDark = 0;
      let knotDeflect = 0;
      for (let k = 0; k < knots.length; k++) {
        const kn = knots[k];
        const dx = (u - kn.x) * 0.55;
        const dy = (v - kn.y) * 2.1;
        const d = Math.hypot(dx, dy);
        if (d < kn.r * 2.2) {
          const factor = 1.0 - d / (kn.r * 2.2);
          knotDeflect += factor * 0.18;
          knotDark = Math.max(knotDark, smoothstep(kn.r * 1.15, kn.r * 0.25, d));
        }
      }

      // Elongated wood grain fibers
      const grainWarp = tileFBM(u, v, 4, 3, 971 + plankIdx * 19) * 0.22 + knotDeflect;
      const rings = Math.sin((plankV * 14 + grainWarp * 10) * Math.PI * 2) * 0.5 + 0.5;
      const fineFiber = tileNoise2D(u, v, 16, 128, 997);
      const dustPatch = tileFBM(u, v, 8, 3, 1021);
      const micro = hash2i(x, y, 1049);

      const h = clamp01(
        0.58 +
          (rings - 0.5) * 0.16 +
          (fineFiber - 0.5) * 0.12 -
          seamCut * 0.5 -
          knotDark * 0.14
      );
      height[i] = h;

      // Rich sun-weathered acacia/cedar tones
      let r = lerp(116, 160, rings) + plankTone + (fineFiber - 0.5) * 18;
      let g = lerp(74, 108, rings) + plankTone * 0.75 + (fineFiber - 0.5) * 14;
      let b = lerp(42, 66, rings) + plankTone * 0.5 + (fineFiber - 0.5) * 10;

      // Darken knots & plank seams
      const knotMul = 1.0 - knotDark * 0.52;
      const seamMul = 1.0 - seamCut * 0.65;
      r *= knotMul * seamMul;
      g *= knotMul * seamMul;
      b *= knotMul * seamMul;

      // Desert sand dust accumulation in crevices and worn grooves
      const dustAmt = clamp01((dustEdge * 0.45 + smoothstep(0.58, 0.85, dustPatch) * 0.22) * (1 - seamCut));
      r = lerp(r, 212, dustAmt * 0.55);
      g = lerp(g, 180, dustAmt * 0.55);
      b = lerp(b, 126, dustAmt * 0.55);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + (micro - 0.5) * 10)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (micro - 0.5) * 8)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (micro - 0.5) * 6)));
      data[idx + 3] = 255;

      rough[i] = clamp01(0.78 + dustAmt * 0.16 + seamCut * 0.14 - knotDark * 0.15 + (micro - 0.5) * 0.08);
    }
  }

  ctx.putImageData(img, 0, 0);

  // Add subtle wooden pegs near plank ends
  ctx.fillStyle = '#361f0e';
  const plankH = size / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const cy = (p + 0.5) * plankH;
    [34, size - 34].forEach((px) => {
      ctx.beginPath();
      ctx.arc(px, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const normalCanvas = buildSobelNormalCanvas(height, size, 3.8);
  const roughCanvas = buildRoughnessCanvas(rough, size);

  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * 10. ANIMATED NILE WATER NORMAL MAP (512x512 Seamless Wave Ripple Normal)
 * ========================================================================== */
function buildWaterNormalMap(anisotropy) {
  const size = 512;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const w1 = Math.sin((u * 4 + v * 3) * Math.PI * 2);
      const w2 = Math.sin((u * -3 + v * 5 + 0.35) * Math.PI * 2);
      const fbm = tileFBM(u, v, 8, 3, 1103);
      const fine = tileFBM(u, v, 24, 2, 1151);
      height[y * size + x] = clamp01(0.5 + w1 * 0.12 + w2 * 0.1 + (fbm - 0.5) * 0.32 + (fine - 0.5) * 0.14);
    }
  }

  const normalCanvas = buildSobelNormalCanvas(height, size, 2.8);
  return wrapTexture(normalCanvas, { repeat: [2, 2], isColor: false, anisotropy });
}

/* ============================================================================
 * 11. SUPPORTING TEXTURES (PLINTH STRATA, CANOPY, BLUEPRINT, SHADOW, SUNBEAM)
 * ========================================================================== */
function buildPlinthStrata(anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const bands = [
    { y: 0, h: 42, color: '#cfa05f' },
    { y: 42, h: 52, color: '#b88247' },
    { y: 94, h: 48, color: '#9c6a3a' },
    { y: 142, h: 56, color: '#815630' },
    { y: 198, h: 58, color: '#694426' },
  ];
  bands.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, b.y, size, b.h);
  });
  for (let i = 0; i < 45; i++) {
    const y = hash2i(i, 1, 1201) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,232,190,0.09)' : 'rgba(48,24,10,0.12)';
    ctx.fillRect(0, y, size, 2 + hash2i(i, 2, 1201) * 4);
  }
  return wrapTexture(canvas, { repeat: [4, 1], isColor: true, anisotropy });
}

function buildCanopyCloth(anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const stripes = 8;
  const w = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f3e2c4' : '#c65a38';
    ctx.fillRect(i * w, 0, w, size);
  }
  ctx.fillStyle = 'rgba(70, 38, 18, 0.08)';
  for (let y = 0; y < size; y += 5) ctx.fillRect(0, y, size, 1.8);
  for (let x = 0; x < size; x += 5) ctx.fillRect(x, 0, 1.4, size);
  return wrapTexture(canvas, { isColor: true, anisotropy });
}

function buildBlueprintGrid(anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(64, 182, 224, 0.24)';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(214, 246, 255, 0.34)';
  ctx.lineWidth = 2;
  const step = size / 4;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 14);
    ctx.lineTo(i * step, size - 14);
    ctx.moveTo(14, i * step);
    ctx.lineTo(size - 14, i * step);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(240, 252, 255, 0.92)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 244, 200, 0.85)';
  ctx.strokeRect(24, 24, size - 48, size - 48);
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255, 252, 232, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(size * 0.5 - 16, size * 0.5);
  ctx.lineTo(size * 0.5 + 16, size * 0.5);
  ctx.moveTo(size * 0.5, size * 0.5 - 16);
  ctx.lineTo(size * 0.5, size * 0.5 + 16);
  ctx.stroke();

  return wrapTexture(canvas, { isColor: true, anisotropy });
}

function buildShadowBlob() {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const grad = ctx.createRadialGradient(cx, cx, 8, cx, cx, cx);
  grad.addColorStop(0, 'rgba(38, 22, 8, 0.58)');
  grad.addColorStop(0.55, 'rgba(38, 22, 8, 0.28)');
  grad.addColorStop(1, 'rgba(38, 22, 8, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildSunbeamGradient() {
  const w = 128;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const vGrad = ctx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0.0, 'rgba(255, 224, 130, 0.0)');
  vGrad.addColorStop(0.28, 'rgba(255, 226, 136, 0.55)');
  vGrad.addColorStop(0.75, 'rgba(255, 210, 96, 0.85)');
  vGrad.addColorStop(1.0, 'rgba(255, 200, 72, 0.0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * w;
    const streak = ctx.createLinearGradient(x, 0, x + w / 6, 0);
    streak.addColorStop(0, 'rgba(255,244,196,0)');
    streak.addColorStop(0.5, 'rgba(255,244,196,0.22)');
    streak.addColorStop(1, 'rgba(255,244,196,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(x, 0, w / 6, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the 4-biome GPU Terrain Texture Splatting material (Sand, Earth Path,
 * Quarry Dust, Oasis Grass) with per-biome Albedo + Sobel Normal + Roughness
 * and Nile shoreline wetness darkening.
 */
function createTerrainSplatMaterial(biomes) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.04,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAlb0 = { value: biomes.sand.albedo };
    shader.uniforms.uAlb1 = { value: biomes.earthPath.albedo };
    shader.uniforms.uAlb2 = { value: biomes.quarryDust.albedo };
    shader.uniforms.uAlb3 = { value: biomes.oasisGrass.albedo };

    shader.uniforms.uNR0 = { value: biomes.sand.normalRough };
    shader.uniforms.uNR1 = { value: biomes.earthPath.normalRough };
    shader.uniforms.uNR2 = { value: biomes.quarryDust.normalRough };
    shader.uniforms.uNR3 = { value: biomes.oasisGrass.normalRough };

    shader.uniforms.uNormalStrength = { value: 0.92 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aSplat;
        attribute float aWetness;
        varying vec4 vSplat;
        varying float vWetness;
        varying vec2 vTerrainUv;
        varying vec3 vTerrainT;
        varying vec3 vTerrainB;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSplat = aSplat;
        vWetness = aWetness;
        vTerrainUv = position.xz * 0.24;
        vec3 objT = normalize(vec3(max(objectNormal.y, 0.05), -objectNormal.x, 0.0));
        vec3 objB = normalize(cross(objT, objectNormal));
        vTerrainT = normalize(normalMatrix * objT);
        vTerrainB = normalize(normalMatrix * objB);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uAlb0;
        uniform sampler2D uAlb1;
        uniform sampler2D uAlb2;
        uniform sampler2D uAlb3;
        uniform sampler2D uNR0;
        uniform sampler2D uNR1;
        uniform sampler2D uNR2;
        uniform sampler2D uNR3;
        uniform float uNormalStrength;
        varying vec4 vSplat;
        varying float vWetness;
        varying vec2 vTerrainUv;
        varying vec3 vTerrainT;
        varying vec3 vTerrainB;`
      )
      .replace(
        '#include <map_fragment>',
        `vec4 c0 = texture2D(uAlb0, vTerrainUv);
        vec4 c1 = texture2D(uAlb1, vTerrainUv * 1.35);
        vec4 c2 = texture2D(uAlb2, vTerrainUv * 1.25);
        vec4 c3 = texture2D(uAlb3, vTerrainUv * 1.4);

        vec4 nr0 = texture2D(uNR0, vTerrainUv);
        vec4 nr1 = texture2D(uNR1, vTerrainUv * 1.35);
        vec4 nr2 = texture2D(uNR2, vTerrainUv * 1.25);
        vec4 nr3 = texture2D(uNR3, vTerrainUv * 1.4);

        // Organic micro-height modulated splat weights for crisp natural biome borders
        vec4 microH = vec4(nr0.b, nr1.b, nr2.b, nr3.b);
        vec4 w = max(vSplat + (microH - 0.5) * 0.14 * step(0.02, vSplat), vec4(0.0));
        w /= max(w.x + w.y + w.z + w.w, 0.0001);

        vec3 splatColor = c0.rgb * w.x + c1.rgb * w.y + c2.rgb * w.z + c3.rgb * w.w;
        vec4 splatNR = nr0 * w.x + nr1 * w.y + nr2 * w.z + nr3 * w.w;

        // Nile shoreline dampness & wet silt darkening where terrain meets water
        float wet = clamp(vWetness, 0.0, 1.0);
        splatColor *= mix(1.0, 0.56, wet);
        diffuseColor.rgb *= splatColor;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness * mix(splatNR.a, 0.18, clamp(vWetness, 0.0, 1.0));`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 mapN = splatNR.rgb * 2.0 - 1.0;
        mapN.xy *= uNormalStrength * mix(1.0, 0.45, clamp(vWetness, 0.0, 1.0));
        normal = normalize(normalize(vTerrainT) * mapN.x + normalize(vTerrainB) * mapN.y + normal * mapN.z);`
      );
  };

  mat.customProgramCacheKey = () => 'workd-builder-terrain-splat-v1';
  return mat;
}

/**
 * Generates and caches all procedural 512x512 PBR textures and shared materials.
 */
export function createTextureLibrary(renderer) {
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  // 4-Biome Terrain PBR sets
  const terrainBiomes = {
    sand: buildDesertSandPBR(anisotropy),
    earthPath: buildEarthPathPBR(anisotropy),
    quarryDust: buildQuarryDustPBR(anisotropy),
    oasisGrass: buildOasisGrassPBR(anisotropy),
  };

  // Surface PBR sets
  const limestone = buildQuarryLimestonePBR(anisotropy);
  const carving1 = buildCarvingStageTexture(1, anisotropy);
  const carving2 = buildCarvingStageTexture(2, anisotropy);
  const sandstone = buildCarvedSandstonePBR(anisotropy);
  const capstone = buildGoldenCapstonePBR(anisotropy);
  const timber = buildWeatheredTimberPBR(anisotropy);
  const waterNormal = buildWaterNormalMap(anisotropy);

  const plinthMap = buildPlinthStrata(anisotropy);
  const canopyMap = buildCanopyCloth(anisotropy);
  const blueprintMap = buildBlueprintGrid(anisotropy);
  const shadowBlobMap = buildShadowBlob();
  const sunbeamMap = buildSunbeamGradient();

  const textures = [
    terrainBiomes.sand.albedo,
    terrainBiomes.sand.normalRough,
    terrainBiomes.earthPath.albedo,
    terrainBiomes.earthPath.normalRough,
    terrainBiomes.quarryDust.albedo,
    terrainBiomes.quarryDust.normalRough,
    terrainBiomes.oasisGrass.albedo,
    terrainBiomes.oasisGrass.normalRough,
    limestone.map,
    limestone.normalMap,
    limestone.roughnessMap,
    carving1.map,
    carving1.normalMap,
    carving2.map,
    carving2.normalMap,
    sandstone.map,
    sandstone.normalMap,
    sandstone.roughnessMap,
    capstone.map,
    capstone.normalMap,
    capstone.roughnessMap,
    timber.map,
    timber.normalMap,
    timber.roughnessMap,
    waterNormal,
    plinthMap,
    canopyMap,
    blueprintMap,
    shadowBlobMap,
    sunbeamMap,
  ];

  // Animated translucent turquoise Nile water material
  const nileWaterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#279eb2'),
    normalMap: waterNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 0.12,
    metalness: 0.16,
    transparent: true,
    opacity: 0.84,
  });

  const materials = {
    terrainSplat: createTerrainSplatMaterial(terrainBiomes),
    plinth: new THREE.MeshStandardMaterial({
      map: plinthMap,
      roughness: 0.94,
      metalness: 0.0,
    }),
    limestone: new THREE.MeshStandardMaterial({
      map: limestone.map,
      normalMap: limestone.normalMap,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: limestone.roughnessMap,
      roughness: 1.0,
      metalness: 0.04,
    }),
    rawBlock: new THREE.MeshStandardMaterial({
      map: limestone.map,
      normalMap: limestone.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: limestone.roughnessMap,
      roughness: 1.0,
      metalness: 0.04,
      color: new THREE.Color('#efe7d8'),
    }),
    carvingStage1: new THREE.MeshStandardMaterial({
      map: carving1.map,
      normalMap: carving1.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.82,
      metalness: 0.04,
    }),
    carvingStage2: new THREE.MeshStandardMaterial({
      map: carving2.map,
      normalMap: carving2.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.74,
      metalness: 0.06,
    }),
    carvedBlock: new THREE.MeshStandardMaterial({
      map: sandstone.map,
      normalMap: sandstone.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: sandstone.roughnessMap,
      roughness: 1.0,
      metalness: 0.08,
    }),
    capstoneGold: new THREE.MeshStandardMaterial({
      map: capstone.map,
      normalMap: capstone.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: capstone.roughnessMap,
      roughness: 1.0,
      metalness: 0.86,
      emissive: new THREE.Color('#6a4408'),
      emissiveIntensity: 0.22,
    }),
    timber: new THREE.MeshStandardMaterial({
      map: timber.map,
      normalMap: timber.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: timber.roughnessMap,
      roughness: 1.0,
      metalness: 0.04,
    }),
    timberDark: new THREE.MeshStandardMaterial({
      map: timber.map,
      normalMap: timber.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: timber.roughnessMap,
      color: new THREE.Color('#b08a66'),
      roughness: 1.0,
      metalness: 0.04,
    }),
    leverKnob: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8442c'),
      roughness: 0.42,
      metalness: 0.12,
    }),
    canopy: new THREE.MeshStandardMaterial({
      map: canopyMap,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    foundation: new THREE.MeshStandardMaterial({
      map: sandstone.map,
      normalMap: sandstone.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: sandstone.roughnessMap,
      color: new THREE.Color('#dfca9e'),
      roughness: 1.0,
      metalness: 0.04,
    }),
    blueprintBase: new THREE.MeshBasicMaterial({
      map: blueprintMap,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    shadowBlob: new THREE.MeshBasicMaterial({
      map: shadowBlobMap,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
    palmTrunk: new THREE.MeshStandardMaterial({
      map: timber.map,
      normalMap: timber.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: new THREE.Color('#9c7148'),
      roughness: 0.9,
    }),
    palmLeaf: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#53883e'),
      roughness: 0.68,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
    oasisWater: nileWaterMat,
    copperTool: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cf7f42'),
      roughness: 0.28,
      metalness: 0.78,
    }),
  };

  let romePack = null;
  const romeTextures = [];
  const romeMaterials = [];

  function ensureRomePack() {
    if (romePack) return romePack;

    const grass = buildRomanGrassPBR(anisotropy);
    const viaRoad = buildRomanViaRoadPBR(anisotropy);
    const travDust = buildTravertineDustPBR(anisotropy);
    const travertine = buildRomanTravertinePBR(anisotropy);
    const ashlar = buildRomanAshlarPBR(anisotropy);
    const fluted = buildRomanFlutedColumnPBR(anisotropy);
    const roofTiles = buildRomanTerracottaRoofPBR(anisotropy);
    const mosaicMap = buildRomanMosaicFloor(anisotropy);

    romeTextures.push(
      grass.albedo,
      grass.normalRough,
      viaRoad.albedo,
      viaRoad.normalRough,
      travDust.albedo,
      travDust.normalRough,
      travertine.map,
      travertine.normalMap,
      travertine.roughnessMap,
      ashlar.map,
      ashlar.normalMap,
      ashlar.roughnessMap,
      fluted.map,
      fluted.normalMap,
      fluted.roughnessMap,
      roofTiles.map,
      roofTiles.normalMap,
      roofTiles.roughnessMap,
      mosaicMap
    );

    const romanTerrainSplat = createTerrainSplatMaterial({
      sand: grass,
      earthPath: viaRoad,
      quarryDust: travDust,
      oasisGrass: terrainBiomes.oasisGrass,
    });
    romanTerrainSplat.customProgramCacheKey = () => 'workd-builder-roman-terrain-splat-v1';

    const rMats = {
      terrainSplat: romanTerrainSplat,
      travertineCliff: new THREE.MeshStandardMaterial({
        map: travertine.map,
        normalMap: travertine.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: travertine.roughnessMap,
        roughness: 1.0,
        metalness: 0.04,
      }),
      rawTravertine: new THREE.MeshStandardMaterial({
        map: travertine.map,
        normalMap: travertine.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: travertine.roughnessMap,
        roughness: 1.0,
        metalness: 0.05,
        color: new THREE.Color('#fbf7ef'),
      }),
      romanAshlar: new THREE.MeshStandardMaterial({
        map: ashlar.map,
        normalMap: ashlar.normalMap,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughnessMap: ashlar.roughnessMap,
        roughness: 1.0,
        metalness: 0.06,
      }),
      flutedColumn: new THREE.MeshStandardMaterial({
        map: fluted.map,
        normalMap: fluted.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: fluted.roughnessMap,
        roughness: 1.0,
        metalness: 0.06,
      }),
      terracottaRoof: new THREE.MeshStandardMaterial({
        map: roofTiles.map,
        normalMap: roofTiles.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: roofTiles.roughnessMap,
        roughness: 1.0,
        metalness: 0.03,
      }),
      mosaicFloor: new THREE.MeshStandardMaterial({
        map: mosaicMap,
        roughness: 0.42,
        metalness: 0.05,
      }),
      cypressLeaf: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3b5f35'),
        roughness: 0.78,
        metalness: 0.02,
      }),
      cypressLeafLight: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#4f7a42'),
        roughness: 0.74,
        metalness: 0.02,
      }),
      amphoraClay: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c8693e'),
        roughness: 0.68,
        metalness: 0.03,
      }),
      romanBronze: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b6863c'),
        roughness: 0.34,
        metalness: 0.82,
      }),
    };

    Object.values(rMats).forEach((m) => romeMaterials.push(m));
    romePack = { materials: rMats };
    return romePack;
  }

  // Lazy-cached Level 3 (Feudal Japan) 512x512 procedural PBR material pack
  let japanPack = null;
  const japanTextures = [];
  const japanMaterials = [];

  function ensureJapanPack() {
    if (japanPack) return japanPack;

    const mossGrass = buildJapanMossGrassPBR(anisotropy);
    const zenGravel = buildJapanZenGravelPBR(anisotropy);
    const basaltDust = buildJapanBasaltDustPBR(anisotropy);
    const darkEarth = buildJapanDarkEarthPBR(anisotropy);
    const ishigaki = buildJapanIshigakiPBR(anisotropy);
    const shoji = buildJapanShojiWallPBR(anisotropy);
    const kawara = buildJapanKawaraRoofPBR(anisotropy);
    const cedar = buildJapanCedarTimberPBR(anisotropy);
    const engawa = buildJapanEngawaDeckPBR(anisotropy);

    [mossGrass, zenGravel, basaltDust, darkEarth].forEach((b) => {
      japanTextures.push(b.albedo, b.normalRough);
    });
    [ishigaki, shoji, kawara, cedar, engawa].forEach((pack) => {
      if (pack.map) japanTextures.push(pack.map);
      if (pack.normalMap) japanTextures.push(pack.normalMap);
      if (pack.roughnessMap) japanTextures.push(pack.roughnessMap);
    });

    const japanTerrainSplat = createTerrainSplatMaterial({
      sand: mossGrass, // Biome 0: Mossy emerald forest grass & bamboo grove soil
      earthPath: zenGravel, // Biome 1: Raked white Zen gravel & stepping-stone path
      quarryDust: basaltDust, // Biome 2: Crushed grey basalt quarry dust
      oasisGrass: darkEarth, // Biome 3: Compacted dark earth & damp pond banks
    });
    japanTerrainSplat.customProgramCacheKey = () => 'workd-builder-japan-terrain-splat-v1';

    const jMats = {
      terrainSplat: japanTerrainSplat,
      ishigakiStone: new THREE.MeshStandardMaterial({
        map: ishigaki.map,
        normalMap: ishigaki.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: ishigaki.roughnessMap,
        roughness: 1.0,
        metalness: 0.05,
      }),
      rawBasalt: new THREE.MeshStandardMaterial({
        map: basaltDust.albedo,
        normalMap: ishigaki.normalMap,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: ishigaki.roughnessMap,
        color: new THREE.Color('#8e9399'),
        roughness: 1.0,
        metalness: 0.08,
      }),
      basaltCliff: new THREE.MeshStandardMaterial({
        map: ishigaki.map,
        normalMap: ishigaki.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        color: new THREE.Color('#7a8088'),
        roughness: 0.88,
        metalness: 0.07,
      }),
      shojiWall: new THREE.MeshStandardMaterial({
        map: shoji.map,
        normalMap: shoji.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: shoji.roughnessMap,
        emissive: new THREE.Color('#5a4320'),
        emissiveIntensity: 0.14,
        roughness: 1.0,
        metalness: 0.02,
      }),
      kawaraRoof: new THREE.MeshStandardMaterial({
        map: kawara.map,
        normalMap: kawara.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: kawara.roughnessMap,
        roughness: 0.88,
        metalness: 0.14,
      }),
      cedarBeam: new THREE.MeshStandardMaterial({
        map: cedar.map,
        normalMap: cedar.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: cedar.roughnessMap,
        roughness: 1.0,
        metalness: 0.04,
      }),
      engawaDeck: new THREE.MeshStandardMaterial({
        map: engawa.map,
        normalMap: engawa.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: engawa.roughnessMap,
        roughness: 0.92,
        metalness: 0.03,
      }),
      lacquerRed: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b63526'),
        roughness: 0.32,
        metalness: 0.14,
      }),
      sakuraBlossom: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f6b2c6'),
        roughness: 0.72,
        metalness: 0.02,
      }),
      sakuraBlossomLight: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffd4e2'),
        roughness: 0.68,
        metalness: 0.02,
      }),
      sakuraTrunk: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#4a352c'),
        roughness: 0.9,
        metalness: 0.02,
      }),
      bambooStalk: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#5f8e3d'),
        roughness: 0.52,
        metalness: 0.05,
      }),
      bambooLeaf: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#487834'),
        roughness: 0.74,
        metalness: 0.02,
      }),
      lanternStone: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#9ea2a4'),
        roughness: 0.9,
        metalness: 0.04,
      }),
      lanternGlow: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffe294'),
      }),
      koiOrange: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e85a26'),
        roughness: 0.35,
        metalness: 0.05,
      }),
    };

    Object.values(jMats).forEach((m) => japanMaterials.push(m));
    japanPack = { materials: jMats };
    return japanPack;
  }

  // Lazy-cached Level 4 (Mayan Civilization) 512x512 procedural PBR material pack
  let mayaPack = null;
  const mayaTextures = [];
  const mayaMaterials = [];

  function ensureMayaPack() {
    if (mayaPack) return mayaPack;

    const jungleMoss = buildMayaJungleMossPBR(anisotropy);
    const sacbeRoad = buildMayaSacbeCausewayPBR(anisotropy);
    const limestoneDust = buildMayaLimestoneDustPBR(anisotropy);
    const cenoteMoss = buildMayaCenoteMossPBR(anisotropy);
    const limestone = buildMayaLimestonePBR(anisotropy);
    const relief = buildMayaReliefPBR(anisotropy);
    const stucco = buildMayaRedStuccoPBR(anisotropy);

    [jungleMoss, sacbeRoad, limestoneDust, cenoteMoss].forEach((b) => {
      mayaTextures.push(b.albedo, b.normalRough);
    });
    [limestone, relief, stucco].forEach((pack) => {
      if (pack.map) mayaTextures.push(pack.map);
      if (pack.normalMap) mayaTextures.push(pack.normalMap);
      if (pack.roughnessMap) mayaTextures.push(pack.roughnessMap);
    });

    const mayaTerrainSplat = createTerrainSplatMaterial({
      sand: jungleMoss, // Biome 0: Lush tropical jungle moss, ferns & loam
      earthPath: sacbeRoad, // Biome 1: Sun-baked clay & ancient Sacbé stone causeway
      quarryDust: limestoneDust, // Biome 2: Pale-gold & jade-tinted limestone quarry dust
      oasisGrass: cenoteMoss, // Biome 3: Deep wet cenote rim moss & tropical fern loam
    });
    mayaTerrainSplat.customProgramCacheKey = () => 'workd-builder-maya-terrain-splat-v1';

    const mMats = {
      terrainSplat: mayaTerrainSplat,
      mayaLimestone: new THREE.MeshStandardMaterial({
        map: limestone.map,
        normalMap: limestone.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: limestone.roughnessMap,
        roughness: 1.0,
        metalness: 0.04,
      }),
      mayaRelief: new THREE.MeshStandardMaterial({
        map: relief.map,
        normalMap: relief.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: relief.roughnessMap,
        roughness: 0.96,
        metalness: 0.1,
      }),
      mayaStucco: new THREE.MeshStandardMaterial({
        map: stucco.map,
        normalMap: stucco.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: stucco.roughnessMap,
        roughness: 0.94,
        metalness: 0.08,
      }),
      mayaCliff: new THREE.MeshStandardMaterial({
        map: limestone.map,
        normalMap: limestone.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        color: new THREE.Color('#c5be9f'),
        roughness: 0.9,
        metalness: 0.03,
      }),
      rawMayaStone: new THREE.MeshStandardMaterial({
        map: limestoneDust.albedo,
        normalMap: limestone.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: limestone.roughnessMap,
        color: new THREE.Color('#dfd5b6'),
        roughness: 1.0,
        metalness: 0.04,
      }),
      jadeInlay: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1ea874'),
        emissive: new THREE.Color('#0d4d35'),
        emissiveIntensity: 0.25,
        roughness: 0.24,
        metalness: 0.22,
      }),
      redOchre: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#a83c2a'),
        roughness: 0.72,
        metalness: 0.04,
      }),
      jungleCanopy: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2d6b34'),
        roughness: 0.78,
        metalness: 0.02,
      }),
      jungleCanopyLight: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#478e42'),
        roughness: 0.74,
        metalness: 0.02,
      }),
      ceibaTrunk: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#5a4636'),
        roughness: 0.9,
        metalness: 0.02,
      }),
      hardwoodLog: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#5c3922'),
        roughness: 0.82,
        metalness: 0.04,
      }),
      thatchRoof: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b8924c'),
        roughness: 0.92,
        metalness: 0.01,
      }),
      obsidianBlade: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1c222a'),
        roughness: 0.16,
        metalness: 0.65,
      }),
    };

    Object.values(mMats).forEach((m) => mayaMaterials.push(m));
    mayaPack = { materials: mMats };
    return mayaPack;
  }

  return {
    maps: {
      blueprint: blueprintMap,
      shadowBlob: shadowBlobMap,
      sunbeam: sunbeamMap,
      waterNormal,
    },
    materials,
    ensureRomePack,
    ensureJapanPack,
    ensureMayaPack,
    dispose() {
      textures.forEach((t) => t.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      romeTextures.forEach((t) => t.dispose());
      romeMaterials.forEach((m) => m.dispose());
      japanTextures.forEach((t) => t.dispose());
      japanMaterials.forEach((m) => m.dispose());
      mayaTextures.forEach((t) => t.dispose());
      mayaMaterials.forEach((m) => m.dispose());
    },
  };
}

/* ============================================================================
 * LEVEL 2 (ANCIENT ROME) — PROCEDURAL 512x512 MEDITERRANEAN PBR TEXTURES
 * ========================================================================== */

/** Roman Biome 0: Lush Mediterranean Olive-Green Grass & Wildflowers (512x512) */
function buildRomanGrassPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const macro = tileFBM(u, v, 4, 3, 401);
      const blades = tileFBM(u * 2, v * 2, 16, 2, 419);
      const micro = hash2i(x, y, 433);
      const cell = tileWorley(u, v, 14, 449);

      // Warm sunlit olive-sage Tuscan hill grass
      let r = lerp(104, 152, macro) + (blades - 0.5) * 24 + (micro - 0.5) * 10;
      let g = lerp(128, 174, macro) + (blades - 0.5) * 26 + (micro - 0.5) * 10;
      let b = lerp(62, 92, macro) + (blades - 0.5) * 14 + (micro - 0.5) * 8;

      // Subtle wildflower specks (sun-gold chamomile & crimson poppies)
      if (cell.f1 < 0.085 && cell.id > 0.78) {
        if (cell.id > 0.9) {
          r = 224;
          g = 88;
          b = 64;
        } else {
          r = 244;
          g = 222;
          b = 124;
        }
      }

      height[i] = clamp01(0.45 + blades * 0.35 + (macro - 0.5) * 0.14 + (micro - 0.5) * 0.06);
      rough[i] = clamp01(0.84 - macro * 0.1 + (micro - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.4, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Roman Biome 1: Compacted Warm Terracotta Earth & Cobblestone Via Road (512x512) */
function buildRomanViaRoadPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const cobble = tileWorley(u, v, 8, 503);
      const stoneVar = tileFBM(u, v, 6, 3, 521);
      const grit = hash2i(x, y, 541);

      // Polygonal Roman paving stones (basalt/travertine) bordered by warm terracotta earth mortar
      const isStone = smoothstep(0.055, 0.125, cobble.edge);
      const shade = 0.85 + cobble.id * 0.24 + (stoneVar - 0.5) * 0.14;

      const earthR = 178 + (stoneVar - 0.5) * 20 + (grit - 0.5) * 14;
      const earthG = 122 + (stoneVar - 0.5) * 16 + (grit - 0.5) * 12;
      const earthB = 82 + (stoneVar - 0.5) * 12 + (grit - 0.5) * 10;

      const stoneR = 186 * shade + (grit - 0.5) * 10;
      const stoneG = 176 * shade + (grit - 0.5) * 10;
      const stoneB = 158 * shade + (grit - 0.5) * 10;

      const r = lerp(earthR, stoneR, isStone);
      const g = lerp(earthG, stoneG, isStone);
      const b = lerp(earthB, stoneB, isStone);

      height[i] = clamp01(0.24 + isStone * 0.58 + (stoneVar - 0.5) * 0.12 + (grit - 0.5) * 0.04);
      rough[i] = clamp01(lerp(0.9, 0.64, isStone) + (grit - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 3.4, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Roman Biome 2: Pale Crushed Travertine & Marble Quarry Dust (512x512) */
function buildTravertineDustPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const dust = tileFBM(u, v, 5, 3, 601);
      const chips = tileWorley(u, v, 14, 617);
      const grit = hash2i(x, y, 631);
      const chipMask = smoothstep(0.18, 0.04, chips.f1);

      const base = lerp(214, 240, dust) + chipMask * 14 + (grit - 0.5) * 12;
      height[i] = clamp01(0.42 + dust * 0.28 + chipMask * 0.22 + (grit - 0.5) * 0.06);
      rough[i] = clamp01(0.82 - chipMask * 0.22 + (grit - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(base)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(base * 0.965)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(base * 0.895)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.5, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** White/Cream Travertine Marble PBR (512x512 Albedo + Normal + Roughness) */
function buildRomanTravertinePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      const warp = tileFBM(u, v, 4, 3, 701) * 0.26;
      const strata = Math.sin((v * 7 + warp * 2.8) * Math.PI * 2) * 0.5 + 0.5;
      const pores = tileFBM(u * 2, v * 4, 12, 2, 719);
      const grain = hash2i(x, y, 733);
      const pit = pores < 0.28 ? (0.28 - pores) * 2.6 : 0;

      const r = lerp(226, 248, strata) - pit * 36 + (grain - 0.5) * 8;
      const g = lerp(218, 242, strata) - pit * 38 + (grain - 0.5) * 8;
      const b = lerp(200, 228, strata) - pit * 40 + (grain - 0.5) * 8;

      height[i] = clamp01(0.65 + (strata - 0.5) * 0.16 - pit * 0.45 + (grain - 0.5) * 0.04);
      rough[i] = clamp01(0.48 + pit * 0.38 + (1 - strata) * 0.1);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.6);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Carved Roman Ashlar Stone Blocks PBR (512x512 Albedo + Normal + Roughness) */
function buildRomanAshlarPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // Crisp beveled perimeter & classic Roman ashlar masonry courses
      const edgeX = Math.min(u, 1 - u);
      const edgeY = Math.min(v, 1 - v);
      const bevel = smoothstep(0.018, 0.072, Math.min(edgeX, edgeY));
      const midSeam = smoothstep(0.008, 0.025, Math.abs(v - 0.5));
      const courseMask = bevel * (0.45 + 0.55 * midSeam);

      const stone = tileFBM(u, v, 5, 3, 751);
      const grain = hash2i(x, y, 769);

      const r = lerp(196, 245, courseMask) + (stone - 0.5) * 14 + (grain - 0.5) * 7;
      const g = lerp(182, 235, courseMask) + (stone - 0.5) * 14 + (grain - 0.5) * 7;
      const b = lerp(158, 214, courseMask) + (stone - 0.5) * 12 + (grain - 0.5) * 7;

      height[i] = clamp01(0.25 + courseMask * 0.62 + (stone - 0.5) * 0.08);
      rough[i] = clamp01(lerp(0.82, 0.46, courseMask) + (grain - 0.5) * 0.06);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.0);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Fluted Marble Columns PBR (512x512 Albedo + Normal + Roughness) */
function buildRomanFlutedColumnPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // 16 classical concave Doric/Ionic flutes around circumference
      const flutePhase = (u * 16) % 1;
      const ridge = Math.pow(Math.abs(flutePhase * 2 - 1), 1.7);
      const collar = v < 0.08 || v > 0.92 ? 1.0 : 0.0;
      const vein = tileFBM(u, v, 5, 2, 809);
      const grain = hash2i(x, y, 821);

      const lum = lerp(220, 250, Math.max(ridge, collar)) - (1 - vein) * 14 + (grain - 0.5) * 6;
      height[i] = clamp01(0.3 + Math.max(ridge, collar) * 0.62 + (vein - 0.5) * 0.06);
      rough[i] = clamp01(0.32 + (1 - ridge) * 0.14);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(lum)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.98)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.93)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Warm Terracotta Roman Roof Tiles — Tegulae & Imbrices (512x512 Albedo + Normal + Roughness) */
function buildRomanTerracottaRoofPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // 6 vertical barrel tile ribs (imbrices) & 5 horizontal overlapping courses (tegulae)
      const col = (u * 6) % 1;
      const row = (v * 5) % 1;
      const tileIdx = Math.floor(u * 6) + Math.floor(v * 5) * 7;
      const tileJitter = hash2i(tileIdx, 3, 857);

      // Raised semi-cylindrical ridge between flat pan tiles
      const rib = smoothstep(0.22, 0.0, Math.min(col, 1 - col));
      const lip = smoothstep(0.0, 0.14, row);
      const clay = tileFBM(u, v, 6, 2, 877);
      const grit = hash2i(x, y, 887);

      const h = clamp01(0.28 + rib * 0.48 + lip * 0.22 + (clay - 0.5) * 0.06);
      height[i] = h;

      // Sunbaked Roman terracotta palette (warm burnt orange-red & ochre highlights)
      const shade = 0.84 + tileJitter * 0.22 + rib * 0.16 - (1 - lip) * 0.24;
      const r = 204 * shade + (clay - 0.5) * 14 + (grit - 0.5) * 8;
      const g = 98 * shade + (clay - 0.5) * 10 + (grit - 0.5) * 6;
      const b = 56 * shade + (clay - 0.5) * 8 + (grit - 0.5) * 6;

      rough[i] = clamp01(0.76 - rib * 0.14 + (grit - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.8);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Decorative Roman Atrium Geometric Mosaic Tile Pattern (512x512) */
function buildRomanMosaicFloor(anisotropy) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  // Cream travertine mosaic base
  ctx.fillStyle = '#efe3cb';
  ctx.fillRect(0, 0, size, size);

  // Subtle tesserae grid lines
  ctx.strokeStyle = 'rgba(136, 114, 86, 0.22)';
  ctx.lineWidth = 1;
  for (let p = 0; p < size; p += 16) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Terracotta & charcoal Roman meander outer border
  ctx.strokeStyle = '#9c4028';
  ctx.lineWidth = 18;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  ctx.strokeStyle = '#333b42';
  ctx.lineWidth = 10;
  ctx.strokeRect(48, 48, size - 96, size - 96);

  // Inner golden-ochre decorative diamond mosaic tiles
  ctx.fillStyle = '#c88e42';
  const step = 64;
  for (let y = 96; y <= size - 96; y += step) {
    for (let x = 96; x <= size - 96; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x + 16, y);
      ctx.lineTo(x, y + 16);
      ctx.lineTo(x - 16, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  return wrapTexture(canvas, { isColor: true, anisotropy });
}

/* ============================================================================
 * LEVEL 3 (FEUDAL JAPAN) — PROCEDURAL 512x512 ZEN GARDEN & MINKA PBR TEXTURES
 * ========================================================================== */

/** Japan Biome 0: Mossy Emerald Forest Grass & Fallen Sakura Petals (512x512) */
function buildJapanMossGrassPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const macro = tileFBM(u, v, 5, 3, 2101);
      const tuft = tileFBM(u, v, 22, 2, 2117);
      const blade = hash2i(x, y, 2131);

      const h = clamp01(0.4 + (macro - 0.5) * 0.25 + (tuft - 0.5) * 0.34 + (blade - 0.5) * 0.14);
      height[i] = h;

      // Rich emerald-moss velvet palette with sunlit chartreuse highlights
      let r = 64 + macro * 34 + tuft * 18 + (blade - 0.5) * 10;
      let g = 114 + macro * 42 + tuft * 24 + (blade - 0.5) * 12;
      let b = 52 + macro * 18 + tuft * 10 + (blade - 0.5) * 8;

      // Subtle scattered pale-pink fallen sakura petals on the moss
      const petal = hash2i(Math.floor(x / 5), Math.floor(y / 5), 2143);
      if (petal > 0.992) {
        r = 246;
        g = 196;
        b = 212;
      }

      rough[i] = clamp01(0.84 + (0.5 - tuft) * 0.16);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.5, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Japan Biome 1: Raked White Zen Gravel (Karesansui waves, 512x512) */
function buildJapanZenGravelPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const wave = Math.sin((v * 14 + Math.sin(u * Math.PI * 2) * 0.45) * Math.PI * 2);
      const grit = tileFBM(u, v, 36, 2, 2203);
      const pebble = hash2i(x, y, 2221);

      const ridge = wave * 0.5 + 0.5;
      const h = clamp01(0.26 + ridge * 0.54 + (grit - 0.5) * 0.16 + (pebble - 0.5) * 0.1);
      height[i] = h;

      // Crisp pale white-silver Zen gravel with cool slate groove shadows
      const shade = 0.86 + ridge * 0.14 + (grit - 0.5) * 0.08 + (pebble - 0.5) * 0.07;
      const r = 228 * shade;
      const g = 225 * shade;
      const b = 219 * shade;

      rough[i] = clamp01(0.82 + (0.5 - ridge) * 0.14);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 3.2, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Japan Biome 2: Crushed Grey Volcanic Basalt Quarry Dust (512x512) */
function buildJapanBasaltDustPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const macro = tileFBM(u, v, 8, 3, 2309);
      const chips = tileFBM(u, v, 28, 2, 2333);
      const grain = hash2i(x, y, 2347);

      const h = clamp01(0.42 + (macro - 0.5) * 0.34 + (chips - 0.5) * 0.32 + (grain - 0.5) * 0.14);
      height[i] = h;

      // Cool volcanic granite-basalt grey with faint warm mineral flecks
      const base = 104 + macro * 42 + (chips - 0.5) * 30 + (grain - 0.5) * 14;
      const r = base - 2;
      const g = base + 1;
      const b = base + 7;

      rough[i] = clamp01(0.84 + (0.5 - chips) * 0.16);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 3.0, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Japan Biome 3: Compacted Dark Garden Earth & Bamboo Soil (512x512) */
function buildJapanDarkEarthPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const soil = tileFBM(u, v, 9, 3, 2411);
      const pebble = tileFBM(u, v, 24, 2, 2423);
      const grain = hash2i(x, y, 2437);

      height[i] = clamp01(0.45 + (soil - 0.5) * 0.28 + (pebble - 0.5) * 0.22);
      const shade = 0.8 + soil * 0.34 + (pebble - 0.5) * 0.14 + (grain - 0.5) * 0.08;
      const r = 92 * shade;
      const g = 74 * shade;
      const b = 56 * shade;

      rough[i] = clamp01(0.88 + (0.5 - soil) * 0.12);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.6, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Carved Grey Japanese Foundation Stone — Ishigaki Interlocking Ashlar (512x512) */
function buildJapanIshigakiPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 4;
  const cols = 3;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowIdx = Math.floor(v * rows);
    const rowFrac = (v * rows) % 1;
    const rowShift = (rowIdx % 2) * 0.48;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const colRaw = (u * cols + rowShift) % cols;
      const colIdx = Math.floor(colRaw);
      const colFrac = colRaw % 1;

      const edgeX = Math.min(colFrac, 1 - colFrac);
      const edgeY = Math.min(rowFrac, 1 - rowFrac);
      const mortar = Math.min(smoothstep(0.025, 0.08, edgeX), smoothstep(0.03, 0.09, edgeY));

      const stoneTone = hash2i(colIdx + rowIdx * 7, rowIdx, 2503);
      const granite = tileFBM(u, v, 14, 3, 2521);
      const speckle = hash2i(x, y, 2539);
      const moss = tileFBM(u, v, 7, 2, 2551);

      const h = clamp01(0.16 + mortar * (0.64 + (granite - 0.5) * 0.22 + (speckle - 0.5) * 0.08));
      height[i] = h;

      // Cool blue-grey Kyoto granite blocks with dark mortar seams and whisper of moss
      const base = 114 + stoneTone * 34 + (granite - 0.5) * 24 + (speckle - 0.5) * 14;
      const mossAmt = (1 - mortar) * smoothstep(0.55, 0.8, moss) * 0.55;
      const r = base * (0.48 + mortar * 0.52) - mossAmt * 28;
      const g = (base + 3) * (0.48 + mortar * 0.52) + mossAmt * 22;
      const b = (base + 9) * (0.48 + mortar * 0.52) - mossAmt * 24;

      rough[i] = clamp01(0.84 - mortar * 0.1 + (speckle - 0.5) * 0.08);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Dark Cedar Timber Frame & Translucent Rice-Paper Shoji Lattice Walls (512x512) */
function buildJapanShojiWallPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;

      // Outer structural dark cedar posts & top/bottom rails + wainscot kickboard (bottom 26%)
      const isOuterPost = u < 0.1 || u > 0.9 || v < 0.1 || v > 0.74;
      // Fine Kumiko shoji wooden lattice bars (4x3 grid inside upper paper panel)
      const inPaper = !isOuterPost;
      const gx = ((u - 0.1) / 0.8) * 4;
      const gy = ((v - 0.1) / 0.64) * 3;
      const fx = gx % 1;
      const fy = gy % 1;
      const isLattice = inPaper && (fx < 0.085 || fx > 0.915 || fy < 0.095 || fy > 0.905);

      const woodGrain = tileFBM(u * 2.5, v * 0.5, 16, 2, 2609);
      const paperFiber = tileFBM(u, v, 24, 2, 2621);

      let r, g, b;
      if (isOuterPost) {
        const panelSlot = v > 0.74 ? smoothstep(0.76, 0.79, v) : 0;
        const plankGroove = panelSlot > 0 ? smoothstep(0.03, 0.07, Math.abs(((u * 8) % 1) - 0.5)) : 1;
        const shade = 0.76 + woodGrain * 0.34 - (1 - plankGroove) * 0.14;
        r = 74 * shade;
        g = 48 * shade;
        b = 34 * shade;
        height[i] = clamp01(0.78 + (woodGrain - 0.5) * 0.12 - (1 - plankGroove) * 0.15);
        rough[i] = clamp01(0.74 + (0.5 - woodGrain) * 0.12);
      } else if (isLattice) {
        const shade = 0.84 + woodGrain * 0.24;
        r = 96 * shade;
        g = 64 * shade;
        b = 44 * shade;
        height[i] = 0.66;
        rough[i] = 0.72;
      } else {
        // Warm backlit cream washi rice paper with subtle organic fiber grain
        const warmGlow = 0.94 + (paperFiber - 0.5) * 0.1;
        r = 247 * warmGlow;
        g = 236 * warmGlow;
        b = 207 * warmGlow;
        height[i] = 0.28 + (paperFiber - 0.5) * 0.04;
        rough[i] = 0.62;
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.4);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Curved Dark Slate-Blue Glazed Japanese Kawara Roof Tiles (512x512) */
function buildJapanKawaraRoofPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const cols = 7;
  const rows = 6;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = (v * rows) % 1;
    const rowId = Math.floor(v * rows);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const col = (u * cols) % 1;
      const colId = Math.floor(u * cols);

      // Iconic concave pan + raised round semicircular marugawara ridge rib
      const distRib = Math.min(col, 1 - col);
      const rib = smoothstep(0.24, 0.0, distRib);
      const panCurve = Math.sin(col * Math.PI) * 0.14;
      const overlapShadow = smoothstep(0.0, 0.16, row);
      const tileVar = hash2i(colId, rowId, 2707);
      const glaze = tileFBM(u, v, 10, 2, 2719);

      const h = clamp01(0.22 + rib * 0.54 + (0.14 - panCurve) + overlapShadow * 0.2);
      height[i] = h;

      // Deep slate-indigo / smoky silver-blue Japanese kawara glaze
      const shade = 0.78 + tileVar * 0.2 + rib * 0.28 - (1 - overlapShadow) * 0.34 + (glaze - 0.5) * 0.08;
      const r = 56 * shade;
      const g = 68 * shade;
      const b = 86 * shade;

      rough[i] = clamp01(0.54 - rib * 0.2 + (glaze - 0.5) * 0.1);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.0);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Dark-Stained Aged Japanese Cedar Timber Beams (512x512) */
function buildJapanCedarTimberPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const streak = tileFBM(u * 0.4, v * 4.2, 12, 3, 2801);
      const rings = Math.sin((v * 26 + streak * 3.2) * Math.PI * 2) * 0.5 + 0.5;
      const h = clamp01(0.4 + (streak - 0.5) * 0.35 + (rings - 0.5) * 0.25);
      height[i] = h;

      const shade = 0.72 + streak * 0.36 + rings * 0.12;
      const r = 72 * shade;
      const g = 46 * shade;
      const b = 33 * shade;

      rough[i] = clamp01(0.76 - rings * 0.1);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.8);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Warm Honey-Cedar Hinoki Engawa Veranda Deck Floorboards (512x512) */
function buildJapanEngawaDeckPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const planks = 8;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const pIdx = Math.floor(v * planks);
    const pFrac = (v * planks) % 1;
    const seam = smoothstep(0.02, 0.08, Math.min(pFrac, 1 - pFrac));
    const plankTint = hash2i(pIdx, 3, 2903);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const grain = tileFBM(u * 0.5, v * 3.0, 14, 2, 2917);

      height[i] = clamp01(0.2 + seam * (0.65 + (grain - 0.5) * 0.16));
      const shade = (0.8 + plankTint * 0.16 + (grain - 0.5) * 0.12) * (0.58 + seam * 0.42);
      const r = 186 * shade;
      const g = 132 * shade;
      const b = 78 * shade;

      rough[i] = clamp01(0.58 + (1 - seam) * 0.24);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.5);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * LEVEL 4 (MAYAN CIVILIZATION) — PROCEDURAL 512x512 YUCATÁN JUNGLE & TEMPLE PBR
 * ========================================================================== */

/** Maya Biome 0: Lush Tropical Jungle Moss, Ferns & Rich Loam Soil (512x512) */
function buildMayaJungleMossPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const canopy = tileFBM(u, v, 5, 3, 3109);
      const fern = tileFBM(u, v, 20, 2, 3121);
      const grain = hash2i(x, y, 3137);

      height[i] = clamp01(0.4 + (canopy - 0.5) * 0.28 + (fern - 0.5) * 0.34 + (grain - 0.5) * 0.14);
      // Deep tropical Yucatan emerald-moss & rich soil patches
      const loam = smoothstep(0.62, 0.85, 1 - canopy);
      const r = lerp(42 + canopy * 34 + fern * 22, 74, loam) + (grain - 0.5) * 10;
      const g = lerp(96 + canopy * 48 + fern * 28, 66, loam) + (grain - 0.5) * 12;
      const b = lerp(40 + canopy * 18 + fern * 12, 42, loam) + (grain - 0.5) * 8;

      rough[i] = clamp01(0.84 + (0.5 - fern) * 0.16);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.7, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Maya Biome 1: Sun-Baked Clay & Ancient Sacbé Limestone Causeway (512x512) */
function buildMayaSacbeCausewayPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const cell = tileWorley(u, v, 7, 3203);
      const stoneMask = smoothstep(0.06, 0.17, cell.f2 - cell.f1);
      const texture = tileFBM(u, v, 14, 2, 3221);
      const grit = hash2i(x, y, 3251);

      height[i] = clamp01(0.2 + stoneMask * (0.62 + (texture - 0.5) * 0.22));
      // Warm sun-baked Yucatán limestone flagstones set in red-ochre clay soil
      const sShade = 0.86 + cell.id * 0.16 + (texture - 0.5) * 0.12 + (grit - 0.5) * 0.06;
      const r = lerp(146, 206 * sShade, stoneMask);
      const g = lerp(104, 186 * sShade, stoneMask);
      const b = lerp(74, 142 * sShade, stoneMask);

      rough[i] = clamp01(0.86 - stoneMask * 0.12 + (grit - 0.5) * 0.08);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 3.3, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Maya Biome 2: Pale-Gold & Jade-Tinted Yucatán Limestone Quarry Dust (512x512) */
function buildMayaLimestoneDustPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const macro = tileFBM(u, v, 8, 3, 3307);
      const chips = tileFBM(u, v, 24, 2, 3323);
      const jadeVein = smoothstep(0.68, 0.86, tileFBM(u * 1.4, v * 1.4, 9, 2, 3343));
      const grit = hash2i(x, y, 3361);

      height[i] = clamp01(0.42 + (macro - 0.5) * 0.3 + (chips - 0.5) * 0.32);
      const shade = 0.84 + macro * 0.24 + (chips - 0.5) * 0.16 + (grit - 0.5) * 0.08;
      const r = lerp(212 * shade, 118, jadeVein * 0.55);
      const g = lerp(198 * shade, 168, jadeVein * 0.55);
      const b = lerp(152 * shade, 134, jadeVein * 0.55);

      rough[i] = clamp01(0.84 - jadeVein * 0.22 + (grit - 0.5) * 0.08);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.9, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Maya Biome 3: Deep Wet Cenote Rim Moss & Dark Tropical Soil (512x512) */
function buildMayaCenoteMossPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const moss = tileFBM(u, v, 8, 3, 3407);
      const fine = tileFBM(u, v, 24, 2, 3433);
      height[i] = clamp01(0.45 + (moss - 0.5) * 0.3 + (fine - 0.5) * 0.22);

      const r = 34 + moss * 26 + fine * 14;
      const g = 88 + moss * 44 + fine * 20;
      const b = 52 + moss * 24 + fine * 12;

      rough[i] = clamp01(0.72 + (0.5 - moss) * 0.16);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.6, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Weathered Mayan Yucatán Limestone Ashlar Blocks with Moss Crevices (512x512) */
function buildMayaLimestonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 4;
  const cols = 3;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowIdx = Math.floor(v * rows);
    const rowFrac = (v * rows) % 1;
    const rowShift = (rowIdx % 2) * 0.5;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const colRaw = (u * cols + rowShift) % cols;
      const colIdx = Math.floor(colRaw);
      const colFrac = colRaw % 1;

      const edgeX = Math.min(colFrac, 1 - colFrac);
      const edgeY = Math.min(rowFrac, 1 - rowFrac);
      const mortar = Math.min(smoothstep(0.025, 0.08, edgeX), smoothstep(0.03, 0.09, edgeY));

      const blockVar = hash2i(colIdx + rowIdx * 9, rowIdx, 3511);
      const weather = tileFBM(u, v, 12, 3, 3527);
      const moss = smoothstep(0.56, 0.82, tileFBM(u, v, 7, 2, 3541));
      const grain = hash2i(x, y, 3557);

      height[i] = clamp01(0.16 + mortar * (0.66 + (weather - 0.5) * 0.2 + (grain - 0.5) * 0.08));

      // Warm aged Yucatan limestone with mossy tropical crevices
      const tone = 0.82 + blockVar * 0.22 + (weather - 0.5) * 0.16 + (grain - 0.5) * 0.06;
      const mossFactor = (1 - mortar) * moss * 0.72 + mortar * smoothstep(0.75, 0.92, moss) * 0.22;
      const r = lerp(206 * tone * (0.54 + mortar * 0.46), 74, mossFactor);
      const g = lerp(188 * tone * (0.54 + mortar * 0.46), 116, mossFactor);
      const b = lerp(142 * tone * (0.54 + mortar * 0.46), 64, mossFactor);

      rough[i] = clamp01(0.86 - mortar * 0.1 + (grain - 0.5) * 0.08);
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Carved Mayan Feathered-Serpent Relief & Jade-Inlaid Stone (512x512) */
function buildMayaReliefPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const stone = tileFBM(u, v, 14, 3, 3607);
      const grit = hash2i(x, y, 3617);

      // Stepped Mesoamerican fret frieze band across middle (v in 0.24..0.76) + cornice borders
      const isBorder = v < 0.16 || v > 0.84;
      const bandV = clamp01((v - 0.18) / 0.64);
      const cellU = (u * 4) % 1;
      // Stepped Mayan key/diamond motif & central emerald-jade glyph medallion
      const dx = Math.abs(cellU - 0.5);
      const dy = Math.abs(bandV - 0.5);
      const isFret = !isBorder && (dx + dy > 0.28 && dx + dy < 0.44);
      const isJade = !isBorder && Math.hypot(dx * 1.15, dy * 1.15) < 0.16;

      let r, g, b;
      if (isJade) {
        // Gleaming polished emerald-jade medallion inlay
        const gleam = 0.86 + stone * 0.28;
        r = 32 * gleam;
        g = 172 * gleam;
        b = 118 * gleam;
        height[i] = 0.86;
        rough[i] = 0.26;
      } else {
        const reliefH = isBorder ? 0.82 : isFret ? 0.78 : 0.42;
        const shade = (0.78 + reliefH * 0.28 + (stone - 0.5) * 0.14 + (grit - 0.5) * 0.06);
        r = 202 * shade;
        g = 182 * shade;
        b = 136 * shade;
        height[i] = clamp01(reliefH + (stone - 0.5) * 0.14);
        rough[i] = clamp01(0.84 - reliefH * 0.1);
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.0);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Red-Ochre Mayan Stucco Temple Trim & Jade-Inlaid Cornice (512x512) */
function buildMayaRedStuccoPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const plaster = tileFBM(u, v, 10, 3, 3709);
      const chip = smoothstep(0.66, 0.84, tileFBM(u, v, 16, 2, 3727));
      const grit = hash2i(x, y, 3739);

      const isJadeStripe = v > 0.14 && v < 0.24;
      const isLimestoneTrim = v < 0.12 || v > 0.86;

      let r, g, b;
      if (isJadeStripe) {
        const seg = smoothstep(0.06, 0.14, Math.abs(((u * 8) % 1) - 0.5));
        const glow = 0.84 + plaster * 0.25;
        r = lerp(52, 34 * glow, seg);
        g = lerp(96, 166 * glow, seg);
        b = lerp(74, 114 * glow, seg);
        height[i] = 0.84;
        rough[i] = 0.34;
      } else if (isLimestoneTrim) {
        const s = 0.88 + (plaster - 0.5) * 0.16;
        r = 212 * s;
        g = 194 * s;
        b = 148 * s;
        height[i] = 0.78;
        rough[i] = 0.78;
      } else {
        // Rich ceremonial Mayan red-ochre stucco weathered softly to pale limestone beneath
        const s = 0.82 + plaster * 0.28 + (grit - 0.5) * 0.08;
        r = lerp(176 * s, 206 * s, chip * 0.65);
        g = lerp(66 * s, 184 * s, chip * 0.65);
        b = lerp(48 * s, 142 * s, chip * 0.65);
        height[i] = clamp01(0.62 - chip * 0.22 + (plaster - 0.5) * 0.12);
        rough[i] = clamp01(0.76 + chip * 0.14);
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}


