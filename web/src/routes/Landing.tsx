import { Link } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { MapapisLogo } from '@/components/MapapisLogo';

export function Landing() {
  const user = useSessionStore((s) => s.user);

  return (
    <main className="min-h-screen px-6 py-12 flex flex-col items-center justify-center max-w-md mx-auto">
      <div className="bg-white rounded-3xl border-[1.5px] border-ink p-6 w-full text-center" style={{ boxShadow: 'var(--shadow-pop)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-2">v2 — vite</div>
        <div className="flex justify-center">
          <MapapisLogo variant="lockup" width={220} />
        </div>

        <div className="mt-6 grid gap-2">
          <Link
            to={user ? '/home' : '/login'}
            className="btn-pop block py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs"
          >
            {user ? 'Continuar →' : 'Iniciar sesión →'}
          </Link>
          <a
            href="https://tobcde.github.io/mapapis/"
            className="block py-2 text-[11px] font-bold uppercase tracking-wider text-ink/60"
          >
            ← Versión actual (v1)
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-ink/10 text-[10px] text-ink/50">
          {user ? <>Logueado como {user.email}</> : <>Sin sesión</>}
        </div>
      </div>
    </main>
  );
}
