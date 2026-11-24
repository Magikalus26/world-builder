/**
 * Workd Builder — Unified Biome Diorama & Atmosphere System (`buildDioramaEnvironment`)
 * Automatically wraps every current level (Levels 1–5), Roguelike run, World Map,
 * and all future levels (Levels 6–100) with:
 *  - Dynamic atmospheric gradient sky dome matched to the biome
 *  - Cinematic 3-point lighting calibration (Warm Sun + HemisphereLight + Rim Light) & fog
 *  - 1024x1024 HD geological cross-section plinth strata via MaterialFactory
 *  - Subtle ambient floating biome particles (desert dust, sakura petals, fireflies, frontier motes)
 *  - Generic plateau & peripheral diorama scaffolder for future levels
 */

import * as THREE from 'three';
import { applyCrispTextureSettings } from './graphicsCore.js';
import { applyLevelSolarLighting, resolveSolarPresetId } from './solarLighting.js';

export const BIOME_ATMOSPHERES = {
  egypt: {
    id: 'egypt',
    skyTop: '#6eaad4',
    skyHorizon: '#f2d9a8',
    skyBottom: '#d8b47b',
    fogColor: '#edd2a1',
    fogNear: 44,
    fogFar: 94,
    sunColor: '#fff1ce',
    sunIntensity: 2.15,
    hemiSky: '#fff8ea',
    hemiGround: '#c48646',
    hemiIntensity: 0.88,
    rimColor: '#8cd5ea',
    rimIntensity: 0.46,
    particleColor: '#ffe4a8',
    particleStyle: 'dust',
    particleCount: 44,
  },
  rome: {
    id: 'rome',
    skyTop: '#6aa5d9',
    skyHorizon: '#dfeaf2',
    skyBottom: '#c9d7c2',
    fogColor: '#d9e7ee',
    fogNear: 46,
    fogFar: 98,
    sunColor: '#fff4da',
    sunIntensity: 2.12,
    hemiSky: '#f7fbff',
    hemiGround: '#8fa064',
    hemiIntensity: 0.9,
    rimColor: '#9cd8f5',
    rimIntensity: 0.5,
    particleColor: '#fff4cc',
    particleStyle: 'dust',
    particleCount: 40,
  },
  japan: {
    id: 'japan',
    skyTop: '#7eaed4',
    skyHorizon: '#e5edf2',
    skyBottom: '#c9d9cc',
    fogColor: '#dce8ea',
    fogNear: 44,
    fogFar: 94,
    sunColor: '#fff5e4',
    sunIntensity: 2.02,
    hemiSky: '#f4f9ff',
    hemiGround: '#6c8d64',
    hemiIntensity: 0.92,
    rimColor: '#ffd4e3',
    rimIntensity: 0.48,
    particleColor: '#ffc2d6',
    particleStyle: 'petal',
    particleCount: 48,
  },
  maya: {
    id: 'maya',
    skyTop: '#5ca9b8',
    skyHorizon: '#cde8dc',
    skyBottom: '#8eb89b',
    fogColor: '#cde6da',
    fogNear: 44,
    fogFar: 94,
    sunColor: '#fff4d2',
    sunIntensity: 2.1,
    hemiSky: '#ebfff6',
    hemiGround: '#4a7f4e',
    hemiIntensity: 0.92,
    rimColor: '#7ae8c8',
    rimIntensity: 0.52,
    particleColor: '#98ffd4',
    particleStyle: 'firefly',
    particleCount: 46,
  },
  penitentiary: {
    id: 'penitentiary',
    skyTop: '#8aa3b8',
    skyHorizon: '#e2d2b9',
    skyBottom: '#c39c72',
    fogColor: '#dfd0b8',
    fogNear: 40,
    fogFar: 88,
    sunColor: '#ffe7be',
    sunIntensity: 2.08,
    hemiSky: '#f8efe0',
    hemiGround: '#9b744d',
    hemiIntensity: 0.86,
    rimColor: '#a2c6dc',
    rimIntensity: 0.52,
    particleColor: '#f5d9ad',
    particleStyle: 'dust',
    particleCount: 42,
  },
  coalmine: {
    id: 'coalmine',
    skyTop: '#6e8da8',
    skyHorizon: '#cbd8e0',
    skyBottom: '#8f9aa3',
    fogColor: '#c9d6de',
    fogNear: 42,
    fogFar: 92,
    sunColor: '#fff1d4',
    sunIntensity: 2.08,
    hemiSky: '#eef5fa',
    hemiGround: '#596356',
    hemiIntensity: 0.88,
    rimColor: '#98c4dc',
    rimIntensity: 0.54,
    particleColor: '#ffe0a8',
    particleStyle: 'dust',
    particleCount: 40,
  },
  modern: {
    id: 'modern',
    skyTop: '#56a2de',
    skyHorizon: '#e4f2fb',
    skyBottom: '#c5dfc4',
    fogColor: '#dfeef7',
    fogNear: 48,
    fogFar: 102,
    sunColor: '#fff6e0',
    sunIntensity: 2.18,
    hemiSky: '#f7fcff',
    hemiGround: '#7ca362',
    hemiIntensity: 0.94,
    rimColor: '#98e2f8',
    rimIntensity: 0.52,
    particleColor: '#fff7d4',
    particleStyle: 'dust',
    particleCount: 36,
  },
  medieval: {
    id: 'medieval',
    skyTop: '#5692cf',
    skyHorizon: '#dfe9f3',
    skyBottom: '#b7cea4',
    fogColor: '#d7e5ec',
    fogNear: 46,
    fogFar: 98,
    sunColor: '#fff3d4',
    sunIntensity: 2.16,
    hemiSky: '#f4faff',
    hemiGround: '#5f7b48',
    hemiIntensity: 0.92,
    rimColor: '#9ed2ec',
    rimIntensity: 0.52,
    particleColor: '#ffe7a6',
    particleStyle: 'dust',
    particleCount: 38,
  },
  museum: {
    id: 'museum',
    skyTop: '#5496d9',
    skyHorizon: '#e5eff9',
    skyBottom: '#c7dcc1',
    fogColor: '#deeaf4',
    fogNear: 48,
    fogFar: 102,
    sunColor: '#fff6e0',
    sunIntensity: 2.18,
    hemiSky: '#f8fcff',
    hemiGround: '#759462',
    hemiIntensity: 0.94,
    rimColor: '#a2dcf4',
    rimIntensity: 0.54,
    particleColor: '#fff0b8',
    particleStyle: 'dust',
    particleCount: 34,
  },
  viking: {
    id: 'viking',
    skyTop: '#3e78a8',
    skyHorizon: '#cfe2ed',
    skyBottom: '#8ea8a6',
    fogColor: '#c9dde8',
    fogNear: 52,
    fogFar: 118,
    sunColor: '#fff1d0',
    sunIntensity: 2.14,
    hemiSky: '#e8f5ff',
    hemiGround: '#4a5c4e',
    hemiIntensity: 0.92,
    rimColor: '#7ce0d6',
    rimIntensity: 0.58,
    particleColor: '#d9f8ff',
    particleStyle: 'dust',
    particleCount: 40,
  },
  english: {
    id: 'english',
    skyTop: '#5b9cd4',
    skyHorizon: '#e4eff6',
    skyBottom: '#bdd4b2',
    fogColor: '#dceaf2',
    fogNear: 54,
    fogFar: 120,
    sunColor: '#fff5d8',
    sunIntensity: 2.16,
    hemiSky: '#f6fbff',
    hemiGround: '#5d7c46',
    hemiIntensity: 0.94,
    rimColor: '#b0dcf4',
    rimIntensity: 0.52,
    particleColor: '#fff7d2',
    particleStyle: 'dust',
    particleCount: 38,
  },
  lagoon: {
    id: 'lagoon',
    skyTop: '#36a4d6',
    skyHorizon: '#d6f2f6',
    skyBottom: '#8cd6dc',
    fogColor: '#c4eaf2',
    fogNear: 88,
    fogFar: 195,
    sunColor: '#fff5d2',
    sunIntensity: 2.18,
    hemiSky: '#efffff',
    hemiGround: '#4a988e',
    hemiIntensity: 0.96,
    rimColor: '#76f0e4',
    rimIntensity: 0.56,
    particleColor: '#e8fffb',
    particleStyle: 'spray',
    particleCount: 40,
  },
  worldmap: {
    id: 'worldmap',
    skyTop: '#67add6',
    skyHorizon: '#d6eaec',
    skyBottom: '#a6d2d8',
    fogColor: '#d5e8ea',
    fogNear: 62,
    fogFar: 156,
    sunColor: '#fff3d6',
    sunIntensity: 2.12,
    hemiSky: '#f5fcff',
    hemiGround: '#7eb2ba',
    hemiIntensity: 0.92,
    rimColor: '#94def2',
    rimIntensity: 0.48,
    particleColor: '#e8fbff',
    particleStyle: 'spray',
    particleCount: 36,
  },
  menu: {
    id: 'menu',
    skyTop: '#7eb4d6',
    skyHorizon: '#ebd09c',
    skyBottom: '#d4ab6c',
    fogColor: '#e5c78f',
    fogNear: 50,
    fogFar: 124,
    sunColor: '#ffefc8',
    sunIntensity: 2.14,
    hemiSky: '#fff8e8',
    hemiGround: '#bd8a4c',
    hemiIntensity: 0.88,
    rimColor: '#94d8ec',
    rimIntensity: 0.46,
    particleColor: '#ffe9b8',
    particleStyle: 'dust',
    particleCount: 32,
  },
};

