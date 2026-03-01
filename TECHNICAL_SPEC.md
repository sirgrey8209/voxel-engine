# Voxel Engine 기술 설계 문서

> 웹 기반 고성능 복셀 게임 엔진

---

## 1. 개요

### 1.1 목표
- **플랫폼**: 웹 중심 (데스크톱 웹 > 모바일 웹 > 모바일 앱 폴백)
- **복셀 규모**: 1024 × 1024 × 512 (~5.4억 복셀)
- **동적 수정**: 실시간 블록 추가/삭제 (마인크래프트 스타일)
- **성능 목표**: 마인크래프트 이상의 FPS

### 1.2 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 언어 | TypeScript | 타입 안전성, 웹 네이티브 |
| 렌더링 (메인) | WebGPU | Compute Shader 지원 |
| 렌더링 (폴백) | WebGL 2.0 | 모바일/구형 브라우저 |
| 병렬 처리 | Web Workers | 메싱, 청크 생성 |
| 빌드 | Vite + TypeScript | 빠른 HMR, 번들 최적화 |

### 1.3 브라우저 지원 목표

| 브라우저 | WebGPU | WebGL 폴백 |
|----------|--------|------------|
| Chrome/Edge 113+ | ✅ | - |
| Firefox 141+ | ✅ | - |
| Safari 26+ (iOS 26+) | ✅ | - |
| 구형 브라우저 | - | ✅ WebGL 2.0 |
| Android Chrome 121+ | ✅ (제한적) | ✅ |

---

## 2. 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Input     │  │   Camera    │  │   Game Logic        │  │
│  │   Manager   │  │   System    │  │   (Player, Physics) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                       Voxel Core                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   World     │  │   Chunk     │  │   Meshing           │  │
│  │   Manager   │  │   System    │  │   System            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   LOD       │  │   Culling   │  │   Lighting          │  │
│  │   System    │  │   System    │  │   System            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Rendering Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Renderer (Abstract)                  │   │
│  ├──────────────────────┬───────────────────────────────┤   │
│  │   WebGPU Renderer    │    WebGL 2.0 Renderer         │   │
│  │   (Primary)          │    (Fallback)                 │   │
│  └──────────────────────┴───────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      Worker Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Mesh      │  │   Chunk     │  │   World Gen         │  │
│  │   Worker    │  │   Worker    │  │   Worker            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 디렉토리 구조

```
voxel-engine/
├── src/
│   ├── core/                    # 핵심 엔진
│   │   ├── Engine.ts            # 메인 엔진 클래스
│   │   ├── World.ts             # 월드 관리
│   │   └── Config.ts            # 설정
│   │
│   ├── voxel/                   # 복셀 시스템
│   │   ├── Chunk.ts             # 청크 데이터 구조
│   │   ├── ChunkManager.ts      # 청크 로딩/언로딩
│   │   ├── VoxelData.ts         # 복셀 데이터 타입
│   │   └── SparseVoxelOctree.ts # SVO 구현 (선택)
│   │
│   ├── meshing/                 # 메싱 시스템
│   │   ├── Mesher.ts            # 메싱 인터페이스
│   │   ├── GreedyMesher.ts      # Greedy Meshing 구현
│   │   ├── NaiveMesher.ts       # 단순 메싱 (비교용)
│   │   └── MeshWorker.ts        # Worker 기반 메싱
│   │
│   ├── rendering/               # 렌더링
│   │   ├── Renderer.ts          # 추상 렌더러
│   │   ├── WebGPURenderer.ts    # WebGPU 구현
│   │   ├── WebGLRenderer.ts     # WebGL 2.0 구현
│   │   ├── Camera.ts            # 카메라
│   │   └── shaders/             # 셰이더
│   │       ├── voxel.wgsl       # WebGPU 셰이더
│   │       └── voxel.glsl       # WebGL 셰이더
│   │
│   ├── culling/                 # 컬링 시스템
│   │   ├── FrustumCuller.ts     # Frustum Culling
│   │   └── OcclusionCuller.ts   # Occlusion Culling (선택)
│   │
│   ├── lod/                     # LOD 시스템
│   │   ├── LODManager.ts        # LOD 레벨 관리
│   │   └── LODChunk.ts          # LOD 청크 생성
│   │
│   ├── lighting/                # 조명
│   │   ├── AmbientOcclusion.ts  # AO 계산
│   │   └── SkyLight.ts          # 스카이라이트
│   │
│   ├── input/                   # 입력
│   │   ├── InputManager.ts      # 키보드/마우스
│   │   └── TouchInput.ts        # 터치 (모바일)
│   │
│   ├── physics/                 # 물리/충돌
│   │   ├── Collision.ts         # 충돌 감지
│   │   └── RayCaster.ts         # 레이캐스팅
│   │
│   ├── workers/                 # Web Workers
│   │   ├── mesh.worker.ts       # 메싱 워커
│   │   ├── chunk.worker.ts      # 청크 생성 워커
│   │   └── WorkerPool.ts        # 워커 풀 관리
│   │
│   └── utils/                   # 유틸리티
│       ├── Math.ts              # 수학 함수
│       ├── Pool.ts              # 오브젝트 풀링
│       └── Debug.ts             # 디버그 도구
│
├── public/
│   └── index.html
│
├── tests/
│   └── ...
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── TECHNICAL_SPEC.md
```

