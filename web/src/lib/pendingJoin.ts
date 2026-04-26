/**
 * Helpers para persistir el código de invitación de grupo entre sesiones.
 *
 * Flujo:
 * 1. Usuario llega a /unirse?c=ABC123 sin sesión.
 * 2. Se guarda el código en localStorage.
 * 3. Usuario inicia sesión (magic link o Google OAuth).
 * 4. `PendingJoinHandler` detecta el código guardado y ejecuta el join.
 */

const STORAGE_KEY = 'mapapis-next.pendingJoinCode';

export function setPendingJoinCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Silenciar errores de localStorage (ej. modo privado con storage lleno)
  }
}

export function getPendingJoinCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function clearPendingJoinCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
