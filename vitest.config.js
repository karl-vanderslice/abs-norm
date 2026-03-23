import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js']
    }
  }
});