---

## 3. 복셀 데이터 구조

### 3.1 복셀 타입

```typescript
// 복셀 ID (16비트)
type VoxelId = number; // 0 = 공기, 1-65535 = 블록 타입

// 복셀 데이터 (확장 시)
interface VoxelData {
  id: VoxelId;           // 블록 타입
  light: number;         // 조명 레벨 (4비트 sky + 4비트 block)
  metadata?: number;     // 추가 데이터 (회전 등)
}
```

### 3.2 청크 구조

```typescript
const CHUNK_SIZE = 32;  // 32 × 32 × 32 = 32,768 복셀

interface Chunk {
  // 위치
  x: number;
  y: number;
  z: number;

  // 복셀 데이터 (Flat Array - 메모리 효율)
  // 인덱스 = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE
  voxels: Uint16Array;  // 32^3 * 2바이트 = 64KB

  // 메시 데이터
  mesh: ChunkMesh | null;

  // 상태
  isDirty: boolean;      // 재메싱 필요
  isLoaded: boolean;
  lodLevel: number;      // 0 = 최고, 1, 2, 3...
}

interface ChunkMesh {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;

  // GPU 버퍼 (렌더러별)
  gpuBuffer?: GPUBuffer | WebGLBuffer;
}
```

### 3.3 월드 구조

```typescript
// 목표: 1024 × 1024 × 512
// 청크 수: 32 × 32 × 16 = 16,384 청크

interface World {
  chunks: Map<string, Chunk>;  // key = "x,y,z"

  // 월드 범위
  sizeX: number;  // 1024
  sizeY: number;  // 512 (높이)
  sizeZ: number;  // 1024

  // 청크 범위
  chunksX: number;  // 32
  chunksY: number;  // 16
  chunksZ: number;  // 32
}
```

### 3.4 메모리 예산

| 항목 | 계산 | 예상 |
|------|------|------|
| 전체 복셀 (raw) | 1024×1024×512 × 2B | 1GB |
| 로드된 청크 (256개) | 256 × 64KB | 16MB |
| 메시 버퍼 (256개) | 256 × ~100KB | 25MB |
| **총 런타임** | | **~50-100MB** |

> 전체 월드를 로드하지 않고 플레이어 주변만 로드 (스트리밍)

---

## 4. 메싱 시스템

### 4.1 Greedy Meshing 알고리즘

```
목표: 인접한 동일 복셀 면을 하나의 큰 쿼드로 병합

예시 (2D 슬라이스):
┌─┬─┬─┬─┐      ┌───────┐
│A│A│A│A│  =>  │   A   │  (4면 → 1면)
├─┼─┼─┼─┤      ├───────┤
│B│B│A│A│  =>  │ B │ A │  (4면 → 2면)
└─┴─┴─┴─┘      └───┴───┘

성능: 청크당 50-200μs (싱글스레드)
삼각형 감소: 최대 90%+
```

### 4.2 메싱 파이프라인

```
[청크 수정]
     ↓
[Dirty 플래그 설정]
     ↓
[Worker에 메싱 요청] ──────────────────────┐
     ↓                                     │
[Greedy Meshing 실행] (Worker Thread)      │
     ↓                                     │
[메시 데이터 반환] ←───────────────────────┘
     ↓
[GPU 버퍼 업로드] (Main Thread)
     ↓
[렌더링]
```

### 4.3 Worker 기반 병렬 메싱

```typescript
// 워커 풀 크기
const MESH_WORKER_COUNT = navigator.hardwareConcurrency || 4;

// 메시 요청 큐
interface MeshRequest {
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  voxelData: Uint16Array;  // Transferable
  priority: number;        // 카메라 거리 기반
}
```

---

## 5. 렌더링 시스템

### 5.1 렌더러 추상화

```typescript
interface Renderer {
  // 초기화
  init(canvas: HTMLCanvasElement): Promise<boolean>;

  // 프레임 렌더링
  render(world: World, camera: Camera): void;

  // 청크 메시 업로드
  uploadChunkMesh(chunk: Chunk): void;

  // 청크 메시 삭제
  deleteChunkMesh(chunk: Chunk): void;

  // 리소스 정리
  dispose(): void;
}
```

