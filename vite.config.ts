import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    __SUMMARY_OIDC_PREVIEW__: command === 'build'
      && process.env.VERCEL === '1'
      && process.env.VERCEL_ENV === 'preview'
      && (process.env.VERCEL_TARGET_ENV === undefined || process.env.VERCEL_TARGET_ENV === 'preview')
      && process.env.VERCEL_PROJECT_NAME === 'workspace-m4'
      && process.env.VERCEL_GIT_COMMIT_REF === 'feat/summary-email-cloud-integration',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
