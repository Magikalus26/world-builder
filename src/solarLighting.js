/**
 * Workd Builder — Dedicated Soft Solar, Cast Shadows & Volumetric Sunbeams System (`src/solarLighting.js`)
 *
 * Centralized, zero-bloat lighting, real-time soft shadow, volumetric god-ray sunbeam, and custom
 * GLSL sky/sun-halo module applied across ALL levels (Levels 1–13, Roguelike runs, 3D World Map,
 * Main Menu, and future Levels 14–100), engineered for locked 60 FPS and low GPU heat on
 * iPhone 16e Safari (390x844, devicePixelRatio capped at 2).
 *
 * Features:
 *  - Soft Hemisphere + Directional Sunlight + Rim Fill rig with 1024x1024 PCFSoftShadowMap
 *    (bias = -0.0005, normalBias = 0.02) and tightly fitted per-board orthographic shadow frustum
 *  - Automatic solid-mesh shadow traversal (`applyShadowFlagsToObject`) enabling cast/receive on
 *    solid geometry while keeping castShadow = false on ghosts, water planes, sunbeams & particles
 *  - Lightweight volumetric sunbeams / god rays (`createSunBeams`) via 1 single-draw-call
 *    InstancedMesh of 6 tapered shafts with smooth Fresnel edge/vertical falloff & dust shimmer
 *  - Custom GLSL Sky Dome & Mie-style Horizon Sun-Glow ShaderMaterial (BackSide, depthWrite: false)
 *  - Biome-tinted exponential distance fog (THREE.FogExp2) calibrated to diorama scale
 *  - Lightweight InstancedMesh floating sunbeam dust motes (<= 35 particles, 1 draw call)
 *  - Extensible preset registry (`SOLAR_LIGHTING_PRESETS` + `registerSolarPreset`) for Levels 14–100
 */

import * as THREE from 'three';

const MAX_MOTE_COUNT = 35;
const SUNBEAM_SHAFT_COUNT = 6;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/** Active solar handle updated by `updateSolarLighting(deltaTime, ...)` */
let _activeSolarHandle = null;
let _internalElapsed = 0;

/**
 * Distinct per-level solar angles, atmospheric sky gradients, hemisphere ground bounce,
 * soft shadow calibration, volumetric sunbeam tint/opacity, FogExp2 haze, and <= 35 motes.
 */
