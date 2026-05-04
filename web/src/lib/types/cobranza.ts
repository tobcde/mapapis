/**
 * Tipos del flujo de cobranza P2P.
 *
 * Estos no estan en `database.types.ts` todavia (las migraciones 042-044
 * son nuevas). Cuando se regenere con `npm run types:gen` van a aparecer
 * y se pueden importar directo. Mientras tanto los definimos aca para no
 * romper typecheck.
 */

export type CobranzaEstado = 'pendiente' | 'transferido' | 'confirmado';

export interface CobranzaRow {
  necesidad_id: string;
  alumno_id: string;
  monto_centavos: number;
  estado: CobranzaEstado;
  comprobante_path: string | null;
  marcado_transferido_por: string | null;
  marcado_transferido_at: string | null;
  confirmado_por: string | null;
  confirmado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CobranzaResumenRow {
  necesidad_id: string;
  cobrador_id: string;
  cobrador_alias_snapshot: string;
  cobrador_asignado_at: string;
  pago_pyme_completado_at: string | null;
  cobrador_nombre: string | null;
  total: number;
  confirmadas: number;
  transferidas: number;
  pendientes: number;
  total_esperado_centavos: number;
  total_recolectado_centavos: number;
}
