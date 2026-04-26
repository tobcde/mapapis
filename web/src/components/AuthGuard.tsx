import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';

interface Props {
  children: ReactNode;
}

/**
 * Bloquea rutas que requieren sesion. Mientras `loading` es true (primer
 * `getSession()`), muestra placeholder — sin esto, recargar una ruta protegida
 * te patea a /login antes de que Supabase rehidratase el storage.
 */
export function AuthGuard({ children }: Props) {
  const session = useSessionStore((s) => s.session);
  const loading = useSessionStore((s) => s.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-ink/60">
        Cargando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
