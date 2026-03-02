# Phase 2: Chunk System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete chunk system with Greedy Meshing, Web Workers, and distance-based streaming.

**Architecture:** GreedyMesher replaces NaiveMesher for 90% triangle reduction. WorkerPool manages mesh.worker instances for async meshing. ChunkManager handles multi-chunk rendering and camera-based streaming.

**Tech Stack:** TypeScript, Vite (worker support), WebGPU, Vitest

---

### Task 1: GreedyMesher - Core Algorithm

**Files:**
- Create: `src/meshing/GreedyMesher.ts`
- Create: `tests/meshing/GreedyMesher.test.ts`

**Step 1: Write failing test**

```typescript
// tests/meshing/GreedyMesher.test.ts
import { describe, it, expect } from 'vitest';
import { GreedyMesher } from '../../src/meshing/GreedyMesher';
import { Chunk } from '../../src/voxel/Chunk';
import { NaiveMesher } from '../../src/voxel/NaiveMesher';
import { VoxelType } from '../../src/voxel/VoxelData';

describe('GreedyMesher', () => {
  it('should generate valid mesh for filled chunk', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.fillGround(16);

    const mesh = GreedyMesher.generateMesh(chunk);

    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.indexCount).toBe(mesh.indices.length);
  });

  it('should produce fewer triangles than NaiveMesher', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.fillGround(16);

    const naiveMesh = NaiveMesher.generateMesh(chunk);
    const greedyMesh = GreedyMesher.generateMesh(chunk);

    // Greedy should produce significantly fewer triangles
    expect(greedyMesh.indexCount).toBeLessThan(naiveMesh.indexCount * 0.5);
  });

  it('should handle single voxel', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setVoxel(5, 5, 5, VoxelType.STONE);

    const mesh = GreedyMesher.generateMesh(chunk);

    // 6 faces * 6 indices = 36 indices (same as naive for single voxel)
    expect(mesh.indexCount).toBe(36);
  });

  it('should handle empty chunk', () => {
    const chunk = new Chunk(0, 0, 0);

    const mesh = GreedyMesher.generateMesh(chunk);

    expect(mesh.indexCount).toBe(0);
    expect(mesh.vertexCount).toBe(0);
  });

  it('should merge adjacent same-type voxels', () => {
    const chunk = new Chunk(0, 0, 0);
    // Create a 4x1x1 row of stone
    for (let x = 0; x < 4; x++) {
      chunk.setVoxel(x, 0, 0, VoxelType.STONE);
    }

    const naiveMesh = NaiveMesher.generateMesh(chunk);
    const greedyMesh = GreedyMesher.generateMesh(chunk);

    // Naive: 4 voxels * 5 exposed faces * 6 indices = 120
    // Greedy: merged faces, should be much less
    expect(greedyMesh.indexCount).toBeLessThan(naiveMesh.indexCount);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/meshing/GreedyMesher.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement GreedyMesher**

```typescript
// src/meshing/GreedyMesher.ts
import { Chunk, CHUNK_SIZE } from '../voxel/Chunk';
import { VoxelType, VOXEL_COLORS, isSolid } from '../voxel/VoxelData';
import { ChunkMesh } from '../voxel/NaiveMesher';

// Face direction definitions
const enum Axis { X = 0, Y = 1, Z = 2 }
const enum Dir { NEG = -1, POS = 1 }

interface FaceData {
  axis: Axis;
  dir: Dir;
  normal: [number, number, number];
}

const FACES: FaceData[] = [
  { axis: Axis.X, dir: Dir.POS, normal: [1, 0, 0] },
  { axis: Axis.X, dir: Dir.NEG, normal: [-1, 0, 0] },
  { axis: Axis.Y, dir: Dir.POS, normal: [0, 1, 0] },
  { axis: Axis.Y, dir: Dir.NEG, normal: [0, -1, 0] },
  { axis: Axis.Z, dir: Dir.POS, normal: [0, 0, 1] },
  { axis: Axis.Z, dir: Dir.NEG, normal: [0, 0, -1] },
];

export class GreedyMesher {
  static generateMesh(chunk: Chunk): ChunkMesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;

