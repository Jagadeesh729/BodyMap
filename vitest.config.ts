import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    testTimeout: 15000,
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },

})
