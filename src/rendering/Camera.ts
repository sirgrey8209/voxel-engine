// src/rendering/Camera.ts
import { vec3, mat4 } from 'gl-matrix';
import { DEFAULT_CONFIG } from '../core/Config';

export class Camera {
  private _position: vec3;
  private _target: vec3;
  private _up: vec3;

  private fov: number;
  private near: number;
  private far: number;

  private rotateSpeed: number;
  private panSpeed: number;
  private zoomSpeed: number;
  private moveSpeed: number;

  // Spherical coordinates for orbit
  private theta: number = Math.PI / 4;  // Horizontal angle
  private phi: number = Math.PI / 3;    // Vertical angle
  private radius: number = 30;          // Distance from target

  constructor() {
    const config = DEFAULT_CONFIG.camera;
    this.fov = config.fov * (Math.PI / 180);
    this.near = config.near;
    this.far = config.far;
    this.rotateSpeed = config.rotateSpeed;
    this.panSpeed = config.panSpeed;
    this.zoomSpeed = config.zoomSpeed;
    this.moveSpeed = config.moveSpeed;

    this._target = vec3.fromValues(16, 8, 16); // Chunk center
    this._up = vec3.fromValues(0, 1, 0);
    this._position = vec3.create();
    this.updatePosition();
  }

  get position(): vec3 {
    return vec3.clone(this._position);
  }

  get target(): vec3 {
    return vec3.clone(this._target);
  }

  getDistanceToTarget(): number {
    return this.radius;
  }

  private updatePosition(): void {
    // Spherical to Cartesian coordinates
    this._position[0] = this._target[0] + this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    this._position[1] = this._target[1] + this.radius * Math.cos(this.phi);
    this._position[2] = this._target[2] + this.radius * Math.sin(this.phi) * Math.sin(this.theta);
  }

  getViewMatrix(): mat4 {
    const view = mat4.create();
    mat4.lookAt(view, this._position, this._target, this._up);
    return view;
  }

  getProjectionMatrix(aspect: number): mat4 {
    const proj = mat4.create();
    mat4.perspective(proj, this.fov, aspect, this.near, this.far);
    return proj;
  }

  // Unity Scene View style controls

  // Right-click drag: Orbit
  orbit(deltaX: number, deltaY: number): void {
    this.theta -= deltaX * this.rotateSpeed;
    this.phi -= deltaY * this.rotateSpeed;

    // Clamp phi to prevent flipping
    this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));

    this.updatePosition();
  }

  // Middle-click drag: Pan
  pan(deltaX: number, deltaY: number): void {
    // Calculate camera local axes
    const forward = vec3.create();
    vec3.sub(forward, this._target, this._position);
    vec3.normalize(forward, forward);

    const right = vec3.create();
    vec3.cross(right, forward, this._up);
    vec3.normalize(right, right);

    const up = vec3.create();
    vec3.cross(up, right, forward);

    // Pan movement
    const panX = deltaX * this.panSpeed * this.radius;
    const panY = deltaY * this.panSpeed * this.radius;

    vec3.scaleAndAdd(this._target, this._target, right, -panX);
    vec3.scaleAndAdd(this._target, this._target, up, panY);

    this.updatePosition();
  }

  // Scroll: Zoom
  zoom(delta: number): void {
    this.radius += delta * this.zoomSpeed;
    this.radius = Math.max(1, Math.min(500, this.radius));
    this.updatePosition();
  }

  // WASD + Right-click: Fly-through
  flyMove(direction: vec3, deltaTime: number): void {
    // Calculate camera local axes
    const forward = vec3.create();
    vec3.sub(forward, this._target, this._position);
    vec3.normalize(forward, forward);

    const right = vec3.create();
    vec3.cross(right, forward, this._up);
    vec3.normalize(right, right);

    // Calculate movement vector
    const move = vec3.create();
    vec3.scaleAndAdd(move, move, forward, direction[2]);  // W/S
    vec3.scaleAndAdd(move, move, right, direction[0]);    // A/D
    vec3.scaleAndAdd(move, move, this._up, direction[1]); // Q/E

    // Guard against zero-vector normalization (prevents NaN)
    const moveLength = vec3.length(move);
    if (moveLength < 0.0001) return;

    vec3.normalize(move, move);
    vec3.scale(move, move, this.moveSpeed * deltaTime);

    // Move both camera and target
    vec3.add(this._position, this._position, move);
    vec3.add(this._target, this._target, move);
  }
}