    // Process each face direction
    for (const face of FACES) {
      vertexIndex = this.meshFace(chunk, face, vertices, indices, vertexIndex);
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      vertexCount: vertexIndex,
      indexCount: indices.length,
    };
  }

  private static meshFace(
    chunk: Chunk,
    face: FaceData,
    vertices: number[],
    indices: number[],
    startVertex: number
  ): number {
    let vertexIndex = startVertex;
    const { axis, dir, normal } = face;

    // Determine the two perpendicular axes
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    // Mask to track processed faces
    const mask = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);

    // Iterate through slices along the main axis
    for (let d = 0; d < CHUNK_SIZE; d++) {
      // Fill the mask for this slice
      mask.fill(0);

      for (let j = 0; j < CHUNK_SIZE; j++) {
        for (let i = 0; i < CHUNK_SIZE; i++) {
          const pos = [0, 0, 0];
          pos[axis] = d;
          pos[u] = i;
          pos[v] = j;

          const voxel = chunk.getVoxel(pos[0], pos[1], pos[2]);
          if (!isSolid(voxel)) continue;

          // Check neighbor
          const neighborPos = [...pos];
          neighborPos[axis] += dir;

          let neighborSolid = false;
          if (neighborPos[axis] >= 0 && neighborPos[axis] < CHUNK_SIZE) {
            neighborSolid = isSolid(chunk.getVoxel(
              neighborPos[0], neighborPos[1], neighborPos[2]
            ));
          }

          if (!neighborSolid) {
            mask[i + j * CHUNK_SIZE] = voxel;
          }
        }
      }

      // Generate quads from mask using greedy algorithm
      for (let j = 0; j < CHUNK_SIZE; j++) {
        for (let i = 0; i < CHUNK_SIZE; ) {
          const voxelType = mask[i + j * CHUNK_SIZE];
          if (voxelType === 0) {
            i++;
            continue;
          }

          // Find width (extend in u direction)
          let w = 1;
          while (i + w < CHUNK_SIZE && mask[i + w + j * CHUNK_SIZE] === voxelType) {
            w++;
          }

          // Find height (extend in v direction)
          let h = 1;
          let done = false;
          while (j + h < CHUNK_SIZE && !done) {
            for (let k = 0; k < w; k++) {
              if (mask[i + k + (j + h) * CHUNK_SIZE] !== voxelType) {
                done = true;
                break;
              }
            }
            if (!done) h++;
          }

          // Create quad
          const color = VOXEL_COLORS[voxelType as VoxelType];
          const pos = [0, 0, 0];
          pos[axis] = dir === Dir.POS ? d + 1 : d;
          pos[u] = i;
          pos[v] = j;

          const du = [0, 0, 0];
          du[u] = w;
          const dv = [0, 0, 0];
          dv[v] = h;

          // Add 4 vertices for the quad
          const corners = dir === Dir.POS
            ? [pos, [pos[0] + dv[0], pos[1] + dv[1], pos[2] + dv[2]],
               [pos[0] + du[0] + dv[0], pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2]],
               [pos[0] + du[0], pos[1] + du[1], pos[2] + du[2]]]
            : [pos, [pos[0] + du[0], pos[1] + du[1], pos[2] + du[2]],
               [pos[0] + du[0] + dv[0], pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2]],
               [pos[0] + dv[0], pos[1] + dv[1], pos[2] + dv[2]]];

          for (const corner of corners) {
            vertices.push(
              corner[0], corner[1], corner[2],
              normal[0], normal[1], normal[2],
              color[0], color[1], color[2]
            );
          }

          // Add indices
          indices.push(
            vertexIndex, vertexIndex + 1, vertexIndex + 2,
            vertexIndex, vertexIndex + 2, vertexIndex + 3
          );
          vertexIndex += 4;

          // Clear the mask for processed area
          for (let jj = 0; jj < h; jj++) {
            for (let ii = 0; ii < w; ii++) {
              mask[i + ii + (j + jj) * CHUNK_SIZE] = 0;
            }
          }

          i += w;
        }
      }
    }

    return vertexIndex;
  }
}
```

**Step 4: Run tests**

Run: `pnpm test tests/meshing/GreedyMesher.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/meshing/GreedyMesher.ts tests/meshing/GreedyMesher.test.ts
git commit -m "feat(meshing): add GreedyMesher for optimized mesh generation"
```

---

### Task 2: Move ChunkMesh interface to shared location

**Files:**
- Create: `src/meshing/types.ts`
- Modify: `src/voxel/NaiveMesher.ts`
- Modify: `src/meshing/GreedyMesher.ts`
- Modify: `src/rendering/WebGPURenderer.ts`

**Step 1: Create shared types file**

```typescript
// src/meshing/types.ts
export interface ChunkMesh {
  // position(3) + normal(3) + color(3) = 9 floats per vertex
  vertices: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
}
```

**Step 2: Update imports in all files**

NaiveMesher.ts - remove ChunkMesh interface, import from types.ts
GreedyMesher.ts - import from types.ts instead of NaiveMesher
WebGPURenderer.ts - import from types.ts instead of NaiveMesher

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/meshing/types.ts src/voxel/NaiveMesher.ts src/meshing/GreedyMesher.ts src/rendering/WebGPURenderer.ts
git commit -m "refactor: move ChunkMesh interface to shared types"
```

