import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui';
import { useDialog } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { usePymeProfile } from '@/lib/queries/usePymeProfile';
import { useMpLinked } from '@/lib/queries/useMpLinked';
import { useMpUnlink } from '@/lib/mutations/useMpUnlink';
import { buildMpAuthorizeUrl } from '@/lib/mp/oauth';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { profileQueryKey } from '@/lib/queries/useProfile';
import type { ProfileRole } from '@/lib/database.types';

// ─── Mapeo de rol a color e icono ─────────────────────────────────────────────

const ROL_INFO: Record<
  ProfileRole,
  { label: string; color: string; textColor: string; short: string }
> = {
  familia: { label: 'Familia', color: 'bg-coral', textColor: 'text-white', short: 'Comprás para tu grupo' },
  pyme: { label: 'Pyme', color: 'bg-sage', textColor: 'text-white', short: 'Ofertás a grupos de familias' },
  admin: { label: 'Admin', color: 'bg-violet', textColor: 'text-white', short: 'Administración del sistema' },
  institucion: { label: 'Institución', color: 'bg-sun', textColor: 'text-ink', short: 'Colegio / jardín' },
  personal_institucion: {
    label: 'Personal',
    color: 'bg-mist',
    textColor: 'text-ink',
    short: 'Personal de institución',
  },
};

// ─── Perfil ───────────────────────────────────────────────────────────────────

