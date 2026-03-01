// tests/voxel/Chunk.test.ts
import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE } from '../../src/voxel/Chunk';
import { VoxelType } from '../../src/voxel/VoxelData';

describe('Chunk', () => {
  it('should have CHUNK_SIZE of 32', () => {
    expect(CHUNK_SIZE).toBe(32);
  });

  it('should create chunk at position', () => {
    const chunk = new Chunk(1, 2, 3);
    expect(chunk.x).toBe(1);
    expect(chunk.y).toBe(2);
    expect(chunk.z).toBe(3);
  });

  it('should initialize with all AIR', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.getVoxel(0, 0, 0)).toBe(VoxelType.AIR);
    expect(chunk.getVoxel(15, 15, 15)).toBe(VoxelType.AIR);
  });

  it('should set and get voxel', () => {
    const chunk = new Chunk(0, 0, 0);
    chunk.setVoxel(5, 10, 15, VoxelType.STONE);
    expect(chunk.getVoxel(5, 10, 15)).toBe(VoxelType.STONE);
  });

  it('should throw for out of bounds access', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(() => chunk.getVoxel(-1, 0, 0)).toThrow();
    expect(() => chunk.getVoxel(32, 0, 0)).toThrow();
    expect(() => chunk.setVoxel(0, 32, 0, VoxelType.STONE)).toThrow();
  });

  it('should mark dirty when voxel changes', () => {
    const chunk = new Chunk(0, 0, 0);
    expect(chunk.isDirty).toBe(true); // 초기 상태는 dirty
    chunk.clearDirty();
    expect(chunk.isDirty).toBe(false);
    chunk.setVoxel(0, 0, 0, VoxelType.STONE);
    expect(chunk.isDirty).toBe(true);
  });
});