export function resolveBiomeConfig(levelIdOrTheme = 'egypt', overrides = null) {
  let key = 'egypt';
  if (typeof levelIdOrTheme === 'string') {
    const s = levelIdOrTheme.toLowerCase();
    if (s.includes('rome') || s.includes('domus')) key = 'rome';
    else if (s.includes('japan') || s.includes('japon') || s.includes('minka')) key = 'japan';
    else if (s.includes('maya') || s.includes('kukul')) key = 'maya';
    else if (s.includes('penitentiary') || s.includes('prison') || s.includes('1800')) key = 'penitentiary';
    else if (s.includes('coal') || s.includes('mine') || s.includes('charbon')) key = 'coalmine';
    else if (s.includes('modern') || s.includes('villa') || s.includes('contemp')) key = 'modern';
    else if (s.includes('stilt') || s.includes('lagoon') || s.includes('pilotis') || s.includes('lagon')) key = 'lagoon';
    else if (s.includes('english') || s.includes('edwardian') || s.includes('anglais') || s.includes('cotswold')) key = 'english';
    else if (s.includes('viking') || s.includes('fjord') || s.includes('nordic') || s.includes('drakkar')) key = 'viking';
    else if (s.includes('castle') || s.includes('chateau') || s.includes('medieval') || s.includes('village')) key = 'medieval';
    else if (s.includes('museum') || s.includes('musee') || s.includes('beaux')) key = 'museum';
    else if (s.includes('worldmap')) key = 'worldmap';
    else if (s.includes('menu')) key = 'menu';
    else if (BIOME_ATMOSPHERES[s]) key = s;
  } else if (levelIdOrTheme && typeof levelIdOrTheme === 'object') {
    const base = BIOME_ATMOSPHERES[levelIdOrTheme.id] || BIOME_ATMOSPHERES.egypt;
    return { ...base, ...levelIdOrTheme, ...(overrides || {}) };
  }
  const base = BIOME_ATMOSPHERES[key] || BIOME_ATMOSPHERES.egypt;
  return overrides ? { ...base, ...overrides } : { ...base };
}

