/**
 * Configuración de comisiones de la plataforma.
 *
 * Modelo "fee al pagador" (opción 2 elegida): la pyme cobra limpio el
 * precio que ofertó. MaPaPis suma su comisión sobre ese total. Las
 * familias inscriptas pagan (precio + comisión) / N inscriptos.
 *
 * La fee de Mercado Pago por procesar tarjeta NO la absorbe MaPaPis ni
 * la pyme — la cobra MP al pagador como recargo cuando elige tarjeta.
 * Si paga con saldo MP o CVU, no hay fee MP (transferencia interna).
 *
 * Cuando movamos esto a setting de DB para tunearlo sin redeploy, la
 * constante puede pasar a venir de un endpoint o env var.
 */

/** Comisión que MaPaPis cobra sobre el precio de la oferta de la pyme. */
export const COMMISSION_PCT = 0.05;

/** Centavos de comisión sobre un monto. Devuelve un entero (Math.round). */
export function comisionCentavos(precioCentavos: number): number {
  return Math.round(precioCentavos * COMMISSION_PCT);
}

/** Total que pagan las familias = precio de la oferta + comisión MaPaPis. */
export function totalConComisionCentavos(precioCentavos: number): number {
  return precioCentavos + comisionCentavos(precioCentavos);
}
