import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in a Node.js environment
    environment: 'node',
    // Include all files in `src` ending with .test.ts or .spec.ts
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});
