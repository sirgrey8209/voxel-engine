import { defineConfig } from 'vite';

export default defineConfig({
  base: './',  // 상대 경로 사용 (서브 경로 배포 지원)
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.wgsl'],
});
