import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ProfileRole } from '@/lib/database.types';

interface Props {
  rol: ProfileRole | null | undefined;
}

interface NavTabProps {
  to: string;
  icon: ReactNode;
  label: string;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconFeed() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconGrupos() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <circle cx="17" cy="7" r="2" />
      <path d="M21 20c0-2.21-1.343-4-3-4" />
    </svg>
  );
}

function IconPerfil() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
    </svg>
  );
}

function IconOfertas() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── NavTab ────────────────────────────────────────────────────────────────────

function NavTab({ to, icon, label }: NavTabProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          isActive ? 'text-sun' : 'text-white/60 hover:text-white/80'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

/**
 * Píldora de navegación flotante igual a la v1.
 *
 * - Fondo negro (ink), shadow coral para familia, sage para pyme.
 * - El botón + sale -mt-7 sobre la píldora, fondo coral.
 * - `pointer-events-none` en el outer para que el contenido detrás sea clickeable.
 */
export function BottomNav({ rol }: Props) {
  const esPyme = rol === 'pyme';
  const shadowColor = esPyme ? 'var(--sage)' : 'var(--coral)';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
      <div className="w-full max-w-md px-4 pb-3 pointer-events-auto">
        <div
          className="bg-ink text-white rounded-3xl px-3 py-2.5 flex items-center justify-around"
          style={{ boxShadow: `4px 4px 0 ${shadowColor}` }}
        >
          <NavTab to="/feed" icon={<IconFeed />} label="Feed" />

          {!esPyme && <NavTab to="/grupos" icon={<IconGrupos />} label="Grupo" />}

          {!esPyme && (
            <NavLink
              to="/publicar"
              aria-label="Publicar necesidad"
              className="-mt-7 w-14 h-14 rounded-2xl flex items-center justify-center border-[1.5px] border-ink text-white transition-transform hover:scale-105 active:scale-95"
              style={{
                background: 'var(--coral)',
                boxShadow: '3px 3px 0 var(--ink)',
              }}
            >
              <IconPlus />
            </NavLink>
          )}

          {esPyme && <NavTab to="/mis-ofertas" icon={<IconOfertas />} label="Mis ofertas" />}

          <NavTab to="/perfil" icon={<IconPerfil />} label="Perfil" />
        </div>
      </div>
    </div>
  );
}
