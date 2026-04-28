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
        injectRegister: 'auto',
        strategies: 'generateSW',
        devOptions: { enabled: false },
        manifest: {
          name: 'MaPaPis',
          short_name: 'MaPaPis',
          description: 'Coordiná compras grupales para tu sala o aula',
          start_url: env.VITE_BASE_PATH ?? '/mapapis-next/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#fff7ee',
          theme_color: '#0e1525',
          lang: 'es-AR',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Cache de recursos estáticos de la app (JS, CSS, fuentes)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Rutas que deben devolver el index.html (SPA)
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
          // No cachear requests a Supabase ni a APIs externas
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
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