---

### Task 3: Switch Engine to use GreedyMesher

**Files:**
- Modify: `src/core/Engine.ts`

**Step 1: Update Engine to use GreedyMesher**

```typescript
// In Engine.ts, change import and usage:
import { GreedyMesher } from '../meshing/GreedyMesher';

// In init():
const mesh = GreedyMesher.generateMesh(this.chunk);
```

**Step 2: Build and verify**

Run: `pnpm build`
Expected: Build successful

**Step 3: Commit**

```bash
git add src/core/Engine.ts
git commit -m "feat(engine): switch to GreedyMesher for mesh generation"
```

---

### Task 4: WorkerPool

**Files:**
- Create: `src/workers/WorkerPool.ts`
- Create: `tests/workers/WorkerPool.test.ts`

**Step 1: Write failing test**

```typescript
// tests/workers/WorkerPool.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerPool } from '../../src/workers/WorkerPool';

describe('WorkerPool', () => {
  it('should create pool with specified size', () => {
    const pool = new WorkerPool(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    } as unknown as Worker), 4);

    expect(pool.size).toBe(4);
    pool.terminate();
  });

  it('should execute task and return result', async () => {
    // Mock worker that echoes data
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null,
    };

    const pool = new WorkerPool(() => {
      const w = { ...mockWorker } as unknown as Worker;
      // Simulate async response
      setTimeout(() => {
        if (mockWorker.onmessage) {
          mockWorker.onmessage({ data: { result: 'done' } } as MessageEvent);
        }
      }, 10);
      return w;
    }, 1);

    const result = await pool.execute({ test: true });
    expect(result).toEqual({ result: 'done' });
    pool.terminate();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/workers/WorkerPool.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement WorkerPool**

```typescript
// src/workers/WorkerPool.ts
interface Task<T, R> {
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export class WorkerPool<T = unknown, R = unknown> {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private queue: Task<T, R>[] = [];

  constructor(
    private createWorker: () => Worker,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker();
      this.workers.push(worker);
      this.available.push(worker);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  execute(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: Task<T, R> = { data, resolve, reject };

      if (this.available.length > 0) {
        this.runTask(this.available.pop()!, task);
      } else {
        this.queue.push(task);
      }
    });
  }

  private runTask(worker: Worker, task: Task<T, R>): void {
    worker.onmessage = (e: MessageEvent) => {
      task.resolve(e.data);
      this.onWorkerDone(worker);
    };

    worker.onerror = (e: ErrorEvent) => {
      task.reject(new Error(e.message));
      this.onWorkerDone(worker);
    };

    worker.postMessage(task.data);
  }

  private onWorkerDone(worker: Worker): void {
    if (this.queue.length > 0) {
      const nextTask = this.queue.shift()!;
      this.runTask(worker, nextTask);
    } else {
      this.available.push(worker);
    }
  }

  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.available = [];
    this.queue = [];
  }
}
```

**Step 4: Run tests**

Run: `pnpm test tests/workers/WorkerPool.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/workers/WorkerPool.ts tests/workers/WorkerPool.test.ts
git commit -m "feat(workers): add WorkerPool for task distribution"
```

---

### Task 5: MeshWorker

**Files:**
- Create: `src/workers/mesh.worker.ts`
- Modify: `vite.config.ts` (if needed for worker support)

**Step 1: Create mesh worker**

```typescript
// src/workers/mesh.worker.ts
import { GreedyMesher } from '../meshing/GreedyMesher';
import { Chunk, CHUNK_SIZE } from '../voxel/Chunk';

