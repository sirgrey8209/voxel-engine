# Phase 1: Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundation of a WebGPU-based voxel engine with Unity Scene view style camera and single chunk rendering.

**Architecture:** Engine orchestrates Camera, Renderer, and InputManager. Chunk holds voxel data and generates mesh via NaiveMesher. WebGPURenderer handles all GPU operations with WGSL shaders.

**Tech Stack:** TypeScript, Vite, Vitest, WebGPU, gl-matrix

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `public/index.html`
- Create: `src/main.ts`

**Step 1: Initialize package.json**

```bash
cd /home/estelle/voxel-engine
pnpm init
```

**Step 2: Install dependencies**

```bash
pnpm add gl-matrix
pnpm add -D typescript vite vitest @webgpu/types
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["@webgpu/types"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
```

**Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

**Step 6: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voxel Engine</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #1a1a1a; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #error {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #ff6b6b; font-family: monospace; font-size: 18px; text-align: center;
      display: none;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="error"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 7: Create src/main.ts (placeholder)**

```typescript
async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // WebGPU 지원 확인
  if (!navigator.gpu) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'WebGPU is not supported in this browser.';
    }
    throw new Error('WebGPU not supported');
  }

  console.log('Voxel Engine initialized');
}

main().catch(console.error);
```

**Step 8: Add scripts to package.json**

Edit `package.json` to add:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 9: Verify dev server starts**

```bash
pnpm dev
```

Expected: Server starts on http://localhost:3000, console shows "Voxel Engine initialized"

**Step 10: Commit**

```bash
git add -A
git commit -m "chore: project setup with Vite, TypeScript, Vitest"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/core/Config.ts`
- Create: `tests/core/Config.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/core/Config.test.ts
import { describe, it, expect } from 'vitest';
import { Config, DEFAULT_CONFIG } from '../src/core/Config';

describe('Config', () => {
  it('should have default chunk size of 32', () => {
    expect(DEFAULT_CONFIG.chunkSize).toBe(32);
  });

  it('should have default render distance', () => {
    expect(DEFAULT_CONFIG.renderDistance).toBe(8);
  });

  it('should have camera defaults', () => {
    expect(DEFAULT_CONFIG.camera.fov).toBe(60);
    expect(DEFAULT_CONFIG.camera.near).toBe(0.1);
    expect(DEFAULT_CONFIG.camera.far).toBe(1000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/core/Config.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/core/Config.ts
export interface CameraConfig {
  fov: number;        // Field of view in degrees
  near: number;       // Near clip plane
  far: number;        // Far clip plane
  moveSpeed: number;  // Fly-through speed
  rotateSpeed: number; // Orbit rotation sensitivity
  panSpeed: number;   // Pan sensitivity
  zoomSpeed: number;  // Zoom sensitivity
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
    moveSpeed: 10,
    rotateSpeed: 0.005,
    panSpeed: 0.01,
    zoomSpeed: 0.5,
  },
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/core/Config.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/Config.ts tests/core/Config.test.ts
git commit -m "feat(core): add Config module with defaults"
```

---

## Task 3: VoxelData Types

**Files:**
- Create: `src/voxel/VoxelData.ts`
- Create: `tests/voxel/VoxelData.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/voxel/VoxelData.test.ts
import { describe, it, expect } from 'vitest';
import { VoxelType, VOXEL_COLORS } from '../src/voxel/VoxelData';

describe('VoxelData', () => {
  it('should define AIR as 0', () => {
    expect(VoxelType.AIR).toBe(0);
  });

  it('should define STONE as 1', () => {
    expect(VoxelType.STONE).toBe(1);
  });

  it('should define DIRT as 2', () => {
    expect(VoxelType.DIRT).toBe(2);
  });

  it('should define GRASS as 3', () => {
    expect(VoxelType.GRASS).toBe(3);
  });

  it('should have color for each voxel type', () => {
    expect(VOXEL_COLORS[VoxelType.STONE]).toBeDefined();
    expect(VOXEL_COLORS[VoxelType.DIRT]).toBeDefined();
    expect(VOXEL_COLORS[VoxelType.GRASS]).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/voxel/VoxelData.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/voxel/VoxelData.ts
export enum VoxelType {
  AIR = 0,
  STONE = 1,
  DIRT = 2,
  GRASS = 3,
}

// RGB colors (0-1 range)
export type Color3 = [number, number, number];

export const VOXEL_COLORS: Record<VoxelType, Color3> = {
  [VoxelType.AIR]: [0, 0, 0],           // 투명 (사용 안 됨)
  [VoxelType.STONE]: [0.5, 0.5, 0.5],   // 회색
  [VoxelType.DIRT]: [0.6, 0.4, 0.2],    // 갈색
  [VoxelType.GRASS]: [0.3, 0.7, 0.2],   // 녹색
};

// 복셀이 고체인지 확인
export function isSolid(voxelType: VoxelType): boolean {
  return voxelType !== VoxelType.AIR;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/voxel/VoxelData.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/voxel/VoxelData.ts tests/voxel/VoxelData.test.ts
git commit -m "feat(voxel): add VoxelData types and colors"
```

