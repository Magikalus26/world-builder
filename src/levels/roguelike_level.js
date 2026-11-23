/**
 * Workd Builder — Procedural Roguelike Random Level Generator
 * Generates a unique randomized chantier every run:
 *  - Random target monument blueprint & block count (18–45 blocks)
 *  - Random terrain biome palette & sky atmosphere
 *  - Randomized station placement (East/West layout mirroring)
 *  - Random run modifier pill (e.g. "Taille Rapide x2", "Prime d'Or +50%")
 *  - Gold coin reward on completion
 */

import { Level1Pyramid } from './level1_pyramid.js';

function makeRectCells(sizeX, sizeZ, skipCorners = false) {
  const ox = (sizeX - 1) * 0.5;
  const oz = (sizeZ - 1) * 0.5;
  const cells = [];
  for (let gx = 0; gx < sizeX; gx++) {
    for (let gz = 0; gz < sizeZ; gz++) {
      if (
        skipCorners &&
        (gx === 0 || gx === sizeX - 1) &&
        (gz === 0 || gz === sizeZ - 1)
      ) {
        continue;
      }
      cells.push([gx - ox, gz - oz]);
    }
  }
  return cells;
}

/** 6 procedural monument shapes strictly between 18 and 45 blocks */
const BLUEPRINT_TEMPLATES = [
  {
    name: 'Tour Obélisque',
    layers: [
      { cells: makeRectCells(3, 3) }, // 9
      { cells: makeRectCells(2, 2) }, // 4
      { cells: makeRectCells(2, 2) }, // 4
      { cells: makeRectCells(1, 1) }, // 1
      { cells: makeRectCells(1, 1), isCapstone: true }, // 1 => 19 blocks
    ],
  },
  {
    name: 'Autel Solaire',
    layers: [
      { cells: makeRectCells(4, 4, true) }, // 12 (cruciform base)
      { cells: makeRectCells(3, 3) }, // 9
      { cells: makeRectCells(1, 1), isCapstone: true }, // 1 => 22 blocks
    ],
  },
  {
    name: 'Citadelle Jumelle',
    layers: [
      { cells: makeRectCells(4, 4) }, // 16
      { cells: makeRectCells(3, 3) }, // 9
      { cells: makeRectCells(1, 1), isCapstone: true }, // 1 => 26 blocks
    ],
  },
  {
    name: 'Ziggourat d’Or',
    layers: [
      { cells: makeRectCells(4, 4) }, // 16
      { cells: makeRectCells(3, 3) }, // 9
      { cells: makeRectCells(2, 2) }, // 4
      { cells: makeRectCells(1, 1), isCapstone: true }, // 1 => 30 blocks
    ],
  },
  {
    name: 'Sanctuaire Royal',
    layers: [
      { cells: makeRectCells(5, 5, true) }, // 21 (chamfered temple base)
      { cells: makeRectCells(3, 3) }, // 9
      { cells: makeRectCells(2, 2) }, // 4
      { cells: makeRectCells(1, 1), isCapstone: true }, // 1 => 35 blocks
    ],
  },
  {
    name: 'Grande Ziggourat',
    layers: [
      { cells: makeRectCells(5, 5, true) }, // 21
      { cells: makeRectCells(4, 4) }, // 16
      { cells: makeRectCells(2, 2) }, // 4
      { cells: makeRectCells(1, 1) }, // 1
      { cells: makeRectCells(1, 1), isCapstone: true }, // 1 => 43 blocks
    ],
  },
];

/** 4 atmospheric biome palettes reusing the 512x512 PBR terrain & stone maps */
const BIOME_PALETTES = [
  {
    id: 'solar_desert',
    name: 'Désert Solaire',
    skyColor: '#efd3a2',
    terrainTint: '#ffffff',
    stoneTint: '#fff2d2',
  },
  {
    id: 'emerald_oasis',
    name: 'Oasis Émeraude',
    skyColor: '#d4e8d8',
    terrainTint: '#dff2dc',
    stoneTint: '#f2e8cc',
  },
  {
    id: 'crimson_canyon',
    name: 'Canyon Pourpre',
    skyColor: '#ebc3b0',
    terrainTint: '#f5cbb8',
    stoneTint: '#f2c8aa',
  },
  {
    id: 'lunar_quarry',
    name: 'Carrière Lunaire',
    skyColor: '#c9d7e8',
    terrainTint: '#dce4f2',
    stoneTint: '#e2e6f0',
  },
];

/** 4 randomized gameplay run modifiers */
const RUN_MODIFIERS = [
  {
    id: 'fast_carve',
    label: 'Taille Rapide x2',
    fastCarve: true,
    goldMult: 1.0,
    quarryMaxHits: 2,
    sledSpeedMult: 1.0,
  },
  {
    id: 'gold_rush',
    label: 'Prime d’Or +50%',
    fastCarve: false,
    goldMult: 1.5,
    quarryMaxHits: 2,
    sledSpeedMult: 1.0,
  },
  {
    id: 'express_quarry',
    label: 'Carrière Express',
    fastCarve: false,
    goldMult: 1.15,
    quarryMaxHits: 1,
    sledSpeedMult: 1.0,
  },
  {
    id: 'turbo_sleds',
    label: 'Traîneaux Turbo',
    fastCarve: false,
    goldMult: 1.15,
    quarryMaxHits: 2,
    sledSpeedMult: 1.65,
  },
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Generates a fresh randomized Roguelike run specification (18–45 blocks).
 */
export function generateRoguelikeConfig() {
  const blueprint = pickRandom(BLUEPRINT_TEMPLATES);
  const biome = pickRandom(BIOME_PALETTES);
  const modifier = pickRandom(RUN_MODIFIERS);
  const mirrorX = Math.random() < 0.5 ? 1 : -1;

  const totalBlocks = blueprint.layers.reduce((sum, l) => sum + l.cells.length, 0);
  const rewardCoins = Math.round((50 + totalBlocks * 2.5) * modifier.goldMult);
  // Exclusive Roguelike currency: +25 to +50 Éclats d'Architecte scaled by monument complexity
  const blockRatio = Math.max(0, Math.min(1, (totalBlocks - 18) / (45 - 18)));
  const bonusTokens = modifier.id === 'gold_rush' ? 4 : 0;
  const rewardTokens = Math.min(50, Math.max(25, Math.round(25 + blockRatio * 23 + bonusTokens)));

  return {
    hudLabel: blueprint.name,
    biomeName: biome.name,
    skyColor: biome.skyColor,
    terrainTint: biome.terrainTint,
    stoneTint: biome.stoneTint,
    mirrorX,
    blueprintLayers: blueprint.layers,
    totalGoal: totalBlocks,
    modifierLabel: modifier.label,
    fastCarve: modifier.fastCarve,
    quarryMaxHits: modifier.quarryMaxHits,
    sledSpeedMult: modifier.sledSpeedMult,
    rewardCoins,
    rewardTokens,
  };
}

export class RoguelikeLevel extends Level1Pyramid {
  static meta = {
    id: 'roguelike_random',
    title: 'Roguelike — Niveau Aléatoire',
    hudLabel: 'Chantier',
    totalGoal: 30,
  };

  constructor({ scene, textures, audio, onProgress, onComplete, upgrades = {}, runConfig = null }) {
    const cfg = runConfig || generateRoguelikeConfig();
    super({
      scene,
      textures,
      audio,
      onProgress,
      onComplete,
      upgrades,
      runConfig: cfg,
    });
    this.roguelikeConfig = cfg;
  }
}
