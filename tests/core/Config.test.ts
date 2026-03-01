import { describe, it, expect } from 'vitest';
import { Config, DEFAULT_CONFIG } from '../../src/core/Config';

describe('Config', () => {
  it('should have default chunk size of 32', () => {
    expect(DEFAULT_CONFIG.chunkSize).toBe(32);
  });

  it('should have default render distance', () => {
    expect(DEFAULT_CONFIG.renderDistance).toBe(8);
  });

  it('should have camera defaults', () => {
    expect(DEFAULT_CONFIG.camera.fov).toBe(60);
    expect(DEFAULT_CONFIG.camera.near).toBe(0.1);
    expect(DEFAULT_CONFIG.camera.far).toBe(1000);
  });
});