export const SOLAR_LIGHTING_PRESETS = {
  // Niveau 1 — Égypte (Pyramide)
  egypt_golden_noon: {
    id: 'egypt_golden_noon',
    label: 'Égypte — Soleil Doré du Sahara',
    sunDirection: [-0.52, 0.72, 0.46],
    sunColor: '#ffe4a3',
    sunIntensity: 2.08,
    hemiSky: '#fff7e6',
    hemiGround: '#d9a05b',
    hemiIntensity: 0.9,
    rimColor: '#98d6e8',
    rimIntensity: 0.42,
    zenithColor: '#5c9ed0',
    horizonColor: '#f5dcab',
    nadirColor: '#d9a86c',
    hazeIntensity: 0.62,
    sunHaloPower: 9.0,
    beamColor: '#ffe296',
    beamOpacity: 0.13,
    beamCount: 6,
    fogColor: '#eed5a4',
    fogDensity: 0.0068,
    exposure: 1.07,
    envIntensity: 0.56,
    moteColor: '#ffe5a8',
    moteStyle: 'dust',
    moteCount: 34,
    moteSize: 0.2,
    moteOpacity: 0.44,
    shadowBounds: 20.0,
  },

  // Niveau 2 — Rome (Domus)
  rome_mediterranean_morning: {
    id: 'rome_mediterranean_morning',
    label: 'Rome — Matinée Méditerranéenne',
    sunDirection: [-0.62, 0.66, 0.42],
    sunColor: '#fff3d6',
    sunIntensity: 2.04,
    hemiSky: '#9ecfff',
    hemiGround: '#c9855e',
    hemiIntensity: 0.92,
    rimColor: '#a6dcfa',
    rimIntensity: 0.46,
    zenithColor: '#539ae0',
    horizonColor: '#e2eef7',
    nadirColor: '#c9b89e',
    hazeIntensity: 0.48,
    sunHaloPower: 11.5,
    beamColor: '#fff0c4',
    beamOpacity: 0.11,
    beamCount: 6,
    fogColor: '#dceaf2',
    fogDensity: 0.0062,
    exposure: 1.08,
    envIntensity: 0.6,
    moteColor: '#fff2cc',
    moteStyle: 'dust',
    moteCount: 32,
    moteSize: 0.19,
    moteOpacity: 0.4,
    shadowBounds: 20.0,
  },

  // Niveau 3 — Japon (Minka)
  japan_sakura_dawn: {
    id: 'japan_sakura_dawn',
    label: 'Japon — Aube Sakura Pastel',
    sunDirection: [-0.68, 0.54, 0.49],
    sunColor: '#ffe8ec',
    sunIntensity: 1.96,
    hemiSky: '#f7eef5',
    hemiGround: '#8fb89f',
    hemiIntensity: 0.96,
    rimColor: '#ffd1de',
    rimIntensity: 0.5,
    zenithColor: '#7aa7d4',
    horizonColor: '#f6dde4',
    nadirColor: '#b5ccb8',
    hazeIntensity: 0.58,
    sunHaloPower: 8.5,
    beamColor: '#ffd6e2',
    beamOpacity: 0.125,
    beamCount: 6,
    fogColor: '#eadce2',
    fogDensity: 0.0066,
    exposure: 1.07,
    envIntensity: 0.58,
    moteColor: '#ffc6d8',
    moteStyle: 'petal',
    moteCount: 35,
    moteSize: 0.25,
    moteOpacity: 0.56,
    shadowBounds: 20.0,
  },

  // Niveau 4 — Maya (Kukulcán)
  maya_jungle_zenith: {
    id: 'maya_jungle_zenith',
    label: 'Maya — Zénith de la Jungle',
    sunDirection: [-0.36, 0.84, 0.41],
    sunColor: '#fff5cc',
    sunIntensity: 2.06,
    hemiSky: '#e8fff5',
    hemiGround: '#6bbd99',
    hemiIntensity: 0.94,
    rimColor: '#7ce8c8',
    rimIntensity: 0.5,
    zenithColor: '#489fb2',
    horizonColor: '#cdeae0',
    nadirColor: '#7eb294',
    hazeIntensity: 0.56,
    sunHaloPower: 10.0,
    beamColor: '#ccffda',
    beamOpacity: 0.13,
    beamCount: 6,
    fogColor: '#cce6db',
    fogDensity: 0.0068,
    exposure: 1.08,
    envIntensity: 0.58,
    moteColor: '#a6ffda',
    moteStyle: 'firefly',
    moteCount: 34,
    moteSize: 0.23,
    moteOpacity: 0.62,
    shadowBounds: 20.0,
  },

  // Niveau 5 — Pénitencier 1800
  frontier_1800_dusty_afternoon: {
    id: 'frontier_1800_dusty_afternoon',
    label: 'Pénitencier 1800 — Après-midi Sépia',
    sunDirection: [-0.72, 0.5, 0.48],
    sunColor: '#ffd9a8',
    sunIntensity: 2.02,
    hemiSky: '#f8eedc',
    hemiGround: '#c29b70',
    hemiIntensity: 0.88,
    rimColor: '#a8c6dc',
    rimIntensity: 0.46,
    zenithColor: '#7f9cb6',
    horizonColor: '#e6d3b6',
    nadirColor: '#bd966a',
    hazeIntensity: 0.66,
    sunHaloPower: 7.5,
    beamColor: '#ffd294',
    beamOpacity: 0.13,
    beamCount: 6,
    fogColor: '#e2d1b7',
    fogDensity: 0.0074,
    exposure: 1.06,
    envIntensity: 0.54,
    moteColor: '#f5d6a6',
    moteStyle: 'dust',
    moteCount: 34,
    moteSize: 0.21,
    moteOpacity: 0.46,
    shadowBounds: 20.5,
  },

  // Niveau 6 — Mine de Charbon
  coalmine_overcast_amber: {
    id: 'coalmine_overcast_amber',
    label: 'Mine de Charbon — Brume Nordique & Rayons Ambrés',
    sunDirection: [-0.75, 0.44, 0.49],
    sunColor: '#ffcf87',
    sunIntensity: 1.98,
    hemiSky: '#9fb4c7',
    hemiGround: '#6a7268',
    hemiIntensity: 0.92,
    rimColor: '#98bdd6',
    rimIntensity: 0.52,
    zenithColor: '#67849e',
    horizonColor: '#cdd9e0',
    nadirColor: '#8d98a1',
    hazeIntensity: 0.72,
    sunHaloPower: 6.8,
    beamColor: '#ffc978',
    beamOpacity: 0.145,
    beamCount: 6,
    fogColor: '#c9d5dd',
    fogDensity: 0.0076,
    exposure: 1.07,
    envIntensity: 0.58,
    moteColor: '#ffda9e',
    moteStyle: 'steam',
    moteCount: 34,
    moteSize: 0.24,
    moteOpacity: 0.42,
    shadowBounds: 21.0,
  },

  // Niveau 7 — Villa Moderne
  modern_coastal_daylight: {
    id: 'modern_coastal_daylight',
    label: 'Villa Moderne — Lumière Côtière Architecturale',
    sunDirection: [-0.46, 0.78, 0.42],
    sunColor: '#f5faff',
    sunIntensity: 2.12,
    hemiSky: '#a8d8ff',
    hemiGround: '#98ba8a',
    hemiIntensity: 0.96,
    rimColor: '#a6e4ff',
    rimIntensity: 0.52,
    zenithColor: '#4898dc',
    horizonColor: '#e8f5ff',
    nadirColor: '#c2dfcc',
    hazeIntensity: 0.36,
    sunHaloPower: 14.0,
    beamColor: '#eef8ff',
    beamOpacity: 0.09,
    beamCount: 5,
    fogColor: '#e3f1fa',
    fogDensity: 0.0052,
    exposure: 1.1,
    envIntensity: 0.76,
    moteColor: '#ffffff',
    moteStyle: 'glint',
    moteCount: 26,
    moteSize: 0.18,
    moteOpacity: 0.36,
    shadowBounds: 21.0,
  },

  // Niveau 8 — Château Fort
  medieval_crisp_morning: {
    id: 'medieval_crisp_morning',
    label: 'Château Fort — Matinée Royale Claire',
    sunDirection: [-0.6, 0.65, 0.46],
    sunColor: '#fff0cc',
    sunIntensity: 2.08,
    hemiSky: '#e8f3ff',
    hemiGround: '#729058',
    hemiIntensity: 0.92,
    rimColor: '#8fa8c8',
    rimIntensity: 0.5,
    zenithColor: '#4f8bc8',
    horizonColor: '#dde8f2',
    nadirColor: '#a8be9a',
    hazeIntensity: 0.52,
    sunHaloPower: 10.5,
    beamColor: '#ffefc0',
    beamOpacity: 0.115,
    beamCount: 6,
    fogColor: '#d7e3ee',
    fogDensity: 0.0062,
    exposure: 1.08,
    envIntensity: 0.6,
    moteColor: '#ffebb3',
    moteStyle: 'dust',
    moteCount: 32,
    moteSize: 0.2,
    moteOpacity: 0.4,
    shadowBounds: 22.0,
  },

  // Niveau 9 — Grand Musée
  museum_neoclassical_afternoon: {
    id: 'museum_neoclassical_afternoon',
    label: 'Grand Musée — Après-midi Doré de Galerie',
    sunDirection: [-0.56, 0.62, 0.55],
    sunColor: '#fff4dc',
    sunIntensity: 2.1,
    hemiSky: '#f7fbff',
    hemiGround: '#98ad82',
    hemiIntensity: 0.95,
    rimColor: '#b0dff5',
    rimIntensity: 0.52,
    zenithColor: '#5293d4',
    horizonColor: '#eef3fa',
    nadirColor: '#c9dac4',
    hazeIntensity: 0.44,
    sunHaloPower: 12.0,
    beamColor: '#fff3ce',
    beamOpacity: 0.125,
    beamCount: 6,
    fogColor: '#e4edf5',
    fogDensity: 0.0056,
    exposure: 1.09,
    envIntensity: 0.72,
    moteColor: '#fff2c2',
    moteStyle: 'prism',
    moteCount: 32,
    moteSize: 0.21,
    moteOpacity: 0.46,
    shadowBounds: 22.0,
  },

  // Niveau 10 — Village Médiéval
  village_warm_harvest: {
    id: 'village_warm_harvest',
    label: 'Village Médiéval — Heure Dorée des Moissons',
    sunDirection: [-0.7, 0.48, 0.52],
    sunColor: '#ffdfa0',
    sunIntensity: 2.06,
    hemiSky: '#fff1d4',
    hemiGround: '#b58c4e',
    hemiIntensity: 0.92,
    rimColor: '#f5c78a',
    rimIntensity: 0.46,
    zenithColor: '#5c8ec2',
    horizonColor: '#f2dab0',
    nadirColor: '#bfa476',
    hazeIntensity: 0.62,
    sunHaloPower: 7.8,
    beamColor: '#ffd98c',
    beamOpacity: 0.135,
    beamCount: 7,
    fogColor: '#ead5ae',
    fogDensity: 0.005,
    exposure: 1.07,
    envIntensity: 0.58,
    moteColor: '#ffe29c',
    moteStyle: 'pollen',
    moteCount: 35,
    moteSize: 0.22,
    moteOpacity: 0.48,
    shadowBounds: 25.0,
  },

  // Niveau 11 — Village Viking
  viking_nordic_fjord: {
    id: 'viking_nordic_fjord',
    label: 'Village Viking — Soleil Nordique sur le Fjord',
    sunDirection: [-0.76, 0.42, 0.49],
    sunColor: '#ffe9c4',
    sunIntensity: 2.06,
    hemiSky: '#8ab4d8',
    hemiGround: '#566c62',
    hemiIntensity: 0.94,
    rimColor: '#82dce2',
    rimIntensity: 0.56,
    zenithColor: '#3a72a4',
    horizonColor: '#cde1ed',
    nadirColor: '#88a4a6',
    hazeIntensity: 0.58,
    sunHaloPower: 8.2,
    beamColor: '#dceeff',
    beamOpacity: 0.115,
    beamCount: 6,
    fogColor: '#c9dde8',
    fogDensity: 0.0052,
    exposure: 1.08,
    envIntensity: 0.62,
    moteColor: '#dcf8ff',
    moteStyle: 'mist',
    moteCount: 34,
    moteSize: 0.23,
    moteOpacity: 0.42,
    shadowBounds: 26.0,
  },

  // Niveau 12 — Village Anglais 1900
  england_1900_soft_meadow: {
    id: 'england_1900_soft_meadow',
    label: 'Angleterre 1900 — Douce Lumière des Cotswolds',
    sunDirection: [-0.58, 0.64, 0.5],
    sunColor: '#fff4d6',
    sunIntensity: 2.08,
    hemiSky: '#9cc8e8',
    hemiGround: '#6b9250',
    hemiIntensity: 0.95,
    rimColor: '#b8e0f6',
    rimIntensity: 0.5,
    zenithColor: '#5697d0',
    horizonColor: '#e5f0f7',
    nadirColor: '#bad3b0',
    hazeIntensity: 0.5,
    sunHaloPower: 10.5,
    beamColor: '#fff2c4',
    beamOpacity: 0.115,
    beamCount: 6,
    fogColor: '#dceaf2',
    fogDensity: 0.005,
    exposure: 1.08,
    envIntensity: 0.62,
    moteColor: '#fff6c8',
    moteStyle: 'pollen',
    moteCount: 34,
    moteSize: 0.21,
    moteOpacity: 0.44,
    shadowBounds: 26.0,
  },

  // Niveau 13 — Village sur Pilotis (Lagon & Rivière)
  lagoon_tropical_sunlight: {
    id: 'lagoon_tropical_sunlight',
    label: 'Village sur Pilotis — Soleil Tropical du Lagon',
    sunDirection: [-0.44, 0.78, 0.44],
    sunColor: '#fff6d4',
    sunIntensity: 2.12,
    hemiSky: '#8ee4f4',
    hemiGround: '#52b8b4',
    hemiIntensity: 0.96,
    rimColor: '#7af0e6',
    rimIntensity: 0.54,
    zenithColor: '#309cd2',
    horizonColor: '#d8f4f8',
    nadirColor: '#86d4dc',
    hazeIntensity: 0.44,
    sunHaloPower: 12.5,
    beamColor: '#d4fff8',
    beamOpacity: 0.105,
    beamCount: 7,
    fogColor: '#c8ecf4',
    fogDensity: 0.0038,
    exposure: 1.09,
    envIntensity: 0.66,
    moteColor: '#eafffc',
    moteStyle: 'spray',
    moteCount: 34,
    moteSize: 0.22,
    moteOpacity: 0.42,
    shadowBounds: 30.5,
  },

  // 3D World Map Archipelago (Levels 1–100)
  worldmap_golden_archipelago: {
    id: 'worldmap_golden_archipelago',
    label: 'Carte du Monde — Archipel Ensoleillé',
    sunDirection: [-0.54, 0.7, 0.47],
    sunColor: '#fff2d4',
    sunIntensity: 2.08,
    hemiSky: '#e8f8ff',
    hemiGround: '#6eb4c0',
    hemiIntensity: 0.94,
    rimColor: '#92ddf2',
    rimIntensity: 0.48,
    zenithColor: '#5ba4d2',
    horizonColor: '#d9edf0',
    nadirColor: '#9ecdd6',
    hazeIntensity: 0.46,
    sunHaloPower: 11.0,
    beamColor: '#fff2cc',
    beamOpacity: 0.075,
    beamCount: 5,
    fogColor: '#d5e9ec',
    fogDensity: 0.0044,
    exposure: 1.09,
    envIntensity: 0.64,
    moteColor: '#ecfbff',
    moteStyle: 'spray',
    moteCount: 30,
    moteSize: 0.22,
    moteOpacity: 0.38,
    shadowBounds: 20.0,
  },

  // Main Menu Live Diorama Preview
  menu_golden_diorama: {
    id: 'menu_golden_diorama',
    label: 'Menu Principal — Lumière Dorée',
    sunDirection: [-0.58, 0.64, 0.5],
    sunColor: '#ffefc8',
    sunIntensity: 2.08,
    hemiSky: '#fff7e8',
    hemiGround: '#bd8a4c',
    hemiIntensity: 0.9,
    rimColor: '#96d8ec',
    rimIntensity: 0.46,
    zenithColor: '#6da8d4',
    horizonColor: '#edd3a2',
    nadirColor: '#cfa86e',
    hazeIntensity: 0.54,
    sunHaloPower: 9.5,
    beamColor: '#ffe7ad',
    beamOpacity: 0.095,
    beamCount: 5,
    fogColor: '#e6ca96',
    fogDensity: 0.0052,
    exposure: 1.08,
    envIntensity: 0.6,
    moteColor: '#ffebb8',
    moteStyle: 'dust',
    moteCount: 28,
    moteSize: 0.2,
    moteOpacity: 0.4,
    shadowBounds: 20.0,
  },
};

