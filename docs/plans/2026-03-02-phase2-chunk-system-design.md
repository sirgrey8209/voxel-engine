# Phase 2: Chunk System Design

## Date: 2026-03-02

## Overview

Phase 1 기반 위에 청크 시스템을 구축합니다. Greedy Meshing으로 삼각형을 90% 감소시키고, Web Worker로 메인스레드 블로킹을 방지하며, ChunkManager로 여러 청크를 관리합니다.

## Goals

1. **Greedy Mesher**: 인접 동일 블록 면을 병합하여 삼각형 90% 감소
2. **Worker Pool**: 메싱을 별도 스레드에서 실행
3. **ChunkManager**: 여러 청크 관리 및 카메라 기반 스트리밍
4. **청크 로딩/언로딩**: 렌더 거리 기반 동적 로딩

## Approach: 점진적 빌드

단계별로 동작 확인하며 진행:

```
1. Greedy Mesher (단일 청크에서 검증)
   ↓
2. Worker Pool + MeshWorker (비동기 메싱)
   ↓
3. ChunkManager (여러 청크 렌더링)
   ↓
4. 청크 스트리밍 (카메라 기반 로딩/언로딩)
```

## Design

### 1. Greedy Mesher

**알고리즘**: 각 축(X,Y,Z)에 대해 2D 슬라이스를 순회하며 greedy하게 직사각형 영역 확장

```
Before (NaiveMesher):     After (GreedyMesher):
┌─┬─┬─┬─┐                 ┌───────┐
│■│■│■│■│  4 quads   =>   │  ■■■■ │  1 quad
└─┴─┴─┴─┘                 └───────┘
```

**인터페이스**: NaiveMesher와 동일한 `generateMesh(chunk): ChunkMesh`

### 2. Worker Pool

```
Main Thread              Worker Pool
    │                    ┌─────────────┐
    ├── meshChunk() ────>│ WorkerPool  │
    │                    │  ├─ Worker 1│
    │                    │  ├─ Worker 2│
    │                    │  ├─ Worker 3│
    │                    │  └─ Worker 4│
    │<── Promise<Mesh> ──┴─────────────┘
```

**구성요소**:
- `WorkerPool`: 워커 풀 관리, 작업 분배
- `mesh.worker.ts`: 실제 메싱 수행 (GreedyMesher 사용)

### 3. ChunkManager

```typescript
class ChunkManager {
  private chunks: Map<string, Chunk>;      // "x,y,z" => Chunk
  private meshWorkerPool: WorkerPool;
  private renderer: WebGPURenderer;

  loadChunk(cx, cy, cz): Promise<void>;    // 청크 로드 + 메싱
  unloadChunk(cx, cy, cz): void;           // 청크 언로드
  update(cameraPos): void;                 // 거리 기반 스트리밍
  getVisibleChunks(): Chunk[];             // 렌더링할 청크 목록
}
```

### 4. 청크 스트리밍

- **렌더 거리**: 8 청크 (Config.renderDistance)
- **로딩 우선순위**: 카메라에 가까운 청크부터
- **언로딩**: 렌더 거리 밖의 청크

## Implementation Order

| Step | Component | Verification |
|------|-----------|--------------|
| 1 | GreedyMesher | 단일 청크에서 삼각형 감소 확인 |
| 2 | WorkerPool + MeshWorker | 비동기 메싱 동작 확인 |
| 3 | ChunkManager | 여러 청크 렌더링 |
| 4 | 청크 스트리밍 | 카메라 이동 시 로딩/언로딩 |

## Files to Create/Modify

**Create:**
- `src/meshing/GreedyMesher.ts`
- `src/workers/WorkerPool.ts`
- `src/workers/mesh.worker.ts`
- `src/voxel/ChunkManager.ts`

**Modify:**
- `src/core/Engine.ts` - ChunkManager 통합
- `src/rendering/WebGPURenderer.ts` - 다중 청크 렌더링

## Success Criteria

1. Greedy Mesher가 NaiveMesher 대비 삼각형 90%+ 감소
2. 메싱이 메인스레드를 블로킹하지 않음
3. 8x8 청크 그리드가 60 FPS로 렌더링됨
4. 카메라 이동 시 청크가 동적으로 로딩/언로딩됨
