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
