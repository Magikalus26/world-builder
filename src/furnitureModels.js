/**
 * Workd Builder — Procedural Multi-Part 3D Furniture Model Builder
 * Builds genuine multi-part, PBR-textured 3D Three.js models for all 12 furniture pieces,
 * sharing geometry and material instances via a WeakMap cache for locked 60 FPS on iPhone 16e Safari.
 *
 * Item ID mapping (matches ./assets/furniture/item_01.png .. item_12.png):
 *   item_01 — Râtelier d'Outils / Chevalet d'Outils (Weapons & Tools Rack)
 *   item_02 — Établi de Tailleur (Stonecutter Workbench)
 *   item_03 — Lit Royal Doré (Royal Golden Bed)
 *   item_04 — Trône du Pharaon (Egyptian Royal Throne Chair)
 *   item_05 — Étagère d'Amphores / Étagère de Potier (Potter & Kiln Shelf)
 *   item_06 — Pupitre d'Architecte / Table d'Architecte (Architect Drafting Table)
 *   item_07 — Banc & Lanterne Impériale / Pagode (Asian Pagoda Lantern & Bench)
 *   item_08 — Brasero de Pierre / Antique (Ancient Stone Brazier)
 *   item_09 — Étal du Marchand (Merchant Market Stall)
 *   item_10 — Traîneau de Bâtisseur / du Désert (Wooden Desert Transport Sled)
 *   item_11 — Coffre du Trésor Royal (Ornate Treasure Chest)
 *   item_12 — Fontaine de l'Oasis / Romaine (Roman Marble Fountain)
 */

import * as THREE from 'three';
import { applyCrispTextureSettings } from './graphicsCore.js';

const SHARED_CACHE = new WeakMap();

/* ============================================================================
 * PROCEDURAL MINI PBR TEXTURES FOR FURNITURE (256x256 MAX FOR MOBILE MEMORY)
 * ========================================================================== */
function createMarbleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Warm travertine/white marble base
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#f7f3ea');
  grad.addColorStop(0.5, '#ede6d8');
  grad.addColorStop(1, '#f4efe4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Delicate mineral veins
  ctx.strokeStyle = 'rgba(176, 162, 142, 0.28)';
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.8 + (i % 3) * 0.6;
    ctx.beginPath();
    let x = (i * 37) % 256;
    let y = 0;
    ctx.moveTo(x, y);
    for (let s = 1; s <= 12; s++) {
      x += Math.sin(s * 0.9 + i * 1.7) * 14 + 5;
      y = (s / 12) * 256;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Subtle crystalline flecks
  for (let i = 0; i < 180; i++) {
    const x = (i * 73) % 256;
    const y = (i * 139) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(155,142,122,0.16)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createPapyrusBlueprintTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Warm aged papyrus
  ctx.fillStyle = '#efd8a2';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle woven reed fibers
  ctx.fillStyle = 'rgba(168, 126, 62, 0.1)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 8) {
    ctx.fillRect(x, 0, 1, 256);
  }

  // Drawn architectural blueprint grid
  ctx.strokeStyle = 'rgba(72, 108, 146, 0.55)';
  ctx.lineWidth = 1.2;
  for (let g = 24; g <= 232; g += 26) {
    ctx.beginPath();
    ctx.moveTo(g, 20);
    ctx.lineTo(g, 236);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, g);
    ctx.lineTo(236, g);
    ctx.stroke();
  }

  // Drawn stepped pyramid elevation & compass circle
  ctx.strokeStyle = '#3b2512';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(46, 198);
  ctx.lineTo(128, 66);
  ctx.lineTo(210, 198);
  ctx.closePath();
  ctx.stroke();

  // Horizontal tiers
  for (let t = 1; t <= 4; t++) {
    const f = t / 5;
    const y = 198 - f * 132;
    const halfW = (1 - f) * 82;
    ctx.beginPath();
    ctx.moveTo(128 - halfW, y);
    ctx.lineTo(128 + halfW, y);
    ctx.stroke();
  }

  // Geometric compass arc
  ctx.strokeStyle = 'rgba(176, 56, 36, 0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 148, 48, 0.15 * Math.PI, 1.35 * Math.PI);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createRoyalPatternTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Deep lapis-cobalt & royal crimson weave with gold borders
  ctx.fillStyle = '#1f4e84';
  ctx.fillRect(0, 0, 256, 256);

  // Gold embroidered bands
  ctx.fillStyle = '#eab949';
  ctx.fillRect(0, 18, 256, 14);
  ctx.fillRect(0, 224, 256, 14);

  // Crimson center runner
  ctx.fillStyle = '#9e2b26';
  ctx.fillRect(0, 56, 256, 144);

  // Diamond gold motif
  ctx.fillStyle = '#f2cb66';
  for (let x = 16; x < 256; x += 32) {
    for (let y = 76; y < 192; y += 36) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createStripedCanopyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const stripeW = 32;
  for (let x = 0; x < 256; x += stripeW) {
    ctx.fillStyle = (x / stripeW) % 2 === 0 ? '#c93826' : '#f8ecd2';
    ctx.fillRect(x, 0, stripeW, 256);
  }
  // Subtle woven linen shading & golden trim along bottom edge
  ctx.fillStyle = 'rgba(54, 28, 12, 0.08)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 2);
  }
  ctx.fillStyle = '#e8b648';
  ctx.fillRect(0, 238, 256, 18);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ============================================================================
 * SHARED MATERIAL & GEOMETRY CACHE (ZERO DUPLICATE ALLOCATIONS PER ITEM)
 * ========================================================================== */
function getSharedAssets(textures) {
  const cacheKey = textures || SHARED_CACHE;
  if (SHARED_CACHE.has(cacheKey)) {
    return SHARED_CACHE.get(cacheKey);
  }

  const baseMats = (textures && textures.materials) || {};
  const ownTextures = [];
  const ownMaterials = [];
  const ownGeometries = [];

  const trackTex = (t) => {
    applyCrispTextureSettings(t, { isColor: true });
    ownTextures.push(t);
    return t;
  };
  const trackMat = (m) => {
    ownMaterials.push(m);
    return m;
  };
  const trackGeo = (g) => {
    ownGeometries.push(g);
    return g;
  };

  const marbleTex = trackTex(createMarbleTexture());
  const papyrusTex = trackTex(createPapyrusBlueprintTexture());
  const royalTex = trackTex(createRoyalPatternTexture());
  const marketCanopyTex = trackTex(createStripedCanopyTexture());

  const mat = {
    // Reused PBR materials from textures.js when available
    timber:
      baseMats.timber ||
      trackMat(new THREE.MeshStandardMaterial({ color: '#9c6838', roughness: 0.85, metalness: 0.04 })),
    timberDark:
      baseMats.timberDark ||
      trackMat(new THREE.MeshStandardMaterial({ color: '#6b4222', roughness: 0.88, metalness: 0.04 })),
    sandstone:
      baseMats.carvedBlock ||
      trackMat(new THREE.MeshStandardMaterial({ color: '#dfc28d', roughness: 0.78, metalness: 0.05 })),
    limestone:
      baseMats.foundation ||
      trackMat(new THREE.MeshStandardMaterial({ color: '#d8ceb6', roughness: 0.86, metalness: 0.03 })),
    gold:
      baseMats.capstoneGold ||
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#f2c44d',
          roughness: 0.25,
          metalness: 0.88,
          emissive: '#5a3806',
          emissiveIntensity: 0.18,
        })
      ),
    copper:
      baseMats.copperTool ||
      trackMat(new THREE.MeshStandardMaterial({ color: '#cf7f42', roughness: 0.3, metalness: 0.78 })),

    // Dedicated shared furniture PBR materials
    goldBright: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffd666',
        roughness: 0.22,
        metalness: 0.9,
        emissive: '#6a4408',
        emissiveIntensity: 0.2,
      })
    ),
    bronze: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#9c6c36',
        roughness: 0.38,
        metalness: 0.8,
      })
    ),
    wroughtIron: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#34363c',
        roughness: 0.56,
        metalness: 0.76,
      })
    ),
    whiteMarble: trackMat(
      new THREE.MeshStandardMaterial({
        map: marbleTex,
        roughness: 0.34,
        metalness: 0.06,
      })
    ),
    darkLacquer: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#461a16',
        roughness: 0.26,
        metalness: 0.08,
      })
    ),
    stoneLantern: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#b8b1a3',
        roughness: 0.9,
        metalness: 0.03,
      })
    ),
    turquoiseFabric: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#209ea8',
        roughness: 0.78,
        metalness: 0.04,
      })
    ),
    crimsonFabric: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#a92c25',
        roughness: 0.82,
        metalness: 0.02,
      })
    ),
    linenFabric: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f2e5c9',
        roughness: 0.92,
        metalness: 0.0,
      })
    ),
    royalBlanket: trackMat(
      new THREE.MeshStandardMaterial({
        map: royalTex,
        roughness: 0.74,
        metalness: 0.08,
      })
    ),
    marketCanopy: trackMat(
      new THREE.MeshStandardMaterial({
        map: marketCanopyTex,
        roughness: 0.86,
        metalness: 0.0,
        side: THREE.DoubleSide,
      })
    ),
    papyrus: trackMat(
      new THREE.MeshStandardMaterial({
        map: papyrusTex,
        roughness: 0.88,
        metalness: 0.0,
        side: THREE.DoubleSide,
      })
    ),
    terracotta: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#c96a3f',
        roughness: 0.74,
        metalness: 0.02,
      })
    ),
    terracottaDark: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#9e4c2a',
        roughness: 0.78,
        metalness: 0.02,
      })
    ),
    glazedTeal: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#2b8290',
        roughness: 0.22,
        metalness: 0.1,
      })
    ),
    glazedOchre: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#d89b38',
        roughness: 0.28,
        metalness: 0.08,
      })
    ),
    hempRope: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#c7a468',
        roughness: 0.92,
        metalness: 0.0,
      })
    ),
    sackCloth: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#c7ab7c',
        roughness: 0.94,
        metalness: 0.0,
      })
    ),
    inkBlack: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#1b1a20',
        roughness: 0.22,
        metalness: 0.2,
      })
    ),
    stoneShaving: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#e5d8bc',
        roughness: 0.9,
        metalness: 0.02,
      })
    ),
    emberGlow: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ff641c',
        emissive: '#ff3b00',
        emissiveIntensity: 1.4,
        roughness: 0.65,
      })
    ),
    sparkMat: trackMat(
      new THREE.MeshBasicMaterial({
        color: '#ffcc44',
        transparent: true,
        opacity: 0.92,
      })
    ),
    paperGlow: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fff3cc',
        emissive: '#ffaa38',
        emissiveIntensity: 1.15,
        roughness: 0.85,
      })
    ),
    lockGlow: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffdd68',
        emissive: '#ff9d18',
        emissiveIntensity: 0.8,
        roughness: 0.24,
        metalness: 0.86,
      })
    ),
    fountainWater: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#2fc5cf',
        emissive: '#0c525c',
        emissiveIntensity: 0.24,
        roughness: 0.14,
        metalness: 0.1,
        transparent: true,
        opacity: 0.84,
      })
    ),
    waterStream: trackMat(
      new THREE.MeshBasicMaterial({
        color: '#a8f6fa',
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      })
    ),
    moss: trackMat(
      new THREE.MeshStandardMaterial({
        color: '#638842',
        roughness: 0.9,
        metalness: 0.0,
      })
    ),
  };

  // Shared reusable geometries (lathe profiles & common unit primitives)
  const amphoraProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.055, 0.0),
    new THREE.Vector2(0.075, 0.05),
    new THREE.Vector2(0.115, 0.14),
    new THREE.Vector2(0.105, 0.21),
    new THREE.Vector2(0.048, 0.26),
    new THREE.Vector2(0.042, 0.31),
    new THREE.Vector2(0.062, 0.34),
    new THREE.Vector2(0.05, 0.345),
  ];

  const vaseProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.06, 0.0),
    new THREE.Vector2(0.095, 0.09),
    new THREE.Vector2(0.088, 0.18),
    new THREE.Vector2(0.045, 0.23),
    new THREE.Vector2(0.068, 0.27),
  ];

  const bowlProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.065, 0.0),
    new THREE.Vector2(0.105, 0.045),
    new THREE.Vector2(0.115, 0.08),
    new THREE.Vector2(0.098, 0.08),
    new THREE.Vector2(0.06, 0.02),
    new THREE.Vector2(0.0, 0.02),
  ];

  const geo = {
    unitBox: trackGeo(new THREE.BoxGeometry(1, 1, 1)),
    unitCyl: trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
    unitCyl8: trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
    unitCyl12: trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 12)),
    unitCone: trackGeo(new THREE.ConeGeometry(0.5, 1, 12)),
    unitCone4: trackGeo(new THREE.ConeGeometry(0.5, 1, 4)),
    unitSphere: trackGeo(new THREE.SphereGeometry(0.5, 12, 10)),
    unitSphereLow: trackGeo(new THREE.SphereGeometry(0.5, 8, 6)),
    ropeCoil: trackGeo(new THREE.TorusGeometry(0.11, 0.032, 8, 16)),
    handleArc: trackGeo(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI)),
    brazierBowl: trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.18, 0.02),
          new THREE.Vector2(0.32, 0.1),
          new THREE.Vector2(0.38, 0.2),
          new THREE.Vector2(0.34, 0.21),
          new THREE.Vector2(0.24, 0.09),
          new THREE.Vector2(0.0, 0.06),
        ],
        16
      )
    ),
    fountainUpperBowl: trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.15, 0.03),
          new THREE.Vector2(0.34, 0.11),
          new THREE.Vector2(0.39, 0.17),
          new THREE.Vector2(0.35, 0.18),
          new THREE.Vector2(0.26, 0.09),
          new THREE.Vector2(0.0, 0.07),
        ],
        16
      )
    ),
    amphora: trackGeo(new THREE.LatheGeometry(amphoraProfile, 14)),
    vase: trackGeo(new THREE.LatheGeometry(vaseProfile, 14)),
    bowl: trackGeo(new THREE.LatheGeometry(bowlProfile, 14)),
    chestLid: trackGeo(new THREE.CylinderGeometry(0.31, 0.31, 0.92, 14, 1, false, 0, Math.PI)),
    chestBandArc: trackGeo(new THREE.TorusGeometry(0.322, 0.026, 6, 14, Math.PI)),
    scrollRoll: trackGeo(new THREE.CylinderGeometry(0.048, 0.048, 0.72, 12)),
    scalePan: trackGeo(new THREE.CylinderGeometry(0.085, 0.045, 0.03, 12)),
  };

  const bundle = {
    mat,
    geo,
    dispose() {
      ownGeometries.forEach((g) => g.dispose());
      ownMaterials.forEach((m) => m.dispose());
      ownTextures.forEach((t) => t.dispose());
    },
  };
  SHARED_CACHE.set(cacheKey, bundle);
  return bundle;
}

