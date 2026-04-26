import { QueryClient } from '@tanstack/react-query';

/**
 * Configuración global de TanStack Query.
 *
 * Defaults pensados para una PWA con datos que cambian seguido pero no
 * en tiempo real:
 * - refetchOnWindowFocus: arregla el bug de "se queda cargando" al volver
 *   a la tab — la query refresca automáticamente.
 * - retry: 1 intento extra; más es ruidoso para errores de auth.
 * - staleTime: 30s — evita pedir lo mismo dos veces seguidas.
 * - gcTime: 5min — cache razonable sin retener para siempre.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});
