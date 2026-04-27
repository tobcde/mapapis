import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpdateProfile } from '@/lib/mutations/useUpdateProfile';
import { supabase } from '@/lib/supabase';
import type { ProfileRole } from '@/lib/database.types';

// ── íconos SVG inline (replicados de v1) ──────────────────────────────────────

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ── Roles disponibles (familia + pyme — sin institución en esta versión) ───────

type Rol = Extract<ProfileRole, 'familia' | 'pyme'>;

const ROLES: {
  value: Rol;
  label: string;
  short: string;
  color: string;
  Icon: ({ className }: { className?: string }) => JSX.Element;
}[] = [
  {
    value: 'familia',
    label: 'Familia',
    short: 'Soy parte de un grupo de padres',
    color: 'var(--coral)',
    Icon: IconUsers,
  },
  {
    value: 'pyme',
    label: 'Pyme',
    short: 'Ofrezco productos / servicios',
    color: 'var(--sage)',
    Icon: IconBriefcase,
  },
];

// ── Onboarding ─────────────────────────────────────────────────────────────────

export function Onboarding() {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const [saving, setSaving] = useState<Rol | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const elegir = async (role: Rol) => {
    setSaving(role);
    setErrorMsg(null);
    try {
      await updateProfile.mutateAsync({ role });
      void navigate('/feed', { replace: true });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo guardar tu perfil');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream bg-dots px-6 py-10 anim-in">
      <div className="max-w-md mx-auto">
        {/* Logout */}
        <button
          type="button"
          onClick={() => { void supabase.auth.signOut(); }}
          className="text-xs text-ink/60 hover:text-coral font-semibold mb-8 flex items-center gap-1"
        >
          <IconLogout className="w-3.5 h-3.5" /> Salir
        </button>

        {/* Header */}
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-coral">Bienvenido</div>
        <h1 className="font-display font-black text-5xl leading-none mt-3">
          ¿Quién <span className="font-display-italic">sos</span>?
        </h1>
        <p className="text-ink/70 mt-3 text-[15px]">
          Esto define qué pantallas vas a ver. Lo podés cambiar después.
        </p>

        {/* Cards de rol */}
        <div className="mt-8 space-y-3">
          {ROLES.map(({ value, label, short, color, Icon }) => {
            const isSaving = saving === value;
            return (
              <button
                key={value}
                type="button"
                disabled={saving !== null}
                onClick={() => { void elegir(value); }}
                className="card-hover w-full text-left bg-white rounded-3xl border-[1.5px] border-ink p-5 flex items-center gap-4 disabled:opacity-50"
                style={{ boxShadow: '4px 4px 0 var(--ink)' }}
              >
                {/* Ícono */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: color }}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Texto */}
                <div className="flex-1">
                  <div className="font-display font-bold text-xl">{label}</div>
                  <div className="text-sm text-ink/60">{short}</div>
                </div>

                {/* Flecha / spinner */}
                {isSaving
                  ? <span className="text-xs text-ink/50">…</span>
                  : <IconArrowRight className="w-5 h-5 text-ink/40" />
                }
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-3 text-center font-semibold mt-4">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
