export interface CameraConfig {
  fov: number;        // Field of view in degrees
  near: number;       // Near clip plane
  far: number;        // Far clip plane
  moveSpeed: number;  // Fly-through speed
  rotateSpeed: number; // Orbit rotation sensitivity
  panSpeed: number;   // Pan sensitivity
  zoomSpeed: number;  // Zoom sensitivity
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
    moveSpeed: 10,
    rotateSpeed: 0.005,
    panSpeed: 0.01,
    zoomSpeed: 0.5,
  },
};