### 5.2 WebGPU 렌더러

```typescript
// 파이프라인 구조
WebGPU Pipeline:
├── Vertex Shader (voxel.wgsl)
│   ├── 위치 변환 (MVP)
│   ├── 노멀 → 조명
│   └── UV → 텍스처
│
├── Fragment Shader (voxel.wgsl)
│   ├── 텍스처 샘플링
│   ├── AO 적용
│   └── 안개 (거리 기반)
│
└── Compute Shader (선택적)
    ├── GPU 메싱
    └── Frustum Culling
```

### 5.3 WebGL 2.0 폴백

```typescript
// WebGPU 미지원 시 자동 폴백
async function createRenderer(canvas: HTMLCanvasElement): Promise<Renderer> {
  // WebGPU 시도
  if (navigator.gpu) {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) {
      return new WebGPURenderer(canvas, adapter);
    }
  }

  // WebGL 2.0 폴백
  const gl = canvas.getContext('webgl2');
  if (gl) {
    return new WebGLRenderer(canvas, gl);
  }

  throw new Error('No supported renderer');
}
```

### 5.4 셰이더 (WGSL 예시)

```wgsl
// voxel.wgsl

struct Uniforms {
  mvp: mat4x4<f32>,
  cameraPos: vec3<f32>,
  fogDistance: f32,
  fogColor: vec3<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var textureAtlas: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) ao: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) ao: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvp * vec4<f32>(input.position, 1.0);
  output.worldPos = input.position;
  output.normal = input.normal;
  output.uv = input.uv;
  output.ao = input.ao;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // 텍스처 샘플링
  let texColor = textureSample(textureAtlas, textureSampler, input.uv);

  // 기본 조명 (디렉셔널)
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
  let diffuse = max(dot(input.normal, lightDir), 0.3);

  // AO 적용
  let ao = input.ao;

  // 안개
  let dist = distance(input.worldPos, uniforms.cameraPos);
  let fogFactor = clamp((uniforms.fogDistance - dist) / uniforms.fogDistance, 0.0, 1.0);

  var color = texColor.rgb * diffuse * ao;
  color = mix(uniforms.fogColor, color, fogFactor);

  return vec4<f32>(color, texColor.a);
}
```

---

## 6. 컬링 시스템

### 6.1 Frustum Culling

```typescript
interface Frustum {
  planes: Plane[6];  // Near, Far, Left, Right, Top, Bottom
}

function isChunkVisible(chunk: Chunk, frustum: Frustum): boolean {
  // 청크 AABB vs Frustum 검사
  const min = [chunk.x * CHUNK_SIZE, chunk.y * CHUNK_SIZE, chunk.z * CHUNK_SIZE];
  const max = [min[0] + CHUNK_SIZE, min[1] + CHUNK_SIZE, min[2] + CHUNK_SIZE];

  for (const plane of frustum.planes) {
    if (isBoxOutsidePlane(min, max, plane)) {
      return false;
    }
  }
  return true;
}
```

### 6.2 거리 기반 컬링

```typescript
const RENDER_DISTANCE = 8;  // 청크 단위 (256 블록)

function shouldLoadChunk(chunk: ChunkCoord, camera: Camera): boolean {
  const dx = chunk.x - Math.floor(camera.x / CHUNK_SIZE);
  const dz = chunk.z - Math.floor(camera.z / CHUNK_SIZE);
  const distance = Math.sqrt(dx * dx + dz * dz);
  return distance <= RENDER_DISTANCE;
}
```

---

## 7. LOD 시스템

### 7.1 LOD 레벨

| LOD | 청크 크기 | 복셀 크기 | 거리 (청크) |
|-----|----------|----------|-------------|
| 0 | 32³ | 1m | 0-4 |
| 1 | 32³ (2x 샘플링) | 2m | 4-8 |
| 2 | 32³ (4x 샘플링) | 4m | 8-12 |
| 3 | 32³ (8x 샘플링) | 8m | 12+ |

### 7.2 LOD 전환

```typescript
function getLODLevel(distance: number): number {
  if (distance < 4) return 0;
  if (distance < 8) return 1;
  if (distance < 12) return 2;
  return 3;
}

// LOD 경계 심 방지: Transvoxel 알고리즘 (선택적)
```

---

## 8. 조명 시스템

### 8.1 Ambient Occlusion

```typescript
// 버텍스 AO (마인크래프트 스타일)
// 각 버텍스에서 인접 3개 복셀 확인

function calculateAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0.0;  // 완전 가려짐
  return (3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0)) / 3.0;
}

// AO 값: 0.0 (어두움) ~ 1.0 (밝음)
```

### 8.2 스카이라이트

