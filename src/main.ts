async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  // WebGPU 지원 확인
  if (!navigator.gpu) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'WebGPU is not supported in this browser.';
    }
    throw new Error('WebGPU not supported');
  }

  console.log('Voxel Engine initialized');
}

main().catch(console.error);