---

## Task 4: Chunk Data Structure

**Files:**
- Create: `src/voxel/Chunk.ts`
- Create: `tests/voxel/Chunk.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/voxel/Chunk.test.ts
import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE } from '../src/voxel/Chunk';
import { VoxelType } from '../src/voxel/VoxelData';

describe('Chunk', () => {
  it('should have CHUNK_SIZE of 32', () => {
    expect(CHUNK_SIZE).toBe(32);
  });

  it('should create chunk at position', () => {
    const chunk = new Chunk(1, 2, 3);
    expect(chunk.x).toBe(1);
    expect(chunk.y).toBe(2);
    expect(chunk.z).toBe(3);
  });

  it('should initialize with all AIR', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.getVoxel(0, 0, 0)).toBe(VoxelType.AIR);
    expect(chunk.getVoxel(15, 15, 15)).toBe(VoxelType.AIR);
  });

  it('should set and get voxel', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setVoxel(5, 10, 15, VoxelType.STONE);
    expect(chunk.getVoxel(5, 10, 15)).toBe(VoxelType.STONE);
  });

  it('should throw for out of bounds access', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(() => chunk.getVoxel(-1, 0, 0)).toThrow();
    expect(() => chunk.getVoxel(32, 0, 0)).toThrow();
    expect(() => chunk.setVoxel(0, 32, 0, VoxelType.STONE)).toThrow();
  });

  it('should mark dirty when voxel changes', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.isDirty).toBe(true); // 초기 상태는 dirty
    chunk.clearDirty();
    expect(chunk.isDirty).toBe(false);
    chunk.setVoxel(0, 0, 0, VoxelType.STONE);
    expect(chunk.isDirty).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/voxel/Chunk.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/voxel/Chunk.ts
import { VoxelType } from './VoxelData';

export const CHUNK_SIZE = 32;
const CHUNK_SIZE_SQUARED = CHUNK_SIZE * CHUNK_SIZE;
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;

export class Chunk {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly voxels: Uint16Array;

  private _isDirty: boolean = true;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.voxels = new Uint16Array(CHUNK_VOLUME);
  }

  get isDirty(): boolean {
    return this._isDirty;
  }

  clearDirty(): void {
    this._isDirty = false;
  }

  private getIndex(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      throw new RangeError(`Voxel position out of bounds: (${x}, ${y}, ${z})`);
    }
    return x + y * CHUNK_SIZE + z * CHUNK_SIZE_SQUARED;
  }

  getVoxel(x: number, y: number, z: number): VoxelType {
    return this.voxels[this.getIndex(x, y, z)] as VoxelType;
  }

  setVoxel(x: number, y: number, z: number, type: VoxelType): void {
    const index = this.getIndex(x, y, z);
    if (this.voxels[index] !== type) {
      this.voxels[index] = type;
      this._isDirty = true;
    }
  }

  // 간단한 지형 생성 (테스트용)
  fillGround(height: number = 16): void {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < height; y++) {
          if (y === height - 1) {
            this.setVoxel(x, y, z, VoxelType.GRASS);
          } else if (y >= height - 4) {
            this.setVoxel(x, y, z, VoxelType.DIRT);
          } else {
            this.setVoxel(x, y, z, VoxelType.STONE);
          }
        }
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/voxel/Chunk.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/voxel/Chunk.ts tests/voxel/Chunk.test.ts
git commit -m "feat(voxel): add Chunk data structure"
```

