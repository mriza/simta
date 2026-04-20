/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return defineConfig({
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 3535,
      host: env.VITE_HOST || true,
      allowedHosts: true,
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:3536',
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['src/e2e.test.ts'],
    },
  })
}
