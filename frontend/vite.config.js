import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: [
      /src\/.*\.jsx?$/,
    ],
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    port: parseInt(process.env.FRONTEND_PORT || '3000', 10),
    proxy: {
      '/api': `http://localhost:${process.env.BACKEND_PORT || '4000'}`
    }
  }
})
