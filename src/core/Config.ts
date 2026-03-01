export interface CameraConfig {
  fov: number;         // Field of view in degrees
  near: number;        // Near clip plane
  far: number;         // Far clip plane
  moveSpeed: number;   // Movement speed (units/sec)
  lookSpeed: number;   // Mouse look sensitivity
}

export interface Config {
  chunkSize: number;
  renderDistance: number;
  camera: CameraConfig;
}

export const DEFAULT_CONFIG: Config = {
  chunkSize: 32,
  renderDistance: 8,
  camera: {
    fov: 60,
    near: 0.1,
    far: 1000,
    moveSpeed: 15,
    lookSpeed: 0.003,
  },
};
