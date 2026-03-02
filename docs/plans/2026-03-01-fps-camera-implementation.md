# FPS Camera System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Unity Scene View orbit camera with FPS-style controls (WASD move, right-click look, Space reset).

**Architecture:** Position + yaw/pitch rotation system. WASD moves on XZ plane relative to camera facing. Right-click rotates view. Space resets to initial state.

**Tech Stack:** TypeScript, gl-matrix, Vitest

---

### Task 1: Update CameraConfig

**Files:**
- Modify: `src/core/Config.ts`

**Step 1: Simplify CameraConfig**

```typescript
export interface CameraConfig {
  fov: number;         // Field of view in degrees
  near: number;        // Near clip plane
  far: number;         // Far clip plane
  moveSpeed: number;   // Movement speed (units/sec)
  lookSpeed: number;   // Mouse look sensitivity
}

export interface Config {
  chunkSize: number;
  renderDistance: number;
  camera: CameraConfig;
}

export const DEFAULT_CONFIG: Config = {
  chunkSize: 32,
  renderDistance: 8,
  camera: {
    fov: 60,
    near: 0.1,
    far: 1000,
    moveSpeed: 15,
    lookSpeed: 0.003,
  },
};
```

**Step 2: Run tests**

Run: `pnpm test`
Expected: Config tests pass (no changes to interface structure)

**Step 3: Commit**

```bash
git add src/core/Config.ts
git commit -m "refactor(config): simplify camera config for FPS style"
```

---

### Task 2: Rewrite Camera Class

**Files:**
- Rewrite: `src/rendering/Camera.ts`
- Rewrite: `tests/rendering/Camera.test.ts`

**Step 1: Write new Camera tests**

```typescript
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

  it('should move on XZ plane only (no vertical drift)', () => {
    const camera = new Camera();
    const initialY = camera.position[1];

    // Move forward and strafe
    camera.move(vec3.fromValues(1, 0, 1), 1.0);

    // Y should not change
    expect(camera.position[1]).toBeCloseTo(initialY, 5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/rendering/Camera.test.ts`
Expected: FAIL (orbit, pan, zoom methods no longer exist)

**Step 3: Implement new Camera class**

```typescript
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
```

**Step 4: Run tests**

Run: `pnpm test tests/rendering/Camera.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/rendering/Camera.ts tests/rendering/Camera.test.ts
git commit -m "refactor(camera): replace orbit camera with FPS-style controls"
```

---

### Task 3: Update InputManager

**Files:**
- Modify: `src/input/InputManager.ts`
- Modify: `tests/input/InputManager.test.ts`

**Step 1: Update InputState interface and key handling**

```typescript
// src/input/InputManager.ts
export interface InputState {
  // Movement (WASD only, no up/down)
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;

  // Reset
  reset: boolean;

  // Mouse buttons
  mouseLeftDown: boolean;
  mouseRightDown: boolean;
  mouseMiddleDown: boolean;

  // Mouse position and delta
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;

  // Scroll (keeping for potential future use)
  scrollDelta: number;
}

export class InputManager {
  private state: InputState;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = this.createDefaultState();
    this.setupEventListeners();
  }

  private createDefaultState(): InputState {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      reset: false,
      mouseLeftDown: false,
      mouseRightDown: false,
      mouseMiddleDown: false,
      mouseX: 0,
      mouseY: 0,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      scrollDelta: 0,
    };
  }

  private setupEventListeners(): void {
    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Mouse
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Context menu prevention
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, false);
  };

  private updateKeyState(code: string, pressed: boolean): void {
    switch (code) {
      case 'KeyW': this.state.forward = pressed; break;
      case 'KeyS': this.state.backward = pressed; break;
      case 'KeyA': this.state.left = pressed; break;
      case 'KeyD': this.state.right = pressed; break;
      case 'Space': this.state.reset = pressed; break;
    }
  }

  private onMouseDown = (e: MouseEvent): void => {
    switch (e.button) {
      case 0: this.state.mouseLeftDown = true; break;
      case 1: this.state.mouseMiddleDown = true; break;
      case 2: this.state.mouseRightDown = true; break;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    switch (e.button) {
      case 0: this.state.mouseLeftDown = false; break;
      case 1: this.state.mouseMiddleDown = false; break;
      case 2: this.state.mouseRightDown = false; break;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.state.mouseDeltaX += e.movementX;
    this.state.mouseDeltaY += e.movementY;
    this.state.mouseX = e.clientX;
    this.state.mouseY = e.clientY;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.state.scrollDelta += e.deltaY;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  getState(): InputState {
    return { ...this.state };
  }

  // Reset deltas at end of frame
  resetDeltas(): void {
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    this.state.scrollDelta = 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}
```

