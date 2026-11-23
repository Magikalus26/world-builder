/**
 * Workd Builder — Precision Touch Raycasting & Drag-and-Drop Engine
 * Handles 1-finger block drag-and-drop (with elevated hover lift, ground drop-shadow
 * indicator, valid drop-zone highlighting, magnetic snapping), sled dragging/lever taps,
 * quarry tap/hold chipping, workbench tap/swipe carving, and seamless 2-finger camera gestures.
 */

import * as THREE from 'three';

const PRIORITY = {
  'workbench-carve': 1,
  block: 2,
  'map-node': 2,
  'sled-lever': 3,
  sled: 4,
  'quarry-node': 5,
};

export class TouchInteractionEngine {
  constructor({ canvas, camera, scene, cameraController, textures, audio }) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;
    this.cameraController = cameraController;
    this.audio = audio;

    this.level = null;
    this.decorationSystem = null;
    this.activeDecorEntry = null;
    this.enabled = true;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeHit = new THREE.Vector3();

    // Active pointer tracking for multi-touch pinch & twist
    this.pointers = new Map();
    this.mode = 'IDLE'; // IDLE | PAN | ROTATE | MULTI | DRAG_BLOCK | DRAG_SLED | QUARRY_HOLD | WORKBENCH_CARVE | DECOR_DRAG | DECOR_PAN

    // Single-pointer gesture state
    this.primaryId = null;
    this.downX = 0;
    this.downY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastMoveTime = performance.now();
    this.movedDist = 0;

    // Active gameplay targets
    this.dragBlock = null;
    this.dragHoverY = 1.65;
    this.dragTargetPos = new THREE.Vector3();
    this.dragVisualPos = new THREE.Vector3();
    this.dragVelocity = new THREE.Vector3();
    this.activeSnapZone = null;
    this.shadowGroundY = 0.03;

    this.activeSled = null;
    this.activeQuarryNode = null;
    this.quarryHoldAccum = 0;

    this.workbenchSwipeDist = 0;
    this.workbenchDidSwipe = false;
    this.workbenchLastCarveTime = 0;

    // Multi-touch gesture tracking
    this.multiPrevDist = 0;
    this.multiPrevAngle = 0;
    this.multiPrevMidX = 0;
    this.multiPrevMidY = 0;

    // Ground drop-shadow + magnetic target ring indicator
    this.dropIndicator = this._createDropIndicator(textures);
    this.dropIndicator.visible = false;
    this.scene.add(this.dropIndicator);

