// tests/voxel/VoxelData.test.ts
import { describe, it, expect } from 'vitest';
import { VoxelType, VOXEL_COLORS } from '../../src/voxel/VoxelData';

describe('VoxelData', () => {
  it('should define AIR as 0', () => {
    expect(VoxelType.AIR).toBe(0);
  });

  it('should define STONE as 1', () => {
    expect(VoxelType.STONE).toBe(1);
  });

  it('should define DIRT as 2', () => {
    expect(VoxelType.DIRT).toBe(2);
  });

  it('should define GRASS as 3', () => {
    expect(VoxelType.GRASS).toBe(3);
  });

  it('should have color for each voxel type', () => {
    expect(VOXEL_COLORS[VoxelType.STONE]).toBeDefined();
    expect(VOXEL_COLORS[VoxelType.DIRT]).toBeDefined();
    expect(VOXEL_COLORS[VoxelType.GRASS]).toBeDefined();
  });
});
