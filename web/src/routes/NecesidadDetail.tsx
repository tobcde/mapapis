import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { Button, useDialog } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { useMisGrupos } from '@/lib/queries/useMisGrupos';
import { useNecesidad } from '@/lib/queries/useNecesidad';
import { useOfertasByNecesidad } from '@/lib/queries/useOfertasByNecesidad';
import { useInscripciones } from '@/lib/queries/useInscripciones';
import { useNecesidadProgreso } from '@/lib/queries/useNecesidadProgreso';
import { useAlumnosByGrupo } from '@/lib/queries/useAlumnosByGrupo';
import { useMisVotos } from '@/lib/queries/useMisVotos';
import { useVoteOferta } from '@/lib/mutations/useVoteOferta';
import { useAdjudicarOferta } from '@/lib/mutations/useAdjudicarOferta';
import { useCerrarInscripcion } from '@/lib/mutations/useCerrarInscripcion';
import { useInscribirAlumno } from '@/lib/mutations/useInscribirAlumno';
import { useCrearOferta } from '@/lib/mutations/useCrearOferta';
import { fmtMoney } from '@/utils/fmt';
import { COMMISSION_PCT } from '@/lib/billing';
import { estadoBadgeClass, estadoLabel, modoEntregaLabel, pymeAlias } from '@/utils/necesidad';
import type {
  NecesidadRow,
  NecesidadModalidad,
  OfertaRow,
  ModoEntrega,
  ComposicionItem,
} from '@/lib/database.types';
import type { AlumnoConTutores } from '@/lib/queries/useAlumnosByGrupo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtPresupuesto(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  if (min && max) return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (min) return `Desde ${fmtMoney(min)}`;
  return `Hasta ${fmtMoney(max!)}`;
}

/**
 * Muestra el presupuesto adaptándose a la modalidad:
 *   - grupal      → tal cual (total fijo).
 *   - individual  → "Hasta $X /alumno" + subtítulo "≈ $Y con N inscriptos".
 */
function PresupuestoDisplay({
  maxCentavos,
  minCentavos,
  modalidad,
  inscriptos,
}: {
  maxCentavos: number | null;
  minCentavos: number | null;
  modalidad: NecesidadModalidad;
  inscriptos: number;
}) {
  if (modalidad === 'individual' && maxCentavos != null) {
    const total = maxCentavos * Math.max(inscriptos, 0);
    return (
      <div className="mt-1">
        <p className="font-mono text-sm font-bold">
          Hasta {fmtMoney(maxCentavos)}{' '}
          <span className="text-[11px] text-ink/55 font-normal">/alumno</span>
        </p>
        {inscriptos > 0 && (
          <p className="text-[11px] text-ink/55 font-mono mt-0.5">
            ≈ {fmtMoney(total)} con {inscriptos} inscripto{inscriptos === 1 ? '' : 's'}
          </p>
        )}
      </div>
    );
  }
  return (
    <p className="font-mono text-sm font-bold mt-1">
      {fmtPresupuesto(minCentavos, maxCentavos)}
    </p>
  );
}

const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border-[1.5px] border-ink bg-white text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-coral/30';

// ─── Sección info de la necesidad ─────────────────────────────────────────────

