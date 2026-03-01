# FPS Style Camera System Design

## Date: 2026-03-01

## Overview

기존 Unity Scene View 스타일(구면 좌표계 기반 Orbit 카메라)에서 FPS 스타일 카메라로 변경.

## Requirements

- **WASD**: 수평 이동 (항상 작동, 우클릭 필요 없음)
- **우클릭 드래그**: 시선 방향 회전 (마우스룩)
- **Space**: 초기 카메라 위치/방향으로 리셋
- 상하 이동 (Q/E) 제거

## Design

### Camera.ts 변경사항

| 기존 | 변경 |
|------|------|
| 구면 좌표 (theta, phi, radius) | 위치 + yaw/pitch |
| `_target` (바라보는 지점) | 방향 벡터로 계산 |
| `orbit()` | 제거 |
| `pan()` | 제거 |
| `zoom()` | 제거 |
| `flyMove()` | `move()` - 항상 수평 이동 |
| - | `look()` - yaw/pitch 회전 |
| - | `reset()` - 초기 위치로 리셋 |

### 새로운 Camera 구조

```typescript
class Camera {
  private _position: vec3;        // 카메라 위치
  private yaw: number;            // 좌우 회전 (radians)
  private pitch: number;          // 상하 회전 (radians, clamped)

  private initialPosition: vec3;  // 리셋용 초기 위치
  private initialYaw: number;     // 리셋용 초기 yaw
  private initialPitch: number;   // 리셋용 초기 pitch

  move(direction: vec3, deltaTime: number): void;  // WASD
  look(deltaX: number, deltaY: number): void;      // 우클릭 드래그
  reset(): void;                                    // Space
}
```

### InputManager.ts 변경사항

- Q/E 키 제거
- Space 키 추가 (`reset` 상태)
- 기존: `up`, `down` (Q/E) 제거
- 신규: `reset` (Space) 추가

### Engine.ts 변경사항

- WASD 이동: 우클릭 조건 제거 (항상 작동)
- 우클릭 드래그: `orbit()` → `look()` 호출
- Space: `camera.reset()` 호출
- 중클릭 Pan, 스크롤 Zoom 제거

### 초기 카메라 설정

- 위치: (48, 24, 48) - 청크 외부에서 대각선 뷰
- yaw: -135도 (-3π/4) - 청크 중심(16,8,16)을 향함
- pitch: -20도 - 약간 아래를 봄

## Files to Modify

1. `src/rendering/Camera.ts` - 완전 재작성
2. `src/input/InputManager.ts` - Q/E 제거, Space 추가
3. `src/core/Engine.ts` - 입력 처리 로직 변경
4. `src/core/Config.ts` - Q/E 키 제거, Space 추가
