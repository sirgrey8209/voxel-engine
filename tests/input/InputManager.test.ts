// tests/input/InputManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../../src/input/InputManager';

describe('InputManager', () => {
  let canvas: HTMLCanvasElement;
  let input: InputManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    input = new InputManager(canvas);
  });

  afterEach(() => {
    input.dispose();
    document.body.removeChild(canvas);
  });

  it('should create with default state', () => {
    const state = input.getState();
    expect(state.forward).toBe(false);
    expect(state.backward).toBe(false);
    expect(state.left).toBe(false);
    expect(state.right).toBe(false);
    expect(state.reset).toBe(false);
  });

  it('should track WASD keys', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.getState().forward).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(input.getState().left).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    expect(input.getState().backward).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(input.getState().right).toBe(true);
  });

  it('should track Space key for reset', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(input.getState().reset).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(input.getState().reset).toBe(false);
  });

  it('should track mouse buttons', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    expect(input.getState().mouseLeftDown).toBe(true);

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
    expect(input.getState().mouseRightDown).toBe(true);
  });

  it('should accumulate mouse deltas', () => {
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 5 }));
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 5, movementY: 3 }));

    const state = input.getState();
    expect(state.mouseDeltaX).toBe(15);
    expect(state.mouseDeltaY).toBe(8);
  });

  it('should reset deltas', () => {
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: 5 }));
    input.resetDeltas();

    const state = input.getState();
    expect(state.mouseDeltaX).toBe(0);
    expect(state.mouseDeltaY).toBe(0);
  });

  it('should release keys on keyup', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(input.getState().forward).toBe(false);
  });
});