function InfoCard({ n, isPyme = false }: { n: NecesidadRow; isPyme?: boolean }) {
  const progreso = useNecesidadProgreso(n.id);
  const inscriptos = progreso.data?.inscriptos ?? 0;
  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-ink overflow-hidden shadow-pop">
      {n.foto_url && (
        <img
          src={n.foto_url}
          alt=""
          className="w-full max-h-72 object-cover border-b-[1.5px] border-ink"
        />
      )}
      <div className="p-5 space-y-4">
        {/* Descripción */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60">Descripción</p>
          <p className="mt-1.5 text-sm text-ink/85 whitespace-pre-wrap leading-relaxed">
            {n.descripcion}
          </p>
        </div>

        {/* Link de referencia */}
        {n.link_referencia && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
              Referencia
            </p>
            <a
              href={n.link_referencia}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-mist border-[1.5px] border-ink/20 text-xs font-semibold text-ink hover:bg-sun/30 transition-colors break-all"
            >
              Ver ejemplo / link →
            </a>
          </div>
        )}

        {/* Presupuesto (solo familia/admin) + Modalidad */}
        <div className={`grid ${isPyme ? 'grid-cols-1' : 'grid-cols-2'} gap-3 pt-1`}>
          {!isPyme && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60">Presupuesto</p>
              <PresupuestoDisplay
                maxCentavos={n.presupuesto_max_centavos}
                minCentavos={n.presupuesto_min_centavos}
                modalidad={n.modalidad}
                inscriptos={inscriptos}
              />
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60">Modalidad</p>
            <p className="text-sm font-semibold mt-1 capitalize">
              {n.modalidad === 'individual'
                ? `Individual · ${n.cantidad_por_alumno ?? 1}/alumno`
                : 'Grupal'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chip de progreso (inscripción) ───────────────────────────────────────────

function ProgresoChip({
  n,
  esAdmin,
}: {
  n: NecesidadRow;
  esAdmin: boolean;
}) {
  const progreso = useNecesidadProgreso(n.id);
  const { cerrar, reabrir } = useCerrarInscripcion();
  const { showConfirm, showAlert } = useDialog();

  const inscriptosCount = progreso.data?.inscriptos ?? 0;
  const totalAlumnos = progreso.data?.total_alumnos ?? null;
  const cerradaAt = progreso.data?.inscripcion_cerrada_at ?? null;
  const isCerrada = Boolean(cerradaAt);

  const handleCerrar = async () => {
    const ok = await showConfirm(
      '¿Cerrar inscripciones? Las pymes ofertarán con la cantidad final firme. Las familias ya no podrán sumarse.',
    );
    if (!ok) return;
    try {
      await cerrar.mutateAsync({ necesidadId: n.id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al cerrar');
    }
  };

  const handleReabrir = async () => {
    const ok = await showConfirm('¿Reabrir inscripciones?');
    if (!ok) return;
    try {
      await reabrir.mutateAsync({ necesidadId: n.id });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al reabrir');
    }
  };

  return (
    <div
      className={`p-4 rounded-2xl border-[1.5px] ${
        isCerrada ? 'bg-sage/15 border-sage' : 'bg-violet/10 border-violet/30'
      }`}
    >
      <div
        className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
          isCerrada ? 'text-sage' : 'text-violet'
        }`}
      >
        {isCerrada ? 'Inscripciones cerradas' : 'Inscripción abierta'}
      </div>
      <div className="text-sm font-bold">
        {inscriptosCount}
        {totalAlumnos != null ? `/${totalAlumnos}` : ''} alumno
        {inscriptosCount !== 1 ? 's' : ''} anotado
        {inscriptosCount !== 1 ? 's' : ''}
        {' · '}
        <span className="font-mono">
          {inscriptosCount * Number(n.cantidad_por_alumno ?? 1)}
        </span>{' '}
        {isCerrada ? '(cantidad final)' : '(total actual)'}
      </div>

      {n.composicion && n.composicion.length > 0 && (
        <DesgloseComposicion
          composicion={n.composicion}
          modalidad={n.modalidad}
          inscriptos={inscriptosCount}
          isCerrada={isCerrada}
        />
      )}

      {esAdmin && (
        <div className="mt-3 flex gap-2">
          {!isCerrada ? (
            <button
              type="button"
              onClick={() => { void handleCerrar(); }}
              disabled={cerrar.isPending}
              className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {cerrar.isPending ? 'Cerrando…' : 'Cerrar inscripciones'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { void handleReabrir(); }}
              disabled={reabrir.isPending}
              className="px-3 py-1.5 rounded-lg bg-white border-[1.5px] border-ink/40 text-[11px] font-bold uppercase tracking-wider text-ink/80 disabled:opacity-50"
            >
              {reabrir.isPending ? '…' : 'Reabrir'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Resumen para pyme (deadlines + totales del pedido + presupuesto) ────────

function ResumenPyme({
  necesidad,
  inscriptos,
}: {
  necesidad: NecesidadRow;
  inscriptos: number;
}) {
  const compFloor = necesidad.composicion ?? [];
  const totalUnidadesActual = compFloor.reduce(
    (acc, it) => acc + it.cantidad * (necesidad.modalidad === 'individual' ? inscriptos : 1),
    0,
  );
  const fechaEntrega = necesidad.fecha_limite_entrega;

  return (
    <div className="bg-ink rounded-3xl border-[1.5px] border-ink p-5 text-sun shadow-pop space-y-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-sun/70">
        Datos del pedido
      </div>

      {/* Fecha de entrega — la mas importante para la pyme */}
      {fechaEntrega && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-sun/65 mb-1">
            Entregar antes de
          </div>
          <div className="font-display font-extrabold text-2xl leading-tight">
            {fmtFecha(fechaEntrega)}
          </div>
        </div>
      )}

      {/* Cantidad real confirmada (no techo, no proyeccion) */}
      {compFloor.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-sun/65 mb-1">
            Cantidad firme a entregar
          </div>
          <div className="font-mono font-extrabold text-2xl leading-tight">
            {totalUnidadesActual} {totalUnidadesActual === 1 ? 'unidad' : 'unidades'}
          </div>
          {necesidad.modalidad === 'individual' && (
            <div className="text-[10px] text-sun/55 mt-0.5">
              {inscriptos} alumno{inscriptos === 1 ? '' : 's'} inscripto{inscriptos === 1 ? '' : 's'}
              {necesidad.fecha_limite_inscripcion
                ? ` · cierre ${fmtFecha(necesidad.fecha_limite_inscripcion)}`
                : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Desglose de composición (cuando el publicador cargó items estructurados) ─

function DesgloseComposicion({
  composicion,
  modalidad,
  inscriptos,
  isCerrada,
}: {
  composicion: ComposicionItem[];
  modalidad: NecesidadModalidad;
  inscriptos: number;
  isCerrada: boolean;
}) {
  // Solo multiplicamos cuando hay inscriptos. Sin nadie anotado mostramos el
  // desglose "por alumno" tal cual lo cargó el publicador (no "0× cosa").
  const showPerAlumno = modalidad === 'individual' && inscriptos === 0;
  const multiplier = modalidad === 'individual' ? inscriptos : 1;
  const totalUnidadesProyectado = composicion.reduce(
    (acc, it) => acc + it.cantidad * multiplier,
    0,
  );
  const totalUnidadesPorAlumno = composicion.reduce((acc, it) => acc + it.cantidad, 0);

  const labelTotal =
    showPerAlumno
      ? 'Por cada alumno que se anote'
      : isCerrada
        ? 'Pedido total final'
        : 'Pedido total estimado';

  return (
    <div className="mt-3 pt-3 border-t border-ink/15">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-2">
        {labelTotal}
      </div>
      <ul className="space-y-2">
        {composicion.map((it, i) => {
          const total = showPerAlumno ? it.cantidad : it.cantidad * multiplier;
          return (
            <li key={i} className="text-sm flex items-center gap-2">
              {it.foto_url ? (
                <img
                  src={it.foto_url}
                  alt={it.nombre}
                  className="w-10 h-10 rounded-lg object-cover border-[1.5px] border-ink/20 shrink-0"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-mist/40 border-[1.5px] border-ink/10 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-bold">{total}×</span>
                  <span className="truncate">{it.nombre}</span>
                  {it.link_url && (
                    <a
                      href={it.link_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[11px] text-coral hover:underline shrink-0"
                      title="Ver link de referencia"
                    >
                      ↗
                    </a>
                  )}
                </div>
                {it.descripcion && (
                  <div className="text-[11px] text-ink/70 mt-0.5 leading-snug whitespace-pre-wrap">
                    {it.descripcion}
                  </div>
                )}
                {modalidad === 'individual' && !showPerAlumno && (
                  <div className="text-[10px] text-ink/50 font-mono mt-0.5">
                    ({it.cantidad}/alumno × {inscriptos})
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="text-[11px] text-ink/55 mt-2 italic">
        {showPerAlumno
          ? `${totalUnidadesPorAlumno} unidades por alumno · se multiplica con cada inscripción`
          : `Total: ${totalUnidadesProyectado} unidades`}
      </div>
    </div>
  );
}

// ─── Panel inscripción (anotar hijos) ─────────────────────────────────────────

function InscripcionPanel({
  necesidad,
  misAlumnos,
  inscripciones,
  isCerrada,
}: {
  necesidad: NecesidadRow;
  misAlumnos: AlumnoConTutores[];
  inscripciones: { alumno_id: string }[];
  isCerrada: boolean;
}) {
  const { inscribir, desinscribir } = useInscribirAlumno();
  const { showAlert } = useDialog();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inscriptosSet = new Set(inscripciones.map((i) => i.alumno_id));

  const toggle = async (alumnoId: string, yaInscripto: boolean) => {
    if (isCerrada) return;
    setBusyId(alumnoId);
    try {
      if (yaInscripto) {
        await desinscribir.mutateAsync({ necesidadId: necesidad.id, alumnoId });
      } else {
        await inscribir.mutateAsync({ necesidadId: necesidad.id, alumnoId });
      }
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al actualizar inscripción');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display font-bold text-xl">Anotar a tus hijos/as</h2>
        <p className="text-xs text-ink/65 mt-1">
          {isCerrada
            ? 'Las inscripciones están cerradas. La cantidad final quedó firme.'
            : `Cada alumno anotado suma ${necesidad.cantidad_por_alumno ?? 1} unidad${
                Number(necesidad.cantidad_por_alumno) === 1 ? '' : 'es'
              } al total del pedido.`}
        </p>
      </div>
      <div className="space-y-2">
        {misAlumnos.map((a) => {
          const yaInscripto = inscriptosSet.has(a.id);
          const isBusy = busyId === a.id;
          const disabled = isBusy || isCerrada;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => { void toggle(a.id, yaInscripto); }}
              disabled={disabled}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-[1.5px] transition-colors ${
                yaInscripto ? 'bg-sage/15 border-sage' : 'bg-white border-ink/30'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-ink/60'}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center text-xs font-bold ${
                    yaInscripto
                      ? 'bg-sage border-sage text-white'
                      : 'border-ink/40 bg-white'
                  }`}
                >
                  {yaInscripto ? '✓' : ''}
                </span>
                <span className="font-semibold text-sm">{a.nombre}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink/60">
                {isBusy ? '…' : isCerrada ? (yaInscripto ? 'Anotado' : '—') : yaInscripto ? 'Anotado' : 'Anotar'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── OfertaCard familia ───────────────────────────────────────────────────────

function OfertaCardFamilia({
  oferta,
  index,
  necesidad,
  misAlumnos,
  misVotos,
  esAdmin,
  adjudicada,
}: {
  oferta: OfertaRow;
  index: number;
  necesidad: NecesidadRow;
  misAlumnos: AlumnoConTutores[];
  misVotos: Record<string, string>;
  esAdmin: boolean;
  adjudicada: boolean;
}) {
  const { vote, unvote } = useVoteOferta();
  const adjudicar = useAdjudicarOferta();
  const progresoOC = useNecesidadProgreso(necesidad.id);
  const inscriptosOC = progresoOC.data?.inscriptos ?? 0;
  const { showConfirm, showAlert } = useDialog();
  const alias = pymeAlias(index);
  const esGanadora = oferta.estado === 'ganadora';
  const esDescartada = oferta.estado === 'descartada';
  const totalConComisionOC = Math.round(oferta.precio_total_centavos * (1 + COMMISSION_PCT));
  const porFamiliaOC =
    necesidad.modalidad === 'individual' && inscriptosOC > 0
      ? Math.round(totalConComisionOC / inscriptosOC)
      : null;

  const handleVote = async (alumnoId: string, yaVoto: boolean) => {
    try {
      if (yaVoto) {
        await unvote.mutateAsync({ alumnoId, ofertaId: oferta.id, necesidadId: necesidad.id });
      } else {
        await vote.mutateAsync({ alumnoId, ofertaId: oferta.id, necesidadId: necesidad.id });
      }
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al votar');
    }
  };

  const handleAdjudicar = async () => {
    const monto = fmtMoney(oferta.precio_total_centavos);
    const ok = await showConfirm(
      `¿Adjudicar la oferta de ${alias} por ${monto}? Las demás quedan descartadas.`,
    );
    if (!ok) return;
    try {
      await adjudicar.mutateAsync({
        ofertaId: oferta.id,
        necesidadId: necesidad.id,
        grupoId: necesidad.grupo_id,
      });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : 'Error al adjudicar');
    }
  };

  return (
    <div
      className={`rounded-3xl border-[1.5px] p-4 transition ${
        esGanadora
          ? 'bg-sage/15 border-sage'
          : esDescartada
            ? 'bg-white border-ink/15 opacity-60'
            : 'bg-white border-ink shadow-pop'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-lg">{alias}</h3>
            {esGanadora && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage text-white">
                Ganadora
              </span>
            )}
            {esDescartada && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/55">
                Descartada
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink/60 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{modoEntregaLabel(oferta.modo_entrega)}</span>
            {oferta.tiempo_entrega_dias != null && (
              <>
                <span className="text-ink/30">·</span>
                <span>
                  {oferta.tiempo_entrega_dias === 0 ? 'entrega inmediata' : `${oferta.tiempo_entrega_dias} días`}
                </span>
              </>
            )}
            {oferta.retiro_inmediato && (
              <span className="px-1.5 py-0.5 rounded-full bg-sage text-white text-[9px] font-bold uppercase tracking-wider">
                Retiro inmediato
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-extrabold text-xl">
            {fmtMoney(totalConComisionOC)}
          </div>
          <div className="text-[10px] text-ink/55 font-mono">
            total grupo (incluye {Math.round(COMMISSION_PCT * 100)}% MaPaPis)
          </div>
          {porFamiliaOC != null && (
            <div className="text-[10px] text-ink/65 font-mono mt-0.5 font-bold">
              ≈ {fmtMoney(porFamiliaOC)} / familia
            </div>
          )}
          {oferta.precio_envio_centavos > 0 && (
            <div className="text-[10px] text-ink/55 font-mono mt-0.5">
              incluye {fmtMoney(oferta.precio_envio_centavos)} de envío
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-ink/80 mt-3 whitespace-pre-wrap leading-relaxed">
        {oferta.descripcion}
      </p>

      {/* Votos de alumnos */}
      {!adjudicada && misAlumnos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink/10">
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink/55 mb-2">
            Tu voto
          </div>
          <div className="flex flex-wrap gap-2">
            {misAlumnos.map((a) => {
              const yaVoto = misVotos[a.id] === oferta.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { void handleVote(a.id, yaVoto); }}
                  disabled={vote.isPending || unvote.isPending}
                  className={`px-3 py-1.5 rounded-full border-[1.5px] text-xs font-bold transition-colors disabled:opacity-60 ${
                    yaVoto
                      ? 'bg-coral text-white border-ink'
                      : 'bg-white text-ink border-ink/30 hover:border-ink/60'
                  }`}
                >
                  {yaVoto ? '✓ ' : ''}{a.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjudicar (solo admin, no adjudicada aún) */}
      {!adjudicada && esAdmin && (
        <div className="mt-3 pt-3 border-t border-ink/10">
          <button
            type="button"
            onClick={() => { void handleAdjudicar(); }}
            disabled={adjudicar.isPending}
            className="w-full py-2.5 rounded-xl bg-ink text-sun text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {adjudicar.isPending ? 'Adjudicando…' : 'Adjudicar a esta pyme'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Panel de ofertas (familia) ───────────────────────────────────────────────

function PanelOfertasFamilia({
  necesidad,
  ofertas,
  misAlumnos,
  misVotos,
  esAdmin,
}: {
  necesidad: NecesidadRow;
  ofertas: OfertaRow[];
  misAlumnos: AlumnoConTutores[];
  misVotos: Record<string, string>;
  esAdmin: boolean;
}) {
  const adjudicada = necesidad.estado === 'adjudicada' || ofertas.some((o) => o.estado === 'ganadora');

  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-xl">
        Ofertas recibidas{' '}
        <span className="text-ink/40">({ofertas.length}/{necesidad.cap_ofertas})</span>
      </h2>
      {ofertas.length === 0 ? (
        <div className="bg-mist/50 rounded-3xl p-5 text-center text-sm text-ink/70">
          Esperando ofertas. Las pymes de la zona verán el pedido.
        </div>
      ) : (
        <div className="space-y-3">
          {ofertas.map((o, idx) => (
            <OfertaCardFamilia
              key={o.id}
              oferta={o}
              index={idx}
              necesidad={necesidad}
              misAlumnos={misAlumnos}
              misVotos={misVotos}
              esAdmin={esAdmin}
              adjudicada={adjudicada}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Panel oferta (pyme) ──────────────────────────────────────────────────────

function PanelOfertaPyme({
  necesidad,
  ofertas,
  pymeId,
}: {
  necesidad: NecesidadRow;
  ofertas: OfertaRow[];
  pymeId: string;
}) {
  const crearOferta = useCrearOferta();
  const { showAlert } = useDialog();
  const miOferta = ofertas.find((o) => o.pyme_id === pymeId);
  const [showForm, setShowForm] = useState(!miOferta);
  const [precioRetiro, setPrecioRetiro] = useState('');
  const [precioEnvio, setPrecioEnvio] = useState('');
  const [incluyeEnvio, setIncluyeEnvio] = useState(false);
  const [retiroInmediato, setRetiroInmediato] = useState(false);
  const [dias, setDias] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const retiroNum = Number(precioRetiro) || 0;
  const envioNum = incluyeEnvio ? Number(precioEnvio) || 0 : 0;
  const totalNum = retiroNum + envioNum;
  const modoEntregaCalculado: ModoEntrega =
    incluyeEnvio && retiroNum > 0 ? 'ambos'
    : incluyeEnvio ? 'envio'
    : 'retiro';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (retiroNum < 1 && envioNum < 1) {
      setErr('Cargá un precio de retiro o de envío.');
      return;
    }
    if (descripcion.trim().length < 10) {
      setErr('La descripción debe tener al menos 10 caracteres.');
      return;
    }
    try {
      await crearOferta.mutateAsync({
        necesidadId: necesidad.id,
        precioCentavos: Math.round(totalNum * 100),
        precioEnvioCentavos: Math.round(envioNum * 100),
        retiroInmediato,
        tiempoDias: dias ? Number(dias) : null,
        descripcion: descripcion.trim(),
        modoEntrega: modoEntregaCalculado,
      });
      setShowForm(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al enviar la oferta';
      setErr(msg);
      await showAlert(msg);
    }
  };

  if (miOferta) {
    const envio = miOferta.precio_envio_centavos ?? 0;
    const retiro = miOferta.precio_total_centavos - envio;
    const comision = Math.round(miOferta.precio_total_centavos * COMMISSION_PCT);
    return (
      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl">Tu oferta</h2>
        <div className="bg-sage/10 rounded-3xl border-[1.5px] border-sage p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="font-mono font-extrabold text-2xl">
                {fmtMoney(miOferta.precio_total_centavos)}
              </span>
              <span className="text-[10px] text-ink/55 ml-2 uppercase tracking-wider font-bold">
                neto
              </span>
            </div>
            {miOferta.tiempo_entrega_dias != null && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink/60">
                {miOferta.tiempo_entrega_dias === 0 ? 'inmediato' : `${miOferta.tiempo_entrega_dias} días`}
              </span>
            )}
          </div>
          {envio > 0 && (
            <p className="text-[11px] text-ink/65 font-mono">
              {fmtMoney(retiro)} retiro + {fmtMoney(envio)} envío
            </p>
          )}
          <p className="text-[11px] text-ink/55 font-mono">
            − comisión MaPaPis ({Math.round(COMMISSION_PCT * 100)}%): {fmtMoney(comision)}
          </p>
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="text-ink/70">{modoEntregaLabel(miOferta.modo_entrega)}</span>
            {miOferta.retiro_inmediato && (
              <span className="px-2 py-0.5 rounded-full bg-sage text-white text-[10px] font-bold uppercase tracking-wider">
                Retiro inmediato
              </span>
            )}
          </div>
          <p className="text-sm text-ink/85 whitespace-pre-wrap leading-relaxed">
            {miOferta.descripcion}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-sage mt-2">
            ✓ Presentada
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-xl">¿Cubrís este pedido?</h2>
      <div className="bg-sun rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
        <p className="text-sm font-semibold">Las ofertas son <span className="hl-coral">selladas</span> — el grupo elige al cierre.</p>

        {!showForm ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-4"
            onClick={() => { setShowForm(true); }}
          >
            Presentar oferta →
          </Button>
        ) : (
          <form onSubmit={(e) => { void onSubmit(e); }} className="mt-4 space-y-3">
            {err && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {err}
              </div>
            )}

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Precio del pedido completo ($) *
              </span>
              <span className="block text-[10px] text-ink/55 mb-1.5">
                Lo que cobrás vos por todos los items del pedido. La app lo divide automáticamente entre las familias inscriptas.
              </span>
              <input
                type="number"
                min={0}
                required
                value={precioRetiro}
                onChange={(e) => { setPrecioRetiro(e.target.value); }}
                placeholder="45000"
                className={INPUT_CLS + ' font-mono'}
              />
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={incluyeEnvio}
                onChange={(e) => { setIncluyeEnvio(e.target.checked); }}
                className="w-4 h-4 accent-ink"
              />
              <span className="text-xs font-bold">También hago envío</span>
            </label>

            {incluyeEnvio && (
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                  Costo del envío ($)
                </span>
                <input
                  type="number"
                  min={0}
                  value={precioEnvio}
                  onChange={(e) => { setPrecioEnvio(e.target.value); }}
                  placeholder="3500"
                  className={INPUT_CLS + ' font-mono'}
                />
              </label>
            )}

            {totalNum > 0 && (
              <div className="rounded-xl bg-ink text-sun px-3 py-2.5 space-y-1.5">
                <div className="text-sm flex items-baseline justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    Vos cobrás (neto)
                  </span>
                  <span className="font-mono font-extrabold">${totalNum.toLocaleString('es-AR')}</span>
                </div>
                <div className="text-[10px] flex items-baseline justify-between opacity-65">
                  <span>− Comisión MaPaPis ({Math.round(COMMISSION_PCT * 100)}%)</span>
                  <span className="font-mono">
                    ${Math.round(totalNum * COMMISSION_PCT).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="text-[9px] opacity-55 italic mt-1">
                  La comisión la pagan las familias por encima de tu precio. La fee de MP por
                  tarjeta también la cobra MP al pagador, no a vos.
                </div>
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={retiroInmediato}
                onChange={(e) => { setRetiroInmediato(e.target.checked); }}
                className="w-4 h-4 accent-ink mt-0.5"
              />
              <span className="text-xs leading-snug">
                <span className="font-bold">Retiro inmediato disponible</span>
                <span className="block text-ink/60 text-[10px] mt-0.5">
                  Tengo stock para entregar hoy mismo. Aparece como ventaja en la oferta.
                </span>
              </span>
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Tiempo de entrega (días)
              </span>
              <input
                type="number"
                min={0}
                value={dias}
                onChange={(e) => { setDias(e.target.value); }}
                placeholder={retiroInmediato ? '0' : '7'}
                className={INPUT_CLS + ' font-mono'}
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                Detalle de la oferta *
              </span>
              <textarea
                required
                minLength={10}
                maxLength={1000}
                rows={3}
                value={descripcion}
                onChange={(e) => { setDescripcion(e.target.value); }}
                placeholder="Material, calidad, condiciones. Sin teléfono: el contacto se intercambia al adjudicar."
                className={INPUT_CLS + ' resize-none'}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => { setShowForm(false); }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={crearOferta.isPending}
              >
                Enviar
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── NecesidadDetail ──────────────────────────────────────────────────────────

export function NecesidadDetail() {
  const { id: grupoId, necesidadId } = useParams<{ id: string; necesidadId: string }>();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: misGrupos = [] } = useMisGrupos();

  const necesidadQ = useNecesidad(necesidadId);
  const ofertasQ = useOfertasByNecesidad(necesidadId);
  const inscripcionesQ = useInscripciones(necesidadId);
  const alumnosQ = useAlumnosByGrupo(grupoId);
  const progreso = useNecesidadProgreso(necesidadId);

  const isPyme = profile?.role === 'pyme';
  const userId = profile?.id ?? '';

  // Alumnos del usuario (filtrando por tutor)
  const misAlumnos = (alumnosQ.data ?? []).filter((a) =>
    a.alumno_tutores.some((t) => t.profile_id === userId),
  );

  const ofertaIds = (ofertasQ.data ?? []).map((o) => o.id);
  const alumnoIds = misAlumnos.map((a) => a.id);

  const misVotosQ = useMisVotos(necesidadId, alumnoIds, ofertaIds);

  // Mi rol en el grupo
  const miGrupo = misGrupos.find((g) => g.id === grupoId);
  const esAdmin =
    miGrupo?.rol_en_grupo === 'admin' || miGrupo?.rol_en_grupo === 'creador';

  const isCerrada = Boolean(progreso.data?.inscripcion_cerrada_at);

  // ── Loading / error ──────────────────────────────────────────────────────

  if (necesidadQ.isLoading) {
    return (
      <Shell>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/60 rounded-2xl border-[1.5px] border-ink/10 animate-pulse" />
          ))}
        </div>
      </Shell>
    );
  }

  if (necesidadQ.error || !necesidadQ.data) {
    return (
      <Shell>
        <div className="space-y-4">
          <div className="bg-coral/10 text-coral text-sm rounded-xl border-[1.5px] border-coral px-4 py-3">
            No encontramos esta necesidad. {necesidadQ.error?.message ?? ''}
          </div>
          <button
            type="button"
            onClick={() => { void navigate(grupoId ? `/grupos/${grupoId}` : '/grupos'); }}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
          >
            ← Volver al grupo
          </button>
        </div>
      </Shell>
    );
  }

  const n = necesidadQ.data;
  const ofertas = ofertasQ.data ?? [];
  const inscripciones = inscripcionesQ.data ?? [];
  const misVotos = misVotosQ.data ?? {};

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="space-y-5 anim-in">
        {/* Volver */}
        <Link
          to={grupoId ? `/grupos/${grupoId}` : '/grupos'}
          className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
        >
          ← Volver al grupo
        </Link>

        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display font-extrabold text-2xl leading-tight">{n.titulo}</h1>
            <span
              className={`shrink-0 text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-1 whitespace-nowrap ${estadoBadgeClass(n.estado)}`}
            >
              {estadoLabel(n.estado)}
            </span>
          </div>
          <div className="text-[11px] text-ink/60 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{n.zona}</span>
            {n.fecha_limite_inscripcion && (
              <span>Inscripción hasta {fmtFecha(n.fecha_limite_inscripcion)}</span>
            )}
            {n.fecha_limite_entrega && (
              <span>Entrega {fmtFecha(n.fecha_limite_entrega)}</span>
            )}
          </div>
        </div>

        {/* Info */}
        <InfoCard n={n} isPyme={isPyme} />

        {/* Resumen pyme — fecha entrega + cantidad firme a entregar */}
        {isPyme && (
          <ResumenPyme
            necesidad={n}
            inscriptos={progreso.data?.inscriptos ?? 0}
          />
        )}

        {/* Progreso inscripción (individual) */}
        {n.modalidad === 'individual' && (
          <ProgresoChip n={n} esAdmin={!isPyme && esAdmin} />
        )}

        {/* Panel de inscripción (familia, individual, con alumnos) */}
        {!isPyme && n.modalidad === 'individual' && misAlumnos.length > 0 && (
          <InscripcionPanel
            necesidad={n}
            misAlumnos={misAlumnos}
            inscripciones={inscripciones}
            isCerrada={isCerrada}
          />
        )}

        {/* Ofertas */}
        {isPyme ? (
          <PanelOfertaPyme
            necesidad={n}
            ofertas={ofertas}
            pymeId={userId}
          />
        ) : (
          <PanelOfertasFamilia
            necesidad={n}
            ofertas={ofertas}
            misAlumnos={misAlumnos}
            misVotos={misVotos}
            esAdmin={esAdmin}
          />
        )}
      </div>
    </Shell>
  );
}