    this._bindEvents();
  }

  _createDropIndicator(textures) {
    const group = new THREE.Group();
    group.renderOrder = 2;

    const shadowGeo = new THREE.PlaneGeometry(1.38, 1.38);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMesh = new THREE.Mesh(shadowGeo, textures.materials.shadowBlob);
    group.add(shadowMesh);

    const ringGeo = new THREE.RingGeometry(0.46, 0.56, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.dropRingMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.dropRing = new THREE.Mesh(ringGeo, this.dropRingMat);
    this.dropRing.position.y = 0.015;
    group.add(this.dropRing);

    return group;
  }

  setLevel(level) {
    this.cancelActiveInteraction();
    this.level = level;
  }

  setDecorationSystem(deco) {
    this.cancelActiveInteraction();
    this.decorationSystem = deco;
  }

  setEnabled(flag) {
    this.enabled = flag;
    if (!flag) {
      this.cancelActiveInteraction();
    }
  }

  isCameraGestureActive() {
    return this.mode === 'PAN' || this.mode === 'DECOR_PAN' || this.mode === 'ROTATE' || this.mode === 'MULTI';
  }

  cancelActiveInteraction() {
    if (this.mode === 'DRAG_BLOCK' && this.dragBlock && this.level) {
      this.level.onBlockDragCancel(this.dragBlock);
      this.level.clearDropHighlights();
    } else if (this.mode === 'DRAG_SLED' && this.activeSled && this.level) {
      this.level.onSledDragEnd(this.activeSled);
    } else if (this.mode === 'DECOR_DRAG' && this.activeDecorEntry && this.decorationSystem) {
      this.decorationSystem.endPropDrag(
        this.activeDecorEntry,
        this.activeDecorEntry.x,
        this.activeDecorEntry.z
      );
    }

    this.mode = 'IDLE';
    this.primaryId = null;
    this.dragBlock = null;
    this.activeSnapZone = null;
    this.activeSled = null;
    this.activeQuarryNode = null;
    this.activeDecorEntry = null;
    this.quarryHoldAccum = 0;
    this.dropIndicator.visible = false;
  }

  _bindEvents() {
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onContextMenu = (e) => e.preventDefault();
    this._onTouchPrevent = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };

    const el = this.canvas;
    el.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { passive: false });
    window.addEventListener('pointercancel', this._onPointerUp, { passive: false });
    el.addEventListener('wheel', this._onWheel, { passive: false });
    el.addEventListener('contextmenu', this._onContextMenu);
    el.addEventListener('touchstart', this._onTouchPrevent, { passive: false });
  }

  _screenToRay(clientX, clientY, yOffsetPx = 0) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const y = -(((clientY + yOffsetPx - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  _raycastGroundPlane(clientX, clientY, planeY = 0, yOffsetPx = 0) {
    this._screenToRay(clientX, clientY, yOffsetPx);
    this.dragPlane.set(new THREE.Vector3(0, 1, 0), -planeY);
    return this.raycaster.ray.intersectPlane(this.dragPlane, this.planeHit);
  }

  _pickInteractable(clientX, clientY, pointerType = 'mouse') {
    if (!this.level) return null;
    const targets = this.level.getHitTargets();
    if (!targets || targets.length === 0) return null;

    this._screenToRay(clientX, clientY, 0);
    const hits = this.raycaster.intersectObjects(targets, true);

    let best = null;
    let bestPriority = 999;

    for (let i = 0; i < hits.length; i++) {
      let obj = hits[i].object;
      let interact = null;
      while (obj) {
        if (obj.userData && obj.userData.interact) {
          interact = obj.userData.interact;
          break;
        }
        obj = obj.parent;
      }
      if (!interact) continue;
      const p = PRIORITY[interact.type] ?? 50;
      if (p < bestPriority) {
        bestPriority = p;
        best = { interact, hit: hits[i] };
        if (p === 1) break;
      }
    }

    // Mobile touch precision assist: if direct ray missed a block (or grazed a lower-priority
    // quarry node / sled right behind a stored block), check unlocked draggable blocks within
    // a tight screen-space finger tolerance so stored quarry blocks always pick up cleanly!
    if (
      (!best || bestPriority > PRIORITY.block) &&
      bestPriority !== PRIORITY['sled-lever'] &&
      typeof this.level.getDraggableItems === 'function'
    ) {
      const draggables = this.level.getDraggableItems();
      if (draggables && draggables.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const maxPx = pointerType === 'touch' ? 22 : 16;
        const maxDistSq = maxPx * maxPx;
        const tmp = new THREE.Vector3();
        let closestBlock = null;
        let closestDistSq = maxDistSq;

        for (let i = 0; i < draggables.length; i++) {
          const mesh = draggables[i];
          if (!mesh || !mesh.visible || !mesh.userData || !mesh.userData.draggable) continue;
          const inter = mesh.userData.interact;
          if (!inter || inter.type !== 'block' || !inter.block || inter.block.locked) continue;

          mesh.getWorldPosition(tmp);
          tmp.project(this.camera);
          if (tmp.z < -1 || tmp.z > 1) continue;

          const sx = rect.left + (tmp.x * 0.5 + 0.5) * rect.width;
          const sy = rect.top + (-tmp.y * 0.5 + 0.5) * rect.height;
          const dx = clientX - sx;
          const dy = clientY - sy;
          const dSq = dx * dx + dy * dy;
          if (dSq < closestDistSq) {
            closestDistSq = dSq;
            closestBlock = { interact: inter, hit: { object: mesh, point: mesh.position.clone() } };
          }
        }
        if (closestBlock) {
          return closestBlock;
        }
      }
    }

    return best;
  }

  _handlePointerDown(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;

    e.preventDefault();
    this.audio.unlock();
    this.cameraController.stopInertia();

    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      // Ignore if capture is unsupported
    }

    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    });

    // Transition seamlessly to 2-finger pinch/twist whenever 2 pointers are active
    if (this.pointers.size >= 2) {
      if (this.mode !== 'MULTI') {
        this.cancelActiveInteraction();
        this._beginMultiTouch();
      }
      return;
    }

    // Desktop right-click or Shift-click rotates camera smoothly
    if (e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey)) {
      this.mode = 'ROTATE';
      this.primaryId = e.pointerId;
      this.downX = this.lastX = e.clientX;
      this.downY = this.lastY = e.clientY;
      this.lastMoveTime = performance.now();
      return;
    }

    this.primaryId = e.pointerId;
    this.downX = this.lastX = e.clientX;
    this.downY = this.lastY = e.clientY;
    this.movedDist = 0;
    this.lastMoveTime = performance.now();

    // If level is complete / in victory orbit, don't intercept gameplay objects
    if (this.cameraController.isVictoryOrbit) {
      this.mode = 'IDLE';
      return;
    }

    // Decoration Mode intercepts terrain taps (to place) and placed furniture props (to select/drag)
    if (this.decorationSystem && this.decorationSystem.isActive()) {
      const decorTargets = this.decorationSystem.getHitTargets();
      if (decorTargets.length > 0) {
        this._screenToRay(e.clientX, e.clientY, 0);
        const hits = this.raycaster.intersectObjects(decorTargets, true);
        for (let i = 0; i < hits.length; i++) {
          let obj = hits[i].object;
          while (obj) {
            if (obj.userData && obj.userData.interact && obj.userData.interact.type === 'decor-prop') {
              this.mode = 'DECOR_DRAG';
              this.activeDecorEntry = obj.userData.interact.entry;
              return;
            }
            obj = obj.parent;
          }
        }
      }
      this.mode = 'DECOR_PAN';
      return;
    }

    const picked = this._pickInteractable(e.clientX, e.clientY, e.pointerType);
    if (!picked) {
      this.mode = 'PAN';
      return;
    }

    const { interact } = picked;

    if (interact.type === 'workbench-carve') {
      this.mode = 'WORKBENCH_CARVE';
      this.workbenchSwipeDist = 0;
      this.workbenchDidSwipe = false;
      return;
    }

    if (interact.type === 'block') {
      const info = this.level.onBlockDragStart(interact.block);
      if (!info) {
        this.mode = 'PAN';
        return;
      }
      this.mode = 'DRAG_BLOCK';
      this.dragBlock = interact.block;
      this.dragHoverY = info.hoverY ?? 1.65;
      this.dragVisualPos.copy(interact.block.mesh.position);
      this.dragTargetPos.copy(this.dragVisualPos);
      this.dragTargetPos.y = this.dragHoverY;
      this.dragVelocity.set(0, 0, 0);

      // Immediately project initial touch onto hover plane
      const thumbOffset = e.pointerType === 'touch' ? -30 : 0;
      if (this._raycastGroundPlane(e.clientX, e.clientY, this.dragHoverY, thumbOffset)) {
        this.dragTargetPos.set(this.planeHit.x, this.dragHoverY, this.planeHit.z);
      }
      this._refreshBlockDropZones();
      this.dropIndicator.visible = true;
      return;
    }

    if (interact.type === 'sled-lever') {
      this.level.onSledLeverTap(interact.sled);
      this.mode = 'IDLE';
      return;
    }

    if (interact.type === 'sled') {
      this.mode = 'DRAG_SLED';
      this.activeSled = interact.sled;
      this.level.onSledDragStart(interact.sled);
      return;
    }

    if (interact.type === 'map-node') {
      this.mode = 'MAP_TAP';
      this.activeMapNode = interact.node;
      return;
    }

    if (interact.type === 'quarry-node') {
      this.mode = 'QUARRY_HOLD';
      this.activeQuarryNode = interact.node;
      this.quarryHoldAccum = 0;
      this.level.chipQuarryNode(interact.node);
      return;
    }

    this.mode = 'PAN';
  }

  _beginMultiTouch() {
    this.mode = 'MULTI';
    const pts = Array.from(this.pointers.values());
    const a = pts[0];
    const b = pts[1];
    this.multiPrevDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    this.multiPrevAngle = Math.atan2(b.y - a.y, b.x - a.x);
    this.multiPrevMidX = (a.x + b.x) * 0.5;
    this.multiPrevMidY = (a.y + b.y) * 0.5;
  }

  _handlePointerMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();

    const p = this.pointers.get(e.pointerId);
    p.x = e.clientX;
    p.y = e.clientY;

    const now = performance.now();
    const dt = Math.min(Math.max((now - this.lastMoveTime) / 1000, 0.004), 0.05);
    this.lastMoveTime = now;

    if (this.mode === 'MULTI' && this.pointers.size >= 2) {
      const pts = Array.from(this.pointers.values());
      const a = pts[0];
      const b = pts[1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;

      const scaleFactor = dist / Math.max(this.multiPrevDist, 1);
      let angleDelta = angle - this.multiPrevAngle;
      if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

      const midDx = midX - this.multiPrevMidX;
      const midDy = midY - this.multiPrevMidY;

      this.cameraController.pinchAndTwist(scaleFactor, angleDelta, midDx, midDy, dt);

      this.multiPrevDist = dist;
      this.multiPrevAngle = angle;
      this.multiPrevMidX = midX;
      this.multiPrevMidY = midY;
      return;
    }

    if (e.pointerId !== this.primaryId) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.movedDist += Math.hypot(dx, dy);

    if (this.mode === 'PAN' || this.mode === 'DECOR_PAN') {
      this.cameraController.panByScreenDelta(dx, dy, dt);
      return;
    }

    if (this.mode === 'DECOR_DRAG' && this.activeDecorEntry && this.decorationSystem) {
      if (this.movedDist > 8 && this._raycastGroundPlane(e.clientX, e.clientY, 0.25, 0)) {
        this.decorationSystem.updatePropDrag(this.activeDecorEntry, this.planeHit.x, this.planeHit.z);
      }
      return;
    }

    if (this.mode === 'ROTATE') {
      this.cameraController.rotateByScreenDelta(dx, dt);
      return;
    }

    if (this.mode === 'DRAG_BLOCK' && this.dragBlock) {
      const thumbOffset = e.pointerType === 'touch' ? -30 : 0;
      if (this._raycastGroundPlane(e.clientX, e.clientY, this.dragHoverY, thumbOffset)) {
        // Keep block within playable diorama area
        const clampedX = THREE.MathUtils.clamp(this.planeHit.x, -9.5, 9.5);
        const clampedZ = THREE.MathUtils.clamp(this.planeHit.z, -9.5, 9.5);
        this.dragTargetPos.set(clampedX, this.dragHoverY, clampedZ);
        this._refreshBlockDropZones();
      }
      return;
    }

    if (this.mode === 'DRAG_SLED' && this.activeSled) {
      if (this._raycastGroundPlane(e.clientX, e.clientY, 0.25, 0)) {
        this.level.onSledDragMove(this.activeSled, this.planeHit);
      }
      return;
    }

    if (this.mode === 'WORKBENCH_CARVE' && this.level) {
      const stepDist = Math.hypot(dx, dy);
      this.workbenchSwipeDist += stepDist;
      if (this.workbenchSwipeDist >= 26 && now - this.workbenchLastCarveTime >= 200) {
        this.workbenchSwipeDist = 0;
        this.workbenchDidSwipe = true;
        this.workbenchLastCarveTime = now;
        const stillUncarved = this.level.carveWorkbenchBlock({ dx, dy });
        if (!stillUncarved) {
          this.mode = 'IDLE';
        }
      }
      return;
    }

    if (this.mode === 'MAP_TAP') {
      if (this.movedDist > 14) {
        this.activeMapNode = null;
        this.mode = 'PAN';
        this.cameraController.panByScreenDelta(dx, dy, dt);
      }
      return;
    }

    if (this.mode === 'QUARRY_HOLD') {
      if (this.movedDist > 34) {
        // Finger slid away from rock node; transition cleanly into camera pan
        this.activeQuarryNode = null;
        this.mode = 'PAN';
      }
    }
  }

  _handlePointerUp(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);

    if (this.mode === 'MULTI') {
      if (this.pointers.size < 2) {
        this.mode = 'IDLE';
        this.primaryId = null;
      }
      return;
    }

    if (e.pointerId !== this.primaryId) return;

    if (this.mode === 'DECOR_DRAG' && this.activeDecorEntry && this.decorationSystem) {
      if (this.movedDist <= 10) {
        this.decorationSystem.selectPlacedProp(this.activeDecorEntry);
      } else if (this._raycastGroundPlane(e.clientX, e.clientY, 0.25, 0)) {
        this.decorationSystem.endPropDrag(this.activeDecorEntry, this.planeHit.x, this.planeHit.z);
      } else {
        this.decorationSystem.endPropDrag(
          this.activeDecorEntry,
          this.activeDecorEntry.x,
          this.activeDecorEntry.z
        );
      }
      this.activeDecorEntry = null;
    } else if (this.mode === 'DECOR_PAN' && this.decorationSystem) {
      if (this.movedDist < 12 && this._raycastGroundPlane(e.clientX, e.clientY, 0.15, 0)) {
        this.decorationSystem.tryPlaceSelectedAt(this.planeHit.x, this.planeHit.z);
      }
    } else if (this.mode === 'DRAG_BLOCK' && this.dragBlock && this.level) {
      const block = this.dragBlock;
      const snap = this.activeSnapZone;
      this.level.clearDropHighlights();
      if (snap) {
        this.level.onBlockDrop(block, snap);
      } else {
        this.level.onBlockDragCancel(block);
      }
      this.dragBlock = null;
      this.activeSnapZone = null;
      this.dropIndicator.visible = false;
    } else if (this.mode === 'DRAG_SLED' && this.activeSled && this.level) {
      if (this.movedDist < 12) {
        this.level.onSledTap(this.activeSled);
      } else {
        this.level.onSledDragEnd(this.activeSled);
      }
      this.activeSled = null;
    } else if (this.mode === 'WORKBENCH_CARVE' && this.level) {
      const now = performance.now();
      if (!this.workbenchDidSwipe && this.movedDist < 24 && now - this.workbenchLastCarveTime >= 110) {
        this.workbenchLastCarveTime = now;
        this.level.carveWorkbenchBlock(null);
      }
    } else if (this.mode === 'MAP_TAP' && this.activeMapNode && this.level) {
      if (this.movedDist <= 14 && typeof this.level.onMapNodeTap === 'function') {
        this.level.onMapNodeTap(this.activeMapNode);
      }
      this.activeMapNode = null;
    } else if (this.mode === 'PAN' && this.level) {
      if (this.movedDist < 10 && typeof this.level.onEmptyGroundTap === 'function') {
        this.level.onEmptyGroundTap();
      }
    } else if (this.mode === 'QUARRY_HOLD') {
      this.activeQuarryNode = null;
    }

    this.mode = 'IDLE';
    this.primaryId = null;
  }

  _handleWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.cameraController.zoomByWheel(e.deltaY);
  }

  _refreshBlockDropZones() {
    if (!this.level || !this.dragBlock) return;
    const result = this.level.evaluateDropZones(this.dragBlock, this.dragTargetPos);
    this.activeSnapZone = result ? result.snapZone : null;
    this.shadowGroundY = result && typeof result.groundY === 'number' ? result.groundY : 0.03;
  }

  update(dt, elapsed) {
    // Hold-to-chip on Quarry rock nodes
    if (this.mode === 'QUARRY_HOLD' && this.activeQuarryNode && this.level) {
      this.quarryHoldAccum += dt;
      if (this.quarryHoldAccum >= 0.24) {
        this.quarryHoldAccum -= 0.24;
        this.level.chipQuarryNode(this.activeQuarryNode);
      }
    }

    // Smooth elevated hover lift + magnetic pull + ground drop-shadow indicator
    if (this.mode === 'DRAG_BLOCK' && this.dragBlock) {
      const targetX = this.activeSnapZone
        ? THREE.MathUtils.lerp(this.dragTargetPos.x, this.activeSnapZone.position.x, 0.58)
        : this.dragTargetPos.x;
      const targetZ = this.activeSnapZone
        ? THREE.MathUtils.lerp(this.dragTargetPos.z, this.activeSnapZone.position.z, 0.58)
        : this.dragTargetPos.z;
      const indX = this.activeSnapZone ? this.activeSnapZone.position.x : this.dragVisualPos.x;
      const indZ = this.activeSnapZone ? this.activeSnapZone.position.z : this.dragVisualPos.z;
      const liveGroundY =
        !this.activeSnapZone && this.level && typeof this.level.getTerrainHeight === 'function'
          ? Math.max(this.level.getTerrainHeight(indX, indZ), this.shadowGroundY)
          : this.shadowGroundY;

      const hoverBoost = this.activeSnapZone
        ? Math.max(this.dragHoverY, this.activeSnapZone.position.y + 1.05)
        : Math.max(this.dragHoverY, liveGroundY + 1.05);
      const bob = Math.sin(elapsed * 6.5) * 0.045;

      const prevX = this.dragVisualPos.x;
      const prevZ = this.dragVisualPos.z;
      const alpha = 1 - Math.exp(-22 * dt);

      this.dragVisualPos.x = THREE.MathUtils.lerp(this.dragVisualPos.x, targetX, alpha);
      this.dragVisualPos.y = THREE.MathUtils.lerp(this.dragVisualPos.y, hoverBoost + bob, alpha);
      this.dragVisualPos.z = THREE.MathUtils.lerp(this.dragVisualPos.z, targetZ, alpha);

      const vx = (this.dragVisualPos.x - prevX) / Math.max(dt, 0.008);
      const vz = (this.dragVisualPos.z - prevZ) / Math.max(dt, 0.008);

      const mesh = this.dragBlock.mesh;
      mesh.position.copy(this.dragVisualPos);
      // Juicy tactile inertia tilt while carrying the stone block
      mesh.rotation.z = THREE.MathUtils.lerp(
        mesh.rotation.z,
        THREE.MathUtils.clamp(-vx * 0.025, -0.22, 0.22),
        0.24
      );
      mesh.rotation.x = THREE.MathUtils.lerp(
        mesh.rotation.x,
        THREE.MathUtils.clamp(vz * 0.025, -0.22, 0.22),
        0.24
      );

      // Update ground drop-shadow indicator directly beneath carried block (or snapped slot)
      const indY = this.activeSnapZone
        ? this.activeSnapZone.dropIndicatorY ?? liveGroundY
        : liveGroundY;

      this.dropIndicator.position.set(indX, indY + 0.03, indZ);
      const ringPulse = this.activeSnapZone ? 1.08 + Math.sin(elapsed * 10) * 0.05 : 0.92;
      this.dropRing.scale.setScalar(ringPulse);
      this.dropRingMat.color.setHex(this.activeSnapZone ? 0xffd25a : 0xfff3d4);
      this.dropRingMat.opacity = this.activeSnapZone ? 0.92 : 0.42;
    }
  }

  dispose() {
    const el = this.canvas;
    el.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    el.removeEventListener('wheel', this._onWheel);
    el.removeEventListener('contextmenu', this._onContextMenu);
    el.removeEventListener('touchstart', this._onTouchPrevent);

    this.scene.remove(this.dropIndicator);
    this.dropIndicator.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    this.dropRingMat.dispose();
  }
}
