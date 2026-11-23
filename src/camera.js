/**
 * Workd Builder — Top-Down / Isometric Diorama Camera Controller
 * ~55° elevation angle with 1-finger ground pan, 2-finger pinch zoom,
 * 2-finger twist rotation, damped inertia, and victory orbit sequence.
 */

import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

export class DioramaCameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Default diorama framing (~55° elevation above horizon)
    this.defaultElevation = 55 * DEG2RAD;
    this.defaultAzimuth = 0.08; // Gentle isometric angle preserving clear portrait framing
    this.defaultTarget = new THREE.Vector3(-0.15, 0.35, 0.1);

    this.minDistance = 10.5;
    this.maxDistance = 56;
    this.panBounds = { minX: -8.5, maxX: 8.5, minZ: -8.2, maxZ: 8.5 };

    // Live smoothed state
    this.target = this.defaultTarget.clone();
    this.desiredTarget = this.defaultTarget.clone();

    this.azimuth = this.defaultAzimuth;
    this.desiredAzimuth = this.defaultAzimuth;

    this.elevation = this.defaultElevation;
    this.desiredElevation = this.defaultElevation;

    const initialDist = this._computeResponsiveDistance();
    this.distance = initialDist;
    this.desiredDistance = initialDist;

    // Inertial velocities (applied after finger release)
    this.panVelocity = new THREE.Vector3();
    this.azimuthVelocity = 0;

    // Victory celebration orbit state
    this.isVictoryOrbit = false;
    this.victoryOrbitSpeed = 0.42;

    // Scratch vectors (zero per-frame allocations)
    this._right = new THREE.Vector3();
    this._forwardXZ = new THREE.Vector3();
    this._delta = new THREE.Vector3();

    this._applyCameraTransform();
  }

  _computeResponsiveDistance() {
    const w = this.domElement.clientWidth || window.innerWidth || 390;
    const h = this.domElement.clientHeight || window.innerHeight || 844;
    const aspect = w / Math.max(h, 1);
    // Portrait iPhone 16e (390x844, aspect ~0.46) frames all 4 stations with clean margins
    if (aspect < 0.56) return 44.5;
    if (aspect < 0.72) return 38.0;
    if (aspect < 0.95) return 30.0;
    return 23.5;
  }

  handleResize(width, height) {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  /**
   * 1-finger ground pan mapped 1:1 to screen pixels at the diorama plane.
   */
  panByScreenDelta(dx, dy, dt = 1 / 60) {
    if (this.isVictoryOrbit) return;

    const viewH = this.domElement.clientHeight || window.innerHeight || 844;
    const fovRad = this.camera.fov * DEG2RAD;
    const worldPerPx = (2 * this.distance * Math.tan(fovRad * 0.5)) / viewH;

    const sinA = Math.sin(this.azimuth);
    const cosA = Math.cos(this.azimuth);
    const sinE = Math.max(Math.sin(this.elevation), 0.35);

    this._right.set(cosA, 0, -sinA);
    this._forwardXZ.set(-sinA, 0, -cosA);

    const moveRight = -dx * worldPerPx;
    const moveForward = (dy * worldPerPx) / sinE;

    this._delta
      .copy(this._right)
      .multiplyScalar(moveRight)
      .addScaledVector(this._forwardXZ, moveForward);

    this.desiredTarget.add(this._delta);
    this._clampTarget(this.desiredTarget);

    // Track damped inertia velocity
    const invDt = dt > 0.004 ? 1 / dt : 60;
    this.panVelocity.lerp(this._delta.clone().multiplyScalar(invDt * 0.35), 0.45);
  }

  /**
   * 2-finger simultaneous pinch zoom, twist rotation, and midpoint pan.
   */
  pinchAndTwist(scaleFactor, angleDeltaRad, midDx, midDy, dt = 1 / 60) {
    if (this.isVictoryOrbit) return;

    // Pinch zoom
    if (scaleFactor > 0.01 && Number.isFinite(scaleFactor)) {
      this.desiredDistance = THREE.MathUtils.clamp(
        this.desiredDistance / scaleFactor,
        this.minDistance,
        this.maxDistance
      );
    }

    // 2-finger twist rotation
    if (Number.isFinite(angleDeltaRad) && Math.abs(angleDeltaRad) < 0.6) {
      this.desiredAzimuth -= angleDeltaRad;
      const invDt = dt > 0.004 ? 1 / dt : 60;
      this.azimuthVelocity = THREE.MathUtils.lerp(
        this.azimuthVelocity,
        -angleDeltaRad * invDt * 0.32,
        0.4
      );
    }

    // Subtle midpoint pan
    if (Math.abs(midDx) > 0.01 || Math.abs(midDy) > 0.01) {
      this.panByScreenDelta(midDx, midDy, dt);
    }
  }

  /**
   * Desktop mouse wheel zoom helper.
   */
  zoomByWheel(deltaY) {
    if (this.isVictoryOrbit) return;
    const factor = 1 + THREE.MathUtils.clamp(deltaY * 0.0011, -0.25, 0.25);
    this.desiredDistance = THREE.MathUtils.clamp(
      this.desiredDistance * factor,
      this.minDistance,
      this.maxDistance
    );
  }

  /**
   * Desktop right-drag / shift-drag rotation helper.
   */
  rotateByScreenDelta(dx, dt = 1 / 60) {
    if (this.isVictoryOrbit) return;
    const dAngle = -dx * 0.0065;
    this.desiredAzimuth += dAngle;
    const invDt = dt > 0.004 ? 1 / dt : 60;
    this.azimuthVelocity = THREE.MathUtils.lerp(this.azimuthVelocity, dAngle * invDt * 0.3, 0.4);
  }

  /**
   * Stops active gesture inertia (e.g. when a new finger touches down).
   */
  stopInertia() {
    this.panVelocity.set(0, 0, 0);
    this.azimuthVelocity = 0;
  }

  /**
   * Smooth cinematic orbit around the completed 5-tier pyramid.
   */
  startVictoryOrbit(focusPoint) {
    this.isVictoryOrbit = true;
    this.stopInertia();
    this.desiredTarget.copy(focusPoint);
    this.desiredElevation = 31 * DEG2RAD;
    const aspect = this.camera.aspect || 0.46;
    this.desiredDistance = aspect < 0.7 ? 17.5 : 12.5;
  }

  stopVictoryOrbit() {
    this.isVictoryOrbit = false;
  }

  /**
   * Smoothly returns to the initial playable Level 1 diorama framing.
   */
  resetView(immediate = false) {
    this.isVictoryOrbit = false;
    this.stopInertia();
    this.desiredTarget.copy(this.defaultTarget);
    this.desiredAzimuth = this.defaultAzimuth;
    this.desiredElevation = this.defaultElevation;
    this.desiredDistance = this._computeResponsiveDistance();

    if (immediate) {
      this.target.copy(this.desiredTarget);
      this.azimuth = this.desiredAzimuth;
      this.elevation = this.desiredElevation;
      this.distance = this.desiredDistance;
      this._applyCameraTransform();
    }
  }

  _clampTarget(vec) {
    vec.x = THREE.MathUtils.clamp(vec.x, this.panBounds.minX, this.panBounds.maxX);
    vec.z = THREE.MathUtils.clamp(vec.z, this.panBounds.minZ, this.panBounds.maxZ);
  }

  update(dt, isGestureActive = false) {
    if (this.isVictoryOrbit) {
      this.desiredAzimuth += this.victoryOrbitSpeed * dt;
    } else if (!isGestureActive) {
      // Apply smooth exponential inertia decay
      if (this.panVelocity.lengthSq() > 0.0001) {
        this.desiredTarget.addScaledVector(this.panVelocity, dt);
        this._clampTarget(this.desiredTarget);
        const panDamp = Math.exp(-7.5 * dt);
        this.panVelocity.multiplyScalar(panDamp);
      } else {
        this.panVelocity.set(0, 0, 0);
      }

      if (Math.abs(this.azimuthVelocity) > 0.0005) {
        this.desiredAzimuth += this.azimuthVelocity * dt;
        this.azimuthVelocity *= Math.exp(-7.0 * dt);
      } else {
        this.azimuthVelocity = 0;
      }
    }

    // Frame-rate independent exponential smoothing
    const smooth = 1 - Math.exp((this.isVictoryOrbit ? -3.2 : -13.0) * dt);
    this.target.lerp(this.desiredTarget, smooth);
    this.azimuth = THREE.MathUtils.lerp(this.azimuth, this.desiredAzimuth, smooth);
    this.elevation = THREE.MathUtils.lerp(this.elevation, this.desiredElevation, smooth);
    this.distance = THREE.MathUtils.lerp(this.distance, this.desiredDistance, smooth);

    this._applyCameraTransform();
  }

  _applyCameraTransform() {
    const horiz = this.distance * Math.cos(this.elevation);
    const y = this.distance * Math.sin(this.elevation);
    const x = this.target.x + horiz * Math.sin(this.azimuth);
    const z = this.target.z + horiz * Math.cos(this.azimuth);

    this.camera.position.set(x, this.target.y + y, z);
    this.camera.lookAt(this.target);
  }
}