export interface MeshWorkerInput {
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  voxels: Uint16Array;
}

export interface MeshWorkerOutput {
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  vertices: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
}

self.onmessage = (e: MessageEvent<MeshWorkerInput>) => {
  const { chunkX, chunkY, chunkZ, voxels } = e.data;

  // Reconstruct chunk from voxel data
  const chunk = new Chunk(chunkX, chunkY, chunkZ);
  chunk.voxels.set(voxels);

  // Generate mesh
  const mesh = GreedyMesher.generateMesh(chunk);

  // Send back with transferable arrays
  const output: MeshWorkerOutput = {
    chunkX,
    chunkY,
    chunkZ,
    vertices: mesh.vertices,
    indices: mesh.indices,
    vertexCount: mesh.vertexCount,
    indexCount: mesh.indexCount,
  };

  self.postMessage(output, [mesh.vertices.buffer, mesh.indices.buffer]);
};
```

**Step 2: Create MeshWorkerPool wrapper**

```typescript
// src/workers/MeshWorkerPool.ts
import { WorkerPool } from './WorkerPool';
import { ChunkMesh } from '../meshing/types';
import { Chunk } from '../voxel/Chunk';
import type { MeshWorkerInput, MeshWorkerOutput } from './mesh.worker';

export class MeshWorkerPool {
  private pool: WorkerPool<MeshWorkerInput, MeshWorkerOutput>;

  constructor(poolSize?: number) {
    this.pool = new WorkerPool(
      () => new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' }),
      poolSize
    );
  }

  async meshChunk(chunk: Chunk): Promise<ChunkMesh> {
    const input: MeshWorkerInput = {
      chunkX: chunk.x,
      chunkY: chunk.y,
      chunkZ: chunk.z,
      voxels: chunk.voxels,
    };

    const output = await this.pool.execute(input);

    return {
      vertices: output.vertices,
      indices: output.indices,
      vertexCount: output.vertexCount,
      indexCount: output.indexCount,
    };
  }

  terminate(): void {
    this.pool.terminate();
  }
}
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: Build successful (Vite handles worker bundling)

**Step 4: Commit**

```bash
git add src/workers/mesh.worker.ts src/workers/MeshWorkerPool.ts
git commit -m "feat(workers): add MeshWorker for async mesh generation"
```

---

### Task 6: ChunkManager - Core

**Files:**
- Create: `src/voxel/ChunkManager.ts`
- Create: `tests/voxel/ChunkManager.test.ts`

**Step 1: Write failing test**

```typescript
// tests/voxel/ChunkManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkManager } from '../../src/voxel/ChunkManager';

// Mock MeshWorkerPool
vi.mock('../../src/workers/MeshWorkerPool', () => ({
  MeshWorkerPool: class {
    meshChunk = vi.fn().mockResolvedValue({
      vertices: new Float32Array(0),
      indices: new Uint32Array(0),
      vertexCount: 0,
      indexCount: 0,
    });
    terminate = vi.fn();
  },
}));

describe('ChunkManager', () => {
  let manager: ChunkManager;

  beforeEach(() => {
    manager = new ChunkManager();
  });

  it('should create chunk at coordinates', async () => {
    await manager.loadChunk(0, 0, 0);

    expect(manager.hasChunk(0, 0, 0)).toBe(true);
  });

  it('should get chunk key from coordinates', () => {
    const key = ChunkManager.getChunkKey(1, 2, 3);
    expect(key).toBe('1,2,3');
  });

  it('should unload chunk', async () => {
    await manager.loadChunk(0, 0, 0);
    manager.unloadChunk(0, 0, 0);

    expect(manager.hasChunk(0, 0, 0)).toBe(false);
  });

  it('should get all loaded chunks', async () => {
    await manager.loadChunk(0, 0, 0);
    await manager.loadChunk(1, 0, 0);

    const chunks = manager.getLoadedChunks();
    expect(chunks.length).toBe(2);
  });

  it('should not reload already loaded chunk', async () => {
    await manager.loadChunk(0, 0, 0);
    await manager.loadChunk(0, 0, 0);

    const chunks = manager.getLoadedChunks();
    expect(chunks.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/voxel/ChunkManager.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement ChunkManager**

```typescript
// src/voxel/ChunkManager.ts
import { Chunk, CHUNK_SIZE } from './Chunk';
import { ChunkMesh } from '../meshing/types';
import { MeshWorkerPool } from '../workers/MeshWorkerPool';
import { GPUMeshHandle } from '../rendering/WebGPURenderer';

