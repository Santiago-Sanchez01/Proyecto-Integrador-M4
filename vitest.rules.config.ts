import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['tests/firestore/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 10000,
    hookTimeout: 20000,
  },
})