/* ============================================================================
 * HELPER TO CREATE SHADOW-ENABLED SUB-MESHES CONCISELY
 * ========================================================================== */
function part(geometry, material, { pos, rot, scale, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) {
    if (Array.isArray(scale)) m.scale.set(scale[0], scale[1], scale[2]);
    else m.scale.setScalar(scale);
  }
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ============================================================================
 * 1. item_01 — RÂTELIER D'OUTILS (Weapons & Tools Rack)
 * Timber A-frame stand holding copper pickaxes, wooden shovels, brass plumb bob & measuring rods
 * ========================================================================== */
function buildToolsRack(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Base skids
  g.add(part(geo.unitBox, mat.timberDark, { pos: [-0.46, 0.04, 0], scale: [0.1, 0.08, 0.62] }));
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0.46, 0.04, 0], scale: [0.1, 0.08, 0.62] }));

  // A-frame sloped legs (left & right pairs)
  [-0.46, 0.46].forEach((x) => {
    g.add(part(geo.unitBox, mat.timber, { pos: [x, 0.56, 0.14], rot: [-0.24, 0, 0], scale: [0.085, 1.08, 0.085] }));
    g.add(part(geo.unitBox, mat.timber, { pos: [x, 0.56, -0.14], rot: [0.24, 0, 0], scale: [0.085, 1.08, 0.085] }));
  });

  // Top ridge beam & middle tool crossbar
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 1.06, 0], scale: [1.14, 0.09, 0.11] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.48, 0.16], scale: [0.96, 0.07, 0.07] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.48, -0.16], scale: [0.96, 0.07, 0.07] }));

  // Bronze corner brackets
  [-0.46, 0.46].forEach((x) => {
    g.add(part(geo.unitBox, mat.bronze, { pos: [x, 1.06, 0], scale: [0.11, 0.11, 0.13] }));
  });

  // Copper Pickaxe #1 leaning on left
  const pick1 = new THREE.Group();
  pick1.position.set(-0.26, 0.52, 0.15);
  pick1.rotation.set(-0.22, 0, 0.12);
  pick1.add(part(geo.unitCyl, mat.timberDark, { pos: [0, 0, 0], scale: [0.055, 0.86, 0.055] }));
  pick1.add(part(geo.unitBox, mat.copper, { pos: [0, 0.36, 0], scale: [0.46, 0.075, 0.075] }));
  pick1.add(part(geo.unitCone, mat.copper, { pos: [-0.26, 0.33, 0], rot: [0, 0, 1.82], scale: [0.075, 0.16, 0.075] }));
  pick1.add(part(geo.unitCone, mat.copper, { pos: [0.26, 0.33, 0], rot: [0, 0, -1.82], scale: [0.075, 0.16, 0.075] }));
  g.add(pick1);

  // Wooden-handled Shovel leaning on right
  const shovel = new THREE.Group();
  shovel.position.set(0.24, 0.5, 0.16);
  shovel.rotation.set(-0.22, 0.1, -0.14);
  shovel.add(part(geo.unitCyl, mat.timber, { pos: [0, 0.06, 0], scale: [0.05, 0.84, 0.05] }));
  shovel.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.48, 0], scale: [0.18, 0.045, 0.045] }));
  shovel.add(part(geo.unitBox, mat.wroughtIron, { pos: [0, -0.34, 0], scale: [0.22, 0.26, 0.03] }));
  g.add(shovel);

  // Hanging Brass Plumb Bob from center ridge
  g.add(part(geo.unitCyl, mat.hempRope, { pos: [0, 0.86, 0.02], scale: [0.014, 0.34, 0.014] }));
  g.add(part(geo.unitCone, mat.goldBright, { pos: [0, 0.65, 0.02], rot: [Math.PI, 0, 0], scale: [0.09, 0.14, 0.09] }));

  // Measuring Rods resting on back crossbar
  g.add(part(geo.unitBox, mat.sandstone, { pos: [-0.08, 0.56, -0.18], rot: [0.22, 0, 0.08], scale: [0.055, 0.96, 0.035] }));
  g.add(part(geo.unitBox, mat.gold, { pos: [0.1, 0.54, -0.18], rot: [0.22, 0, -0.06], scale: [0.05, 0.9, 0.035] }));

  return g;
}

