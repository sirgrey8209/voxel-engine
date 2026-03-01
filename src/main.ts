// src/main.ts
import { Engine } from './core/Engine';

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // WebGPU support check
  if (!navigator.gpu) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.';
    }
    throw new Error('WebGPU not supported');
  }

  const engine = new Engine({ canvas });

  try {
    await engine.init();
    engine.start();
    console.log('Voxel Engine started');
    console.log('Controls:');
    console.log('  Right-click drag: Orbit camera');
    console.log('  Middle-click drag: Pan camera');
    console.log('  Scroll: Zoom in/out');
    console.log('  Right-click + WASD: Fly through');
  } catch (error) {
    console.error('Failed to initialize engine:', error);
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Failed to initialize: ${error}`;
    }
  }
}

main().catch(console.error);