---

## Task 5: Naive Mesher

**Files:**
- Create: `src/voxel/NaiveMesher.ts`
- Create: `tests/voxel/NaiveMesher.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/voxel/NaiveMesher.test.ts
import { describe, it, expect } from 'vitest';
import { NaiveMesher, ChunkMesh } from '../src/voxel/NaiveMesher';
import { Chunk } from '../src/voxel/Chunk';
import { VoxelType } from '../src/voxel/VoxelData';

describe('NaiveMesher', () => {
  it('should return empty mesh for empty chunk', () => {
    const chunk = new Chunk(0, 0, 0);
    const mesh = NaiveMesher.generateMesh(chunk);

    expect(mesh.vertices.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });

  it('should generate mesh for single voxel', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setVoxel(0, 0, 0, VoxelType.STONE);
    const mesh = NaiveMesher.generateMesh(chunk);

    // 단일 복셀 = 6면 × 4버텍스 × 6(x,y,z,nx,ny,nz) = 144 floats
    // 단, 실제로는 면당 4버텍스, position(3) + normal(3) + color(3) = 9 floats
    expect(mesh.vertices.length).toBeGreaterThan(0);
    // 6면 × 6인덱스(2삼각형) = 36
    expect(mesh.indices.length).toBe(36);
  });

  it('should not generate faces between adjacent solid voxels', () => {
    const chunk = new Chunk(0, 0, 0);
    // 두 개의 인접한 복셀
    chunk.setVoxel(0, 0, 0, VoxelType.STONE);
    chunk.setVoxel(1, 0, 0, VoxelType.STONE);
    const mesh = NaiveMesher.generateMesh(chunk);

    // 2개 복셀이 인접: 6*2 - 2(공유면) = 10면 × 6인덱스 = 60
    expect(mesh.indices.length).toBe(60);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/voxel/NaiveMesher.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/voxel/NaiveMesher.ts
import { Chunk, CHUNK_SIZE } from './Chunk';
import { VoxelType, VOXEL_COLORS, isSolid, Color3 } from './VoxelData';

export interface ChunkMesh {
  // position(3) + normal(3) + color(3) = 9 floats per vertex
  vertices: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
}

// Face 방향 정의
const FACES = [
  { dir: [1, 0, 0], normal: [1, 0, 0], vertices: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]] },   // +X
  { dir: [-1, 0, 0], normal: [-1, 0, 0], vertices: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]] }, // -X
  { dir: [0, 1, 0], normal: [0, 1, 0], vertices: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]] },   // +Y
  { dir: [0, -1, 0], normal: [0, -1, 0], vertices: [[0,0,1], [0,0,0], [1,0,0], [1,0,1]] }, // -Y
  { dir: [0, 0, 1], normal: [0, 0, 1], vertices: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]] },   // +Z
  { dir: [0, 0, -1], normal: [0, 0, -1], vertices: [[1,0,0], [0,0,0], [0,1,0], [1,1,0]] }, // -Z
] as const;

export class NaiveMesher {
  static generateMesh(chunk: Chunk): ChunkMesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const voxel = chunk.getVoxel(x, y, z);
          if (!isSolid(voxel)) continue;

          const color = VOXEL_COLORS[voxel];

          // 각 면 체크
          for (const face of FACES) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            // 이웃이 청크 밖이거나 공기면 면 생성
            const neighborSolid = this.isNeighborSolid(chunk, nx, ny, nz);
            if (neighborSolid) continue;

            // 면의 4개 버텍스 추가
            for (const v of face.vertices) {
              vertices.push(
                x + v[0], y + v[1], z + v[2],  // position
                face.normal[0], face.normal[1], face.normal[2],  // normal
                color[0], color[1], color[2]   // color
              );
            }

            // 인덱스 (2개의 삼각형)
            indices.push(
              vertexIndex, vertexIndex + 1, vertexIndex + 2,
              vertexIndex, vertexIndex + 2, vertexIndex + 3
            );
            vertexIndex += 4;
          }
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      vertexCount: vertexIndex,
      indexCount: indices.length,
    };
  }

  private static isNeighborSolid(chunk: Chunk, x: number, y: number, z: number): boolean {
    // 청크 경계 밖은 공기로 취급
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return false;
    }
    return isSolid(chunk.getVoxel(x, y, z));
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/voxel/NaiveMesher.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/voxel/NaiveMesher.ts tests/voxel/NaiveMesher.test.ts
git commit -m "feat(voxel): add NaiveMesher for basic mesh generation"
```

