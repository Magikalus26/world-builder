/**
 * Workd Builder — In-Level 3D Furniture Decoration System
 * Lets players toggle "🪑 Décorer" mode inside playable levels (Level 1 & Roguelike),
 * place unlocked transparent furniture props onto valid sculpted terrain coordinates
 * (sampling level.getTerrainHeight(x, z)), drag to reposition, rotate 90°, or remove them,
 * while strictly protecting Quarry, Rail Tracks, Stonecutter, Staging Pallet, and Pyramid zones.
 */

import * as THREE from 'three';
import { getFurnitureById } from './saveManager.js';

const WATER_LEVEL = -0.14;
const FURNITURE_TEXTURE_CACHE = new Map();
const textureLoader = new THREE.TextureLoader();

function getFurnitureTexture(imgPath) {
  if (FURNITURE_TEXTURE_CACHE.has(imgPath)) {
    return FURNITURE_TEXTURE_CACHE.get(imgPath);
  }
  const tex = textureLoader.load(imgPath);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  FURNITURE_TEXTURE_CACHE.set(imgPath, tex);
  return tex;
}

export class DecorationSystem {
  constructor({ scene, level, levelKey, textures, audio, save, onOpenShop }) {
    this.scene = scene;
    this.level = level;
    this.levelKey = levelKey;
    this.textures = textures;
    this.audio = audio;
    this.save = save;
    this.onOpenShop = onOpenShop;

    this.active = false;
    this.selectedCatalogId = null;
    this.selectedPlacedUid = null;
    this.placedItems = []; // { uid, itemId, x, z, rotY, group, popAnim, materials, geometries }

    this.root = new THREE.Group();
    this.root.name = 'decorations_root';
    this.scene.add(this.root);

    // Shared per-level geometries & materials (disposed cleanly on level unload)
    this.plinthGeo = new THREE.CylinderGeometry(0.46, 0.56, 0.09, 20);
    this.plinthMat = new THREE.MeshStandardMaterial({
      color: 0xe3cb9d,
      roughness: 0.86,
      metalness: 0.04,
    });
    this.shadowGeo = new THREE.PlaneGeometry(1.45, 1.45);
    this.shadowGeo.rotateX(-Math.PI / 2);

    // Selection highlight ring around active prop
    this.selRingGeo = new THREE.RingGeometry(0.58, 0.72, 32);
    this.selRingGeo.rotateX(-Math.PI / 2);
    this.selRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd25a,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.selectionRing = new THREE.Mesh(this.selRingGeo, this.selRingMat);
    this.selectionRing.visible = false;
    this.root.add(this.selectionRing);

    // Live placement validity reticle (green = valid, red = blocked)
    this.reticleGeo = new THREE.RingGeometry(0.48, 0.66, 32);
    this.reticleGeo.rotateX(-Math.PI / 2);
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x67e88d,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.reticleMesh = new THREE.Mesh(this.reticleGeo, this.reticleMat);
    this.reticleMesh.visible = false;
    this.root.add(this.reticleMesh);

    // DOM elements
    this.toggleBtn = document.getElementById('decorate-toggle-btn');
    this.dockEl = document.getElementById('decorate-dock');
    this.dockListEl = document.getElementById('decorate-dock-list');
    this.dockHintEl = document.getElementById('decorate-dock-hint');
    this.propActionsEl = document.getElementById('decorate-prop-actions');
    this.rotateBtn = document.getElementById('decorate-rotate-btn');
    this.removeBtn = document.getElementById('decorate-remove-btn');
    this.doneBtn = document.getElementById('decorate-done-btn');

    this._onToggleClick = this._handleToggleClick.bind(this);
    this._onRotateClick = this._handleRotateClick.bind(this);
    this._onRemoveClick = this._handleRemoveClick.bind(this);
    this._onDoneClick = () => this.setActive(false);

    if (this.toggleBtn) this.toggleBtn.addEventListener('click', this._onToggleClick);
    if (this.rotateBtn) this.rotateBtn.addEventListener('click', this._onRotateClick);
    if (this.removeBtn) this.removeBtn.addEventListener('click', this._onRemoveClick);
    if (this.doneBtn) this.doneBtn.addEventListener('click', this._onDoneClick);

    this._restoreSavedDecorations();
    this.renderDock();
  }

