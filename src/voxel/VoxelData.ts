// src/voxel/VoxelData.ts
export enum VoxelType {
  AIR = 0,
  STONE = 1,
  DIRT = 2,
  GRASS = 3,
}

// RGB colors (0-1 range)
export type Color3 = [number, number, number];

export const VOXEL_COLORS: Record<VoxelType, Color3> = {
  [VoxelType.AIR]: [0, 0, 0],           // 투명 (사용 안 됨)
  [VoxelType.STONE]: [0.5, 0.5, 0.5],   // 회색
  [VoxelType.DIRT]: [0.6, 0.4, 0.2],    // 갈색
  [VoxelType.GRASS]: [0.3, 0.7, 0.2],   // 녹색
};

// 복셀이 고체인지 확인
export function isSolid(voxelType: VoxelType): boolean {
  return voxelType !== VoxelType.AIR;
}
