import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['temp-backup/**/*', 'packages/**/*', 'node_modules/**/*'],
    environment: 'node',
    globals: true,
  },
  esbuild: {
    target: 'node20',
  },
});