/* ============================================================================
 * 2. item_02 — ÉTABLI DE TAILLEUR (Stonecutter Workbench)
 * Timber legs with cross-beams, thick beveled sandstone tabletop, copper chisels, mallet & shavings
 * ========================================================================== */
function buildStonecutterWorkbench(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Four sturdy timber legs
  const legPos = [
    [-0.46, 0.33, -0.32],
    [0.46, 0.33, -0.32],
    [-0.46, 0.33, 0.32],
    [0.46, 0.33, 0.32],
  ];
  legPos.forEach((p) => {
    g.add(part(geo.unitBox, mat.timberDark, { pos: p, scale: [0.13, 0.66, 0.13] }));
  });

  // Lower cross-beams & tool shelf
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.18, 0.32], scale: [0.96, 0.08, 0.08] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.18, -0.32], scale: [0.96, 0.08, 0.08] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [-0.46, 0.18, 0], scale: [0.08, 0.08, 0.64] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [0.46, 0.18, 0], scale: [0.08, 0.08, 0.64] }));
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.22, 0], scale: [0.84, 0.05, 0.54] }));

  // Thick beveled sandstone tabletop (two-step chamfer)
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.67, 0], scale: [1.14, 0.08, 0.84] }));
  g.add(part(geo.unitBox, mat.sandstone, { pos: [0, 0.77, 0], scale: [1.18, 0.13, 0.88] }));
  g.add(part(geo.unitBox, mat.limestone, { pos: [0, 0.85, 0], scale: [1.1, 0.04, 0.8] }));

  // Work-in-progress carved stone block on left side
  g.add(part(geo.unitBox, mat.sandstone, { pos: [-0.22, 0.98, -0.04], rot: [0, 0.15, 0], scale: [0.34, 0.22, 0.32] }));

  // Wooden Mason Mallet on right
  const mallet = new THREE.Group();
  mallet.position.set(0.32, 0.91, 0.14);
  mallet.rotation.set(0, -0.45, 0);
  mallet.add(part(geo.unitCyl, mat.timber, { pos: [0, 0, 0], rot: [0, 0, Math.PI / 2], scale: [0.055, 0.34, 0.055] }));
  mallet.add(part(geo.unitCyl, mat.timberDark, { pos: [0.14, 0.02, 0], rot: [Math.PI / 2, 0, 0], scale: [0.14, 0.22, 0.14] }));
  g.add(mallet);

  // Two Copper Chisels
  g.add(part(geo.unitCyl, mat.copper, { pos: [0.14, 0.89, -0.18], rot: [0, 0.4, Math.PI / 2], scale: [0.036, 0.26, 0.036] }));
  g.add(part(geo.unitCyl, mat.copper, { pos: [0.26, 0.89, -0.06], rot: [0, -0.25, Math.PI / 2], scale: [0.032, 0.24, 0.032] }));

  // Scattered small stone shavings & chips
  [
    [-0.02, 0.89, 0.22, 0.07],
    [0.06, 0.885, 0.16, 0.05],
    [-0.42, 0.885, 0.18, 0.06],
    [-0.1, 0.885, -0.24, 0.055],
    [0.38, 0.885, -0.22, 0.05],
  ].forEach(([x, y, z, s], i) => {
    g.add(part(geo.unitBox, mat.stoneShaving, { pos: [x, y, z], rot: [0.2 * i, i * 0.9, 0.3], scale: [s, s * 0.55, s * 0.85] }));
  });

  return g;
}

/* ============================================================================
 * 3. item_03 — LIT ROYAL DORÉ (Royal Golden Bed)
 * Carved timber & gold-leaf bedframe, 4 corner finials, linen mattress, royal blanket & bolsters
 * ========================================================================== */
function buildRoyalGoldenBed(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Four carved wooden legs + gold corner posts & lotus finials
  const posts = [
    [-0.58, -0.4],
    [0.58, -0.4],
    [-0.58, 0.4],
    [0.58, 0.4],
  ];
  posts.forEach(([x, z], idx) => {
    const isHead = x < 0;
    const h = isHead ? 0.86 : 0.62;
    g.add(part(geo.unitCyl, mat.timberDark, { pos: [x, h * 0.5, z], scale: [0.1, h, 0.1] }));
    g.add(part(geo.unitCyl, mat.goldBright, { pos: [x, 0.12, z], scale: [0.12, 0.09, 0.12] }));
    g.add(part(geo.unitSphere, mat.goldBright, { pos: [x, h + 0.06, z], scale: [0.14, 0.15, 0.14] }));
    g.add(part(geo.unitCone, mat.gold, { pos: [x, h + 0.15, z], scale: [0.09, 0.09, 0.09] }));
    void idx;
  });

  // Carved gold-trimmed bedframe box
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.28, 0], scale: [1.18, 0.16, 0.82] }));
  g.add(part(geo.unitBox, mat.gold, { pos: [0, 0.22, 0], scale: [1.22, 0.05, 0.86] }));
  g.add(part(geo.unitBox, mat.gold, { pos: [0, 0.35, 0], scale: [1.22, 0.045, 0.86] }));

  // Sculpted arched headboard & footboard
  g.add(part(geo.unitBox, mat.timber, { pos: [-0.58, 0.58, 0], scale: [0.08, 0.46, 0.78] }));
  g.add(part(geo.unitBox, mat.goldBright, { pos: [-0.58, 0.82, 0], scale: [0.1, 0.08, 0.82] }));
  g.add(part(geo.unitSphere, mat.goldBright, { pos: [-0.58, 0.9, 0], scale: [0.11, 0.16, 0.28] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [0.58, 0.48, 0], scale: [0.08, 0.28, 0.78] }));
  g.add(part(geo.unitBox, mat.gold, { pos: [0.58, 0.62, 0], scale: [0.1, 0.06, 0.82] }));

  // Woven linen mattress
  g.add(part(geo.unitBox, mat.linenFabric, { pos: [0, 0.44, 0], scale: [1.08, 0.16, 0.74] }));

  // Folded royal blanket draped over lower 2/3
  g.add(part(geo.unitBox, mat.royalBlanket, { pos: [0.17, 0.48, 0], scale: [0.74, 0.15, 0.78] }));
  g.add(part(geo.unitBox, mat.goldBright, { pos: [-0.2, 0.535, 0], scale: [0.05, 0.05, 0.79] }));

  // Two patterned bolster pillows + plush turquoise accent cushion
  g.add(part(geo.unitCyl, mat.crimsonFabric, { pos: [-0.38, 0.56, -0.18], rot: [Math.PI / 2, 0, 0], scale: [0.16, 0.3, 0.16] }));
  g.add(part(geo.unitCyl, mat.crimsonFabric, { pos: [-0.38, 0.56, 0.18], rot: [Math.PI / 2, 0, 0], scale: [0.16, 0.3, 0.16] }));
  g.add(part(geo.unitBox, mat.turquoiseFabric, { pos: [-0.22, 0.57, 0], rot: [0, 0.1, 0.35], scale: [0.18, 0.12, 0.3] }));

  return g;
}

