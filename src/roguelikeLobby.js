/**
 * Workd Builder — Stage 1 Pre-Run Roguelike Dice / Portal Roll Lobby Modal
 * Lets the player roll 1 of the 3 Civilization Level Themes (Égypte, Rome, Chine)
 * with a lively slot/dice roll animation, live rotating 3D miniature island diorama preview,
 * 1 free reroll per visit (then 50 Gold Coins), and launches Stage 2 (1 of 5 dedicated structures).
 */

import * as THREE from 'three';
import { createUnifiedRenderer, createRoomEnvironmentIBL } from './graphicsCore.js';
import {
  ROGUELIKE_THEMES,
  rollRandomTheme,
  rollRandomModifier,
  generateRoguelikeConfig,
} from './levels/roguelike_level.js';

const REROLL_COST_COINS = 50;

function triggerBounce(el) {
  if (!el) return;
  el.classList.remove('is-bouncing');
  void el.offsetWidth;
  el.classList.add('is-bouncing');
  setTimeout(() => el.classList.remove('is-bouncing'), 340);
}

/**
 * Builds a charming miniature 3D civilization island diorama for the lobby turntable preview.
 */
function buildMiniatureIsland(themeId) {
  const root = new THREE.Group();

  // Stylized turquoise sea disc + golden compass rim
  const seaMat = new THREE.MeshStandardMaterial({
    color: themeId === 'rome' ? '#3ba8be' : themeId === 'china' ? '#369a9e' : '#35b4bc',
    roughness: 0.25,
    metalness: 0.1,
  });
  const sea = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.48, 0.14, 32), seaMat);
  sea.position.y = -0.07;
  sea.receiveShadow = true;
  root.add(sea);

  const rimMat = new THREE.MeshStandardMaterial({
    color: '#efc25b',
    roughness: 0.3,
    metalness: 0.82,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.44, 0.04, 10, 40), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.0;
  root.add(rim);

  const foamMat = new THREE.MeshBasicMaterial({
    color: '#d8f9fa',
    transparent: true,
    opacity: 0.52,
  });
  const foam = new THREE.Mesh(new THREE.RingGeometry(1.06, 1.18, 28), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.012;
  root.add(foam);

  if (themeId === 'egypt') {
    const sandMat = new THREE.MeshStandardMaterial({ color: '#eac785', roughness: 0.88 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#d8b473', roughness: 0.78 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#ffd75a',
      roughness: 0.22,
      metalness: 0.88,
      emissive: '#6e4506',
      emissiveIntensity: 0.28,
    });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a5d34', roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#558b3c', roughness: 0.7 });

    // Sculpted desert sand island mound
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.12, 0.26, 18), sandMat);
    mound.position.y = 0.12;
    mound.receiveShadow = true;
    root.add(mound);

    // 4-tier miniature stepped pyramid with golden capstone
    [
      [0.82, 0.14, 0.31],
      [0.62, 0.14, 0.45],
      [0.42, 0.14, 0.59],
      [0.24, 0.12, 0.72],
    ].forEach(([w, h, y]) => {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), stoneMat);
      tier.position.set(0.12, y, -0.05);
      tier.castShadow = true;
      tier.receiveShadow = true;
      root.add(tier);
    });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 4), goldMat);
    cap.position.set(0.12, 0.87, -0.05);
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    root.add(cap);

    // Miniature limestone quarry terrace on left
    const quarry = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.38), new THREE.MeshStandardMaterial({ color: '#c8bea6', roughness: 0.88 }));
    quarry.position.set(-0.56, 0.34, -0.22);
    quarry.castShadow = true;
    root.add(quarry);

    // 2 tiny oasis date palms
    [
      [-0.46, 0.46],
      [0.66, 0.42],
    ].forEach(([px, pz]) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.38, 6), trunkMat);
      t.position.set(px, 0.42, pz);
      t.castShadow = true;
      root.add(t);
      for (let f = 0; f < 4; f++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 4), leafMat);
        leaf.position.set(px, 0.62, pz);
        leaf.rotation.z = 1.1;
        leaf.rotation.y = (f / 4) * Math.PI * 2;
        root.add(leaf);
      }
    });
    return root;
  }

  if (themeId === 'rome') {
    const grassMat = new THREE.MeshStandardMaterial({ color: '#9ab46a', roughness: 0.86 });
    const marbleMat = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.38, metalness: 0.05 });
    const terraMat = new THREE.MeshStandardMaterial({ color: '#cf6640', roughness: 0.72 });
    const cypressMat = new THREE.MeshStandardMaterial({ color: '#396236', roughness: 0.78 });

    // Mediterranean hillside island
    const hill = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.12, 0.28, 18), grassMat);
    hill.position.y = 0.13;
    hill.receiveShadow = true;
    root.add(hill);

    // Miniature white marble Roman Aqueduct (4 piers + bridge deck)
    [-0.54, -0.18, 0.18, 0.54].forEach((x) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.18), marbleMat);
      pier.position.set(x, 0.46, -0.18);
      pier.castShadow = true;
      root.add(pier);
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 0.22), marbleMat);
    deck.position.set(0, 0.72, -0.18);
    deck.castShadow = true;
    root.add(deck);

    // Mini Roman pediment temple on front-right
    const podium = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.38), marbleMat);
    podium.position.set(0.32, 0.36, 0.34);
    podium.castShadow = true;
    root.add(podium);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.18, 4), terraMat);
    roof.position.set(0.32, 0.55, 0.34);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    root.add(roof);

    // 4 sculpted Mediterranean Cypress trees
    [
      [-0.64, 0.36],
      [-0.42, 0.54],
      [0.72, 0.18],
      [-0.18, 0.48],
    ].forEach(([cx, cz]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 7), cypressMat);
      c.position.set(cx, 0.48, cz);
      c.castShadow = true;
      root.add(c);
    });
    return root;
  }

  if (themeId === 'maya') {
    const jungleGrass = new THREE.MeshStandardMaterial({ color: '#3f7f44', roughness: 0.85 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#d4c69c', roughness: 0.82 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#ad412d', roughness: 0.7 });
    const jadeMat = new THREE.MeshStandardMaterial({
      color: '#22b47c',
      emissive: '#0c4c34',
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.2,
    });
    const cenoteMat = new THREE.MeshStandardMaterial({
      color: '#28c4ce',
      roughness: 0.16,
      metalness: 0.12,
    });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2c6b34', roughness: 0.78 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4230', roughness: 0.9 });

    const island = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.14, 0.28, 18), jungleGrass);
    island.position.y = 0.12;
    island.receiveShadow = true;
    root.add(island);

    // Miniature Sacred Cenote pool
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), cenoteMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.56, 0.27, 0.22);
    root.add(pool);

    // Miniature stepped Temple of Kukulcán
    [
      { w: 0.78, h: 0.16, y: 0.34, mat: stoneMat },
      { w: 0.56, h: 0.16, y: 0.5, mat: stoneMat },
      { w: 0.36, h: 0.14, y: 0.65, mat: redMat },
    ].forEach((t) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.w), t.mat);
      m.position.set(-0.14, t.y, -0.06);
      m.castShadow = true;
      root.add(m);
    });

    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), jadeMat);
    jewel.position.set(-0.14, 0.82, -0.06);
    root.add(jewel);

    // Miniature Ceiba jungle trees
    [
      [-0.66, 0.4],
      [0.44, -0.52],
      [-0.58, -0.44],
    ].forEach(([tx, tz]) => {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.28, 6), trunkMat);
      tr.position.set(tx, 0.38, tz);
      root.add(tr);
      const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), leafMat);
      lf.position.set(tx, 0.56, tz);
      lf.scale.set(1.2, 0.65, 1.2);
      lf.castShadow = true;
      root.add(lf);
    });
    return root;
  }

  if (themeId === 'coalmine') {
    const basinMat = new THREE.MeshStandardMaterial({ color: '#56694e', roughness: 0.9 });
    const terrilMat = new THREE.MeshStandardMaterial({ color: '#31363e', roughness: 0.86, metalness: 0.14 });
    const brickMat = new THREE.MeshStandardMaterial({ color: '#8f3f2f', roughness: 0.84 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#2b313a', roughness: 0.42, metalness: 0.82 });
    const zincMat = new THREE.MeshStandardMaterial({ color: '#7b8692', roughness: 0.56, metalness: 0.44 });

    const island = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.14, 0.28, 18), basinMat);
    island.position.y = 0.12;
    island.receiveShadow = true;
    root.add(island);

    // Conical dark-slate Terril slag heap
    const terril = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.44, 7), terrilMat);
    terril.position.set(-0.48, 0.44, -0.32);
    terril.castShadow = true;
    root.add(terril);

    // Red-brick engine house + corrugated zinc roof
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 0.36), brickMat);
    house.position.set(0.14, 0.4, 0.22);
    house.castShadow = true;
    root.add(house);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.42), zincMat);
    roof.position.set(0.14, 0.56, 0.22);
    roof.rotation.x = 0.18;
    root.add(roof);

    // Tall brick smokestack
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.72, 8), brickMat);
    chimney.position.set(-0.18, 0.62, -0.18);
    chimney.castShadow = true;
    root.add(chimney);

    // Cast-iron headframe tower & spoked pulley wheel (molette)
    const legGeo = new THREE.BoxGeometry(0.045, 0.68, 0.045);
    [
      [-0.02, -0.18],
      [0.3, -0.18],
      [-0.02, 0.04],
      [0.3, 0.04],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, ironMat);
      leg.position.set(lx, 0.6, lz);
      leg.castShadow = true;
      root.add(leg);
    });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 16), ironMat);
    wheel.position.set(0.14, 0.98, -0.07);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    root.add(wheel);

    return root;
  }

  if (themeId === 'modern') {
    const lawnMat = new THREE.MeshStandardMaterial({ color: '#64a34a', roughness: 0.88 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.48 });
    const brickMat = new THREE.MeshStandardMaterial({ color: '#a84e36', roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#7cd8f0',
      roughness: 0.14,
      metalness: 0.22,
      transparent: true,
      opacity: 0.86,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#242930', roughness: 0.36, metalness: 0.82 });
    const poolMat = new THREE.MeshStandardMaterial({ color: '#26c4d8', roughness: 0.12, metalness: 0.1 });
    const cyMat = new THREE.MeshStandardMaterial({ color: '#376c3f', roughness: 0.84 });

    const island = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.14, 0.28, 18), lawnMat);
    island.position.y = 0.12;
    island.receiveShadow = true;
    root.add(island);

    // Sleek turquoise infinity pool + white coping
    const pool = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.42), poolMat);
    pool.position.set(0.38, 0.27, -0.34);
    root.add(pool);

    // Tier 1 white-concrete foundation terrace
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.78), concreteMat);
    base.position.set(-0.08, 0.31, 0.14);
    base.castShadow = true;
    root.add(base);

    // Tier 2 modern brick wing + panoramic glass living bay
    const brickWing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.62), brickMat);
    brickWing.position.set(-0.34, 0.51, 0.12);
    brickWing.castShadow = true;
    root.add(brickWing);

    const glassBay = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.56), glassMat);
    glassBay.position.set(0.08, 0.5, 0.12);
    root.add(glassBay);

    // Tier 3 cantilevered white-concrete upper volume (porte-à-faux)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.26, 0.58), concreteMat);
    upper.position.set(-0.04, 0.77, 0.08);
    upper.castShadow = true;
    root.add(upper);

    const upperGlass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.6), glassMat);
    upperGlass.position.set(-0.02, 0.76, 0.08);
    root.add(upperGlass);

    // Flat roof overhang + dark aluminum pergola trim
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.68), concreteMat);
    roof.position.set(-0.04, 0.93, 0.08);
    root.add(roof);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.7), frameMat);
    trim.position.set(-0.04, 0.96, 0.08);
    root.add(trim);

    // Pair of sleek miniature cypress trees
    [[-0.64, -0.34], [-0.46, -0.48]].forEach(([cx, cz]) => {
      const cy = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.44, 7), cyMat);
      cy.position.set(cx, 0.48, cz);
      cy.castShadow = true;
      root.add(cy);
    });

    return root;
  }

  // 'china': Terraced Jade Mountain Island + 3-Roof Red & Gold Pagoda + Bamboo
  const jadeGrass = new THREE.MeshStandardMaterial({ color: '#7ea870', roughness: 0.84 });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#9ea89e', roughness: 0.88 });
  const redMat = new THREE.MeshStandardMaterial({ color: '#bd2b24', roughness: 0.56 });
  const roofDark = new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.48 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c852', roughness: 0.25, metalness: 0.85 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: '#589a4a', roughness: 0.65 });

  // Terraced mountain tiers
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.12, 0.24, 18), jadeGrass);
  base.position.y = 0.11;
  base.receiveShadow = true;
  root.add(base);

  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.8, 0.18, 14), rockMat);
  terrace.position.set(0.05, 0.3, -0.05);
  terrace.receiveShadow = true;
  root.add(terrace);

  // 3-tier Celestial Pagoda
  [
    { y: 0.48, bw: 0.46, rw: 0.68 },
    { y: 0.72, bw: 0.34, rw: 0.54 },
    { y: 0.94, bw: 0.24, rw: 0.4 },
  ].forEach(({ y, bw, rw }) => {
    const core = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.18, bw), redMat);
    core.position.set(0.05, y, -0.05);
    core.castShadow = true;
    root.add(core);

    const eave = new THREE.Mesh(new THREE.ConeGeometry(rw * 0.68, 0.12, 4), roofDark);
    eave.position.set(0.05, y + 0.13, -0.05);
    eave.rotation.y = Math.PI / 4;
    eave.castShadow = true;
    root.add(eave);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.96, 0.024, rw * 0.96), goldMat);
    trim.position.set(0.05, y + 0.075, -0.05);
    root.add(trim);
  });

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), goldMat);
  spire.position.set(0.05, 1.18, -0.05);
  root.add(spire);

  // Jade Bamboo clusters
  [
    [-0.64, 0.26],
    [-0.54, 0.44],
    [-0.44, 0.34],
    [0.64, 0.34],
    [0.56, 0.46],
  ].forEach(([bx, bz], i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.52 + (i % 2) * 0.14, 6), bambooMat);
    b.position.set(bx, 0.44, bz);
    b.castShadow = true;
    root.add(b);
  });

  return root;
}