/** Chapter-indexed fallback presets for future Levels 14–100 */
const FUTURE_CHAPTER_PRESETS = [
  'egypt_golden_noon',             // Ch 1 (1–10)
  'rome_mediterranean_morning',    // Ch 2 (11–20)
  'japan_sakura_dawn',             // Ch 3 (21–30)
  'maya_jungle_zenith',            // Ch 4 (31–40)
  'viking_nordic_fjord',           // Ch 5 (41–50)
  'medieval_crisp_morning',        // Ch 6 (51–60)
  'egypt_golden_noon',             // Ch 7 (61–70, Arabia)
  'modern_coastal_daylight',       // Ch 8 (71–80, Aegean Greece)
  'village_warm_harvest',          // Ch 9 (81–90, Indus)
  'museum_neoclassical_afternoon', // Ch 10 (91–100, Imperial Capital)
];

/**
 * Registers a custom solar & atmospheric lighting preset for future levels (Levels 14–100).
 */
export function registerSolarPreset(presetId, config) {
  if (!presetId || typeof presetId !== 'string' || !config) return null;
  const merged = {
    ...SOLAR_LIGHTING_PRESETS.egypt_golden_noon,
    ...config,
    id: presetId,
  };
  SOLAR_LIGHTING_PRESETS[presetId] = merged;
  return merged;
}

