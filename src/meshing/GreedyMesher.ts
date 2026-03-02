// src/meshing/GreedyMesher.ts
import { Chunk, CHUNK_SIZE } from '../voxel/Chunk';
import { VoxelType, VOXEL_COLORS, isSolid } from '../voxel/VoxelData';
import { ChunkMesh } from './types';

// Face directions with axis info for greedy meshing
// d: axis perpendicular to face (0=X, 1=Y, 2=Z)
// u, v: axes parallel to face
// backface: whether this is the negative direction face
interface FaceDirection {
  d: number;      // primary axis (perpendicular to face)
  u: number;      // first axis in the face plane
  v: number;      // second axis in the face plane
  backface: boolean;
  normal: [number, number, number];
}

const FACE_DIRECTIONS: FaceDirection[] = [
  { d: 0, u: 2, v: 1, backface: false, normal: [1, 0, 0] },   // +X
  { d: 0, u: 2, v: 1, backface: true, normal: [-1, 0, 0] },   // -X
  { d: 1, u: 0, v: 2, backface: false, normal: [0, 1, 0] },   // +Y
  { d: 1, u: 0, v: 2, backface: true, normal: [0, -1, 0] },   // -Y
  { d: 2, u: 0, v: 1, backface: false, normal: [0, 0, 1] },   // +Z
  { d: 2, u: 0, v: 1, backface: true, normal: [0, 0, -1] },   // -Z
];

export class GreedyMesher {
  static generateMesh(chunk: Chunk): ChunkMesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;

    // Process each face direction
    for (const face of FACE_DIRECTIONS) {
      // Iterate through slices perpendicular to the face direction
      for (let d = 0; d < CHUNK_SIZE; d++) {
        // Build 2D mask for this slice
        // mask[u + v * CHUNK_SIZE] = voxel type if face is exposed, else 0
        const mask: VoxelType[] = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(VoxelType.AIR);

        for (let v = 0; v < CHUNK_SIZE; v++) {
          for (let u = 0; u < CHUNK_SIZE; u++) {
            // Get position based on face direction
            const pos = [0, 0, 0];
            pos[face.d] = d;
            pos[face.u] = u;
            pos[face.v] = v;

            const voxelType = chunk.getVoxel(pos[0], pos[1], pos[2]);

            if (!isSolid(voxelType)) continue;

            // Check neighbor in face direction
            const neighborPos = [...pos];
            neighborPos[face.d] += face.backface ? -1 : 1;

            // Neighbor outside chunk boundary = exposed face
            const isNeighborOutside =
              neighborPos[face.d] < 0 || neighborPos[face.d] >= CHUNK_SIZE;

            let neighborSolid = false;
            if (!isNeighborOutside) {
              neighborSolid = isSolid(
                chunk.getVoxel(neighborPos[0], neighborPos[1], neighborPos[2])
              );
            }

            // Face is exposed if neighbor is air or outside
            if (!neighborSolid) {
              mask[u + v * CHUNK_SIZE] = voxelType;
            }
          }
        }

        // Greedy merge the mask
        const processed = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(false);

        for (let v = 0; v < CHUNK_SIZE; v++) {
          for (let u = 0; u < CHUNK_SIZE; u++) {
            const maskIdx = u + v * CHUNK_SIZE;
            const type = mask[maskIdx];

            if (type === VoxelType.AIR || processed[maskIdx]) continue;

            // Find width - extend in u direction while same type
            let width = 1;
            while (u + width < CHUNK_SIZE) {
              const nextIdx = (u + width) + v * CHUNK_SIZE;
              if (mask[nextIdx] !== type || processed[nextIdx]) break;
              width++;
            }

            // Find height - extend in v direction while all cells in row are same type
            let height = 1;
            outer: while (v + height < CHUNK_SIZE) {
              for (let du = 0; du < width; du++) {
                const checkIdx = (u + du) + (v + height) * CHUNK_SIZE;
                if (mask[checkIdx] !== type || processed[checkIdx]) {
                  break outer;
                }
              }
              height++;
            }

            // Mark all cells in rectangle as processed
            for (let dv = 0; dv < height; dv++) {
              for (let du = 0; du < width; du++) {
                processed[(u + du) + (v + dv) * CHUNK_SIZE] = true;
              }
            }

            // Generate quad for this merged rectangle
            const color = VOXEL_COLORS[type];

            // Calculate quad corners in 3D space
            // The quad is positioned at d (or d+1 for front faces)
            const quadD = face.backface ? d : d + 1;

            // Four corners of the quad (in u, v coordinates)
            const corners = [
              [u, v],               // bottom-left
              [u + width, v],       // bottom-right
              [u + width, v + height], // top-right
              [u, v + height],      // top-left
            ];

            // Convert to 3D and add vertices
            for (const [cu, cv] of corners) {
              const pos = [0, 0, 0];
              pos[face.d] = quadD;
              pos[face.u] = cu;
              pos[face.v] = cv;

              vertices.push(
                pos[0], pos[1], pos[2],                    // position
                face.normal[0], face.normal[1], face.normal[2],  // normal
                color[0], color[1], color[2]               // color
              );
            }

            // Add indices for two triangles
            // WebGPU default frontFace is CCW, cullMode is 'back'
            // So front-facing triangles need CCW winding
            if (face.backface) {
              // Backface (-X, -Y, -Z): CW winding (will be back-facing, but visible from inside)
              indices.push(
                vertexIndex, vertexIndex + 1, vertexIndex + 2,
                vertexIndex, vertexIndex + 2, vertexIndex + 3
              );
            } else {
              // Front face (+X, +Y, +Z): CCW winding (front-facing)
              indices.push(
                vertexIndex, vertexIndex + 3, vertexIndex + 2,
                vertexIndex, vertexIndex + 2, vertexIndex + 1
              );
            }
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
}