export interface LoadedChunk {
  chunk: Chunk;
  mesh: ChunkMesh | null;
  gpuHandle: GPUMeshHandle | null;
  loading: boolean;
}

export class ChunkManager {
  private chunks: Map<string, LoadedChunk> = new Map();
  private meshWorkerPool: MeshWorkerPool;

  constructor() {
    this.meshWorkerPool = new MeshWorkerPool();
  }

  static getChunkKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  hasChunk(x: number, y: number, z: number): boolean {
    return this.chunks.has(ChunkManager.getChunkKey(x, y, z));
  }

  getChunk(x: number, y: number, z: number): LoadedChunk | undefined {
    return this.chunks.get(ChunkManager.getChunkKey(x, y, z));
  }

  async loadChunk(x: number, y: number, z: number): Promise<LoadedChunk> {
    const key = ChunkManager.getChunkKey(x, y, z);

    // Don't reload if already loaded
    if (this.chunks.has(key)) {
      return this.chunks.get(key)!;
    }

    // Create chunk
    const chunk = new Chunk(x, y, z);
    chunk.fillGround(16); // TODO: Replace with actual world generation

    const loadedChunk: LoadedChunk = {
      chunk,
      mesh: null,
      gpuHandle: null,
      loading: true,
    };

    this.chunks.set(key, loadedChunk);

    // Generate mesh asynchronously
    const mesh = await this.meshWorkerPool.meshChunk(chunk);
    loadedChunk.mesh = mesh;
    loadedChunk.loading = false;
    chunk.clearDirty();

    return loadedChunk;
  }

  unloadChunk(x: number, y: number, z: number): void {
    const key = ChunkManager.getChunkKey(x, y, z);
    const loaded = this.chunks.get(key);

    if (loaded?.gpuHandle) {
      loaded.gpuHandle.vertexBuffer.destroy();
      loaded.gpuHandle.indexBuffer.destroy();
    }

    this.chunks.delete(key);
  }

  getLoadedChunks(): LoadedChunk[] {
    return Array.from(this.chunks.values());
  }

  dispose(): void {
    // Unload all chunks
    for (const [key, loaded] of this.chunks) {
      if (loaded.gpuHandle) {
        loaded.gpuHandle.vertexBuffer.destroy();
        loaded.gpuHandle.indexBuffer.destroy();
      }
    }
    this.chunks.clear();
    this.meshWorkerPool.terminate();
  }
}
```

**Step 4: Run tests**

Run: `pnpm test tests/voxel/ChunkManager.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/voxel/ChunkManager.ts tests/voxel/ChunkManager.test.ts
git commit -m "feat(voxel): add ChunkManager for multi-chunk management"
```

---

### Task 7: WebGPURenderer - Multi-chunk support

**Files:**
- Modify: `src/rendering/WebGPURenderer.ts`

**Step 1: Update Renderer for multi-chunk rendering**

```typescript
// Add to WebGPURenderer.ts:

// Change from single meshHandle to Map
private meshHandles: Map<string, GPUMeshHandle> = new Map();

