/**
 * Workd Builder — Two-Stage Procedural Roguelike Engine
 * Stage 1: Rolls 1 of 3 Civilization Level Themes (Égypte, Rome, Chine) with matching biome & palette.
 * Stage 2: Randomly picks 1 of 5 dedicated multi-tier 3D architectural blueprint structures
 *          (15 total unique structures, 22–36 blocks each) tailored specifically to the rolled level.
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

function makeRingCells(sizeX, sizeZ, skipCorners = false) {
  const ox = (sizeX - 1) * 0.5;
  const oz = (sizeZ - 1) * 0.5;
  const cells = [];
  for (let gx = 0; gx < sizeX; gx++) {
    for (let gz = 0; gz < sizeZ; gz++) {
      const isEdge = gx === 0 || gx === sizeX - 1 || gz === 0 || gz === sizeZ - 1;
      if (!isEdge) continue;
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

/* ============================================================================
 * 3 CIVILIZATION THEMES × 5 DEDICATED ARCHITECTURAL STRUCTURES = 15 BLUEPRINTS
 * ========================================================================== */
export const ROGUELIKE_THEMES = [
  {
    id: 'egypt',
    levelNum: 1,
    shortName: 'Égypte',
    title: 'Niveau 1 : Égypte — Désert de Gizeh',
    biomeLabel: 'Sable doré & Oasis du Nil',
    skyColor: '#efd3a2',
    terrainTint: '#ffffff',
    stoneTint: '#fff2d2',
    accentColor: '#f5c256',
    rewardRangeLabel: '+30 à +55 Éclats',
    structures: [
      {
        id: 'egypt_stepped_pyramid',
        name: 'La Petite Pyramide à Degrés',
        subtitle: 'Pyramide à 4 étages',
        // 16 + 9 + 4 + 1 = 30 blocks
        layers: [
          { cells: makeRectCells(4, 4) },
          { cells: makeRectCells(3, 3) },
          { cells: makeRectCells(2, 2) },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'egypt_horus_temple',
        name: "Le Temple à Colonnes d'Horus",
        subtitle: 'Portique hypostyle & linteaux',
        // 10 + 4 + 4 + 8 = 26 blocks
        layers: [
          {
            cells: [
              [-1.5, -1], [-0.5, -1], [0.5, -1], [1.5, -1],
              [-0.5, 0], [0.5, 0],
              [-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1],
            ],
          },
          { cells: [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]] },
          { cells: [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]] },
          {
            cells: [
              [-1.5, -1], [-0.5, -1], [0.5, -1], [1.5, -1],
              [-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1],
            ],
          },
        ],
      },
      {
        id: 'egypt_solar_obelisk',
        name: 'Le Grand Obélisque Solaire',
        subtitle: 'Obélisque élancé sur socle',
        // 9 + 4 + 4 + 1 + 1 + 1 + 1 + 1 = 22 blocks
        layers: [
          { cells: makeRectCells(3, 3) },
          { cells: makeRectCells(2, 2) },
          { cells: makeRectCells(2, 2) },
          { cells: [[0, 0]] },
          { cells: [[0, 0]] },
          { cells: [[0, 0]] },
          { cells: [[0, 0]] },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'egypt_royal_mastaba',
        name: 'Le Mastaba Royal',
        subtitle: 'Tombeau trapézoïdal & parvis',
        // 18 + 12 + 4 = 34 blocks
        layers: [
          {
            cells: makeRectCells(5, 4).filter(
              ([x, z]) => !(z === 1.5 && (x === -1 || x === 1))
            ),
          },
          { cells: makeRectCells(4, 3) },
          { cells: makeRectCells(2, 2) },
        ],
      },
      {
        id: 'egypt_nile_pylons',
        name: 'Les Deux Pylônes du Nil',
        subtitle: 'Tours monumentales & passerelle',
        // 12 + 8 + 10 + 2 = 32 blocks
        layers: [
          {
            cells: [
              [-2, -1], [-1, -1], [-2, 0], [-1, 0], [-2, 1], [-1, 1],
              [1, -1], [2, -1], [1, 0], [2, 0], [1, 1], [2, 1],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [0, -0.5], [1, -0.5], [2, -0.5],
              [-2, 0.5], [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5],
            ],
          },
          { cells: [[-1.5, 0], [1.5, 0]], isCapstone: true },
        ],
      },
    ],
  },
  {
    id: 'rome',
    levelNum: 2,
    shortName: 'Rome',
    title: 'Niveau 2 : Rome — Colline Impériale',
    biomeLabel: 'Marbre blanc, Cyprès & Colline',
    skyColor: '#d6e8f2',
    terrainTint: '#dbe8ce',
    stoneTint: '#f7f3ea',
    accentColor: '#76c2e8',
    rewardRangeLabel: '+30 à +55 Éclats',
    structures: [
      {
        id: 'rome_triumphal_arch',
        name: "L'Arc de Triomphe",
        subtitle: 'Arche monumentale & frise attique',
        // 8 + 8 + 10 + 2 = 28 blocks
        layers: [
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [0, -0.5], [1, -0.5], [2, -0.5],
              [-2, 0.5], [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5],
            ],
          },
          { cells: [[-0.5, 0], [0.5, 0]] },
        ],
      },
      {
        id: 'rome_double_aqueduct',
        name: "L'Aqueduc à Double Arche",
        subtitle: 'Pont-canal impérial à deux niveaux',
        // 6 + 6 + 10 + 5 + 5 = 32 blocks
        layers: [
          {
            cells: [
              [-2, -0.5], [-2, 0.5],
              [0, -0.5], [0, 0.5],
              [2, -0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-2, 0.5],
              [0, -0.5], [0, 0.5],
              [2, -0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [0, -0.5], [1, -0.5], [2, -0.5],
              [-2, 0.5], [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [[-2, -0.5], [-2, 0.5], [0, 0], [2, -0.5], [2, 0.5]],
          },
          {
            cells: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]],
          },
        ],
      },
      {
        id: 'rome_mini_colosseum',
        name: 'Le Petit Colisée',
        subtitle: 'Amphithéâtre octogonal à 3 gradins',
        // 12 + 12 + 12 = 36 blocks
        layers: [
          { cells: makeRingCells(5, 5, true) },
          { cells: makeRingCells(5, 5, true) },
          { cells: makeRingCells(5, 5, true) },
        ],
      },
      {
        id: 'rome_pediment_temple',
        name: 'Le Temple à Fronton',
        subtitle: 'Podium, colonnade & fronton',
        // 12 + 6 + 8 + 3 + 1 = 30 blocks
        layers: [
          { cells: makeRectCells(4, 3) },
          { cells: [[-1.5, -1], [1.5, -1], [-1.5, 0], [1.5, 0], [-1.5, 1], [1.5, 1]] },
          { cells: makeRectCells(4, 2) },
          { cells: [[-1, 0], [0, 0], [1, 0]] },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'rome_watchtower',
        name: 'La Tour de Guet Romaine',
        subtitle: 'Donjon carré & créneaux d’angle',
        // 8 + 4 + 4 + 4 + 4 = 24 blocks
        layers: [
          { cells: makeRingCells(3, 3, false) },
          { cells: makeRectCells(2, 2) },
          { cells: makeRectCells(2, 2) },
          { cells: makeRectCells(2, 2) },
          { cells: [[-1, -1], [1, -1], [-1, 1], [1, 1]] },
        ],
      },
    ],
  },
  {
    id: 'china',
    levelNum: 3,
    shortName: 'Chine',
    title: 'Niveau 3 : Chine — Montagne Céleste',
    biomeLabel: 'Terrasses de Jade & Bambous',
    skyColor: '#d0e5e0',
    terrainTint: '#cfe2d2',
    stoneTint: '#eceee6',
    accentColor: '#e86f58',
    rewardRangeLabel: '+30 à +55 Éclats',
    structures: [
      {
        id: 'china_three_roof_pagoda',
        name: 'La Pagode à 3 Toits',
        subtitle: 'Tour pagode à avant-toits évasés',
        // 12 + 4 + 9 + 4 + 1 = 30 blocks
        layers: [
          { cells: makeRectCells(4, 4, true) },
          { cells: makeRectCells(2, 2) },
          { cells: makeRectCells(3, 3) },
          { cells: makeRectCells(2, 2) },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'china_imperial_bridge',
        name: 'Le Pont Impérial Voûté',
        subtitle: 'Pont de jardin arqué & balustrades',
        // 8 + 10 + 6 = 24 blocks
        layers: [
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [0, -0.5], [1, -0.5], [2, -0.5],
              [-2, 0.5], [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-1, -0.5], [0, -0.5], [1, -0.5],
              [-1, 0.5], [0, 0.5], [1, 0.5],
            ],
          },
        ],
      },
      {
        id: 'china_paifang_gate',
        name: 'La Porte Paifang',
        subtitle: 'Arche cérémonielle à toits superposés',
        // 8 + 4 + 10 + 3 + 1 = 26 blocks
        layers: [
          {
            cells: [
              [-2, -1], [-2, 0], [-2, 1], [-1, 0],
              [1, 0], [2, -1], [2, 0], [2, 1],
            ],
          },
          { cells: [[-2, 0], [-1, 0], [1, 0], [2, 0]] },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [0, -0.5], [1, -0.5], [2, -0.5],
              [-2, 0.5], [-1, 0.5], [0, 0.5], [1, 0.5], [2, 0.5],
            ],
          },
          { cells: [[-1, 0], [0, 0], [1, 0]] },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'china_great_wall_bastion',
        name: 'Le Bastion de la Grande Muraille',
        subtitle: 'Rempart crénelé & tours de guet',
        // 10 + 10 + 10 + 4 = 34 blocks
        layers: [
          { cells: makeRectCells(5, 2) },
          { cells: makeRectCells(5, 2) },
          { cells: makeRectCells(5, 2) },
          { cells: [[-1.5, -0.5], [-1.5, 0.5], [1.5, -0.5], [1.5, 0.5]] },
        ],
      },
      {
        id: 'china_dragon_pavilion',
        name: 'Le Pavillon du Dragon',
        subtitle: 'Terrasse octogonale & pavillon céleste',
        // 12 + 4 + 9 + 2 + 1 = 28 blocks
        layers: [
          { cells: makeRectCells(4, 4, true) },
          { cells: [[-1, -1], [1, -1], [-1, 1], [1, 1]] },
          { cells: makeRectCells(3, 3) },
          { cells: [[-0.5, 0], [0.5, 0]] },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
    ],
  },
  {
    id: 'maya',
    levelNum: 4,
    shortName: 'Maya',
    title: 'Niveau 4 : Maya — Jungle du Yucatán',
    biomeLabel: 'Jungle Émeraude, Calcaire & Cénote',
    skyColor: '#cde8dc',
    terrainTint: '#cce2c6',
    stoneTint: '#eee4c4',
    accentColor: '#36d692',
    rewardRangeLabel: '+30 à +55 Éclats',
    structures: [
      {
        id: 'maya_kukulkan_pyramid',
        name: 'La Pyramide à Degrés de Kukulcán',
        subtitle: 'Pyramide sacrée à 4 gradins & crête',
        // 16 + 9 + 4 + 4 + 1 = 34 blocks
        layers: [
          { cells: makeRectCells(4, 4) },
          { cells: makeRectCells(3, 3) },
          { cells: makeRectCells(2, 2) },
          { cells: makeRectCells(2, 2) },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'maya_el_caracol',
        name: "L'Observatoire Astronomique El Caracol",
        subtitle: 'Tour octogonale & dôme céleste maya',
        // 12 + 9 + 4 + 2 + 1 = 28 blocks
        layers: [
          { cells: makeRectCells(4, 4, true) },
          { cells: makeRectCells(3, 3) },
          { cells: makeRectCells(2, 2) },
          { cells: [[-0.5, 0], [0.5, 0]] },
          { cells: [[0, 0]], isCapstone: true },
        ],
      },
      {
        id: 'maya_ballcourt',
        name: 'Le Jeu de Pelote Maya',
        subtitle: 'Doubles remparts inclinés & anneaux sacrés',
        // 12 + 12 + 6 = 30 blocks
        layers: [
          {
            cells: [
              [-2, -1], [-1, -1], [-2, 0], [-1, 0], [-2, 1], [-1, 1],
              [1, -1], [2, -1], [1, 0], [2, 0], [1, 1], [2, 1],
            ],
          },
          {
            cells: [
              [-2, -1], [-1, -1], [-2, 0], [-1, 0], [-2, 1], [-1, 1],
              [1, -1], [2, -1], [1, 0], [2, 0], [1, 1], [2, 1],
            ],
          },
          {
            cells: [
              [-2, -1], [-2, 0], [-2, 1],
              [2, -1], [2, 0], [2, 1],
            ],
          },
        ],
      },
      {
        id: 'maya_labna_arch',
        name: "L'Arc Cérémoniel de Labná",
        subtitle: 'Arche à encorbellement & crête faîtière',
        // 8 + 8 + 5 + 3 = 24 blocks
        layers: [
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
            ],
          },
          {
            cells: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]],
          },
          {
            cells: [[-1, 0], [0, 0], [1, 0]],
          },
        ],
      },
      {
        id: 'maya_cenote_sanctuary',
        name: 'Le Sanctuaire du Cénote Sacré',
        subtitle: 'Portique à piliers & autel cérémoniel',
        // 12 + 8 + 10 + 2 = 32 blocks
        layers: [
          { cells: makeRectCells(4, 3) },
          {
            cells: [
              [-1.5, -1], [-0.5, -1], [0.5, -1], [1.5, -1],
              [-0.5, 0], [0.5, 0],
              [-1.5, 1], [1.5, 1],
            ],
          },
          {
            cells: [
              [-1.5, -1], [-0.5, -1], [0.5, -1], [1.5, -1],
              [-1.5, 0], [1.5, 0],
              [-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1],
            ],
          },
          { cells: [[-0.5, -0.5], [0.5, -0.5]] },
        ],
      },
    ],
  },
  {
    id: 'coalmine',
    levelNum: 6,
    shortName: 'Mine de Charbon',
    title: 'Niveau 6 : Mine de Charbon — Bassin Industriel',
    biomeLabel: 'Charbon, Briques Rouges & Chevalement',
    skyColor: '#c9d6de',
    terrainTint: '#bac4c8',
    stoneTint: '#d6a48e',
    accentColor: '#e89d3c',
    rewardRangeLabel: '+30 à +55 Éclats',
    structures: [
      {
        id: 'coal_headframe_6',
        name: 'Le Chevalement du Puits N°6',
        subtitle: 'Puits de mine & tour métallique à molettes',
        // 16 + 8 + 6 + 4 = 34 blocks
        layers: [
          { cells: makeRectCells(4, 4) },
          {
            cells: [
              [-1.5, -1.5], [-0.5, -1.5], [0.5, -1.5], [1.5, -1.5],
              [-1.5, 1.5], [1.5, 1.5], [-0.5, 0], [0.5, 0],
            ],
          },
          {
            cells: [
              [-1, 0], [0, 0], [1, 0],
              [-1, -1], [1, -1], [0, 1],
            ],
          },
          {
            cells: [[-0.5, 0], [0.5, 0], [-0.5, -1], [0.5, -1]],
          },
        ],
      },
      {
        id: 'coal_cokerie_furnace',
        name: 'La Cokerie & Haut-Fourneau',
        subtitle: 'Doubles hauts-fourneaux en briques & conduites',
        // 14 + 10 + 6 + 2 = 32 blocks
        layers: [
          { cells: makeRectCells(5, 3).filter(([x, z]) => !(x === 0 && z === 0)) },
          {
            cells: [
              [-2, -0.5], [-1, -0.5], [-2, 0.5], [-1, 0.5],
              [1, -0.5], [2, -0.5], [1, 0.5], [2, 0.5],
              [-0.5, 0], [0.5, 0],
            ],
          },
          {
            cells: [
              [-1.5, -0.5], [-1.5, 0.5],
              [1.5, -0.5], [1.5, 0.5],
              [-0.5, 0], [0.5, 0],
            ],
          },
          { cells: [[-1.5, 0], [1.5, 0]] },
        ],
      },
      {
        id: 'coal_lavoir_conveyor',
        name: 'Le Lavoir à Charbon & Convoyeur',
        subtitle: 'Atelier de triage étagé & goulotte inclinée',
        // 12 + 10 + 6 + 2 = 30 blocks
        layers: [
          { cells: makeRectCells(4, 3) },
          {
            cells: [
              ...makeRectCells(4, 2),
              [-1.5, 1.5], [1.5, 1.5],
            ],
          },
          { cells: makeRectCells(3, 2) },
          { cells: [[-0.5, 0], [0.5, 0]] },
        ],
      },
      {
        id: 'coal_gare_chateau_eau',
        name: "La Gare de Triage & Château d'Eau",
        subtitle: "Château d'eau en briques & quai de chargement",
        // 12 + 6 + 4 + 4 = 26 blocks
        layers: [
          { cells: makeRectCells(4, 3) },
          {
            cells: [
              ...makeRectCells(2, 2),
              [-1.5, 1], [1.5, 1],
            ],
          },
          { cells: makeRectCells(2, 2) },
          { cells: makeRectCells(2, 2) },
        ],
      },
      {
        id: 'coal_centrale_vapeur',
        name: 'La Centrale à Vapeur & Grande Cheminée',
        subtitle: 'Salle des turbines & haute cheminée cerclée',
        // 12 + 8 + 4 + 2 + 2 = 28 blocks
        layers: [
          { cells: makeRectCells(4, 3) },
          {
            cells: [
              [-1.5, -1], [-0.5, -1], [0.5, -1], [1.5, -1],
              [-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1],
            ],
          },
          {
            cells: [[-0.5, 0], [0.5, 0], [1.5, 0], [-1.5, -1]],
          },
          { cells: [[-1.5, -1], [0.5, 0]] },
          { cells: [[-1.5, -1], [0.5, 0]] },
        ],
      },
    ],
  },
];

