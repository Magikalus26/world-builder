/**
 * Workd Builder — Procedural 512x512 PBR Texture & Material Generator
 * Generates tileable Diffuse (Albedo), Sobel-filtered Normal Maps, Roughness Maps,
 * and packed Normal+Roughness maps for 4-biome terrain splatting, limestone,
 * beveled hieroglyphic sandstone, weathered timber, golden capstone, and animated Nile water.
 * Zero external image files; memory-capped at 512x512 (anisotropy <= 4) for iPhone 16e 60 FPS.
 */

import * as THREE from 'three';
import { applyCrispTextureSettings, getGlobalMaxAnisotropy } from './graphicsCore.js';
import { MaterialFactory } from './materialFactory.js';

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

function wrapTexture(canvas, { repeat = [1, 1], isColor = true, anisotropy = null } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  return applyCrispTextureSettings(tex, {
    isColor,
    repeat,
    wrap: true,
    anisotropy: anisotropy || getGlobalMaxAnisotropy(),
  });
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
 * 7. PROGRESSIVE CARVING STAGES (STAGE 1 ROUGH-HEWN & STAGE 2 FINE-DRESSED, 512x512 PBR)
 *    Stage 1: Bright diagonal chisel gouge marks, chipped raw corners & half-exposed inner grain
 *    Stage 2: Crisp parallel tooth-chisel dressing grooves, pale dust edge lines & emerging trim
 * ========================================================================== */
function buildCarvingStageTexture(stage, anisotropy) {
  const size = 512;
  const canvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const data = img.data;
  const rData = rImg.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const edgeDist = Math.min(u, 1 - u, v, 1 - v);
      const cornerDist = Math.min(
        Math.hypot(u, v),
        Math.hypot(1 - u, v),
        Math.hypot(u, 1 - v),
        Math.hypot(1 - u, 1 - v)
      );
      const macro = tileFBM(u, v, 6, 3, stage === 1 ? 811 : 853);
      const fine = tileFBM(u, v, 20, 3, stage === 1 ? 829 : 863);
      const grain = hash2i(x, y, stage === 1 ? 881 : 887);

      let r, g, b, h, roughVal;

      if (stage === 1) {
        // STAGE 1 (Rough-Hewn / 1st Chisel Strike):
        // Bold bright diagonal chisel gouges cutting across rough stone + chipped dark raw corners
        const diag = u * 11.0 + v * 6.5 + (macro - 0.5) * 1.4;
        const gougeWave = Math.sin(diag * Math.PI * 2);
        const chiselScars = smoothstep(0.45, 0.92, gougeWave) * smoothstep(0.06, 0.22, edgeDist);
        const chipCorner = 1.0 - smoothstep(0.08, 0.28 + (macro - 0.5) * 0.08, cornerDist);
        const rawRim = 1.0 - smoothstep(0.03, 0.14, edgeDist);
        const fracture = smoothstep(0.68, 0.86, tileFBM(u * 1.4, v * 1.4, 9, 2, 823));

        // Exposed inner stone where chisel struck vs darker dusty unworked corners
        const innerMix = clamp01(0.48 + chiselScars * 0.52 - chipCorner * 0.65 - rawRim * 0.35);
        const baseR = lerp(146, 214, innerMix) + chiselScars * 28 - fracture * 22;
        const baseG = lerp(132, 194, innerMix) + chiselScars * 26 - fracture * 20;
        const baseB = lerp(112, 162, innerMix) + chiselScars * 22 - fracture * 16;

        const shade = 0.88 + (fine - 0.5) * 0.22 + (grain - 0.5) * 0.08;
        r = baseR * shade;
        g = baseG * shade;
        b = baseB * shade;

        h = clamp01(
          0.56 - chiselScars * 0.26 - chipCorner * 0.24 - fracture * 0.18 + (fine - 0.5) * 0.24
        );
        roughVal = clamp01(0.92 - chiselScars * 0.2 + chipCorner * 0.06 + (0.5 - fine) * 0.08);
      } else {
        // STAGE 2 (Fine-Dressed / 2nd Chisel Strike):
        // Crisp parallel tooth-chisel dressing grooves, pale chalk-dust perimeter lines, emerging trim
        const grooveU = Math.sin((u * 34.0 + (macro - 0.5) * 0.35) * Math.PI * 2) * 0.5 + 0.5;
        const grooveV = Math.sin((v * 22.0 + (macro - 0.5) * 0.25) * Math.PI * 2) * 0.5 + 0.5;
        const dressing = grooveU * 0.68 + grooveV * 0.32;

        // Pale stone-dust drafting line tracing the nearly-squared outer margin
        const marginBand =
          smoothstep(0.035, 0.065, edgeDist) * (1.0 - smoothstep(0.075, 0.115, edgeDist));
        const trimGroove = Math.abs(edgeDist - 0.095) < 0.01 ? 1.0 : 0.0;
        const courseHint = Math.abs(((v * 2) % 1) - 0.5) > 0.486 ? 0.55 : 0.0;

        const baseR = 204 + dressing * 18 + marginBand * 32 - trimGroove * 28 - courseHint * 24;
        const baseG = 188 + dressing * 16 + marginBand * 30 - trimGroove * 26 - courseHint * 22;
        const baseB = 162 + dressing * 14 + marginBand * 26 - trimGroove * 22 - courseHint * 18;

        const shade = 0.92 + (macro - 0.5) * 0.14 + (fine - 0.5) * 0.1 + (grain - 0.5) * 0.05;
        r = baseR * shade;
        g = baseG * shade;
        b = baseB * shade;

        h = clamp01(
          0.62 + (dressing - 0.5) * 0.22 - trimGroove * 0.28 - courseHint * 0.18 + (fine - 0.5) * 0.1
        );
        roughVal = clamp01(0.76 - dressing * 0.1 + marginBand * 0.14 + trimGroove * 0.16);
      }

      height[i] = h;
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;

      const rByte = Math.round(roughVal * 255);
      rData[idx] = rByte;
      rData[idx + 1] = rByte;
      rData[idx + 2] = rByte;
      rData[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, stage === 1 ? 3.8 : 3.2);

  return {
    map: wrapTexture(canvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
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
    roughness: 0.9,
    metalness: 0.0,
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

    shader.uniforms.uNormalStrength = { value: 0.88 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aSplat;
        attribute float aWetness;
        varying vec4 vSplat;
        varying float vWetness;
        varying vec2 vTerrainUv;
        varying vec2 vWorldXZ;
        varying vec3 vTerrainT;
        varying vec3 vTerrainB;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSplat = aSplat;
        vWetness = aWetness;
        vWorldXZ = position.xz;
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
        varying vec2 vWorldXZ;
        varying vec3 vTerrainT;
        varying vec3 vTerrainB;

        float terrainOrganicWave(vec2 p) {
          float w1 = sin(p.x * 0.85 + cos(p.y * 0.72) * 1.15) * cos(p.y * 0.91 - sin(p.x * 0.63));
          float w2 = sin(p.x * 2.15 - p.y * 1.85) * 0.5 + cos(p.x * 1.45 + p.y * 2.35) * 0.5;
          return w1 * 0.62 + w2 * 0.38;
        }`
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

        // Crisp, natural height-modulated transitions (eliminates muddy blurry fade bands)
        float edgeN = terrainOrganicWave(vWorldXZ * 1.15);
        vec4 microH = vec4(nr0.b, nr1.b, nr2.b, nr3.b);
        vec4 activeMask = step(0.012, vSplat);
        vec4 h = vSplat + (microH - 0.5) * 0.22 * activeMask + vec4(edgeN, -edgeN, edgeN * 0.6, -edgeN * 0.6) * 0.075 * activeMask;
        float maxH = max(max(h.x, h.y), max(h.z, h.w));
        vec4 w = max(h - (maxH - 0.165), vec4(0.0));
        w = w * w;
        w /= max(w.x + w.y + w.z + w.w, 0.00001);

        vec3 splatColor = c0.rgb * w.x + c1.rgb * w.y + c2.rgb * w.z + c3.rgb * w.w;
        vec4 splatNR = nr0 * w.x + nr1 * w.y + nr2 * w.z + nr3 * w.w;

        // Cozy painterly micro-hue variations on grassy zones (meadow green, moss green, sunlit gold touches)
        float greenMask = smoothstep(0.03, 0.15, splatColor.g - max(splatColor.r * 0.94, splatColor.b * 1.12));
        float patchMoss = smoothstep(-0.25, 0.65, terrainOrganicWave(vWorldXZ * 0.42 + vec2(3.1, -1.7)));
        float patchGold = smoothstep(0.28, 0.85, terrainOrganicWave(vWorldXZ * 0.64 + vec2(-4.4, 2.9)));
        vec3 grassTint = mix(vec3(0.86, 0.94, 0.82), vec3(1.04, 1.06, 0.92), patchMoss);
        grassTint = mix(grassTint, vec3(1.14, 1.09, 0.78), patchGold * 0.52);
        splatColor *= mix(vec3(1.0), grassTint, greenMask);

        // Shoreline dampness & wet silt darkening where terrain meets water
        float wet = clamp(vWetness, 0.0, 1.0);
        splatColor *= mix(1.0, 0.58, wet);
        diffuseColor.rgb *= splatColor;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float dryRough = clamp(roughness * mix(0.92, 1.06, splatNR.a), 0.84, 0.96);
        float roughnessFactor = mix(dryRough, 0.2, clamp(vWetness, 0.0, 1.0));`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 mapN = splatNR.rgb * 2.0 - 1.0;
        mapN.xy *= uNormalStrength * mix(1.0, 0.45, clamp(vWetness, 0.0, 1.0));
        normal = normalize(normalize(vTerrainT) * mapN.x + normalize(vTerrainB) * mapN.y + normal * mapN.z);`
      );
  };

  mat.customProgramCacheKey = () => 'workd-builder-terrain-splat-cozy-v2';
  return mat;
}

/**
 * Generates and caches all procedural 512x512 PBR textures and shared materials.
 */
export function createTextureLibrary(renderer) {
  const anisotropy =
    renderer && renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === 'function'
      ? renderer.capabilities.getMaxAnisotropy()
      : getGlobalMaxAnisotropy();
  const materialFactory = new MaterialFactory(renderer);

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
    carving1.roughnessMap,
    carving2.map,
    carving2.normalMap,
    carving2.roughnessMap,
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
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: carving1.roughnessMap,
      roughness: 1.0,
      metalness: 0.04,
    }),
    carvingStage2: new THREE.MeshStandardMaterial({
      map: carving2.map,
      normalMap: carving2.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: carving2.roughnessMap,
      roughness: 1.0,
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

  let penitentiaryPack = null;
  const penitentiaryTextures = [];
  const penitentiaryMaterials = [];

  function ensurePenitentiaryPack() {
    if (penitentiaryPack) return penitentiaryPack;

    const ochreDirt = buildOchreDirtPBR(anisotropy);
    const greyGravel = buildGreyGravelPBR(anisotropy);
    const quarryClay = buildGraniteClayQuarryPBR(anisotropy);
    const frontierScrub = buildFrontierScrubPBR(anisotropy);

    const dressedGranite = buildDressedGranitePBR(anisotropy);
    const graniteLoophole = buildGraniteLoopholePBR(anisotropy);
    const darkRedBrick = buildDarkRedBrickPBR(anisotropy);
    const brickCellBars = buildBrickCellBarsPBR(anisotropy);
    const darkSlateRoof = buildDarkSlateRoofPBR(anisotropy);
    const corrugatedTin = buildCorrugatedTinPBR(anisotropy);
    const usFlagTex = build1800sUSFlagTexture(anisotropy);

    [ochreDirt, greyGravel, quarryClay, frontierScrub].forEach((b) => {
      penitentiaryTextures.push(b.albedo, b.normalRough);
    });
    [dressedGranite, graniteLoophole, darkRedBrick, brickCellBars, darkSlateRoof, corrugatedTin].forEach(
      (pack) => {
        if (pack.map) penitentiaryTextures.push(pack.map);
        if (pack.normalMap) penitentiaryTextures.push(pack.normalMap);
        if (pack.roughnessMap) penitentiaryTextures.push(pack.roughnessMap);
      }
    );
    penitentiaryTextures.push(usFlagTex);

    const penTerrainSplat = createTerrainSplatMaterial({
      sand: ochreDirt, // Biome 0: Dusty ochre-brown Old West compacted earth
      earthPath: greyGravel, // Biome 1: Grey crushed gravel paths & courtyard
      quarryDust: quarryClay, // Biome 2: Grey granite dust & red clay quarry floor
      oasisGrass: frontierScrub, // Biome 3: Parched frontier scrub & pine needles
    });
    penTerrainSplat.customProgramCacheKey = () => 'workd-builder-penitentiary-terrain-splat-v1';

    const pMats = {
      terrainSplat: penTerrainSplat,
      dressedGranite: new THREE.MeshStandardMaterial({
        map: dressedGranite.map,
        normalMap: dressedGranite.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: dressedGranite.roughnessMap,
        roughness: 1.0,
        metalness: 0.06,
      }),
      graniteLoophole: new THREE.MeshStandardMaterial({
        map: graniteLoophole.map,
        normalMap: graniteLoophole.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: graniteLoophole.roughnessMap,
        roughness: 1.0,
        metalness: 0.08,
      }),
      darkRedBrick: new THREE.MeshStandardMaterial({
        map: darkRedBrick.map,
        normalMap: darkRedBrick.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: darkRedBrick.roughnessMap,
        roughness: 1.0,
        metalness: 0.04,
      }),
      brickCellBars: new THREE.MeshStandardMaterial({
        map: brickCellBars.map,
        normalMap: brickCellBars.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: brickCellBars.roughnessMap,
        roughness: 1.0,
        metalness: 0.14,
      }),
      darkSlateRoof: new THREE.MeshStandardMaterial({
        map: darkSlateRoof.map,
        normalMap: darkSlateRoof.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: darkSlateRoof.roughnessMap,
        roughness: 0.92,
        metalness: 0.16,
      }),
      corrugatedTin: new THREE.MeshStandardMaterial({
        map: corrugatedTin.map,
        normalMap: corrugatedTin.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: corrugatedTin.roughnessMap,
        roughness: 0.72,
        metalness: 0.42,
        side: THREE.DoubleSide,
      }),
      rawGranite: new THREE.MeshStandardMaterial({
        map: dressedGranite.map,
        normalMap: dressedGranite.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        color: new THREE.Color('#9ea2a6'),
        roughness: 0.92,
        metalness: 0.06,
      }),
      rawRedClay: new THREE.MeshStandardMaterial({
        map: quarryClay.albedo,
        normalMap: darkRedBrick.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        color: new THREE.Color('#a6523b'),
        roughness: 0.94,
        metalness: 0.02,
      }),
      graniteCliff: new THREE.MeshStandardMaterial({
        map: dressedGranite.map,
        normalMap: dressedGranite.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        color: new THREE.Color('#7a7d80'),
        roughness: 0.9,
        metalness: 0.05,
      }),
      gravelSlab: new THREE.MeshStandardMaterial({
        map: greyGravel.albedo,
        roughness: 0.92,
        metalness: 0.03,
      }),
      darkOak: new THREE.MeshStandardMaterial({
        map: timber.map,
        normalMap: timber.normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        color: new THREE.Color('#5a3d28'),
        roughness: 0.88,
        metalness: 0.04,
      }),
      palisadeLog: new THREE.MeshStandardMaterial({
        map: timber.map,
        normalMap: timber.normalMap,
        normalScale: new THREE.Vector2(0.95, 0.95),
        color: new THREE.Color('#7a5738'),
        roughness: 0.9,
        metalness: 0.02,
      }),
      wroughtIron: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#22262b'),
        roughness: 0.42,
        metalness: 0.82,
      }),
      agedBronze: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b6863d'),
        roughness: 0.34,
        metalness: 0.84,
      }),
      forgeEmber: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ff5e14'),
        emissive: new THREE.Color('#ff3c00'),
        emissiveIntensity: 1.5,
        roughness: 0.6,
      }),
      lanternGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff2bf'),
        emissive: new THREE.Color('#ff9d28'),
        emissiveIntensity: 1.35,
        roughness: 0.4,
      }),
      dryPineFoliage: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#475c3b'),
        roughness: 0.86,
        metalness: 0.02,
      }),
      dryPineDark: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#38492e'),
        roughness: 0.88,
        metalness: 0.02,
      }),
      usFlag1800s: new THREE.MeshStandardMaterial({
        map: usFlagTex,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    };

    Object.values(pMats).forEach((m) => penitentiaryMaterials.push(m));
    penitentiaryPack = { materials: pMats, maps: { usFlag1800s: usFlagTex } };
    return penitentiaryPack;
  }

  // Lazy-cached Level 6 (Industrial Coal Mine & Chevalement) 512x512 procedural PBR pack
  let coalMinePack = null;
  const coalMineTextures = [];
  const coalMineMaterials = [];

  function ensureCoalMinePack() {
    if (coalMinePack) return coalMinePack;

    const northGrass = buildNorthernMeadowGrassPBR(anisotropy);
    const rustyCinder = buildRustyCinderRailGravelPBR(anisotropy);
    const coalDust = buildCoalDustShaleGravelPBR(anisotropy);
    const canalMoss = buildCoolingCanalMossPBR(anisotropy);

    const anthracite = buildAnthraciteCoalSeamsPBR(anisotropy);
    const indBrick = buildIndustrialRedBrickPBR(anisotropy);
    const indBrickWin = buildIndustrialArchedWindowBrickPBR(anisotropy);
    const rivetedIron = buildRivetedCastIronSteelPBR(anisotropy);
    const zincRoof = buildCorrugatedZincPanelsPBR(anisotropy);
    const concrete = buildReinforcedConcretePBR(anisotropy);

    [northGrass, rustyCinder, coalDust, canalMoss].forEach((b) => {
      coalMineTextures.push(b.albedo, b.normalRough);
    });
    [anthracite, indBrick, indBrickWin, rivetedIron, zincRoof, concrete].forEach((pack) => {
      if (pack.map) coalMineTextures.push(pack.map);
      if (pack.normalMap) coalMineTextures.push(pack.normalMap);
      if (pack.roughnessMap) coalMineTextures.push(pack.roughnessMap);
    });

    const coalTerrainSplat = createTerrainSplatMaterial({
      sand: northGrass, // Biome 0: Hardy northern meadow grass & pine edge
      earthPath: rustyCinder, // Biome 1: Compacted rusty-brown cinder & steel rail gravel
      quarryDust: coalDust, // Biome 2: Crushed black coal dust & dark grey shale gravel
      oasisGrass: canalMoss, // Biome 3: Wet slate cooling canal rim & northern moss
    });
    coalTerrainSplat.customProgramCacheKey = () => 'workd-builder-coalmine-terrain-splat-v1';

    const cMats = {
      terrainSplat: coalTerrainSplat,
      anthraciteCoal: new THREE.MeshStandardMaterial({
        map: anthracite.map,
        normalMap: anthracite.normalMap,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughnessMap: anthracite.roughnessMap,
        roughness: 0.48,
        metalness: 0.34,
      }),
      shaleRock: new THREE.MeshStandardMaterial({
        map: coalDust.albedo,
        color: new THREE.Color('#6a7078'),
        roughness: 0.9,
        metalness: 0.08,
      }),
      concrete: new THREE.MeshStandardMaterial({
        map: concrete.map,
        normalMap: concrete.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: concrete.roughnessMap,
        roughness: 0.92,
        metalness: 0.06,
      }),
      industrialBrick: new THREE.MeshStandardMaterial({
        map: indBrick.map,
        normalMap: indBrick.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: indBrick.roughnessMap,
        roughness: 0.92,
        metalness: 0.04,
      }),
      industrialBrickWindow: new THREE.MeshStandardMaterial({
        map: indBrickWin.map,
        normalMap: indBrickWin.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: indBrickWin.roughnessMap,
        roughness: 0.88,
        metalness: 0.1,
      }),
      rivetedIron: new THREE.MeshStandardMaterial({
        map: rivetedIron.map,
        normalMap: rivetedIron.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: rivetedIron.roughnessMap,
        roughness: 0.62,
        metalness: 0.78,
      }),
      steelRail: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#8e969e'),
        roughness: 0.32,
        metalness: 0.88,
      }),
      pulleySteel: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3a424c'),
        roughness: 0.38,
        metalness: 0.86,
      }),
      corrugatedZinc: new THREE.MeshStandardMaterial({
        map: zincRoof.map,
        normalMap: zincRoof.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: zincRoof.roughnessMap,
        roughness: 0.68,
        metalness: 0.52,
      }),
      mineTimber: new THREE.MeshStandardMaterial({
        map: timber.map,
        normalMap: timber.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        color: new THREE.Color('#6b5038'),
        roughness: 0.9,
        metalness: 0.04,
      }),
      mineCartIron: new THREE.MeshStandardMaterial({
        map: rivetedIron.map,
        color: new THREE.Color('#525b66'),
        roughness: 0.56,
        metalness: 0.72,
      }),
      rustAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#9c4727'),
        roughness: 0.72,
        metalness: 0.32,
      }),
      lanternGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff1bd'),
        emissive: new THREE.Color('#ff9d2e'),
        emissiveIntensity: 1.45,
        roughness: 0.35,
      }),
      shaftVoid: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0c0e12'),
        roughness: 0.98,
        metalness: 0.0,
      }),
      coolingWater: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2d7484'),
        normalMap: waterNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.16,
        metalness: 0.16,
        transparent: true,
        opacity: 0.88,
      }),
    };

    Object.values(cMats).forEach((m) => coalMineMaterials.push(m));
    coalMinePack = { materials: cMats };
    return coalMinePack;
  }

  // Lazy-cached Level 7 (Modern Contemporary Villa: Béton Blanc, Brique & Verre) 512x512 PBR pack
  let modernPack = null;
  const modernTextures = [];
  const modernMaterials = [];

  function ensureModernPack() {
    if (modernPack) return modernPack;

    const lawnGrass = buildModernLawnGrassPBR(anisotropy);
    const concreteDrive = buildModernConcreteDrivewayPBR(anisotropy);
    const quarryAgg = buildModernQuarryAggregatePBR(anisotropy);
    const poolTeak = buildModernPoolTeakDeckPBR(anisotropy);

    const whiteConcrete = buildModernWhiteConcretePBR(anisotropy);
    const modernBrick = buildModernBrickWallPBR(anisotropy);
    const glassPanel = buildModernPanoramicGlassPBR(anisotropy);
    const rawAggregate = buildModernRawAggregateBlockPBR(anisotropy);
    const darkAluminum = buildModernDarkAluminumPBR(anisotropy);

    [
      lawnGrass,
      concreteDrive,
      quarryAgg,
      poolTeak,
      whiteConcrete,
      modernBrick,
      glassPanel,
      rawAggregate,
      darkAluminum,
    ].forEach((set) => {
      if (set.map) modernTextures.push(set.map);
      if (set.normalMap) modernTextures.push(set.normalMap);
      if (set.roughnessMap) modernTextures.push(set.roughnessMap);
    });

    const mMats = {
      terrainLawn: new THREE.MeshStandardMaterial({
        map: lawnGrass.map,
        normalMap: lawnGrass.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.9,
        metalness: 0.0,
      }),
      terrainConcrete: new THREE.MeshStandardMaterial({
        map: concreteDrive.map,
        normalMap: concreteDrive.normalMap,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughness: 0.9,
        metalness: 0.0,
      }),
      terrainQuarry: new THREE.MeshStandardMaterial({
        map: quarryAgg.map,
        normalMap: quarryAgg.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughness: 0.9,
        metalness: 0.0,
      }),
      terrainTeak: new THREE.MeshStandardMaterial({
        map: poolTeak.map,
        normalMap: poolTeak.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughness: 0.86,
        metalness: 0.0,
      }),
      rawAggregate: new THREE.MeshStandardMaterial({
        map: rawAggregate.map,
        normalMap: rawAggregate.normalMap,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: rawAggregate.roughnessMap,
        roughness: 0.88,
        metalness: 0.04,
      }),
      quarryLimestone: new THREE.MeshStandardMaterial({
        map: rawAggregate.map,
        normalMap: rawAggregate.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        color: new THREE.Color('#eae6dd'),
        roughness: 0.86,
        metalness: 0.03,
      }),
      quarryClay: new THREE.MeshStandardMaterial({
        map: rawAggregate.map,
        normalMap: rawAggregate.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        color: new THREE.Color('#c2684b'),
        roughness: 0.9,
        metalness: 0.02,
      }),
      whiteConcrete: new THREE.MeshStandardMaterial({
        map: whiteConcrete.map,
        normalMap: whiteConcrete.normalMap,
        normalScale: new THREE.Vector2(0.72, 0.72),
        roughnessMap: whiteConcrete.roughnessMap,
        roughness: 0.54,
        metalness: 0.04,
      }),
      whiteConcreteRoof: new THREE.MeshStandardMaterial({
        map: whiteConcrete.map,
        normalMap: whiteConcrete.normalMap,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: whiteConcrete.roughnessMap,
        color: new THREE.Color('#f7f6f2'),
        roughness: 0.46,
        metalness: 0.06,
      }),
      modernBrick: new THREE.MeshStandardMaterial({
        map: modernBrick.map,
        normalMap: modernBrick.normalMap,
        normalScale: new THREE.Vector2(1.38, 1.38),
        roughnessMap: modernBrick.roughnessMap,
        roughness: 0.8,
        metalness: 0.04,
      }),
      panoramicGlass: new THREE.MeshStandardMaterial({
        map: glassPanel.map,
        normalMap: glassPanel.normalMap,
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: glassPanel.roughnessMap,
        color: new THREE.Color('#c6eefc'),
        roughness: 0.14,
        metalness: 0.28,
        envMapIntensity: 1.55,
        transparent: true,
        opacity: 0.88,
      }),
      balconyGlass: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#a4e3f6'),
        roughness: 0.1,
        metalness: 0.22,
        envMapIntensity: 1.5,
        transparent: true,
        opacity: 0.58,
      }),
      darkAluminum: new THREE.MeshStandardMaterial({
        map: darkAluminum.map,
        normalMap: darkAluminum.normalMap,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: darkAluminum.roughnessMap,
        roughness: 0.36,
        metalness: 0.84,
      }),
      brushedSteel: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#bfc7cf'),
        roughness: 0.32,
        metalness: 0.86,
      }),
      teakDeck: new THREE.MeshStandardMaterial({
        map: poolTeak.map,
        normalMap: poolTeak.normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughness: 0.72,
        metalness: 0.04,
      }),
      safetyYellow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f4c425'),
        roughness: 0.36,
        metalness: 0.22,
      }),
      bollardGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff5d6'),
        emissive: new THREE.Color('#ffca68'),
        emissiveIntensity: 1.5,
        roughness: 0.25,
      }),
      infinityPoolWater: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#28c2d6'),
        normalMap: waterNormal,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughness: 0.1,
        metalness: 0.18,
        envMapIntensity: 1.45,
        transparent: true,
        opacity: 0.88,
      }),
      poolTileLiner: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#198ea8'),
        roughness: 0.38,
        metalness: 0.08,
      }),
      hedgeGreen: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3b7338'),
        roughness: 0.88,
        metalness: 0.0,
      }),
      interiorFloorGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f5e5c8'),
        emissive: new THREE.Color('#ffdca4'),
        emissiveIntensity: 0.26,
        roughness: 0.65,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    };

    Object.values(mMats).forEach((m) => modernMaterials.push(m));
    modernPack = { materials: mMats };
    return modernPack;
  }

  let medievalPack = null;
  const medievalTextures = [];
  const medievalMaterials = [];

  function ensureMedievalPack() {
    if (medievalPack) return medievalPack;

    const meadowGrass = buildMedievalMeadowGrassPBR(anisotropy);
    const cobbleRoad = buildMedievalCobbleRoadPBR(anisotropy);
    const limestoneDust = buildMedievalLimestoneDustPBR(anisotropy);
    const moatMoss = buildMedievalMoatMossPBR(anisotropy);

    const castleAshlar = buildMedievalAshlarStonePBR(anisotropy);
    const arrowSlit = buildMedievalArrowSlitStonePBR(anisotropy);
    const portcullisOak = buildMedievalPortcullisOakPBR(anisotropy);
    const slateShingles = buildMedievalSlateShinglesPBR(anisotropy);
    const rawLimestone = buildMedievalRawLimestonePBR(anisotropy);
    const oakTimber = buildMedievalOakTimberPBR(anisotropy);

    [meadowGrass, cobbleRoad, limestoneDust, moatMoss].forEach((b) => {
      medievalTextures.push(b.albedo, b.normalRough);
    });
    [castleAshlar, arrowSlit, portcullisOak, slateShingles, rawLimestone, oakTimber].forEach((pack) => {
      if (pack.map) medievalTextures.push(pack.map);
      if (pack.normalMap) medievalTextures.push(pack.normalMap);
      if (pack.roughnessMap) medievalTextures.push(pack.roughnessMap);
    });

    const medievalTerrainSplat = createTerrainSplatMaterial({
      sand: meadowGrass,       // Biome 0: Lush medieval meadow grass, wildflowers & forest moss
      earthPath: cobbleRoad,   // Biome 1: Compacted cobblestone courtyard & rutted mud wagon road
      quarryDust: limestoneDust, // Biome 2: Crushed pale-grey limestone quarry dust
      oasisGrass: moatMoss,    // Biome 3: Wet turquoise moat bank moss & pebbles
    });
    medievalTerrainSplat.customProgramCacheKey = () => 'workd-builder-medieval-terrain-splat-v1';

    const moatWaterNormal = waterNormal.clone();
    moatWaterNormal.wrapS = THREE.RepeatWrapping;
    moatWaterNormal.wrapT = THREE.RepeatWrapping;
    moatWaterNormal.repeat.set(3.2, 3.2);
    moatWaterNormal.needsUpdate = true;
    medievalTextures.push(moatWaterNormal);

    const cMats = {
      terrainSplat: medievalTerrainSplat,
      castleAshlar: new THREE.MeshStandardMaterial({
        map: castleAshlar.map,
        normalMap: castleAshlar.normalMap,
        normalScale: new THREE.Vector2(1.42, 1.42),
        roughnessMap: castleAshlar.roughnessMap,
        roughness: 0.84,
        metalness: 0.04,
      }),
      castleBaseStone: new THREE.MeshStandardMaterial({
        map: castleAshlar.map,
        normalMap: castleAshlar.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: castleAshlar.roughnessMap,
        color: new THREE.Color('#c6c1b8'),
        roughness: 0.88,
        metalness: 0.05,
      }),
      arrowSlitStone: new THREE.MeshStandardMaterial({
        map: arrowSlit.map,
        normalMap: arrowSlit.normalMap,
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughnessMap: arrowSlit.roughnessMap,
        roughness: 0.84,
        metalness: 0.05,
      }),
      portcullisOak: new THREE.MeshStandardMaterial({
        map: portcullisOak.map,
        normalMap: portcullisOak.normalMap,
        normalScale: new THREE.Vector2(1.48, 1.48),
        roughnessMap: portcullisOak.roughnessMap,
        roughness: 0.72,
        metalness: 0.28,
      }),
      crenellationStone: new THREE.MeshStandardMaterial({
        map: castleAshlar.map,
        normalMap: castleAshlar.normalMap,
        normalScale: new THREE.Vector2(1.32, 1.32),
        roughnessMap: castleAshlar.roughnessMap,
        color: new THREE.Color('#e2ddd4'),
        roughness: 0.8,
        metalness: 0.04,
      }),
      conicalSlate: new THREE.MeshStandardMaterial({
        map: slateShingles.map,
        normalMap: slateShingles.normalMap,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughnessMap: slateShingles.roughnessMap,
        roughness: 0.54,
        metalness: 0.16,
      }),
      rawQuarryStone: new THREE.MeshStandardMaterial({
        map: rawLimestone.map,
        normalMap: rawLimestone.normalMap,
        normalScale: new THREE.Vector2(1.6, 1.6),
        roughnessMap: rawLimestone.roughnessMap,
        roughness: 0.92,
        metalness: 0.03,
      }),
      oakTimber: new THREE.MeshStandardMaterial({
        map: oakTimber.map,
        normalMap: oakTimber.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: oakTimber.roughnessMap,
        roughness: 0.84,
        metalness: 0.04,
      }),
      darkOak: new THREE.MeshStandardMaterial({
        map: oakTimber.map,
        normalMap: oakTimber.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        color: new THREE.Color('#8f755d'),
        roughness: 0.86,
        metalness: 0.04,
      }),
      wroughtIron: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2f353d'),
        roughness: 0.38,
        metalness: 0.86,
      }),
      cobbleCourt: new THREE.MeshStandardMaterial({
        map: cobbleRoad.albedo,
        normalMap: castleAshlar.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.88,
        metalness: 0.04,
      }),
      moatWater: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#279bb0'),
        normalMap: moatWaterNormal,
        normalScale: new THREE.Vector2(0.42, 0.42),
        roughness: 0.14,
        metalness: 0.12,
        envMapIntensity: 1.35,
        transparent: true,
        opacity: 0.9,
      }),
      royalCrimson: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b52328'),
        roughness: 0.72,
        metalness: 0.06,
        side: THREE.DoubleSide,
      }),
      royalGold: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e6b83e'),
        roughness: 0.3,
        metalness: 0.82,
      }),
      torchGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff2c4'),
        emissive: new THREE.Color('#ff9d2b'),
        emissiveIntensity: 1.6,
        roughness: 0.3,
      }),
    };

    Object.values(cMats).forEach((m) => medievalMaterials.push(m));
    medievalPack = { materials: cMats };
    return medievalPack;
  }

  let museumPack = null;
  const museumTextures = [];
  const museumMaterials = [];

  function ensureMuseumPack() {
    if (museumPack) return museumPack;

    const parkLawn = buildMuseumParkLawnPBR(anisotropy);
    const flagstonePlaza = buildMuseumFlagstonePlazaPBR(anisotropy);
    const marbleDust = buildMuseumMarbleDustPBR(anisotropy);
    const poolBank = buildMuseumPoolBankPBR(anisotropy);

    const museumLimestone = buildMuseumLimestoneAshlarPBR(anisotropy);
    const archedWindow = buildMuseumArchedWindowPBR(anisotropy);
    const flutedMarble = buildMuseumFlutedMarblePBR(anisotropy);
    const pedimentFrieze = buildMuseumPedimentFriezePBR(anisotropy);
    const verriereGlass = buildMuseumVerriereGlassPBR(anisotropy);
    const wingSlate = buildMuseumSlateRoofPBR(anisotropy);
    const rawMarble = buildMuseumRawMarbleRockPBR(anisotropy);
    const oakWood = buildMedievalOakTimberPBR(anisotropy);

    [parkLawn, flagstonePlaza, marbleDust, poolBank].forEach((b) => {
      museumTextures.push(b.albedo, b.normalRough);
    });
    [museumLimestone, archedWindow, flutedMarble, pedimentFrieze, verriereGlass, wingSlate, rawMarble, oakWood].forEach(
      (pack) => {
        if (pack.map) museumTextures.push(pack.map);
        if (pack.normalMap) museumTextures.push(pack.normalMap);
        if (pack.roughnessMap) museumTextures.push(pack.roughnessMap);
      }
    );

    const museumTerrainSplat = createTerrainSplatMaterial({
      sand: parkLawn,          // Biome 0: Manicured Royal Park Lawn, Boxwood & Flowerbeds
      earthPath: flagstonePlaza, // Biome 1: Smooth Cream Flagstone Promenade & Gravel Esplanade
      quarryDust: marbleDust,  // Biome 2: Crushed White Carrara Marble & Cream Limestone Dust
      oasisGrass: poolBank,    // Biome 3: Reflecting Pool Bank Moss & Pale Marble Gravel
    });
    museumTerrainSplat.customProgramCacheKey = () => 'workd-builder-museum-terrain-splat-v1';

    const poolWaterNormal = waterNormal.clone();
    poolWaterNormal.wrapS = THREE.RepeatWrapping;
    poolWaterNormal.wrapT = THREE.RepeatWrapping;
    poolWaterNormal.repeat.set(2.8, 2.8);
    poolWaterNormal.needsUpdate = true;
    museumTextures.push(poolWaterNormal);

    const gMats = {
      terrainSplat: museumTerrainSplat,
      museumLimestone: new THREE.MeshStandardMaterial({
        map: museumLimestone.map,
        normalMap: museumLimestone.normalMap,
        normalScale: new THREE.Vector2(1.22, 1.22),
        roughnessMap: museumLimestone.roughnessMap,
        roughness: 0.72,
        metalness: 0.04,
      }),
      podiumStone: new THREE.MeshStandardMaterial({
        map: museumLimestone.map,
        normalMap: museumLimestone.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: museumLimestone.roughnessMap,
        color: new THREE.Color('#e6dfd0'),
        roughness: 0.76,
        metalness: 0.04,
      }),
      galleryArchedWindow: new THREE.MeshStandardMaterial({
        map: archedWindow.map,
        normalMap: archedWindow.normalMap,
        normalScale: new THREE.Vector2(1.42, 1.42),
        roughnessMap: archedWindow.roughnessMap,
        roughness: 0.62,
        metalness: 0.14,
      }),
      flutedMarble: new THREE.MeshStandardMaterial({
        map: flutedMarble.map,
        normalMap: flutedMarble.normalMap,
        normalScale: new THREE.Vector2(1.38, 1.38),
        roughnessMap: flutedMarble.roughnessMap,
        roughness: 0.42,
        metalness: 0.06,
        envMapIntensity: 1.15,
      }),
      pedimentFrieze: new THREE.MeshStandardMaterial({
        map: pedimentFrieze.map,
        normalMap: pedimentFrieze.normalMap,
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughnessMap: pedimentFrieze.roughnessMap,
        roughness: 0.68,
        metalness: 0.06,
      }),
      verriereGlass: new THREE.MeshStandardMaterial({
        map: verriereGlass.map,
        normalMap: verriereGlass.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: verriereGlass.roughnessMap,
        roughness: 0.16,
        metalness: 0.28,
        envMapIntensity: 1.55,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      }),
      wingSlateRoof: new THREE.MeshStandardMaterial({
        map: wingSlate.map,
        normalMap: wingSlate.normalMap,
        normalScale: new THREE.Vector2(1.36, 1.36),
        roughnessMap: wingSlate.roughnessMap,
        roughness: 0.52,
        metalness: 0.22,
      }),
      rawMarbleRock: new THREE.MeshStandardMaterial({
        map: rawMarble.map,
        normalMap: rawMarble.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: rawMarble.roughnessMap,
        roughness: 0.86,
        metalness: 0.03,
      }),
      oakCartWood: new THREE.MeshStandardMaterial({
        map: oakWood.map,
        normalMap: oakWood.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: oakWood.roughnessMap,
        roughness: 0.78,
        metalness: 0.05,
      }),
      brassMetal: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#deb34c'),
        roughness: 0.28,
        metalness: 0.88,
        envMapIntensity: 1.35,
      }),
      wroughtIron: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#272d34'),
        roughness: 0.36,
        metalness: 0.86,
      }),
      reflectingWater: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#34b4c6'),
        normalMap: poolWaterNormal,
        normalScale: new THREE.Vector2(0.36, 0.36),
        roughness: 0.1,
        metalness: 0.14,
        envMapIntensity: 1.45,
        transparent: true,
        opacity: 0.9,
      }),
      lampGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff7d6'),
        emissive: new THREE.Color('#ffd068'),
        emissiveIntensity: 1.5,
        roughness: 0.25,
      }),
      interiorGalleryGlow: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f7e8c6'),
        emissive: new THREE.Color('#ffe09e'),
        emissiveIntensity: 0.32,
        roughness: 0.62,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      boxwoodHedge: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3f7836'),
        roughness: 0.9,
        metalness: 0.0,
      }),
    };

    Object.values(gMats).forEach((m) => museumMaterials.push(m));
    museumPack = { materials: gMats };
    return museumPack;
  }

  return {
    maps: {
      blueprint: blueprintMap,
      shadowBlob: shadowBlobMap,
      sunbeam: sunbeamMap,
      waterNormal,
    },
    materials,
    materialFactory,
    ensureRomePack,
    ensureJapanPack,
    ensureMayaPack,
    ensurePenitentiaryPack,
    ensureCoalMinePack,
    ensureModernPack,
    ensureMedievalPack,
    ensureMuseumPack,
    dispose() {
      textures.forEach((t) => t.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      romeTextures.forEach((t) => t.dispose());
      romeMaterials.forEach((m) => m.dispose());
      japanTextures.forEach((t) => t.dispose());
      japanMaterials.forEach((m) => m.dispose());
      mayaTextures.forEach((t) => t.dispose());
      mayaMaterials.forEach((m) => m.dispose());
      penitentiaryTextures.forEach((t) => t.dispose());
      penitentiaryMaterials.forEach((m) => m.dispose());
      coalMineTextures.forEach((t) => t.dispose());
      coalMineMaterials.forEach((m) => m.dispose());
      modernTextures.forEach((t) => t.dispose());
      modernMaterials.forEach((m) => m.dispose());
      medievalTextures.forEach((t) => t.dispose());
      medievalMaterials.forEach((m) => m.dispose());
      museumTextures.forEach((t) => t.dispose());
      museumMaterials.forEach((m) => m.dispose());
      materialFactory.dispose();
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
      const mossPatch = tileFBM(u, v, 7, 3, 409);
      const goldTouch = smoothstep(0.56, 0.84, tileFBM(u, v, 6, 2, 413));
      const blades = tileFBM(u * 2, v * 2, 16, 2, 419);
      const micro = hash2i(x, y, 433);
      const cell = tileWorley(u, v, 14, 449);

      // Cozy Outlanders palette: meadow green + moss green + warm golden touches
      let r = lerp(88, 134, macro) + (mossPatch - 0.5) * 18 + goldTouch * 38 + (blades - 0.5) * 20 + (micro - 0.5) * 9;
      let g = lerp(126, 172, macro) + (mossPatch - 0.5) * 20 + goldTouch * 28 + (blades - 0.5) * 22 + (micro - 0.5) * 10;
      let b = lerp(52, 78, macro) - (mossPatch - 0.5) * 10 - goldTouch * 10 + (blades - 0.5) * 12 + (micro - 0.5) * 7;

      // Subtle wildflower specks (sun-gold chamomile & warm white daisies)
      if (cell.f1 < 0.08 && cell.id > 0.8) {
        if (cell.id > 0.91) {
          r = 248;
          g = 244;
          b = 224;
        } else {
          r = 244;
          g = 216;
          b = 104;
        }
      }

      height[i] = clamp01(0.45 + blades * 0.35 + (macro - 0.5) * 0.14 + (micro - 0.5) * 0.06);
      rough[i] = clamp01(0.9 - macro * 0.05 + (micro - 0.5) * 0.06);

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
      const mossDeep = tileFBM(u, v, 8, 3, 2111);
      const goldSun = smoothstep(0.58, 0.86, tileFBM(u, v, 6, 2, 2123));
      const tuft = tileFBM(u, v, 22, 2, 2117);
      const blade = hash2i(x, y, 2131);

      const h = clamp01(0.4 + (macro - 0.5) * 0.25 + (tuft - 0.5) * 0.34 + (blade - 0.5) * 0.14);
      height[i] = h;

      // Rich cozy moss-velvet + meadow green + warm sunlit golden-chartreuse highlights
      let r = 60 + macro * 34 + (mossDeep - 0.5) * 16 + goldSun * 34 + tuft * 18 + (blade - 0.5) * 10;
      let g = 110 + macro * 44 + (mossDeep - 0.5) * 20 + goldSun * 26 + tuft * 22 + (blade - 0.5) * 12;
      let b = 46 + macro * 18 - (mossDeep - 0.5) * 10 - goldSun * 8 + tuft * 10 + (blade - 0.5) * 8;

      // Subtle scattered pale-pink fallen sakura petals on the moss
      const petal = hash2i(Math.floor(x / 5), Math.floor(y / 5), 2143);
      if (petal > 0.992) {
        r = 246;
        g = 196;
        b = 212;
      }

      rough[i] = clamp01(0.9 + (0.5 - tuft) * 0.08);
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
      const goldDapple = smoothstep(0.58, 0.85, tileFBM(u, v, 6, 2, 3119));
      const fern = tileFBM(u, v, 20, 2, 3121);
      const grain = hash2i(x, y, 3137);

      height[i] = clamp01(0.4 + (canopy - 0.5) * 0.28 + (fern - 0.5) * 0.34 + (grain - 0.5) * 0.14);
      // Deep tropical Yucatan emerald-moss + meadow green + sunlit golden dapple
      const loam = smoothstep(0.68, 0.88, 1 - canopy);
      const r = lerp(44 + canopy * 34 + fern * 22 + goldDapple * 34, 76, loam) + (grain - 0.5) * 10;
      const g = lerp(98 + canopy * 48 + fern * 26 + goldDapple * 26, 68, loam) + (grain - 0.5) * 12;
      const b = lerp(38 + canopy * 16 + fern * 10 - goldDapple * 8, 42, loam) + (grain - 0.5) * 8;

      rough[i] = clamp01(0.9 + (0.5 - fern) * 0.08);
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
      const stoneMask = smoothstep(0.06, 0.17, cell.edge);
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



/* ============================================================================
 * LEVEL 5 (1800s AMERICAN PENITENTIARY — OLD WEST) PROCEDURAL 512x512 PBR PACK
 * Dusty ochre-brown frontier dirt, grey crushed gravel paths, grey granite &
 * red clay quarry dust, Eastern State style ashlar granite, loopholes, dark red
 * penitentiary brick, black wrought-iron barred cell doors, dark slate roofing,
 * patinated corrugated tin canopy, and authentic 1800s circular-star US flag.
 * ========================================================================== */

/** Penitentiary Biome 0: Dusty Ochre-Brown American Frontier Dirt (512x512) */
function buildOchreDirtPBR(anisotropy) {
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
      const soil = tileFBM(u, v, 8, 4, 4109);
      const cracks = tileFBM(u, v, 18, 3, 4127);
      const grit = hash2i(x, y, 4139);
      const pebble = smoothstep(0.76, 0.9, tileFBM(u, v, 28, 2, 4153));

      const h = clamp01(0.45 + (soil - 0.5) * 0.34 + pebble * 0.24 - (1 - smoothstep(0.18, 0.3, cracks)) * 0.16);
      height[i] = h;
      rough[i] = clamp01(0.9 + (0.5 - soil) * 0.12 - pebble * 0.1);

      const shade = 0.84 + soil * 0.24 + (grit - 0.5) * 0.09;
      let r = 184 * shade;
      let g = 136 * shade;
      let b = 88 * shade;
      if (pebble > 0.1) {
        r = lerp(r, 146, pebble * 0.55);
        g = lerp(g, 134, pebble * 0.55);
        b = lerp(b, 120, pebble * 0.55);
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 2.8, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Penitentiary Biome 1: Compacted Grey Crushed Gravel Paths & Courtyard (512x512) */
function buildGreyGravelPBR(anisotropy) {
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
      const base = tileFBM(u, v, 10, 3, 4201);
      const stone = tileFBM(u, v, 32, 3, 4217);
      const speck = hash2i(x, y, 4231);
      const brightChip = smoothstep(0.68, 0.86, stone);

      const h = clamp01(0.42 + stone * 0.42 + (speck - 0.5) * 0.14);
      height[i] = h;
      rough[i] = clamp01(0.86 - brightChip * 0.12);

      const shade = 0.78 + base * 0.22 + brightChip * 0.18 + (speck - 0.5) * 0.12;
      const r = 138 * shade;
      const g = 136 * shade;
      const b = 131 * shade;

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

/** Penitentiary Biome 2: Grey Granite Dust & Red Terracotta Clay Quarry Floor (512x512) */
function buildGraniteClayQuarryPBR(anisotropy) {
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
      const clayPatch = smoothstep(0.38, 0.68, tileFBM(u, v, 6, 3, 4327));
      const grit = tileFBM(u, v, 24, 3, 4339);
      const noise = hash2i(x, y, 4349);

      height[i] = clamp01(0.45 + grit * 0.35 + (noise - 0.5) * 0.12);
      rough[i] = clamp01(0.88 + clayPatch * 0.06);

      const shade = 0.82 + grit * 0.24 + (noise - 0.5) * 0.08;
      const r = lerp(142, 166, clayPatch) * shade;
      const g = lerp(140, 102, clayPatch) * shade;
      const b = lerp(136, 82, clayPatch) * shade;

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

/** Penitentiary Biome 3: Parched Western Frontier Scrub & Dry Pine Soil (512x512) */
function buildFrontierScrubPBR(anisotropy) {
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
      const tuft = smoothstep(0.42, 0.72, tileFBM(u, v, 14, 3, 4409));
      const soil = tileFBM(u, v, 9, 3, 4421);
      const speck = hash2i(x, y, 4441);

      height[i] = clamp01(0.4 + tuft * 0.36 + (soil - 0.5) * 0.2);
      rough[i] = clamp01(0.9 - tuft * 0.06);

      const shade = 0.8 + soil * 0.24 + (speck - 0.5) * 0.08;
      const r = lerp(164, 126, tuft) * shade;
      const g = lerp(128, 126, tuft) * shade;
      const b = lerp(84, 78, tuft) * shade;

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

/** Massive Dressed Grey Penitentiary Ashlar Granite Blocks (512x512) */
function buildDressedGranitePBR(anisotropy) {
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
    const rowId = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const shift = (rowId % 2) * 0.5;
      const su = (u * cols + shift) % cols;
      const colId = Math.floor(su);
      const cu = su % 1;

      const edgeX = Math.min(cu, 1 - cu);
      const edgeY = Math.min(rv, 1 - rv);
      const mortar = Math.min(smoothstep(0.025, 0.065, edgeX), smoothstep(0.035, 0.085, edgeY));

      const blockTint = 0.88 + hash2i(colId, rowId, 4507) * 0.22;
      const grain = tileFBM(u, v, 16, 4, 4519);
      const crystal = hash2i(x, y, 4547);

      const h = clamp01(0.18 + mortar * (0.58 + (grain - 0.5) * 0.24));
      height[i] = h;
      rough[i] = clamp01(0.92 - mortar * 0.16 + (grain - 0.5) * 0.08);

      const shade = blockTint * (0.82 + grain * 0.26 + (crystal - 0.5) * 0.1);
      const r = lerp(82, 138 * shade, mortar);
      const g = lerp(83, 141 * shade, mortar);
      const b = lerp(86, 145 * shade, mortar);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.2);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Dressed Grey Granite Fortified Wall with Narrow Recessed Prison Loophole (512x512) */
function buildGraniteLoopholePBR(anisotropy) {
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
    const rowId = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const shift = (rowId % 2) * 0.5;
      const su = (u * cols + shift) % cols;
      const colId = Math.floor(su);
      const cu = su % 1;

      const edgeX = Math.min(cu, 1 - cu);
      const edgeY = Math.min(rv, 1 - rv);
      const mortar = Math.min(smoothstep(0.025, 0.065, edgeX), smoothstep(0.035, 0.085, edgeY));
      const blockTint = 0.88 + hash2i(colId, rowId, 4603) * 0.2;
      const grain = tileFBM(u, v, 16, 4, 4621);
      const crystal = hash2i(x, y, 4637);

      // Narrow vertical prison loophole slit centered at u = 0.5, v in [0.22, 0.78]
      const inSlit = Math.abs(u - 0.5) < 0.062 && v > 0.24 && v < 0.76;
      const inBevelFrame = !inSlit && Math.abs(u - 0.5) < 0.13 && v > 0.16 && v < 0.84;
      const inBar = inSlit && (Math.abs(u - 0.5) < 0.014 || Math.abs(v - 0.5) < 0.022);

      let r, g, b;
      if (inBar) {
        r = 34;
        g = 38;
        b = 44;
        height[i] = 0.32;
        rough[i] = 0.42;
      } else if (inSlit) {
        r = 16;
        g = 18;
        b = 22;
        height[i] = 0.04;
        rough[i] = 0.96;
      } else if (inBevelFrame) {
        const s = 0.96 + (grain - 0.5) * 0.16;
        r = 152 * s;
        g = 154 * s;
        b = 158 * s;
        height[i] = 0.86;
        rough[i] = 0.74;
      } else {
        const shade = blockTint * (0.82 + grain * 0.25 + (crystal - 0.5) * 0.09);
        r = lerp(80, 134 * shade, mortar);
        g = lerp(81, 137 * shade, mortar);
        b = lerp(84, 141 * shade, mortar);
        height[i] = clamp01(0.18 + mortar * (0.58 + (grain - 0.5) * 0.22));
        rough[i] = clamp01(0.92 - mortar * 0.16);
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
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

/** 1800s Dark Red Penitentiary Brick Masonry (512x512) */
function buildDarkRedBrickPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 10;
  const cols = 5;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowId = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const shift = (rowId % 2) * 0.5;
      const su = (u * cols + shift) % cols;
      const colId = Math.floor(su);
      const cu = su % 1;

      const edgeX = Math.min(cu, 1 - cu);
      const edgeY = Math.min(rv, 1 - rv);
      const mortar = Math.min(smoothstep(0.035, 0.08, edgeX), smoothstep(0.06, 0.13, edgeY));

      const brickVar = hash2i(colId, rowId, 4703);
      const kiln = tileFBM(u, v, 18, 3, 4721);
      const grit = hash2i(x, y, 4733);

      height[i] = clamp01(0.2 + mortar * (0.62 + (kiln - 0.5) * 0.2));
      rough[i] = clamp01(0.88 - mortar * 0.08 + (kiln - 0.5) * 0.08);

      const shade = 0.78 + brickVar * 0.28 + (kiln - 0.5) * 0.16 + (grit - 0.5) * 0.07;
      const r = lerp(146, 128 * shade, mortar);
      const g = lerp(142, 52 * shade, mortar);
      const b = lerp(132, 40 * shade, mortar);

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

/** Dark Red Brick Cellblock Facade with Arched Wrought-Iron Barred Cell Door (512x512) */
function buildBrickCellBarsPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 10;
  const cols = 5;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowId = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const shift = (rowId % 2) * 0.5;
      const su = (u * cols + shift) % cols;
      const colId = Math.floor(su);
      const cu = su % 1;

      const edgeX = Math.min(cu, 1 - cu);
      const edgeY = Math.min(rv, 1 - rv);
      const mortar = Math.min(smoothstep(0.035, 0.08, edgeX), smoothstep(0.06, 0.13, edgeY));
      const brickVar = hash2i(colId, rowId, 4801);
      const kiln = tileFBM(u, v, 16, 3, 4817);

      // Arched recessed cell doorway (u in [0.24, 0.76], bottom up to arch center at v=0.38)
      const dx = u - 0.5;
      const dyArch = v - 0.38;
      const inRect = Math.abs(dx) < 0.24 && v >= 0.38 && v <= 0.92;
      const inArch = v < 0.38 && dx * dx + dyArch * dyArch < 0.24 * 0.24;
      const inDoorOpening = inRect || inArch;

      const inStoneArchRim =
        !inDoorOpening &&
        ((Math.abs(dx) < 0.3 && v >= 0.38 && v <= 0.94) ||
          (v < 0.38 && dx * dx + dyArch * dyArch < 0.3 * 0.3));

      let r, g, b;
      if (inDoorOpening) {
        // Vertical & horizontal black wrought-iron bars over dark prison cell interior
        const barPhase = Math.abs((((u - 0.26) / 0.08) % 1 + 1) % 1 - 0.5);
        const isVertBar = barPhase > 0.34;
        const isCrossBar = Math.abs(v - 0.54) < 0.024 || Math.abs(v - 0.76) < 0.024 || Math.abs(v - 0.36) < 0.022;
        const isFrame = Math.abs(dx) > 0.215 || v > 0.89;

        if (isVertBar || isCrossBar || isFrame) {
          r = 28;
          g = 31;
          b = 36;
          height[i] = 0.52;
          rough[i] = 0.38;
        } else {
          // Deep shadowed cell interior with subtle faint warm lantern hint near top
          const warm = Math.max(0, 1 - Math.hypot(dx * 2.4, (v - 0.42) * 2.2)) * 22;
          r = 18 + warm * 1.1;
          g = 17 + warm * 0.75;
          b = 20 + warm * 0.35;
          height[i] = 0.06;
          rough[i] = 0.95;
        }
      } else if (inStoneArchRim) {
        // Cut grey granite arch surround framing the barred brick cell door
        const s = 0.9 + (kiln - 0.5) * 0.18;
        r = 148 * s;
        g = 150 * s;
        b = 154 * s;
        height[i] = 0.88;
        rough[i] = 0.74;
      } else {
        const shade = 0.78 + brickVar * 0.28 + (kiln - 0.5) * 0.16;
        r = lerp(146, 128 * shade, mortar);
        g = lerp(142, 52 * shade, mortar);
        b = lerp(132, 40 * shade, mortar);
        height[i] = clamp01(0.2 + mortar * 0.62);
        rough[i] = clamp01(0.88 - mortar * 0.08);
      }

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.2);
  const roughCanvas = buildRoughnessCanvas(rough, size);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** Dark Charcoal-Blue 19th-Century Overlapping Slate Roof Shingles (512x512) */
function buildDarkSlateRoofPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 10;
  const cols = 8;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowId = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const shift = (rowId % 2) * 0.5;
      const su = (u * cols + shift) % cols;
      const colId = Math.floor(su);
      const cu = su % 1;

      const seamX = smoothstep(0.025, 0.06, Math.min(cu, 1 - cu));
      const overlap = smoothstep(0.0, 0.16, rv);
      const tileVar = hash2i(colId, rowId, 4903);
      const slateGrain = tileFBM(u, v, 14, 3, 4919);

      height[i] = clamp01(0.24 + seamX * (0.28 + overlap * 0.42));
      rough[i] = clamp01(0.68 - tileVar * 0.14 + (slateGrain - 0.5) * 0.1);

      const shade = (0.74 + tileVar * 0.24 + (slateGrain - 0.5) * 0.12) * (0.68 + overlap * 0.32) * (0.72 + seamX * 0.28);
      const r = 64 * shade;
      const g = 74 * shade;
      const b = 86 * shade;

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

/** Patinated Corrugated Tin & Weathered Iron Quarry Roof Sheet (512x512) */
function buildCorrugatedTinPBR(anisotropy) {
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
      const wave = Math.sin(u * Math.PI * 2 * 18) * 0.5 + 0.5;
      const rust = smoothstep(0.56, 0.82, tileFBM(u, v, 8, 3, 5003));
      const patina = tileFBM(u, v, 14, 2, 5021);

      height[i] = clamp01(0.2 + wave * 0.7);
      rough[i] = clamp01(0.52 + rust * 0.36 + (patina - 0.5) * 0.1);

      const shade = 0.78 + wave * 0.24 + (patina - 0.5) * 0.12;
      const r = lerp(128, 134, rust) * shade;
      const g = lerp(132, 82, rust) * shade;
      const b = lerp(134, 54, rust) * shade;

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

/** Authentic 1800s American Flag (13 stripes + navy canton with 13 white stars in a circle) */
function build1800sUSFlagTexture(anisotropy) {
  const w = 256;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 13 weathered vintage red & warm cream stripes
  const stripeH = h / 13;
  for (let s = 0; s < 13; s++) {
    ctx.fillStyle = s % 2 === 0 ? '#9e2b25' : '#e8dec5';
    ctx.fillRect(0, s * stripeH, w, stripeH + 0.8);
  }

  // Deep 19th-century navy canton covering top-left 7 stripes
  const cw = w * 0.44;
  const ch = stripeH * 7;
  ctx.fillStyle = '#1e3054';
  ctx.fillRect(0, 0, cw, ch);

  // 13 white stars arranged in a crisp circle (classic 1800s circle-of-stars motif)
  const cx = cw * 0.5;
  const cy = ch * 0.5;
  const ringR = Math.min(cw, ch) * 0.34;
  ctx.fillStyle = '#f5eedc';
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(a) * ringR;
    const sy = cy + Math.sin(a) * ringR;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 4.4 : 1.9;
      const sa = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const px = sx + Math.cos(sa) * r;
      const py = sy + Math.sin(sa) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Subtle woven linen grain
  ctx.fillStyle = 'rgba(40, 28, 16, 0.08)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  return applyCrispTextureSettings(tex, { isColor: true, wrap: false, anisotropy });
}

/* ============================================================================
 * LEVEL 6 (INDUSTRIAL COAL MINE & CHEVALEMENT) — 512x512 PROCEDURAL PBR PACK
 * ========================================================================== */

/** Coal Mine Biome 0: Hardy Northern Meadow Grass & Pine Edge (512x512) */
function buildNorthernMeadowGrassPBR(anisotropy) {
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
      const macro = tileFBM(u, v, 5, 3, 6101);
      const moss = tileFBM(u, v, 8, 2, 6113);
      const goldTouch = smoothstep(0.58, 0.86, tileFBM(u, v, 6, 2, 6121));
      const blades = tileFBM(u * 2, v * 2, 16, 2, 6133);
      const grit = hash2i(x, y, 6143);

      // Hardy cool-northern meadow green + damp moss + subtle sunlit golden touches
      const r = lerp(74, 114, macro) + (moss - 0.5) * 16 + goldTouch * 32 + (blades - 0.5) * 18 + (grit - 0.5) * 9;
      const g = lerp(110, 152, macro) + (moss - 0.5) * 20 + goldTouch * 24 + (blades - 0.5) * 20 + (grit - 0.5) * 10;
      const b = lerp(54, 78, macro) - (moss - 0.5) * 8 - goldTouch * 8 + (blades - 0.5) * 10 + (grit - 0.5) * 7;

      height[i] = clamp01(0.44 + blades * 0.34 + (macro - 0.5) * 0.14 + (grit - 0.5) * 0.08);
      rough[i] = clamp01(0.9 + (0.5 - blades) * 0.08);

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

/** Coal Mine Biome 1: Compacted Rusty-Brown Cinder & Steel Rail Gravel (512x512) */
function buildRustyCinderRailGravelPBR(anisotropy) {
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
      const ballast = tileWorley(u, v, 20, 6203);
      const rustPatch = tileFBM(u, v, 6, 3, 6217);
      const grit = hash2i(x, y, 6229);

      const pebble = smoothstep(0.03, 0.16, ballast.edge);
      const shade = 0.78 + ballast.id * 0.28 + (grit - 0.5) * 0.12;
      // Warm iron-oxide rusty-brown cinder mixed with dark steel-grey rail ballast
      const r = lerp(88, 134, rustPatch) * shade * (0.86 + pebble * 0.16);
      const g = lerp(74, 96, rustPatch) * shade * (0.86 + pebble * 0.16);
      const b = lerp(66, 78, rustPatch) * shade * (0.86 + pebble * 0.16);

      height[i] = clamp01(0.28 + pebble * 0.52 + (grit - 0.5) * 0.14);
      rough[i] = clamp01(0.88 + (1 - pebble) * 0.1 + (grit - 0.5) * 0.06);

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

/** Coal Mine Biome 2: Crushed Black Coal Dust & Dark Grey Shale Gravel (512x512) */
function buildCoalDustShaleGravelPBR(anisotropy) {
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
      const macro = tileFBM(u, v, 6, 3, 6301);
      const chips = tileWorley(u, v, 18, 6317);
      const grit = hash2i(x, y, 6337);

      const facet = smoothstep(0.04, 0.18, chips.edge);
      const coalStreak = smoothstep(0.48, 0.82, macro);
      const base = lerp(82, 42, coalStreak) * (0.82 + chips.id * 0.28) + (grit - 0.5) * 14;
      const r = base - 2;
      const g = base;
      const b = base + 5;

      height[i] = clamp01(0.32 + facet * 0.44 + (macro - 0.5) * 0.16 + (grit - 0.5) * 0.1);
      // Matte shale gravel with tiny glinting anthracite specks
      rough[i] = clamp01(lerp(0.9, 0.62, coalStreak * facet) + (grit - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalPacked = buildSobelNormalCanvas(height, size, 3.1, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalPacked, { isColor: false, anisotropy }),
  };
}

/** Coal Mine Biome 3: Wet Slate Cooling Canal Rim & Northern Moss (512x512) */
function buildCoolingCanalMossPBR(anisotropy) {
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
      const moss = tileFBM(u, v, 7, 3, 6401);
      const silt = tileFBM(u, v, 16, 2, 6421);
      const grit = hash2i(x, y, 6449);

      const mMask = smoothstep(0.38, 0.72, moss);
      const r = lerp(56, 68, mMask) + (silt - 0.5) * 14 + (grit - 0.5) * 8;
      const g = lerp(64, 108, mMask) + (silt - 0.5) * 18 + (grit - 0.5) * 8;
      const b = lerp(68, 56, mMask) + (silt - 0.5) * 12 + (grit - 0.5) * 8;

      height[i] = clamp01(0.4 + mMask * 0.28 + (silt - 0.5) * 0.22);
      rough[i] = clamp01(0.86 - (1 - mMask) * 0.14);

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

/** 512x512 Glossy Faceted Anthracite Coal Seams PBR */
function buildAnthraciteCoalSeamsPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      // Sharp crystalline fracture cells + horizontal coal bedding planes
      const crystal = tileWorley(u * 1.15, v * 1.85, 8, 6503);
      const bedding = Math.sin(v * Math.PI * 16 + tileFBM(u, v, 5, 2, 6521) * 2.5) * 0.5 + 0.5;
      const micro = hash2i(x, y, 6547);

      const bevel = smoothstep(0.02, 0.12, crystal.edge);
      const sheen = crystal.id;
      height[i] = clamp01(0.2 + bevel * (0.55 + sheen * 0.25) + bedding * 0.14);

      // Deep jet-black anthracite with subtle cool-steel specular crystalline facets
      const lum = lerp(16, 46, bevel * (0.45 + sheen * 0.55)) + bedding * 6 + (micro - 0.5) * 6;
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(lum * 0.92)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.98)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 1.14)));
      img.data[idx + 3] = 255;

      // Glossy fractured faces (~0.24-0.44), matte dusty seams (~0.82)
      const rv = Math.round(clamp01(lerp(0.84, 0.24 + (1 - sheen) * 0.22, bevel)) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.2);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Weathered Red Industrial Brick Masonry PBR */
function buildIndustrialRedBrickPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 10;
  const cols = 5;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const lv = (v * rows) - row;
    const rowOffset = (row % 2) * 0.5;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uc = u * cols + rowOffset;
      const col = Math.floor(uc);
      const lu = uc - col;

      const mortar = lv < 0.095 || lv > 0.905 || lu < 0.055 || lu > 0.945;
      const brickId = hash2i(((col % cols) + cols) % cols, row, 6607);
      const soot = smoothstep(0.54, 0.86, tileFBM(u, v, 5, 3, 6619));
      const grain = hash2i(x, y, 6637);

      let r, g, b, rv;
      if (mortar) {
        const mShade = 128 + (grain - 0.5) * 20 - soot * 36;
        r = mShade;
        g = mShade - 2;
        b = mShade - 5;
        height[i] = 0.22 + (grain - 0.5) * 0.08;
        rv = 0.96;
      } else {
        // Classic Northern industrial kiln-red & rust brick with subtle coal-soot patina
        const tone = 0.78 + brickId * 0.34;
        const sootDark = 1.0 - soot * 0.32;
        r = (146 * tone + (grain - 0.5) * 14) * sootDark;
        g = (62 * tone + (grain - 0.5) * 10) * sootDark;
        b = (44 * tone + (grain - 0.5) * 8) * sootDark;
        const edgeBevel = Math.min(
          smoothstep(0.095, 0.17, lv) * smoothstep(0.905, 0.83, lv),
          smoothstep(0.055, 0.12, lu) * smoothstep(0.945, 0.88, lu)
        );
        height[i] = clamp01(0.45 + edgeBevel * 0.42 + (grain - 0.5) * 0.1);
        rv = clamp01(0.86 + (0.5 - brickId) * 0.08 + soot * 0.06);
      }

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rByte = Math.round(rv * 255);
      rImg.data[idx] = rByte;
      rImg.data[idx + 1] = rByte;
      rImg.data[idx + 2] = rByte;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.4);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Weathered Industrial Brick with Arched Cast-Iron Factory Window */
function buildIndustrialArchedWindowBrickPBR(anisotropy) {
  const base = buildIndustrialRedBrickPBR(anisotropy);
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  ctx.drawImage(base.map.image, 0, 0);
  rCtx.drawImage(base.roughnessMap.image, 0, 0);

  // Draw an arched industrial iron-framed factory window centered on the wall face
  const cx = size * 0.5;
  const winW = size * 0.44;
  const winH = size * 0.56;
  const left = cx - winW * 0.5;
  const top = size * 0.22;
  const archR = winW * 0.5;
  const archCy = top + archR * 0.72;
  const bottom = top + winH;

  // Stone lintel & sill
  ctx.fillStyle = '#8b8e90';
  ctx.fillRect(left - 18, bottom - 6, winW + 36, 22);
  ctx.strokeStyle = '#484b4f';
  ctx.lineWidth = 4;
  ctx.strokeRect(left - 18, bottom - 6, winW + 36, 22);

  // Arched recessed dark iron frame + warm furnace-lit industrial glass panes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, archCy);
  ctx.arc(cx, archCy, archR, Math.PI, 0, false);
  ctx.lineTo(left + winW, bottom);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0.0, '#6a5b44');
  grad.addColorStop(0.45, '#d89a44');
  grad.addColorStop(1.0, '#f4c66a');
  ctx.fillStyle = grad;
  ctx.fill();

  // Cast-iron factory window mullions (3x3 panes)
  ctx.clip();
  ctx.strokeStyle = '#252a30';
  ctx.lineWidth = 10;
  for (let gx = 1; gx <= 2; gx++) {
    const px = left + (winW * gx) / 3;
    ctx.beginPath();
    ctx.moveTo(px, top - 20);
    ctx.lineTo(px, bottom);
    ctx.stroke();
  }
  for (let gy = 1; gy <= 2; gy++) {
    const py = archCy + ((bottom - archCy) * gy) / 3;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(left + winW, py);
    ctx.stroke();
  }
  ctx.restore();

  // Outer arched iron surround
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, archCy);
  ctx.arc(cx, archCy, archR, Math.PI, 0, false);
  ctx.lineTo(left + winW, bottom);
  ctx.closePath();
  ctx.strokeStyle = '#23282e';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Glossy window pane roughness
  rCtx.fillStyle = '#383838';
  rCtx.fillRect(left + 6, archCy - archR * 0.7, winW - 12, bottom - (archCy - archR * 0.7));

  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: base.normalMap,
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Riveted Dark Cast-Iron & Steel Beams PBR */
function buildRivetedCastIronSteelPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const brushed = tileFBM(u * 4, v, 8, 2, 6701);
      const patina = smoothstep(0.56, 0.86, tileFBM(u, v, 6, 3, 6719));
      const micro = hash2i(x, y, 6733);

      // Steel plate borders & cross flange seam
      const pu = (u * 2) % 1;
      const pv = (v * 2) % 1;
      const isSeam = pu < 0.035 || pu > 0.965 || pv < 0.035 || pv > 0.965;

      // Raised dome rivets running neatly along steel plate edges
      const rGridU = ((pu * 6) % 1) - 0.5;
      const rGridV = ((pv * 6) % 1) - 0.5;
      const onRivetBand =
        (pu > 0.06 && pu < 0.14) ||
        (pu > 0.86 && pu < 0.94) ||
        (pv > 0.06 && pv < 0.14) ||
        (pv > 0.86 && pv < 0.94);
      const rivetDist = Math.hypot(rGridU, rGridV);
      const rivet = onRivetBand ? 1.0 - smoothstep(0.18, 0.34, rivetDist) : 0.0;

      height[i] = clamp01((isSeam ? 0.24 : 0.54) + rivet * 0.42 + (brushed - 0.5) * 0.08);

      // Dark gunmetal cast iron with subtle warm iron-rust edge wear
      let r = lerp(52, 82, brushed) + rivet * 28 + (micro - 0.5) * 8;
      let g = lerp(58, 88, brushed) + rivet * 26 + (micro - 0.5) * 8;
      let b = lerp(66, 98, brushed) + rivet * 24 + (micro - 0.5) * 8;
      if (patina > 0.05) {
        r = lerp(r, 118, patina * 0.42);
        g = lerp(g, 74, patina * 0.42);
        b = lerp(b, 52, patina * 0.42);
      }
      if (isSeam) {
        r *= 0.62;
        g *= 0.62;
        b *= 0.62;
      }

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rv = Math.round(clamp01(0.42 + patina * 0.38 - rivet * 0.14 + (micro - 0.5) * 0.06) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Corrugated Galvanized Zinc Roof Panels PBR */
function buildCorrugatedZincPanelsPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const sheetOverlap = Math.abs(((v * 3) % 1) - 0.5) > 0.485;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const rib = Math.sin(u * Math.PI * 2 * 18) * 0.5 + 0.5;
      const spangle = tileFBM(u, v, 10, 3, 6803);
      const streak = tileFBM(u * 2, v * 0.5, 6, 2, 6827);
      const micro = hash2i(x, y, 6841);

      height[i] = clamp01(0.24 + rib * 0.64 - (sheetOverlap ? 0.16 : 0) + (micro - 0.5) * 0.04);

      // Cool blue-grey galvanized zinc sheets with subtle weather streaks
      const lum = (118 + rib * 44 + (spangle - 0.5) * 26 - streak * 16) * (sheetOverlap ? 0.72 : 1.0);
      const r = lum * 0.94 + (micro - 0.5) * 6;
      const g = lum * 0.99 + (micro - 0.5) * 6;
      const b = lum * 1.08 + (micro - 0.5) * 6;

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rv = Math.round(clamp01(0.46 + streak * 0.28 + (1 - rib) * 0.12) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.8);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Reinforced Industrial Stone & Poured Concrete Foundation PBR */
function buildReinforcedConcretePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const macro = tileFBM(u, v, 5, 3, 6907);
      const aggregate = tileFBM(u, v, 24, 2, 6917);
      const grit = hash2i(x, y, 6947);
      const joint = Math.abs(((u * 2) % 1) - 0.5) > 0.485 || Math.abs(((v * 2) % 1) - 0.5) > 0.485;

      height[i] = clamp01((joint ? 0.25 : 0.55) + (aggregate - 0.5) * 0.22 + (grit - 0.5) * 0.1);
      const base = (132 + (macro - 0.5) * 28 + (aggregate - 0.5) * 16 + (grit - 0.5) * 12) * (joint ? 0.74 : 1.0);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(base * 0.99)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(base * 1.0)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(base * 1.02)));
      img.data[idx + 3] = 255;

      const rv = Math.round(clamp01(0.88 + (0.5 - aggregate) * 0.12) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.8);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * LEVEL 7 (MODERN CONTEMPORARY VILLA) — 512x512 ARCHITECTURAL PBR TEXTURES
 * ========================================================================== */

/** 512x512 Manicured Vibrant Coastal Lawn Grass with subtle mowed stripe & golden clover */
function buildModernLawnGrassPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const macro = tileFBM(u, v, 5, 3, 7103);
      const blades = tileFBM(u * 2, v * 2, 22, 2, 7121);
      const micro = hash2i(x, y, 7151);
      // Subtle diagonal architectural lawn mower stripe
      const stripe = Math.sin((u + v) * Math.PI * 6) * 0.5 + 0.5;
      const sunTip = smoothstep(0.66, 0.88, macro);

      height[i] = clamp01(0.42 + (blades - 0.5) * 0.36 + (micro - 0.5) * 0.14);

      const r = 74 + macro * 26 + sunTip * 22 + stripe * 8 + (micro - 0.5) * 10;
      const g = 136 + macro * 30 + sunTip * 18 + stripe * 12 + (blades - 0.5) * 14;
      const b = 58 + macro * 14 + stripe * 5 + (micro - 0.5) * 8;

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.2);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Smooth Poured Concrete Driveway & Dark Slate Stepping Pavers */
function buildModernConcreteDrivewayPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const cellV = (v * 4) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const cellU = (u * 4) % 1;
      const joint = cellU < 0.032 || cellU > 0.968 || cellV < 0.032 || cellV > 0.968;
      const macro = tileFBM(u, v, 6, 3, 7207);
      const grain = tileFBM(u, v, 24, 2, 7219);
      const micro = hash2i(x, y, 7243);

      const tileId = hash2i(Math.floor(u * 4), Math.floor(v * 4), 7253);
      const lum = joint
        ? 112 + (micro - 0.5) * 14
        : 184 + (tileId - 0.5) * 16 + (macro - 0.5) * 18 + (grain - 0.5) * 12 + (micro - 0.5) * 8;

      height[i] = clamp01((joint ? 0.16 : 0.62) + (grain - 0.5) * 0.12 + (micro - 0.5) * 0.06);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(lum * 0.98)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.99)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 1.02)));
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.5);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Crushed White Limestone Aggregate & Red-Clay Quarry Dust */
function buildModernQuarryAggregatePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const clayPatch = smoothstep(0.46, 0.72, tileFBM(u, v, 4, 3, 7309));
      const gravel = tileFBM(u, v, 20, 3, 7321);
      const chip = hash2i(x, y, 7349);

      height[i] = clamp01(0.36 + (gravel - 0.5) * 0.44 + (chip - 0.5) * 0.18);

      // Blend crisp crushed white limestone dust with terracotta-red clay pockets
      const limeR = 218 + (gravel - 0.5) * 28 + (chip - 0.5) * 14;
      const limeG = 212 + (gravel - 0.5) * 26 + (chip - 0.5) * 14;
      const limeB = 200 + (gravel - 0.5) * 24 + (chip - 0.5) * 14;

      const clayR = 178 + (gravel - 0.5) * 24 + (chip - 0.5) * 12;
      const clayG = 104 + (gravel - 0.5) * 20 + (chip - 0.5) * 10;
      const clayB = 78 + (gravel - 0.5) * 16 + (chip - 0.5) * 10;

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(limeR * (1 - clayPatch) + clayR * clayPatch)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(limeG * (1 - clayPatch) + clayG * clayPatch)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(limeB * (1 - clayPatch) + clayB * clayPatch)));
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.1);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Warm Honey-Teak Slatted Sun-Deck Planks (Poolside Terrace) */
function buildModernPoolTeakDeckPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const planks = 10;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const pRow = Math.floor(v * planks);
    const pFrac = (v * planks) % 1;
    const isGap = pFrac < 0.07 || pFrac > 0.93;
    const rowTone = (hash2i(pRow, 7, 7411) - 0.5) * 22;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const grain = tileFBM(u * 0.7, v * 5.0, 12, 2, 7433);
      const micro = hash2i(x, y, 7451);

      height[i] = clamp01(isGap ? 0.1 : 0.68 + (grain - 0.5) * 0.16 + (micro - 0.5) * 0.05);

      const shade = isGap ? 0.42 : 1.0;
      const r = (176 + rowTone + (grain - 0.5) * 24 + (micro - 0.5) * 8) * shade;
      const g = (126 + rowTone * 0.8 + (grain - 0.5) * 18 + (micro - 0.5) * 6) * shade;
      const b = (78 + rowTone * 0.5 + (grain - 0.5) * 12 + (micro - 0.5) * 5) * shade;

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.0);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Smooth Architectural White Concrete (Béton Blanc) PBR */
function buildModernWhiteConcretePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  // Architectural formwork tie-hole coordinates (clean modernist grid)
  const holes = [
    [0.25, 0.25], [0.75, 0.25],
    [0.25, 0.75], [0.75, 0.75],
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const seamH = Math.abs(((v * 2) % 1) - 0.5) > 0.491;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const seamV = Math.abs(((u * 2) % 1) - 0.5) > 0.491;
      const seam = seamH || seamV;

      let tieHole = 0;
      for (let h = 0; h < holes.length; h++) {
        const d = Math.hypot(u - holes[h][0], v - holes[h][1]);
        if (d < 0.022) tieHole = Math.max(tieHole, smoothstep(0.022, 0.008, d));
      }

      const cloud = tileFBM(u, v, 5, 3, 7507);
      const satin = tileFBM(u, v, 24, 2, 7523);
      const micro = hash2i(x, y, 7541);

      height[i] = clamp01(
        (seam ? 0.24 : 0.68) - tieHole * 0.44 + (satin - 0.5) * 0.08 + (micro - 0.5) * 0.03
      );

      // Luminous architectural warm-white satin concrete (#F2F0EB)
      const base =
        (241 + (cloud - 0.5) * 14 + (satin - 0.5) * 8 + (micro - 0.5) * 5) *
        (seam ? 0.86 : 1.0) *
        (1.0 - tieHole * 0.24);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(base * 1.0)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(base * 0.992)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(base * 0.976)));
      img.data[idx + 3] = 255;

      const rv = Math.round(clamp01(0.48 + (0.5 - cloud) * 0.14 + (seam ? 0.2 : 0)) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.2);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Warm Textured Contemporary Red-Brown Brick (Brique Moderne) PBR */
function buildModernBrickWallPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 10;
  const cols = 4;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowId = Math.floor(v * rows);
    const rowF = (v * rows) % 1;
    const stagger = (rowId % 2) * 0.5;
    const mortarH = rowF < 0.085 || rowF > 0.915;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const su = (u * cols + stagger) % cols;
      const colId = Math.floor(su);
      const colF = su % 1;
      const mortarV = colF < 0.045 || colF > 0.955;
      const isMortar = mortarH || mortarV;

      const brickSeed = hash2i(colId, rowId, 7603);
      const kilnTone = hash2i(colId + 17, rowId + 31, 7621);
      const clayGrain = tileFBM(u, v, 20, 3, 7643);
      const micro = hash2i(x, y, 7669);

      let r, g, b, h, rv;
      if (isMortar) {
        // Crisp recessed modern warm-grey mortar
        const m = 196 + (clayGrain - 0.5) * 16 + (micro - 0.5) * 10;
        r = m * 0.99;
        g = m * 0.97;
        b = m * 0.93;
        h = 0.2 + (micro - 0.5) * 0.06;
        rv = 0.92;
      } else {
        // Sleek contemporary burnt-sienna / warm architectural terracotta-brown brick
        const edgeBevel = Math.min(
          smoothstep(0.085, 0.14, rowF),
          smoothstep(0.915, 0.86, rowF),
          smoothstep(0.045, 0.085, colF),
          smoothstep(0.955, 0.915, colF)
        );
        const shade = 0.84 + brickSeed * 0.28 + (clayGrain - 0.5) * 0.14;
        r = (176 + (kilnTone - 0.5) * 28) * shade + (micro - 0.5) * 9;
        g = (88 + (kilnTone - 0.5) * 18) * shade + (micro - 0.5) * 7;
        b = (62 + (kilnTone - 0.5) * 14) * shade + (micro - 0.5) * 6;
        h = clamp01(0.54 + edgeBevel * 0.28 + (clayGrain - 0.5) * 0.14 + (micro - 0.5) * 0.05);
        rv = clamp01(0.76 + (0.5 - clayGrain) * 0.16);
      }

      height[i] = h;
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rByte = Math.round(rv * 255);
      rImg.data[idx] = rByte;
      rImg.data[idx + 1] = rByte;
      rImg.data[idx + 2] = rByte;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Reflective Sky-Tinted Architectural Panoramic Glass (Baies Vitrées) with Black Aluminum Mullions */
function buildModernPanoramicGlassPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const isTopBotFrame = v < 0.068 || v > 0.932;
    const isTransom = Math.abs(v - 0.24) < 0.016;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const isSideFrame = u < 0.055 || u > 0.945;
      const isCenterMullion = Math.abs(u - 0.5) < 0.02;
      const isFrame = isTopBotFrame || isSideFrame || isCenterMullion || isTransom;

      let r, g, b, h, rv;
      if (isFrame) {
        // Sleek matte anodized charcoal-black architectural aluminum mullion
        const grain = hash2i(x, y, 7703);
        r = 34 + (grain - 0.5) * 6;
        g = 38 + (grain - 0.5) * 6;
        b = 44 + (grain - 0.5) * 7;
        h = 0.88;
        rv = 0.36;
      } else {
        // Sky-tinted reflective architectural glazing with diagonal sunlit specular bands
        const skyGrad = 1.0 - v * 0.42;
        const diag1 = Math.exp(-Math.pow((u * 0.92 + v * 0.55 - 0.58) * 7.5, 2));
        const diag2 = Math.exp(-Math.pow((u * 0.92 + v * 0.55 - 0.78) * 14.0, 2));
        const glint = clamp01(diag1 * 0.55 + diag2 * 0.35);

        // Warm interior glow subtly showing through lower half of the glass bay
        const warmInterior = smoothstep(0.45, 0.92, v) * 0.28;
        r = 128 * skyGrad + glint * 110 + warmInterior * 95;
        g = 198 * skyGrad + glint * 62 + warmInterior * 62;
        b = 228 * skyGrad + glint * 34 + warmInterior * 18;
        h = 0.28;
        rv = clamp01(0.08 + (1.0 - glint) * 0.06);
      }

      height[i] = h;
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rByte = Math.round(rv * 255);
      rImg.data[idx] = rByte;
      rImg.data[idx + 1] = rByte;
      rImg.data[idx + 2] = rByte;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.4);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Raw Limestone, Silica Sand & Red-Clay Quarry Block PBR */
function buildModernRawAggregateBlockPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const strata = tileFBM(u * 0.8, v * 2.2, 6, 3, 7817);
      const rock = tileFBM(u, v, 18, 3, 7841);
      const grit = hash2i(x, y, 7867);
      const clayVein = smoothstep(0.58, 0.78, strata);

      height[i] = clamp01(0.35 + (rock - 0.5) * 0.48 + (grit - 0.5) * 0.14);

      const baseR = 224 + (rock - 0.5) * 30 + (grit - 0.5) * 14;
      const baseG = 216 + (rock - 0.5) * 28 + (grit - 0.5) * 14;
      const baseB = 204 + (rock - 0.5) * 26 + (grit - 0.5) * 14;

      const clayR = 186 + (rock - 0.5) * 24;
      const clayG = 102 + (rock - 0.5) * 20;
      const clayB = 76 + (rock - 0.5) * 16;

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(baseR * (1 - clayVein) + clayR * clayVein)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG * (1 - clayVein) + clayG * clayVein)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB * (1 - clayVein) + clayB * clayVein)));
      img.data[idx + 3] = 255;

      const rv = Math.round(clamp01(0.84 + (0.5 - rock) * 0.14) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.4);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Brushed Matte Anodized Charcoal-Black Aluminum (Pergola & Mullions) PBR */
function buildModernDarkAluminumPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const brush = tileFBM(u * 0.5, v * 12.0, 14, 2, 7907);
      const micro = hash2i(x, y, 7927);

      height[i] = clamp01(0.5 + (brush - 0.5) * 0.18 + (micro - 0.5) * 0.06);

      const lum = 40 + (brush - 0.5) * 14 + (micro - 0.5) * 6;
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(lum * 0.96)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 1.0)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 1.08)));
      img.data[idx + 3] = 255;

      const rv = Math.round(clamp01(0.36 + (0.5 - brush) * 0.14) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 1.8);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * LEVEL 8 (MEDIEVAL CASTLE — LE CHÂTEAU FORT MÉDIÉVAL) — 512x512 PBR PACK
 * ========================================================================== */

/** Medieval Biome 0: Lush Medieval Meadow Grass, Wildflowers & Forest Moss (512x512) */
function buildMedievalMeadowGrassPBR(anisotropy) {
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
      const macro = tileFBM(u, v, 5, 3, 8101);
      const moss = tileFBM(u, v, 10, 3, 8117);
      const blades = tileFBM(u * 2.2, v * 2.2, 24, 2, 8147);
      const micro = hash2i(x, y, 8161);

      // Subtle meadow grass variation (prairie green, deep forest moss, sunlit clover)
      let r = lerp(74, 118, macro) + (moss - 0.5) * 20 + (blades - 0.5) * 16;
      let g = lerp(116, 162, macro) + (moss - 0.5) * 18 + (blades - 0.5) * 20;
      let b = lerp(48, 76, macro) + (blades - 0.5) * 10;

      // Tiny scattered medieval meadow wildflowers (cream & buttercup flecks)
      const flCell = tileWorley(u, v, 20, 8179);
      if (flCell.f1 < 0.085 && flCell.id > 0.84) {
        const bloom = 1.0 - smoothstep(0.03, 0.085, flCell.f1);
        const isGold = flCell.id > 0.92;
        r = lerp(r, isGold ? 236 : 246, bloom * 0.78);
        g = lerp(g, isGold ? 206 : 242, bloom * 0.78);
        b = lerp(b, isGold ? 78 : 224, bloom * 0.78);
      }

      height[i] = clamp01(0.45 + (blades - 0.5) * 0.34 + (macro - 0.5) * 0.14);
      rough[i] = clamp01(0.88 + (0.5 - blades) * 0.08 + (micro - 0.5) * 0.04);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + (micro - 0.5) * 8)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (micro - 0.5) * 8)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (micro - 0.5) * 6)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.3, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** Medieval Biome 1: Compacted Cobblestone Courtyard & Rutted Mud Wagon Road (512x512) */
function buildMedievalCobbleRoadPBR(anisotropy) {
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
      const cobble = tileWorley(u, v, 14, 8209);
      const mudNoise = tileFBM(u, v, 6, 3, 8221);
      const grain = hash2i(x, y, 8237);

      const isJoint = 1.0 - smoothstep(0.03, 0.11, cobble.edge);
      const tone = cobble.id;
      const mudPatch = smoothstep(0.56, 0.84, mudNoise);

      // Rounded medieval cobblestone pavers set into compacted ochre-brown wagon earth
      let r = lerp(136, 174, tone) + (grain - 0.5) * 14;
      let g = lerp(128, 164, tone) + (grain - 0.5) * 14;
      let b = lerp(116, 148, tone) + (grain - 0.5) * 12;

      // Earthy mud rutting between stones
      r = lerp(r, 114, Math.max(isJoint * 0.78, mudPatch * 0.45));
      g = lerp(g, 96, Math.max(isJoint * 0.78, mudPatch * 0.45));
      b = lerp(b, 74, Math.max(isJoint * 0.78, mudPatch * 0.45));

      height[i] = clamp01(0.72 - isJoint * 0.48 - mudPatch * 0.16 + (grain - 0.5) * 0.08);
      rough[i] = clamp01(0.84 + isJoint * 0.12 - (1 - mudPatch) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 3.1, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** Medieval Biome 2: Crushed Pale-Grey Limestone Quarry Dust & Chippings (512x512) */
function buildMedievalLimestoneDustPBR(anisotropy) {
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
      const dust = tileFBM(u, v, 7, 3, 8311);
      const chips = tileWorley(u, v, 22, 8329);
      const micro = hash2i(x, y, 8353);

      const chipBump = smoothstep(0.05, 0.18, chips.edge);
      const lum = lerp(164, 206, dust) + (chipBump - 0.5) * 20 + (micro - 0.5) * 14;

      height[i] = clamp01(0.46 + chipBump * 0.24 + (dust - 0.5) * 0.18);
      rough[i] = clamp01(0.9 + (0.5 - dust) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(lum * 1.0)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.99)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.95)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.6, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** Medieval Biome 3: Wet Turquoise Moat Bank Moss, Sedge & River Pebbles (512x512) */
function buildMedievalMoatMossPBR(anisotropy) {
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
      const moss = tileFBM(u, v, 8, 3, 8419);
      const peb = tileWorley(u, v, 18, 8429);
      const grain = hash2i(x, y, 8443);

      const isPebble = smoothstep(0.08, 0.22, peb.edge) * smoothstep(0.55, 0.8, tileFBM(u, v, 5, 2, 8461));
      let r = lerp(56, 94, moss);
      let g = lerp(96, 134, moss);
      let b = lerp(52, 76, moss);

      r = lerp(r, 128, isPebble * 0.65);
      g = lerp(g, 124, isPebble * 0.65);
      b = lerp(b, 114, isPebble * 0.65);

      height[i] = clamp01(0.44 + isPebble * 0.28 + (moss - 0.5) * 0.2);
      rough[i] = clamp01(0.74 - isPebble * 0.14 + (grain - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + (grain - 0.5) * 8)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (grain - 0.5) * 8)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (grain - 0.5) * 8)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.5, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Weathered Medieval Ashlar Castle Stone PBR (Albedo + Normal + Roughness) */
function buildMedievalAshlarStonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 4;
  const cols = 3;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    const stagger = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uStag = (u * cols + stagger) % cols;
      const col = Math.floor(uStag);
      const cu = uStag % 1;

      const blockTone = hash2i(col + 17, row + 31, 8501);
      const stoneGrain = tileFBM(u, v, 14, 3, 8521);
      const lichen = smoothstep(0.66, 0.88, tileFBM(u, v, 8, 3, 8539));
      const micro = hash2i(x, y, 8563);

      // Deep recessed medieval lime mortar joints with hand-chiseled block edge chamfer
      const jointV = Math.min(rv, 1 - rv);
      const jointU = Math.min(cu, 1 - cu) * (rows / cols);
      const minJ = Math.min(jointV, jointU);
      const isMortar = 1.0 - smoothstep(0.032, 0.068, minJ);
      const bevel = smoothstep(0.06, 0.14, minJ);

      // Warm weathered French/European fortress limestone grey-beige
      let r = lerp(152, 188, blockTone) + (stoneGrain - 0.5) * 24 + (micro - 0.5) * 10;
      let g = lerp(148, 182, blockTone) + (stoneGrain - 0.5) * 22 + (micro - 0.5) * 10;
      let b = lerp(138, 170, blockTone) + (stoneGrain - 0.5) * 20 + (micro - 0.5) * 10;

      // Subtle weathered moss/lichen patina clinging near mortar joints
      const mossMix = lichen * (0.28 + isMortar * 0.45);
      r = lerp(r, 98, mossMix);
      g = lerp(g, 118, mossMix);
      b = lerp(b, 74, mossMix);

      // Dark shadowed mortar groove
      r = lerp(r, 92, isMortar * 0.78);
      g = lerp(g, 88, isMortar * 0.78);
      b = lerp(b, 80, isMortar * 0.78);

      height[i] = clamp01(0.24 + bevel * 0.52 + (stoneGrain - 0.5) * 0.18 - isMortar * 0.22);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.8 + isMortar * 0.15 + (0.5 - stoneGrain) * 0.1) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.2);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Medieval Ashlar Curtain Wall with Recessed Arrow-Slit Embrasure (Meurtrière) PBR */
function buildMedievalArrowSlitStonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 4;
  const cols = 3;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    const stagger = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uStag = (u * cols + stagger) % cols;
      const col = Math.floor(uStag);
      const cu = uStag % 1;

      const blockTone = hash2i(col + 19, row + 37, 8609);
      const stoneGrain = tileFBM(u, v, 14, 3, 8627);
      const micro = hash2i(x, y, 8641);

      const minJ = Math.min(Math.min(rv, 1 - rv), Math.min(cu, 1 - cu) * (rows / cols));
      const isMortar = 1.0 - smoothstep(0.032, 0.068, minJ);
      const bevel = smoothstep(0.06, 0.14, minJ);

      let r = lerp(150, 186, blockTone) + (stoneGrain - 0.5) * 24 + (micro - 0.5) * 9;
      let g = lerp(146, 180, blockTone) + (stoneGrain - 0.5) * 22 + (micro - 0.5) * 9;
      let b = lerp(136, 168, blockTone) + (stoneGrain - 0.5) * 20 + (micro - 0.5) * 9;

      r = lerp(r, 90, isMortar * 0.78);
      g = lerp(g, 86, isMortar * 0.78);
      b = lerp(b, 78, isMortar * 0.78);

      let h = clamp01(0.26 + bevel * 0.5 + (stoneGrain - 0.5) * 0.16 - isMortar * 0.22);
      let roughVal = 0.84;

      // Cruciform medieval arrow-slit embrasure (meurtrière) centered in the stone face
      const dx = Math.abs(u - 0.5);
      const dy = Math.abs(v - 0.5);
      const inVertSlit = dx < 0.036 && dy < 0.30;
      const inCrossSlit = dx < 0.115 && Math.abs(v - 0.44) < 0.032;
      const inSlit = inVertSlit || inCrossSlit;
      const inBevelFrame = !inSlit && ((dx < 0.088 && dy < 0.35) || (dx < 0.155 && Math.abs(v - 0.44) < 0.068));

      if (inSlit) {
        r = 22;
        g = 24;
        b = 28;
        h = 0.04;
        roughVal = 0.96;
      } else if (inBevelFrame) {
        r *= 0.86;
        g *= 0.85;
        b *= 0.83;
        h = clamp01(h + 0.14);
        roughVal = 0.78;
      }

      height[i] = h;
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(roughVal * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Reinforced Oak & Wrought-Iron Portcullis / Castle Gate PBR */
function buildMedievalPortcullisOakPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const grain = tileFBM(u * 2.5, v * 14, 10, 3, 8707);
      const stoneNoise = tileFBM(u, v, 12, 3, 8719);
      const micro = hash2i(x, y, 8737);

      // Arched stone gate surround framing the recessed oak door & iron portcullis grate
      const archDx = (u - 0.5) / 0.37;
      const archTopY = 0.34;
      const insideArch =
        Math.abs(u - 0.5) < 0.37 &&
        (v > archTopY || Math.hypot(archDx, (v - archTopY) / 0.24) < 1.0);
      const onVoussoirRing =
        !insideArch &&
        Math.abs(u - 0.5) < 0.45 &&
        (v > archTopY || Math.hypot((u - 0.5) / 0.45, (v - archTopY) / 0.31) < 1.0);

      let r, g, b, h, roughVal;

      if (!insideArch) {
        // Dressed limestone gatehouse stone surround & radial arch voussoirs
        const lum = (onVoussoirRing ? 176 : 158) + (stoneNoise - 0.5) * 26 + (micro - 0.5) * 10;
        r = lum * 1.0;
        g = lum * 0.97;
        b = lum * 0.91;
        h = onVoussoirRing ? 0.84 : 0.72;
        roughVal = 0.84;
      } else {
        // Heavy vertical oak planks behind dark wrought-iron portcullis grille
        const plank = (u * 8) % 1;
        const plankSeam = plank < 0.06 || plank > 0.94;
        r = lerp(84, 118, grain) * (plankSeam ? 0.55 : 1.0);
        g = lerp(54, 78, grain) * (plankSeam ? 0.55 : 1.0);
        b = lerp(32, 48, grain) * (plankSeam ? 0.55 : 1.0);
        h = plankSeam ? 0.24 : 0.42;
        roughVal = 0.82;

        // Forged iron vertical & horizontal portcullis lattice bars
        const barU = Math.abs(((u * 6) % 1) - 0.5) < 0.095;
        const barV = Math.abs(((v * 5) % 1) - 0.5) < 0.085;
        if (barU || barV) {
          const isRivet = barU && barV;
          r = isRivet ? 88 : 48;
          g = isRivet ? 92 : 52;
          b = isRivet ? 98 : 58;
          h = isRivet ? 0.92 : 0.76;
          roughVal = 0.38;
        }
      }

      height[i] = clamp01(h);
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(roughVal * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.8);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Conical Dark-Blue Slate Turret Shingles PBR (Albedo + Normal + Roughness) */
function buildMedievalSlateShinglesPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 10;
  const cols = 8;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    const stagger = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uS = (u * cols + stagger) % cols;
      const col = Math.floor(uS);
      const cu = uS % 1;

      const tileTone = hash2i(col + 13, row + 29, 8803);
      const slateGrain = tileFBM(u, v, 16, 2, 8819);
      const micro = hash2i(x, y, 8837);

      // Scalloped royal French slate shingle overlap lip
      const scallopEdge = 0.86 + Math.sin(cu * Math.PI) * 0.1;
      const lipShadow = smoothstep(scallopEdge - 0.12, scallopEdge, rv);
      const sideSeam = cu < 0.045 || cu > 0.955 ? 1.0 : 0.0;

      // Deep noble medieval blue-slate palette
      let r = lerp(44, 68, tileTone) + (slateGrain - 0.5) * 14;
      let g = lerp(62, 92, tileTone) + (slateGrain - 0.5) * 16;
      let b = lerp(88, 128, tileTone) + (slateGrain - 0.5) * 18;

      const darkEdge = Math.max(lipShadow * 0.52, sideSeam * 0.42);
      r *= 1.0 - darkEdge;
      g *= 1.0 - darkEdge;
      b *= 1.0 - darkEdge;

      // Subtle crisp blue-silver highlight right above the shingle overlap
      const catchLight = smoothstep(0.66, 0.82, rv) * (1.0 - lipShadow);
      r += catchLight * 14;
      g += catchLight * 18;
      b += catchLight * 24;

      height[i] = clamp01(0.28 + rv * 0.58 - lipShadow * 0.45 - sideSeam * 0.25 + (slateGrain - 0.5) * 0.08);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r + (micro - 0.5) * 6)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (micro - 0.5) * 6)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (micro - 0.5) * 6)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.46 + darkEdge * 0.32 + (0.5 - slateGrain) * 0.12) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.4);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Rough Grey Quarry Limestone Rock PBR (Stage 0 Raw Quarry Block) */
function buildMedievalRawLimestonePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const vor = tileWorley(u, v, 8, 8923);
      const strata = tileFBM(u * 1.4, v * 3.0, 8, 3, 8933);
      const micro = hash2i(x, y, 8951);

      const crack = 1.0 - smoothstep(0.02, 0.085, vor.edge);
      const facet = vor.id;
      const lum = lerp(126, 174, facet * 0.55 + strata * 0.45) - crack * 54 + (micro - 0.5) * 14;

      height[i] = clamp01(0.62 - crack * 0.46 + (strata - 0.5) * 0.28);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(lum * 1.0)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.99)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.96)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.86 + crack * 0.12) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 4.0);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Hewn Medieval Oak Timber Beams & Drawbridge Planks PBR */
function buildMedievalOakTimberPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const plank = (v * 6) % 1;
    const plankId = Math.floor(v * 6);
    const isSeam = plank < 0.045 || plank > 0.955;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const grain = tileFBM(u * 1.5, v * 16, 8, 3, 9011);
      const tone = hash2i(plankId, 23, 9029);
      const micro = hash2i(x, y, 9041);

      let r = lerp(104, 138, tone * 0.4 + grain * 0.6);
      let g = lerp(70, 96, tone * 0.4 + grain * 0.6);
      let b = lerp(42, 60, tone * 0.4 + grain * 0.6);
      if (isSeam) {
        r *= 0.54;
        g *= 0.54;
        b *= 0.54;
      }

      height[i] = clamp01((isSeam ? 0.16 : 0.58) + (grain - 0.5) * 0.22);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r + (micro - 0.5) * 8)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (micro - 0.5) * 8)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (micro - 0.5) * 6)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.82 + (isSeam ? 0.14 : 0) + (0.5 - grain) * 0.1) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.8);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/* ============================================================================
 * LEVEL 9 (CLASSICAL CULTURAL ERA — LE GRAND MUSÉE NATIONAL) — 512x512 PBR PACK
 * ========================================================================== */

/** Museum Biome 0: Manicured Royal Park Lawn, Boxwood Green & Floral Park Borders (512x512) */
function buildMuseumParkLawnPBR(anisotropy) {
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
      const macro = tileFBM(u, v, 5, 3, 9103);
      const blades = tileFBM(u * 2.5, v * 2.5, 24, 2, 9127);
      const mowStripe = Math.sin(u * Math.PI * 6) * 0.5 + 0.5;
      const micro = hash2i(x, y, 9151);

      let r = lerp(78, 114, macro) + (mowStripe - 0.5) * 14 + (blades - 0.5) * 14;
      let g = lerp(128, 170, macro) + (mowStripe - 0.5) * 16 + (blades - 0.5) * 18;
      let b = lerp(56, 82, macro) + (blades - 0.5) * 8;

      // Subtle garden blossom specks
      const fl = tileWorley(u, v, 22, 9173);
      if (fl.f1 < 0.075 && fl.id > 0.87) {
        const bloom = 1.0 - smoothstep(0.025, 0.075, fl.f1);
        const isRose = fl.id > 0.94;
        r = lerp(r, isRose ? 242 : 250, bloom * 0.72);
        g = lerp(g, isRose ? 156 : 244, bloom * 0.72);
        b = lerp(b, isRose ? 174 : 216, bloom * 0.72);
      }

      height[i] = clamp01(0.46 + (blades - 0.5) * 0.3 + (macro - 0.5) * 0.1);
      rough[i] = clamp01(0.88 + (0.5 - blades) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r + (micro - 0.5) * 6)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (micro - 0.5) * 6)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (micro - 0.5) * 6)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.0, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** Museum Biome 1: Smooth Cream Flagstone Promenade & Gravel Esplanade (512x512) */
function buildMuseumFlagstonePlazaPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const tiles = 6;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * tiles);
    const rv = (v * tiles) % 1;
    const stag = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uS = (u * tiles + stag) % tiles;
      const col = Math.floor(uS);
      const cu = uS % 1;

      const tone = hash2i(col + 11, row + 23, 9203);
      const grain = tileFBM(u, v, 14, 3, 9221);
      const micro = hash2i(x, y, 9241);

      const minJ = Math.min(Math.min(rv, 1 - rv), Math.min(cu, 1 - cu));
      const isJoint = 1.0 - smoothstep(0.02, 0.052, minJ);

      let r = lerp(208, 230, tone) + (grain - 0.5) * 16 + (micro - 0.5) * 8;
      let g = lerp(200, 222, tone) + (grain - 0.5) * 16 + (micro - 0.5) * 8;
      let b = lerp(184, 206, tone) + (grain - 0.5) * 14 + (micro - 0.5) * 8;

      r = lerp(r, 152, isJoint * 0.72);
      g = lerp(g, 146, isJoint * 0.72);
      b = lerp(b, 134, isJoint * 0.72);

      height[i] = clamp01(0.68 - isJoint * 0.44 + (grain - 0.5) * 0.1);
      rough[i] = clamp01(0.76 + isJoint * 0.18 + (0.5 - grain) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.4, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** Museum Biome 2: Crushed White Carrara Marble & Cream Limestone Quarry Dust (512x512) */
function buildMuseumMarbleDustPBR(anisotropy) {
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
      const dust = tileFBM(u, v, 8, 3, 9311);
      const chips = tileWorley(u, v, 24, 9323);
      const micro = hash2i(x, y, 9341);

      const chipBump = smoothstep(0.05, 0.18, chips.edge);
      const lum = lerp(206, 242, dust) + (chipBump - 0.5) * 18 + (micro - 0.5) * 10;

      height[i] = clamp01(0.48 + chipBump * 0.22 + (dust - 0.5) * 0.16);
      rough[i] = clamp01(0.86 + (0.5 - dust) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(lum * 1.0)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.99)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.95)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.3, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** Museum Biome 3: Reflecting Pool Bank Moss & Pale Marble Gravel Border (512x512) */
function buildMuseumPoolBankPBR(anisotropy) {
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
      const grav = tileWorley(u, v, 20, 9403);
      const tone = tileFBM(u, v, 8, 3, 9419);
      const micro = hash2i(x, y, 9437);

      const isStone = smoothstep(0.04, 0.18, grav.edge);
      const lum = lerp(176, 218, tone * 0.6 + grav.id * 0.4) * (0.86 + isStone * 0.16);

      height[i] = clamp01(0.45 + isStone * 0.28 + (tone - 0.5) * 0.14);
      rough[i] = clamp01(0.74 - isStone * 0.12 + (micro - 0.5) * 0.08);

      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, Math.round(lum * 0.98 + (micro - 0.5) * 8)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.99 + (micro - 0.5) * 8)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.93 + (micro - 0.5) * 8)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalRoughCanvas = buildSobelNormalCanvas(height, size, 2.4, rough);
  return {
    albedo: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalRough: wrapTexture(normalRoughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Smooth Cream Museum Limestone Ashlar PBR (Albedo + Normal + Roughness) */
function buildMuseumLimestoneAshlarPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 4;
  const cols = 3;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    const stag = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uS = (u * cols + stag) % cols;
      const col = Math.floor(uS);
      const cu = uS % 1;

      const blockTone = hash2i(col + 13, row + 29, 9511);
      const stoneGrain = tileFBM(u, v, 14, 3, 9521);
      const micro = hash2i(x, y, 9539);

      const minJ = Math.min(Math.min(rv, 1 - rv), Math.min(cu, 1 - cu) * (rows / cols));
      const isMortar = 1.0 - smoothstep(0.018, 0.044, minJ);
      const bevel = smoothstep(0.04, 0.1, minJ);

      // Refined Parisian/Beaux-Arts pale cream Lutetian limestone
      let r = lerp(224, 242, blockTone) + (stoneGrain - 0.5) * 14 + (micro - 0.5) * 6;
      let g = lerp(214, 232, blockTone) + (stoneGrain - 0.5) * 14 + (micro - 0.5) * 6;
      let b = lerp(194, 212, blockTone) + (stoneGrain - 0.5) * 12 + (micro - 0.5) * 6;

      r = lerp(r, 174, isMortar * 0.72);
      g = lerp(g, 166, isMortar * 0.72);
      b = lerp(b, 150, isMortar * 0.72);

      height[i] = clamp01(0.32 + bevel * 0.46 + (stoneGrain - 0.5) * 0.12 - isMortar * 0.24);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.68 + isMortar * 0.2 + (0.5 - stoneGrain) * 0.08) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 2.6);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Museum Gallery Wall with Tall Classical Arched Window PBR */
function buildMuseumArchedWindowPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const stoneGrain = tileFBM(u, v, 12, 3, 9601);
      const micro = hash2i(x, y, 9619);

      // Tall neoclassical arched window centered in the dressed limestone bay
      const archCenterY = 0.34;
      const halfW = 0.28;
      const dx = Math.abs(u - 0.5);
      const inRect = dx < halfW && v >= archCenterY && v <= 0.88;
      const inArch = v < archCenterY && Math.hypot((u - 0.5) / halfW, (v - archCenterY) / 0.22) < 1.0;
      const inWindow = inRect || inArch;

      const inFrame =
        !inWindow &&
        ((dx < halfW + 0.06 && v >= archCenterY && v <= 0.92) ||
          (v < archCenterY && Math.hypot((u - 0.5) / (halfW + 0.06), (v - archCenterY) / 0.27) < 1.0));

      let r, g, b, h, roughVal;

      if (!inWindow) {
        const lum = (inFrame ? 236 : 226) + (stoneGrain - 0.5) * 16 + (micro - 0.5) * 6;
        r = lum * 1.0;
        g = lum * 0.96;
        b = lum * 0.87;
        h = inFrame ? 0.84 : 0.66;
        roughVal = 0.72;
      } else {
        // Warm sunlit gallery interior glow behind sleek sky-tinted bronze-mullioned glass
        const glow = clamp01(1.0 - Math.hypot((u - 0.5) * 1.6, (v - 0.58) * 1.4));
        r = lerp(126, 224, glow * 0.75);
        g = lerp(164, 216, glow * 0.72);
        b = lerp(188, 178, glow * 0.65);
        h = 0.16;
        roughVal = 0.18;

        // Crisp dark bronze classical window mullions & arch radial muntins
        const vBar = Math.abs(u - 0.5) < 0.018 || Math.abs(dx - 0.14) < 0.013;
        const hBar = Math.abs(v - archCenterY) < 0.018 || Math.abs(v - 0.61) < 0.015;
        if (vBar || hBar) {
          r = 46;
          g = 48;
          b = 52;
          h = 0.56;
          roughVal = 0.36;
        }
      }

      height[i] = clamp01(h);
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(roughVal * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.2);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Fluted White Carrara Marble Colonnade Columns PBR */
function buildMuseumFlutedMarblePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      // 14 crisp vertical classical marble flutes + delicate Carrara grey veining
      const fluteWave = Math.cos(u * 14 * Math.PI * 2);
      const flute = clamp01(0.5 + fluteWave * 0.5);
      const veinWarp = tileFBM(u, v, 5, 3, 9719);
      const vein = smoothstep(0.68, 0.92, Math.abs(Math.sin((u * 3.5 + v * 2.2 + veinWarp * 2.8) * Math.PI)));
      const micro = hash2i(x, y, 9733);

      const lum = lerp(224, 250, flute * 0.72 + 0.28) - (1 - vein) * 18 + (micro - 0.5) * 5;

      height[i] = clamp01(0.22 + flute * 0.68 + (veinWarp - 0.5) * 0.06);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(lum * 1.0)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.99)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.97)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.36 + (1 - flute) * 0.16) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Carved Classical Pediment Frieze & Cornice Relief PBR */
function buildMuseumPedimentFriezePBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const grain = tileFBM(u, v, 14, 3, 9803);
      const micro = hash2i(x, y, 9817);

      // Classical 3-band entablature: upper dentil cornice, central carved triglyph/metope frieze, lower architrave
      let relief = 0.55;
      let goldAccent = 0;
      if (v < 0.18) {
        // Upper cornice dentils
        const dentil = Math.sin(u * 20 * Math.PI * 2) > 0 ? 0.88 : 0.34;
        relief = v < 0.08 ? 0.92 : dentil;
      } else if (v > 0.24 && v < 0.72) {
        // Triglyphs & sculpted medallion metopes
        const cellU = (u * 4) % 1;
        if (cellU < 0.28) {
          const groove = Math.sin((cellU / 0.28) * 3 * Math.PI * 2) * 0.5 + 0.5;
          relief = 0.38 + groove * 0.5;
        } else {
          // Classical laurel rosette medallion in the metope center
          const md = Math.hypot((cellU - 0.64) * 2.2, (v - 0.48) * 2.6);
          const ring = smoothstep(0.18, 0.26, md) * (1.0 - smoothstep(0.32, 0.42, md));
          const boss = 1.0 - smoothstep(0.08, 0.16, md);
          relief = 0.42 + (ring + boss) * 0.46;
          goldAccent = (ring + boss) * 0.55;
        }
      } else if (v >= 0.72 && v < 0.80) {
        relief = 0.84;
      }

      let r = lerp(196, 242, relief) + (grain - 0.5) * 14 + (micro - 0.5) * 6;
      let g = lerp(188, 232, relief) + (grain - 0.5) * 14 + (micro - 0.5) * 6;
      let b = lerp(170, 212, relief) + (grain - 0.5) * 12 + (micro - 0.5) * 6;

      if (goldAccent > 0.05) {
        r = lerp(r, 228, goldAccent * 0.55);
        g = lerp(g, 192, goldAccent * 0.55);
        b = lerp(b, 98, goldAccent * 0.55);
      }

      height[i] = clamp01(relief + (grain - 0.5) * 0.08);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.7 - goldAccent * 0.32) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.6);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Tinted Glass & Wrought-Iron Skylight Roof (Verrière) PBR */
function buildMuseumVerriereGlassPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const sheen = tileFBM(u, v, 6, 2, 9901);

      // Beaux-Arts wrought-iron structural skylight ribs framing luminous sky-tinted glass panes
      const ribU = ((u * 4) % 1);
      const ribV = ((v * 3) % 1);
      const isMajorRib = ribU < 0.055 || ribU > 0.945 || ribV < 0.048 || ribV > 0.952;
      const isMinorRib = Math.abs(ribU - 0.5) < 0.018;

      let r, g, b, h, roughVal;
      if (isMajorRib || isMinorRib) {
        r = 46;
        g = 56;
        b = 66;
        h = isMajorRib ? 0.92 : 0.72;
        roughVal = 0.38;
      } else {
        // Luminous sunlit pale-aqua & golden sky reflection on classical Verrière glass
        const diagGlow = smoothstep(0.15, 0.85, (u + v) * 0.5 + (sheen - 0.5) * 0.2);
        r = lerp(152, 224, diagGlow);
        g = lerp(214, 244, diagGlow);
        b = lerp(234, 250, diagGlow);
        h = 0.22;
        roughVal = 0.12;
      }

      height[i] = h;
      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(roughVal * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.2);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Beaux-Arts Blue-Grey Museum Wing Slate Roof PBR */
function buildMuseumSlateRoofPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  const rows = 8;
  const cols = 6;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const rv = (v * rows) % 1;
    const stag = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const uS = (u * cols + stag) % cols;
      const col = Math.floor(uS);
      const cu = uS % 1;

      const tone = hash2i(col + 17, row + 31, 9941);
      const grain = tileFBM(u, v, 14, 2, 9949);
      const lip = smoothstep(0.84, 0.96, rv);
      const seam = cu < 0.04 || cu > 0.96 ? 1.0 : 0.0;
      const dark = Math.max(lip * 0.45, seam * 0.35);

      let r = (lerp(72, 98, tone) + (grain - 0.5) * 12) * (1 - dark);
      let g = (lerp(90, 118, tone) + (grain - 0.5) * 14) * (1 - dark);
      let b = (lerp(112, 144, tone) + (grain - 0.5) * 16) * (1 - dark);

      height[i] = clamp01(0.32 + rv * 0.54 - lip * 0.42 - seam * 0.22);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.48 + dark * 0.28) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.0);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}

/** 512x512 Rough Cream Limestone & White Carrara Marble Quarry Rock PBR (Stage 0) */
function buildMuseumRawMarbleRockPBR(anisotropy) {
  const size = 512;
  const albedoCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);
  const ctx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const vor = tileWorley(u, v, 8, 9967);
      const strata = tileFBM(u * 1.4, v * 2.8, 8, 3, 9973);
      const micro = hash2i(x, y, 9991);

      const crack = 1.0 - smoothstep(0.02, 0.085, vor.edge);
      const lum = lerp(186, 236, vor.id * 0.5 + strata * 0.5) - crack * 52 + (micro - 0.5) * 12;

      height[i] = clamp01(0.64 - crack * 0.44 + (strata - 0.5) * 0.24);

      const idx = i * 4;
      img.data[idx] = Math.min(255, Math.max(0, Math.round(lum * 1.0)));
      img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum * 0.98)));
      img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum * 0.92)));
      img.data[idx + 3] = 255;

      const rvByte = Math.round(clamp01(0.8 + crack * 0.16) * 255);
      rImg.data[idx] = rvByte;
      rImg.data[idx + 1] = rvByte;
      rImg.data[idx + 2] = rvByte;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = buildSobelNormalCanvas(height, size, 3.8);
  return {
    map: wrapTexture(albedoCanvas, { isColor: true, anisotropy }),
    normalMap: wrapTexture(normalCanvas, { isColor: false, anisotropy }),
    roughnessMap: wrapTexture(roughCanvas, { isColor: false, anisotropy }),
  };
}