  _handleToggleClick() {
    this.audio.unlock();
    this.audio.playTabBounce();
    this.setActive(!this.active);
  }

  _handleRotateClick() {
    this.audio.unlock();
    const entry = this.placedItems.find((p) => p.uid === this.selectedPlacedUid);
    if (!entry) return;
    entry.rotY = (entry.rotY + Math.PI * 0.5) % (Math.PI * 2);
    this._applyPropOrientation(entry);
    entry.popAnim = 0.22;
    this.audio.playDecorPlace(true);
    this._persist();
  }

  _applyPropOrientation(entry) {
    const step = Math.round(entry.rotY / (Math.PI * 0.5)) % 4;
    // Keep plinth marker rotated by full 90° steps while angling/mirroring the cutout art
    // so every 90° rotation looks distinctly oriented without ever appearing paper-thin edge-on.
    if (entry.plinthGroup) {
      entry.plinthGroup.rotation.y = entry.rotY;
    }
    if (entry.cardMesh) {
      const angles = [0.0, 0.42, 0.0, -0.42];
      const flipX = step === 1 || step === 2 ? -1 : 1;
      entry.cardMesh.rotation.y = angles[step] || 0;
      entry.cardMesh.scale.x = flipX;
    }
  }

  _handleRemoveClick() {
    this.audio.unlock();
    const idx = this.placedItems.findIndex((p) => p.uid === this.selectedPlacedUid);
    if (idx === -1) return;
    const [removed] = this.placedItems.splice(idx, 1);
    this._disposePropEntry(removed);
    this.selectedPlacedUid = null;
    this.selectionRing.visible = false;
    this._syncPropActionsUI();
    this.audio.playDecorRemove();
    this._persist();
  }

  setActive(flag) {
    this.active = Boolean(flag);
    if (this.toggleBtn) {
      this.toggleBtn.classList.toggle('is-active', this.active);
      this.toggleBtn.setAttribute('aria-pressed', this.active ? 'true' : 'false');
    }
    if (this.dockEl) {
      this.dockEl.hidden = !this.active;
      if (this.active) {
        this.renderDock();
        requestAnimationFrame(() => this.dockEl.classList.add('is-visible'));
      } else {
        this.dockEl.classList.remove('is-visible');
      }
    }
    if (!this.active) {
      this.selectedPlacedUid = null;
      this.selectionRing.visible = false;
      this.reticleMesh.visible = false;
      this._syncPropActionsUI();
    } else {
      // Auto-select first unlocked item if none selected yet
      const unlocked = this.save.getUnlockedFurniture();
      if (!this.selectedCatalogId && unlocked.length > 0) {
        this.selectedCatalogId = unlocked[0];
        this.renderDock();
      }
      this._syncPropActionsUI();
    }
  }

  isActive() {
    return this.active;
  }

  getHitTargets() {
    return this.placedItems.map((p) => p.group);
  }