/** 4 randomized gameplay run modifiers */
export const RUN_MODIFIERS = [
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

export function getRoguelikeThemeById(themeId) {
  return ROGUELIKE_THEMES.find((t) => t.id === themeId) || ROGUELIKE_THEMES[0];
}

export function rollRandomTheme(excludeThemeId = null) {
  const pool = excludeThemeId
    ? ROGUELIKE_THEMES.filter((t) => t.id !== excludeThemeId)
    : ROGUELIKE_THEMES;
  return pickRandom(pool.length > 0 ? pool : ROGUELIKE_THEMES);
}

export function rollRandomModifier() {
  return pickRandom(RUN_MODIFIERS);
}

/**
 * Stage 2: Given a rolled civilization theme (and optional pre-rolled modifier),
 * randomly selects 1 of its 5 dedicated architectural blueprint structures (22–36 blocks)
 * and builds the complete playable Roguelike run configuration.
 */
export function generateRoguelikeConfig({
  themeId = null,
  structureId = null,
  modifier = null,
} = {}) {
  const theme = themeId ? getRoguelikeThemeById(themeId) : rollRandomTheme();
  const structure = structureId
    ? theme.structures.find((s) => s.id === structureId) || pickRandom(theme.structures)
    : pickRandom(theme.structures);
  const activeMod = modifier || rollRandomModifier();
  const mirrorX = Math.random() < 0.5 ? 1 : -1;

  const totalBlocks = structure.layers.reduce((sum, l) => sum + l.cells.length, 0);
  const rewardCoins = Math.round((55 + totalBlocks * 2.8) * activeMod.goldMult);

  // Exclusive Roguelike reward: +30 to +55 Éclats d'Architecte scaled by blueprint complexity
  const blockRatio = Math.max(0, Math.min(1, (totalBlocks - 22) / (36 - 22)));
  const modBonus = activeMod.id === 'gold_rush' ? 4 : 0;
  const rewardTokens = Math.min(55, Math.max(30, Math.round(30 + blockRatio * 21 + modBonus)));

  return {
    themeId: theme.id,
    themeShortName: theme.shortName,
    themeTitle: theme.title,
    biomeName: theme.biomeLabel,
    structureId: structure.id,
    structureName: structure.name,
    structureSubtitle: structure.subtitle,
    hudLabel: `${theme.shortName} : ${structure.name}`,
    skyColor: theme.skyColor,
    terrainTint: theme.terrainTint,
    stoneTint: theme.stoneTint,
    mirrorX,
    blueprintLayers: structure.layers,
    totalGoal: totalBlocks,
    modifierLabel: activeMod.label,
    fastCarve: activeMod.fastCarve,
    quarryMaxHits: activeMod.quarryMaxHits,
    sledSpeedMult: activeMod.sledSpeedMult,
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
