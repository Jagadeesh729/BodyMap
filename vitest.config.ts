import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },

})