/**
 * Resolves any level ID, preset ID, Roguelike theme ID, or level number (1–100)
 * to a canonical preset key in `SOLAR_LIGHTING_PRESETS`.
 */
export function resolveSolarPresetId(levelIdOrPreset = 'egypt_golden_noon', levelNum = null) {
  if (typeof levelIdOrPreset === 'string' && SOLAR_LIGHTING_PRESETS[levelIdOrPreset]) {
    return levelIdOrPreset;
  }

  if (levelIdOrPreset && typeof levelIdOrPreset === 'object') {
    if (levelIdOrPreset.solarPreset && SOLAR_LIGHTING_PRESETS[levelIdOrPreset.solarPreset]) {
      return levelIdOrPreset.solarPreset;
    }
    if (levelIdOrPreset.id) {
      return resolveSolarPresetId(levelIdOrPreset.id, levelIdOrPreset.levelNum || levelNum);
    }
  }

  if (typeof levelIdOrPreset === 'string') {
    const s = levelIdOrPreset.toLowerCase();
    if (s.includes('worldmap')) return 'worldmap_golden_archipelago';
    if (s.includes('menu')) return 'menu_golden_diorama';
    if (s.includes('stilt') || s.includes('lagoon') || s.includes('pilotis') || s.includes('lagon')) {
      return 'lagoon_tropical_sunlight';
    }
    if (s.includes('english') || s.includes('england') || s.includes('edwardian') || s.includes('anglais')) {
      return 'england_1900_soft_meadow';
    }
    if (s.includes('viking') || s.includes('fjord') || s.includes('nordic') || s.includes('drakkar')) {
      return 'viking_nordic_fjord';
    }
    if (/\blevel10(?:\b|_)/.test(s) || s.includes('harvest') || s === 'village') {
      return 'village_warm_harvest';
    }
    if (s.includes('museum') || s.includes('musee') || s.includes('beaux')) {
      return 'museum_neoclassical_afternoon';
    }
    if (s.includes('castle') || s.includes('chateau') || s.includes('medieval')) {
      return 'medieval_crisp_morning';
    }
    if (s.includes('modern') || s.includes('villa') || s.includes('contemp')) {
      return 'modern_coastal_daylight';
    }
    if (s.includes('coal') || s.includes('mine') || s.includes('charbon')) {
      return 'coalmine_overcast_amber';
    }
    if (s.includes('penitentiary') || s.includes('prison') || s.includes('frontier') || s.includes('1800')) {
      return 'frontier_1800_dusty_afternoon';
    }
    if (s.includes('maya') || s.includes('kukul') || s.includes('jungle')) {
      return 'maya_jungle_zenith';
    }
    if (
      s.includes('japan') ||
      s.includes('japon') ||
      s.includes('china') ||
      s.includes('chine') ||
      s.includes('minka') ||
      s.includes('sakura')
    ) {
      return 'japan_sakura_dawn';
    }
    if (s.includes('rome') || s.includes('roman') || s.includes('domus')) {
      return 'rome_mediterranean_morning';
    }
    if (s.includes('egypt') || s.includes('pyramid')) {
      return 'egypt_golden_noon';
    }

    // Extract level number from future IDs like "level14_..." .. "level100_..."
    const match = s.match(/level(\d+)/);
    if (match) {
      const parsedNum = parseInt(match[1], 10);
      if (Number.isFinite(parsedNum) && parsedNum >= 1) {
        const chIdx = Math.min(FUTURE_CHAPTER_PRESETS.length - 1, Math.floor((parsedNum - 1) / 10));
        return FUTURE_CHAPTER_PRESETS[chIdx];
      }
    }
  }

  if (typeof levelNum === 'number' && Number.isFinite(levelNum) && levelNum >= 1) {
    const chIdx = Math.min(FUTURE_CHAPTER_PRESETS.length - 1, Math.floor((levelNum - 1) / 10));
    return FUTURE_CHAPTER_PRESETS[chIdx];
  }

  return 'egypt_golden_noon';
}

export function getSolarPreset(levelIdOrPreset, levelNum = null) {
  const key = resolveSolarPresetId(levelIdOrPreset, levelNum);
  return SOLAR_LIGHTING_PRESETS[key] || SOLAR_LIGHTING_PRESETS.egypt_golden_noon;
}

