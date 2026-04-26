import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isProd = mode === 'production';

  return {
    base: env.VITE_BASE_PATH ?? '/mapapis-next/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
        manifest: {
          name: 'MaPaPis',
          short_name: 'MaPaPis',
          description: 'MaPaPis — coordinación + marketplace para grupos de padres',
          theme_color: '#FF5A4E',
          background_color: '#FBF6EE',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: isProd ? 'hidden' : true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-router')) return 'react';
              if (id.includes('react-dom') || id.includes('/react/')) return 'react';
              if (id.includes('@supabase')) return 'supabase';
              if (id.includes('@tanstack')) return 'query';
              if (id.includes('@sentry')) return 'sentry';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  };
});