export function Perfil() {
  const { data: profile, isLoading } = useProfile();
  const { data: pyme } = usePymeProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useDialog();

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [editAlias, setEditAlias] = useState(false);
  const [aliasMp, setAliasMp] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);

  const startEditing = () => {
    setNombre(profile?.nombre ?? '');
    setEditing(true);
  };

  const guardarNombre = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ nombre: nombre.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      await showAlert('No se pudo guardar el nombre: ' + error.message);
      return;
    }
    setEditing(false);
    void queryClient.invalidateQueries({ queryKey: profileQueryKey(profile.id) });
  };

  const startEditingAlias = () => {
    setAliasMp(profile?.alias_mp ?? '');
    setEditAlias(true);
  };

  const guardarAlias = async () => {
    if (!profile) return;
    const cleaned = aliasMp.trim();
    setSavingAlias(true);
    const { error } = await supabase
      .from('profiles')
      .update({ alias_mp: cleaned || null })
      .eq('id', profile.id);
    setSavingAlias(false);
    if (error) {
      await showAlert('No se pudo guardar el alias: ' + error.message);
      return;
    }
    setEditAlias(false);
    void queryClient.invalidateQueries({ queryKey: profileQueryKey(profile.id) });
  };

  const cambiarRol = async () => {
    if (!profile) return;
    const ok = await showConfirm('¿Cambiar de rol? Vas a volver al onboarding para elegirlo de nuevo.');
    if (!ok) return;
    const { error } = await supabase
      .from('profiles')
      .update({ role: null })
      .eq('id', profile.id);
    if (error) {
      await showAlert('No se pudo cambiar el rol: ' + error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: profileQueryKey(profile.id) });
    void navigate('/onboarding', { replace: true });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    void navigate('/', { replace: true });
  };

  if (isLoading || !profile) {
    return (
      <Shell>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white/60 rounded-3xl border-[1.5px] border-ink/10 animate-pulse" />
          ))}
        </div>
      </Shell>
    );
  }

  const rolInfo = profile.role ? ROL_INFO[profile.role] : null;
  const displayNombre = profile.nombre ?? profile.email.split('@')[0] ?? profile.email;
  const inicial = displayNombre[0]?.toUpperCase() ?? '?';

  return (
    <Shell>
      <div className="space-y-4 anim-in">
        <h1 className="font-display font-black text-4xl leading-none">
          Tu <em style={{ fontStyle: 'italic' }}>perfil</em>
        </h1>

        {/* Tarjeta nombre */}
        <div className="bg-white rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-3xl ${rolInfo?.color ?? 'bg-coral'} ${rolInfo?.textColor ?? 'text-white'} shrink-0`}
            >
              {inicial}
            </div>

            {/* Nombre + email */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    value={nombre}
                    onChange={(e) => { setNombre(e.target.value); }}
                    className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-ink text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-coral/30"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void guardarNombre();
                      if (e.key === 'Escape') setEditing(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { void guardarNombre(); }}
                    disabled={saving}
                    className="btn-pop bg-sage text-white px-3 py-2 rounded-lg border-[1.5px] border-ink text-xs font-bold uppercase disabled:opacity-50"
                  >
                    {saving ? '…' : 'OK'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="font-display font-bold text-xl truncate">{displayNombre}</div>
                  <div className="text-xs text-ink/60 truncate">{profile.email}</div>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="text-[10px] font-bold uppercase tracking-wider text-coral mt-1 hover:text-coral/80"
                  >
                    Editar nombre
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rol */}
        <div className="bg-white rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-3">Rol</div>
          {rolInfo ? (
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rolInfo.color}`}>
                <span className="text-lg">
                  {profile.role === 'familia' ? '👨‍👩‍👧' : profile.role === 'pyme' ? '🏪' : '⚙️'}
                </span>
              </div>
              <div>
                <div className="font-display font-bold text-lg">{rolInfo.label}</div>
                <div className="text-xs text-ink/60">{rolInfo.short}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink/60">Sin rol asignado</div>
          )}
          <button
            type="button"
            onClick={() => { void cambiarRol(); }}
            className="mt-4 text-xs font-bold uppercase tracking-wider text-coral hover:text-coral/80"
          >
            Cambiar de rol →
          </button>
        </div>

        {/* Mercado Pago vinculado (OAuth) */}
        <MpLinkCard />

        {/* Alias de Mercado Pago */}
        <div className="bg-white rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">
            Alias de Mercado Pago
          </div>
          <p className="text-[11px] text-ink/55 mb-3">
            Para fallback / referencia rápida. La forma recomendada de cobrar el sobre digital es
            la vinculación de arriba (auto-detect del pago).
          </p>
          {editAlias ? (
            <div className="flex gap-2">
              <input
                value={aliasMp}
                onChange={(e) => { setAliasMp(e.target.value); }}
                placeholder="ej. tu.alias.mp"
                className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-ink text-sm font-mono focus:outline-none focus:ring-2 focus:ring-coral/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void guardarAlias();
                  if (e.key === 'Escape') setEditAlias(false);
                }}
              />
              <button
                type="button"
                onClick={() => { void guardarAlias(); }}
                disabled={savingAlias}
                className="btn-pop bg-sage text-white px-3 py-2 rounded-lg border-[1.5px] border-ink text-xs font-bold uppercase disabled:opacity-50"
              >
                {savingAlias ? '…' : 'OK'}
              </button>
              <button
                type="button"
                onClick={() => { setEditAlias(false); }}
                className="px-2 text-xs font-bold uppercase tracking-wider text-ink/50 hover:text-ink"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-sm">
                {profile.alias_mp ?? <span className="text-ink/40 italic font-sans">sin alias cargado</span>}
              </div>
              <button
                type="button"
                onClick={startEditingAlias}
                className="text-[10px] font-bold uppercase tracking-wider text-coral hover:text-coral/80"
              >
                {profile.alias_mp ? 'Editar' : 'Cargar alias'}
              </button>
            </div>
          )}
        </div>

        {/* Mi negocio (solo pymes) */}
        {profile.role === 'pyme' && (
          <div className="bg-white rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-3">Mi negocio</div>
            {pyme ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  {pyme.logo_url ? (
                    <img
                      src={pyme.logo_url}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover border-[1.5px] border-ink shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-cream border-[1.5px] border-ink flex items-center justify-center font-display font-bold text-xl shrink-0">
                      {(pyme.nombre_comercial ?? '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-lg truncate">
                      {pyme.nombre_comercial ?? '—'}
                    </div>
                    <div className="text-[11px] text-ink/60 truncate">
                      Tier {pyme.tier ?? 0} · {(pyme.zonas ?? []).length} zona
                      {(pyme.zonas ?? []).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <Link
                  to="/pyme/onboarding"
                  className="btn-pop block w-full py-2.5 bg-sage text-white font-extrabold rounded-xl border-[1.5px] border-ink uppercase tracking-wider text-xs text-center"
                >
                  Editar mi negocio →
                </Link>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-ink/60">Aún no completaste tu perfil de negocio.</p>
                <Link
                  to="/pyme/onboarding"
                  className="btn-pop block w-full py-2.5 bg-sage text-white font-extrabold rounded-xl border-[1.5px] border-ink uppercase tracking-wider text-xs text-center"
                >
                  Completar perfil pyme →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <div className="space-y-2 pt-2">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => { void logout(); }}
          >
            Cerrar sesión
          </Button>
        </div>

        <p className="text-center text-[10px] text-ink/40 uppercase tracking-widest pb-4">
          MaPaPis · Beta
        </p>
      </div>
    </Shell>
  );
}

// ─── MpLinkCard ───────────────────────────────────────────────────────────────

function MpLinkCard() {
  const { data: status, isLoading } = useMpLinked();
  const unlink = useMpUnlink();
  const { showConfirm, showAlert } = useDialog();

  const onLink = () => {
    try {
      const url = buildMpAuthorizeUrl();
      window.location.assign(url);
    } catch (e) {
      void showAlert(e instanceof Error ? e.message : 'No se pudo iniciar la vinculación');
    }
  };

  const onUnlink = async () => {
    const ok = await showConfirm('¿Desvincular tu Mercado Pago? Vas a tener que volver a vincular para recibir sobres digitales.');
    if (!ok) return;
    try {
      await unlink.mutateAsync();
    } catch (e) {
      await showAlert(e instanceof Error ? e.message : 'Error al desvincular');
    }
  };

  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">
        Mercado Pago vinculado
      </div>
      <p className="text-[11px] text-ink/55 mb-3">
        Para que las familias del grupo paguen el sobre digital de cumple desde la app, vinculá
        tu Mercado Pago una vez. La plata cae directo en tu cuenta — MaPaPis no la toca.
      </p>

      {isLoading ? (
        <div className="text-xs text-ink/50">Cargando estado…</div>
      ) : status?.linked ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-sage rounded-full" />
            <span className="text-sm font-bold">Vinculado</span>
            {status.mp_user_id && (
              <span className="text-[10px] text-ink/50 font-mono">· id {status.mp_user_id}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { void onUnlink(); }}
            disabled={unlink.isPending}
            className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline disabled:opacity-50"
          >
            Desvincular
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onLink}
          className="btn-pop w-full py-3 bg-[#009ee3] text-white font-extrabold rounded-xl border-[1.5px] border-ink uppercase tracking-wider text-xs flex items-center justify-center gap-2"
        >
          Vincular Mercado Pago
        </button>
      )}
    </div>
  );
}