---

## Task 6: Camera System

**Files:**
- Create: `src/rendering/Camera.ts`
- Create: `tests/rendering/Camera.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/rendering/Camera.test.ts
import { describe, it, expect } from 'vitest';
import { Camera } from '../src/rendering/Camera';

describe('Camera', () => {
  it('should create with default position', () => {
    const camera = new Camera();
    const pos = camera.position;
    expect(pos[0]).toBe(0);
    expect(pos[1]).toBe(10);
    expect(pos[2]).toBe(30);
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
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/rendering/Camera.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
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

  // 오빗용 구면 좌표
  private theta: number = Math.PI / 4;  // 수평 각도
  private phi: number = Math.PI / 3;    // 수직 각도
  private radius: number = 30;          // 타겟으로부터 거리

  constructor() {
    const config = DEFAULT_CONFIG.camera;
    this.fov = config.fov * (Math.PI / 180);
    this.near = config.near;
    this.far = config.far;
    this.rotateSpeed = config.rotateSpeed;
    this.panSpeed = config.panSpeed;
    this.zoomSpeed = config.zoomSpeed;
    this.moveSpeed = config.moveSpeed;

    this._target = vec3.fromValues(16, 8, 16); // 청크 중앙
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
    // 구면 좌표 → 직교 좌표
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

  // Unity Scene View 스타일 컨트롤

  // 우클릭 드래그: 오빗
  orbit(deltaX: number, deltaY: number): void {
    this.theta -= deltaX * this.rotateSpeed;
    this.phi -= deltaY * this.rotateSpeed;

    // phi 제한 (위아래 뒤집힘 방지)
    this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));

    this.updatePosition();
  }

  // 중클릭 드래그: 팬
  pan(deltaX: number, deltaY: number): void {
    // 카메라 로컬 축 계산
    const forward = vec3.create();
    vec3.sub(forward, this._target, this._position);
    vec3.normalize(forward, forward);

    const right = vec3.create();
    vec3.cross(right, forward, this._up);
    vec3.normalize(right, right);

    const up = vec3.create();
    vec3.cross(up, right, forward);

    // 팬 이동
    const panX = deltaX * this.panSpeed * this.radius;
    const panY = deltaY * this.panSpeed * this.radius;

    vec3.scaleAndAdd(this._target, this._target, right, -panX);
    vec3.scaleAndAdd(this._target, this._target, up, panY);

    this.updatePosition();
  }

  // 스크롤: 줌
  zoom(delta: number): void {
    this.radius += delta * this.zoomSpeed;
    this.radius = Math.max(1, Math.min(500, this.radius));
    this.updatePosition();
  }

  // WASD + 우클릭: 플라이스루
  flyMove(direction: vec3, deltaTime: number): void {
    // 카메라 로컬 축 계산
    const forward = vec3.create();
    vec3.sub(forward, this._target, this._position);
    vec3.normalize(forward, forward);

    const right = vec3.create();
    vec3.cross(right, forward, this._up);
    vec3.normalize(right, right);

    // 이동 벡터 계산
    const move = vec3.create();
    vec3.scaleAndAdd(move, move, forward, direction[2]);  // W/S
    vec3.scaleAndAdd(move, move, right, direction[0]);    // A/D
    vec3.scaleAndAdd(move, move, this._up, direction[1]); // Q/E

    vec3.normalize(move, move);
    vec3.scale(move, move, this.moveSpeed * deltaTime);

    // 카메라와 타겟 둘 다 이동
    vec3.add(this._position, this._position, move);
    vec3.add(this._target, this._target, move);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/rendering/Camera.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/rendering/Camera.ts tests/rendering/Camera.test.ts
git commit -m "feat(rendering): add Camera with Unity Scene view controls"
```

---

## Task 7: InputManager

