// src/voxel/ChunkManager.ts
import { Chunk } from './Chunk';
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
