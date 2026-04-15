import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['temp-backup/**/*', 'packages/**/*', 'node_modules/**/*'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/lambda/**',
        'src/index.ts',
        'src/mcp-server-standalone.ts',
        'src/cli.ts',
      ],
    },
  },
  esbuild: {
    target: 'node20',
  },
});
