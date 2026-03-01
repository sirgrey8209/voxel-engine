// src/rendering/WebGPURenderer.ts
import { mat4 } from 'gl-matrix';
import { Camera } from './Camera';
import { ChunkMesh } from '../voxel/NaiveMesher';
import shaderSource from './shaders/voxel.wgsl?raw';

export interface GPUMeshHandle {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
}

export class WebGPURenderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private depthTexture!: GPUTexture;
  private depthTextureView!: GPUTextureView;

  private canvas: HTMLCanvasElement;
  private meshHandle: GPUMeshHandle | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU not supported');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error('Failed to get GPU adapter');
      return false;
    }

    this.device = await adapter.requestDevice();

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format,
      alphaMode: 'premultiplied',
    });

    this.createPipeline(format);
    this.createUniformBuffer();
    this.createDepthTexture();

    return true;
  }

  private createPipeline(format: GPUTextureFormat): void {
    const shaderModule = this.device.createShaderModule({
      code: shaderSource,
    });

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 36, // 9 floats * 4 bytes
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
        { shaderLocation: 2, offset: 24, format: 'float32x3' },  // color
      ],
    };

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  private createUniformBuffer(): void {
    // mat4x4 (64 bytes) + vec3 (12 bytes) + padding (4 bytes) = 80 bytes
    this.uniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  private createDepthTexture(): void {
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  resize(): void {
    this.depthTexture.destroy();
    this.createDepthTexture();
  }

  uploadMesh(mesh: ChunkMesh): GPUMeshHandle {
    const vertexBuffer = this.device.createBuffer({
      size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices);

    const indexBuffer = this.device.createBuffer({
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

    this.meshHandle = {
      vertexBuffer,
      indexBuffer,
      indexCount: mesh.indexCount,
    };

    return this.meshHandle;
  }

  render(camera: Camera): void {
    if (!this.meshHandle || this.meshHandle.indexCount === 0) {
      return;
    }

    // Update uniforms
    const view = camera.getViewMatrix();
    const proj = camera.getProjectionMatrix(this.canvas.width / this.canvas.height);
    const viewProj = mat4.create();
    mat4.multiply(viewProj, proj, view);

    const uniformData = new Float32Array(20); // 16 (mat4) + 3 (vec3) + 1 (padding)
    uniformData.set(viewProj, 0);
    uniformData.set(camera.position, 16);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.uniformBindGroup);
    renderPass.setVertexBuffer(0, this.meshHandle.vertexBuffer);
    renderPass.setIndexBuffer(this.meshHandle.indexBuffer, 'uint32');
    renderPass.drawIndexed(this.meshHandle.indexCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  dispose(): void {
    if (this.meshHandle) {
      this.meshHandle.vertexBuffer.destroy();
      this.meshHandle.indexBuffer.destroy();
    }
    this.uniformBuffer.destroy();
    this.depthTexture.destroy();
  }
}
