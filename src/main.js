/**
 * Workd Builder — Application Bootstrap & Game Loop
 * Initializes Three.js WebGLRenderer, warm desert diorama lighting, procedural textures,
 * procedural audio, touch drag-and-drop engine, camera controller, and active level module.
 */

import * as THREE from 'three';
import { SoundEngine } from './audio.js';
import { createTextureLibrary } from './textures.js';
import { DioramaCameraController } from './camera.js';
import { TouchInteractionEngine } from './dragDrop.js';
import { Level1Pyramid } from './levels/level1_pyramid.js';

// Extensible level registry — add future village/monument/town modules here
const LEVEL_REGISTRY = [Level1Pyramid];

class WorkdBuilderApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.hudPill = document.getElementById('hud-pill');
    this.hudCounter = document.getElementById('hud-counter');
    this.completionBar = document.getElementById('completion-bar');
    this.restartBtn = document.getElementById('restart-btn');

    this.currentLevelIndex = 0;
    this.currentLevel = null;
    this.hudBumpTimer = null;

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
    this.loadLevel(this.currentLevelIndex, true);

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
    this.scene.fog = new THREE.Fog('#efd3a2', 42, 86);
    this.scene.environment = this._createDesertEnvironment();
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(37, width / Math.max(height, 1), 0.5, 130);

    // Warm golden desert lighting rig (sunlight + sky/sand bounce + subtle cool shadow fill)
    const hemiLight = new THREE.HemisphereLight('#fff8ea', '#c28344', 0.82);
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
   * Builds a tiny procedural warm desert sky/sand PMREM environment texture once at startup
   * so PBR normal/roughness highlights, Nile water reflections, and the gold capstone gleam naturally.
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

    // Bright solar disk highlight in sky for water & gold specular glint
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

    this.restartBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playLeverFlip();
      this.restartCurrentLevel();
    });
  }

  loadLevel(index, immediateCamera = false) {
    const LevelClass = LEVEL_REGISTRY[index] || LEVEL_REGISTRY[0];
    this.currentLevelIndex = index;

    // Cleanly dispose any previous level instance before mounting a fresh one
    if (this.currentLevel) {
      this.interaction.setLevel(null);
      this.currentLevel.dispose();
      this.currentLevel = null;
    }

    // Hide completion bar & reset HUD pill state
    this.completionBar.classList.remove('is-visible');
    this.completionBar.hidden = true;
    this.hudPill.classList.remove('is-complete', 'is-bumped');
    this._updateHUD(0, LevelClass.meta.totalGoal, LevelClass.meta.hudLabel, false);

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
      // Trigger reflow for crisp repeat pop
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
    if (this.currentLevel) {
      this.currentLevel.update(dt, this.elapsed);
    }
    this.cameraController.update(dt, this.interaction.isCameraGestureActive());

    this.renderer.render(this.scene, this.camera);
  }
}

// Launch directly into playable Level 1 diorama on DOM ready
const app = new WorkdBuilderApp();

// Expose clean debug/test hook on window without polluting gameplay UI
window.__WORKD_BUILDER__ = app;
