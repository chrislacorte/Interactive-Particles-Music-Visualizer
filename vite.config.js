import { defineConfig } from 'vite'
import * as path from 'path'

export default defineConfig({
  root: '',
  base: '/',
  build: {
    outDir: 'dist',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        demo: './index.html',
      },
    },
  },
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [],
})
