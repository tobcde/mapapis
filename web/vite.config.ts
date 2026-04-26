import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
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
      // VitePWA pendiente compatibilidad con Vite 8 — agregar en Fase 5
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
