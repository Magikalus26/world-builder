/**
 * Workd Builder — Application Bootstrap, 3D World Map & Level Orchestrator
 * Initializes Three.js WebGLRenderer, procedural desert PMREM environment & lighting,
 * procedural 512x512 PBR textures, procedural Web Audio SFX, touch interaction engine,
 * 3D World Map Level Selector, and playable level modules.
 */

import * as THREE from 'three';
import { SoundEngine } from './audio.js';
import { createTextureLibrary } from './textures.js';
import { DioramaCameraController } from './camera.js';
import { TouchInteractionEngine } from './dragDrop.js';
import { WorldMapScene } from './worldMap.js';
import { Level1Pyramid } from './levels/level1_pyramid.js';

// Extensible level registry — add future civilization modules here
const LEVEL_REGISTRY = [Level1Pyramid];

class WorkdBuilderApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');

    // World Map HUD elements
    this.hudMapTop = document.getElementById('hud-map-top');
    this.mapLevelCard = document.getElementById('map-level-card');
    this.mapCardTitle = document.getElementById('map-card-title');
    this.playLevelBtn = document.getElementById('play-level-btn');
    this.mapLockedPill = document.getElementById('map-locked-pill');

    // In-Game HUD elements
    this.hudGameTop = document.getElementById('hud-game-top');
    this.backToMapBtn = document.getElementById('back-to-map-btn');
    this.hudPill = document.getElementById('hud-pill');
    this.hudCounter = document.getElementById('hud-counter');

    // Completion HUD elements
    this.completionBar = document.getElementById('completion-bar');
    this.restartBtn = document.getElementById('restart-btn');
    this.completionMapBtn = document.getElementById('completion-map-btn');

    this.mode = 'worldmap'; // 'worldmap' | 'level'
    this.currentLevelIndex = 0;
    this.pendingLevelIndex = 0;
    this.worldMap = null;
    this.currentLevel = null;
    this.hudBumpTimer = null;
    this.lockedPillTimer = null;

    this._initRendererAndScene();
    this.audio = new SoundEngine();
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

    this._bindUI();
    // Launch onto the interactive 3D World Map Level Selector by default
    this.openWorldMap(true);

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
    // Cap pixel ratio at 2x for locked 60 FPS and low thermals on iPhone OLED displays
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#efd3a2');
    this.scene.fog = new THREE.Fog('#efd3a2', 42, 88);
    this.scene.environment = this._createDesertEnvironment();
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(37, width / Math.max(height, 1), 0.5, 130);

    // Warm golden sunlit lighting rig (sunlight + sky/sand bounce + cool turquoise shadow fill)
    const hemiLight = new THREE.HemisphereLight('#fff8ea', '#c28344', 0.84);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff0cf', 2.05);
    sunLight.position.set(-12, 19, 13);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 6;
    sunLight.shadow.camera.far = 52;
    const d = 14.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    this.scene.add(sunLight);

    const rimFill = new THREE.DirectionalLight('#8fd4e6', 0.38);
    rimFill.position.set(14, 9, -13);
    this.scene.add(rimFill);
  }

  /**
   * Builds a lightweight procedural warm desert sky/horizon PMREM environment once at startup
   * so PBR normal/roughness highlights, ocean waves, Nile water, and gold gleam naturally.
   */
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

    // Prevent Safari page pinch-zoom gesture events outside canvas
    window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

    // Launch selected unlocked level from 3D World Map card
    this.playLevelBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playStartChime();
      this.loadLevel(this.pendingLevelIndex, true);
    });

    // Return to 3D World Map from active gameplay HUD
    this.backToMapBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playCameraWhoosh();
      this.openWorldMap(true);
    });

    // Restart Level 1 from completion bar
    this.restartBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playLeverFlip();
      this.restartCurrentLevel();
    });

    // Return to 3D World Map from completion bar
    this.completionMapBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playCameraWhoosh();
      this.openWorldMap(true);
    });
  }

  _hideMapBottomOverlays() {
    clearTimeout(this.lockedPillTimer);
    this.mapLevelCard.classList.remove('is-visible');
    this.mapLevelCard.hidden = true;
    this.mapLockedPill.classList.remove('is-visible');
    this.mapLockedPill.hidden = true;
  }

  _disposeActiveScene() {
    this.interaction.setLevel(null);
    if (this.currentLevel) {
      this.currentLevel.dispose();
      this.currentLevel = null;
    }
    if (this.worldMap) {
      this.worldMap.dispose();
      this.worldMap = null;
    }
  }

  /**
   * Opens the interactive 3D Tabletop World Map Level Selector.
   */
  openWorldMap(immediateCamera = false) {
    this._disposeActiveScene();
    this._hideMapBottomOverlays();

    this.mode = 'worldmap';

    // Warm coastal sky backdrop framing the carved wooden tabletop archipelago
    this.scene.background.set('#d5e8ea');
    this.scene.fog.color.set('#d5e8ea');

    // Toggle HUD bars cleanly
    this.hudMapTop.hidden = false;
    this.hudGameTop.hidden = true;
    this.completionBar.classList.remove('is-visible');
    this.completionBar.hidden = true;
    this.hudPill.classList.remove('is-complete', 'is-bumped');

    // Configure archipelago camera overview framing for portrait iPhone 16e & desktop
    this.cameraController.configurePreset({
      target: new THREE.Vector3(0.0, 0.25, 0.25),
      elevationDeg: 52,
      azimuth: 0.06,
      minDistance: 12.0,
      maxDistance: 54.0,
      panBounds: { minX: -6.8, maxX: 6.8, minZ: -7.2, maxZ: 7.2 },
      distanceScale: 0.92,
    });

    this.worldMap = new WorldMapScene({
      scene: this.scene,
      textures: this.textures,
      audio: this.audio,
      cameraController: this.cameraController,
      onSelectNode: (node) => this._handleMapNodeSelect(node),
      onClearSelection: () => this._hideMapBottomOverlays(),
    });

    this.interaction.setLevel(this.worldMap);
    this.interaction.setEnabled(true);
    this.cameraController.resetView(immediateCamera);
  }

  _handleMapNodeSelect(node) {
    this._hideMapBottomOverlays();

    if (node.unlocked) {
      this.pendingLevelIndex = node.levelIndex;
      this.mapCardTitle.textContent = node.title;
      this.mapLevelCard.hidden = false;
      requestAnimationFrame(() => {
        this.mapLevelCard.classList.add('is-visible');
      });
    } else {
      this.mapLockedPill.hidden = false;
      requestAnimationFrame(() => {
        this.mapLockedPill.classList.add('is-visible');
      });
      this.lockedPillTimer = setTimeout(() => {
        this.mapLockedPill.classList.remove('is-visible');
        setTimeout(() => {
          if (!this.mapLockedPill.classList.contains('is-visible')) {
            this.mapLockedPill.hidden = true;
          }
        }, 280);
      }, 3200);
    }
  }

  /**
   * Transitions cleanly from the World Map (or restarts) into a playable level module.
   */
  loadLevel(index, immediateCamera = false) {
    const LevelClass = LEVEL_REGISTRY[index] || LEVEL_REGISTRY[0];
    this.currentLevelIndex = index;

    this._disposeActiveScene();
    this._hideMapBottomOverlays();

    this.mode = 'level';

    // Warm sunlit Egyptian desert sky backdrop
    this.scene.background.set('#efd3a2');
    this.scene.fog.color.set('#efd3a2');

    // Toggle HUD bars cleanly
    this.hudMapTop.hidden = true;
    this.hudGameTop.hidden = false;
    this.completionBar.classList.remove('is-visible');
    this.completionBar.hidden = true;
    this.hudPill.classList.remove('is-complete', 'is-bumped');
    this._updateHUD(0, LevelClass.meta.totalGoal, LevelClass.meta.hudLabel, false);

    // Restore Level 1 diorama camera preset
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
      onProgress: (count, total) => {
        this._updateHUD(count, total, LevelClass.meta.hudLabel, true);
      },
      onComplete: ({ focusPoint }) => {
        this._handleLevelComplete(focusPoint);
      },
    });

    this.interaction.setLevel(this.currentLevel);
    this.interaction.setEnabled(true);
    this.cameraController.resetView(immediateCamera);
  }

  restartCurrentLevel() {
    this.loadLevel(this.currentLevelIndex, false);
  }

  _updateHUD(count, total, label = 'Pyramide', animate = false) {
    this.hudCounter.textContent = `${label} : ${count} / ${total} blocs`;

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

  _handleLevelComplete(focusPoint) {
    this.hudPill.classList.add('is-complete');
    this.interaction.cancelActiveInteraction();
    this.cameraController.startVictoryOrbit(focusPoint);

    this.completionBar.hidden = false;
    requestAnimationFrame(() => {
      this.completionBar.classList.add('is-visible');
    });
  }

  _tick(now) {
    this.rafId = requestAnimationFrame(this._tick);

    // Cap delta time cleanly so switching tabs or Safari backgrounding never spikes physics
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0.001), 0.05);
    this.lastTime = now;
    this.elapsed += dt;

    this.interaction.update(dt, this.elapsed);
    if (this.mode === 'worldmap' && this.worldMap) {
      this.worldMap.update(dt, this.elapsed);
    } else if (this.mode === 'level' && this.currentLevel) {
      this.currentLevel.update(dt, this.elapsed);
    }
    this.cameraController.update(dt, this.interaction.isCameraGestureActive());

    this.renderer.render(this.scene, this.camera);
  }
}

// Launch onto the 3D World Map Level Selector on DOM ready
const app = new WorkdBuilderApp();

// Expose clean debug/test hook on window without polluting gameplay UI
window.__WORKD_BUILDER__ = app;
