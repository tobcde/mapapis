import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { parseError } from '@/lib/parseError';
import { useQuery } from '@tanstack/react-query';
import { useDialog, useToast } from '@/components/ui';
import { useCobranzas, useCobranzasResumen } from '@/lib/queries/useCobranzas';
import {
  useCerrarCobranzaPyme,
  useConfirmarPago,
  useMarcarTransferido,
  useRevertirConfirmacion,
} from '@/lib/mutations/useCobranzasActions';
import {
  getComprobanteSignedUrl,
  uploadComprobante,
} from '@/lib/storage/uploadComprobante';
import { fmtMoney } from '@/utils/fmt';
import type { CobranzaResumenRow, CobranzaRow } from '@/lib/types/cobranza';
import type { AlumnoConTutores } from '@/lib/queries/useAlumnosByGrupo';
import type {
  NecesidadRow,
  OfertaRow,
  NecesidadInscripcionRow,
} from '@/lib/database.types';
import { AsignarCobradorDialog } from './AsignarCobradorDialog';

interface Props {
  necesidad: NecesidadRow;
  ofertas: OfertaRow[];
  alumnosDelGrupo: AlumnoConTutores[];
  inscripciones: NecesidadInscripcionRow[];
  userId: string;
  esAdmin: boolean;
}

/**
 * Panel de cobranza P2P. Aparece bajo el panel de ofertas cuando la
 * necesidad esta adjudicada. Tiene 4 estados visuales:
 *
 *   1. Sin cobrador + soy creador  -> CTA "Asignar cobrador".
 *   2. Sin cobrador + no creador   -> cartel "Esperando que el creador asigne cobrador".
 *   3. Con cobrador + soy cobrador -> vista cobrador (lista para confirmar + CTA cerrar).
 *   4. Con cobrador + tutor pagador -> vista pagador (Tu parte + grupo).
 *   5. Con cobrador + observador   -> vista grupo (sin Tu parte).
 *   6. Pagado a pyme               -> banner "Pagado a la pyme".
 *
 * Toda la logica de transicion vive aca; los componentes hijos solo
 * renderizan su slice.
 */
