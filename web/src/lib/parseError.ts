interface PostgrestLike {
  code: string;
  message: string;
  hint?: string | null;
  details?: string | null;
}

function isPostgrestLike(err: unknown): err is PostgrestLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as Record<string, unknown>).message === 'string'
  );
}

// Códigos PostgreSQL estándar
const PG_CODES: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos',
  '23503': 'No se puede hacer eso: hay datos relacionados',
  '23514': 'Los datos ingresados no son válidos',
  '42501': 'No tenés permiso para hacer esto',
  '23502': 'Falta un campo obligatorio',
};

// Códigos de PostgREST
const PGRST_CODES: Record<string, string> = {
  PGRST116: 'No se encontraron los datos',
  PGRST301: 'Tu sesión expiró, volvé a iniciar sesión',
  PGRST302: 'Sesión inválida, volvé a iniciar sesión',
};

export function parseError(err: unknown, fallback = 'Algo salió mal, intentá de nuevo'): string {
  if (isPostgrestLike(err)) {
    // P0001 = RAISE EXCEPTION de nuestras RPCs: el mensaje ya está en español
    if (err.code === 'P0001') return err.message;

    if (PG_CODES[err.code]) return PG_CODES[err.code];
    if (PGRST_CODES[err.code]) return PGRST_CODES[err.code];

    // Cualquier otro error de DB: devolver message como fallback informativo
    return err.message || fallback;
  }

  if (err instanceof Error) {
    if (err.message === 'Failed to fetch' || err.message.toLowerCase().includes('networkerror')) {
      return 'Sin conexión, verificá tu internet';
    }
    return err.message || fallback;
  }

  return fallback;
}
