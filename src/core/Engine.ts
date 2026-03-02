// src/core/Engine.ts
import { vec3 } from 'gl-matrix';
import { Camera } from '../rendering/Camera';
import { WebGPURenderer } from '../rendering/WebGPURenderer';
import { InputManager } from '../input/InputManager';
import { ChunkManager } from '../voxel/ChunkManager';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer;
  private camera: Camera;
  private input: InputManager;
  private chunkManager: ChunkManager;

  private running: boolean = false;
  private lastTime: number = 0;
  private lastStreamUpdate: number = 0;
  private streamUpdateInterval: number = 500; // ms

  constructor(config: EngineConfig) {
    this.canvas = config.canvas;
    this.renderer = new WebGPURenderer(this.canvas);
    this.camera = new Camera();
    this.input = new InputManager(this.canvas);
    this.chunkManager = new ChunkManager();
  }

  async init(): Promise<void> {
    const success = await this.renderer.init();
    if (!success) {
      throw new Error('Failed to initialize WebGPU renderer');
    }

    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);

    // Load initial chunks (3x3 grid around origin for testing)
    const loadPromises: Promise<void>[] = [];
    for (let z = -1; z <= 1; z++) {
      for (let x = -1; x <= 1; x++) {
        loadPromises.push(this.loadAndUploadChunk(x, 0, z));
      }
    }
    await Promise.all(loadPromises);

    console.log(`Loaded ${this.chunkManager.getLoadedChunks().length} chunks`);
  }

  private async loadAndUploadChunk(cx: number, cy: number, cz: number): Promise<void> {
    const loaded = await this.chunkManager.loadChunk(cx, cy, cz);
    if (loaded.mesh) {
      const key = ChunkManager.getChunkKey(cx, cy, cz);
      loaded.gpuHandle = this.renderer.uploadMesh(key, loaded.mesh);
    }
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

    const moveDir = vec3.fromValues(
      (state.right ? 1 : 0) - (state.left ? 1 : 0),
      0,
      (state.forward ? 1 : 0) - (state.backward ? 1 : 0)
    );
    if (vec3.length(moveDir) > 0) {
      this.camera.move(moveDir, deltaTime);
    }

    if (state.mouseRightDown) {
      this.camera.look(state.mouseDeltaX, state.mouseDeltaY);
    }

    if (state.reset) {
      this.camera.reset();
    }

    this.input.resetDeltas();

    // Update chunk streaming periodically
    const now = performance.now();
    if (now - this.lastStreamUpdate > this.streamUpdateInterval) {
      this.lastStreamUpdate = now;
      const pos = this.camera.position;
      this.chunkManager.updateChunks(
        pos[0], pos[2],
        (key, mesh) => this.renderer.uploadMesh(key, mesh),
        (key) => this.renderer.deleteMesh(key)
      );
    }
  }

  private render(): void {
    this.renderer.render(this.camera);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeCanvas);
    this.input.dispose();
    this.chunkManager.dispose();
    this.renderer.dispose();
  }
}
