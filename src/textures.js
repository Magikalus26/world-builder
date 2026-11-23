/**
 * Workd Builder — Procedural HTML5 Canvas Texture & Material Generator
 * Produces stylized tactile low-poly/diorama textures with zero external image files.
 */

import * as THREE from 'three';

function makeCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createTexture(canvas, { repeat = [1, 1], isColor = true, anisotropy = 4 } = {}) {
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

/** Warm golden desert sand with subtle wind-swept ripples */
function buildDesertSand(anisotropy) {
  const size = 512;
  const colorCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = colorCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRand(101);

  // Seamless uniform warm desert sand base (no edge discontinuity when tiled)
  ctx.fillStyle = '#e3bf7c';
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Seamless periodic wind ripples
  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin((y / size) * Math.PI * 12);
    const alpha = (wave + 1) * 0.5;
    ctx.fillStyle = wave > 0
      ? `rgba(255, 242, 206, ${alpha * 0.1})`
      : `rgba(176, 122, 58, ${(1 - alpha) * 0.09})`;
    ctx.fillRect(0, y, size, 2);

    const bVal = Math.floor(128 + wave * 30);
    bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bctx.fillRect(0, y, size, 2);
  }

  // Soft curved wind ridges
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.12)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 18; i++) {
    const y0 = (i / 18) * size;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const y = y0 + Math.sin((x / size) * Math.PI * 2 + i * 0.6) * 8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fine quartz & ochre mineral grain
  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.7 + rand() * 1.4;
    const bright = rand() > 0.45;
    ctx.fillStyle = bright
      ? `rgba(255, 246, 224, ${0.12 + rand() * 0.18})`
      : `rgba(148, 100, 44, ${0.1 + rand() * 0.16})`;
    ctx.fillRect(x, y, r, r);

    const bv = bright ? 162 : 98;
    bctx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    bctx.fillRect(x, y, r, r);
  }

  return {
    map: createTexture(colorCanvas, { repeat: [4, 4], isColor: true, anisotropy }),
    bumpMap: createTexture(bumpCanvas, { repeat: [4, 4], isColor: false, anisotropy }),
  };
}

/** Layered geological sandstone strata for diorama plinth edge */
function buildPlinthStrata(anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rand = seededRand(202);

  const bands = [
    { y: 0, h: 46, color: '#cfa162' },
    { y: 46, h: 52, color: '#b78349' },
    { y: 98, h: 48, color: '#9c6b3b' },
    { y: 146, h: 56, color: '#825731' },
    { y: 202, h: 54, color: '#6b4628' },
  ];

  bands.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, b.y, size, b.h);
  });

  // Subtle sedimentary streaks
  for (let i = 0; i < 40; i++) {
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,232,190,0.09)' : 'rgba(54,30,12,0.12)';
    ctx.fillRect(0, y, size, 2 + rand() * 4);
  }

  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,240,210,0.08)' : 'rgba(40,22,10,0.12)';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }

  return createTexture(canvas, { repeat: [3, 1], isColor: true, anisotropy });
}

