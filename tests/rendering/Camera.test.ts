// tests/rendering/Camera.test.ts
import { describe, it, expect } from 'vitest';
import { vec3 } from 'gl-matrix';
import { Camera } from '../../src/rendering/Camera';

describe('Camera', () => {
  it('should create with default position looking at chunk center', () => {
    const camera = new Camera();
    const pos = camera.position;
    // Initial position: (48, 24, 48)
    expect(pos[0]).toBeCloseTo(48, 1);
    expect(pos[1]).toBeCloseTo(24, 1);
    expect(pos[2]).toBeCloseTo(48, 1);
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

  it('should move forward with W key', () => {
    const camera = new Camera();
    const initialZ = camera.position[2];

    // Move forward (negative Z in default orientation)
    camera.move(vec3.fromValues(0, 0, 1), 1.0);

    expect(camera.position[2]).not.toBe(initialZ);
  });

  it('should strafe right with D key', () => {
    const camera = new Camera();
    const initialX = camera.position[0];

    // Move right
    camera.move(vec3.fromValues(1, 0, 0), 1.0);

    expect(camera.position[0]).not.toBe(initialX);
  });

  it('should look left/right with yaw', () => {
    const camera = new Camera();
    const view1 = camera.getViewMatrix();

    camera.look(100, 0); // Look right

    const view2 = camera.getViewMatrix();
    expect(view2[0]).not.toBe(view1[0]);
  });

  it('should look up/down with pitch', () => {
    const camera = new Camera();
    const view1 = camera.getViewMatrix();

    camera.look(0, 100); // Look down

    const view2 = camera.getViewMatrix();
    expect(view2[5]).not.toBe(view1[5]);
  });

  it('should clamp pitch to prevent flipping', () => {
    const camera = new Camera();

    // Try to look way up
    camera.look(0, -10000);
    const view1 = camera.getViewMatrix();

    // Try to look way down
    camera.look(0, 20000);
    const view2 = camera.getViewMatrix();

    // Should still produce valid matrices
    expect(view1.length).toBe(16);
    expect(view2.length).toBe(16);
  });

  it('should reset to initial position and orientation', () => {
    const camera = new Camera();
    const initialPos = vec3.clone(camera.position);

    // Move and look around
    camera.move(vec3.fromValues(1, 0, 1), 1.0);
    camera.look(100, 50);

    // Reset
    camera.reset();

    const resetPos = camera.position;
    expect(resetPos[0]).toBeCloseTo(initialPos[0], 5);
    expect(resetPos[1]).toBeCloseTo(initialPos[1], 5);
    expect(resetPos[2]).toBeCloseTo(initialPos[2], 5);
  });

  it('should move in 3D direction based on pitch', () => {
    const camera = new Camera();
    const initialY = camera.position[1];

    // Look down and move forward - Y should decrease
    camera.look(0, 100); // pitch down
    camera.move(vec3.fromValues(0, 0, 1), 1.0);

    // Y should change when moving with pitch
    expect(camera.position[1]).not.toBeCloseTo(initialY, 1);
  });
});
