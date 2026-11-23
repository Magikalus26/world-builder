/**
 * Workd Builder — Application Bootstrap, Main Menu, 3D World Map, Shop,
 * Decoration System, Campaign & Roguelike Orchestrator
 * Manages Three.js WebGLRenderer, procedural PMREM environment & lighting, 512x512 PBR textures,
 * procedural Web Audio SFX, dual-currency localStorage save system, 3-tab Main Menu,
 * 3-tab Furniture & Loot Box Boutique, In-Level 3D Decoration System, smooth camera/sand-wipe
 * transitions, 3D World Map selector, Level 1, and procedural Roguelike random levels.
 */

import * as THREE from 'three';
import { SoundEngine } from './audio.js';
import { createTextureLibrary } from './textures.js';
import { DioramaCameraController } from './camera.js';
import { TouchInteractionEngine } from './dragDrop.js';
import { WorldMapScene } from './worldMap.js';
import { SaveManager } from './saveManager.js';
import { ShopController } from './shop.js';
import { MainMenuController } from './mainMenu.js';
import { DecorationSystem } from './decorationSystem.js';
import { RoguelikeLobbyController } from './roguelikeLobby.js';
import { Level1Pyramid } from './levels/level1_pyramid.js';
import { Level2Rome } from './levels/level2_rome.js';
import { Level3Japan } from './levels/level3_japan.js';
import { Level4Maya } from './levels/level4_maya.js';
import { RoguelikeLevel, generateRoguelikeConfig } from './levels/roguelike_level.js';

const LEVEL_REGISTRY = [Level1Pyramid, Level2Rome, Level3Japan, Level4Maya];

class WorkdBuilderApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');

    // World Map HUD elements
    this.hudMapTop = document.getElementById('hud-map-top');
    this.mapBackMenuBtn = document.getElementById('map-back-menu-btn');
    this.mapBiomeBanner = document.getElementById('map-biome-banner');
    this.mapBiomeText = document.getElementById('map-biome-text');
    this.mapLevelCard = document.getElementById('map-level-card');
    this.mapCardTitle = document.getElementById('map-card-title');
    this.playLevelBtn = document.getElementById('play-level-btn');
    this.mapLockedPill = document.getElementById('map-locked-pill');
    this.mapComingSoonCard = document.getElementById('map-coming-soon-card');
    this.mapSoonBadge = document.getElementById('map-soon-badge');
    this.mapSoonTitle = document.getElementById('map-soon-title');
    this.mapSoonSub = document.getElementById('map-soon-sub');
    this.mapChapterBar = document.getElementById('map-chapter-bar');
    this.mapChapterPills = Array.from(document.querySelectorAll('.map-chapter-pill'));
    this.activeMapChapter = 0;

    // In-Game HUD elements
    this.hudGameTop = document.getElementById('hud-game-top');
    this.gameBackMenuBtn = document.getElementById('game-back-menu-btn');
    this.hudPill = document.getElementById('hud-pill');
    this.hudCounter = document.getElementById('hud-counter');
    this.rogueModWrap = document.getElementById('roguelike-modifier-wrap');
    this.rogueModPill = document.getElementById('roguelike-modifier-pill');

    // Completion HUD elements
    this.completionBar = document.getElementById('completion-bar');
    this.rewardPill = document.getElementById('reward-pill');
    this.restartBtn = document.getElementById('restart-btn');
    this.completionMapBtn = document.getElementById('completion-map-btn');

    // Warm golden-sand transition wipe overlay
    this.transitionWipe = document.getElementById('scene-transition-wipe');
    this.isTransitioning = false;
    this.transitionTimers = [];

    this.mode = 'menu'; // 'menu' | 'worldmap' | 'level' | 'roguelike'
    this.currentLevelIndex = 0;
    this.pendingLevelIndex = 0;
    this.worldMap = null;
    this.currentLevel = null;
    this.decorationSystem = null;
    this.hudBumpTimer = null;
    this.lockedPillTimer = null;

    this._initRendererAndScene();
    this.audio = new SoundEngine();
    this.save = new SaveManager();
    this.textures = createTextureLibrary(this.renderer);
    this.cameraController = new DioramaCameraController(this.camera, this.canvas);
    this.interaction = new TouchInteractionEngine({
      canvas: this.canvas,
      camera: this.camera,
      scene: this.scene,
      cameraController: this.cameraController,
      textures: this.textures,
      audio: this.audio,
    });

    this.shop = new ShopController({
      audio: this.audio,
      save: this.save,
      onBalanceChange: () => {
        if (this.mainMenu) this.mainMenu.refreshBalances();
        if (this.decorationSystem) this.decorationSystem.renderDock();
      },
    });

    this.roguelikeLobby = new RoguelikeLobbyController({
      audio: this.audio,
      save: this.save,
      onBalanceChange: () => {
        if (this.shop) this.shop.refreshBalances();
      },
      onLaunchRun: (runConfig) => this._transitionIntoRoguelike(runConfig),
    });

    this.mainMenu = new MainMenuController({
      audio: this.audio,
      save: this.save,
      shop: this.shop,
      onOpenWorldMap: () => this.openWorldMap(false),
      onStartRoguelike: () => this.roguelikeLobby.open(),
    });

    this._bindUI();
    // Launch directly onto the 3-card Main Menu over a live gently orbiting 3D diorama
    this.openMainMenu(true);

    this.lastTime = performance.now();
    this.elapsed = 0;
    this._tick = this._tick.bind(this);
    this.rafId = requestAnimationFrame(this._tick);
  }

  _initRendererAndScene() {
    const width = window.innerWidth || 390;
    const height = window.innerHeight || 844;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // Cap pixel ratio at 2x for locked 60 FPS and low thermals on iPhone 16e Safari
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e6c893');
    this.scene.fog = new THREE.Fog('#e6c893', 42, 88);
    this.scene.environment = this._createDesertEnvironment();
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(37, width / Math.max(height, 1), 0.5, 190);

    const hemiLight = new THREE.HemisphereLight('#fff8ea', '#c28344', 0.84);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff0cf', 2.05);
    sunLight.position.set(-12, 19, 13);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 6;
    sunLight.shadow.camera.far = 56;
    const d = 16.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;

    const rimFill = new THREE.DirectionalLight('#8fd4e6', 0.38);
    rimFill.position.set(14, 9, -13);
    this.scene.add(rimFill);
  }

  _createDesertEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(20, 16, 12);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 128;
    skyCanvas.height = 64;
    const ctx = skyCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0.0, '#7eb7d9');
    grad.addColorStop(0.35, '#f6dfb4');
    grad.addColorStop(0.52, '#fff4d6');
    grad.addColorStop(0.68, '#d9a45b');
    grad.addColorStop(1.0, '#8c5a2b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 64);

    ctx.fillStyle = '#fffdf0';
    ctx.beginPath();
    ctx.arc(32, 20, 9, 0, Math.PI * 2);
    ctx.fill();

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    const envRT = pmrem.fromScene(envScene, 0.04);
    skyGeo.dispose();
    skyMat.dispose();
    skyTex.dispose();
    pmrem.dispose();
    this.envRenderTarget = envRT;
    return envRT.texture;
  }

  _bindUI() {
    this._onResize = () => {
      const w = window.innerWidth || 390;
      const h = window.innerHeight || 844;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h, false);
      this.cameraController.handleResize(w, h);
    };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(this._onResize, 120);
    });

    window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

    // Top-left "← Menu" on World Map
    this.mapBackMenuBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playTabBounce();
      this.audio.playCameraWhoosh();
      this.openMainMenu(false);
    });

    // Top-left "← Carte" (Level 1) or "← Menu" (Roguelike) with smooth reverse zoom-out transition
    this.gameBackMenuBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playTabBounce();
      this.audio.playCameraWhoosh();
      if (this.mode === 'level') {
        this._transitionExitTo('worldmap');
      } else {
        this._transitionExitTo('menu');
      }
    });

    // Launch selected level from 3D World Map card with camera swoop dive + golden-sand wipe
    this.playLevelBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playStartChime();
      this._transitionIntoLevel(this.pendingLevelIndex);
    });

    // Completion primary button (Recommencer Level 1 OR Nouveau Tirage Roguelike)
    this.restartBtn.addEventListener('click', () => {
      this.audio.unlock();
      if (this.mode === 'roguelike') {
        this.audio.playDiceChime();
        this.roguelikeLobby.open();
      } else {
        this.audio.playLeverFlip();
        this.restartCurrentLevel();
      }
    });

    // Completion secondary button (Retour à la Carte for Campaign, Retour au Menu for Roguelike)
    this.completionMapBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playCameraWhoosh();
      if (this.mode === 'roguelike') {
        this._transitionExitTo('menu');
      } else {
        this._transitionExitTo('worldmap');
      }
    });

    // Horizontal Chapter Jump Bar pills ("1–10" .. "91–100") on the 3D World Map
    this.mapChapterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        if (this.mode !== 'worldmap' || !this.worldMap) return;
        const idx = Number(pill.dataset.chapter || 0);
        this.audio.unlock();
        this.audio.playTabBounce();
        this.audio.playCameraWhoosh();
        this.worldMap.jumpToChapter(idx);
        this._setActiveChapterUI(idx, true);
      });
    });
  }

  /* ============================================================================
   * SMOOTH CAMERA SWOOP / ZOOM DIVE + WARM GOLDEN-SAND WIPE TRANSITIONS
   * ========================================================================== */
  _clearTransitionTimers() {
    this.transitionTimers.forEach((id) => clearTimeout(id));
    this.transitionTimers = [];
  }

  _runSceneTransition({ direction = 'in', onMidpoint }) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this._clearTransitionTimers();
    this.interaction.cancelActiveInteraction();

    // Camera swoop dive (entering a level) or reverse zoom-out lift (exiting a level)
    if (direction === 'in') {
      this.cameraController.desiredDistance = Math.max(
        this.cameraController.minDistance,
        this.cameraController.distance * 0.56
      );
      this.cameraController.desiredElevation = Math.max(0.42, this.cameraController.elevation - 0.22);
    } else {
      this.cameraController.desiredDistance = Math.min(
        this.cameraController.maxDistance,
        this.cameraController.distance * 1.42
      );
      this.cameraController.desiredElevation = Math.min(1.18, this.cameraController.elevation + 0.18);
    }

    if (this.transitionWipe) {
      this.transitionWipe.classList.remove('is-revealing');
      this.transitionWipe.classList.add('is-covering');
    }

    const t1 = setTimeout(() => {
      if (onMidpoint) onMidpoint();
      if (this.transitionWipe) {
        this.transitionWipe.classList.remove('is-covering');
        this.transitionWipe.classList.add('is-revealing');
      }
    }, 220);

    const t2 = setTimeout(() => {
      if (this.transitionWipe) {
        this.transitionWipe.classList.remove('is-revealing');
      }
      this.isTransitioning = false;
    }, 500);

    this.transitionTimers.push(t1, t2);
  }

  _transitionIntoLevel(index) {
    this._runSceneTransition({
      direction: 'in',
      onMidpoint: () => {
        this.loadLevel(index, true);
        // Gentle settle-in glide from slightly elevated framing
        this.cameraController.distance = this.cameraController.desiredDistance * 1.16;
        this.cameraController.elevation = this.cameraController.desiredElevation + 0.08;
      },
    });
  }

  _transitionIntoRoguelike(runConfig = null) {
    this._runSceneTransition({
      direction: 'in',
      onMidpoint: () => {
        this.startRoguelikeRun(true, runConfig);
        this.cameraController.distance = this.cameraController.desiredDistance * 1.16;
        this.cameraController.elevation = this.cameraController.desiredElevation + 0.08;
      },
    });
  }

  _transitionExitTo(dest) {
    this._runSceneTransition({
      direction: 'out',
      onMidpoint: () => {
        if (dest === 'worldmap') {
          this.openWorldMap(true);
          this.cameraController.distance = this.cameraController.desiredDistance * 0.86;
        } else {
          this.openMainMenu(true);
          this.cameraController.distance = this.cameraController.desiredDistance * 0.88;
        }
      },
    });
  }

  _hideMapBottomOverlays() {
    clearTimeout(this.lockedPillTimer);
    this.mapLevelCard.classList.remove('is-visible');
    this.mapLevelCard.hidden = true;
    this.mapLockedPill.classList.remove('is-visible');
    this.mapLockedPill.hidden = true;
  }

  _hideCompletionAndModifiers() {
    this.completionBar.classList.remove('is-visible');
    this.completionBar.hidden = true;
    this.rewardPill.hidden = true;
    this.rogueModWrap.hidden = true;
    this.hudPill.classList.remove('is-complete', 'is-bumped');
  }

  _disposeActiveLevel() {
    if (this.decorationSystem) {
      this.interaction.setDecorationSystem(null);
      this.decorationSystem.dispose();
      this.decorationSystem = null;
    }
    if (this.currentLevel) {
      this.interaction.setLevel(null);
      this.currentLevel.dispose();
      this.currentLevel = null;
    }
  }

  _disposeWorldMap() {
    if (this.worldMap) {
      this.interaction.setLevel(null);
      this.worldMap.dispose();
      this.worldMap = null;
    }
  }

  _ensureWorldMapMounted() {
    if (this.worldMap) return;
    this.worldMap = new WorldMapScene({
      scene: this.scene,
      textures: this.textures,
      audio: this.audio,
      cameraController: this.cameraController,
      onSelectNode: (node) => this._handleMapNodeSelect(node),
      onClearSelection: () => this._hideMapBottomOverlays(),
    });
  }

  _setActiveChapterUI(chapterIdx, scrollPill = false) {
    this.activeMapChapter = chapterIdx;
    this.mapChapterPills.forEach((pill, i) => {
      const active = i === chapterIdx;
      pill.classList.toggle('is-active', active);
      if (active && scrollPill && typeof pill.scrollIntoView === 'function') {
        pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
    if (this.worldMap && this.mapBiomeText) {
      const ch = this.worldMap.getChapterMeta(chapterIdx);
      if (ch) {
        this.mapBiomeText.textContent = `Chapitre ${ch.index + 1} (${ch.rangeLabel}) • ${ch.biomeName}`;
      }
    }
  }

  _syncSunLightToTarget(x, z) {
    if (!this.sunLight) return;
    this.sunLight.position.set(x - 12, 19, z + 13);
    this.sunLight.target.position.set(x, 0, z);
    this.sunLight.target.updateMatrixWorld();
  }

  /**
   * Opens the 3-card Main Menu over a live gently orbiting 3D multi-civilization diorama.
   */
  openMainMenu(immediateCamera = false) {
    this._disposeActiveLevel();
    this._hideMapBottomOverlays();
    this._hideCompletionAndModifiers();

    this.mode = 'menu';
    this.scene.background.set('#e5c78f');
    this.scene.fog.color.set('#e5c78f');
    this.scene.fog.near = 48;
    this.scene.fog.far = 118;

    this.hudMapTop.hidden = true;
    if (this.mapBiomeBanner) this.mapBiomeBanner.hidden = true;
    if (this.mapChapterBar) this.mapChapterBar.hidden = true;
    this.hudGameTop.hidden = true;
    this.mainMenu.show();

    this._ensureWorldMapMounted();
    this.worldMap.setLabelsVisible(false);
    this.interaction.setLevel(null);
    this.interaction.setDecorationSystem(null);
    this.interaction.setEnabled(false);

    // Gentle elevated framing showcasing the 4 playable starter islands behind the menu dock
    this.cameraController.configurePreset({
      target: new THREE.Vector3(-0.3, 0.35, 79.2),
      elevationDeg: 40,
      azimuth: 0.24,
      minDistance: 12.0,
      maxDistance: 58.0,
      panBounds: { minX: -10.5, maxX: 10.5, minZ: -87.0, maxZ: 87.0 },
      distanceScale: 0.72,
    });
    this.cameraController.resetView(immediateCamera);
    this._syncSunLightToTarget(-0.3, 79.2);
  }

  /**
   * Opens the interactive 100-Level 3D Tabletop World Map Archipelago.
   */
  openWorldMap(immediateCamera = false) {
    this._disposeActiveLevel();
    this._hideMapBottomOverlays();
    this._hideCompletionAndModifiers();
    this.mainMenu.hide();

    this.mode = 'worldmap';
    this.scene.background.set('#d5e8ea');
    this.scene.fog.color.set('#d5e8ea');
    this.scene.fog.near = 60;
    this.scene.fog.far = 148;

    this.hudMapTop.hidden = false;
    if (this.mapBiomeBanner) this.mapBiomeBanner.hidden = false;
    if (this.mapChapterBar) this.mapChapterBar.hidden = false;
    this.hudGameTop.hidden = true;
    this.mainMenu.refreshBalances();

    this._ensureWorldMapMounted();
    this.worldMap.selectedNode = null;
    if (this.worldMap.selectionRing) this.worldMap.selectionRing.visible = false;
    this.worldMap.setLabelsVisible(true);

    this.cameraController.configurePreset({
      target: new THREE.Vector3(-0.55, 0.25, 78.6),
      elevationDeg: 52,
      azimuth: 0.04,
      minDistance: 11.5,
      maxDistance: 58.0,
      panBounds: { minX: -10.5, maxX: 10.5, minZ: -87.0, maxZ: 87.0 },
      distanceScale: 0.96,
    });

    this.interaction.setLevel(this.worldMap);
    this.interaction.setDecorationSystem(null);
    this.interaction.setEnabled(true);
    this.cameraController.resetView(immediateCamera);
    this._syncSunLightToTarget(-0.55, 78.6);
    this._setActiveChapterUI(0, false);
  }

  _handleMapNodeSelect(node) {
    this._hideMapBottomOverlays();

    if (node.chapter) {
      this._setActiveChapterUI(node.chapter.index, true);
    }

    if (node.unlocked) {
      this.pendingLevelIndex = node.levelIndex;
      this.mapCardTitle.textContent = node.title;
      this.mapLevelCard.hidden = false;
      void this.mapLevelCard.offsetWidth;
      this.mapLevelCard.classList.add('is-visible');
    } else {
      if (this.mapComingSoonCard) {
        this.mapComingSoonCard.classList.toggle('is-milestone', Boolean(node.isMilestone));
      }
      if (this.mapSoonBadge) {
        this.mapSoonBadge.textContent = node.isMilestone
          ? '🏛️ Grand Chantier • Bientôt'
          : 'Bientôt';
      }
      if (this.mapSoonTitle) {
        this.mapSoonTitle.textContent = node.isMilestone
          ? `Niveau ${node.levelNum} • Grand Chantier Village/Ville — Bientôt`
          : `Niveau ${node.levelNum} — Bientôt disponible`;
      }
      if (this.mapSoonSub) {
        this.mapSoonSub.textContent =
          node.subtitle ||
          (node.chapter ? `Chapitre ${node.chapter.index + 1} • ${node.chapter.biomeName}` : '');
      }
      this.mapLockedPill.hidden = false;
      void this.mapLockedPill.offsetWidth;
      this.mapLockedPill.classList.add('is-visible');
    }
  }

  _mountDecorations(levelKey) {
    this.decorationSystem = new DecorationSystem({
      scene: this.scene,
      level: this.currentLevel,
      levelKey,
      textures: this.textures,
      audio: this.audio,
      save: this.save,
      onOpenShop: () => this.shop.open('meubles'),
    });
    this.interaction.setDecorationSystem(this.decorationSystem);
  }

  /**
   * Launches a Campaign Level (Levels 1–4).
   */
  loadLevel(index, immediateCamera = false) {
    const LevelClass = LEVEL_REGISTRY[index] || LEVEL_REGISTRY[0];
    this.currentLevelIndex = index;

    this._disposeActiveLevel();
    this._disposeWorldMap();
    this._hideMapBottomOverlays();
    this._hideCompletionAndModifiers();
    this.mainMenu.hide();

    this.mode = 'level';
    const skyHex = (LevelClass.meta && LevelClass.meta.skyColor) || '#efd3a2';
    this.scene.background.set(skyHex);
    this.scene.fog.color.set(skyHex);
    this.scene.fog.near = 42;
    this.scene.fog.far = 88;
    this._syncSunLightToTarget(0, 0);

    this.hudMapTop.hidden = true;
    if (this.mapBiomeBanner) this.mapBiomeBanner.hidden = true;
    if (this.mapChapterBar) this.mapChapterBar.hidden = true;
    this.hudGameTop.hidden = false;
    this.gameBackMenuBtn.textContent = '← Carte';
    this.restartBtn.textContent = 'Recommencer';
    this.completionMapBtn.textContent = 'Retour à la Carte';
    this._updateHUD(0, LevelClass.meta.totalGoal, LevelClass.meta.hudLabel, false);

    this.cameraController.configurePreset({
      target: new THREE.Vector3(-0.15, 0.35, 0.1),
      elevationDeg: 55,
      azimuth: 0.08,
      minDistance: 10.5,
      maxDistance: 56.0,
      panBounds: { minX: -8.5, maxX: 8.5, minZ: -8.2, maxZ: 8.5 },
      distanceScale: 1.0,
    });

    this.currentLevel = new LevelClass({
      scene: this.scene,
      textures: this.textures,
      audio: this.audio,
      upgrades: this.save.getUpgrades(),
      onProgress: (count, total) => {
        this._updateHUD(count, total, LevelClass.meta.hudLabel, true);
      },
      onComplete: (payload) => {
        this._handleLevelComplete(payload);
      },
    });

    this._mountDecorations(LevelClass.meta.id || 'level1_pyramid');
    this.interaction.setLevel(this.currentLevel);
    this.interaction.setEnabled(true);
    this.cameraController.resetView(immediateCamera);
  }

  /**
   * Stage 2: Launches a procedural Roguelike run using the rolled theme + 1-of-5 dedicated structure.
   */
  startRoguelikeRun(immediateCamera = false, prebuiltConfig = null) {
    const cfg = prebuiltConfig || generateRoguelikeConfig();

    this._disposeActiveLevel();
    this._disposeWorldMap();
    this._hideMapBottomOverlays();
    this._hideCompletionAndModifiers();
    this.mainMenu.hide();
    if (this.roguelikeLobby) this.roguelikeLobby.close();

    this.mode = 'roguelike';
    this.activeRoguelikeConfig = cfg;
    this.scene.background.set(cfg.skyColor);
    this.scene.fog.color.set(cfg.skyColor);
    this.scene.fog.near = 42;
    this.scene.fog.far = 88;
    this._syncSunLightToTarget(0, 0);

    this.hudMapTop.hidden = true;
    if (this.mapBiomeBanner) this.mapBiomeBanner.hidden = true;
    if (this.mapChapterBar) this.mapChapterBar.hidden = true;
    this.hudGameTop.hidden = false;
    this.gameBackMenuBtn.textContent = '← Menu';
    this.restartBtn.textContent = 'Nouveau Tirage';
    this.completionMapBtn.textContent = 'Retour au Menu';
    this._updateHUD(0, cfg.totalGoal, cfg.themeShortName || 'Roguelike', false);
    this._updateRoguelikeBanner(cfg, 0, cfg.totalGoal);
    this.rogueModWrap.hidden = false;

    this.cameraController.configurePreset({
      target: new THREE.Vector3(-0.15 * cfg.mirrorX, 0.35, 0.1),
      elevationDeg: 55,
      azimuth: 0.08 * cfg.mirrorX,
      minDistance: 10.5,
      maxDistance: 56.0,
      panBounds: { minX: -8.5, maxX: 8.5, minZ: -8.2, maxZ: 8.5 },
      distanceScale: 1.0,
    });

    this.currentLevel = new RoguelikeLevel({
      scene: this.scene,
      textures: this.textures,
      audio: this.audio,
      upgrades: this.save.getUpgrades(),
      runConfig: cfg,
      onProgress: (count, total) => {
        this._updateHUD(count, total, cfg.themeShortName || 'Roguelike', true);
        this._updateRoguelikeBanner(cfg, count, total);
      },
      onComplete: (payload) => {
        this._handleLevelComplete(payload);
      },
    });

    this._mountDecorations('roguelike');
    this.interaction.setLevel(this.currentLevel);
    this.interaction.setEnabled(true);
    this.cameraController.resetView(immediateCamera);
  }

  _updateRoguelikeBanner(cfg, count, total) {
    if (!this.rogueModPill || !cfg) return;
    this.rogueModPill.textContent = `Roguelike • ${cfg.themeShortName} : ${cfg.structureName} (${count} / ${total} blocs) • 🎲 ${cfg.modifierLabel} • +${cfg.rewardTokens} Éclats`;
  }

  restartCurrentLevel() {
    this.loadLevel(this.currentLevelIndex, false);
  }

  _updateHUD(count, total, label = 'Pyramide', animate = false) {
    this.hudCounter.textContent = `${label} : ${count} / ${total}`;

    if (animate) {
      this.hudPill.classList.remove('is-bumped');
      void this.hudPill.offsetWidth;
      this.hudPill.classList.add('is-bumped');
      clearTimeout(this.hudBumpTimer);
      this.hudBumpTimer = setTimeout(() => {
        this.hudPill.classList.remove('is-bumped');
      }, 240);
    }
  }

  _handleLevelComplete({
    levelId = null,
    focusPoint,
    rewardCoins = 150,
    rewardTokens = 0,
    firstCompletionTokens = 0,
  }) {
    if (this.decorationSystem && this.decorationSystem.isActive()) {
      this.decorationSystem.setActive(false);
    }
    this.hudPill.classList.add('is-complete');
    this.interaction.cancelActiveInteraction();
    this.cameraController.startVictoryOrbit(focusPoint);

    // Award persistent Gold Coins + Roguelike Éclats (or campaign first-completion Éclats bonus)
    const parts = [];
    let totalTokensAwarded = 0;

    if (this.mode === 'roguelike' && rewardTokens > 0) {
      totalTokensAwarded += rewardTokens;
    } else if (this.mode === 'level' && levelId) {
      const { firstTime } = this.save.markLevelCompleted(levelId);
      if (firstTime && firstCompletionTokens > 0) {
        totalTokensAwarded += firstCompletionTokens;
      }
    }

    if (totalTokensAwarded > 0) {
      this.save.addRoguelikeTokens(totalTokensAwarded);
      parts.push(`💠 +${totalTokensAwarded} Éclats`);
    }
    if (rewardCoins > 0) {
      this.save.addCoins(rewardCoins, this.mode);
      parts.push(`🪙 +${rewardCoins} Or`);
    }

    if (parts.length > 0) {
      this.shop.refreshBalances();
      this.rewardPill.textContent = `${parts.join('  •  ')} gagnés !`;
      this.rewardPill.hidden = false;
      setTimeout(() => this.audio.playCoinClink(), 380);
    }

    this.completionBar.hidden = false;
    requestAnimationFrame(() => {
      this.completionBar.classList.add('is-visible');
    });
  }

  _tick(now) {
    this.rafId = requestAnimationFrame(this._tick);

    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0.001), 0.05);
    this.lastTime = now;
    this.elapsed += dt;

    this.interaction.update(dt, this.elapsed);

    if (this.mode === 'menu' && this.worldMap) {
      // Gentle living diorama rotation behind the carved wooden menu dock
      this.cameraController.desiredAzimuth += dt * 0.14;
    }

    this.cameraController.update(dt, this.interaction.isCameraGestureActive());
    this.camera.updateMatrixWorld();

    if (this.mode === 'menu' && this.worldMap) {
      this._syncSunLightToTarget(this.cameraController.target.x, this.cameraController.target.z);
      this.worldMap.update(dt, this.elapsed, null);
    } else if (this.mode === 'worldmap' && this.worldMap) {
      this._syncSunLightToTarget(this.cameraController.target.x, this.cameraController.target.z);
      this.worldMap.update(dt, this.elapsed, this.camera);
      const chIdx = this.worldMap.getChapterIndexForZ(this.cameraController.target.z);
      if (chIdx !== this.activeMapChapter) {
        this._setActiveChapterUI(chIdx, true);
      }
    } else if ((this.mode === 'level' || this.mode === 'roguelike') && this.currentLevel) {
      this.currentLevel.update(dt, this.elapsed);
      if (this.decorationSystem) {
        this.decorationSystem.update(dt, this.elapsed);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

const app = new WorkdBuilderApp();
window.__WORKD_BUILDER__ = app;
