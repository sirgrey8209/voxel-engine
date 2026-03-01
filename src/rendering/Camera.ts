// src/rendering/Camera.ts
import { vec3, mat4 } from 'gl-matrix';
import { DEFAULT_CONFIG } from '../core/Config';

export class Camera {
  private _position: vec3;
  private _up: vec3;

  private yaw: number;    // Horizontal rotation (radians)
  private pitch: number;  // Vertical rotation (radians)

  private fov: number;
  private near: number;
  private far: number;
  private moveSpeed: number;
  private lookSpeed: number;

  // For reset
  private initialPosition: vec3;
  private initialYaw: number;
  private initialPitch: number;

  constructor() {
    const config = DEFAULT_CONFIG.camera;
    this.fov = config.fov * (Math.PI / 180);
    this.near = config.near;
    this.far = config.far;
    this.moveSpeed = config.moveSpeed;
    this.lookSpeed = config.lookSpeed;

    this._up = vec3.fromValues(0, 1, 0);

    // Initial position: outside chunk, looking at center
    this._position = vec3.fromValues(48, 24, 48);

    // Initial orientation: looking at chunk center (16, 8, 16)
    // Direction: (16-48, 8-24, 16-48) = (-32, -16, -32)
    // yaw = atan2(-32, -32) = atan2(1, 1) = -3π/4 (225°)
    this.yaw = -Math.PI * 3 / 4;
    // pitch = atan2(-16, sqrt(32² + 32²)) = atan2(-16, 45.25) ≈ -0.34 rad (-19.5°)
    this.pitch = -0.34;

    // Save initial state for reset
    this.initialPosition = vec3.clone(this._position);
    this.initialYaw = this.yaw;
    this.initialPitch = this.pitch;
  }

  get position(): vec3 {
    return vec3.clone(this._position);
  }

  private getForward(): vec3 {
    // Forward vector from yaw/pitch (ignoring pitch for movement)
    return vec3.fromValues(
      Math.sin(this.yaw),
      0,
      Math.cos(this.yaw)
    );
  }

  private getRight(): vec3 {
    // Right vector (perpendicular to forward on XZ plane)
    return vec3.fromValues(
      Math.sin(this.yaw + Math.PI / 2),
      0,
      Math.cos(this.yaw + Math.PI / 2)
    );
  }

  private getLookDirection(): vec3 {
    // Actual look direction including pitch
    return vec3.fromValues(
      Math.cos(this.pitch) * Math.sin(this.yaw),
      Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.cos(this.yaw)
    );
  }

  getViewMatrix(): mat4 {
    const view = mat4.create();
    const target = vec3.create();
    const lookDir = this.getLookDirection();
    vec3.add(target, this._position, lookDir);
    mat4.lookAt(view, this._position, target, this._up);
    return view;
  }

  getProjectionMatrix(aspect: number): mat4 {
    const proj = mat4.create();
    mat4.perspective(proj, this.fov, aspect, this.near, this.far);
    return proj;
  }

  // WASD movement (always on XZ plane)
  move(direction: vec3, deltaTime: number): void {
    const forward = this.getForward();
    const right = this.getRight();

    const move = vec3.create();
    // Z component = forward/backward (W/S)
    vec3.scaleAndAdd(move, move, forward, direction[2]);
    // X component = strafe (A/D)
    vec3.scaleAndAdd(move, move, right, direction[0]);

    const moveLength = vec3.length(move);
    if (moveLength < 0.0001) return;

    vec3.normalize(move, move);
    vec3.scale(move, move, this.moveSpeed * deltaTime);
    vec3.add(this._position, this._position, move);
  }

  // Right-click mouse look
  look(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.lookSpeed;
    this.pitch -= deltaY * this.lookSpeed;

    // Clamp pitch to prevent flipping (±89°)
    const maxPitch = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  // Space: reset to initial position
  reset(): void {
    vec3.copy(this._position, this.initialPosition);
    this.yaw = this.initialYaw;
    this.pitch = this.initialPitch;
  }
}