  /**
   * Checks whether (x, z) is a valid open terrain location that does not block
   * Quarry, Rail Tracks, Stonecutter Workshop, Staging Pallet, Pyramid, or Water.
   */
  isValidPlacement(x, z, ignoreUid = null) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > 8.9 || Math.abs(z) > 8.3) return false;

    const h =
      this.level && typeof this.level.getTerrainHeight === 'function'
        ? this.level.getTerrainHeight(x, z)
        : 0;
    if (h < WATER_LEVEL + 0.08) return false;

    const mirrorX = (this.level && this.level.mirrorX) || 1;
    const sx = x * mirrorX;

    // Blocked gameplay station footprints (un-mirrored coordinates)
    const blockedBoxes = [
      // Quarry cliffs, rock nodes & drop pad
      { minX: -7.9, maxX: -1.3, minZ: -7.5, maxZ: -2.0 },
      // Track A & Sled A
      { minX: -6.5, maxX: -2.5, minZ: -2.4, maxZ: 2.8 },
      // Stonecutter Workshop & carved output pad
      { minX: -6.9, maxX: -2.3, minZ: 2.8, maxZ: 7.0 },
      // Track B & Sled B
      { minX: -2.6, maxX: 3.0, minZ: 3.0, maxZ: 6.5 },
      // Pyramid Staging Pallet
      { minX: 2.6, maxX: 5.9, minZ: 3.0, maxZ: 6.6 },
      // Pyramid Construction Foundation
      { minX: 0.1, maxX: 7.1, minZ: -4.3, maxZ: 2.8 },
    ];

    for (let i = 0; i < blockedBoxes.length; i++) {
      const b = blockedBoxes[i];
      if (sx >= b.minX && sx <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return false;
      }
    }

    // Avoid overlapping another placed furniture piece
    for (let i = 0; i < this.placedItems.length; i++) {
      const other = this.placedItems[i];
      if (other.uid === ignoreUid) continue;
      if (Math.hypot(other.x - x, other.z - z) < 1.15) {
        return false;
      }
    }

    return true;
  }

  /**
   * Attempts to place the currently selected catalog furniture at world (x, z).
   */
  tryPlaceSelectedAt(x, z) {
    if (!this.active) return false;
    if (!this.selectedCatalogId || !this.save.hasFurniture(this.selectedCatalogId)) {
      this._flashHint('Débloquez un meuble dans la Boutique !');
      this.audio.playMapTap(true);
      return false;
    }
    if (!this.isValidPlacement(x, z)) {
      this._showTransientReticle(x, z, false);
      this._flashHint('Zone réservée au chantier ou à l’eau');
      this.audio.playMapTap(true);
      return false;
    }

    const uid = `deco_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = this._spawnPropMesh({
      uid,
      itemId: this.selectedCatalogId,
      x,
      z,
      rotY: 0,
      animate: true,
    });
    if (!entry) return false;

    this.selectedPlacedUid = entry.uid;
    this._updateSelectionRing();
    this._syncPropActionsUI();
    this._showTransientReticle(x, z, true);
    this.audio.playDecorPlace(false);
    this._persist();
    return true;
  }

  /**
   * Selects a placed furniture prop (called on tap in Decoration Mode).
   */
  selectPlacedProp(entry) {
    if (!entry) return;
    this.selectedPlacedUid = entry.uid;
    this._updateSelectionRing();
    this._syncPropActionsUI();
    this.audio.playTabBounce();
  }

  /**
   * Live preview while dragging an existing placed prop across terrain.
   */
  updatePropDrag(entry, worldX, worldZ) {
    if (!entry) return;
    const cx = THREE.MathUtils.clamp(worldX, -9.2, 9.2);
    const cz = THREE.MathUtils.clamp(worldZ, -8.6, 8.6);
    const valid = this.isValidPlacement(cx, cz, entry.uid);
    const groundY = Math.max(
      this.level && typeof this.level.getTerrainHeight === 'function'
        ? this.level.getTerrainHeight(cx, cz)
        : 0,
      WATER_LEVEL + 0.04
    );

    entry.group.position.set(cx, groundY + 0.28, cz);
    this.reticleMesh.visible = true;
    this.reticleMesh.position.set(cx, groundY + 0.04, cz);
    this.reticleMat.color.setHex(valid ? 0x67e88d : 0xff6258);
    this.selectionRing.visible = false;
  }

  /**
   * Finalizes dragging a placed prop: commits if valid, snaps back if blocked.
   */
  endPropDrag(entry, worldX, worldZ) {
    this.reticleMesh.visible = false;
    if (!entry) return;
    const cx = THREE.MathUtils.clamp(worldX, -9.2, 9.2);
    const cz = THREE.MathUtils.clamp(worldZ, -8.6, 8.6);

    if (this.isValidPlacement(cx, cz, entry.uid)) {
      entry.x = cx;
      entry.z = cz;
      const groundY = this.level.getTerrainHeight(cx, cz);
      entry.group.position.set(cx, groundY, cz);
      entry.popAnim = 0.24;
      this.audio.playDecorPlace(false);
      this._persist();
    } else {
      // Snap back to previous valid coordinates
      const oldY = this.level.getTerrainHeight(entry.x, entry.z);
      entry.group.position.set(entry.x, oldY, entry.z);
      this._flashHint('Zone réservée au chantier ou à l’eau');
      this.audio.playMapTap(true);
    }

    this.selectedPlacedUid = entry.uid;
    this._updateSelectionRing();
    this._syncPropActionsUI();
  }

  _showTransientReticle(x, z, valid) {
    const y = Math.max(
      this.level && typeof this.level.getTerrainHeight === 'function'
        ? this.level.getTerrainHeight(x, z)
        : 0,
      WATER_LEVEL + 0.05
    );
    this.reticleMesh.position.set(x, y + 0.05, z);
    this.reticleMat.color.setHex(valid ? 0x67e88d : 0xff6258);
    this.reticleMesh.visible = true;
    clearTimeout(this._reticleTimer);
    this._reticleTimer = setTimeout(() => {
      this.reticleMesh.visible = false;
    }, 520);
  }

  _flashHint(msg) {
    if (!this.dockHintEl) return;
    this.dockHintEl.textContent = msg;
    this.dockHintEl.classList.add('is-warn');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this.dockHintEl.classList.remove('is-warn');
      this._updateDefaultHint();
    }, 1800);
  }

  _updateDefaultHint() {
    if (!this.dockHintEl) return;
    const unlocked = this.save.getUnlockedFurniture();
    if (unlocked.length === 0) {
      this.dockHintEl.textContent = 'Débloquez des meubles dans la Boutique (onglet Meubles)';
    } else if (this.selectedCatalogId) {
      const meta = getFurnitureById(this.selectedCatalogId);
      this.dockHintEl.textContent = `Touchez le sable libre pour poser : ${meta ? meta.name : ''}`;
    } else {
      this.dockHintEl.textContent = 'Choisissez un meuble ci-dessous puis touchez le terrain';
    }
  }

  _syncPropActionsUI() {
    if (!this.propActionsEl) return;
    const show = this.active && Boolean(this.selectedPlacedUid);
    this.propActionsEl.hidden = !show;
  }

  _updateSelectionRing() {
    const entry = this.placedItems.find((p) => p.uid === this.selectedPlacedUid);
    if (!entry || !this.active) {
      this.selectionRing.visible = false;
      return;
    }
    const y = this.level.getTerrainHeight(entry.x, entry.z);
    this.selectionRing.position.set(entry.x, y + 0.05, entry.z);
    this.selectionRing.visible = true;
  }

  renderDock() {
    if (!this.dockListEl) return;
    const unlocked = this.save.getUnlockedFurniture();
    this.dockListEl.innerHTML = '';

    if (unlocked.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'decorate-empty';
      empty.innerHTML = `<span>Aucun meuble débloqué pour l’instant.</span>`;
      if (this.onOpenShop) {
        const goShopBtn = document.createElement('button');
        goShopBtn.type = 'button';
        goShopBtn.className = 'decorate-shop-shortcut';
        goShopBtn.textContent = 'Ouvrir la Boutique';
        goShopBtn.addEventListener('click', () => {
          this.audio.unlock();
          this.audio.playTabBounce();
          this.setActive(false);
          this.onOpenShop();
        });
        empty.appendChild(goShopBtn);
      }
      this.dockListEl.appendChild(empty);
      this._updateDefaultHint();
      return;
    }

    unlocked.forEach((itemId) => {
      const item = getFurnitureById(itemId);
      if (!item) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `decorate-item-btn${this.selectedCatalogId === itemId ? ' is-selected' : ''}`;
      btn.dataset.decorItemId = itemId;
      btn.innerHTML = `
        <img src="${item.img}" alt="${item.name}" />
        <span>${item.name}</span>
      `;
      btn.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.selectedCatalogId = itemId;
        this.renderDock();
      });
      this.dockListEl.appendChild(btn);
    });

    this._updateDefaultHint();
  }

  _spawnPropMesh({ uid, itemId, x, z, rotY = 0, animate = false }) {
    const meta = getFurnitureById(itemId);
    if (!meta) return null;

    const group = new THREE.Group();
    const groundY =
      this.level && typeof this.level.getTerrainHeight === 'function'
        ? this.level.getTerrainHeight(x, z)
        : 0;
    group.position.set(x, groundY, z);

    // Ground contact shadow blob
    const shadowMesh = new THREE.Mesh(this.shadowGeo, this.textures.materials.shadowBlob);
    shadowMesh.position.y = 0.025;
    group.add(shadowMesh);

    // Carved sandstone pedestal plinth
    const plinthGroup = new THREE.Group();
    const plinth = new THREE.Mesh(this.plinthGeo, this.plinthMat);
    plinth.position.y = 0.045;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    plinthGroup.add(plinth);
    group.add(plinthGroup);

    // High-clarity transparent PNG diorama cutout plane (alpha-tested for clean lighting & depth)
    const size = meta.scale || 1.65;
    const cardGeo = new THREE.PlaneGeometry(size, size);
    const cardTex = getFurnitureTexture(meta.img);
    const cardMat = new THREE.MeshStandardMaterial({
      map: cardTex,
      alphaTest: 0.32,
      roughness: 0.72,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    const cardMesh = new THREE.Mesh(cardGeo, cardMat);
    cardMesh.position.y = 0.08 + size * 0.48;
    // Slight 8° backward tilt for optimal isometric camera readability
    cardMesh.rotation.x = -0.14;
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = false;
    group.add(cardMesh);

    const entry = {
      uid,
      itemId,
      x,
      z,
      rotY,
      group,
      plinthGroup,
      cardMesh,
      popAnim: animate ? 0.34 : 0,
      geometries: [cardGeo],
      materials: [cardMat],
    };

    this._applyPropOrientation(entry);
    group.userData.interact = { type: 'decor-prop', entry };
    this.root.add(group);
    this.placedItems.push(entry);
    return entry;
  }

  _restoreSavedDecorations() {
    const saved = this.save.getDecorations(this.levelKey);
    saved.forEach((d) => {
      if (!this.save.hasFurniture(d.itemId)) return;
      if (!this.isValidPlacement(d.x, d.z)) return;
      this._spawnPropMesh({
        uid: d.uid,
        itemId: d.itemId,
        x: d.x,
        z: d.z,
        rotY: d.rotY || 0,
        animate: false,
      });
    });
  }

  _persist() {
    this.save.saveDecorations(this.levelKey, this.placedItems);
  }

  update(dt, elapsed) {
    // Animate bouncy pop-in on newly placed or rotated props
    for (let i = 0; i < this.placedItems.length; i++) {
      const p = this.placedItems[i];
      if (p.popAnim > 0) {
        p.popAnim = Math.max(0, p.popAnim - dt);
        const t = 1 - p.popAnim / 0.34;
        const overshoot = 1 + Math.sin(t * Math.PI) * 0.16;
        p.group.scale.setScalar(overshoot);
      } else if (p.group.scale.x !== 1) {
        p.group.scale.setScalar(1);
      }
    }

    if (this.selectionRing.visible) {
      const pulse = 1 + Math.sin(elapsed * 6.0) * 0.06;
      this.selectionRing.scale.setScalar(pulse);
    }
  }

  _disposePropEntry(entry) {
    this.root.remove(entry.group);
    entry.geometries.forEach((g) => g.dispose());
    entry.materials.forEach((m) => m.dispose());
  }

  dispose() {
    clearTimeout(this._reticleTimer);
    clearTimeout(this._hintTimer);

    this.setActive(false);

    if (this.toggleBtn) this.toggleBtn.removeEventListener('click', this._onToggleClick);
    if (this.rotateBtn) this.rotateBtn.removeEventListener('click', this._onRotateClick);
    if (this.removeBtn) this.removeBtn.removeEventListener('click', this._onRemoveClick);
    if (this.doneBtn) this.doneBtn.removeEventListener('click', this._onDoneClick);

    this.placedItems.forEach((entry) => this._disposePropEntry(entry));
    this.placedItems.length = 0;

    this.scene.remove(this.root);
    this.plinthGeo.dispose();
    this.plinthMat.dispose();
    this.shadowGeo.dispose();
    this.selRingGeo.dispose();
    this.selRingMat.dispose();
    this.reticleGeo.dispose();
    this.reticleMat.dispose();
  }
}