**Step 2: Update InputManager tests**

```typescript
// tests/input/InputManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
```

**Step 3: Run tests**

Run: `pnpm test tests/input/InputManager.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/input/InputManager.ts tests/input/InputManager.test.ts
git commit -m "refactor(input): remove Q/E, add Space for reset"
```

---

### Task 4: Update Engine

**Files:**
- Modify: `src/core/Engine.ts`

**Step 1: Update Engine.update() method**

```typescript
// src/core/Engine.ts
import { vec3 } from 'gl-matrix';
import { Camera } from '../rendering/Camera';
import { WebGPURenderer } from '../rendering/WebGPURenderer';
import { InputManager } from '../input/InputManager';
import { Chunk } from '../voxel/Chunk';
import { NaiveMesher } from '../voxel/NaiveMesher';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private camera: Camera;
  private input: InputManager;
  private chunk: Chunk;

  private running: boolean = false;
  private lastTime: number = 0;

  constructor(config: EngineConfig) {
    this.canvas = config.canvas;
    this.renderer = new WebGPURenderer(this.canvas);
    this.camera = new Camera();
    this.input = new InputManager(this.canvas);
    this.chunk = new Chunk(0, 0, 0);
  }

  async init(): Promise<void> {
    // Initialize renderer first (creates depthTexture)
    const success = await this.renderer.init();
    if (!success) {
      throw new Error('Failed to initialize WebGPU renderer');
    }

    // Then resize canvas (which calls renderer.resize())
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);

    // Generate test terrain
    this.chunk.fillGround(16);

    // Generate and upload mesh
    const mesh = NaiveMesher.generateMesh(this.chunk);
    this.renderer.uploadMesh(mesh);

    console.log(`Mesh generated: ${mesh.vertexCount} vertices, ${mesh.indexCount} indices`);
  }

  private resizeCanvas = (): void => {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.renderer.resize();
  };

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (time: number): void => {
    if (!this.running) return;

    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    const state = this.input.getState();

    // WASD: Always move (no right-click required)
    const moveDir = vec3.fromValues(
      (state.right ? 1 : 0) - (state.left ? 1 : 0),
      0,
      (state.forward ? 1 : 0) - (state.backward ? 1 : 0)
    );
    if (vec3.length(moveDir) > 0) {
      this.camera.move(moveDir, deltaTime);
    }

    // Right-click drag: Mouse look
    if (state.mouseRightDown) {
      this.camera.look(state.mouseDeltaX, state.mouseDeltaY);
    }

    // Space: Reset camera
    if (state.reset) {
      this.camera.reset();
    }

    this.input.resetDeltas();
  }

  private render(): void {
    this.renderer.render(this.camera);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeCanvas);
    this.input.dispose();
    this.renderer.dispose();
  }
}
```

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/Engine.ts
git commit -m "refactor(engine): update to FPS camera controls"
```

---

### Task 5: Build and Deploy

**Step 1: Type check**

Run: `pnpm run typecheck`
Expected: No errors

**Step 2: Build**

Run: `pnpm run build`
Expected: Build successful

**Step 3: Restart PM2**

Run: `pm2 restart voxel-engine`

**Step 4: Test in browser**

Open: https://estelle-hub.mooo.com/voxel-engine/
Expected:
- WASD moves camera on XZ plane
- Right-click + drag rotates view
- Space resets to initial view

**Step 5: Commit all and push**

```bash
git push origin master
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Update Config | Config.ts |
| 2 | Rewrite Camera | Camera.ts, Camera.test.ts |
| 3 | Update InputManager | InputManager.ts, InputManager.test.ts |
| 4 | Update Engine | Engine.ts |
| 5 | Build and Deploy | - |