/* ============================================================================
 * 4. item_04 — TRÔNE DU PHARAON (Egyptian Royal Throne Chair)
 * Sculpted gold-trimmed cedar armchair, curved armrests, carved lotus backrest & turquoise cushion
 * ========================================================================== */
function buildEgyptianThrone(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Low sandstone ceremonial dais step
  g.add(part(geo.unitBox, mat.sandstone, { pos: [0, 0.045, 0.02], scale: [0.92, 0.09, 0.88] }));
  g.add(part(geo.unitBox, mat.gold, { pos: [0, 0.095, 0.02], scale: [0.84, 0.025, 0.8] }));

  // Four lion-paw cedar & gold legs
  [
    [-0.3, 0.27, -0.26],
    [0.3, 0.27, -0.26],
    [-0.3, 0.27, 0.26],
    [0.3, 0.27, 0.26],
  ].forEach((p) => {
    g.add(part(geo.unitBox, mat.timberDark, { pos: p, scale: [0.1, 0.34, 0.1] }));
    g.add(part(geo.unitSphere, mat.goldBright, { pos: [p[0], 0.12, p[2] + 0.03], scale: [0.12, 0.08, 0.14] }));
  });

  // Cedar seat box with gold trim
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.44, 0], scale: [0.7, 0.11, 0.64] }));
  g.add(part(geo.unitBox, mat.goldBright, { pos: [0, 0.44, 0], scale: [0.74, 0.05, 0.68] }));

  // Plush turquoise-and-gold seat cushion
  g.add(part(geo.unitBox, mat.turquoiseFabric, { pos: [0, 0.535, 0.02], scale: [0.6, 0.1, 0.54] }));
  g.add(part(geo.unitBox, mat.goldBright, { pos: [0, 0.55, 0.27], scale: [0.58, 0.03, 0.04] }));

  // High carved cedar & gold lotus backrest
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.9, -0.27], rot: [-0.08, 0, 0], scale: [0.66, 0.86, 0.09] }));
  g.add(part(geo.unitBox, mat.goldBright, { pos: [-0.33, 0.9, -0.27], rot: [-0.08, 0, 0], scale: [0.07, 0.9, 0.11] }));
  g.add(part(geo.unitBox, mat.goldBright, { pos: [0.33, 0.9, -0.27], rot: [-0.08, 0, 0], scale: [0.07, 0.9, 0.11] }));
  // Lotus crown crest at top
  g.add(part(geo.unitCyl, mat.goldBright, { pos: [0, 1.33, -0.3], rot: [0, 0, Math.PI / 2], scale: [0.11, 0.72, 0.11] }));
  g.add(part(geo.unitSphere, mat.turquoiseFabric, { pos: [0, 1.38, -0.28], scale: [0.18, 0.18, 0.1] }));
  g.add(part(geo.unitCone, mat.goldBright, { pos: [-0.18, 1.4, -0.3], rot: [0, 0, 0.35], scale: [0.12, 0.2, 0.09] }));
  g.add(part(geo.unitCone, mat.goldBright, { pos: [0.18, 1.4, -0.3], rot: [0, 0, -0.35], scale: [0.12, 0.2, 0.09] }));
  // Central gold sun emblem on backrest
  g.add(part(geo.unitCyl, mat.goldBright, { pos: [0, 0.92, -0.22], rot: [Math.PI / 2, 0, 0], scale: [0.22, 0.03, 0.22] }));

  // Curved gold-trimmed armrests
  [-0.33, 0.33].forEach((x) => {
    g.add(part(geo.unitBox, mat.timber, { pos: [x, 0.68, 0.02], scale: [0.09, 0.08, 0.58] }));
    g.add(part(geo.unitBox, mat.goldBright, { pos: [x, 0.72, 0.02], scale: [0.11, 0.035, 0.6] }));
    g.add(part(geo.unitBox, mat.timberDark, { pos: [x, 0.56, 0.24], scale: [0.08, 0.22, 0.08] }));
    g.add(part(geo.unitSphere, mat.goldBright, { pos: [x, 0.72, 0.31], scale: [0.11, 0.11, 0.12] }));
  });

  return g;
}

/* ============================================================================
 * 5. item_05 — ÉTAGÈRE D'AMPHORES (Potter & Kiln Shelf)
 * Three-tier rustic timber shelving unit stocked with lathe-turned amphorae, glazed vases & bowls
 * ========================================================================== */
function buildPotterShelf(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Four vertical rustic corner uprights
  [
    [-0.5, 0.64, -0.22],
    [0.5, 0.64, -0.22],
    [-0.5, 0.64, 0.22],
    [0.5, 0.64, 0.22],
  ].forEach((p) => {
    g.add(part(geo.unitBox, mat.timberDark, { pos: p, scale: [0.08, 1.28, 0.08] }));
  });

  // Back slats for depth
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.64, -0.23], scale: [1.02, 1.16, 0.035] }));

  // Three timber shelves + top cornice
  [0.14, 0.52, 0.9, 1.26].forEach((y) => {
    g.add(part(geo.unitBox, mat.timber, { pos: [0, y, 0], scale: [1.08, 0.06, 0.48] }));
  });

  // Helper to spawn a lathe amphora with twin curved handles
  const addAmphora = (x, y, z, material, sc = 1.0) => {
    const ag = new THREE.Group();
    ag.position.set(x, y, z);
    ag.scale.setScalar(sc);
    ag.add(part(geo.amphora, material));
    ag.add(part(geo.handleArc, material, { pos: [-0.075, 0.23, 0], rot: [0, 0, Math.PI * 0.5] }));
    ag.add(part(geo.handleArc, material, { pos: [0.075, 0.23, 0], rot: [0, 0, -Math.PI * 0.5] }));
    g.add(ag);
  };

  // Bottom shelf (y = 0.17): large terracotta amphorae
  addAmphora(-0.3, 0.17, 0.02, mat.terracotta, 0.96);
  addAmphora(0.02, 0.17, -0.02, mat.terracottaDark, 0.9);
  addAmphora(0.32, 0.17, 0.03, mat.glazedOchre, 0.92);

  // Middle shelf (y = 0.55): glazed teal & ochre vases + stacked bowls
  g.add(part(geo.vase, mat.glazedTeal, { pos: [-0.32, 0.55, 0.02], scale: 1.05 }));
  g.add(part(geo.vase, mat.glazedOchre, { pos: [-0.04, 0.55, -0.02], scale: 0.92 }));
  g.add(part(geo.bowl, mat.terracotta, { pos: [0.28, 0.55, 0.02], scale: 1.05 }));
  g.add(part(geo.bowl, mat.glazedTeal, { pos: [0.28, 0.62, 0.02], scale: 0.92 }));
  g.add(part(geo.bowl, mat.terracottaDark, { pos: [0.28, 0.68, 0.02], scale: 0.8 }));

  // Top shelf (y = 0.93): mixed amphora + colorful glazed jars
  addAmphora(-0.26, 0.93, 0, mat.glazedTeal, 0.85);
  g.add(part(geo.vase, mat.terracotta, { pos: [0.04, 0.93, 0.03], scale: 0.95 }));
  addAmphora(0.3, 0.93, -0.02, mat.terracottaDark, 0.82);

  return g;
}

/* ============================================================================
 * 6. item_06 — PUPITRE D'ARCHITECTE (Architect Drafting Table)
 * Tilted wooden drafting board on trestle legs, unrolled papyrus grid scroll, brass compass & inkwell
 * ========================================================================== */