function disposeObjectTree(obj) {
  if (!obj) return;
  const geos = new Set();
  const mats = new Set();
  obj.traverse((child) => {
    if (child.geometry) geos.add(child.geometry);
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => mats.add(m));
      else mats.add(child.material);
    }
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
}

export class RoguelikeLobbyController {
  constructor({ audio, save, onLaunchRun, onBalanceChange }) {
    this.audio = audio;
    this.save = save;
    this.onLaunchRun = onLaunchRun;
    this.onBalanceChange = onBalanceChange;

    this.modal = document.getElementById('roguelike-lobby-modal');
    this.backdrop = document.getElementById('roguelike-lobby-backdrop');
    this.closeBtn = document.getElementById('roguelike-lobby-close');
    this.canvas = document.getElementById('roguelike-preview-canvas');
    this.diceBadge = document.getElementById('roguelike-dice-badge');
    this.themeCardEl = document.getElementById('roguelike-theme-card');
    this.themeTitleEl = document.getElementById('roguelike-theme-title');
    this.themeBiomeEl = document.getElementById('roguelike-theme-biome');
    this.modifierEl = document.getElementById('roguelike-lobby-modifier');
    this.rewardEl = document.getElementById('roguelike-lobby-reward');
    this.launchBtn = document.getElementById('roguelike-launch-btn');
    this.rerollBtn = document.getElementById('roguelike-reroll-btn');

    this.currentTheme = ROGUELIKE_THEMES[0];
    this.currentModifier = rollRandomModifier();
    this.freeRerollAvailable = true;
    this.isRolling = false;
    this.rollTimers = [];

    // Lazy mini WebGL turntable state
    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._turntable = null;
    this._islandMesh = null;
    this._rafId = null;
    this._lastTime = 0;
    this._spinBoost = 0;

    this._bindEvents();
  }

