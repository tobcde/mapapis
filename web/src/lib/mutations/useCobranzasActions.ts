import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  cobranzasQueryKey,
  cobranzasResumenQueryKey,
} from '@/lib/queries/useCobranzas';
import { necesidadesByGrupoKey } from '@/lib/queries/useNecesidadesByGrupo';

/**
 * Mutaciones del flujo de cobranza P2P.
 *
 * Todas comparten la misma logica de invalidacion: cuando algo cambia,
 * recargamos la lista detallada + el resumen agregado de esa necesidad.
 *
 * Se exponen como 5 hooks separados para que cada componente pueda
 * disparar solo lo que necesita y manejar su propio loading/error state.
 */

interface NecesidadCtx {
  necesidadId: string;
  grupoId?: string;
}

function invalidateCobranzas(qc: QueryClient, ctx: NecesidadCtx): void {
  void qc.invalidateQueries({ queryKey: cobranzasQueryKey(ctx.necesidadId) });
  void qc.invalidateQueries({ queryKey: cobranzasResumenQueryKey(ctx.necesidadId) });
  if (ctx.grupoId) {
    void qc.invalidateQueries({ queryKey: necesidadesByGrupoKey(ctx.grupoId) });
  }
}

// ─── 1. Asignar cobrador (solo creador del grupo) ─────────────────────────

interface AsignarCobradorArgs extends NecesidadCtx {
  cobradorId: string;
  alias?: string | null;
}

export function useAsignarCobrador() {
  const qc = useQueryClient();
  return useMutation<void, Error, AsignarCobradorArgs>({
    mutationFn: async ({ necesidadId, cobradorId, alias }) => {
      const client = supabase as unknown as {
        rpc: (
          name: 'asignar_cobrador',
          args: { p_necesidad: string; p_cobrador: string; p_alias: string | null },
        ) => Promise<{ data: unknown; error: Error | null }>;
      };
      const aliasLimpio = alias?.trim() ?? '';
      const { error } = await client.rpc('asignar_cobrador', {
        p_necesidad: necesidadId,
        p_cobrador: cobradorId,
        p_alias: aliasLimpio.length > 0 ? aliasLimpio : null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, ctx) => { invalidateCobranzas(qc, ctx); },
  });
}

// ─── 2. Marcar transferido (tutor del alumno) ─────────────────────────────

interface MarcarTransferidoArgs extends NecesidadCtx {
  alumnoId: string;
  comprobantePath?: string | null;
}

export function useMarcarTransferido() {
  const qc = useQueryClient();
  return useMutation<void, Error, MarcarTransferidoArgs>({
    mutationFn: async ({ necesidadId, alumnoId, comprobantePath }) => {
      const client = supabase as unknown as {
        rpc: (
          name: 'marcar_transferido',
          args: {
            p_necesidad: string;
            p_alumno: string;
            p_comprobante_path: string | null;
          },
        ) => Promise<{ data: unknown; error: Error | null }>;
      };
      const { error } = await client.rpc('marcar_transferido', {
        p_necesidad: necesidadId,
        p_alumno: alumnoId,
        p_comprobante_path: comprobantePath ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, ctx) => { invalidateCobranzas(qc, ctx); },
  });
}

// ─── 3. Confirmar pago (cobrador) ─────────────────────────────────────────

interface ConfirmarPagoArgs extends NecesidadCtx {
  alumnoId: string;
}

export function useConfirmarPago() {
  const qc = useQueryClient();
  return useMutation<void, Error, ConfirmarPagoArgs>({
    mutationFn: async ({ necesidadId, alumnoId }) => {
      const client = supabase as unknown as {
        rpc: (
          name: 'confirmar_pago',
          args: { p_necesidad: string; p_alumno: string },
        ) => Promise<{ data: unknown; error: Error | null }>;
      };
      const { error } = await client.rpc('confirmar_pago', {
        p_necesidad: necesidadId,
        p_alumno: alumnoId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, ctx) => { invalidateCobranzas(qc, ctx); },
  });
}

// ─── 4. Revertir confirmacion (cobrador, undo) ────────────────────────────

interface RevertirArgs extends NecesidadCtx {
  alumnoId: string;
}

export function useRevertirConfirmacion() {
  const qc = useQueryClient();
  return useMutation<void, Error, RevertirArgs>({
    mutationFn: async ({ necesidadId, alumnoId }) => {
      const client = supabase as unknown as {
        rpc: (
          name: 'revertir_confirmacion',
          args: { p_necesidad: string; p_alumno: string },
        ) => Promise<{ data: unknown; error: Error | null }>;
      };
      const { error } = await client.rpc('revertir_confirmacion', {
        p_necesidad: necesidadId,
        p_alumno: alumnoId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, ctx) => { invalidateCobranzas(qc, ctx); },
  });
}

// ─── 5. Cerrar cobranza (cobrador, requiere 100%) ─────────────────────────

export function useCerrarCobranzaPyme() {
  const qc = useQueryClient();
  return useMutation<void, Error, NecesidadCtx>({
    mutationFn: async ({ necesidadId }) => {
      const client = supabase as unknown as {
        rpc: (
          name: 'cerrar_cobranza_pyme',
          args: { p_necesidad: string },
        ) => Promise<{ data: unknown; error: Error | null }>;
      };
      const { error } = await client.rpc('cerrar_cobranza_pyme', {
        p_necesidad: necesidadId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, ctx) => { invalidateCobranzas(qc, ctx); },
  });
}