// Update uploadMesh to accept chunk key
uploadMesh(key: string, mesh: ChunkMesh): GPUMeshHandle {
  // Delete old handle if exists
  const oldHandle = this.meshHandles.get(key);
  if (oldHandle) {
    oldHandle.vertexBuffer.destroy();
    oldHandle.indexBuffer.destroy();
  }

  const vertexBuffer = this.device.createBuffer({
    size: mesh.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  this.device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices.buffer);

  const indexBuffer = this.device.createBuffer({
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  this.device.queue.writeBuffer(indexBuffer, 0, mesh.indices.buffer);

  const handle: GPUMeshHandle = {
    vertexBuffer,
    indexBuffer,
    indexCount: mesh.indexCount,
  };

  this.meshHandles.set(key, handle);
  return handle;
}

deleteMesh(key: string): void {
  const handle = this.meshHandles.get(key);
  if (handle) {
    handle.vertexBuffer.destroy();
    handle.indexBuffer.destroy();
    this.meshHandles.delete(key);
  }
}

// Update render to draw all meshes
render(camera: Camera): void {
  if (this.meshHandles.size === 0) return;

  // Update uniforms
  const view = camera.getViewMatrix();
  const proj = camera.getProjectionMatrix(this.canvas.width / this.canvas.height);
  const viewProj = mat4.create();
  mat4.multiply(viewProj, proj, view);

  const uniformData = new Float32Array(20);
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

  // Draw all chunks
  for (const handle of this.meshHandles.values()) {
    if (handle.indexCount > 0) {
      renderPass.setVertexBuffer(0, handle.vertexBuffer);
      renderPass.setIndexBuffer(handle.indexBuffer, 'uint32');
      renderPass.drawIndexed(handle.indexCount);
    }
  }

  renderPass.end();
  this.device.queue.submit([commandEncoder.finish()]);
}

// Update dispose
dispose(): void {
  for (const handle of this.meshHandles.values()) {
    handle.vertexBuffer.destroy();
    handle.indexBuffer.destroy();
  }
  this.meshHandles.clear();
  this.uniformBuffer.destroy();
  this.depthTexture.destroy();
}
```

**Step 2: Run build**

Run: `pnpm build`
Expected: Build successful

**Step 3: Commit**

```bash
git add src/rendering/WebGPURenderer.ts
git commit -m "feat(renderer): add multi-chunk rendering support"
```

---

### Task 8: Engine integration with ChunkManager

**Files:**
- Modify: `src/core/Engine.ts`

**Step 1: Update Engine to use ChunkManager**

```typescript
// src/core/Engine.ts
import { vec3 } from 'gl-matrix';
import { Camera } from '../rendering/Camera';
import { WebGPURenderer } from '../rendering/WebGPURenderer';
import { InputManager } from '../input/InputManager';
import { ChunkManager } from '../voxel/ChunkManager';
import { DEFAULT_CONFIG } from './Config';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private camera: Camera;
  private input: InputManager;
  private chunkManager: ChunkManager;

  private running: boolean = false;
  private lastTime: number = 0;

  constructor(config: EngineConfig) {
    this.canvas = config.canvas;
    this.renderer = new WebGPURenderer(this.canvas);
    this.camera = new Camera();
    this.input = new InputManager(this.canvas);
    this.chunkManager = new ChunkManager();
  }

  async init(): Promise<void> {
    const success = await this.renderer.init();
    if (!success) {
      throw new Error('Failed to initialize WebGPU renderer');
    }

    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);

    // Load initial chunks (3x3 grid around origin for testing)
    const loadPromises: Promise<void>[] = [];
    for (let z = -1; z <= 1; z++) {
      for (let x = -1; x <= 1; x++) {
        loadPromises.push(this.loadAndUploadChunk(x, 0, z));
      }
    }
    await Promise.all(loadPromises);

    console.log(`Loaded ${this.chunkManager.getLoadedChunks().length} chunks`);
  }

  private async loadAndUploadChunk(cx: number, cy: number, cz: number): Promise<void> {
    const loaded = await this.chunkManager.loadChunk(cx, cy, cz);
    if (loaded.mesh) {
      const key = ChunkManager.getChunkKey(cx, cy, cz);
      loaded.gpuHandle = this.renderer.uploadMesh(key, loaded.mesh);
    }
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

    const moveDir = vec3.fromValues(
      (state.right ? 1 : 0) - (state.left ? 1 : 0),
      0,
      (state.forward ? 1 : 0) - (state.backward ? 1 : 0)
    );
    if (vec3.length(moveDir) > 0) {
      this.camera.move(moveDir, deltaTime);
    }

    if (state.mouseRightDown) {
      this.camera.look(state.mouseDeltaX, state.mouseDeltaY);
    }

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
    this.chunkManager.dispose();
    this.renderer.dispose();
  }
}
```

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Build successful

**Step 4: Commit**

```bash
git add src/core/Engine.ts
git commit -m "feat(engine): integrate ChunkManager for multi-chunk rendering"
```

---

### Task 9: Chunk Streaming

**Files:**
- Modify: `src/voxel/ChunkManager.ts`
- Modify: `src/core/Engine.ts`

**Step 1: Add streaming to ChunkManager**

```typescript
// Add to ChunkManager.ts:

import { DEFAULT_CONFIG, CHUNK_SIZE } from '../core/Config';

// Add method to update chunks based on camera position
async updateChunks(
  cameraX: number,
  cameraZ: number,
  onChunkLoaded?: (key: string, mesh: ChunkMesh) => void,
  onChunkUnloaded?: (key: string) => void
): Promise<void> {
  const renderDistance = DEFAULT_CONFIG.renderDistance;

  // Calculate camera chunk position
  const camChunkX = Math.floor(cameraX / CHUNK_SIZE);
  const camChunkZ = Math.floor(cameraZ / CHUNK_SIZE);

  // Determine which chunks should be loaded
  const shouldBeLoaded = new Set<string>();
  for (let z = camChunkZ - renderDistance; z <= camChunkZ + renderDistance; z++) {
    for (let x = camChunkX - renderDistance; x <= camChunkX + renderDistance; x++) {
      const dx = x - camChunkX;
      const dz = z - camChunkZ;
      if (dx * dx + dz * dz <= renderDistance * renderDistance) {
        shouldBeLoaded.add(ChunkManager.getChunkKey(x, 0, z));
      }
    }
  }

  // Unload chunks that are too far
  const toUnload: string[] = [];
  for (const [key] of this.chunks) {
    if (!shouldBeLoaded.has(key)) {
      toUnload.push(key);
    }
  }
  for (const key of toUnload) {
    const [x, y, z] = key.split(',').map(Number);
    if (onChunkUnloaded) onChunkUnloaded(key);
    this.unloadChunk(x, y, z);
  }

  // Load new chunks
  const loadPromises: Promise<void>[] = [];
  for (const key of shouldBeLoaded) {
    if (!this.chunks.has(key)) {
      const [x, y, z] = key.split(',').map(Number);
      loadPromises.push(
        this.loadChunk(x, y, z).then(loaded => {
          if (loaded.mesh && onChunkLoaded) {
            onChunkLoaded(key, loaded.mesh);
          }
        })
      );
    }
  }
  await Promise.all(loadPromises);
}
```

**Step 2: Add streaming to Engine update**

```typescript
// In Engine.ts update method, add streaming update:

private lastStreamUpdate = 0;
private streamUpdateInterval = 500; // ms

private update(deltaTime: number): void {
  // ... existing input handling ...

  // Update chunk streaming periodically
  const now = performance.now();
  if (now - this.lastStreamUpdate > this.streamUpdateInterval) {
    this.lastStreamUpdate = now;
    const pos = this.camera.position;
    this.chunkManager.updateChunks(
      pos[0], pos[2],
      (key, mesh) => this.renderer.uploadMesh(key, mesh),
      (key) => this.renderer.deleteMesh(key)
    );
  }
}
```

**Step 3: Run tests and build**

Run: `pnpm test && pnpm build`
Expected: All pass

**Step 4: Commit**

```bash
git add src/voxel/ChunkManager.ts src/core/Engine.ts
git commit -m "feat(streaming): add distance-based chunk loading/unloading"
```

---

### Task 10: Final Integration Test and Deploy

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Build**

Run: `pnpm build`
Expected: Build successful

**Step 3: Restart PM2 and test**

Run: `pm2 restart voxel-engine`

**Step 4: Test in browser**

Open: https://estelle-hub.mooo.com/voxel-engine/
Expected:
- Multiple chunks rendered
- Moving camera loads/unloads chunks dynamically
- Smooth 60 FPS

**Step 5: Push to remote**

```bash
git push origin master
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | GreedyMesher core | GreedyMesher.ts, test |
| 2 | Move ChunkMesh to shared types | types.ts |
| 3 | Switch Engine to GreedyMesher | Engine.ts |
| 4 | WorkerPool | WorkerPool.ts, test |
| 5 | MeshWorker | mesh.worker.ts, MeshWorkerPool.ts |
| 6 | ChunkManager core | ChunkManager.ts, test |
| 7 | Multi-chunk rendering | WebGPURenderer.ts |
| 8 | Engine integration | Engine.ts |
| 9 | Chunk streaming | ChunkManager.ts, Engine.ts |
| 10 | Final integration | - |
