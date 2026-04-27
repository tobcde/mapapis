import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';
import { useSessionStore } from '@/stores/session';
import { Login } from '@/routes/Login';
import { Onboarding } from '@/routes/Onboarding';
import { Perfil } from '@/routes/Perfil';
import { Grupos } from '@/routes/Grupos';
import { GrupoDetail } from '@/routes/GrupoDetail';
import { NecesidadDetail } from '@/routes/NecesidadDetail';
import { Feed } from '@/routes/Feed';
import { Publicar } from '@/routes/Publicar';
import { MisOfertas } from '@/routes/MisOfertas';
import { GrupoMiembros } from '@/routes/GrupoMiembros';
import { GrupoAlumnos } from '@/routes/GrupoAlumnos';
import { PymeOnboarding } from '@/routes/PymeOnboarding';
import { Unirse } from '@/routes/Unirse';
import { AuthGuard } from '@/components/AuthGuard';
import { RequireProfile } from '@/components/RequireProfile';
import { env } from '@/lib/env';

function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold">404</h1>
        <p className="text-sm text-ink/60 mt-2">Esta ruta no existe.</p>
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-ink/60">
      Cargando...
    </div>
  );
}

export function App() {
  const init = useSessionStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/onboarding"
              element={
                <AuthGuard>
                  <Onboarding />
                </AuthGuard>
              }
            />
            <Route path="/home" element={<Navigate to="/feed" replace />} />
            <Route
              path="/grupos"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <Grupos />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/grupos/:id"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <GrupoDetail />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/grupos/:id/necesidades/:necesidadId"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <NecesidadDetail />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/feed"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <Feed />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/publicar"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <Publicar />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/mis-ofertas"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <MisOfertas />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/grupos/:id/miembros"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <GrupoMiembros />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/grupos/:id/alumnos"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <GrupoAlumnos />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            <Route
              path="/pyme/onboarding"
              element={
                <AuthGuard>
                  <PymeOnboarding />
                </AuthGuard>
              }
            />
            <Route
              path="/perfil"
              element={
                <AuthGuard>
                  <RequireProfile>
                    <Perfil />
                  </RequireProfile>
                </AuthGuard>
              }
            />
            {/* Punto de entrada de links de invitación — sin AuthGuard; la ruta lo maneja internamente */}
            <Route path="/unirse" element={<Unirse />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      {!env.IS_PROD && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
