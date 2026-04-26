/**
 * Formatea centavos (entero) a string ARS legible: "$1.234,56".
 * Para uso en UI; para cálculos siempre en centavos.
 */
export function fmtMoney(centavos: number | bigint): string {
  const n = Number(centavos) / 100;
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Valida que un DNI argentino tenga 7 u 8 dígitos numéricos.
 * No verifica que exista — solo formato.
 */
export function validarDni(dni: string): boolean {
  return /^\d{7,8}$/.test(dni);
}

/**
 * Normaliza DNI: remueve puntos, espacios, deja solo dígitos.
 */
export function normalizarDni(input: string): string {
  return input.replace(/\D/g, '');
}
