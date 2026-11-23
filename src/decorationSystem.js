/**
 * Workd Builder — In-Level 3D Furniture Decoration System
 * Spawns genuine multi-part procedural 3D furniture models (from src/furnitureModels.js)
 * onto valid sculpted terrain coordinates (y = level.getTerrainHeight(x, z)), complete with
 * contact drop shadows, placement dust puffs, true 90° Y-axis rotation, drag-to-reposition,
 * blocked work-station protection, and automatic localStorage persistence.
 */

import * as THREE from 'three';
import { getFurnitureById } from './saveManager.js';
import {
  createFurniture3D,
  updateFurniture3D,
  disposeFurniture3DInstance,
} from './furnitureModels.js';

const WATER_LEVEL = -0.14;

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
    this.placedItems = []; // { uid, itemId, x, z, rotY, group, model, popAnim }
    this.dustPuffs = []; // Active transient sand dust puff bursts

    this.root = new THREE.Group();
    this.root.name = 'decorations_root';
    this.scene.add(this.root);

    // Shared per-level geometries & materials (disposed cleanly on level unload)
    this.shadowGeo = new THREE.PlaneGeometry(1.58, 1.58);
    this.shadowGeo.rotateX(-Math.PI / 2);

    this.dustGeo = new THREE.SphereGeometry(0.11, 7, 6);
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xeed5a3,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    // Selection highlight ring around active 3D furniture piece
    this.selRingGeo = new THREE.RingGeometry(0.68, 0.82, 32);
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
    this.reticleGeo = new THREE.RingGeometry(0.56, 0.74, 32);
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
    entry.group.rotation.y = entry.rotY;
    entry.popAnim = 0.22;
    this.audio.playDecorPlace(true);
    this._persist();
  }

  _handleRemoveClick() {
    this.audio.unlock();
    const idx = this.placedItems.findIndex((p) => p.uid === this.selectedPlacedUid);
    if (idx === -1) return;
    const [removed] = this.placedItems.splice(idx, 1);
    const y = this.level.getTerrainHeight(removed.x, removed.z);
    this._spawnDustPuff(removed.x, y, removed.z);
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

    // Avoid overlapping another placed 3D furniture piece
    for (let i = 0; i < this.placedItems.length; i++) {
      const other = this.placedItems[i];
      if (other.uid === ignoreUid) continue;
      if (Math.hypot(other.x - x, other.z - z) < 1.25) {
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

    const groundY = this.level.getTerrainHeight(x, z);
    this._spawnDustPuff(x, groundY, z);
    this.selectedPlacedUid = entry.uid;
    this._updateSelectionRing();
    this._syncPropActionsUI();
    this._showTransientReticle(x, z, true);
    this.audio.playDecorPlace(false);
    this._persist();
    return true;
  }

  /**
   * Selects a placed 3D furniture prop (called on tap in Decoration Mode).
   */
  selectPlacedProp(entry) {
    if (!entry) return;
    this.selectedPlacedUid = entry.uid;
    this._updateSelectionRing();
    this._syncPropActionsUI();
    this.audio.playTabBounce();
  }

  /**
   * Live preview while dragging an existing placed 3D prop across terrain.
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
   * Finalizes dragging a placed 3D prop: commits with dust puff if valid, snaps back if blocked.
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
      this._spawnDustPuff(cx, groundY, cz);
      this.audio.playDecorPlace(false);
      this._persist();
    } else {
      const oldY = this.level.getTerrainHeight(entry.x, entry.z);
      entry.group.position.set(entry.x, oldY, entry.z);
      this._flashHint('Zone réservée au chantier ou à l’eau');
      this.audio.playMapTap(true);
    }

    this.selectedPlacedUid = entry.uid;
    this._updateSelectionRing();
    this._syncPropActionsUI();
  }

  /**
   * Spawns a lightweight tactile ring of warm sand dust puffs around a placed 3D prop.
   */
  _spawnDustPuff(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.08, z);
    const mat = this.dustMat.clone();
    const particles = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + (i % 2) * 0.2;
      const m = new THREE.Mesh(this.dustGeo, mat);
      const speed = 1.15 + (i % 3) * 0.28;
      m.position.set(Math.cos(ang) * 0.28, 0, Math.sin(ang) * 0.28);
      group.add(m);
      particles.push({
        mesh: m,
        vx: Math.cos(ang) * speed,
        vy: 0.45 + (i % 2) * 0.25,
        vz: Math.sin(ang) * speed,
      });
    }
    this.root.add(group);
    this.dustPuffs.push({ group, mat, particles, age: 0, duration: 0.44 });
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
    group.rotation.y = rotY;

    // Ground contact shadow blob
    const shadowMesh = new THREE.Mesh(this.shadowGeo, this.textures.materials.shadowBlob);
    shadowMesh.position.y = 0.025;
    group.add(shadowMesh);

    // Genuine multi-part procedural 3D PBR model grounded cleanly at y = 0
    const model = createFurniture3D(itemId, this.textures);
    group.add(model);

    const entry = {
      uid,
      itemId,
      x,
      z,
      rotY,
      group,
      model,
      popAnim: animate ? 0.34 : 0,
    };

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
    // Animate bouncy pop-in + per-item ambient 3D effects (embers, water, lantern, lock)
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
      updateFurniture3D(p.model, dt, elapsed);
    }

    // Update transient placement dust puffs
    for (let i = this.dustPuffs.length - 1; i >= 0; i--) {
      const puff = this.dustPuffs[i];
      puff.age += dt;
      const t = puff.age / puff.duration;
      if (t >= 1) {
        this.root.remove(puff.group);
        puff.mat.dispose();
        this.dustPuffs.splice(i, 1);
        continue;
      }
      puff.mat.opacity = 0.72 * (1 - t);
      const scale = 0.8 + t * 1.1;
      for (let j = 0; j < puff.particles.length; j++) {
        const pt = puff.particles[j];
        pt.mesh.position.x += pt.vx * dt * (1 - t * 0.6);
        pt.mesh.position.y += pt.vy * dt * (1 - t * 0.5);
        pt.mesh.position.z += pt.vz * dt * (1 - t * 0.6);
        pt.mesh.scale.setScalar(scale);
      }
    }

    if (this.selectionRing.visible) {
      const pulse = 1 + Math.sin(elapsed * 6.0) * 0.06;
      this.selectionRing.scale.setScalar(pulse);
    }
  }

  _disposePropEntry(entry) {
    this.root.remove(entry.group);
    disposeFurniture3DInstance(entry.model);
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

    this.dustPuffs.forEach((puff) => {
      this.root.remove(puff.group);
      puff.mat.dispose();
    });
    this.dustPuffs.length = 0;

    this.scene.remove(this.root);
    this.shadowGeo.dispose();
    this.dustGeo.dispose();
    this.dustMat.dispose();
    this.selRingGeo.dispose();
    this.selRingMat.dispose();
    this.reticleGeo.dispose();
    this.reticleMat.dispose();
  }
}
