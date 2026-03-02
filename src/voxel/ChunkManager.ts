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

  // Update chunks based on camera position
  async updateChunks(
    cameraX: number,
    cameraZ: number,
    onChunkLoaded?: (key: string, mesh: ChunkMesh) => GPUMeshHandle | null | undefined,
    onChunkUnloaded?: (key: string) => void
  ): Promise<void> {
    const renderDistance = 3; // chunks in each direction

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
              loaded.gpuHandle = onChunkLoaded(key, loaded.mesh) ?? null;
            }
          })
        );
      }
    }
    await Promise.all(loadPromises);
  }
}