```typescript
// 하늘에서 수직으로 전파
// 높이에 따른 자연광

function propagateSkyLight(chunk: Chunk): void {
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      let light = 15;  // 최대 밝기
      for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
        const voxel = chunk.getVoxel(x, y, z);
        if (voxel !== 0) {
          light = Math.max(light - 1, 0);  // 감쇠
        }
        chunk.setSkyLight(x, y, z, light);
      }
    }
  }
}
```

---

## 9. 입력 및 물리

### 9.1 입력 시스템

```typescript
interface InputState {
  // 이동
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;

  // 마우스
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
  leftClick: boolean;
  rightClick: boolean;

  // 터치 (모바일)
  touches: Touch[];
}
```

### 9.2 충돌 감지

```typescript
// AABB 충돌
interface AABB {
  min: vec3;
  max: vec3;
}

function checkCollision(playerAABB: AABB, world: World): CollisionResult {
  // 플레이어 AABB와 겹치는 복셀 검사
  // 충돌 시 밀어내기 벡터 반환
}

// 레이캐스팅 (블록 선택/파괴)
function raycast(origin: vec3, direction: vec3, maxDistance: number, world: World): RaycastHit | null {
  // DDA 알고리즘
  // 복셀 그리드 순회
}
```

---

## 10. 성능 목표 및 최적화

### 10.1 목표 성능

| 플랫폼 | 목표 FPS | 렌더 거리 |
|--------|----------|-----------|
| 데스크톱 웹 | 60+ | 12 청크 (384블록) |
| 모바일 웹 (고사양) | 60 | 8 청크 (256블록) |
| 모바일 웹 (저사양) | 30 | 4 청크 (128블록) |

### 10.2 최적화 전략

| 기법 | 효과 | 우선순위 |
|------|------|----------|
| Greedy Meshing | 삼각형 90% 감소 | 필수 |
| Frustum Culling | 렌더 콜 50-80% 감소 | 필수 |
| Worker 메싱 | 메인스레드 블로킹 방지 | 필수 |
| 청크 풀링 | GC 감소 | 높음 |
| 버텍스 압축 | 메모리 50% 감소 | 중간 |
| LOD | 원거리 폴리곤 감소 | 중간 |
| Occlusion Culling | 가려진 청크 제외 | 낮음 |
| GPU Compute 메싱 | 메싱 속도 10x | 선택 |

### 10.3 메모리 최적화

```typescript
// 오브젝트 풀링
const chunkPool = new ObjectPool<Chunk>(() => new Chunk());
const meshPool = new ObjectPool<ChunkMesh>(() => new ChunkMesh());

// 버텍스 압축 (선택적)
// Position: 3 * float32 → 1 * uint32 (10-10-10-2 비트)
// Normal: 3 * float32 → 1 * uint8 (6방향 인덱스)
// UV + AO: 2 * float32 + float32 → 1 * uint16
```

---

## 11. 개발 로드맵

### Phase 1: 기반 (1-2주)
- [ ] 프로젝트 셋업 (Vite + TypeScript)
- [ ] WebGPU 초기화 + 기본 렌더링
- [ ] 카메라 시스템 (FPS 스타일)
- [ ] 단일 청크 렌더링

### Phase 2: 청크 시스템 (2-3주)
- [ ] 청크 데이터 구조
- [ ] Greedy Meshing 구현
- [ ] Worker 기반 메싱
- [ ] 청크 로딩/언로딩

### Phase 3: 동적 수정 (1-2주)
- [ ] 레이캐스팅 (블록 선택)
- [ ] 블록 추가/삭제
- [ ] 청크 재메싱 최적화

### Phase 4: 최적화 (2주)
- [ ] Frustum Culling
- [ ] LOD 시스템
- [ ] 성능 프로파일링

### Phase 5: 폴백 + 모바일 (2주)
- [ ] WebGL 2.0 렌더러
- [ ] 터치 입력
- [ ] 모바일 성능 최적화

### Phase 6: 폴리싱 (2주)
- [ ] 조명 (AO, 스카이라이트)
- [ ] 안개
- [ ] 텍스처 아틀라스
- [ ] 사운드 (선택)

---

## 12. 참고 자료

### 논문
- GigaVoxels (2009) - Ray-Guided Streaming
- Efficient Sparse Voxel Octrees (2010) - NVIDIA
- SSVDAG (2016) - 압축 최적화

### 오픈소스 참고
- [Divine Voxel Engine](https://github.com/Divine-Star-Software/DivineVoxelEngine) - 아키텍처 참고
- [Voxel.js](https://voxeljs.com/) - 웹 복셀 게임
- [0fps Meshing Article](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)

### WebGPU 리소스
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)
- [WGSL Reference](https://www.w3.org/TR/WGSL/)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 0.1 | 2024-XX-XX | 초안 작성 |

