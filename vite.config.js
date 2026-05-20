import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // <-- 테일윈드 v4 컴파일러 엔진 로드

export default defineConfig({
  plugins: [
    react(),
    tailwindcss() // <-- 빌드 파이프라인에 테일윈드 칩셋 주입
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  }
});