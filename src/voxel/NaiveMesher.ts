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
