/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'dist/**',
        'e2e/**',
        'playwright.config.ts',
        'vite.config.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/engine/events/types.ts',
        'src/ui/components/**',
        'src/ui/screens/**',
      ],
    },
  },
});
