// src/rendering/shaders/voxel.wgsl

struct Uniforms {
  viewProjection: mat4x4<f32>,
  cameraPos: vec3<f32>,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec3<f32>,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.clipPosition = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
  output.worldPos = input.position;
  output.normal = input.normal;
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Simple directional lighting
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
  let ambient = 0.3;
  let diffuse = max(dot(input.normal, lightDir), 0.0);
  let lighting = ambient + diffuse * 0.7;

  let color = input.color * lighting;

  return vec4<f32>(color, 1.0);
}
