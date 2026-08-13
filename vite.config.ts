import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        dashboard: fileURLToPath(new URL('./index.html', import.meta.url)),
        referral: fileURLToPath(new URL('./referral.html', import.meta.url)),
        claim: fileURLToPath(new URL('./claim.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
