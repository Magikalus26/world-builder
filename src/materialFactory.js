/**
 * Workd Builder — Centralized HD PBR Material Factory (`MaterialFactory`)
 * Unified procedural PBR material & texture generator serving:
 *  - All current levels (Levels 1–5)
 *  - Procedural Roguelike runs
 *  - 100-Level World Map & all future levels (Levels 6–100)
 *
 * Features:
 *  - 512x512 HD procedural PBR triplets (map + bumpMap + roughnessMap) for blocks, masonry,
 *    bricks, timber, forged iron, and roofs with deep mortar joints, grain & micro-fissures
 *  - 1024x1024 HD procedural PBR triplets for terrains & geological cross-section plinths
 *  - Automatic applyCrispTextureSettings() on every generated texture
 *  - Extensible theme/civilization palette registry (Egypt, Rome, Japan, Maya, Penitentiary 1800,
 *    Vikings, Medieval Europe, Arabia, Greece, Indus, Imperial + custom theme registration)
 *  - Standardized ultra-crisp frosted-blue glass ghost placement materials with soft luminous pulse
 */

import * as THREE from 'three';
import { applyCrispTextureSettings } from './graphicsCore.js';

export const THEME_PALETTES = {
  egypt: {
    id: 'egypt',
    groundBase: '#e3bc75',
    groundDetail: '#c89b52',
    strataColors: ['#d9b06a', '#c38f4a', '#9c6834', '#744824'],
    stone: { base: '#e2c994', mortar: '#9e8554', roughness: 0.78, metalness: 0.06, pattern: 'ashlar' },
    brick: { base: '#c99762', mortar: '#8f6b43', roughness: 0.84, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#8e623a', mortar: '#593a1e', roughness: 0.82, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#d9a444', mortar: '#8d6218', roughness: 0.44, metalness: 0.55, pattern: 'slate' },
    metal: { base: '#e5b84b', mortar: '#966b18', roughness: 0.28, metalness: 0.86, pattern: 'metal' },
    accent: { base: '#21a6ba', mortar: '#126474', roughness: 0.32, metalness: 0.24, pattern: 'ashlar' },
  },
  rome: {
    id: 'rome',
    groundBase: '#879d5c',
    groundDetail: '#b89f72',
    strataColors: ['#7d9452', '#a8875b', '#87694a', '#634d38'],
    stone: { base: '#e5dfd2', mortar: '#a49b8c', roughness: 0.62, metalness: 0.06, pattern: 'ashlar' },
    brick: { base: '#be6444', mortar: '#d6ccbc', roughness: 0.76, metalness: 0.05, pattern: 'brick' },
    wood: { base: '#7d5434', mortar: '#4c311c', roughness: 0.82, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#ba5a3a', mortar: '#75341f', roughness: 0.74, metalness: 0.06, pattern: 'slate' },
    metal: { base: '#cf9844', mortar: '#7a541a', roughness: 0.34, metalness: 0.82, pattern: 'metal' },
    accent: { base: '#9e2f2b', mortar: '#661b18', roughness: 0.68, metalness: 0.08, pattern: 'ashlar' },
  },
  japan: {
    id: 'japan',
    groundBase: '#5d8854',
    groundDetail: '#8f8772',
    strataColors: ['#577e4e', '#766146', '#5c4b3a', '#443a31'],
    stone: { base: '#8e9294', mortar: '#525659', roughness: 0.8, metalness: 0.06, pattern: 'ashlar' },
    brick: { base: '#f0e5cc', mortar: '#553a28', roughness: 0.72, metalness: 0.04, pattern: 'ashlar' },
    wood: { base: '#573826', mortar: '#321e13', roughness: 0.78, metalness: 0.06, pattern: 'wood' },
    roof: { base: '#374659', mortar: '#1e2834', roughness: 0.48, metalness: 0.22, pattern: 'slate' },
    metal: { base: '#c48d3a', mortar: '#754f1a', roughness: 0.32, metalness: 0.82, pattern: 'metal' },
    accent: { base: '#bc342a', mortar: '#731c16', roughness: 0.52, metalness: 0.1, pattern: 'wood' },
  },
  maya: {
    id: 'maya',
    groundBase: '#457c44',
    groundDetail: '#b8a478',
    strataColors: ['#3f733e', '#8b754c', '#6c5a3e', '#4c412e'],
    stone: { base: '#d2c69e', mortar: '#867d5e', roughness: 0.8, metalness: 0.05, pattern: 'ashlar' },
    brick: { base: '#af442e', mortar: '#74291b', roughness: 0.76, metalness: 0.05, pattern: 'brick' },
    wood: { base: '#623e24', mortar: '#3a2313', roughness: 0.84, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#b58d48', mortar: '#745828', roughness: 0.88, metalness: 0.03, pattern: 'wood' },
    metal: { base: '#1fa674', mortar: '#0e5c3f', roughness: 0.26, metalness: 0.32, pattern: 'metal' },
    accent: { base: '#21b67f', mortar: '#0f6143', roughness: 0.24, metalness: 0.28, pattern: 'ashlar' },
  },
  penitentiary: {
    id: 'penitentiary',
    groundBase: '#b88959',
    groundDetail: '#878580',
    strataColors: ['#a97c4f', '#89603c', '#6e523a', '#524034'],
    stone: { base: '#8d9195', mortar: '#525559', roughness: 0.82, metalness: 0.07, pattern: 'ashlar' },
    brick: { base: '#7d3427', mortar: '#9e978e', roughness: 0.84, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#63432b', mortar: '#382415', roughness: 0.84, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#38414b', mortar: '#20262d', roughness: 0.64, metalness: 0.18, pattern: 'slate' },
    metal: { base: '#282c32', mortar: '#121519', roughness: 0.38, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#b9873e', mortar: '#6b4c1c', roughness: 0.32, metalness: 0.84, pattern: 'metal' },
  },
  coalmine: {
    id: 'coalmine',
    groundBase: '#4d5359',
    groundDetail: '#687e4b',
    strataColors: ['#4d6144', '#564c44', '#2f3238', '#1c1e24'],
    stone: { base: '#7e8388', mortar: '#4c5056', roughness: 0.84, metalness: 0.08, pattern: 'ashlar' },
    brick: { base: '#8e3d2d', mortar: '#9d958c', roughness: 0.84, metalness: 0.05, pattern: 'brick' },
    wood: { base: '#583f2c', mortar: '#322216', roughness: 0.86, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#747f8a', mortar: '#48515a', roughness: 0.56, metalness: 0.42, pattern: 'slate' },
    metal: { base: '#2d333b', mortar: '#161a1f', roughness: 0.38, metalness: 0.86, pattern: 'metal' },
    accent: { base: '#d99838', mortar: '#7c5318', roughness: 0.34, metalness: 0.78, pattern: 'metal' },
  },
  modern: {
    id: 'modern',
    groundBase: '#6ea84d',
    groundDetail: '#dfd9cf',
    strataColors: ['#639b47', '#dfd8cc', '#b8684e', '#7f7265'],
    stone: { base: '#f0eee9', mortar: '#c9c4ba', roughness: 0.48, metalness: 0.04, pattern: 'ashlar' },
    brick: { base: '#a64d36', mortar: '#c6bfb4', roughness: 0.76, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#9e6d42', mortar: '#664324', roughness: 0.74, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#eceae4', mortar: '#32373d', roughness: 0.42, metalness: 0.08, pattern: 'ashlar' },
    metal: { base: '#242930', mortar: '#111418', roughness: 0.34, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#6bc4dc', mortar: '#1f262d', roughness: 0.14, metalness: 0.22, pattern: 'ashlar' },
  },
  // Future biome presets ready for Levels 8–100!
  viking: {
    id: 'viking',
    groundBase: '#687e78',
    groundDetail: '#9ca8a6',
    strataColors: ['#637973', '#62686c', '#4a5056', '#353a40'],
    stone: { base: '#7b848b', mortar: '#485056', roughness: 0.84, metalness: 0.08, pattern: 'ashlar' },
    brick: { base: '#8d765c', mortar: '#564433', roughness: 0.86, metalness: 0.04, pattern: 'wood' },
    wood: { base: '#543c2c', mortar: '#302016', roughness: 0.84, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#42352c', mortar: '#251d17', roughness: 0.82, metalness: 0.06, pattern: 'slate' },
    metal: { base: '#5a636c', mortar: '#2c3238', roughness: 0.36, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#36759c', mortar: '#1e4661', roughness: 0.56, metalness: 0.14, pattern: 'wood' },
  },
  medieval: {
    id: 'medieval',
    groundBase: '#6f9452',
    groundDetail: '#9b9687',
    strataColors: ['#698c4d', '#887152', '#685947', '#4c443c'],
    stone: { base: '#c4bfb5', mortar: '#7c786e', roughness: 0.78, metalness: 0.06, pattern: 'ashlar' },
    brick: { base: '#a65c42', mortar: '#c6beb0', roughness: 0.82, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#6b4a2e', mortar: '#3f2a18', roughness: 0.82, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#3f5a7c', mortar: '#24364d', roughness: 0.58, metalness: 0.18, pattern: 'slate' },
    metal: { base: '#4c535c', mortar: '#25292e', roughness: 0.36, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#c99b38', mortar: '#7c5d1b', roughness: 0.34, metalness: 0.82, pattern: 'metal' },
  },
  museum: {
    id: 'museum',
    groundBase: '#699f4f',
    groundDetail: '#ebe5d8',
    strataColors: ['#5f9546', '#e6dfd0', '#c9beaa', '#8b8273'],
    stone: { base: '#f0eadc', mortar: '#c6beae', roughness: 0.62, metalness: 0.04, pattern: 'ashlar' },
    brick: { base: '#e4dac6', mortar: '#bdb3a0', roughness: 0.68, metalness: 0.04, pattern: 'ashlar' },
    wood: { base: '#7d5634', mortar: '#4c321c', roughness: 0.76, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#566d84', mortar: '#324252', roughness: 0.48, metalness: 0.22, pattern: 'slate' },
    metal: { base: '#2c323a', mortar: '#161a1f', roughness: 0.36, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#d9b154', mortar: '#886923', roughness: 0.28, metalness: 0.84, pattern: 'metal' },
  },
  english: {
    id: 'english',
    groundBase: '#5f9444',
    groundDetail: '#d9c496',
    strataColors: ['#588a3e', '#d6bf8f', '#9c5a40', '#5a585c'],
    stone: { base: '#dcc598', mortar: '#a89674', roughness: 0.78, metalness: 0.04, pattern: 'ashlar' },
    brick: { base: '#a84735', mortar: '#dfd6c4', roughness: 0.82, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#3d2c20', mortar: '#221710', roughness: 0.8, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#464d56', mortar: '#262b31', roughness: 0.56, metalness: 0.14, pattern: 'slate' },
    metal: { base: '#d6ae4c', mortar: '#7b5f1c', roughness: 0.3, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#1e5c3a', mortar: '#0e331f', roughness: 0.54, metalness: 0.12, pattern: 'wood' },
  },
  arabian: {
    id: 'arabian',
    groundBase: '#e4b37a',
    groundDetail: '#cc945b',
    strataColors: ['#dba971', '#bd824e', '#945d36', '#6b4125'],
    stone: { base: '#f2e8d4', mortar: '#bba98b', roughness: 0.72, metalness: 0.05, pattern: 'ashlar' },
    brick: { base: '#d99e64', mortar: '#a47244', roughness: 0.8, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#7c4c29', mortar: '#482a14', roughness: 0.8, metalness: 0.05, pattern: 'wood' },
    roof: { base: '#dfa93d', mortar: '#92691b', roughness: 0.32, metalness: 0.78, pattern: 'metal' },
    metal: { base: '#e8bd4c', mortar: '#99741a', roughness: 0.26, metalness: 0.88, pattern: 'metal' },
    accent: { base: '#1da6b0', mortar: '#10646c', roughness: 0.34, metalness: 0.22, pattern: 'ashlar' },
  },
  greek: {
    id: 'greek',
    groundBase: '#d4cec0',
    groundDetail: '#a6a49a',
    strataColors: ['#cfc8ba', '#b3ab9c', '#928a7c', '#716a5e'],
    stone: { base: '#f7f5ef', mortar: '#c6c2b8', roughness: 0.56, metalness: 0.06, pattern: 'ashlar' },
    brick: { base: '#e5dfd3', mortar: '#b8b2a6', roughness: 0.68, metalness: 0.04, pattern: 'ashlar' },
    wood: { base: '#7d5a3b', mortar: '#4c3520', roughness: 0.8, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#2669b8', mortar: '#164278', roughness: 0.44, metalness: 0.16, pattern: 'slate' },
    metal: { base: '#d6a542', mortar: '#88641c', roughness: 0.32, metalness: 0.84, pattern: 'metal' },
    accent: { base: '#2669b8', mortar: '#164278', roughness: 0.46, metalness: 0.14, pattern: 'ashlar' },
  },
  indus: {
    id: 'indus',
    groundBase: '#c68a5e',
    groundDetail: '#9e6844',
    strataColors: ['#be8256', '#9b623f', '#78482e', '#563321'],
    stone: { base: '#ddb892', mortar: '#9b7856', roughness: 0.78, metalness: 0.05, pattern: 'ashlar' },
    brick: { base: '#a34832', mortar: '#c7a484', roughness: 0.82, metalness: 0.04, pattern: 'brick' },
    wood: { base: '#6b4228', mortar: '#3d2414', roughness: 0.82, metalness: 0.04, pattern: 'wood' },
    roof: { base: '#8e3d2b', mortar: '#592317', roughness: 0.74, metalness: 0.08, pattern: 'slate' },
    metal: { base: '#cf9146', mortar: '#7e531e', roughness: 0.34, metalness: 0.8, pattern: 'metal' },
    accent: { base: '#219a9e', mortar: '#115d60', roughness: 0.38, metalness: 0.18, pattern: 'ashlar' },
  },
  imperial: {
    id: 'imperial',
    groundBase: '#d2c6aa',
    groundDetail: '#b3a384',
    strataColors: ['#cbbda1', '#a59377', '#82715a', '#5e5141'],
    stone: { base: '#f5efe0', mortar: '#bab09c', roughness: 0.52, metalness: 0.08, pattern: 'ashlar' },
    brick: { base: '#a83430', mortar: '#e0d6c2', roughness: 0.68, metalness: 0.08, pattern: 'brick' },
    wood: { base: '#684124', mortar: '#3b2210', roughness: 0.74, metalness: 0.06, pattern: 'wood' },
    roof: { base: '#e2ae38', mortar: '#996f16', roughness: 0.28, metalness: 0.84, pattern: 'slate' },
    metal: { base: '#f0c44d', mortar: '#a37b18', roughness: 0.24, metalness: 0.9, pattern: 'metal' },
    accent: { base: '#9e262e', mortar: '#5c1218', roughness: 0.56, metalness: 0.14, pattern: 'ashlar' },
  },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Generates a crisp 512x512 HD procedural PBR triplet (map + bumpMap + roughnessMap)
 * for masonry, brick, wood, slate roof, or forged metal using fast Canvas2D vector & grain layers.
 */
function buildBlockPBRTriplet({ base, mortar, roughness = 0.78, pattern = 'ashlar', seed = 101 }) {
  const size = 512;
  const rand = mulberry32(seed);

  const colCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);

  const cCtx = colCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  const baseCol = new THREE.Color(base);
  const mortarCol = new THREE.Color(mortar);

  // Fill background mortar / grain base
  cCtx.fillStyle = `#${mortarCol.getHexString()}`;
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#282828';
  bCtx.fillRect(0, 0, size, size);
  const roughByte = Math.round(THREE.MathUtils.clamp(roughness, 0.12, 0.98) * 255);
  rCtx.fillStyle = `rgb(${Math.min(255, roughByte + 28)},${Math.min(255, roughByte + 28)},${Math.min(255, roughByte + 28)})`;
  rCtx.fillRect(0, 0, size, size);

  if (pattern === 'ashlar' || pattern === 'brick' || pattern === 'slate') {
    const rows = pattern === 'brick' ? 10 : pattern === 'slate' ? 8 : 4;
    const cols = pattern === 'brick' ? 5 : pattern === 'slate' ? 6 : 3;
    const gap = pattern === 'brick' ? 7 : pattern === 'slate' ? 5 : 9;
    const rowH = size / rows;
    const colW = size / cols;

    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + shift + gap * 0.5;
        const y = r * rowH + gap * 0.5;
        const w = colW - gap;
        const h = rowH - gap;

        const shade = 0.86 + rand() * 0.24;
        const tileCol = baseCol.clone().multiplyScalar(shade);
        cCtx.fillStyle = `#${tileCol.getHexString()}`;
        cCtx.fillRect(x, y, w, h);

        // Crisp beveled top/left highlight & bottom/right shadow inside each course
        cCtx.fillStyle = 'rgba(255, 252, 240, 0.16)';
        cCtx.fillRect(x, y, w, 4);
        cCtx.fillRect(x, y, 4, h);
        cCtx.fillStyle = 'rgba(12, 10, 8, 0.22)';
        cCtx.fillRect(x, y + h - 4, w, 4);
        cCtx.fillRect(x + w - 4, y, 4, h);

        // Deep bump elevation + chamfer edge on bumpMap
        const bVal = Math.round(188 + rand() * 46);
        bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
        bCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
        bCtx.strokeStyle = 'rgb(130,130,130)';
        bCtx.lineWidth = 4;
        bCtx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        // Per-stone roughness variation
        const rv = Math.round(THREE.MathUtils.clamp(roughByte + (rand() - 0.5) * 34, 30, 245));
        rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rCtx.fillRect(x, y, w, h);
      }
    }
  } else if (pattern === 'wood') {
    const planks = 6;
    const pH = size / planks;
    for (let p = 0; p < planks; p++) {
      const y = p * pH;
      const shade = 0.86 + rand() * 0.24;
      const pCol = baseCol.clone().multiplyScalar(shade);
      cCtx.fillStyle = `#${pCol.getHexString()}`;
      cCtx.fillRect(0, y + 3, size, pH - 6);
      bCtx.fillStyle = 'rgb(205,205,205)';
      bCtx.fillRect(0, y + 3, size, pH - 6);
      rCtx.fillStyle = `rgb(${roughByte},${roughByte},${roughByte})`;
      rCtx.fillRect(0, y + 3, size, pH - 6);

      // Fine longitudinal wood grain fibers & knots
      for (let g = 0; g < 18; g++) {
        const gy = y + 5 + rand() * (pH - 10);
        cCtx.strokeStyle = rand() > 0.5 ? 'rgba(20,10,4,0.18)' : 'rgba(255,236,205,0.1)';
        cCtx.lineWidth = 1.5 + rand() * 2;
        cCtx.beginPath();
        cCtx.moveTo(0, gy);
        cCtx.bezierCurveTo(size * 0.33, gy + (rand() - 0.5) * 8, size * 0.66, gy + (rand() - 0.5) * 8, size, gy);
        cCtx.stroke();

        bCtx.strokeStyle = 'rgba(145,145,145,0.35)';
        bCtx.lineWidth = 1.5;
        bCtx.beginPath();
        bCtx.moveTo(0, gy);
        bCtx.lineTo(size, gy);
        bCtx.stroke();
      }
    }
  } else {
    // Forged metal / brushed bronze / hammered iron
    cCtx.fillStyle = `#${baseCol.getHexString()}`;
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = 'rgb(192,192,192)';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = `rgb(${roughByte},${roughByte},${roughByte})`;
    rCtx.fillRect(0, 0, size, size);

    for (let h = 0; h < 220; h++) {
      const hx = rand() * size;
      const hy = rand() * size;
      const hr = 6 + rand() * 20;
      cCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      cCtx.beginPath();
      cCtx.arc(hx, hy, hr, 0, Math.PI * 2);
      cCtx.fill();

      bCtx.fillStyle = rand() > 0.5 ? 'rgba(235,235,235,0.18)' : 'rgba(130,130,130,0.18)';
      bCtx.beginPath();
      bCtx.arc(hx, hy, hr, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // Crisp micro-fissures, mineral speckles & tactile stone grit across all 3 maps
  for (let s = 0; s < 900; s++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const sr = 1 + rand() * 2.4;
    const dark = rand() > 0.45;
    cCtx.fillStyle = dark ? 'rgba(18,14,10,0.11)' : 'rgba(255,250,238,0.11)';
    cCtx.fillRect(sx, sy, sr, sr);
    bCtx.fillStyle = dark ? 'rgba(80,80,80,0.2)' : 'rgba(245,245,245,0.2)';
    bCtx.fillRect(sx, sy, sr, sr);
  }

  // Subtle crisp micro-cracks
  for (let k = 0; k < 22; k++) {
    let cx = rand() * size;
    let cy = rand() * size;
    cCtx.strokeStyle = 'rgba(20,16,12,0.22)';
    cCtx.lineWidth = 1.1;
    bCtx.strokeStyle = 'rgba(40,40,40,0.55)';
    bCtx.lineWidth = 1.6;
    cCtx.beginPath();
    bCtx.beginPath();
    cCtx.moveTo(cx, cy);
    bCtx.moveTo(cx, cy);
    for (let seg = 0; seg < 4; seg++) {
      cx += (rand() - 0.5) * 34;
      cy += (rand() - 0.5) * 34;
      cCtx.lineTo(cx, cy);
      bCtx.lineTo(cx, cy);
    }
    cCtx.stroke();
    bCtx.stroke();
  }

  return {
    map: applyCrispTextureSettings(new THREE.CanvasTexture(colCanvas), { isColor: true, wrap: true }),
    bumpMap: applyCrispTextureSettings(new THREE.CanvasTexture(bumpCanvas), { isColor: false, wrap: true }),
    roughnessMap: applyCrispTextureSettings(new THREE.CanvasTexture(roughCanvas), { isColor: false, wrap: true }),
  };
}

/**
 * Generates a true 1024x1024 HD procedural PBR geological cross-section strata triplet
 * (map + bumpMap + roughnessMap) for thick diorama island plinth skirts.
 */
function buildGeologicalPlinth1024(strataColors, seed = 701) {
  const size = 1024;
  const rand = mulberry32(seed);

  const colCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);

  const cCtx = colCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  const bands = [
    { y0: 0.0, y1: 0.16, col: strataColors[0] || '#d4aa64', rough: 228, bump: 210 },
    { y0: 0.16, y1: 0.44, col: strataColors[1] || '#b27f48', rough: 236, bump: 185 },
    { y0: 0.44, y1: 0.76, col: strataColors[2] || '#845934', rough: 220, bump: 165 },
    { y0: 0.76, y1: 1.0, col: strataColors[3] || '#5b3c24', rough: 205, bump: 150 },
  ];

  // Fill strata bands with organic wavy geological seams
  bands.forEach((b, idx) => {
    const startY = b.y0 * size;
    const endY = b.y1 * size;

    cCtx.fillStyle = b.col;
    cCtx.beginPath();
    cCtx.moveTo(0, startY);
    for (let x = 0; x <= size; x += 32) {
      const wave = idx === 0 ? 0 : Math.sin((x / size) * Math.PI * 4 + idx * 1.9) * 14 + Math.cos((x / size) * Math.PI * 8) * 6;
      cCtx.lineTo(x, startY + wave);
    }
    cCtx.lineTo(size, endY + 24);
    cCtx.lineTo(0, endY + 24);
    cCtx.closePath();
    cCtx.fill();

    bCtx.fillStyle = `rgb(${b.bump},${b.bump},${b.bump})`;
    bCtx.fillRect(0, startY, size, endY - startY + 4);
    rCtx.fillStyle = `rgb(${b.rough},${b.rough},${b.rough})`;
    rCtx.fillRect(0, startY, size, endY - startY + 4);

    // Crisp horizontal sedimentary seam line
    if (idx > 0) {
      cCtx.strokeStyle = 'rgba(24, 14, 6, 0.36)';
      cCtx.lineWidth = 6;
      bCtx.strokeStyle = 'rgb(65,65,65)';
      bCtx.lineWidth = 8;
      cCtx.beginPath();
      bCtx.beginPath();
      for (let x = 0; x <= size; x += 32) {
        const wave = Math.sin((x / size) * Math.PI * 4 + idx * 1.9) * 14 + Math.cos((x / size) * Math.PI * 8) * 6;
        if (x === 0) {
          cCtx.moveTo(x, startY + wave);
          bCtx.moveTo(x, startY + wave);
        } else {
          cCtx.lineTo(x, startY + wave);
          bCtx.lineTo(x, startY + wave);
        }
      }
      cCtx.stroke();
      bCtx.stroke();
    }
  });

  // Embedded sedimentary rock chunks & horizontal strata striations
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = 110 + rand() * (size - 140);
    const w = 14 + rand() * 44;
    const h = 5 + rand() * 14;
    const light = rand() > 0.5;
    cCtx.fillStyle = light ? 'rgba(255, 244, 224, 0.14)' : 'rgba(24, 14, 8, 0.2)';
    cCtx.fillRect(x, y, w, h);
    bCtx.fillStyle = light ? 'rgba(240,240,240,0.34)' : 'rgba(70,70,70,0.34)';
    bCtx.fillRect(x, y, w, h);
  }

  // Fine high-frequency mineral grain at 1024x1024 resolution
  for (let g = 0; g < 2600; g++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const s = 1.5 + rand() * 3.0;
    cCtx.fillStyle = rand() > 0.5 ? 'rgba(255,248,232,0.1)' : 'rgba(18,12,6,0.14)';
    cCtx.fillRect(gx, gy, s, s);
  }

  return {
    map: applyCrispTextureSettings(new THREE.CanvasTexture(colCanvas), { isColor: true, wrap: true }),
    bumpMap: applyCrispTextureSettings(new THREE.CanvasTexture(bumpCanvas), { isColor: false, wrap: true }),
    roughnessMap: applyCrispTextureSettings(new THREE.CanvasTexture(roughCanvas), { isColor: false, wrap: true }),
  };
}

/**
 * Generates a true 1024x1024 HD procedural PBR terrain ground triplet (map + bumpMap + roughnessMap)
 * for any future biome level or plateau.
 */
function buildTerrainGround1024(baseHex, detailHex, seed = 901) {
  const size = 1024;
  const rand = mulberry32(seed);

  const colCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const roughCanvas = makeCanvas(size);

  const cCtx = colCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  cCtx.fillStyle = baseHex;
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(160,160,160)';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(228,228,228)';
  rCtx.fillRect(0, 0, size, size);

  const detailCol = new THREE.Color(detailHex);

  // Layered organic soil patches & wind ripples
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 24 + rand() * 88;
    const ry = 14 + rand() * 44;
    const rot = rand() * Math.PI;
    const alpha = 0.06 + rand() * 0.14;

    cCtx.save();
    cCtx.translate(x, y);
    cCtx.rotate(rot);
    cCtx.fillStyle = `rgba(${Math.round(detailCol.r * 255)},${Math.round(detailCol.g * 255)},${Math.round(detailCol.b * 255)},${alpha.toFixed(3)})`;
    cCtx.beginPath();
    cCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();

    bCtx.fillStyle = rand() > 0.5 ? 'rgba(210,210,210,0.14)' : 'rgba(110,110,110,0.14)';
    bCtx.beginPath();
    bCtx.arc(x, y, ry * 0.7, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Crisp pebbles & fine ground grit at 1024x1024
  for (let p = 0; p < 3400; p++) {
    const px = rand() * size;
    const py = rand() * size;
    const pr = 1.2 + rand() * 3.2;
    const light = rand() > 0.48;
    cCtx.fillStyle = light ? 'rgba(255,250,238,0.14)' : 'rgba(28,20,12,0.16)';
    cCtx.fillRect(px, py, pr, pr);
    bCtx.fillStyle = light ? 'rgba(245,245,245,0.28)' : 'rgba(70,70,70,0.24)';
    bCtx.fillRect(px, py, pr, pr);
  }

  return {
    map: applyCrispTextureSettings(new THREE.CanvasTexture(colCanvas), {
      isColor: true,
      wrap: true,
      repeat: [4, 4],
    }),
    bumpMap: applyCrispTextureSettings(new THREE.CanvasTexture(bumpCanvas), {
      isColor: false,
      wrap: true,
      repeat: [4, 4],
    }),
    roughnessMap: applyCrispTextureSettings(new THREE.CanvasTexture(roughCanvas), {
      isColor: false,
      wrap: true,
      repeat: [4, 4],
    }),
  };
}

/**
 * Generates an ultra-crisp 512x512 frosted-glass blueprint grid texture for placement ghosts.
 */
function buildCrispFrostedGhostTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  // Subtle translucent ice-blue frosted center gradient
  const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, 24, size * 0.5, size * 0.5, size * 0.7);
  grad.addColorStop(0.0, 'rgba(182, 244, 255, 0.34)');
  grad.addColorStop(0.75, 'rgba(116, 224, 255, 0.52)');
  grad.addColorStop(1.0, 'rgba(220, 252, 255, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Ultra-crisp fine blueprint sub-grid lines
  ctx.strokeStyle = 'rgba(232, 253, 255, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const p = (size / 4) * i;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Razor-sharp inner glowing frame border
  ctx.strokeStyle = 'rgba(240, 253, 255, 0.95)';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, size - 14, size - 14);

  return applyCrispTextureSettings(new THREE.CanvasTexture(canvas), { isColor: true, wrap: false });
}

export class MaterialFactory {
  constructor(renderer) {
    this.renderer = renderer;
    this._cache = new Map();
    this._ownedTextures = [];
    this._ownedMaterials = [];
    this._frostedGhostMap = null;
  }

  _trackTex(t) {
    if (t) this._ownedTextures.push(t);
    return t;
  }

  _trackMat(m) {
    if (m) this._ownedMaterials.push(m);
    return m;
  }

  /**
   * Registers or overrides a custom civilization palette for future levels (up to Level 100).
   */
  registerTheme(themeId, palette) {
    THEME_PALETTES[themeId] = { id: themeId, ...palette };
  }

  getPalette(themeId = 'egypt') {
    return THEME_PALETTES[themeId] || THEME_PALETTES.egypt;
  }

  /**
   * Returns a cached 512x512 HD PBR MeshStandardMaterial (map + bumpMap + roughnessMap)
   * for any block material kind ('stone' | 'brick' | 'wood' | 'roof' | 'metal' | 'accent').
   */
  getBlockMaterial(themeId = 'egypt', kind = 'stone') {
    const key = `blk:${themeId}:${kind}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const pal = this.getPalette(themeId);
    const spec = pal[kind] || pal.stone;
    const triplet = buildBlockPBRTriplet({
      ...spec,
      seed: hashString(key),
    });

    this._trackTex(triplet.map);
    this._trackTex(triplet.bumpMap);
    this._trackTex(triplet.roughnessMap);

    const mat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: triplet.map,
        bumpMap: triplet.bumpMap,
        bumpScale: spec.pattern === 'metal' ? 0.025 : 0.055,
        roughnessMap: triplet.roughnessMap,
        roughness: 1.0,
        metalness: spec.metalness ?? 0.06,
      })
    );

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Returns a cached 1024x1024 HD geological cross-section strata material for the island plinth skirt.
   */
  getGeologicalPlinthMaterial(themeId = 'egypt') {
    const key = `plinth1024:${themeId}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const pal = this.getPalette(themeId);
    const triplet = buildGeologicalPlinth1024(pal.strataColors, hashString(key));
    this._trackTex(triplet.map);
    this._trackTex(triplet.bumpMap);
    this._trackTex(triplet.roughnessMap);

    const mat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: triplet.map,
        bumpMap: triplet.bumpMap,
        bumpScale: 0.06,
        roughnessMap: triplet.roughnessMap,
        roughness: 1.0,
        metalness: 0.03,
      })
    );

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Returns a cached 1024x1024 HD procedural terrain ground material for any biome theme.
   */
  getTerrainGroundMaterial(themeId = 'egypt') {
    const key = `terrain1024:${themeId}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const pal = this.getPalette(themeId);
    const triplet = buildTerrainGround1024(pal.groundBase, pal.groundDetail, hashString(key));
    this._trackTex(triplet.map);
    this._trackTex(triplet.bumpMap);
    this._trackTex(triplet.roughnessMap);

    const mat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: triplet.map,
        bumpMap: triplet.bumpMap,
        bumpScale: 0.045,
        roughnessMap: triplet.roughnessMap,
        roughness: 1.0,
        metalness: 0.02,
      })
    );

    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Returns a complete ready-to-use HD PBR material bundle for a level theme.
   */
  getThemeMaterials(themeId = 'egypt') {
    return {
      ground: this.getTerrainGroundMaterial(themeId),
      plinth: this.getGeologicalPlinthMaterial(themeId),
      stone: this.getBlockMaterial(themeId, 'stone'),
      brick: this.getBlockMaterial(themeId, 'brick'),
      wood: this.getBlockMaterial(themeId, 'wood'),
      roof: this.getBlockMaterial(themeId, 'roof'),
      metal: this.getBlockMaterial(themeId, 'metal'),
      accent: this.getBlockMaterial(themeId, 'accent'),
    };
  }

  /**
   * Standardized ultra-crisp translucent cyan/gold blueprint ghost placement materials with
   * polygonOffset anti-z-fighting and bright gold/green snap highlight for ALL levels & Roguelike runs.
   */
  createFrostedGhostMaterials() {
    if (!this._frostedGhostMap) {
      this._frostedGhostMap = this._trackTex(buildCrispFrostedGhostTexture());
    }

    const createGlassMat = (colorHex, emissiveHex, baseOpacity, emissiveIntensity) => {
      const mat = new THREE.MeshStandardMaterial({
        map: this._frostedGhostMap,
        color: new THREE.Color(colorHex),
        emissive: new THREE.Color(emissiveHex),
        emissiveIntensity,
        roughness: 0.22,
        metalness: 0.08,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      });
      mat.userData.baseOpacity = baseOpacity;
      mat.userData.baseEmissive = emissiveIntensity;
      return mat;
    };

    const ghostNormal = createGlassMat(0x28dcff, 0x00b4f0, 0.35, 0.6);
    const ghostHighlight = createGlassMat(0x7eff7a, 0xffd52e, 0.7, 0.95);

    const ghostLineNormal = new THREE.LineBasicMaterial({
      color: 0x3ce6ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const ghostLineHighlight = new THREE.LineBasicMaterial({
      color: 0xffe44d,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });

    return {
      ghostNormal,
      ghostHighlight,
      ghostLineNormal,
      ghostLineHighlight,
    };
  }

  /**
   * Smooth per-frame frosted-glass pulse animation shared across every level's ghost slots.
   */
  updateFrostedGhostPulse(mats, elapsed) {
    if (!mats || !mats.ghostNormal) return;
    const pulse = Math.sin(elapsed * 2.8);
    mats.ghostNormal.opacity = 0.35 + pulse * 0.04;
    mats.ghostNormal.emissiveIntensity = 0.6 + pulse * 0.12;
    if (mats.ghostLineNormal) {
      mats.ghostLineNormal.opacity = 0.86 + pulse * 0.12;
    }
    if (mats.ghostHighlight) {
      mats.ghostHighlight.emissiveIntensity = 0.92 + Math.sin(elapsed * 5.2) * 0.16;
    }
  }

  dispose() {
    this._ownedTextures.forEach((t) => t.dispose());
    this._ownedMaterials.forEach((m) => m.dispose());
    this._ownedTextures.length = 0;
    this._ownedMaterials.length = 0;
    this._cache.clear();
    this._frostedGhostMap = null;
  }
}