**Files:**
- Create: `src/input/InputManager.ts`
- Create: `tests/input/InputManager.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/input/InputManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InputManager, InputState } from '../src/input/InputManager';

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
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/input/InputManager.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// src/input/InputManager.ts
export interface InputState {
  // Movement
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;

  // Mouse buttons
  mouseLeftDown: boolean;
  mouseRightDown: boolean;
  mouseMiddleDown: boolean;

  // Mouse position and delta
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;

  // Scroll
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
      up: false,
      down: false,
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

    // Context menu 방지
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
      case 'KeyQ': this.state.down = pressed; break;
      case 'KeyE': this.state.up = pressed; break;
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

  getState(): InputState {
    return { ...this.state };
  }

  // 프레임 끝에 델타 리셋
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
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test tests/input/InputManager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/input/InputManager.ts tests/input/InputManager.test.ts
git commit -m "feat(input): add InputManager for keyboard and mouse"
```

---

## Task 8: WGSL Shader

**Files:**
- Create: `src/rendering/shaders/voxel.wgsl`

**Step 1: Create shader file**

```wgsl
// src/rendering/shaders/voxel.wgsl

struct Uniforms {
  viewProjection: mat4x4<f32>,
  cameraPos: vec3<f32>,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec3<f32>,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.clipPosition = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
  output.worldPos = input.position;
  output.normal = input.normal;
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // 간단한 디렉셔널 라이팅
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
  let ambient = 0.3;
  let diffuse = max(dot(input.normal, lightDir), 0.0);
  let lighting = ambient + diffuse * 0.7;

  let color = input.color * lighting;

  return vec4<f32>(color, 1.0);
}
```

**Step 2: Commit**

```bash
mkdir -p src/rendering/shaders
git add src/rendering/shaders/voxel.wgsl
git commit -m "feat(rendering): add WGSL voxel shader"
```

---

## Task 9: WebGPU Renderer

**Files:**
- Create: `src/rendering/WebGPURenderer.ts`

**Step 1: Write implementation**

```typescript
// src/rendering/WebGPURenderer.ts
import { mat4 } from 'gl-matrix';
import { Camera } from './Camera';
import { ChunkMesh } from '../voxel/NaiveMesher';
import shaderSource from './shaders/voxel.wgsl?raw';

export interface GPUMeshHandle {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
}

export class WebGPURenderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private depthTexture!: GPUTexture;
  private depthTextureView!: GPUTextureView;

  private canvas: HTMLCanvasElement;
  private meshHandle: GPUMeshHandle | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU not supported');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error('Failed to get GPU adapter');
      return false;
    }

    this.device = await adapter.requestDevice();

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format,
      alphaMode: 'premultiplied',
    });

    this.createPipeline(format);
    this.createUniformBuffer();
    this.createDepthTexture();

    return true;
  }

  private createPipeline(format: GPUTextureFormat): void {
    const shaderModule = this.device.createShaderModule({
      code: shaderSource,
    });

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 36, // 9 floats * 4 bytes
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
        { shaderLocation: 2, offset: 24, format: 'float32x3' },  // color
      ],
    };

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  private createUniformBuffer(): void {
    // mat4x4 (64 bytes) + vec3 (12 bytes) + padding (4 bytes) = 80 bytes
    this.uniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  private createDepthTexture(): void {
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  resize(): void {
    this.depthTexture.destroy();
    this.createDepthTexture();
  }

  uploadMesh(mesh: ChunkMesh): GPUMeshHandle {
    const vertexBuffer = this.device.createBuffer({
      size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices);

    const indexBuffer = this.device.createBuffer({
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

    this.meshHandle = {
      vertexBuffer,
      indexBuffer,
      indexCount: mesh.indexCount,
    };

    return this.meshHandle;
  }

  render(camera: Camera): void {
    if (!this.meshHandle || this.meshHandle.indexCount === 0) {
      return;
    }

    // Update uniforms
    const view = camera.getViewMatrix();
    const proj = camera.getProjectionMatrix(this.canvas.width / this.canvas.height);
    const viewProj = mat4.create();
    mat4.multiply(viewProj, proj, view);

    const uniformData = new Float32Array(20); // 16 (mat4) + 3 (vec3) + 1 (padding)
    uniformData.set(viewProj, 0);
    uniformData.set(camera.position, 16);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.uniformBindGroup);
    renderPass.setVertexBuffer(0, this.meshHandle.vertexBuffer);
    renderPass.setIndexBuffer(this.meshHandle.indexBuffer, 'uint32');
    renderPass.drawIndexed(this.meshHandle.indexCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  dispose(): void {
    if (this.meshHandle) {
      this.meshHandle.vertexBuffer.destroy();
      this.meshHandle.indexBuffer.destroy();
    }
    this.uniformBuffer.destroy();
    this.depthTexture.destroy();
  }
}
```