let _softParticleTex = null;
function getSoftParticleTexture() {
  if (_softParticleTex) return _softParticleTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.72)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _softParticleTex = applyCrispTextureSettings(new THREE.CanvasTexture(c), { isColor: true, wrap: false });
  return _softParticleTex;
}

/**
 * Builds an atmospheric vertex-colored gradient Sky Dome Sphere (BackSide, 1 draw call).
 */
function createAtmosphericSkyDome(cfg) {
  const geo = new THREE.SphereGeometry(156, 20, 14);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cTop = new THREE.Color(cfg.skyTop || '#6eaad4');
  const cHorizon = new THREE.Color(cfg.skyHorizon || '#f0d7a6');
  const cBottom = new THREE.Color(cfg.skyBottom || '#c9a46c');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / 156; // -1..+1
    if (ny >= 0) {
      const t = Math.pow(Math.min(1, ny * 1.45), 0.72);
      tmp.copy(cHorizon).lerp(cTop, t);
    } else {
      const t = Math.min(1, -ny * 2.2);
      tmp.copy(cHorizon).lerp(cBottom, t);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'DioramaSkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, geo, mat };
}

/**
 * Generic Diorama & Atmosphere Envelope (`buildDioramaEnvironment(biomeConfig)`).
 * Delegates soft solar lighting, custom GLSL Mie sky dome, FogExp2 atmospheric haze,
 * and <= 40 instanced sun-beam dust motes to `applyLevelSolarLighting` (`src/solarLighting.js`),
 * while preserving the 1024x1024 HD geological cross-section plinth material from MaterialFactory.
 */
export function buildDioramaEnvironment(
  biomeConfig,
  { scene, renderer = null, lights, materialFactory, solarPresetId = null, levelNum = null } = {}
) {
  const cfg = resolveBiomeConfig(biomeConfig);
  const resolvedPresetId = resolveSolarPresetId(solarPresetId || biomeConfig || cfg.id, levelNum);

  const solar = applyLevelSolarLighting(scene, renderer, resolvedPresetId, {
    lights,
    levelNum,
  });

  // Fetch 1024x1024 HD geological cross-section plinth material from MaterialFactory
  const plinthMaterial =
    materialFactory && cfg.id !== 'worldmap' && cfg.id !== 'menu'
      ? materialFactory.getGeologicalPlinthMaterial(cfg.id)
      : null;

  return {
    config: cfg,
    solarPresetId: solar.presetId,
    solarPreset: solar.preset,
    solar,
    root: solar.root,
    skyMesh: solar.skyMesh,
    particles: solar.motesMesh,
    plinthMaterial,
    update(dt, elapsed, centerX = 0, centerZ = 0, camera = null) {
      solar.update(dt, elapsed, centerX, centerZ, camera);
    },
    dispose() {
      solar.dispose();
    },
  };
}