/**
 * Computes tightly fitted orthographic shadow frustum half-extent matched to the active
 * level's board radius & terrain tier (128x128 cap ±48, 160x160 cap ±62, 192x192 cap ±74),
 * maximizing shadow texel density across the playable diorama with zero edge clipping.
 */
export function computeTightShadowBounds(level = null, preset = null) {
  const segs =
    (level && level.tierSpec && level.tierSpec.terrainSegments) ||
    (level && level.cityConfig && level.cityConfig.terrainSegments) ||
    128;

  const tierMax = segs >= 192 ? 74 : segs >= 160 ? 62 : 48;
  const boardW = (level && level.tierSpec && level.tierSpec.boardWidth) || 0;
  const boardD = (level && level.tierSpec && level.tierSpec.boardDepth) || 0;

  if (boardW > 0 && boardD > 0) {
    // Tight diagonal radius + small margin so every corner casts crisp soft shadows
    const diagRadius = Math.hypot(boardW * 0.5, boardD * 0.5) + 2.2;
    return Math.min(tierMax, Math.max(18.0, Math.round(diagRadius * 2) / 2));
  }

  const base = (preset && preset.shadowBounds) || (segs >= 192 ? 31 : segs >= 160 ? 26 : 20);
  return Math.min(tierMax, base);
}

/**
 * Automatically traverses a level or 3D object tree so solid geometry (trees, quarry rocks,
 * carts, workshop walls, placed blocks, placed furniture) casts and receives soft shadows,
 * while translucent blueprint ghost outlines, water planes, slot markers, hitboxes, sunbeams,
 * sky domes, and particles NEVER cast shadows (`castShadow = false`).
 */
export function applyShadowFlagsToObject(root) {
  if (!root || typeof root.traverse !== 'function') return;

  root.traverse((obj) => {
    if (!obj) return;

    // Non-mesh primitives (LineSegments blueprint outlines, Points particles, Lights, Groups)
    if (obj.isLineSegments || obj.isLine || obj.isPoints) {
      obj.castShadow = false;
      return;
    }
    if (!obj.isMesh) return;

    const name = (obj.name || '').toLowerCase();
    const mat = obj.material;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];

    // Check whether the mesh is translucent, shader-driven, invisible, or a helper/water/ghost
    const isNonCasterMat = mats.some(
      (m) =>
        !m ||
        m.visible === false ||
        m.transparent === true ||
        m.isShaderMaterial === true ||
        m.depthWrite === false ||
        m.blending === THREE.AdditiveBlending
    );
    const isHelperName =
      name.includes('ghost') ||
      name.includes('water') ||
      name.includes('brook') ||
      name.includes('lagoon') ||
      name.includes('beam') ||
      name.includes('sky') ||
      name.includes('mote') ||
      name.includes('shadow') ||
      name.includes('marker') ||
      name.includes('hitbox') ||
      name.includes('ring') ||
      name.includes('aura');

    // Terrain plane & plinth skirts receive shadows cleanly without self-shadowing artifacts
    const isTerrainOrPlinth =
      name.includes('terrain') ||
      name.includes('plinth') ||
      (obj.geometry &&
        obj.geometry.attributes &&
        obj.geometry.attributes.aSplat !== undefined);

    if (isTerrainOrPlinth) {
      obj.castShadow = false;
      obj.receiveShadow = true;
      return;
    }

    if (obj.visible === false || isNonCasterMat || isHelperName) {
      obj.castShadow = false;
      // Water planes still softly receive shadows from stilt houses, trees & boardwalks
      if (name.includes('water') || name.includes('brook') || name.includes('lagoon')) {
        obj.receiveShadow = true;
      }
      return;
    }

    // Solid 3D diorama meshes (rocks, trees, carts, workshop walls, placed blocks & furniture)
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

/* ============================================================================
 * CUSTOM GLSL SOFT SKY DOME & MIE-STYLE HORIZON SUN-GLOW SHADER
 * ========================================================================== */
const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;

  void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uNadirColor;
  uniform float uHazeIntensity;
  uniform float uSunHaloPower;
  uniform float uTime;

  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    vec3 sunDir = normalize(uSunDirection);

    // Diorama-calibrated horizon lift so gentle zenith sky & horizon mist frame elevated cameras
    float elev = dir.y + 0.14;
    float up = clamp(elev, 0.0, 1.0);
    float down = clamp(-elev, 0.0, 1.0);
    vec3 skyCol = mix(uHorizonColor, uZenithColor, pow(up, 0.65));
    skyCol = mix(skyCol, uNadirColor, smoothstep(0.04, 0.56, down));

    // Gentle horizon atmospheric mist band
    float horizonBand = exp(-abs(elev) * 4.8) * uHazeIntensity;
    skyCol = mix(skyCol, uHorizonColor, clamp(horizonBand * 0.62, 0.0, 0.7));

    // Soft dual-lobe Mie-style solar halo & subtle atmospheric breath shimmer
    float sunDot = max(dot(dir, sunDir), 0.0);
    vec3 dirHoriz = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001, 0.0, 0.0));
    vec3 sunHoriz = normalize(vec3(sunDir.x, 0.0, sunDir.z) + vec3(0.0001, 0.0, 0.0));
    float horizonSun = max(dot(dirHoriz, sunHoriz), 0.0);
    float breath = 0.97 + 0.03 * sin(uTime * 0.45);
    float broadGlow = pow(sunDot, 3.2) * (0.24 + uHazeIntensity * 0.2);
    float horizonGlow = pow(horizonSun, 4.0) * exp(-abs(elev) * 3.6) * (0.16 + uHazeIntensity * 0.14);
    float tightHalo = pow(sunDot, uSunHaloPower) * 0.34;
    float softCore = smoothstep(0.992, 0.9994, sunDot) * 0.4;

    skyCol += uSunColor * (broadGlow + horizonGlow + tightHalo + softCore) * breath;

    gl_FragColor = vec4(skyCol, 1.0);
  }