**Step 2: Update vite.config.ts for raw imports**

Edit `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.wgsl'],
});
```

**Step 3: Commit**

```bash
git add src/rendering/WebGPURenderer.ts vite.config.ts
git commit -m "feat(rendering): add WebGPU renderer"
```

---

## Task 10: Engine Core

**Files:**
- Create: `src/core/Engine.ts`

**Step 1: Write implementation**

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
    // 캔버스 크기 설정
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);

    // 렌더러 초기화
    const success = await this.renderer.init();
    if (!success) {
      throw new Error('Failed to initialize WebGPU renderer');
    }

    // 테스트 지형 생성
    this.chunk.fillGround(16);

    // 메시 생성 및 업로드
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

    // 우클릭 드래그: 오빗
    if (state.mouseRightDown) {
      this.camera.orbit(state.mouseDeltaX, state.mouseDeltaY);

      // 우클릭 + WASD: 플라이스루
      const moveDir = vec3.fromValues(
        (state.right ? 1 : 0) - (state.left ? 1 : 0),
        (state.up ? 1 : 0) - (state.down ? 1 : 0),
        (state.forward ? 1 : 0) - (state.backward ? 1 : 0)
      );
      if (vec3.length(moveDir) > 0) {
        this.camera.flyMove(moveDir, deltaTime);
      }
    }

    // 중클릭 드래그: 팬
    if (state.mouseMiddleDown) {
      this.camera.pan(state.mouseDeltaX, state.mouseDeltaY);
    }

    // 스크롤: 줌
    if (state.scrollDelta !== 0) {
      this.camera.zoom(state.scrollDelta * 0.01);
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

**Step 2: Commit**

```bash
git add src/core/Engine.ts
git commit -m "feat(core): add Engine with game loop"
```

---

## Task 11: Main Entry Point

**Files:**
- Modify: `src/main.ts`

**Step 1: Update main.ts**

```typescript
// src/main.ts
import { Engine } from './core/Engine';

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // WebGPU 지원 확인
  if (!navigator.gpu) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.';
    }
    throw new Error('WebGPU not supported');
  }

  const engine = new Engine({ canvas });

  try {
    await engine.init();
    engine.start();
    console.log('Voxel Engine started');
    console.log('Controls:');
    console.log('  Right-click drag: Orbit camera');
    console.log('  Middle-click drag: Pan camera');
    console.log('  Scroll: Zoom in/out');
    console.log('  Right-click + WASD: Fly through');
  } catch (error) {
    console.error('Failed to initialize engine:', error);
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Failed to initialize: ${error}`;
    }
  }
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up main entry point"
```

---

## Task 12: Final Integration Test

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 2: Start dev server and verify**

```bash
pnpm dev
```

Expected:
- Browser opens to http://localhost:3000
- 32x32 chunk with grass/dirt/stone terrain visible
- Camera controls work (orbit, pan, zoom, fly-through)

**Step 3: Build verification**

```bash
pnpm build
```

Expected: Build succeeds without errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 foundation"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Project Setup | 10 min |
| 2 | Config Module | 5 min |
| 3 | VoxelData Types | 5 min |
| 4 | Chunk Data Structure | 10 min |
| 5 | Naive Mesher | 15 min |
| 6 | Camera System | 15 min |
| 7 | InputManager | 10 min |
| 8 | WGSL Shader | 5 min |
| 9 | WebGPU Renderer | 20 min |
| 10 | Engine Core | 15 min |
| 11 | Main Entry Point | 5 min |
| 12 | Final Integration Test | 10 min |
| **Total** | | **~2 hours** |