/** Rough grey-beige quarry limestone */
function buildQuarryLimestone(anisotropy) {
  const size = 256;
  const colorCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = colorCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRand(303);

  ctx.fillStyle = '#b4aa97';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Mottled rocky mineral blotches
  for (let i = 0; i < 85; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 18 + rand() * 48;
    const h = 10 + rand() * 26;
    const shade = Math.floor(148 + rand() * 48);
    ctx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 22}, 0.28)`;
    ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);

    const bv = Math.floor(95 + rand() * 75);
    bctx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    bctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
  }

  // Sedimentary fracture seams
  for (let i = 0; i < 16; i++) {
    const y0 = rand() * size;
    ctx.strokeStyle = 'rgba(72, 63, 50, 0.34)';
    ctx.lineWidth = 1.2 + rand() * 1.6;
    bctx.strokeStyle = 'rgba(35, 35, 35, 0.7)';
    bctx.lineWidth = 2;

    ctx.beginPath();
    bctx.beginPath();
    let cx = rand() * size * 0.3;
    let cy = y0;
    ctx.moveTo(cx, cy);
    bctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += 18 + rand() * 34;
      cy += (rand() - 0.5) * 14;
      ctx.lineTo(cx, cy);
      bctx.lineTo(cx, cy);
    }
    ctx.stroke();
    bctx.stroke();
  }

  // Chalky speckles
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright ? 'rgba(235, 228, 212, 0.22)' : 'rgba(84, 76, 62, 0.2)';
    ctx.fillRect(x, y, 2, 2);
  }

  return {
    map: createTexture(colorCanvas, { repeat: [1, 1], isColor: true, anisotropy }),
    bumpMap: createTexture(bumpCanvas, { repeat: [1, 1], isColor: false, anisotropy }),
  };
}

/** Transitional chisel carving texture (stage 1 or stage 2) */
function buildCarvingStageTexture(stage, anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rand = seededRand(stage === 1 ? 401 : 402);

  // Stage 1: mostly rough limestone revealing warm sandstone core
  // Stage 2: mostly golden sandstone with diagonal chisel dress marks
  ctx.fillStyle = stage === 1 ? '#c6b38e' : '#dfb973';
  ctx.fillRect(0, 0, size, size);

  // Outer rough rim or emerging bevel
  const pad = stage === 1 ? 18 : 14;
  ctx.strokeStyle = stage === 1 ? 'rgba(120, 108, 90, 0.48)' : 'rgba(164, 114, 42, 0.52)';
  ctx.lineWidth = stage === 1 ? 14 : 10;
  ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);

  // Diagonal hand-chisel marks
  const strokes = stage === 1 ? 36 : 54;
  for (let i = 0; i < strokes; i++) {
    const x = 18 + rand() * (size - 36);
    const y = 18 + rand() * (size - 36);
    const len = 14 + rand() * 24;
    ctx.strokeStyle = rand() > 0.45
      ? 'rgba(255, 240, 200, 0.34)'
      : 'rgba(130, 92, 42, 0.28)';
    ctx.lineWidth = stage === 1 ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.7, y + len * 0.7);
    ctx.stroke();
  }

  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,244,218,0.18)' : 'rgba(122,88,42,0.15)';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }

  return createTexture(canvas, { repeat: [1, 1], isColor: true, anisotropy });
}

/** Carved golden beveled sandstone with subtle stylized hieroglyphic trim */
function buildCarvedSandstone(anisotropy) {
  const size = 256;
  const colorCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = colorCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRand(505);

  // Warm sunlit golden sandstone base
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#f0cc82');
  grad.addColorStop(0.5, '#e5b864');
  grad.addColorStop(1, '#d6a24c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, size, size);

  // Sculpted outer bevel border
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#c48f3c';
  ctx.strokeRect(5, 5, size - 10, size - 10);

  // Highlighted top/left chamfer & shaded bottom/right chamfer
  ctx.strokeStyle = 'rgba(255, 245, 214, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(12, size - 12);
  ctx.lineTo(12, 12);
  ctx.lineTo(size - 12, 12);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(138, 92, 30, 0.45)';
  ctx.beginPath();
  ctx.moveTo(size - 12, 12);
  ctx.lineTo(size - 12, size - 12);
  ctx.lineTo(12, size - 12);
  ctx.stroke();

  // Bump bevel recess
  bctx.strokeStyle = '#404040';
  bctx.lineWidth = 8;
  bctx.strokeRect(8, 8, size - 16, size - 16);

  // Subtle carved hieroglyphic trim frieze along upper/lower inner band
  const drawFrieze = (yCenter) => {
    ctx.strokeStyle = 'rgba(154, 103, 38, 0.42)';
    ctx.fillStyle = 'rgba(154, 103, 38, 0.36)';
    ctx.lineWidth = 2;

    bctx.strokeStyle = '#555555';
    bctx.lineWidth = 2;

    // Horizontal trim guide rules
    ctx.beginPath();
    ctx.moveTo(24, yCenter - 11);
    ctx.lineTo(size - 24, yCenter - 11);
    ctx.moveTo(24, yCenter + 11);
    ctx.lineTo(size - 24, yCenter + 11);
    ctx.stroke();

    bctx.beginPath();
    bctx.moveTo(24, yCenter - 11);
    bctx.lineTo(size - 24, yCenter - 11);
    bctx.moveTo(24, yCenter + 11);
    bctx.lineTo(size - 24, yCenter + 11);
    bctx.stroke();

    // Repeating geometric motifs: solar disk, diamond cartouche, ankh-like cross, wave
    for (let x = 38; x <= size - 38; x += 36) {
      const idx = Math.floor(x / 36) % 3;
      if (idx === 0) {
        // Solar disk
        ctx.beginPath();
        ctx.arc(x, yCenter, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, yCenter, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (idx === 1) {
        // Stylized Ankh motif
        ctx.beginPath();
        ctx.arc(x, yCenter - 3.5, 3, 0, Math.PI * 2);
        ctx.moveTo(x, yCenter - 0.5);
        ctx.lineTo(x, yCenter + 6.5);
        ctx.moveTo(x - 4.5, yCenter + 1.5);
        ctx.lineTo(x + 4.5, yCenter + 1.5);
        ctx.stroke();
      } else {
        // Diamond reed motif
        ctx.beginPath();
        ctx.moveTo(x, yCenter - 6);
        ctx.lineTo(x + 5, yCenter);
        ctx.lineTo(x, yCenter + 6);
        ctx.lineTo(x - 5, yCenter);
        ctx.closePath();
        ctx.stroke();
      }
    }
  };

  drawFrieze(40);
  drawFrieze(size - 40);

  // Fine sandstone mineral grain
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const light = rand() > 0.48;
    ctx.fillStyle = light ? 'rgba(255, 246, 218, 0.16)' : 'rgba(135, 92, 34, 0.12)';
    ctx.fillRect(x, y, 1.8, 1.8);
  }

  return {
    map: createTexture(colorCanvas, { repeat: [1, 1], isColor: true, anisotropy }),
    bumpMap: createTexture(bumpCanvas, { repeat: [1, 1], isColor: false, anisotropy }),
  };
}

/** Burnished engraved gold texture for the 55th Pyramidion Capstone */
function buildGoldenCapstone(anisotropy) {
  const size = 256;
  const colorCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = colorCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#fff2b0');
  grad.addColorStop(0.35, '#ffd452');
  grad.addColorStop(0.75, '#e6a825');
  grad.addColorStop(1, '#c48316');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Subtle brushed metal sheen lines
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,230,0.09)' : 'rgba(140,88,10,0.06)';
    ctx.fillRect(0, y, size, 1.5);
  }

  // Engraved solar emblem & royal bands
  ctx.strokeStyle = 'rgba(138, 82, 8, 0.55)';
  ctx.lineWidth = 3;
  bctx.strokeStyle = '#383838';
  bctx.lineWidth = 3;

  // Sun disk centered on face
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.58, 26, 0, Math.PI * 2);
  ctx.stroke();
  bctx.beginPath();
  bctx.arc(size * 0.5, size * 0.58, 26, 0, Math.PI * 2);
  bctx.stroke();

  // Horizontal base trim
  [size - 28, size - 16].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    bctx.beginPath();
    bctx.moveTo(0, y);
    bctx.lineTo(size, y);
    bctx.stroke();
  });

  return {
    map: createTexture(colorCanvas, { repeat: [1, 1], isColor: true, anisotropy }),
    bumpMap: createTexture(bumpCanvas, { repeat: [1, 1], isColor: false, anisotropy }),
  };
}

/** Weathered acacia/cedar timber planks */
function buildTimberPlanks(anisotropy) {
  const size = 256;
  const colorCanvas = makeCanvas(size);
  const bumpCanvas = makeCanvas(size);
  const ctx = colorCanvas.getContext('2d');
  const bctx = bumpCanvas.getContext('2d');
  const rand = seededRand(606);

  ctx.fillStyle = '#8d5d36';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#888888';
  bctx.fillRect(0, 0, size, size);

  const plankCount = 4;
  const plankH = size / plankCount;

  for (let p = 0; p < plankCount; p++) {
    const y0 = p * plankH;
    const toneShift = (p % 2 === 0 ? 1 : -1) * 8;
    ctx.fillStyle = `rgb(${144 + toneShift}, ${96 + toneShift}, ${55 + Math.floor(toneShift * 0.5)})`;
    ctx.fillRect(0, y0, size, plankH - 3);

    // Wood grain streaks
    for (let g = 0; g < 22; g++) {
      const gy = y0 + 4 + rand() * (plankH - 10);
      ctx.strokeStyle = rand() > 0.45
        ? 'rgba(210, 165, 114, 0.22)'
        : 'rgba(66, 38, 18, 0.25)';
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        size * 0.33, gy + (rand() - 0.5) * 6,
        size * 0.66, gy + (rand() - 0.5) * 6,
        size, gy
      );
      ctx.stroke();
    }

    // Plank dark seam
    ctx.fillStyle = '#472a13';
    ctx.fillRect(0, y0 + plankH - 3, size, 3);
    bctx.fillStyle = '#252525';
    bctx.fillRect(0, y0 + plankH - 3, size, 3);

    // Peg / nail dots near ends
    ctx.fillStyle = '#3b2412';
    [18, size - 18].forEach((nx) => {
      ctx.beginPath();
      ctx.arc(nx, y0 + plankH * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return {
    map: createTexture(colorCanvas, { repeat: [1, 1], isColor: true, anisotropy }),
    bumpMap: createTexture(bumpCanvas, { repeat: [1, 1], isColor: false, anisotropy }),
  };
}

/** Woven warm desert sunshade canopy fabric */
function buildCanopyCloth(anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  // Alternating warm cream & terracotta desert stripes
  const stripes = 8;
  const w = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f1dfc0' : '#c65d3b';
    ctx.fillRect(i * w, 0, w, size);
  }

  // Subtle woven linen crosshatch
  ctx.fillStyle = 'rgba(70, 38, 18, 0.08)';
  for (let y = 0; y < size; y += 6) {
    ctx.fillRect(0, y, size, 2);
  }
  for (let x = 0; x < size; x += 6) {
    ctx.fillRect(x, 0, 1.5, size);
  }

  return createTexture(canvas, { repeat: [1, 1], isColor: true, anisotropy });
}

/** Glowing chalk blueprint grid for active pyramid ghost slots */
function buildBlueprintGrid(anisotropy) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  // Translucent cerulean-gold drafting wash
  ctx.fillStyle = 'rgba(64, 182, 224, 0.24)';
  ctx.fillRect(0, 0, size, size);

  // Subtle interior drafting grid
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

  // Crisp chalk outer border
  ctx.strokeStyle = 'rgba(240, 252, 255, 0.92)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  // Dashed inner chalk frame
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 244, 200, 0.85)';
  ctx.strokeRect(24, 24, size - 48, size - 48);
  ctx.setLineDash([]);

  // Center crosshair registration mark
  ctx.strokeStyle = 'rgba(255, 252, 232, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(size * 0.5 - 16, size * 0.5);
  ctx.lineTo(size * 0.5 + 16, size * 0.5);
  ctx.moveTo(size * 0.5, size * 0.5 - 16);
  ctx.lineTo(size * 0.5, size * 0.5 + 16);
  ctx.stroke();

  return createTexture(canvas, { repeat: [1, 1], isColor: true, anisotropy });
}

/** Soft radial shadow indicator for dragged blocks */
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

/** Feathered golden volumetric sunbeam gradient for victory celebration */
function buildSunbeamGradient() {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Vertical soft fade from sky down onto the golden pyramidion
  const vGrad = ctx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0.0, 'rgba(255, 224, 130, 0.0)');
  vGrad.addColorStop(0.28, 'rgba(255, 226, 136, 0.55)');
  vGrad.addColorStop(0.75, 'rgba(255, 210, 96, 0.85)');
  vGrad.addColorStop(1.0, 'rgba(255, 200, 72, 0.0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle vertical sun-ray streaks
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
 * Generates and caches all procedural textures and shared materials.
 */
export function createTextureLibrary(renderer) {
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  const sand = buildDesertSand(anisotropy);
  const plinthMap = buildPlinthStrata(anisotropy);
  const limestone = buildQuarryLimestone(anisotropy);
  const carving1Map = buildCarvingStageTexture(1, anisotropy);
  const carving2Map = buildCarvingStageTexture(2, anisotropy);
  const sandstone = buildCarvedSandstone(anisotropy);
  const capstone = buildGoldenCapstone(anisotropy);
  const timber = buildTimberPlanks(anisotropy);
  const canopyMap = buildCanopyCloth(anisotropy);
  const blueprintMap = buildBlueprintGrid(anisotropy);
  const shadowBlobMap = buildShadowBlob();
  const sunbeamMap = buildSunbeamGradient();

  const textures = [
    sand.map,
    sand.bumpMap,
    plinthMap,
    limestone.map,
    limestone.bumpMap,
    carving1Map,
    carving2Map,
    sandstone.map,
    sandstone.bumpMap,
    capstone.map,
    capstone.bumpMap,
    timber.map,
    timber.bumpMap,
    canopyMap,
    blueprintMap,
    shadowBlobMap,
    sunbeamMap,
  ];

  const materials = {
    sand: new THREE.MeshStandardMaterial({
      map: sand.map,
      bumpMap: sand.bumpMap,
      bumpScale: 0.06,
      roughness: 0.92,
      metalness: 0.02,
    }),
    plinth: new THREE.MeshStandardMaterial({
      map: plinthMap,
      roughness: 0.95,
      metalness: 0.0,
    }),
    limestone: new THREE.MeshStandardMaterial({
      map: limestone.map,
      bumpMap: limestone.bumpMap,
      bumpScale: 0.08,
      roughness: 0.88,
      metalness: 0.03,
    }),
    rawBlock: new THREE.MeshStandardMaterial({
      map: limestone.map,
      bumpMap: limestone.bumpMap,
      bumpScale: 0.09,
      roughness: 0.86,
      metalness: 0.04,
      color: new THREE.Color('#ece4d4'),
    }),
    carvingStage1: new THREE.MeshStandardMaterial({
      map: carving1Map,
      bumpMap: limestone.bumpMap,
      bumpScale: 0.06,
      roughness: 0.82,
      metalness: 0.04,
    }),
    carvingStage2: new THREE.MeshStandardMaterial({
      map: carving2Map,
      bumpMap: sandstone.bumpMap,
      bumpScale: 0.04,
      roughness: 0.74,
      metalness: 0.06,
    }),
    carvedBlock: new THREE.MeshStandardMaterial({
      map: sandstone.map,
      bumpMap: sandstone.bumpMap,
      bumpScale: 0.045,
      roughness: 0.66,
      metalness: 0.08,
    }),
    capstoneGold: new THREE.MeshStandardMaterial({
      map: capstone.map,
      bumpMap: capstone.bumpMap,
      bumpScale: 0.035,
      roughness: 0.24,
      metalness: 0.78,
      emissive: new THREE.Color('#613d06'),
      emissiveIntensity: 0.25,
    }),
    timber: new THREE.MeshStandardMaterial({
      map: timber.map,
      bumpMap: timber.bumpMap,
      bumpScale: 0.05,
      roughness: 0.82,
      metalness: 0.04,
    }),
    timberDark: new THREE.MeshStandardMaterial({
      map: timber.map,
      bumpMap: timber.bumpMap,
      bumpScale: 0.05,
      color: new THREE.Color('#b5906c'),
      roughness: 0.86,
      metalness: 0.03,
    }),
    leverKnob: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8442c'),
      roughness: 0.52,
      metalness: 0.08,
    }),
    canopy: new THREE.MeshStandardMaterial({
      map: canopyMap,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    foundation: new THREE.MeshStandardMaterial({
      map: sandstone.map,
      bumpMap: sandstone.bumpMap,
      bumpScale: 0.03,
      color: new THREE.Color('#dec599'),
      roughness: 0.84,
      metalness: 0.03,
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
      color: new THREE.Color('#8c6139'),
      roughness: 0.9,
    }),
    palmLeaf: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5a8c45'),
      roughness: 0.75,
      side: THREE.DoubleSide,
    }),
    oasisWater: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3ca8b8'),
      roughness: 0.16,
      metalness: 0.18,
    }),
    copperTool: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c97a40'),
      roughness: 0.35,
      metalness: 0.72,
    }),
  };

  return {
    maps: {
      blueprint: blueprintMap,
      shadowBlob: shadowBlobMap,
      sunbeam: sunbeamMap,
    },
    materials,
    dispose() {
      textures.forEach((t) => t.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
  };
}
