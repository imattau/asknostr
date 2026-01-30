import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createRequire } from 'node:module'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const require = createRequire(import.meta.url)
const mentionsPath = require.resolve('react-mentions').replace('.cjs.js', '.esm.js')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
    VitePWA({
// ... (keep PWA config)
      registerType: 'autoUpdate',
      includeAssets: ['robots.txt', 'asknostr_logo.png'],
      manifest: {
        name: 'AskNostr',
        short_name: 'AskNostr',
        start_url: '/',
        display: 'standalone',
        background_color: '#05070A',
        theme_color: '#05070A',
        icons: [
          { 
            src: '/pwa-192x192.png', 
            sizes: '192x192', 
            type: 'image/png',
            purpose: 'any' 
          },
          { 
            src: '/pwa-512x512.png', 
            sizes: '512x512', 
            type: 'image/png',
            purpose: 'any' 
          },
          {
            src: '/asknostr_logo.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: ({ url }) => url.origin.startsWith('https://'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'network',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      'react-mentions': mentionsPath,
    },
  },
  optimizeDeps: {
    include: ['react-mentions', 'substyle', 'react-window'],
  },
// ... (keep build manualChunks)
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-mentions') || id.includes('substyle')) {
              return 'vendor-mentions';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
