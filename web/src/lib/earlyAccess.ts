/**
 * Gate de "early access" mientras la web está en construcción.
 *
 * - Visitar la app con `?acceso=mapapis` setea un flag en localStorage y
 *   deja entrar.
 * - Una vez seteado, la flag persiste (no hace falta volver a usar el query).
 * - Las rutas técnicas (callback OAuth, joins por link) siempre pasan.
 * - Los usuarios con sesión Supabase activa también pasan (ya entraron antes).
 *
 * Para invalidar el acceso: limpiar `localStorage` o cambiar `EARLY_ACCESS_TOKEN`.
 */

const STORAGE_KEY = 'mapapis_early_access';
const QUERY_PARAM = 'acceso';
/** Cambiar este valor invalida todos los accesos previos. */
const EARLY_ACCESS_TOKEN = 'mapapis';

/** Rutas que NUNCA muestran la pantalla "en construcción". */
const BYPASS_PATH_PREFIXES = ['/oauth', '/unirse'];

/**
 * Si la URL trae `?acceso=mapapis`, persiste el flag y limpia la query.
 * Devuelve true si la flag quedó activa después de procesar la URL.
 */
export function consumeAccessQueryParam(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(QUERY_PARAM);
    if (value === EARLY_ACCESS_TOKEN) {
      localStorage.setItem(STORAGE_KEY, EARLY_ACCESS_TOKEN);
      url.searchParams.delete(QUERY_PARAM);
      window.history.replaceState({}, '', url.toString());
      return true;
    }
    return localStorage.getItem(STORAGE_KEY) === EARLY_ACCESS_TOKEN;
  } catch {
    return false;
  }
}

/** True si la ruta actual debe saltarse el gate. */
export function isBypassPath(pathname: string): boolean {
  return BYPASS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
