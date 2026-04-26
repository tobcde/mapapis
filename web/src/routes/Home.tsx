import { Shell } from '@/components/Shell';
import { useProfile } from '@/lib/queries/useProfile';

export function Home() {
  const { data: profile, isLoading } = useProfile();

  return (
    <Shell>
      <div className="grid gap-4">
        <div
          className="bg-white rounded-2xl border-[1.5px] border-ink p-5"
          style={{ boxShadow: 'var(--shadow-pop)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">tu perfil</div>
          {isLoading ? (
            <div className="text-sm text-ink/60 mt-2">Cargando...</div>
          ) : profile ? (
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex justify-between"><dt className="text-ink/60">Email</dt><dd>{profile.email}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">Nombre</dt><dd>{profile.nombre ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">Rol</dt><dd>{profile.role ?? '—'}</dd></div>
            </dl>
          ) : (
            <div className="text-sm text-coral mt-2">No encontramos tu perfil.</div>
          )}
        </div>

        <div className="bg-sun/30 rounded-2xl border-[1.5px] border-ink p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">proximamente</div>
          <p className="text-sm mt-2">
            Aca van a aparecer tus grupos, las necesidades activas y las novedades de tu sala.
          </p>
        </div>
      </div>
    </Shell>
  );
}

export function PerfilPlaceholder() {
  return (
    <Shell>
      <div className="bg-white rounded-2xl border-[1.5px] border-ink p-5" style={{ boxShadow: 'var(--shadow-pop)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">perfil</div>
        <p className="text-sm mt-2 text-ink/70">Editor de perfil — en construccion.</p>
      </div>
    </Shell>
  );
}
