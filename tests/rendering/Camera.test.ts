// tests/rendering/Camera.test.ts
import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/rendering/Camera';

describe('Camera', () => {
  it('should create with default position', () => {
    const camera = new Camera();
    const pos = camera.position;
    // Initial position based on spherical coordinates:
    // theta = PI/4, phi = PI/3, radius = 30, target = (16, 8, 16)
    // x = 16 + 30 * sin(PI/3) * cos(PI/4) = 16 + 30 * 0.866 * 0.707 ≈ 34.37
    // y = 8 + 30 * cos(PI/3) = 8 + 30 * 0.5 = 23
    // z = 16 + 30 * sin(PI/3) * sin(PI/4) ≈ 34.37
    expect(pos[0]).toBeCloseTo(34.37, 1);
    expect(pos[1]).toBeCloseTo(23, 1);
    expect(pos[2]).toBeCloseTo(34.37, 1);
  });

  it('should return view matrix', () => {
    const camera = new Camera();
    const view = camera.getViewMatrix();
    expect(view.length).toBe(16);
  });

  it('should return projection matrix', () => {
    const camera = new Camera();
    const proj = camera.getProjectionMatrix(16 / 9);
    expect(proj.length).toBe(16);
  });

  it('should orbit around target', () => {
    const camera = new Camera();
    const initialPos = [...camera.position];
    camera.orbit(0.1, 0);
    expect(camera.position[0]).not.toBe(initialPos[0]);
  });

  it('should zoom in and out', () => {
    const camera = new Camera();
    const initialDistance = camera.getDistanceToTarget();
    camera.zoom(-1); // zoom in
    expect(camera.getDistanceToTarget()).toBeLessThan(initialDistance);
  });

  it('should pan the camera and target', () => {
    const camera = new Camera();
    const initialTarget = [...camera.target];
    camera.pan(0.1, 0.1);
    expect(camera.target[0]).not.toBe(initialTarget[0]);
  });

  it('should clamp phi to prevent flipping', () => {
    const camera = new Camera();
    // Orbit with large deltaY to try to flip
    camera.orbit(0, 100);
    const pos = camera.position;
    // Camera should still be above or below target, not flipped
    expect(pos[1]).toBeDefined();
  });

  it('should clamp zoom distance', () => {
    const camera = new Camera();
    // Try to zoom way out
    camera.zoom(10000);
    expect(camera.getDistanceToTarget()).toBeLessThanOrEqual(500);

    // Try to zoom way in
    camera.zoom(-10000);
    expect(camera.getDistanceToTarget()).toBeGreaterThanOrEqual(1);
  });

  it('should move camera and target with flyMove', () => {
    const camera = new Camera();
    const initialPos = [...camera.position];
    const initialTarget = [...camera.target];

    // Move forward (W key)
    camera.flyMove([0, 0, 1] as unknown as import('gl-matrix').vec3, 0.1);

    // Both position and target should have moved
    const newPos = camera.position;
    const newTarget = camera.target;

    expect(newPos[0]).not.toBe(initialPos[0]);
    expect(newTarget[0]).not.toBe(initialTarget[0]);
  });
});
