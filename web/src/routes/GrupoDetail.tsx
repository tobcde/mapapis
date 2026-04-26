import { Link, useParams } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { useGrupo } from '@/lib/queries/useGrupo';
import { useNecesidadesByGrupo } from '@/lib/queries/useNecesidadesByGrupo';
import { fmtMoney } from '@/utils/fmt';
import { estadoBadgeClass, estadoLabel } from '@/utils/necesidad';
import type { NecesidadRow } from '@/lib/database.types';

export function GrupoDetail() {
  const { id } = useParams<{ id: string }>();
  const grupoQ = useGrupo(id);
  const necesidadesQ = useNecesidadesByGrupo(id);

  if (grupoQ.isLoading) {
    return (
      <Shell>
        <div className="text-sm text-ink/60">Cargando grupo...</div>
      </Shell>
    );
  }

  if (grupoQ.error || !grupoQ.data) {
    return (
      <Shell>
        <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
          No encontramos este grupo. {grupoQ.error?.message ?? 'Quizá no sos miembro.'}
        </div>
        <div className="mt-4">
          <Link to="/grupos" className="text-[11px] font-bold uppercase tracking-wider text-ink/60">
            ← Volver a mis grupos
          </Link>
        </div>
      </Shell>
    );
  }

  const grupo = grupoQ.data;

  return (
    <Shell>
      <div className="grid gap-4">
        <div>
          <Link
            to="/grupos"
            className="text-[11px] font-bold uppercase tracking-wider text-ink/60"
          >
            ← Mis grupos
          </Link>
          <h1 className="font-display font-extrabold text-2xl mt-1">{grupo.nombre}</h1>
          <p className="text-[11px] text-ink/60 mt-0.5">
            {grupo.tipo} · {grupo.zona}
            {grupo.rango_familias ? ` · ${grupo.rango_familias}` : ''}
          </p>
        </div>

        <div
          className="bg-white rounded-2xl border-[1.5px] border-ink p-4"
          style={{ boxShadow: 'var(--shadow-pop)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
            código de invitación
          </div>
          <div className="font-mono text-lg font-bold mt-1">{grupo.invite_code}</div>
        </div>

        <section className="grid gap-2">
          <div className="flex items-end justify-between">
            <h2 className="font-display font-extrabold text-lg">Necesidades</h2>
            {necesidadesQ.isFetching && !necesidadesQ.isLoading && (
              <span className="text-[10px] text-ink/50">actualizando…</span>
            )}
          </div>

          {necesidadesQ.isLoading && (
            <div className="bg-white/60 rounded-2xl border-[1.5px] border-ink/10 px-4 py-3 h-[60px] animate-pulse" />
          )}

          {necesidadesQ.error && (
            <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
              {necesidadesQ.error.message}
            </div>
          )}

          {!necesidadesQ.isLoading && necesidadesQ.data?.length === 0 && (
            <div className="bg-sun/30 rounded-2xl border-[1.5px] border-ink p-4 text-sm">
              Aún no hay necesidades publicadas en este grupo.
            </div>
          )}

          {!necesidadesQ.isLoading && necesidadesQ.data && necesidadesQ.data.length > 0 && (
            <ul className="grid gap-2">
              {necesidadesQ.data.map((n) => (
                <li key={n.id}>
                  <NecesidadCard n={n} grupoId={grupo.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

function NecesidadCard({ n, grupoId }: { n: NecesidadRow; grupoId: string }) {
  const presu =
    n.presupuesto_min_centavos != null && n.presupuesto_max_centavos != null
      ? `${fmtMoney(n.presupuesto_min_centavos / 100)} – ${fmtMoney(n.presupuesto_max_centavos / 100)}`
      : null;

  return (
    <Link
      to={`/grupos/${grupoId}/necesidades/${n.id}`}
      className="block bg-white rounded-2xl border-[1.5px] border-ink px-4 py-3 hover:bg-cream transition"
      style={{ boxShadow: 'var(--shadow-pop)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{n.titulo}</div>
          <div className="text-[11px] text-ink/60 mt-0.5">
            {n.ofertas_count} / {n.cap_ofertas} ofertas
            {presu ? ` · ${presu}` : ''}
          </div>
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap ${estadoBadgeClass(n.estado)}`}
        >
          {estadoLabel(n.estado)}
        </span>
      </div>
    </Link>
  );
}
