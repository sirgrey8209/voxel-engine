# Phase 1: Foundation Design

> Voxel Engine 기반 구축 설계 문서

---

## 1. 개요

### 1.1 목표

Phase 1에서는 Voxel Engine의 기반을 구축한다:

- 프로젝트 환경 셋업 (Vite + TypeScript + Vitest)
- WebGPU 렌더링 파이프라인 초기화
- 유니티 Scene 뷰 스타일 카메라 시스템
- 단일 청크(32³ 복셀) 렌더링

### 1.2 범위

| 포함 | 제외 |
|------|------|
| WebGPU 렌더러 | WebGL 폴백 (Phase 5) |
| 단일 청크 렌더링 | 다중 청크/월드 (Phase 2) |
| 기본 메싱 (Naive) | Greedy Meshing (Phase 2) |
| Scene 뷰 카메라 | 물리/충돌 (Phase 3) |

---

## 2. 기술 결정

### 2.1 프로젝트 셋업

| 항목 | 선택 | 이유 |
|------|------|------|
| 빌드 도구 | Vite | 빠른 HMR, 네이티브 ESM |
| 언어 | TypeScript (strict) | 타입 안전성 |
| 테스트 | Vitest | Vite 통합, 빠른 실행 |
| 패키지 매니저 | pnpm | 빠른 설치, 디스크 효율 |

### 2.2 렌더링

| 항목 | 선택 | 이유 |
|------|------|------|
| 렌더러 | WebGPU only | 집중 개발, 폴백은 Phase 5 |
| 셰이더 | WGSL | WebGPU 네이티브 |
| 메싱 | Naive (면 단위) | Phase 1 단순화, Greedy는 Phase 2 |

### 2.3 카메라

유니티 Scene 뷰 스타일:

| 입력 | 동작 |
|------|------|
| 우클릭 드래그 | 회전 (Orbit) |
| 중클릭 드래그 | 팬 (Pan) |
| 스크롤 | 줌 (Dolly) |
| 우클릭 + WASD | 플라이스루 (Fly-through) |

---

## 3. 아키텍처

### 3.1 디렉토리 구조

```
voxel-engine/
├── src/
│   ├── core/
│   │   ├── Engine.ts          # 메인 루프, 초기화
│   │   └── Config.ts          # 전역 설정
│   │
│   ├── rendering/
│   │   ├── WebGPURenderer.ts  # WebGPU 렌더러
│   │   ├── Camera.ts          # Scene 뷰 카메라
│   │   └── shaders/
│   │       └── voxel.wgsl     # 복셀 셰이더
│   │
│   ├── voxel/
│   │   ├── Chunk.ts           # 청크 데이터 구조
│   │   ├── VoxelData.ts       # 복셀 타입 정의
│   │   └── NaiveMesher.ts     # 단순 메싱
│   │
│   ├── input/
│   │   └── InputManager.ts    # 키보드/마우스 입력
│   │
│   └── main.ts                # 진입점
│
├── public/
│   └── index.html
│
├── tests/
│   ├── voxel/
│   │   └── Chunk.test.ts
│   └── setup.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

### 3.2 컴포넌트 관계

```
┌─────────────────────────────────────────────────────┐
│                      main.ts                         │
│                         │                            │
│                         ▼                            │
│                   ┌──────────┐                       │
│                   │  Engine  │                       │
│                   └────┬─────┘                       │
│          ┌─────────────┼─────────────┐              │
│          ▼             ▼             ▼              │
│   ┌────────────┐ ┌──────────┐ ┌─────────────┐      │
│   │   Camera   │ │ Renderer │ │ InputManager│      │
│   └────────────┘ └────┬─────┘ └─────────────┘      │
│                       │                             │
│                       ▼                             │
│               ┌──────────────┐                      │
│               │    Chunk     │                      │
│               │  (메시 데이터) │                     │
│               └──────────────┘                      │
└─────────────────────────────────────────────────────┘
```

### 3.3 데이터 흐름

```
[사용자 입력]
     │
     ▼
[InputManager] ──────────────────────┐
     │                               │
     ▼                               ▼
[Camera 업데이트]              [블록 조작 (Phase 3)]
     │
     ▼
[Engine.update()]
     │
     ├── Camera.getViewMatrix()
     ├── Camera.getProjectionMatrix()
     │
     ▼
[Renderer.render()]
     │
     ├── 유니폼 업데이트 (MVP 행렬)
     ├── 청크 메시 바인딩
     │
     ▼
[GPU 렌더링]
```

---

## 4. 핵심 인터페이스

### 4.1 Engine

```typescript
interface EngineConfig {
  canvas: HTMLCanvasElement;
  chunkSize?: number;  // 기본값: 32
}

class Engine {
  constructor(config: EngineConfig);
  async init(): Promise<void>;
  start(): void;
  stop(): void;
}
```

### 4.2 Camera

```typescript
interface CameraState {
  position: vec3;
  target: vec3;      // 오빗 중심점
  up: vec3;
  fov: number;
  near: number;
  far: number;
}

class Camera {
  getViewMatrix(): mat4;
  getProjectionMatrix(aspect: number): mat4;

  // Scene 뷰 컨트롤
  orbit(deltaX: number, deltaY: number): void;
  pan(deltaX: number, deltaY: number): void;
  zoom(delta: number): void;
  flyMove(direction: vec3, delta: number): void;
}
```

### 4.3 Chunk

```typescript
const CHUNK_SIZE = 32;

class Chunk {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  // 복셀 데이터 (32³ × 2바이트 = 64KB)
  readonly voxels: Uint16Array;

  getVoxel(x: number, y: number, z: number): number;
  setVoxel(x: number, y: number, z: number, id: number): void;

  // 메싱
  buildMesh(): ChunkMesh;
}

interface ChunkMesh {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
}
```

### 4.4 Renderer

```typescript
interface Renderer {
  init(canvas: HTMLCanvasElement): Promise<boolean>;
  render(chunk: Chunk, camera: Camera): void;
  uploadMesh(mesh: ChunkMesh): GPUMeshHandle;
  dispose(): void;
}
```

---

## 5. 성공 기준

Phase 1 완료 조건:

1. **프로젝트 셋업**: `pnpm dev`로 개발 서버 실행
2. **WebGPU 초기화**: 캔버스에 배경색 렌더링
3. **청크 렌더링**: 32³ 청크의 복셀이 화면에 표시
4. **카메라 동작**: 마우스로 회전/팬/줌 동작
5. **테스트 통과**: `pnpm test` 성공

---

## 6. 리스크 및 완화

| 리스크 | 완화 방안 |
|--------|----------|
| WebGPU 미지원 브라우저 | Phase 1에서는 Chrome 권장, 폴백은 Phase 5 |
| 수학 라이브러리 선택 | gl-matrix 사용 (검증된 라이브러리) |
| 메싱 성능 | Phase 1은 Naive로 단순화, 최적화는 Phase 2 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-03-01 | 초안 작성 |
