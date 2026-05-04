import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { parseError } from '@/lib/parseError';
import { Shell } from '@/components/Shell';
import { Button, useDialog } from '@/components/ui';
import { useProfile } from '@/lib/queries/useProfile';
import { usePymeProfile } from '@/lib/queries/usePymeProfile';
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
  NecesidadInscripcionRow,
  OfertaRow,
  OfertaVariante,
  ModoEntrega,
  ComposicionItem,
  RangoHorario,
  DiaSemana,
  PymeRow,
} from '@/lib/database.types';
import { uploadFotoToStorage } from '@/lib/storage/uploadFoto';
import type { AlumnoConTutores } from '@/lib/queries/useAlumnosByGrupo';
import { PanelCobranzas } from '@/components/cobranzas/PanelCobranzas';

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
  const isCerrada =
    Boolean(n.inscripcion_cerrada_at) || Boolean(progreso.data?.inscripcion_cerrada_at);

  const handleCerrar = async () => {
    const ok = await showConfirm(
      '¿Cerrar inscripciones? Las pymes ofertarán con la cantidad final firme. Las familias ya no podrán sumarse.',
    );
    if (!ok) return;
    try {
      await cerrar.mutateAsync({ necesidadId: n.id });
    } catch (err) {
      await showAlert(parseError(err));
    }
  };

  const handleReabrir = async () => {
    const ok = await showConfirm('¿Reabrir inscripciones?');
    if (!ok) return;
    try {
      await reabrir.mutateAsync({ necesidadId: n.id });
    } catch (err) {
      await showAlert(parseError(err));
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
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
  puedeAnotar,
  subtituloInscripcion,
}: {
  necesidad: NecesidadRow;
  misAlumnos: AlumnoConTutores[];
  inscripciones: { alumno_id: string }[];
  puedeAnotar: boolean;
  subtituloInscripcion: string;
}) {
  const { inscribir, desinscribir } = useInscribirAlumno();
  const { showAlert } = useDialog();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inscriptosSet = new Set(inscripciones.map((i) => i.alumno_id));

  const toggle = async (alumnoId: string, yaInscripto: boolean) => {
    if (!puedeAnotar) return;
    setBusyId(alumnoId);
    try {
      if (yaInscripto) {
        await desinscribir.mutateAsync({ necesidadId: necesidad.id, alumnoId });
      } else {
        await inscribir.mutateAsync({ necesidadId: necesidad.id, alumnoId });
      }
    } catch (err) {
      await showAlert(parseError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display font-bold text-xl">Anotar a tus hijos/as</h2>
        <p className="text-xs text-ink/65 mt-1">{subtituloInscripcion}</p>
      </div>
      <div className="space-y-2">
        {misAlumnos.map((a) => {
          const yaInscripto = inscriptosSet.has(a.id);
          const isBusy = busyId === a.id;
          const disabled = isBusy || !puedeAnotar;
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
                {isBusy
                  ? '…'
                  : !puedeAnotar
                    ? (yaInscripto ? 'Anotado' : '—')
                    : yaInscripto
                      ? 'Anotado'
                      : 'Anotar'}
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
  alumnosInscriptos,
  esAdmin,
  adjudicada,
}: {
  oferta: OfertaRow;
  index: number;
  necesidad: NecesidadRow;
  misAlumnos: AlumnoConTutores[];
  misVotos: Record<string, string>;
  alumnosInscriptos: Set<string>;
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
      await showAlert(parseError(err));
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
      await showAlert(parseError(err));
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

      {oferta.variantes && oferta.variantes.length > 0 && (
        <div className="mt-3">
          <VariantesGallery variantes={oferta.variantes} />
        </div>
      )}

      <p className="text-sm text-ink/80 mt-3 whitespace-pre-wrap leading-relaxed">
        {oferta.descripcion}
      </p>

      {/* Votos de alumnos — fila por hijo con acción explícita */}
      {!adjudicada && misAlumnos.length > 0 && (
        <div
          id={`oferta-${oferta.id}-votos`}
          className="mt-3 pt-3 border-t border-ink/10 space-y-2"
        >
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink/55">
            Elegir esta oferta para
          </div>
          {misAlumnos.map((a) => {
            const votoActual = misVotos[a.id];
            const yaVoto = votoActual === oferta.id;
            const votoEnOtra = votoActual && !yaVoto;
            const inscripto = alumnosInscriptos.has(a.id);
            const disabled = vote.isPending || unvote.isPending || !inscripto;

            return (
              <div
                key={a.id}
                className="flex items-center gap-2 flex-wrap"
              >
                <span className="text-sm font-bold text-ink min-w-[80px]">{a.nombre}</span>

                {!inscripto && (
                  <span className="text-[11px] text-ink/55 italic">
                    Anotalo arriba en "¿Quién participa?" para poder votar
                  </span>
                )}

                {inscripto && yaVoto && (
                  <>
                    <span className="px-3 py-1.5 rounded-full border-[1.5px] border-ink bg-coral text-white text-xs font-bold inline-flex items-center gap-1">
                      <CheckIcon className="w-3.5 h-3.5" />
                      Elegida
                    </span>
                    <button
                      type="button"
                      onClick={() => { void handleVote(a.id, true); }}
                      disabled={disabled}
                      className="text-[11px] font-bold uppercase tracking-wider text-ink/50 hover:text-coral underline disabled:opacity-50"
                    >
                      Quitar voto
                    </button>
                  </>
                )}

                {inscripto && votoEnOtra && (
                  <button
                    type="button"
                    onClick={() => { void handleVote(a.id, false); }}
                    disabled={disabled}
                    className="px-3 py-1.5 rounded-full border-[1.5px] border-coral bg-coral/10 text-coral text-xs font-bold hover:bg-coral/20 transition-colors disabled:opacity-60"
                  >
                    Cambiar voto a esta
                  </button>
                )}

                {inscripto && !votoActual && (
                  <button
                    type="button"
                    onClick={() => { void handleVote(a.id, false); }}
                    disabled={disabled}
                    className="px-3 py-1.5 rounded-full border-[1.5px] border-ink/30 bg-white text-ink text-xs font-bold hover:border-ink/60 transition-colors disabled:opacity-60"
                  >
                    Elegir esta
                  </button>
                )}
              </div>
            );
          })}
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

// ─── Resumen "Tu voto" ────────────────────────────────────────────────────────

function ResumenMiVoto({
  misAlumnos,
  misVotos,
  ofertas,
}: {
  misAlumnos: AlumnoConTutores[];
  misVotos: Record<string, string>;
  ofertas: OfertaRow[];
}) {
  const aliasPorOferta = new Map(ofertas.map((o, i) => [o.id, pymeAlias(i)]));

  const scrollToOferta = (ofertaId: string) => {
    const el = document.getElementById(`oferta-${ofertaId}-votos`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-coral', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-coral', 'ring-offset-2');
      }, 1500);
    }
  };

  return (
    <div className="bg-cream rounded-2xl border-[1.5px] border-ink p-4 shadow-pop">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink/55 mb-2">
        Tu voto
      </div>
      <div className="space-y-1.5">
        {misAlumnos.map((a) => {
          const ofertaId = misVotos[a.id];
          const alias = ofertaId ? aliasPorOferta.get(ofertaId) ?? null : null;

          return (
            <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-ink">{a.nombre}</span>
              {ofertaId && alias ? (
                <button
                  type="button"
                  onClick={() => { scrollToOferta(ofertaId); }}
                  className="text-xs font-bold text-coral hover:underline inline-flex items-center gap-1"
                >
                  <span className="px-2 py-0.5 rounded-full bg-coral text-white text-[10px] uppercase tracking-wider">
                    {alias}
                  </span>
                  <span className="text-ink/40 text-[10px] uppercase tracking-wider">cambiar ↓</span>
                </button>
              ) : (
                <span className="text-xs text-ink/45 italic">Sin votar</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel de ofertas (familia) ───────────────────────────────────────────────

function PanelOfertasFamilia({
  necesidad,
  ofertas,
  misAlumnos,
  misVotos,
  inscripciones,
  esAdmin,
}: {
  necesidad: NecesidadRow;
  ofertas: OfertaRow[];
  misAlumnos: AlumnoConTutores[];
  misVotos: Record<string, string>;
  inscripciones: NecesidadInscripcionRow[];
  esAdmin: boolean;
}) {
  const adjudicada = necesidad.estado === 'adjudicada' || ofertas.some((o) => o.estado === 'ganadora');
  const mostrarResumen = !adjudicada && misAlumnos.length > 0 && ofertas.length > 0;

  // En modalidad individual hay que estar inscripto para poder votar.
  // En grupal no hay tabla de inscripciones, todos los miembros pueden votar.
  const requiereInscripcion = necesidad.modalidad === 'individual';
  const inscriptosIds = new Set(inscripciones.map((i) => i.alumno_id));
  const alumnosInscriptos = requiereInscripcion
    ? new Set(misAlumnos.filter((a) => inscriptosIds.has(a.id)).map((a) => a.id))
    : new Set(misAlumnos.map((a) => a.id));

  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-xl">
        Ofertas recibidas{' '}
        <span className="text-ink/40">({ofertas.length}/{necesidad.cap_ofertas})</span>
      </h2>

      {mostrarResumen && (
        <ResumenMiVoto
          misAlumnos={misAlumnos}
          misVotos={misVotos}
          ofertas={ofertas}
        />
      )}

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
              alumnosInscriptos={alumnosInscriptos}
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
  const progreso = useNecesidadProgreso(necesidad.id);
  const inscriptos = progreso.data?.inscriptos ?? 0;
  const { data: pymeProfile } = usePymeProfile();
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
  const [variantes, setVariantes] = useState<VarianteRow[]>([]);
  const [uploadingFotos, setUploadingFotos] = useState(false);
  // Disponibilidad — overrides (null = usar config pyme)
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);
  const [envioOverride, setEnvioOverride] = useState<boolean | null>(null);
  const [horariosOverride, setHorariosOverride] = useState<RangoHorario[] | null>(null);
  const [notasDisponibilidad, setNotasDisponibilidad] = useState('');

  const tieneVariantes = variantes.some(
    (v) => v.nombre.trim().length > 0 && Number(v.precio) > 0,
  );

  // Si hay variantes, el "precio retiro" se calcula sumando variantes.
  // Variantes con el MISMO item_ref son alternativas → se cuenta solo la más
  // cara (techo). Variantes sin item_ref o con item_refs únicos se suman.
  const variantesValidas = variantes.filter(
    (v) => v.nombre.trim().length > 0 && Number(v.precio) > 0,
  );
  const variantesPorSlot = new Map<string, VarianteRow[]>();
  for (const v of variantesValidas) {
    const slot = v.item_ref.trim().toLowerCase() || `__nop_${v.nombre.trim().toLowerCase()}_${variantesPorSlot.size}`;
    const existing = variantesPorSlot.get(slot) ?? [];
    existing.push(v);
    variantesPorSlot.set(slot, existing);
  }
  const subtotalVariantes = Array.from(variantesPorSlot.values()).reduce(
    (acc, alternativas) => {
      const techoSlot = alternativas.reduce(
        (max, v) => Math.max(max, (Number(v.precio) || 0) * (Number(v.cantidad) || 1)),
        0,
      );
      return acc + techoSlot;
    },
    0,
  );
  const hayAlternativasMultiples = Array.from(variantesPorSlot.values()).some(
    (arr) => arr.length > 1,
  );
  const retiroNum = tieneVariantes ? subtotalVariantes : Number(precioRetiro) || 0;
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
      setErr('Cargá un precio (con variantes o manual).');
      return;
    }
    if (descripcion.trim().length < 10) {
      setErr('La descripción debe tener al menos 10 caracteres.');
      return;
    }
    if (uploadingFotos) {
      setErr('Esperá a que terminen de subir las fotos.');
      return;
    }
    const variantesClean: OfertaVariante[] = variantes
      .map((v) => {
        const item: OfertaVariante = {
          nombre: v.nombre.trim(),
          precio_centavos: Math.round((Number(v.precio) || 0) * 100),
        };
        const cantidad = Number(v.cantidad);
        if (Number.isFinite(cantidad) && cantidad > 1) item.cantidad = Math.round(cantidad);
        const ref = v.item_ref.trim();
        if (ref) item.item_ref = ref;
        const desc = v.descripcion.trim();
        if (desc) item.descripcion = desc;
        if (v.foto_url) item.foto_url = v.foto_url;
        const link = v.link_url.trim();
        if (link) item.link_url = link;
        return item;
      })
      .filter((v) => v.nombre.length > 0 && v.precio_centavos > 0);
    try {
      await crearOferta.mutateAsync({
        necesidadId: necesidad.id,
        precioCentavos: Math.round(totalNum * 100),
        precioEnvioCentavos: Math.round(envioNum * 100),
        retiroInmediato,
        tiempoDias: dias ? Number(dias) : null,
        descripcion: descripcion.trim(),
        modoEntrega: modoEntregaCalculado,
        ...(variantesClean.length > 0 ? { variantes: variantesClean } : {}),
        ...(localOverride !== null ? { localALaCalleOverride: localOverride } : {}),
        ...(envioOverride !== null ? { haceEnvioOverride: envioOverride } : {}),
        ...(horariosOverride !== null ? { horariosDiaEntregaOverride: horariosOverride } : {}),
        ...(notasDisponibilidad.trim() ? { notasDisponibilidad: notasDisponibilidad.trim() } : {}),
      });
      setShowForm(false);
    } catch (error) {
      const msg = parseError(error);
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
          {miOferta.variantes && miOferta.variantes.length > 0 && (
            <VariantesGallery variantes={miOferta.variantes} />
          )}
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

            {/* Variantes — opcional. Si la pyme carga al menos una, el precio retiro
                se deriva de la suma. Si no carga ninguna, aparece el input simple. */}
            {/* Si la necesidad tiene composicion, mostramos atajos por item */}
            {necesidad.composicion && necesidad.composicion.length > 0 && (
              <ItemsDelPedido
                composicion={necesidad.composicion}
                variantes={variantes}
                modalidad={necesidad.modalidad}
                inscriptos={inscriptos}
                onCotizarItem={(nombreItem, totalItem) => {
                  setVariantes([
                    ...variantes,
                    {
                      ...emptyVariante(),
                      nombre: nombreItem,
                      item_ref: nombreItem,
                      cantidad: String(totalItem),
                    },
                  ]);
                }}
              />
            )}

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">
                {necesidad.composicion && necesidad.composicion.length > 0
                  ? 'Tus variantes cotizadas'
                  : 'Variantes del producto (opcional)'}
              </span>
              <span className="block text-[10px] text-ink/55 mb-2">
                {necesidad.composicion && necesidad.composicion.length > 0
                  ? 'Cada una con su precio. Podés ofrecer varias por item del pedido (ej. dos marcas distintas) o dejar items sin cotizar.'
                  : 'Si tenés varias opciones (ej: tapa dura $800, tapa flexible $500), cargá cada una con su precio. La familia las ve y elige. Si es un solo producto, dejá vacío y poné el precio total abajo.'}
              </span>
              <VariantesEditor
                items={variantes}
                onChange={setVariantes}
                onUploadingChange={setUploadingFotos}
                pyomeId={pymeId}
                necesidadId={necesidad.id}
              />
              {tieneVariantes && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-sage/15 border border-sage/40 text-[11px] font-bold space-y-1">
                  <div>
                    ✓ Subtotal: ${subtotalVariantes.toLocaleString('es-AR')}
                  </div>
                  {hayAlternativasMultiples && (
                    <div className="font-normal text-[10px] text-ink/65">
                      Variantes con mismo item se toman como alternativas: solo cuenta la más cara para el techo. La familia elige cuál al adjudicar.
                    </div>
                  )}
                </div>
              )}
            </div>

            {!tieneVariantes && (
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1.5">
                  Precio del pedido completo ($) *
                </span>
                <span className="block text-[10px] text-ink/55 mb-1.5">
                  Lo que cobrás por todos los items del pedido. La app lo divide automáticamente entre las familias inscriptas.
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
            )}

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

            {/* Disponibilidad — pre-cargada con datos de la pyme, editable por oferta */}
            <DisponibilidadEditor
              pyme={pymeProfile}
              fechaEntrega={necesidad.fecha_limite_entrega}
              localOverride={localOverride}
              setLocalOverride={setLocalOverride}
              envioOverride={envioOverride}
              setEnvioOverride={setEnvioOverride}
              horariosOverride={horariosOverride}
              setHorariosOverride={setHorariosOverride}
              notas={notasDisponibilidad}
              setNotas={setNotasDisponibilidad}
            />

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
  const pymeProfileQ = usePymeProfile();

  const isPyme = profile?.role === 'pyme';
  const userId = profile?.id ?? '';
  const pymePerfilIncompleto = isPyme && !pymeProfileQ.isLoading && !pymeProfileQ.data;

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
            onClick={() => {
              void navigate(
                isPyme ? '/feed' : grupoId ? `/grupos/${grupoId}` : '/grupos',
              );
            }}
            className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
          >
            {isPyme ? '← Volver al feed' : '← Volver al grupo'}
          </button>
        </div>
      </Shell>
    );
  }

  // Pyme sin perfil de pyme cargado: bloquear acceso al detalle.
  if (pymePerfilIncompleto) {
    return (
      <Shell>
        <div className="space-y-4 anim-in max-w-md">
          <h1 className="font-display font-extrabold text-2xl">
            Completá tu perfil de pyme
          </h1>
          <div className="bg-sun/30 border-[1.5px] border-ink rounded-2xl p-4 space-y-2">
            <p className="text-sm">
              Para ver y ofertar en pedidos de las familias necesitás
              completar tu perfil de pyme.
            </p>
            <p className="text-[11px] text-ink/65">
              Es un paso rápido: cargás los datos del negocio, las zonas
              donde operás y tu contacto.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void navigate('/pyme/onboarding'); }}
              className="btn-pop bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs px-4 py-3 flex-1"
            >
              Completar perfil →
            </button>
            <button
              type="button"
              onClick={() => { void navigate('/feed'); }}
              className="btn-pop bg-white text-ink font-extrabold rounded-xl border-[1.5px] border-ink uppercase tracking-wider text-xs px-4 py-3"
            >
              Volver
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const n = necesidadQ.data;
  const ofertas = ofertasQ.data ?? [];
  const inscripciones = inscripcionesQ.data ?? [];
  const misVotos = misVotosQ.data ?? {};

  const cerradaInscripcion =
    Boolean(n.inscripcion_cerrada_at) || Boolean(progreso.data?.inscripcion_cerrada_at);
  const estadoPermiteInscripcion =
    n.estado === 'recibiendo_ofertas' || n.estado === 'en_votacion';
  const puedeAnotar = !cerradaInscripcion && estadoPermiteInscripcion;
  const subtituloInscripcion = cerradaInscripcion
    ? 'Las inscripciones están cerradas. La cantidad final quedó firme.'
    : !estadoPermiteInscripcion
      ? `En esta etapa (${estadoLabel(n.estado)}) no se pueden anotar ni quitar participantes.`
      : `Cada alumno anotado suma ${n.cantidad_por_alumno ?? 1} unidad${
          Number(n.cantidad_por_alumno) === 1 ? '' : 'es'
        } al total del pedido.`;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="space-y-5 anim-in">
        {/* Volver */}
        <Link
          to={isPyme ? '/feed' : grupoId ? `/grupos/${grupoId}` : '/grupos'}
          className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
        >
          {isPyme ? '← Volver al feed' : '← Volver al grupo'}
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
            puedeAnotar={puedeAnotar}
            subtituloInscripcion={subtituloInscripcion}
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
          <>
            <PanelOfertasFamilia
              necesidad={n}
              ofertas={ofertas}
              misAlumnos={misAlumnos}
              misVotos={misVotos}
              inscripciones={inscripciones}
              esAdmin={esAdmin}
            />

            <PanelCobranzas
              necesidad={n}
              ofertas={ofertas}
              alumnosDelGrupo={alumnosQ.data ?? []}
              inscripciones={inscripciones}
              userId={userId}
              esAdmin={esAdmin}
            />
          </>
        )}
      </div>
    </Shell>
  );
}

// ─── VariantesGallery (display, lo ven familia y pyme) ──────────────────────

function VariantesGallery({ variantes }: { variantes: OfertaVariante[] }) {
  // Agrupar por item_ref. Si no tiene item_ref, va en su propio "slot".
  const slots = new Map<string, OfertaVariante[]>();
  variantes.forEach((v, idx) => {
    const key = (v.item_ref ?? '').trim() || `__solo_${idx}`;
    const lista = slots.get(key) ?? [];
    lista.push(v);
    slots.set(key, lista);
  });

  return (
    <div className="rounded-2xl border-[1.5px] border-ink/15 bg-cream/40 p-3 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
        Variantes de la oferta
      </div>
      {Array.from(slots.entries()).map(([slotKey, lista]) => {
        const itemRef = slotKey.startsWith('__solo_') ? null : slotKey;
        const esAlternativa = lista.length > 1;
        return (
          <div key={slotKey} className="space-y-1.5">
            {itemRef && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-coral">
                  Para: {itemRef}
                </span>
                {esAlternativa && (
                  <span className="text-[10px] text-ink/55 italic">
                    (elegí una)
                  </span>
                )}
              </div>
            )}
            <ul className="space-y-2">
              {lista.map((v, i) => (
                <li key={i} className="flex items-center gap-3">
                  {v.foto_url ? (
                    <img
                      src={v.foto_url}
                      alt={v.nombre}
                      className="w-12 h-12 rounded-lg object-cover border-[1.5px] border-ink/20 shrink-0"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-mist/40 border-[1.5px] border-ink/10 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-sm">{v.nombre}</span>
                      {v.link_url && (
                        <a
                          href={v.link_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[11px] text-coral hover:underline shrink-0"
                          title="Ver link"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    {v.descripcion && (
                      <div className="text-[11px] text-ink/65 mt-0.5 leading-snug">
                        {v.descripcion}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sm">
                      {fmtMoney(v.precio_centavos)}
                    </div>
                    {(v.cantidad ?? 1) > 1 && (
                      <div className="text-[10px] text-ink/55 font-mono">
                        × {v.cantidad}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── ItemsDelPedido (atajos para cotizar items de la composición) ────────────

function ItemsDelPedido({
  composicion,
  variantes,
  modalidad,
  inscriptos,
  onCotizarItem,
}: {
  composicion: ComposicionItem[];
  variantes: VarianteRow[];
  modalidad: NecesidadModalidad;
  inscriptos: number;
  onCotizarItem: (nombre: string, totalItem: number) => void;
}) {
  const cuentaPorItem = (nombreItem: string) =>
    variantes.filter(
      (v) =>
        v.item_ref.trim().toLowerCase() === nombreItem.trim().toLowerCase(),
    ).length;

  const totalDe = (cantidadPorAlumno: number) =>
    modalidad === 'individual' ? cantidadPorAlumno * Math.max(inscriptos, 0) : cantidadPorAlumno;

  return (
    <div className="rounded-2xl border-[1.5px] border-ink/15 bg-mist/30 p-3 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
        Items del pedido — cotizá cada uno
      </div>
      <ul className="space-y-1.5">
        {composicion.map((it, i) => {
          const cotizado = cuentaPorItem(it.nombre);
          const total = totalDe(it.cantidad);
          return (
            <li
              key={i}
              className="flex items-center gap-2 bg-white rounded-lg border border-ink/10 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{it.nombre}</div>
                <div className="text-[11px] text-ink/65 font-mono">
                  <span className="font-bold">{total}</span> {total === 1 ? 'unidad' : 'unidades'}
                  {modalidad === 'individual' && (
                    <span className="text-ink/45 font-sans">
                      {' '}({it.cantidad} × {inscriptos} alumno{inscriptos === 1 ? '' : 's'})
                    </span>
                  )}
                </div>
              </div>
              {cotizado > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-sage shrink-0">
                  ✓ {cotizado} cotizada{cotizado === 1 ? '' : 's'}
                </span>
              )}
              <button
                type="button"
                onClick={() => { onCotizarItem(it.nombre, total); }}
                disabled={total === 0}
                className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-coral text-white hover:bg-coral/85 transition-colors disabled:opacity-40"
              >
                + Cotizar
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-ink/55 italic">
        Tocá &ldquo;+ Cotizar&rdquo; para ofrecer una variante para ese item. La cantidad ya viene precargada con el total del pedido. Podés cargar varias para el mismo item (distintas marcas/modelos).
      </p>
    </div>
  );
}

// ─── VariantesEditor ──────────────────────────────────────────────────────────

interface VarianteRow {
  nombre: string;
  precio: string;
  cantidad: string;
  item_ref: string;       // nombre del item de la necesidad al que pertenece
  descripcion: string;
  foto_url: string;       // URL pública post-upload
  foto_uploading: boolean;
  link_url: string;
}

function emptyVariante(): VarianteRow {
  return {
    nombre: '',
    precio: '',
    cantidad: '1',
    item_ref: '',
    descripcion: '',
    foto_url: '',
    foto_uploading: false,
    link_url: '',
  };
}

function VariantesEditor({
  items,
  onChange,
  onUploadingChange,
  pyomeId,
  necesidadId,
}: {
  items: VarianteRow[];
  onChange: (next: VarianteRow[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  pyomeId: string;
  necesidadId: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  // Cuando crece el array desde afuera (ej. ItemsDelPedido → "+ Cotizar"),
  // auto-expandir la nueva variante para que la pyme vea precio/foto al toque.
  const prevLen = useRef(items.length);
  useEffect(() => {
    if (items.length > prevLen.current) {
      setExpanded(items.length - 1);
    }
    prevLen.current = items.length;
  }, [items.length]);

  const update = (i: number, patch: Partial<VarianteRow>) => {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const remove = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    if (expanded === i) setExpanded(null);
  };
  const add = () => {
    if (items.length >= 10) return;
    onChange([...items, emptyVariante()]);
  };

  const handleFotoUpload = async (i: number, file: File) => {
    update(i, { foto_uploading: true });
    onUploadingChange(true);
    try {
      // Path convention: el segundo segmento debe ser auth.uid() para pasar
      // la RLS del bucket "necesidad-fotos" (ver 007_necesidad_foto_y_campos).
      // Ponemos pymeId primero, luego necesidadId, dentro del namespace "ofertas".
      const url = await uploadFotoToStorage(file, `ofertas/${pyomeId}/${necesidadId}`);
      update(i, { foto_url: url, foto_uploading: false });
    } catch (e) {
      update(i, { foto_uploading: false });
      alert(parseError(e));
    } finally {
      // Determinar si quedan otras subiendo
      const stillUploading = items.some((it, idx) => idx !== i && it.foto_uploading);
      onUploadingChange(stillUploading);
    }
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-dashed border-ink/30 text-xs font-bold uppercase tracking-wider text-ink/55 hover:border-ink hover:text-ink transition"
        >
          + Agregar variante
        </button>
      ) : (
        <>
          {items.map((it, i) => {
            const isOpen = expanded === i;
            const hasExtras =
              it.descripcion.trim().length > 0 ||
              it.foto_url.length > 0 ||
              it.link_url.trim().length > 0 ||
              it.foto_uploading;
            const cantidadNum = Number(it.cantidad) || 1;
            const precioNum = Number(it.precio) || 0;
            const totalCalc = precioNum * cantidadNum;
            return (
              <div
                key={i}
                className="rounded-xl border-[1.5px] border-ink/20 bg-white/60 p-3 space-y-2"
              >
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    {it.item_ref && (
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-coral/85 mb-0.5">
                        Para: {it.item_ref}
                      </span>
                    )}
                    <input
                      type="text"
                      placeholder="Ej: Faber Castell HB"
                      value={it.nombre}
                      onChange={(e) => { update(i, { nombre: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/30 text-sm focus:outline-none focus:border-ink"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setExpanded(isOpen ? null : i); }}
                    className={`px-2 py-2 text-lg ${
                      hasExtras ? 'text-sage' : 'text-ink/40'
                    } hover:text-ink`}
                    aria-label="Detalles"
                    title={hasExtras ? 'Tiene foto/descripcion/link' : 'Agregar foto, descripción o link'}
                  >
                    📎
                  </button>
                  <button
                    type="button"
                    onClick={() => { remove(i); }}
                    className="px-2 py-2 text-ink/40 hover:text-coral text-lg"
                    aria-label="Quitar variante"
                  >
                    ✕
                  </button>
                </div>

                {/* Precio unitario + Total (bidireccional) */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/55 mb-1">
                      Precio /unidad ($)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={it.precio}
                      onChange={(e) => { update(i, { precio: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/30 text-sm font-mono text-right focus:outline-none focus:border-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/55 mb-1">
                      Total ({cantidadNum} u)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={precioNum > 0 ? totalCalc.toString() : ''}
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        if (cantidadNum > 0 && Number.isFinite(t)) {
                          // Round a 2 decimales para evitar deriva en floats
                          const nuevoUnit = Math.round((t / cantidadNum) * 100) / 100;
                          update(i, { precio: String(nuevoUnit) });
                        } else {
                          update(i, { precio: '' });
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-coral/40 text-sm font-mono text-right focus:outline-none focus:border-coral bg-coral/5"
                    />
                  </label>
                </div>

                {isOpen && (
                  <div className="grid gap-2 px-1 pb-1">
                    <label className="block">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/55 mb-1">
                        Cantidad
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) => { update(i, { cantidad: e.target.value }); }}
                        className="w-20 px-2 py-1 rounded-lg border-[1.5px] border-ink/20 text-xs font-mono text-center"
                      />
                    </label>
                    <textarea
                      placeholder="Descripción del producto (marca, calidad...) — opcional"
                      rows={2}
                      maxLength={400}
                      value={it.descripcion}
                      onChange={(e) => { update(i, { descripcion: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/20 text-xs focus:outline-none focus:border-ink resize-none"
                    />
                    <input
                      type="url"
                      placeholder="Link de referencia (ej: ML, fabricante) — opcional"
                      value={it.link_url}
                      onChange={(e) => { update(i, { link_url: e.target.value }); }}
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/20 text-xs focus:outline-none focus:border-ink"
                    />
                    {/* Foto del producto */}
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/55 mb-1">
                        Foto del producto
                      </span>
                      {it.foto_url ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={it.foto_url}
                            alt={it.nombre}
                            className="w-16 h-16 rounded-lg object-cover border-[1.5px] border-ink/20"
                          />
                          <button
                            type="button"
                            onClick={() => { update(i, { foto_url: '' }); }}
                            className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
                          >
                            Quitar foto
                          </button>
                        </div>
                      ) : it.foto_uploading ? (
                        <div className="text-[11px] text-ink/55 italic">Subiendo…</div>
                      ) : (
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-[1.5px] border-dashed border-ink/30 text-xs font-bold cursor-pointer hover:border-ink hover:bg-cream transition">
                          <span>+ Subir foto</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleFotoUpload(i, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {items.length < 10 && (
            <button
              type="button"
              onClick={add}
              className="text-[11px] font-bold uppercase tracking-wider text-coral hover:underline"
            >
              + Agregar otra variante
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── DisponibilidadEditor (form de oferta) ────────────────────────────────────

const DIAS_KEYS: DiaSemana[] = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

function diaDeFecha(iso: string | null): DiaSemana | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return DIAS_KEYS[d.getDay()] ?? null;
}

function fmtFechaDia(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'short',
  });
}

function rangosIguales(a: RangoHorario[], b: RangoHorario[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => r.desde === b[i]?.desde && r.hasta === b[i]?.hasta);
}

function DisponibilidadEditor({
  pyme,
  fechaEntrega,
  localOverride,
  setLocalOverride,
  envioOverride,
  setEnvioOverride,
  horariosOverride,
  setHorariosOverride,
  notas,
  setNotas,
}: {
  pyme: PymeRow | null | undefined;
  fechaEntrega: string | null;
  localOverride: boolean | null;
  setLocalOverride: (v: boolean | null) => void;
  envioOverride: boolean | null;
  setEnvioOverride: (v: boolean | null) => void;
  horariosOverride: RangoHorario[] | null;
  setHorariosOverride: (v: RangoHorario[] | null) => void;
  notas: string;
  setNotas: (v: string) => void;
}) {
  const localPyme = pyme?.local_a_la_calle ?? false;
  const envioPyme = pyme?.hace_envios ?? false;
  const dia = diaDeFecha(fechaEntrega);
  const horariosPyme = (dia && pyme?.horarios?.[dia]?.rangos) ?? [];

  const localEf = localOverride ?? localPyme;
  const envioEf = envioOverride ?? envioPyme;
  const horariosEf = horariosOverride ?? horariosPyme;
  const cerradoEseDia = horariosEf.length === 0;

  // Toggles que setean override solo si difiere de la config pyme
  const onChangeLocal = (v: boolean) => {
    setLocalOverride(v === localPyme ? null : v);
  };
  const onChangeEnvio = (v: boolean) => {
    setEnvioOverride(v === envioPyme ? null : v);
  };
  const onToggleCerrado = (cerrado: boolean) => {
    if (cerrado) {
      setHorariosOverride([]);
    } else {
      // Volver a horarios pyme (clear override) o un default si pyme no tiene
      if (horariosPyme.length > 0) {
        setHorariosOverride(null);
      } else {
        setHorariosOverride([{ desde: '10:00', hasta: '18:00' }]);
      }
    }
  };
  const updateRango = (i: number, patch: Partial<RangoHorario>) => {
    const base = horariosOverride ?? horariosPyme;
    const next = base.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setHorariosOverride(rangosIguales(next, horariosPyme) ? null : next);
  };
  const removeRango = (i: number) => {
    const base = horariosOverride ?? horariosPyme;
    const next = base.filter((_, idx) => idx !== i);
    setHorariosOverride(rangosIguales(next, horariosPyme) ? null : next);
  };
  const addRango = () => {
    const base = horariosOverride ?? horariosPyme;
    if (base.length >= 4) return;
    const next = [...base, { desde: '14:00', hasta: '20:00' }];
    setHorariosOverride(rangosIguales(next, horariosPyme) ? null : next);
  };

  const hayOverride =
    localOverride !== null || envioOverride !== null || horariosOverride !== null;

  return (
    <div className="rounded-xl border-[1.5px] border-ink/15 bg-mist/20 p-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
          Disponibilidad para este pedido
        </div>
        {hayOverride && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-coral">
            ✏️ con cambios
          </span>
        )}
      </div>

      {!pyme && (
        <p className="text-[11px] text-ink/55 italic">
          Cargando datos de tu pyme…
        </p>
      )}

      {pyme && (
        <>
          {/* Local + envío */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer rounded-lg bg-white border border-ink/15 px-3 py-2">
              <input
                type="checkbox"
                checked={localEf}
                onChange={(e) => { onChangeLocal(e.target.checked); }}
                className="w-4 h-4 accent-ink"
              />
              <span className="text-xs font-bold">🏪 Retiro por local</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg bg-white border border-ink/15 px-3 py-2">
              <input
                type="checkbox"
                checked={envioEf}
                onChange={(e) => { onChangeEnvio(e.target.checked); }}
                className="w-4 h-4 accent-ink"
              />
              <span className="text-xs font-bold">📦 Hago envío</span>
            </label>
          </div>

          {/* Horarios del día de entrega */}
          {fechaEntrega && (
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
                  Horarios del {fmtFechaDia(fechaEntrega)}
                </span>
                <button
                  type="button"
                  onClick={() => { onToggleCerrado(!cerradoEseDia); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
                >
                  {cerradoEseDia ? '+ marcar abierto' : 'cerrado ese día'}
                </button>
              </div>
              {cerradoEseDia ? (
                <div className="text-[11px] text-ink/55 italic">
                  ⊘ Cerrado el día de entrega — la familia lo va a ver así.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {horariosEf.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={r.desde}
                        onChange={(e) => { updateRango(i, { desde: e.target.value }); }}
                        className="px-2 py-1 rounded-md border border-ink/30 text-xs font-mono"
                      />
                      <span className="text-ink/45 text-xs">–</span>
                      <input
                        type="time"
                        value={r.hasta}
                        onChange={(e) => { updateRango(i, { hasta: e.target.value }); }}
                        className="px-2 py-1 rounded-md border border-ink/30 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => { removeRango(i); }}
                        className="text-ink/40 hover:text-coral text-sm px-1"
                        aria-label="Quitar rango"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {horariosEf.length < 4 && (
                    <button
                      type="button"
                      onClick={addRango}
                      className="text-[10px] font-bold uppercase tracking-wider text-coral hover:underline"
                    >
                      + agregar rango
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">
              Aclaración (opcional)
            </span>
            <input
              type="text"
              maxLength={140}
              placeholder="Ej. cerrado mar 1 por feriado · sin envío esa semana"
              value={notas}
              onChange={(e) => { setNotas(e.target.value); }}
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-ink/20 text-xs focus:outline-none focus:border-ink"
            />
          </label>

          {hayOverride && (
            <p className="text-[10px] text-ink/55 italic">
              Estos datos se guardan solo para esta oferta y no afectan tu config general.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Iconos inline ────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