  _bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.close();
      });
    }
    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.close();
      });
    }
    if (this.rerollBtn) {
      this.rerollBtn.addEventListener('click', () => {
        if (this.isRolling) return;
        this.audio.unlock();
        if (this.freeRerollAvailable) {
          this.freeRerollAvailable = false;
          triggerBounce(this.rerollBtn);
          this._runDiceRoll(this.currentTheme ? this.currentTheme.id : null);
        } else {
          const spent = this.save.spendCoins(REROLL_COST_COINS);
          if (!spent.ok) {
            this.audio.playMapTap(true);
            return;
          }
          if (this.onBalanceChange) this.onBalanceChange();
          triggerBounce(this.rerollBtn);
          this._runDiceRoll(this.currentTheme ? this.currentTheme.id : null);
        }
      });
    }
    if (this.launchBtn) {
      this.launchBtn.addEventListener('click', () => {
        if (this.isRolling) return;
        this.audio.unlock();
        this.audio.playStartChime();
        triggerBounce(this.launchBtn);
        // Stage 2: randomly select 1 of the 5 dedicated structures for the rolled theme!
        const runConfig = generateRoguelikeConfig({
          themeId: this.currentTheme.id,
          modifier: this.currentModifier,
        });
        this.close();
        if (this.onLaunchRun) this.onLaunchRun(runConfig);
      });
    }
  }

  _ensureRenderer() {
    if (this._renderer || !this.canvas) return;
    const w = 316;
    const h = 176;
    this._renderer = createUnifiedRenderer(this.canvas, {
      alpha: true,
      shadowMap: true,
      width: w,
      height: h,
    });

    this._scene = new THREE.Scene();
    this._envRT = createRoomEnvironmentIBL(this._renderer);
    this._scene.environment = this._envRT.texture;
    this._scene.environmentIntensity = 0.65;
    this._camera = new THREE.PerspectiveCamera(34, w / h, 0.2, 30);
    this._camera.position.set(0, 2.35, 3.85);
    this._camera.lookAt(0, 0.28, 0);

    this._scene.add(new THREE.HemisphereLight('#fff8eb', '#8e6b44', 1.15));
    const key = new THREE.DirectionalLight('#fff2d2', 2.05);
    key.position.set(-2.8, 4.8, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    this._scene.add(key);

    const rim = new THREE.DirectionalLight('#7ad9ee', 0.6);
    rim.position.set(3.2, 2.2, -2.8);
    this._scene.add(rim);

    this._turntable = new THREE.Group();
    this._scene.add(this._turntable);
    this._tick = this._tick.bind(this);
  }

  _setPreviewTheme(theme) {
    if (!this._turntable) return;
    if (this._islandMesh) {
      this._turntable.remove(this._islandMesh);
      disposeObjectTree(this._islandMesh);
      this._islandMesh = null;
    }
    this._islandMesh = buildMiniatureIsland(theme.id);
    this._turntable.add(this._islandMesh);
  }

  _syncInfoUI(theme, modifier, rolling = false) {
    if (this.themeTitleEl) this.themeTitleEl.textContent = theme.title;
    if (this.themeBiomeEl) this.themeBiomeEl.textContent = theme.biomeLabel;
    if (this.modifierEl) {
      this.modifierEl.textContent = rolling
        ? '🎲 Tirage du modificateur...'
        : `🎲 Modificateur : ${modifier.label}`;
    }
    if (this.rewardEl) {
      this.rewardEl.textContent = `💠 ${theme.rewardRangeLabel}  •  🪙 +115 à +210 Or`;
    }
    if (this.themeCardEl) {
      this.themeCardEl.style.setProperty('--theme-accent', theme.accentColor);
      this.themeCardEl.classList.toggle('is-rolling', rolling);
    }
    this._syncButtons();
  }

  _syncButtons() {
    if (this.launchBtn) {
      this.launchBtn.disabled = this.isRolling;
    }
    if (this.rerollBtn) {
      const canAfford = this.freeRerollAvailable || this.save.getCoins() >= REROLL_COST_COINS;
      this.rerollBtn.disabled = this.isRolling || !canAfford;
      this.rerollBtn.textContent = this.freeRerollAvailable
        ? '🎲 Relancer le dé (Gratuit)'
        : `🎲 Relancer le dé (${REROLL_COST_COINS} Or)`;
    }
  }

  _clearRollTimers() {
    this.rollTimers.forEach((id) => clearTimeout(id));
    this.rollTimers = [];
  }

  _runDiceRoll(excludeThemeId = null) {
    this._clearRollTimers();
    this.isRolling = true;
    this._spinBoost = 7.5;

    const finalTheme = rollRandomTheme(excludeThemeId);
    const finalMod = rollRandomModifier();

    if (this.diceBadge) {
      this.diceBadge.classList.remove('is-settled');
      this.diceBadge.classList.add('is-tumbling');
    }

    // Lively slot/dice cycling through all 3 level themes before settling on finalTheme
    const cycleDelays = [0, 95, 200, 325, 470, 640];
    cycleDelays.forEach((ms, idx) => {
      const t = setTimeout(() => {
        const previewTheme = ROGUELIKE_THEMES[idx % ROGUELIKE_THEMES.length];
        this._setPreviewTheme(previewTheme);
        this._syncInfoUI(previewTheme, finalMod, true);
        this.audio.playLootShake(false);
      }, ms);
      this.rollTimers.push(t);
    });

    // Final settle
    const settleId = setTimeout(() => {
      this.currentTheme = finalTheme;
      this.currentModifier = finalMod;
      this.isRolling = false;
      this._spinBoost = 0;

      this._setPreviewTheme(finalTheme);
      this._syncInfoUI(finalTheme, finalMod, false);
      if (this.diceBadge) {
        this.diceBadge.classList.remove('is-tumbling');
        this.diceBadge.classList.add('is-settled');
      }
      triggerBounce(this.themeCardEl);
      this.audio.playDiceChime();
    }, 840);
    this.rollTimers.push(settleId);
  }

  open() {
    if (!this.modal) return;
    this.freeRerollAvailable = true;
    this._ensureRenderer();
    this.modal.hidden = false;
    requestAnimationFrame(() => {
      this.modal.classList.add('is-visible');
    });

    if (!this._rafId && this._renderer) {
      this._lastTime = performance.now();
      this._rafId = requestAnimationFrame(this._tick);
    }
    this._runDiceRoll(null);
  }

  close() {
    this._clearRollTimers();
    this.isRolling = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.modal) {
      this.modal.classList.remove('is-visible');
      this.modal.hidden = true;
    }
  }

  _tick(now) {
    this._rafId = requestAnimationFrame(this._tick);
    const dt = Math.min(Math.max((now - this._lastTime) / 1000, 0.001), 0.05);
    this._lastTime = now;

    if (this._turntable) {
      const speed = 0.52 + this._spinBoost;
      this._turntable.rotation.y += dt * speed;
      if (this._spinBoost > 0) {
        this._spinBoost = Math.max(0, this._spinBoost - dt * 5.2);
      }
    }
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  }
}