function buildArchitectTable(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Trestle feet & upright legs
  [-0.44, 0.44].forEach((x) => {
    g.add(part(geo.unitBox, mat.timberDark, { pos: [x, 0.05, 0], scale: [0.1, 0.1, 0.72] }));
    g.add(part(geo.unitBox, mat.timber, { pos: [x, 0.42, 0], scale: [0.09, 0.7, 0.1] }));
    // Diagonal braces
    g.add(part(geo.unitBox, mat.timberDark, { pos: [x, 0.3, 0.16], rot: [-0.52, 0, 0], scale: [0.06, 0.42, 0.06] }));
    g.add(part(geo.unitBox, mat.timberDark, { pos: [x, 0.3, -0.16], rot: [0.52, 0, 0], scale: [0.06, 0.42, 0.06] }));
    // Brass gear wheel detail on side
    g.add(part(geo.unitCyl12, mat.bronze, { pos: [x + (x < 0 ? -0.065 : 0.065), 0.74, 0], rot: [0, 0, Math.PI / 2], scale: [0.18, 0.04, 0.18] }));
  });

  // Connecting stretcher bar
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.24, 0], scale: [0.92, 0.08, 0.09] }));

  // Tilted drafting board group
  const board = new THREE.Group();
  board.position.set(0, 0.8, 0);
  board.rotation.x = 0.34;

  board.add(part(geo.unitBox, mat.timber, { pos: [0, 0, 0], scale: [1.14, 0.07, 0.84] }));
  // Bottom pencil ledge
  board.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.05, 0.4], scale: [1.14, 0.05, 0.05] }));

  // Unrolled papyrus scroll with architectural grid lines
  board.add(part(geo.unitBox, mat.papyrus, { pos: [-0.06, 0.042, -0.02], scale: [0.76, 0.012, 0.62] }));
  board.add(part(geo.scrollRoll, mat.linenFabric, { pos: [-0.44, 0.065, -0.02], rot: [Math.PI / 2, 0, 0], scale: [0.95, 0.9, 0.95] }));
  board.add(part(geo.scrollRoll, mat.linenFabric, { pos: [0.32, 0.062, -0.02], rot: [Math.PI / 2, 0, 0], scale: [0.85, 0.9, 0.85] }));

  // Brass compass divider resting on scroll
  board.add(part(geo.unitCyl, mat.goldBright, { pos: [0.12, 0.065, 0.1], rot: [Math.PI / 2, 0, 0.26], scale: [0.022, 0.26, 0.022] }));
  board.add(part(geo.unitCyl, mat.goldBright, { pos: [0.19, 0.065, 0.1], rot: [Math.PI / 2, 0, -0.26], scale: [0.022, 0.26, 0.022] }));
  board.add(part(geo.unitSphere, mat.goldBright, { pos: [0.155, 0.075, -0.02], scale: 0.055 }));

  // Inkwell & reed quill pen on upper right corner
  board.add(part(geo.unitCyl, mat.inkBlack, { pos: [0.44, 0.075, -0.24], scale: [0.09, 0.08, 0.09] }));
  board.add(part(geo.unitCyl, mat.gold, { pos: [0.44, 0.115, -0.24], scale: [0.06, 0.02, 0.06] }));
  board.add(part(geo.unitCyl, mat.linenFabric, { pos: [0.46, 0.19, -0.26], rot: [-0.25, 0, -0.22], scale: [0.02, 0.24, 0.02] }));

  g.add(board);
  return g;
}

/* ============================================================================
 * 7. item_07 — BANC & LANTERNE IMPÉRIALE (Asian Pagoda Lantern & Bench)
 * Curved dark-lacquered wooden bench paired with stone toro lantern & warm glowing paper core
 * ========================================================================== */
function buildPagodaLanternAndBench(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // --- Curved Dark-Lacquered Wooden Garden Bench (left) ---
  const bench = new THREE.Group();
  bench.position.set(-0.24, 0, 0.1);
  bench.rotation.y = 0.22;

  // Legs
  [-0.36, 0.36].forEach((x) => {
    bench.add(part(geo.unitBox, mat.darkLacquer, { pos: [x, 0.19, 0.16], scale: [0.07, 0.38, 0.07] }));
    bench.add(part(geo.unitBox, mat.darkLacquer, { pos: [x, 0.19, -0.16], scale: [0.07, 0.38, 0.07] }));
    // Curved armrest arch
    bench.add(part(geo.unitBox, mat.darkLacquer, { pos: [x, 0.48, 0], scale: [0.065, 0.06, 0.38] }));
    bench.add(part(geo.unitBox, mat.darkLacquer, { pos: [x, 0.4, 0.16], scale: [0.06, 0.16, 0.06] }));
  });

  // Slatted curved seat & crimson cushion
  bench.add(part(geo.unitBox, mat.darkLacquer, { pos: [0, 0.36, 0], scale: [0.84, 0.07, 0.4] }));
  bench.add(part(geo.unitBox, mat.crimsonFabric, { pos: [0, 0.42, 0.01], scale: [0.68, 0.07, 0.3] }));
  bench.add(part(geo.unitBox, mat.gold, { pos: [0, 0.425, 0.155], scale: [0.66, 0.02, 0.02] }));

  // Sculpted pagoda-curve backrest
  bench.add(part(geo.unitBox, mat.darkLacquer, { pos: [0, 0.58, -0.17], rot: [-0.14, 0, 0], scale: [0.82, 0.34, 0.055] }));
  bench.add(part(geo.unitBox, mat.gold, { pos: [0, 0.74, -0.19], rot: [-0.14, 0, 0], scale: [0.86, 0.04, 0.07] }));
  g.add(bench);

  // --- Traditional Stone Toro Pagoda Lantern (right) ---
  const lantern = new THREE.Group();
  lantern.position.set(0.42, 0, -0.16);

  // Hexagonal base, pillar, & fire-box platform
  lantern.add(part(geo.unitCyl8, mat.stoneLantern, { pos: [0, 0.06, 0], scale: [0.4, 0.12, 0.4] }));
  lantern.add(part(geo.unitCyl, mat.stoneLantern, { pos: [0, 0.32, 0], scale: [0.16, 0.44, 0.16] }));
  lantern.add(part(geo.unitCyl8, mat.stoneLantern, { pos: [0, 0.56, 0], scale: [0.36, 0.1, 0.36] }));

  // Glowing warm paper window core inside stone mullions
  const glowMat = mat.paperGlow.clone();
  const paperCore = part(geo.unitCyl8, glowMat, { pos: [0, 0.72, 0], scale: [0.22, 0.24, 0.22], cast: false });
  lantern.add(paperCore);
  // 4 corner stone mullions
  [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((ang) => {
    lantern.add(
      part(geo.unitBox, mat.stoneLantern, {
        pos: [Math.cos(ang) * 0.125, 0.72, Math.sin(ang) * 0.125],
        scale: [0.045, 0.26, 0.045],
      })
    );
  });

  // Tiered pagoda eaves roof + lotus finial
  lantern.add(part(geo.unitCone4, mat.stoneLantern, { pos: [0, 0.94, 0], rot: [0, Math.PI * 0.25, 0], scale: [0.58, 0.22, 0.58] }));
  lantern.add(part(geo.unitCone4, mat.stoneLantern, { pos: [0, 1.1, 0], rot: [0, Math.PI * 0.25, 0], scale: [0.38, 0.16, 0.38] }));
  lantern.add(part(geo.unitSphere, mat.stoneLantern, { pos: [0, 1.2, 0], scale: [0.1, 0.12, 0.1] }));

  // Small moss stone accent at base
  lantern.add(part(geo.unitSphereLow, mat.moss, { pos: [-0.18, 0.05, 0.14], scale: [0.16, 0.08, 0.14] }));
  g.add(lantern);

  // Subtle warm breathing glow animator
  g.userData.animators = [
    (_dt, elapsed) => {
      glowMat.emissiveIntensity = 1.05 + Math.sin(elapsed * 2.8) * 0.18;
    },
  ];
  g.userData.ownMaterials = [glowMat];

  return g;
}

/* ============================================================================
 * 8. item_08 — BRASERO DE PIERRE (Ancient Stone Brazier)
 * Fluted limestone pedestal, wrought-iron fire bowl, glowing flickering embers & rising spark particles
 * ========================================================================== */
function buildAncientBrazier(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Stepped octagonal base
  g.add(part(geo.unitCyl8, mat.limestone, { pos: [0, 0.06, 0], scale: [0.68, 0.12, 0.68] }));
  g.add(part(geo.unitCyl8, mat.sandstone, { pos: [0, 0.16, 0], scale: [0.54, 0.1, 0.54] }));

  // Fluted pedestal column (central drum + 8 stone ribs)
  g.add(part(geo.unitCyl12, mat.limestone, { pos: [0, 0.44, 0], scale: [0.36, 0.48, 0.36] }));
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    g.add(
      part(geo.unitCyl, mat.sandstone, {
        pos: [Math.cos(ang) * 0.18, 0.44, Math.sin(ang) * 0.18],
        scale: [0.06, 0.46, 0.06],
      })
    );
  }
  // Upper stone capital ring
  g.add(part(geo.unitCyl8, mat.sandstone, { pos: [0, 0.71, 0], scale: [0.52, 0.1, 0.52] }));

  // Wrought-iron fire bowl + decorative bronze rim studs
  g.add(part(geo.brazierBowl, mat.wroughtIron, { pos: [0, 0.74, 0], scale: [1.05, 1.05, 1.05] }));
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    g.add(
      part(geo.unitSphereLow, mat.bronze, {
        pos: [Math.cos(ang) * 0.38, 0.9, Math.sin(ang) * 0.38],
        scale: 0.055,
      })
    );
  }

  // Glowing ember mound (cloned material for per-instance flicker)
  const emberMat = mat.emberGlow.clone();
  const emberBed = part(geo.unitSphere, emberMat, { pos: [0, 0.9, 0], scale: [0.58, 0.24, 0.58], cast: false });
  g.add(emberBed);

  // Dark charcoal chunks nestled in the embers
  [
    [-0.14, 0.96, 0.06],
    [0.12, 0.97, -0.08],
    [0.02, 0.99, 0.1],
    [-0.08, 0.97, -0.12],
  ].forEach((p, i) => {
    g.add(part(geo.unitBox, mat.wroughtIron, { pos: p, rot: [i, i * 0.7, 0.4], scale: [0.1, 0.07, 0.09], cast: false }));
  });

  // 6 Rising Spark Particles
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const sp = part(geo.unitSphereLow, mat.sparkMat, { pos: [0, 1.05, 0], scale: 0.048, cast: false, receive: false });
    sp.userData.phase = (i / 6) * Math.PI * 2;
    sp.userData.radius = 0.06 + (i % 3) * 0.055;
    g.add(sp);
    sparks.push(sp);
  }

  g.userData.animators = [
    (_dt, elapsed) => {
      emberMat.emissiveIntensity = 1.25 + Math.sin(elapsed * 7.2) * 0.25 + Math.sin(elapsed * 13.1) * 0.12;
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        const cycle = (elapsed * 0.85 + sp.userData.phase) % 1;
        const ang = elapsed * 1.6 + sp.userData.phase * 2;
        sp.position.set(
          Math.cos(ang) * sp.userData.radius * (1 + cycle * 0.5),
          0.98 + cycle * 0.56,
          Math.sin(ang) * sp.userData.radius * (1 + cycle * 0.5)
        );
        const s = Math.max(0.008, (1 - cycle) * 0.055);
        sp.scale.setScalar(s);
      }
    },
  ];
  g.userData.ownMaterials = [emberMat];

  return g;
}

