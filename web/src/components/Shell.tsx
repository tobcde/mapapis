import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { useProfile } from '@/lib/queries/useProfile';

interface Props {
  children: ReactNode;
}

const tabs = [
  { to: '/home', label: 'Inicio', icon: '🏠' },
  { to: '/grupos', label: 'Grupos', icon: '👥' },
  { to: '/perfil', label: 'Perfil', icon: '👤' },
];

export function Shell({ children }: Props) {
  const navigate = useNavigate();
  const signOut = useSessionStore((s) => s.signOut);
  const { data: profile } = useProfile();

  const onLogout = async () => {
    await signOut();
    void navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <header className="border-b-[1.5px] border-ink bg-white sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-display font-extrabold text-lg">
            MaPa<span className="hl-sun">Pis</span>
          </div>
          <button
            type="button"
            onClick={() => { void onLogout(); }}
            className="text-[10px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
          >
            Salir →
          </button>
        </div>
        {profile?.nombre && (
          <div className="max-w-md mx-auto px-4 pb-2 text-[11px] text-ink/60">
            Hola, <span className="font-bold text-ink">{profile.nombre}</span>{' '}
            <span className="opacity-60">· {profile.role ?? 'sin rol'}</span>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t-[1.5px] border-ink">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                  isActive ? 'text-ink' : 'text-ink/40 hover:text-ink/70'
                }`
              }
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
