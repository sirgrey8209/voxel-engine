// tests/voxel/NaiveMesher.test.ts
import { describe, it, expect } from 'vitest';
import { NaiveMesher, ChunkMesh } from '../../src/voxel/NaiveMesher';
import { Chunk } from '../../src/voxel/Chunk';
import { VoxelType } from '../../src/voxel/VoxelData';

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
