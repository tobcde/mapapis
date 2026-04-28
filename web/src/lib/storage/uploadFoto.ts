import { supabase } from '@/lib/supabase';

/**
 * Sube una foto al bucket `necesidad-fotos` y devuelve la URL pública.
 * Reutilizamos el bucket que ya existe (es público).
 *
 * El path se genera con prefix configurable (`necesidades/`, `ofertas/...`).
 * Filename = timestamp + random + ext, asi evitamos colisiones.
 */
export async function uploadFotoToStorage(
  file: File,
  pathPrefix: string,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${pathPrefix}/${filename}`.replace(/\/+/g, '/');

  const { error } = await supabase.storage
    .from('necesidad-fotos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('necesidad-fotos').getPublicUrl(path);
  return data.publicUrl;
}
