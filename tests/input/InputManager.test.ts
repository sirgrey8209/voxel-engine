// tests/input/InputManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InputManager, InputState } from '../../src/input/InputManager';

describe('InputManager', () => {
  it('should create with default state', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager(canvas);
    const state = input.getState();

    expect(state.forward).toBe(false);
    expect(state.backward).toBe(false);
    expect(state.left).toBe(false);
    expect(state.right).toBe(false);
    expect(state.mouseLeftDown).toBe(false);
    expect(state.mouseRightDown).toBe(false);
    expect(state.mouseMiddleDown).toBe(false);
  });

  it('should track key states', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager(canvas);

    // Simulate keydown
    const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyW' });
    window.dispatchEvent(keydownEvent);

    expect(input.getState().forward).toBe(true);

    // Simulate keyup
    const keyupEvent = new KeyboardEvent('keyup', { code: 'KeyW' });
    window.dispatchEvent(keyupEvent);

    expect(input.getState().forward).toBe(false);
  });

  it('should calculate mouse delta', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager(canvas);

    expect(input.getState().mouseDeltaX).toBe(0);
    expect(input.getState().mouseDeltaY).toBe(0);
  });
});
