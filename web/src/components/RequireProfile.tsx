import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '@/lib/queries/useProfile';
import { LoadingScreen } from '@/components/LoadingScreen';

interface Props {
  children: ReactNode;
}

/**
 * Asume que ya pasaste por AuthGuard (hay sesion).
 * Si el profile aun no tiene rol, manda a /onboarding.
 */
export function RequireProfile({ children }: Props) {
  const { data: profile, isLoading, error } = useProfile();

  if (isLoading) {
    return <LoadingScreen message="Preparando tu perfil…" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-coral px-6 text-center">
        No pudimos cargar tu perfil. Refresca la pagina.
      </div>
    );
  }

  if (!profile?.role) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
