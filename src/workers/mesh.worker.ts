// src/workers/mesh.worker.ts
import { GreedyMesher } from '../meshing/GreedyMesher';
import { Chunk } from '../voxel/Chunk';

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
