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
    expect(greedyMesh.indexCount).toBeLessThan(naiveMesh.indexCount * 0.5);
  });

  it('should handle single voxel', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setVoxel(5, 5, 5, VoxelType.STONE);
    const mesh = GreedyMesher.generateMesh(chunk);
    expect(mesh.indexCount).toBe(36); // 6 faces * 6 indices
  });

  it('should handle empty chunk', () => {
    const chunk = new Chunk(0, 0, 0);
    const mesh = GreedyMesher.generateMesh(chunk);
    expect(mesh.indexCount).toBe(0);
    expect(mesh.vertexCount).toBe(0);
  });

  it('should merge adjacent same-type voxels', () => {
    const chunk = new Chunk(0, 0, 0);
    for (let x = 0; x < 4; x++) {
      chunk.setVoxel(x, 0, 0, VoxelType.STONE);
    }
    const naiveMesh = NaiveMesher.generateMesh(chunk);
    const greedyMesh = GreedyMesher.generateMesh(chunk);
    expect(greedyMesh.indexCount).toBeLessThan(naiveMesh.indexCount);
  });
});
