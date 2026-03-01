// src/voxel/Chunk.ts
import { VoxelType } from './VoxelData';

export const CHUNK_SIZE = 32;
const CHUNK_SIZE_SQUARED = CHUNK_SIZE * CHUNK_SIZE;
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;

export class Chunk {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly voxels: Uint16Array;

  private _isDirty: boolean = true;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.voxels = new Uint16Array(CHUNK_VOLUME);
  }

  get isDirty(): boolean {
    return this._isDirty;
  }

  clearDirty(): void {
    this._isDirty = false;
  }

  private getIndex(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      throw new RangeError(`Voxel position out of bounds: (${x}, ${y}, ${z})`);
    }
    return x + y * CHUNK_SIZE + z * CHUNK_SIZE_SQUARED;
  }

  getVoxel(x: number, y: number, z: number): VoxelType {
    return this.voxels[this.getIndex(x, y, z)] as VoxelType;
  }

  setVoxel(x: number, y: number, z: number, type: VoxelType): void {
    const index = this.getIndex(x, y, z);
    if (this.voxels[index] !== type) {
      this.voxels[index] = type;
      this._isDirty = true;
    }
  }

  // 간단한 지형 생성 (테스트용)
  fillGround(height: number = 16): void {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < height; y++) {
          if (y === height - 1) {
            this.setVoxel(x, y, z, VoxelType.GRASS);
          } else if (y >= height - 4) {
            this.setVoxel(x, y, z, VoxelType.DIRT);
          } else {
            this.setVoxel(x, y, z, VoxelType.STONE);
          }
        }
      }
    }
  }
}