/* ============================================================================
 * 9. item_09 — ÉTAL DU MARCHAND (Merchant Market Stall)
 * Timber booth counter, 4 posts, scalloped red-and-cream canopy, woven baskets & brass hanging scale
 * ========================================================================== */
function buildMerchantStall(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Wooden booth counter body & counter tabletop
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.25, 0.08], scale: [1.14, 0.5, 0.54] }));
  g.add(part(geo.unitBox, mat.timber, { pos: [0, 0.52, 0.1], scale: [1.22, 0.07, 0.62] }));

  // Four corner posts
  [
    [-0.54, 0.66, -0.28],
    [0.54, 0.66, -0.28],
    [-0.54, 0.58, 0.34],
    [0.54, 0.58, 0.34],
  ].forEach(([x, y, z]) => {
    const h = z < 0 ? 1.32 : 1.16;
    g.add(part(geo.unitBox, mat.timberDark, { pos: [x, y, z], scale: [0.075, h, 0.075] }));
  });

  // Sloped red-and-cream striped fabric canopy + scalloped valance front trim
  const canopy = part(geo.unitBox, mat.marketCanopy, {
    pos: [0, 1.24, 0.04],
    rot: [0.22, 0, 0],
    scale: [1.34, 0.05, 0.86],
  });
  g.add(canopy);
  // Scalloped front awning flaps
  for (let i = 0; i < 6; i++) {
    const fx = -0.52 + i * 0.208;
    g.add(
      part(geo.unitCyl, i % 2 === 0 ? mat.crimsonFabric : mat.linenFabric, {
        pos: [fx, 1.11, 0.44],
        rot: [Math.PI / 2, 0, 0],
        scale: [0.19, 0.035, 0.16],
      })
    );
  }

  // Woven goods baskets & spice mounds on counter
  [
    [-0.36, 0.61, 0.12, mat.glazedOchre],
    [-0.1, 0.61, 0.14, mat.crimsonFabric],
    [0.16, 0.61, 0.12, mat.turquoiseFabric],
  ].forEach(([x, y, z, spiceMat]) => {
    g.add(part(geo.unitCyl, mat.hempRope, { pos: [x, y, z], scale: [0.22, 0.12, 0.22] }));
    g.add(part(geo.unitSphere, spiceMat, { pos: [x, y + 0.06, z], scale: [0.19, 0.09, 0.19] }));
  });

  // Brass Hanging Scale on right side of counter
  const scale = new THREE.Group();
  scale.position.set(0.42, 0.56, 0.14);
  scale.add(part(geo.unitCyl, mat.gold, { pos: [0, 0.02, 0], scale: [0.12, 0.04, 0.12] }));
  scale.add(part(geo.unitCyl, mat.goldBright, { pos: [0, 0.18, 0], scale: [0.024, 0.32, 0.024] }));
  scale.add(part(geo.unitBox, mat.goldBright, { pos: [0, 0.33, 0], scale: [0.26, 0.02, 0.02] }));
  scale.add(part(geo.scalePan, mat.goldBright, { pos: [-0.11, 0.21, 0] }));
  scale.add(part(geo.scalePan, mat.goldBright, { pos: [0.11, 0.21, 0] }));
  g.add(scale);

  return g;
}

/* ============================================================================
 * 10. item_10 — TRAÎNEAU DE BÂTISSEUR (Wooden Desert Transport Sled)
 * Curved wooden runners with dark iron skids, slatted acacia deck, cargo sacks & coiled hemp ropes
 * ========================================================================== */
function buildDesertSled(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Twin curved acacia runners + dark wrought-iron bottom skids
  [-0.34, 0.34].forEach((z) => {
    // Bottom iron skid
    g.add(part(geo.unitBox, mat.wroughtIron, { pos: [0, 0.022, z], scale: [1.14, 0.044, 0.09] }));
    // Wooden runner body
    g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.085, z], scale: [1.12, 0.09, 0.085] }));
    // Upturned curved prow tips at front (+x)
    g.add(part(geo.unitBox, mat.timberDark, { pos: [0.62, 0.15, z], rot: [0, 0, 0.58], scale: [0.24, 0.085, 0.085] }));
    g.add(part(geo.unitBox, mat.wroughtIron, { pos: [0.64, 0.12, z], rot: [0, 0, 0.58], scale: [0.24, 0.038, 0.09] }));
    // Support risers
    [-0.36, 0, 0.36].forEach((x) => {
      g.add(part(geo.unitBox, mat.timber, { pos: [x, 0.16, z], scale: [0.08, 0.09, 0.08] }));
    });
  });

  // Slatted acacia cargo deck
  for (let i = 0; i < 6; i++) {
    const x = -0.45 + i * 0.18;
    g.add(part(geo.unitBox, i % 2 === 0 ? mat.timber : mat.timberDark, { pos: [x, 0.22, 0], scale: [0.14, 0.045, 0.78] }));
  }

  // Side railing pegs
  [-0.36, 0.36].forEach((z) => {
    g.add(part(geo.unitBox, mat.timber, { pos: [-0.04, 0.33, z], scale: [0.92, 0.05, 0.05] }));
    [-0.44, 0.38].forEach((x) => {
      g.add(part(geo.unitBox, mat.bronze, { pos: [x, 0.28, z], scale: [0.06, 0.14, 0.06] }));
    });
  });

  // Supply sacks & tied limestone cargo
  g.add(part(geo.unitSphere, mat.sackCloth, { pos: [-0.22, 0.36, -0.12], scale: [0.42, 0.26, 0.32] }));
  g.add(part(geo.unitSphere, mat.sackCloth, { pos: [-0.14, 0.36, 0.14], scale: [0.38, 0.25, 0.3] }));
  g.add(part(geo.unitSphere, mat.linenFabric, { pos: [-0.18, 0.5, 0.0], scale: [0.34, 0.2, 0.28] }));

  // Coiled hemp pulling rope at front + tow bar
  g.add(part(geo.unitCyl, mat.timberDark, { pos: [0.68, 0.2, 0], rot: [Math.PI / 2, 0, 0], scale: [0.045, 0.72, 0.045] }));
  g.add(part(geo.ropeCoil, mat.hempRope, { pos: [0.28, 0.275, 0.02], rot: [Math.PI / 2, 0, 0], scale: [1.15, 1.15, 1.15] }));
  g.add(part(geo.ropeCoil, mat.hempRope, { pos: [0.28, 0.325, 0.02], rot: [Math.PI / 2, 0, 0.4], scale: [0.95, 0.95, 0.95] }));

  return g;
}

