// src/core/Engine.ts
import { vec3 } from 'gl-matrix';
import { Camera } from '../rendering/Camera';
import { WebGPURenderer } from '../rendering/WebGPURenderer';
import { InputManager } from '../input/InputManager';
import { Chunk } from '../voxel/Chunk';
import { NaiveMesher } from '../voxel/NaiveMesher';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private camera: Camera;
  private input: InputManager;
  private chunk: Chunk;

  private running: boolean = false;
  private lastTime: number = 0;

  constructor(config: EngineConfig) {
    this.canvas = config.canvas;
    this.renderer = new WebGPURenderer(this.canvas);
    this.camera = new Camera();
    this.input = new InputManager(this.canvas);
    this.chunk = new Chunk(0, 0, 0);
  }

  async init(): Promise<void> {
    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);

    // Initialize renderer
    const success = await this.renderer.init();
    if (!success) {
      throw new Error('Failed to initialize WebGPU renderer');
    }

    // Generate test terrain
    this.chunk.fillGround(16);

    // Generate and upload mesh
    const mesh = NaiveMesher.generateMesh(this.chunk);
    this.renderer.uploadMesh(mesh);

    console.log(`Mesh generated: ${mesh.vertexCount} vertices, ${mesh.indexCount} indices`);
  }

  private resizeCanvas = (): void => {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.renderer.resize();
  };

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (time: number): void => {
    if (!this.running) return;

    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    const state = this.input.getState();

    // Right-click drag: Orbit
    if (state.mouseRightDown) {
      this.camera.orbit(state.mouseDeltaX, state.mouseDeltaY);

      // Right-click + WASD: Fly-through
      const moveDir = vec3.fromValues(
        (state.right ? 1 : 0) - (state.left ? 1 : 0),
        (state.up ? 1 : 0) - (state.down ? 1 : 0),
        (state.forward ? 1 : 0) - (state.backward ? 1 : 0)
      );
      if (vec3.length(moveDir) > 0) {
        this.camera.flyMove(moveDir, deltaTime);
      }
    }

    // Middle-click drag: Pan
    if (state.mouseMiddleDown) {
      this.camera.pan(state.mouseDeltaX, state.mouseDeltaY);
    }

    // Scroll: Zoom
    if (state.scrollDelta !== 0) {
      this.camera.zoom(state.scrollDelta * 0.01);
    }

    this.input.resetDeltas();
  }

  private render(): void {
    this.renderer.render(this.camera);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeCanvas);
    this.input.dispose();
    this.renderer.dispose();
  }
}
