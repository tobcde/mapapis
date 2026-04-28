import { Link } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { MapapisLogo } from '@/components/MapapisLogo';

export function Landing() {
  const user = useSessionStore((s) => s.user);

  return (
    <main className="min-h-screen px-6 py-8 flex flex-col items-center justify-center max-w-md mx-auto">
      {/* La hoja escolar ES el frame: paper, rings, ruled lines, sun, wordmark, tagline, family. */}
      <div className="w-full">
        <MapapisLogo
          variant="lockup"
          width={360}
          style={{ width: '100%', height: 'auto', maxWidth: 360 }}
          className="block mx-auto"
        />
      </div>

      <div className="mt-6 w-full grid gap-2">
        <Link
          to={user ? '/home' : '/login'}
          className="btn-pop block py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs text-center"
        >
          {user ? 'Continuar →' : 'Iniciar sesión →'}
        </Link>
      </div>

      <div className="mt-6 text-[10px] text-ink/50 text-center">
        {user ? <>Logueado como {user.email}</> : <>Sin sesión</>}
      </div>
    </main>
  );
}
