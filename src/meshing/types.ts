// src/meshing/types.ts
export interface ChunkMesh {
  // position(3) + normal(3) + color(3) = 9 floats per vertex
  vertices: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
}
