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
