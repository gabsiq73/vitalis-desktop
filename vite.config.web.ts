import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'web-ipc-stub',
      transformIndexHtml: {
        order: 'pre',
        handler: () => [{
          tag: 'script',
          injectTo: 'head-prepend',
          children: 'window.ipcRenderer = { on: () => {} }',
        }],
      },
    },
  ],
  server: { port: 5173 },
})
