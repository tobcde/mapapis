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
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconGrupos() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <circle cx="17" cy="7" r="2" />
      <path d="M21 20c0-2.21-1.343-4-3-4" />
    </svg>
  );
}

function IconPerfil() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
    </svg>
  );
}

function IconOfertas() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── NavTab ────────────────────────────────────────────────────────────────────

function NavTab({ to, icon, label }: NavTabProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          isActive ? 'text-ink' : 'text-ink/40 hover:text-ink/70'
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
 * Barra de navegación inferior con tabs adaptados según el rol.
 *
 * - familia / admin / institucion / personal_institucion:
 *     Feed | Grupos | [+] | Perfil   (4 columnas, + flotante coral)
 * - pyme:
 *     Feed | Mis Ofertas | Perfil    (3 columnas)
 */
export function BottomNav({ rol }: Props) {
  const esPyme = rol === 'pyme';

  if (esPyme) {
    return (
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t-[1.5px] border-ink z-30 safe-area-inset-bottom">
        <div className="max-w-md mx-auto grid grid-cols-3">
          <NavTab to="/feed" icon={<IconFeed />} label="Feed" />
          <NavTab to="/mis-ofertas" icon={<IconOfertas />} label="Mis Ofertas" />
          <NavTab to="/perfil" icon={<IconPerfil />} label="Perfil" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t-[1.5px] border-ink z-30 safe-area-inset-bottom">
      <div className="max-w-md mx-auto grid grid-cols-4">
        <NavTab to="/feed" icon={<IconFeed />} label="Feed" />
        <NavTab to="/grupos" icon={<IconGrupos />} label="Grupos" />

        {/* Columna central: botón + flotante coral */}
        <div className="relative flex justify-center items-end pb-2">
          <NavLink
            to="/publicar"
            aria-label="Publicar necesidad"
            className="absolute -top-6 w-12 h-12 rounded-full bg-coral border-[1.5px] border-ink shadow-pop flex items-center justify-center text-white text-2xl font-bold leading-none transition-transform hover:scale-105 active:scale-95"
          >
            +
          </NavLink>
        </div>

        <NavTab to="/perfil" icon={<IconPerfil />} label="Perfil" />
      </div>
    </nav>
  );
}
