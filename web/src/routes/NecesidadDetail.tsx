import { Link, useParams } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { useNecesidad } from '@/lib/queries/useNecesidad';
import { useOfertasByNecesidad } from '@/lib/queries/useOfertasByNecesidad';
import { fmtMoney } from '@/utils/fmt';
import { estadoBadgeClass, estadoLabel, modoEntregaLabel, pymeAlias } from '@/utils/necesidad';
import type { OfertaRow } from '@/lib/database.types';

export function NecesidadDetail() {
  const { id: grupoId, necesidadId } = useParams<{ id: string; necesidadId: string }>();
  const necesidadQ = useNecesidad(necesidadId);
  const ofertasQ = useOfertasByNecesidad(necesidadId);

  if (necesidadQ.isLoading) {
    return (
      <Shell>
        <div className="text-sm text-ink/60">Cargando necesidad...</div>
      </Shell>
    );
  }

  if (necesidadQ.error || !necesidadQ.data) {
    return (
      <Shell>
        <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
          No encontramos esta necesidad. {necesidadQ.error?.message ?? ''}
        </div>
        <div className="mt-4">
          <Link
            to={grupoId ? `/grupos/${grupoId}` : '/grupos'}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/60"
          >
            ← Volver al grupo
          </Link>
        </div>
      </Shell>
    );
  }

  const n = necesidadQ.data;
  const presupuesto =
    n.presupuesto_min_centavos != null && n.presupuesto_max_centavos != null
      ? `${fmtMoney(n.presupuesto_min_centavos / 100)} – ${fmtMoney(n.presupuesto_max_centavos / 100)}`
      : null;

  return (
    <Shell>
      <div className="grid gap-4">
        <div>
          <Link
            to={grupoId ? `/grupos/${grupoId}` : '/grupos'}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/60"
          >
            ← Volver al grupo
          </Link>
          <div className="flex items-start justify-between gap-3 mt-1">
            <h1 className="font-display font-extrabold text-2xl">{n.titulo}</h1>
            <span
              className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap ${estadoBadgeClass(n.estado)}`}
            >
              {estadoLabel(n.estado)}
            </span>
          </div>
          <p className="text-[11px] text-ink/60 mt-1">
            {n.zona}
            {n.fecha_limite ? ` · cierra ${formatDate(n.fecha_limite)}` : ''}
          </p>
        </div>

        {n.descripcion && (
          <div
            className="bg-white rounded-2xl border-[1.5px] border-ink p-4"
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
              descripción
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{n.descripcion}</p>
            {presupuesto && (
              <div className="mt-3 text-[11px] text-ink/70">
                <span className="font-bold uppercase tracking-wider text-[10px] text-ink/60">
                  presupuesto:
                </span>{' '}
                {presupuesto}
              </div>
            )}
          </div>
        )}

        <section className="grid gap-2">
          <div className="flex items-end justify-between">
            <h2 className="font-display font-extrabold text-lg">
              Ofertas <span className="text-ink/40">({n.ofertas_count}/{n.cap_ofertas})</span>
            </h2>
            {ofertasQ.isFetching && !ofertasQ.isLoading && (
              <span className="text-[10px] text-ink/50">actualizando…</span>
            )}
          </div>

          {ofertasQ.isLoading && (
            <div className="bg-white/60 rounded-2xl border-[1.5px] border-ink/10 px-4 py-3 h-[80px] animate-pulse" />
          )}

          {ofertasQ.error && (
            <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
              {ofertasQ.error.message}
            </div>
          )}

          {!ofertasQ.isLoading && ofertasQ.data?.length === 0 && (
            <div className="bg-mist/30 rounded-2xl border-[1.5px] border-ink p-4 text-sm">
              Aún no llegaron ofertas. Te avisamos cuando lleguen.
            </div>
          )}

          {!ofertasQ.isLoading && ofertasQ.data && ofertasQ.data.length > 0 && (
            <ul className="grid gap-2">
              {ofertasQ.data.map((o, idx) => (
                <li key={o.id}>
                  <OfertaCard o={o} alias={pymeAlias(idx)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

function OfertaCard({ o, alias }: { o: OfertaRow; alias: string }) {
  const monto = fmtMoney(o.precio_total_centavos / 100);
  const isGanadora = o.estado === 'ganadora';
  const isDescartada = o.estado === 'descartada';

  return (
    <div
      className={`rounded-2xl border-[1.5px] p-4 transition ${
        isGanadora
          ? 'bg-sage/15 border-sage'
          : isDescartada
            ? 'bg-white border-ink/15 opacity-60'
            : 'bg-white border-ink'
      }`}
      style={{ boxShadow: isDescartada ? 'none' : 'var(--shadow-pop)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-base">{alias}</h3>
            {isGanadora && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage text-white">
                Ganadora
              </span>
            )}
            {isDescartada && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink/55">
                Descartada
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink/60 mt-0.5">
            {modoEntregaLabel(o.modo_entrega)}
            {o.tiempo_entrega_dias != null ? ` · ${o.tiempo_entrega_dias} días` : ''}
          </div>
        </div>
        <div className="text-right whitespace-nowrap">
          <div className="font-bold text-lg leading-none">{monto}</div>
        </div>
      </div>

      <p className="text-sm mt-2 text-ink/80 whitespace-pre-wrap">{o.descripcion}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}