`;

/* ============================================================================
 * LIGHTWEIGHT VOLUMETRIC SUNBEAMS / GOD RAYS SHADER (1 DRAW CALL INSTANCED!)
 * Smooth Fresnel silhouette fade + soft top & ground contact dissolve + shimmer
 * ========================================================================== */
const SUNBEAM_VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;
  attribute float aIntensity;

  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;
  varying float vPhase;
  varying float vIntensity;

  void main() {
    vUv = uv;
    vPhase = aPhase;
    vIntensity = aIntensity;

    mat4 mvMat = modelViewMatrix * instanceMatrix;
    vec4 mvPos = mvMat * vec4(position, 1.0);

    // Transform normal cleanly into view space for smooth Fresnel edge falloff
    mat3 normalMat3 = mat3(mvMat);
    vViewNormal = normalize(normalMat3 * normal);
    vViewDir = normalize(-mvPos.xyz);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const SUNBEAM_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBeamColor;
  uniform float uOpacity;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;
  varying float vPhase;
  varying float vIntensity;

  void main() {
    // 1. Soft Fresnel silhouette falloff (fades cleanly to 0.0 at shaft edges from any angle)
    float ndotv = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
    float fresnelEdge = pow(clamp(ndotv, 0.0, 1.0), 1.85);

    // 2. Soft vertical fade at both ground contact (vUv.y = 0) and upper sky fade (vUv.y = 1)
    float bottomFade = smoothstep(0.0, 0.30, vUv.y);
    float topFade = smoothstep(1.0, 0.62, vUv.y);
    float verticalMask = bottomFade * topFade;

    // 3. Subtle animated diagonal dust-shimmer waves drifting inside the sunbeam
    float waveA = sin(vUv.y * 11.0 - uTime * 0.95 + vPhase);
    float waveB = cos(vUv.x * 6.28318 * 2.0 + uTime * 0.35 + vPhase * 1.4);
    float shimmer = 0.80 + 0.14 * waveA + 0.06 * waveB;

    float alpha = uOpacity * vIntensity * fresnelEdge * verticalMask * shimmer;
    if (alpha < 0.002) discard;

    // Slightly warmer/brighter inner core fading to soft atmospheric beam tint
    vec3 col = uBeamColor * (0.85 + 0.25 * fresnelEdge);
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * Builds lightweight volumetric sunbeams ("rayons de lumière" / god rays) as a single
 * InstancedMesh of 5–7 tapered shafts aligned strictly with the active level's sun angle.
 * Zero screen-space blur cost; 1 draw call at locked 60 FPS on iPhone 16e Safari.
 */
export function createSunBeams(scene, preset, { spread = 13.5, mountTo = null } = {}) {
  const cfg = typeof preset === 'string' ? getSolarPreset(preset) : preset || SOLAR_LIGHTING_PRESETS.egypt_golden_noon;
  const count = Math.min(7, Math.max(5, cfg.beamCount || SUNBEAM_SHAFT_COUNT));

  const sunDir = new THREE.Vector3(
    cfg.sunDirection[0],
    cfg.sunDirection[1],
    cfg.sunDirection[2]
  ).normalize();

  // Open-ended tapered cone/cylinder shaft: narrower at sky top, softly widening toward diorama
  const shaftHeight = 18.5;
  const geo = new THREE.CylinderGeometry(0.42, 2.35, shaftHeight, 12, 1, true);

  const phases = new Float32Array(count);
  const intensities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phases[i] = i * 1.37 + 0.4;
    intensities[i] = 0.72 + ((i * 37) % 10) * 0.045;
  }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geo.setAttribute('aIntensity', new THREE.InstancedBufferAttribute(intensities, 1));

  const uniforms = {
    uBeamColor: { value: new THREE.Color(cfg.beamColor || cfg.sunColor || '#ffe8b0') },
    uOpacity: { value: typeof cfg.beamOpacity === 'number' ? cfg.beamOpacity : 0.115 },
    uTime: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: SUNBEAM_VERTEX_SHADER,
    fragmentShader: SUNBEAM_FRAGMENT_SHADER,
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = `SolarSunBeams_${cfg.id}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.raycast = () => {};

  // Align shaft +Y axis directly toward sunDir so shafts stream diagonally in lockstep with shadows
  const beamQuat = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, sunDir);
  const dummy = new THREE.Object3D();

  // Curated golden-ratio shaft placement framing focal landmarks & open sky without obscuring HUD
  const anchors = [
    [-0.48, -0.35, 1.08],
    [0.08, -0.22, 1.18],
    [0.52, -0.4, 0.96],
    [-0.28, 0.36, 0.92],
    [0.34, 0.32, 1.04],
    [0.64, 0.12, 0.88],
    [-0.62, 0.1, 0.86],
  ];

  for (let i = 0; i < count; i++) {
    const [ax, az, sc] = anchors[i % anchors.length];
    const groundX = ax * spread;
    const groundZ = az * spread;
    // Offset shaft center along sunDir by half shaft height so bottom softly touches ground level
    const center = new THREE.Vector3(groundX, 0.25, groundZ).addScaledVector(
      sunDir,
      shaftHeight * 0.44
    );
    dummy.position.copy(center);
    dummy.quaternion.copy(beamQuat);
    dummy.scale.set(sc, 1.0, sc);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  const targetParent = mountTo || scene;
  if (targetParent) {
    targetParent.add(mesh);
  }

  return {
    mesh,
    geo,
    mat,
    uniforms,
    count,
    update(elapsed, centerX = 0, centerZ = 0) {
      uniforms.uTime.value = elapsed;
      mesh.position.set(centerX, 0, centerZ);
    },
    dispose() {
      if (targetParent) targetParent.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}

let _sharedMoteTex = null;
function getSoftMoteTexture() {
  if (_sharedMoteTex) return _sharedMoteTex;
  if (typeof document === 'undefined') return null;

  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.38, 'rgba(255,255,255,0.68)');
  g.addColorStop(0.76, 'rgba(255,255,255,0.18)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  _sharedMoteTex = tex;
  return _sharedMoteTex;
}

/**
 * Builds the custom GLSL Soft Sky Dome & Horizon Sun-Glow mesh (1 draw call).
 */
function createSolarSkyDome(preset, sunDirNormalized) {
  const geo = new THREE.SphereGeometry(168, 24, 16);
  const uniforms = {
    uSunDirection: { value: sunDirNormalized.clone() },
    uSunColor: { value: new THREE.Color(preset.sunColor) },
    uZenithColor: { value: new THREE.Color(preset.zenithColor) },
    uHorizonColor: { value: new THREE.Color(preset.horizonColor) },
    uNadirColor: { value: new THREE.Color(preset.nadirColor) },
    uHazeIntensity: { value: preset.hazeIntensity },
    uSunHaloPower: { value: preset.sunHaloPower || 10.0 },
    uTime: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `SolarSkyDome_${preset.id}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = -12;
  mesh.raycast = () => {};
  return { mesh, geo, mat, uniforms };
}

/**
 * Builds lightweight instanced sun-beam dust / pollen / mist motes (<= 35 soft additive quads).
 */
function createInstancedSunMotes(preset, spread = 14) {
  const count = Math.min(MAX_MOTE_COUNT, Math.max(8, preset.moteCount || 32));
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(preset.moteColor || '#ffe8b4'),
    map: getSoftMoteTexture(),
    transparent: true,
    opacity: preset.moteOpacity || 0.44,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = `SolarSunMotes_${preset.id}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.raycast = () => {};

  const seeds = new Float32Array(count * 5); // x0, y0, z0, phase, baseScale
  const baseSize = preset.moteSize || 0.21;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const x0 = (((i * 73.13 + 17.3) % 100) / 100) * spread * 2 - spread;
    const y0 = 0.9 + (((i * 41.7 + 9.1) % 100) / 100) * 5.8;
    const z0 = (((i * 29.31 + 53.7) % 100) / 100) * spread * 2 - spread;
    const phase = i * 0.83;
    const sc = baseSize * (0.72 + ((i * 19) % 10) * 0.062);

    const o = i * 5;
    seeds[o + 0] = x0;
    seeds[o + 1] = y0;
    seeds[o + 2] = z0;
    seeds[o + 3] = phase;
    seeds[o + 4] = sc;

    dummy.position.set(x0, y0, z0);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  return { mesh, geo, mat, seeds, count, dummy };
}

/**
 * Configures and mounts the complete Soft Solar, Cast Shadows & Volumetric Sunbeams System.
 * Automatically disposes any prior solar rig mounted on the same scene to guarantee zero leaks
 * or duplicate sky domes / sunbeams when called from both levels and dioramaEnvironment.
 *
 * @param {THREE.Scene} scene - Active Three.js scene
 * @param {THREE.WebGLRenderer|null} renderer - Active renderer (tunes ACESFilmicToneMapping & PCFSoftShadowMap)
 * @param {string|object} levelPresetId - Preset ID, level ID (e.g. 'level13_stilt_village'), or theme ID
 * @param {object} [options]
 * @param {object} [options.lights] - Existing { hemiLight, sunLight, rimLight } rig to calibrate in-place
 * @param {object} [options.level] - Optional active level instance for tight shadow frustum & mesh traversal
 * @param {number} [options.levelNum] - Optional numeric level index (1..100) for future-level fallback
 * @param {number} [options.shadowBounds] - Optional override for orthographic shadow frustum half-extent
 */
export function applyLevelSolarLighting(
  scene,
  renderer,
  levelPresetId = 'egypt_golden_noon',
  { lights = null, level = null, levelNum = null, shadowBounds = null } = {}
) {
  // Cleanly dispose any prior solar atmosphere attached to this scene (prevents duplicate beams/skies)
  if (scene && scene.userData && scene.userData.__solarHandle) {
    try {
      scene.userData.__solarHandle.dispose();
    } catch (_) {
      // Safe fallback
    }
    scene.userData.__solarHandle = null;
  }

  const preset = getSolarPreset(levelPresetId, levelNum);
  const sunDir = new THREE.Vector3(
    preset.sunDirection[0],
    preset.sunDirection[1],
    preset.sunDirection[2]
  ).normalize();

  const bounds =
    typeof shadowBounds === 'number' ? shadowBounds : computeTightShadowBounds(level, preset);
  const sunDistance = Math.max(28.0, bounds * 1.15);
  const sunOffset = sunDir.clone().multiplyScalar(sunDistance);

  // 1. Calibrate Renderer Soft Tone Mapping & PCFSoftShadowMap (zero post-processing cost)
  if (renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = preset.exposure || 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  }

  // 2. Calibrate Scene Background, Soft Exponential Atmospheric Fog (FogExp2) & IBL Intensity
  if (scene) {
    if (!scene.background || !(scene.background instanceof THREE.Color)) {
      scene.background = new THREE.Color(preset.fogColor);
    } else {
      scene.background.set(preset.fogColor);
    }

    scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
    if (typeof preset.envIntensity === 'number') {
      scene.environmentIntensity = preset.envIntensity;
    }
  }

  // 3. Configure Soft Hemisphere + Directional Sunlight (1024x1024 PCFSoftShadowMap) + Rim Fill
  let ownedLights = false;
  let rig = lights;
  if (!rig && scene) {
    ownedLights = true;
    const hemiLight = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
    hemiLight.position.set(0, 26, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
    sunLight.castShadow = true;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(preset.rimColor, preset.rimIntensity);
    scene.add(rimLight);

    rig = { hemiLight, sunLight, rimLight };
  }

  if (rig) {
    rig.sunOffset = sunOffset.clone();

    if (rig.hemiLight) {
      rig.hemiLight.color.set(preset.hemiSky);
      rig.hemiLight.groundColor.set(preset.hemiGround);
      rig.hemiLight.intensity = preset.hemiIntensity;
    }

    if (rig.sunLight) {
      const sun = rig.sunLight;
      sun.castShadow = true;
      sun.color.set(preset.sunColor);
      sun.intensity = preset.sunIntensity;
      sun.position.copy(sunOffset);
      sun.target.position.set(0, 0, 0);
      sun.target.updateMatrixWorld();

      // Tightly fitted 1024x1024 PCFSoftShadowMap (zero shadow acne, zero floating detachment)
      if (sun.shadow) {
        if (sun.shadow.mapSize.x !== 1024 || sun.shadow.mapSize.y !== 1024) {
          sun.shadow.mapSize.set(1024, 1024);
          if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
          }
        }
        sun.shadow.radius = 2.5;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.02;
        sun.shadow.camera.near = 2.5;
        sun.shadow.camera.far = Math.max(88, bounds * 3.2);
        sun.shadow.camera.left = -bounds;
        sun.shadow.camera.right = bounds;
        sun.shadow.camera.top = bounds;
        sun.shadow.camera.bottom = -bounds;
        sun.shadow.camera.updateProjectionMatrix();
      }
    }

    if (rig.rimLight) {
      rig.rimLight.color.set(preset.rimColor);
      rig.rimLight.intensity = preset.rimIntensity;
      rig.rimLight.position.set(
        -sunOffset.x * 0.78,
        Math.max(8, sunOffset.y * 0.52),
        -sunOffset.z * 0.78
      );
    }
  }

  // 4. Automatically configure cast/receive shadow flags on the level's solid geometry
  if (level && level.root) {
    applyShadowFlagsToObject(level.root);
  }

  // 5. Mount Custom Sky Dome + Volumetric Sunbeams (God Rays) + Instanced Sunbeam Motes (<= 35)
  const root = new THREE.Group();
  root.name = `SolarAtmosphere_${preset.id}`;

  const sky = createSolarSkyDome(preset, sunDir);
  root.add(sky.mesh);

  const spread =
    preset.id === 'lagoon_tropical_sunlight'
      ? 18.0
      : preset.id === 'worldmap_golden_archipelago'
        ? 16.5
        : bounds >= 24
          ? 15.5
          : 12.5;

  const sunBeams = createSunBeams(scene, preset, { spread, mountTo: root });
  const motes = createInstancedSunMotes(preset, spread);
  root.add(motes.mesh);

  if (scene) {
    scene.add(root);
  }

  const _quat = new THREE.Quaternion();
  let disposed = false;

  const handle = {
    presetId: preset.id,
    preset,
    root,
    lights: rig,
    sunDirection: sunDir,
    sunOffset,
    shadowBounds: bounds,
    skyMesh: sky.mesh,
    skyUniforms: sky.uniforms,
    sunBeams,
    sunBeamsMesh: sunBeams.mesh,
    sunBeamCount: sunBeams.count,
    motesMesh: motes.mesh,
    moteCount: motes.count,

    /**
     * Updates sky dome, volumetric sunbeams & instanced dust motes every frame (zero allocations).
     */
    update(dt, elapsed, centerX = 0, centerZ = 0, camera = null) {
      if (disposed) return;
      const t = typeof elapsed === 'number' ? elapsed : (_internalElapsed += dt || 0.016);

      sky.mesh.position.set(centerX, 0, centerZ);
      sky.uniforms.uTime.value = t;
      sunBeams.update(t, centerX, centerZ);
      motes.mesh.position.set(centerX, 0, centerZ);

      if (camera && camera.quaternion) {
        _quat.copy(camera.quaternion);
      } else {
        _quat.identity();
      }

      const style = preset.moteStyle || 'dust';
      const isPetal = style === 'petal';
      const isFirefly = style === 'firefly';
      const isSteam = style === 'steam' || style === 'mist';
      const dummy = motes.dummy;
      const seeds = motes.seeds;

      for (let i = 0; i < motes.count; i++) {
        const o = i * 5;
        const x0 = seeds[o + 0];
        const y0 = seeds[o + 1];
        const z0 = seeds[o + 2];
        const phase = seeds[o + 3];
        const baseScale = seeds[o + 4];

        let px = x0;
        let py = y0;
        let pz = z0;

        if (isPetal) {
          const fall = (t * 0.48 + phase) % 5.6;
          px = x0 + Math.sin(t * 0.95 + phase) * 0.95;
          py = 6.2 - fall;
          pz = z0 + Math.cos(t * 0.8 + phase) * 0.72;
        } else if (isFirefly) {
          px = x0 + Math.sin(t * 0.65 + phase) * 0.85;
          py = y0 + Math.sin(t * 1.35 + phase * 1.3) * 0.45;
          pz = z0 + Math.cos(t * 0.6 + phase) * 0.85;
        } else if (isSteam) {
          const rise = (t * 0.34 + phase) % 5.4;
          px = x0 + Math.sin(t * 0.4 + phase) * 0.9;
          py = 0.8 + rise;
          pz = z0 + Math.cos(t * 0.35 + phase) * 0.8;
        } else {
          // Gentle sunbeam dust / pollen / sea-spray drift
          px = x0 + Math.sin(t * 0.32 + phase) * 1.1;
          py = y0 + Math.sin(t * 0.48 + phase * 1.1) * 0.28;
          pz = z0 + Math.cos(t * 0.28 + phase) * 0.92;
        }

        const pulse = 0.82 + 0.28 * Math.sin(t * 1.6 + phase * 1.7);
        dummy.position.set(px, py, pz);
        dummy.quaternion.copy(_quat);
        dummy.scale.setScalar(baseScale * pulse);
        dummy.updateMatrix();
        motes.mesh.setMatrixAt(i, dummy.matrix);
      }
      motes.mesh.instanceMatrix.needsUpdate = true;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (scene) {
        scene.remove(root);
        if (scene.userData && scene.userData.__solarHandle === handle) {
          scene.userData.__solarHandle = null;
        }
        if (ownedLights && rig) {
          if (rig.hemiLight) scene.remove(rig.hemiLight);
          if (rig.sunLight) {
            scene.remove(rig.sunLight);
            if (rig.sunLight.target) scene.remove(rig.sunLight.target);
          }
          if (rig.rimLight) scene.remove(rig.rimLight);
        }
      }
      if (_activeSolarHandle === handle) {
        _activeSolarHandle = null;
      }
      sky.geo.dispose();
      sky.mat.dispose();
      sunBeams.dispose();
      motes.geo.dispose();
      motes.mat.dispose();
    },
  };

  if (scene) {
    if (!scene.userData) scene.userData = {};
    scene.userData.__solarHandle = handle;
  }
  _activeSolarHandle = handle;
  return handle;
}

/**
 * Updates the currently active Solar Lighting, Volumetric Sunbeams & Dust Motes each frame.
 */
export function updateSolarLighting(deltaTime, elapsed = null, centerX = 0, centerZ = 0, camera = null) {
  if (!_activeSolarHandle) return;
  const t = typeof elapsed === 'number' ? elapsed : (_internalElapsed += deltaTime || 0.016);
  _activeSolarHandle.update(deltaTime, t, centerX, centerZ, camera);
}

export function getActiveSolarLighting() {
  return _activeSolarHandle;
}
