import { supabase } from '@/lib/supabase';

const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.8;
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Sube un comprobante de transferencia al bucket privado `comprobantes`.
 *
 * Path: `{necesidadId}/{alumnoId}/{timestamp}.{ext}`
 *   - Las policies de Storage matchean este patron para autorizar
 *     SELECT al cobrador + tutores del alumno.
 *
 * Para imagenes (JPEG/PNG/WebP) hacemos resize + recompresion a JPEG en
 * el navegador antes de subir. Esto:
 *   - Strippea EXIF (geolocalizacion del celu).
 *   - Reduce tamaño de 5MB a ~80KB.
 *   - Acota egress y storage cost.
 *
 * Para PDFs subimos tal cual.
 */
export async function uploadComprobante(
  file: File,
  necesidadId: string,
  alumnoId: string,
): Promise<string> {
  let toUpload: Blob = file;
  let ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  let contentType = file.type || 'application/octet-stream';

  if (file.type.startsWith('image/')) {
    try {
      toUpload = await resizeImageToJpeg(file);
      ext = 'jpg';
      contentType = 'image/jpeg';
    } catch {
      toUpload = file;
    }
  }

  const filename = `${Date.now()}.${ext}`;
  const path = `${necesidadId}/${alumnoId}/${filename}`;

  const { error } = await supabase.storage
    .from('comprobantes')
    .upload(path, toUpload, { contentType, upsert: false });
  if (error) throw error;

  return path;
}

/**
 * Pide al backend una signed URL temporal para visualizar un comprobante.
 * El cobrador y los tutores del alumno la usan para previsualizar la
 * imagen sin tener bucket publico.
 */
export async function getComprobanteSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('comprobantes')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Resize de la imagen a max 1080px en su lado mayor + recompresion JPEG.
 * Preserva proporciones. Devuelve un Blob image/jpeg listo para subir.
 *
 * El proceso de re-encode descarta automaticamente los metadatos EXIF
 * (tags GPS, marca de camara, etc.).
 */
async function resizeImageToJpeg(file: File): Promise<Blob> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const targetW = Math.round(img.width * ratio);
  const targetH = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-no-2d-context');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('canvas-toBlob-failed'));
        else resolve(blob);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('file-read-not-string'));
    };
    reader.onerror = () => { reject(reader.error ?? new Error('file-read-error')); };
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { resolve(img); };
    img.onerror = () => { reject(new Error('image-load-error')); };
    img.src = src;
  });
}