export function PanelCobranzas({
  necesidad,
  ofertas,
  alumnosDelGrupo,
  inscripciones,
  userId,
  esAdmin,
}: Props) {
  const adjudicada =
    necesidad.estado === 'adjudicada'
    || ofertas.some((o) => o.estado === 'ganadora');

  const ofertaGanadora = ofertas.find((o) => o.estado === 'ganadora') ?? null;

  const resumenQ = useCobranzasResumen(necesidad.id);
  const cobranzasQ = useCobranzas(necesidad.id);

  const cobrador = resumenQ.data;
  const cobranzas = cobranzasQ.data ?? [];

  const soyCobrador = cobrador?.cobrador_id === userId;
  const cerrado = Boolean(cobrador?.pago_pyme_completado_at);

  const alumnosElegibles = useMemo(() => {
    if (necesidad.modalidad === 'individual') {
      const ids = new Set(inscripciones.map((i) => i.alumno_id));
      return alumnosDelGrupo.filter((a) => ids.has(a.id));
    }
    return alumnosDelGrupo;
  }, [necesidad.modalidad, inscripciones, alumnosDelGrupo]);

  if (!adjudicada) return null;

  if (resumenQ.isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl">Cobranza</h2>
        <div className="h-24 bg-white/60 rounded-2xl border-[1.5px] border-ink/10 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-xl">Cobranza</h2>

      {!cobrador ? (
        <SinCobrador
          necesidad={necesidad}
          ofertaGanadora={ofertaGanadora}
          alumnosElegibles={alumnosElegibles.length}
          esAdmin={esAdmin}
        />
      ) : (
        <>
          <HeaderCobrador resumen={cobrador} cerrado={cerrado} />

          {!cerrado && (
            <CuerpoCobranza
              cobranzas={cobranzas}
              alumnos={alumnosDelGrupo}
              userId={userId}
              soyCobrador={soyCobrador}
              necesidadId={necesidad.id}
              grupoId={necesidad.grupo_id}
            />
          )}

          {soyCobrador && !cerrado && (
            <CierreCobranzaCobrador
              resumen={cobrador}
              necesidadId={necesidad.id}
              grupoId={necesidad.grupo_id}
            />
          )}

          {/* Disclaimer legal */}
          {!cerrado && (
            <p className="text-[11px] text-ink/45 leading-snug px-1">
              mapapis no participa de la transferencia entre familias y cobrador.
              Si hay un problema, arréglenlo con su grupo.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ─── Estado 1: sin cobrador asignado ─────────────────────────────────────────

function SinCobrador({
  necesidad,
  ofertaGanadora,
  alumnosElegibles,
  esAdmin,
}: {
  necesidad: NecesidadRow;
  ofertaGanadora: OfertaRow | null;
  alumnosElegibles: number;
  esAdmin: boolean;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const { showToast } = useToast();
  const { showAlert } = useDialog();

  const totalCentavos = ofertaGanadora?.precio_total_centavos ?? 0;

  if (!esAdmin) {
    return (
      <div className="bg-mist/50 rounded-3xl p-5 text-center text-sm text-ink/70 border-[1.5px] border-ink/10">
        Esperando que el creador del grupo asigne cobrador.
      </div>
    );
  }

  if (!ofertaGanadora) {
    return (
      <div className="bg-mist/50 rounded-3xl p-5 text-center text-sm text-ink/70 border-[1.5px] border-ink/10">
        Adjudicá una oferta primero para poder asignar cobrador.
      </div>
    );
  }

  if (alumnosElegibles === 0) {
    return (
      <div className="bg-coral/10 rounded-3xl p-5 text-sm text-ink border-[1.5px] border-coral/40">
        No hay alumnos elegibles para esta cobranza
        {necesidad.modalidad === 'individual'
          ? ' (nadie se inscribió). '
          : ' (el grupo no tiene alumnos cargados). '}
        No se puede asignar cobrador.
      </div>
    );
  }

  return (
    <>
      <div className="bg-cream rounded-3xl border-[1.5px] border-ink p-5 shadow-pop">
        <p className="font-display font-extrabold text-base text-ink mb-1">
          Asigná un cobrador para arrancar
        </p>
        <p className="text-sm text-ink/65 mb-4">
          Va a recibir las transferencias del grupo y después le paga a la pyme.
        </p>
        <button
          type="button"
          onClick={() => { setShowDialog(true); }}
          className="w-full py-3 rounded-xl border-[1.5px] border-ink font-extrabold text-sm uppercase tracking-wide btn-pop bg-ink text-cream"
        >
          Elegir cobrador
        </button>
      </div>

      {showDialog && (
        <AsignarCobradorDialog
          necesidadId={necesidad.id}
          grupoId={necesidad.grupo_id}
          totalCobranzaCentavos={totalCentavos}
          alumnosElegibles={alumnosElegibles}
          onClose={() => { setShowDialog(false); }}
          onSuccess={() => {
            setShowDialog(false);
            showToast('Cobrador asignado', 'success');
          }}
          onError={(msg) => { void showAlert(msg); }}
        />
      )}
    </>
  );
}

// ─── Header con cobrador + alias copiable + barra de progreso ───────────────

function HeaderCobrador({
  resumen,
  cerrado,
}: {
  resumen: CobranzaResumenRow;
  cerrado: boolean;
}) {
  const { showToast } = useToast();
  const total = Math.max(resumen.total, 1);
  const pct = Math.round((resumen.confirmadas / total) * 100);
  const completo = resumen.confirmadas === resumen.total && resumen.total > 0;

  const copiarAlias = async () => {
    try {
      await navigator.clipboard.writeText(resumen.cobrador_alias_snapshot);
      showToast('¡Alias copiado!', 'success');
    } catch {
      showToast('No se pudo copiar', 'error');
    }
  };

  if (cerrado) {
    return (
      <div className="bg-emerald-50 rounded-3xl border-[1.5px] border-emerald-600 p-4">
        <p className="font-display font-extrabold text-sm text-emerald-900 uppercase tracking-wider mb-1">
          ✓ Pagado a la pyme
        </p>
        <p className="text-sm text-emerald-900/80">
          {resumen.cobrador_nombre ?? 'El cobrador'} ya completó el pago.
          Total: {fmtMoney(resumen.total_recolectado_centavos)}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-cream rounded-3xl border-[1.5px] border-ink p-4 shadow-pop">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-sun flex items-center justify-center shrink-0">
          <span className="text-base font-extrabold text-ink">
            {(resumen.cobrador_nombre ?? '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold text-ink/55">
            Cobrador
          </p>
          <p className="font-display font-extrabold text-base text-ink truncate">
            {resumen.cobrador_nombre ?? 'Sin nombre'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { void copiarAlias(); }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-[1.5px] border-ink/20 bg-white hover:border-ink/50 transition-colors"
      >
        <span className="font-mono text-sm text-ink truncate">
          {resumen.cobrador_alias_snapshot}
        </span>
        <CopyIcon className="w-4 h-4 text-ink/60 shrink-0" />
      </button>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-bold text-ink/70">
            {resumen.confirmadas} de {resumen.total} familias pagaron
          </span>
          <span className="font-mono font-bold text-ink">
            {fmtMoney(resumen.total_recolectado_centavos)} /{' '}
            {fmtMoney(resumen.total_esperado_centavos)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-mist overflow-hidden border border-ink/10">
          <div
            className={`h-full transition-all duration-500 ${
              completo ? 'bg-emerald-500' : 'bg-coral'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Cuerpo de cobranza: split en 'Tu parte' (pagador) + lista del grupo ────

function CuerpoCobranza({
  cobranzas,
  alumnos,
  userId,
  soyCobrador,
  necesidadId,
  grupoId,
}: {
  cobranzas: CobranzaRow[];
  alumnos: AlumnoConTutores[];
  userId: string;
  soyCobrador: boolean;
  necesidadId: string;
  grupoId: string;
}) {
  // Mapa id -> alumno para no recorrer en cada render
  const alumnosById = useMemo(
    () => new Map(alumnos.map((a) => [a.id, a])),
    [alumnos],
  );

  // Mis cobranzas pendientes (las de alumnos donde soy tutor y NO estoy
  // como cobrador autoconfirmado).
  const misCobranzas = useMemo(
    () =>
      cobranzas.filter((c) => {
        const alumno = alumnosById.get(c.alumno_id);
        if (!alumno) return false;
        return alumno.alumno_tutores.some((t) => t.profile_id === userId);
      }),
    [cobranzas, alumnosById, userId],
  );

  return (
    <div className="space-y-3">
      {/* Vista pagador: Tu parte (una card por alumno mio elegible) */}
      {misCobranzas.length > 0 && (
        <div className="space-y-2">
          {misCobranzas.map((c) => (
            <TuParteCard
              key={c.alumno_id}
              cobranza={c}
              alumno={alumnosById.get(c.alumno_id)!}
              necesidadId={necesidadId}
              grupoId={grupoId}
            />
          ))}
        </div>
      )}

      {/* Lista del grupo: todas las cobranzas con su estado */}
      <ListaCobranzas
        cobranzas={cobranzas}
        alumnosById={alumnosById}
        soyCobrador={soyCobrador}
        necesidadId={necesidadId}
        grupoId={grupoId}
      />
    </div>
  );
}

// ─── Card "Tu parte" (vista pagador) ─────────────────────────────────────────

function TuParteCard({
  cobranza,
  alumno,
  necesidadId,
  grupoId,
}: {
  cobranza: CobranzaRow;
  alumno: AlumnoConTutores;
  necesidadId: string;
  grupoId: string;
}) {
  const marcar = useMarcarTransferido();
  const { showAlert } = useDialog();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [comprobantePath, setComprobantePath] = useState<string | null>(
    cobranza.comprobante_path,
  );

  const handleSubirComprobante = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadComprobante(file, necesidadId, alumno.id);
      setComprobantePath(path);
      showToast('Comprobante subido', 'success');
    } catch (err) {
      await showAlert(
        parseError(err),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleSubirComprobante(file);
  };

  const handleMarcarTransferido = async () => {
    try {
      await marcar.mutateAsync({
        necesidadId,
        grupoId,
        alumnoId: alumno.id,
        comprobantePath,
      });
      showToast('Marcado como transferido', 'success');
    } catch (err) {
      await showAlert(
        parseError(err),
      );
    }
  };

  if (cobranza.estado === 'confirmado') {
    return (
      <div className="bg-emerald-50 rounded-2xl border-[1.5px] border-emerald-600 p-4">
        <div className="flex items-center gap-2 mb-1">
          <CheckIcon className="w-4 h-4 text-emerald-700" />
          <p className="font-display font-extrabold text-sm text-emerald-900">
            {alumno.nombre} · {fmtMoney(cobranza.monto_centavos)}
          </p>
        </div>
        <p className="text-xs text-emerald-900/70">
          Pagado y confirmado por el cobrador.
        </p>
      </div>
    );
  }

  if (cobranza.estado === 'transferido') {
    return (
      <div className="bg-sun/30 rounded-2xl border-[1.5px] border-ink p-4">
        <p className="font-display font-extrabold text-sm text-ink mb-1">
          {alumno.nombre} · {fmtMoney(cobranza.monto_centavos)}
        </p>
        <p className="text-xs text-ink/70">
          Esperando que el cobrador confirme que recibió la plata.
        </p>
        {comprobantePath && (
          <p className="text-[11px] text-ink/55 mt-1.5">
            ✓ Comprobante adjunto
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-cream rounded-2xl border-[1.5px] border-ink p-4 shadow-pop">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-coral">
            Tu parte
          </p>
          <p className="font-display font-extrabold text-base text-ink">
            {alumno.nombre}
          </p>
        </div>
        <p className="font-mono font-extrabold text-lg text-ink">
          {fmtMoney(cobranza.monto_centavos)}
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { void handleMarcarTransferido(); }}
          disabled={marcar.isPending || uploading}
          className="w-full py-2.5 rounded-xl border-[1.5px] border-ink font-extrabold text-xs uppercase tracking-wide btn-pop bg-ink text-cream disabled:opacity-50"
        >
          {marcar.isPending ? 'Marcando…' : 'Ya transferí'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || marcar.isPending}
          className="w-full py-2 rounded-xl border-[1.5px] border-ink/30 font-bold text-[11px] uppercase tracking-wider bg-white text-ink/70 hover:border-ink/60 disabled:opacity-50"
        >
          {uploading
            ? 'Subiendo…'
            : comprobantePath
              ? '✓ Comprobante adjunto · cambiar'
              : 'Adjuntar comprobante (opcional)'}
        </button>
      </div>
    </div>
  );
}

// ─── Lista del grupo: todas las cobranzas con estado + acciones cobrador ────

function ListaCobranzas({
  cobranzas,
  alumnosById,
  soyCobrador,
  necesidadId,
  grupoId,
}: {
  cobranzas: CobranzaRow[];
  alumnosById: Map<string, AlumnoConTutores>;
  soyCobrador: boolean;
  necesidadId: string;
  grupoId: string;
}) {
  const ordenadas = useMemo(() => {
    const orden: Record<CobranzaRow['estado'], number> = {
      transferido: 0,
      pendiente: 1,
      confirmado: 2,
    };
    return [...cobranzas].sort((a, b) => {
      const o = orden[a.estado] - orden[b.estado];
      if (o !== 0) return o;
      const an = alumnosById.get(a.alumno_id)?.nombre ?? '';
      const bn = alumnosById.get(b.alumno_id)?.nombre ?? '';
      return an.localeCompare(bn);
    });
  }, [cobranzas, alumnosById]);

  if (ordenadas.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-ink/15 overflow-hidden">
      <p className="text-[10px] uppercase tracking-wider font-bold text-ink/55 px-4 pt-3 pb-2">
        Estado del grupo
      </p>
      <ul className="divide-y divide-ink/10">
        {ordenadas.map((c) => (
          <FilaCobranza
            key={c.alumno_id}
            cobranza={c}
            alumno={alumnosById.get(c.alumno_id) ?? null}
            soyCobrador={soyCobrador}
            necesidadId={necesidadId}
            grupoId={grupoId}
          />
        ))}
      </ul>
    </div>
  );
}

function FilaCobranza({
  cobranza,
  alumno,
  soyCobrador,
  necesidadId,
  grupoId,
}: {
  cobranza: CobranzaRow;
  alumno: AlumnoConTutores | null;
  soyCobrador: boolean;
  necesidadId: string;
  grupoId: string;
}) {
  const confirmar = useConfirmarPago();
  const revertir = useRevertirConfirmacion();
  const { showAlert, showConfirm } = useDialog();
  const { showToast } = useToast();
  const [verComprobante, setVerComprobante] = useState(false);

  const nombre = alumno?.nombre ?? 'Alumno';
  const monto = fmtMoney(cobranza.monto_centavos);

  const handleConfirmar = async () => {
    try {
      await confirmar.mutateAsync({
        necesidadId,
        grupoId,
        alumnoId: cobranza.alumno_id,
      });
      showToast('Pago confirmado', 'success');
    } catch (err) {
      await showAlert(parseError(err));
    }
  };

  const handleRevertir = async () => {
    const ok = await showConfirm(
      `¿Revertir la confirmación de ${nombre}? Vuelve a "pendiente" y se borra el rastro de transferencia.`,
    );
    if (!ok) return;
    try {
      await revertir.mutateAsync({
        necesidadId,
        grupoId,
        alumnoId: cobranza.alumno_id,
      });
      showToast('Confirmación revertida', 'success');
    } catch (err) {
      await showAlert(parseError(err));
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <EstadoIcon estado={cobranza.estado} />
          <span className="text-sm font-bold text-ink truncate">{nombre}</span>
        </div>
        <span className="font-mono text-xs text-ink/70 shrink-0">{monto}</span>
      </div>

      {soyCobrador && cobranza.estado !== 'confirmado' && (
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => { void handleConfirmar(); }}
            disabled={confirmar.isPending}
            className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
          >
            ✓ Confirmar recibido
          </button>
          {cobranza.comprobante_path && (
            <button
              type="button"
              onClick={() => { setVerComprobante(true); }}
              className="text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
            >
              Ver comprobante
            </button>
          )}
        </div>
      )}

      {soyCobrador && cobranza.estado === 'confirmado' && (
        <button
          type="button"
          onClick={() => { void handleRevertir(); }}
          disabled={revertir.isPending}
          className="text-[11px] font-bold uppercase tracking-wider text-ink/40 hover:text-coral mt-1.5 disabled:opacity-50"
        >
          Revertir
        </button>
      )}

      {verComprobante && cobranza.comprobante_path && (
        <ComprobanteViewer
          path={cobranza.comprobante_path}
          onClose={() => { setVerComprobante(false); }}
        />
      )}
    </li>
  );
}

function EstadoIcon({ estado }: { estado: CobranzaRow['estado'] }) {
  if (estado === 'confirmado')
    return (
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-label="confirmado" />
    );
  if (estado === 'transferido')
    return (
      <span className="w-2 h-2 rounded-full bg-sun shrink-0" aria-label="transferido" />
    );
  return (
    <span className="w-2 h-2 rounded-full bg-ink/20 shrink-0" aria-label="pendiente" />
  );
}

// ─── Cierre cobranza: cobrador marca "ya pague a la pyme" ──────────────────

function CierreCobranzaCobrador({
  resumen,
  necesidadId,
  grupoId,
}: {
  resumen: CobranzaResumenRow;
  necesidadId: string;
  grupoId: string;
}) {
  const cerrar = useCerrarCobranzaPyme();
  const { showAlert, showConfirm } = useDialog();
  const { showToast } = useToast();

  const completo = resumen.confirmadas === resumen.total && resumen.total > 0;

  if (!completo) return null;

  const handleCerrar = async () => {
    const ok = await showConfirm(
      `Vas a marcar como pagado a la pyme.\n\nTotal recolectado: ${fmtMoney(
        resumen.total_recolectado_centavos,
      )}.\n\nDespués de esto las familias verán "Pagado" y no podés revertir.`,
    );
    if (!ok) return;
    try {
      await cerrar.mutateAsync({ necesidadId, grupoId });
      showToast('¡Listo! Marcado como pagado', 'success');
    } catch (err) {
      await showAlert(parseError(err));
    }
  };

  return (
    <div className="bg-emerald-50 rounded-3xl border-[1.5px] border-emerald-600 p-4">
      <p className="font-display font-extrabold text-sm text-emerald-900 mb-1">
        🎉 ¡Recolectaste todo!
      </p>
      <p className="text-sm text-emerald-900/80 mb-3">
        Total: {fmtMoney(resumen.total_recolectado_centavos)}. Cuando hagas
        la transferencia a la pyme, marcalo acá.
      </p>
      <button
        type="button"
        onClick={() => { void handleCerrar(); }}
        disabled={cerrar.isPending}
        className="w-full py-3 rounded-xl border-[1.5px] border-emerald-700 font-extrabold text-sm uppercase tracking-wide btn-pop bg-emerald-600 text-white disabled:opacity-50"
      >
        {cerrar.isPending ? 'Cerrando…' : 'Marcar como pagado a la pyme'}
      </button>
    </div>
  );
}

// ─── Comprobante viewer: signed URL en lightbox ────────────────────────────

function ComprobanteViewer({ path, onClose }: { path: string; onClose: () => void }) {
  const urlQ = useQuerySignedUrl(path);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8 bg-ink/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-full overflow-auto bg-white rounded-2xl"
        onClick={(e) => { e.stopPropagation(); }}
      >
        {urlQ.isLoading && (
          <div className="p-8 text-center text-sm text-ink/60">Cargando…</div>
        )}
        {urlQ.error && (
          <div className="p-8 text-center text-sm text-coral">
            No se pudo cargar el comprobante.
          </div>
        )}
        {urlQ.data && (
          <img
            src={urlQ.data}
            alt="Comprobante de transferencia"
            className="w-full h-auto"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white text-ink flex items-center justify-center font-bold border-[1.5px] border-ink"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function useQuerySignedUrl(path: string) {
  return useQuery<string>({
    queryKey: ['comprobante-url', path],
    queryFn: () => getComprobanteSignedUrl(path),
    staleTime: 60_000,
  });
}

// ─── Iconos ─────────────────────────────────────────────────────────────────

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
