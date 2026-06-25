import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'ke-icon-16.png',
        'ke-icon-32.png',
        'ke-icon-180.png',
        'ke-icon-192.png',
        'ke-icon-512.png',
        'ke-maskable-192.png',
        'ke-maskable-512.png',
      ],
      manifest: {
        name: 'Kumar Electronics RiseTicket',
        short_name: 'RiseTicket',
        description: 'RiseTicket service workflow app for Kumar Electronics.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#172554',
        background_color: '#ffffff',
        icons: [
          {
            src: '/ke-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/ke-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/ke-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/ke-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/volt\//],
      },
    }),
  ],
  server: {
    proxy: {
      '/volt': 'http://127.0.0.1:9001',
    },
  },
})
