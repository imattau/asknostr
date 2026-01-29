import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { join } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      'react-mentions': join(process.cwd(), 'node_modules/react-mentions/dist/react-mentions.esm.js'),
    },
  },
  plugins: [
    react(),
    VitePWA({
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
  optimizeDeps: {
    include: ['react-mentions', 'substyle'],
  },
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