/* ============================================================================
 * 11. item_11 — COFFRE DU TRÉSOR ROYAL (Ornate Treasure Chest)
 * Rounded barrel-lid oak chest reinforced with hammered bronze straps, rivets & glowing golden lock
 * ========================================================================== */
function buildTreasureChest(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Oak base chest body
  g.add(part(geo.unitBox, mat.timberDark, { pos: [0, 0.24, 0], scale: [0.92, 0.44, 0.6] }));
  // Corner wooden feet
  [
    [-0.42, 0.035, -0.26],
    [0.42, 0.035, -0.26],
    [-0.42, 0.035, 0.26],
    [0.42, 0.035, 0.26],
  ].forEach((p) => {
    g.add(part(geo.unitBox, mat.bronze, { pos: p, scale: [0.12, 0.07, 0.12] }));
  });

  // Rounded barrel-lid oak half-cylinder
  const lid = part(geo.chestLid, mat.timber, {
    pos: [0, 0.46, 0],
    rot: [0, 0, Math.PI / 2],
    scale: [1, 1, 1],
  });
  g.add(lid);

  // Hammered bronze vertical reinforcement straps & arched lid bands
  [-0.38, 0, 0.38].forEach((x) => {
    g.add(part(geo.unitBox, mat.bronze, { pos: [x, 0.25, 0], scale: [0.075, 0.46, 0.64] }));
    g.add(part(geo.chestBandArc, mat.bronze, { pos: [x, 0.46, 0], rot: [0, Math.PI / 2, 0] }));
    // Decorative brass rivets on front face
    g.add(part(geo.unitSphereLow, mat.goldBright, { pos: [x, 0.14, 0.325], scale: 0.04 }));
    g.add(part(geo.unitSphereLow, mat.goldBright, { pos: [x, 0.34, 0.325], scale: 0.04 }));
  });

  // Horizontal bronze seam rim
  g.add(part(geo.unitBox, mat.bronze, { pos: [0, 0.455, 0], scale: [0.96, 0.06, 0.65] }));

  // Glowing golden runic lock plate on front
  const lockMat = mat.lockGlow.clone();
  const lockPlate = part(geo.unitBox, lockMat, { pos: [0, 0.42, 0.34], scale: [0.18, 0.22, 0.05] });
  g.add(lockPlate);
  g.add(part(geo.unitBox, mat.wroughtIron, { pos: [0, 0.41, 0.368], scale: [0.035, 0.08, 0.02] }));

  g.userData.animators = [
    (_dt, elapsed) => {
      lockMat.emissiveIntensity = 0.65 + Math.sin(elapsed * 3.4) * 0.35;
    },
  ];
  g.userData.ownMaterials = [lockMat];

  return g;
}

/* ============================================================================
 * 12. item_12 — FONTAINE DE L'OASIS (Roman Marble Fountain)
 * Octagonal carved white marble basin, central column, upper bowl, animated turquoise water & streams
 * ========================================================================== */
function buildRomanFountain(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Octagonal carved white marble lower basin outer wall + recessed base
  g.add(part(geo.unitCyl8, mat.whiteMarble, { pos: [0, 0.05, 0], scale: [1.34, 0.1, 1.34] }));
  // 8 sculpted marble coping rim blocks forming true octagonal basin walls
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.add(
      part(geo.unitBox, mat.whiteMarble, {
        pos: [Math.cos(ang) * 0.56, 0.21, Math.sin(ang) * 0.56],
        rot: [0, -ang + Math.PI / 2, 0],
        scale: [0.5, 0.24, 0.12],
      })
    );
    g.add(
      part(geo.unitBox, mat.whiteMarble, {
        pos: [Math.cos(ang) * 0.57, 0.34, Math.sin(ang) * 0.57],
        rot: [0, -ang + Math.PI / 2, 0],
        scale: [0.52, 0.05, 0.16],
      })
    );
  }

  // Animated translucent turquoise lower water surface
  const lowerWater = part(geo.unitCyl8, mat.fountainWater, {
    pos: [0, 0.26, 0],
    scale: [1.08, 0.05, 1.08],
    cast: false,
  });
  g.add(lowerWater);

  // Central carved marble pedestal column
  g.add(part(geo.unitCyl8, mat.whiteMarble, { pos: [0, 0.48, 0], scale: [0.34, 0.58, 0.34] }));
  g.add(part(geo.unitCyl12, mat.whiteMarble, { pos: [0, 0.52, 0], scale: [0.24, 0.62, 0.24] }));

  // Middle carved bowl + turquoise water pool
  g.add(part(geo.fountainUpperBowl, mat.whiteMarble, { pos: [0, 0.72, 0], scale: [1.05, 1.0, 1.05] }));
  const midWater = part(geo.unitCyl12, mat.fountainWater, {
    pos: [0, 0.86, 0],
    scale: [0.68, 0.035, 0.68],
    cast: false,
  });
  g.add(midWater);

  // Top marble finial spout + gold accent collar
  g.add(part(geo.unitCyl, mat.whiteMarble, { pos: [0, 1.02, 0], scale: [0.16, 0.28, 0.16] }));
  g.add(part(geo.unitSphere, mat.goldBright, { pos: [0, 1.18, 0], scale: [0.14, 0.16, 0.14] }));

  // 4 Gentle Falling Water Streams cascading from middle bowl to lower basin
  const streams = [];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const st = part(geo.unitCyl, mat.waterStream, {
      pos: [Math.cos(ang) * 0.36, 0.56, Math.sin(ang) * 0.36],
      rot: [Math.sin(ang) * 0.16, 0, -Math.cos(ang) * 0.16],
      scale: [0.045, 0.58, 0.045],
      cast: false,
      receive: false,
    });
    g.add(st);
    streams.push(st);
  }

  // Top fountain plume droplets
  const plume = part(geo.unitSphere, mat.waterStream, {
    pos: [0, 1.28, 0],
    scale: [0.16, 0.14, 0.16],
    cast: false,
    receive: false,
  });
  g.add(plume);

  g.userData.animators = [
    (_dt, elapsed) => {
      lowerWater.position.y = 0.258 + Math.sin(elapsed * 3.1) * 0.008;
      midWater.position.y = 0.858 + Math.sin(elapsed * 3.8 + 1.0) * 0.006;
      plume.scale.set(
        0.15 + Math.sin(elapsed * 6.5) * 0.025,
        0.14 + Math.cos(elapsed * 7.2) * 0.03,
        0.15 + Math.sin(elapsed * 6.5) * 0.025
      );
      for (let i = 0; i < streams.length; i++) {
        const pulse = 0.042 + Math.sin(elapsed * 8.0 + i * 1.5) * 0.008;
        streams[i].scale.x = pulse;
        streams[i].scale.z = pulse;
      }
    },
  ];

  return g;
}

/* ============================================================================
 * 13. item_13 — LANTERNE EN FER FORGÉ (1800s Wrought-Iron Penitentiary Street Lantern)
 * Carved granite base, fluted matte-black iron lamppost, scrolled bracket,
 * hexagonal wrought-iron cage, and gently flickering warm oil flame
 * ========================================================================== */
function buildWroughtIronLantern(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Stepped grey granite plinth base
  g.add(part(geo.unitBox, mat.limestone, { pos: [0, 0.08, 0], scale: [0.56, 0.16, 0.56] }));
  g.add(part(geo.unitBox, mat.limestone, { pos: [0, 0.2, 0], scale: [0.42, 0.12, 0.42] }));

  // Fluted wrought-iron lamppost column + collar moldings
  g.add(part(geo.unitCyl8, mat.wroughtIron, { pos: [0, 0.34, 0], scale: [0.22, 0.18, 0.22] }));
  g.add(part(geo.unitCyl8, mat.wroughtIron, { pos: [0, 0.86, 0], scale: [0.1, 0.96, 0.1] }));
  g.add(part(geo.unitCyl8, mat.wroughtIron, { pos: [0, 0.62, 0], scale: [0.15, 0.05, 0.15] }));
  g.add(part(geo.unitSphere, mat.wroughtIron, { pos: [0, 1.38, 0], scale: [0.14, 0.16, 0.14] }));

  // Forged horizontal bracket arm + scrolled brace
  g.add(part(geo.unitBox, mat.wroughtIron, { pos: [0.2, 1.24, 0], scale: [0.44, 0.045, 0.045] }));
  g.add(part(geo.unitBox, mat.wroughtIron, { pos: [0.14, 1.12, 0], rot: [0, 0, 0.62], scale: [0.3, 0.035, 0.035] }));

  // Hanging hexagonal wrought-iron lantern cage + glowing amber oil glass
  const lantern = new THREE.Group();
  lantern.position.set(0.36, 1.0, 0);
  lantern.add(part(geo.unitCyl8, mat.wroughtIron, { pos: [0, 0.21, 0], scale: [0.028, 0.09, 0.028] }));
  lantern.add(part(geo.unitCone, mat.wroughtIron, { pos: [0, 0.13, 0], scale: [0.3, 0.14, 0.3] }));

  const flameMat = mat.paperGlow.clone();
  g.userData.ownMaterials = [flameMat];
  const glass = part(geo.unitCyl8, flameMat, { pos: [0, -0.02, 0], scale: [0.2, 0.22, 0.2], cast: false });
  lantern.add(glass);

  // 4 forged vertical iron corner bars around the glass
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    lantern.add(
      part(geo.unitCyl8, mat.wroughtIron, {
        pos: [Math.cos(a) * 0.115, -0.02, Math.sin(a) * 0.115],
        scale: [0.022, 0.24, 0.022],
      })
    );
  }
  lantern.add(part(geo.unitCone, mat.wroughtIron, { pos: [0, -0.17, 0], rot: [Math.PI, 0, 0], scale: [0.24, 0.1, 0.24] }));
  g.add(lantern);

  g.userData.animators = [
    (_dt, elapsed) => {
      flameMat.emissiveIntensity = 1.05 + Math.sin(elapsed * 7.2) * 0.2 + Math.cos(elapsed * 11.4) * 0.1;
      lantern.rotation.z = Math.sin(elapsed * 1.9) * 0.04;
    },
  ];

  return g;
}

