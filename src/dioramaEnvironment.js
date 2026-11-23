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
  _softParticleTex = applyCrispTextureSettings(new THREE.CanvasTexture(c), { isColor: true });
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
 * Wraps the active scene with dynamic gradient sky, calibrated 3-point lighting,
 * distance fog, ambient floating biome particles, and a 1024x1024 HD geological plinth material.
 */
export function buildDioramaEnvironment(biomeConfig, { scene, lights, materialFactory } = {}) {
  const cfg = resolveBiomeConfig(biomeConfig);

  // 1. Calibrate background, distance fog & cinematic 3-point lights
  if (scene) {
    if (!scene.background) scene.background = new THREE.Color(cfg.fogColor);
    else scene.background.set(cfg.fogColor);

    if (!scene.fog) {
      scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);
    } else {
      scene.fog.color.set(cfg.fogColor);
      scene.fog.near = cfg.fogNear;
      scene.fog.far = cfg.fogFar;
    }
  }

  if (lights) {
    if (lights.sunLight) {
      lights.sunLight.color.set(cfg.sunColor);
      lights.sunLight.intensity = cfg.sunIntensity;
    }
    if (lights.hemiLight) {
      lights.hemiLight.color.set(cfg.hemiSky);
      lights.hemiLight.groundColor.set(cfg.hemiGround);
      lights.hemiLight.intensity = cfg.hemiIntensity;
    }
    if (lights.rimLight) {
      lights.rimLight.color.set(cfg.rimColor);
      lights.rimLight.intensity = cfg.rimIntensity;
    }
  }

  // 2. Dynamic atmospheric gradient sky dome
  const root = new THREE.Group();
  root.name = `DioramaAtmosphere_${cfg.id}`;
  const sky = createAtmosphericSkyDome(cfg);
  root.add(sky.mesh);

  // 3. Subtle ambient floating biome particles (1 draw call via THREE.Points)
  const count = cfg.particleCount || 40;
  const pPos = new Float32Array(count * 3);
  const pSeeds = new Float32Array(count * 4); // x0, y0, z0, phase
  const spread = cfg.id === 'worldmap' ? 18 : 15;

  for (let i = 0; i < count; i++) {
    const x0 = ((i * 73.13) % 100) / 100 * spread * 2 - spread;
    const y0 = 0.8 + (((i * 41.7) % 100) / 100) * 5.2;
    const z0 = ((i * 29.31) % 100) / 100 * spread * 2 - spread;
    pPos[i * 3] = x0;
    pPos[i * 3 + 1] = y0;
    pPos[i * 3 + 2] = z0;
    pSeeds[i * 4] = x0;
    pSeeds[i * 4 + 1] = y0;
    pSeeds[i * 4 + 2] = z0;
    pSeeds[i * 4 + 3] = i * 0.77;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: new THREE.Color(cfg.particleColor || '#ffe8b4'),
    map: getSoftParticleTexture(),
    size: cfg.particleStyle === 'petal' ? 0.34 : cfg.particleStyle === 'firefly' ? 0.28 : 0.22,
    transparent: true,
    opacity: cfg.particleStyle === 'firefly' ? 0.72 : 0.46,
    depthWrite: false,
    blending: cfg.particleStyle === 'firefly' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  root.add(particles);

  if (scene) {
    scene.add(root);
  }

  // 4. Fetch 1024x1024 HD geological cross-section plinth material from MaterialFactory
  const plinthMaterial =
    materialFactory && cfg.id !== 'worldmap' && cfg.id !== 'menu'
      ? materialFactory.getGeologicalPlinthMaterial(cfg.id)
      : null;

  return {
    config: cfg,
    root,
    skyMesh: sky.mesh,
    particles,
    plinthMaterial,
    update(dt, elapsed, centerX = 0, centerZ = 0) {
      // Keep sky dome & ambient particle field centered around active camera target
      sky.mesh.position.set(centerX, 0, centerZ);
      particles.position.set(centerX, 0, centerZ);

      const arr = pGeo.attributes.position.array;
      const isPetal = cfg.particleStyle === 'petal';
      const isFirefly = cfg.particleStyle === 'firefly';

      for (let i = 0; i < count; i++) {
        const sIdx = i * 4;
        const phase = pSeeds[sIdx + 3];
        const x0 = pSeeds[sIdx];
        const y0 = pSeeds[sIdx + 1];
        const z0 = pSeeds[sIdx + 2];

        if (isPetal) {
          // Gentle diagonal falling & fluttering sakura petals
          const fall = ((elapsed * 0.55 + phase) % 5.4);
          arr[i * 3] = x0 + Math.sin(elapsed * 1.1 + phase) * 0.9;
          arr[i * 3 + 1] = 6.0 - fall;
          arr[i * 3 + 2] = z0 + Math.cos(elapsed * 0.9 + phase) * 0.7;
        } else if (isFirefly) {
          // Soft bobbing luminous jungle fireflies
          arr[i * 3] = x0 + Math.sin(elapsed * 0.7 + phase) * 0.85;
          arr[i * 3 + 1] = y0 + Math.sin(elapsed * 1.5 + phase * 1.3) * 0.45;
          arr[i * 3 + 2] = z0 + Math.cos(elapsed * 0.65 + phase) * 0.85;
        } else {
          // Slow warm atmospheric frontier / desert dust drift
          arr[i * 3] = x0 + Math.sin(elapsed * 0.35 + phase) * 1.1;
          arr[i * 3 + 1] = y0 + Math.sin(elapsed * 0.5 + phase * 1.1) * 0.25;
          arr[i * 3 + 2] = z0 + Math.cos(elapsed * 0.3 + phase) * 0.9;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
    },
    dispose() {
      if (scene) scene.remove(root);
      sky.geo.dispose();
      sky.mat.dispose();
      pGeo.dispose();
      pMat.dispose();
    },
  };
}