/* ============================================================================
 * 14. item_14 — CHARIOT EN BOIS XIXe (1800s Two-Wheeled Wooden Site Handcart)
 * Weathered timber slatted cargo bed, iron corner bands, twin spoked wooden wheels
 * with iron tires, rear push handles, resting legs, and cut granite + dark brick load
 * ========================================================================== */
function buildWoodenHandcart(A) {
  const g = new THREE.Group();
  const { geo, mat } = A;

  // Twin spoked wooden wheels with black wrought-iron rims
  const wheelOffsets = [-0.4, 0.4];
  wheelOffsets.forEach((wz) => {
    const wheel = new THREE.Group();
    wheel.position.set(0.14, 0.28, wz);
    // Iron tire rim + wooden felloe
    wheel.add(part(geo.ropeCoil, mat.wroughtIron, { scale: [2.45, 2.45, 1.35] }));
    wheel.add(part(geo.ropeCoil, mat.timberDark, { scale: [2.15, 2.15, 1.1] }));
    // Wooden hub & 4 diametric spokes (8 spokes total)
    wheel.add(part(geo.unitCyl8, mat.wroughtIron, { rot: [Math.PI / 2, 0, 0], scale: [0.11, 0.1, 0.11] }));
    for (let s = 0; s < 4; s++) {
      wheel.add(
        part(geo.unitBox, mat.timber, {
          rot: [0, 0, (s * Math.PI) / 4],
          scale: [0.46, 0.036, 0.032],
        })
      );
    }
    g.add(wheel);
  });

  // Iron axle spanning both wheels
  g.add(part(geo.unitCyl8, mat.wroughtIron, { pos: [0.14, 0.28, 0], rot: [Math.PI / 2, 0, 0], scale: [0.055, 0.88, 0.055] }));

  // Slatted weathered timber cargo box tilted subtly toward handles
  const body = new THREE.Group();
  body.position.set(0.06, 0.42, 0);
  body.rotation.z = -0.06;

  // Floor & 4 wooden side boards
  body.add(part(geo.unitBox, mat.timber, { pos: [0, 0, 0], scale: [0.88, 0.07, 0.64] }));
  body.add(part(geo.unitBox, mat.timber, { pos: [0, 0.16, -0.3], scale: [0.92, 0.28, 0.06] }));
  body.add(part(geo.unitBox, mat.timber, { pos: [0, 0.16, 0.3], scale: [0.92, 0.28, 0.06] }));
  body.add(part(geo.unitBox, mat.timberDark, { pos: [0.44, 0.16, 0], scale: [0.06, 0.28, 0.64] }));
  body.add(part(geo.unitBox, mat.timberDark, { pos: [-0.44, 0.16, 0], scale: [0.06, 0.28, 0.64] }));

  // Forged iron corner straps
  [
    [-0.44, -0.3],
    [0.44, -0.3],
    [-0.44, 0.3],
    [0.44, 0.3],
  ].forEach(([cx, cz]) => {
    body.add(part(geo.unitBox, mat.wroughtIron, { pos: [cx, 0.16, cz], scale: [0.08, 0.3, 0.08] }));
  });

  // Rear push handles extending left (-X)
  [-0.24, 0.24].forEach((hz) => {
    body.add(part(geo.unitCyl8, mat.timberDark, { pos: [-0.66, 0.04, hz], rot: [0, 0, Math.PI / 2], scale: [0.055, 0.56, 0.055] }));
  });

  // Resting support legs under rear bed
  [-0.24, 0.24].forEach((lz) => {
    body.add(part(geo.unitBox, mat.timberDark, { pos: [-0.34, -0.2, lz], rot: [0, 0, -0.14], scale: [0.055, 0.38, 0.055] }));
  });

  // Miniature cargo: cut grey granite block + 2 dark red bricks
  body.add(part(geo.unitBox, mat.limestone, { pos: [-0.14, 0.18, -0.05], rot: [0, 0.08, 0], scale: [0.34, 0.24, 0.32] }));
  body.add(part(geo.unitBox, mat.crimsonFabric, { pos: [0.2, 0.15, 0.08], rot: [0, -0.12, 0], scale: [0.28, 0.16, 0.22] }));
  body.add(part(geo.unitBox, mat.crimsonFabric, { pos: [0.16, 0.28, -0.04], rot: [0, 0.2, 0], scale: [0.26, 0.14, 0.2] }));

  g.add(body);
  return g;
}

/* ============================================================================
 * PUBLIC FACTORY & PER-FRAME ANIMATION HOOK
 * ========================================================================== */
const BUILDERS = {
  item_01: buildToolsRack,
  item_02: buildStonecutterWorkbench,
  item_03: buildRoyalGoldenBed,
  item_04: buildEgyptianThrone,
  item_05: buildPotterShelf,
  item_06: buildArchitectTable,
  item_07: buildPagodaLanternAndBench,
  item_08: buildAncientBrazier,
  item_09: buildMerchantStall,
  item_10: buildDesertSled,
  item_11: buildTreasureChest,
  item_12: buildRomanFountain,
  item_13: buildWroughtIronLantern,
  item_14: buildWoodenHandcart,
};

const WORLD_SCALES = {
  item_01: 1.05,
  item_02: 1.08,
  item_03: 1.05,
  item_04: 1.02,
  item_05: 1.02,
  item_06: 1.06,
  item_07: 1.05,
  item_08: 1.04,
  item_09: 1.06,
  item_10: 1.08,
  item_11: 1.05,
  item_12: 1.05,
  item_13: 1.08,
  item_14: 1.08,
};

/**
 * Creates a detailed multi-part procedural 3D furniture Three.js Group with ground pivot at y = 0.
 * Shares geometry & PBR materials across identical placed items for 60 FPS on iPhone 16e Safari.
 */
export function createFurniture3D(itemId, textures) {
  const assets = getSharedAssets(textures);
  const builder = BUILDERS[itemId] || BUILDERS.item_01;
  const model = builder(assets);
  const sc = WORLD_SCALES[itemId] || 1.0;
  model.scale.setScalar(sc);
  model.userData.itemId = itemId;
  return model;
}

/**
 * Updates per-frame ambient animations (brazier embers & sparks, fountain water, lantern glow, lock glint).
 */
export function updateFurniture3D(group, dt, elapsed) {
  if (!group || !group.userData || !group.userData.animators) return;
  const anims = group.userData.animators;
  for (let i = 0; i < anims.length; i++) {
    anims[i](dt, elapsed);
  }
}

/**
 * Disposes any per-instance cloned emissive materials on a removed furniture Group
 * (without disposing the shared cached geometries/materials used by other instances).
 */
export function disposeFurniture3DInstance(group) {
  if (!group || !group.userData || !group.userData.ownMaterials) return;
  group.userData.ownMaterials.forEach((m) => m.dispose());
  group.userData.ownMaterials.length = 0;
}

/**
 * Disposes all shared cached furniture geometries, materials, and textures for a textures bundle.
 */
export function disposeFurnitureSharedAssets(textures) {
  const cacheKey = textures || SHARED_CACHE;
  const bundle = SHARED_CACHE.get(cacheKey);
  if (bundle) {
    bundle.dispose();
    SHARED_CACHE.delete(cacheKey);
  }
}
