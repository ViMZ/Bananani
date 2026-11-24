export const MAX_PHOTO_MB = 15;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;
const COMPRESS_IF_OVER_BYTES = 1024 * 1024;
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Renvoie une version optimisée (JPEG redimensionné) si utile, sinon le fichier tel quel.
 * @param {File} file
 */
export async function maybeCompress(file, maxDimension = MAX_DIM, quality = JPEG_QUALITY) {
  if (!COMPRESSIBLE.has(file.type)) return file; // gif animé, etc. → inchangé
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      // Repli pour les navigateurs mobiles sans createImageBitmap fonctionnel.
      const objectUrl = URL.createObjectURL(file);
      try {
        bitmap = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = objectUrl;
        });
      } catch {
        return file;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  if (scale === 1 && file.size <= COMPRESS_IF_OVER_BYTES) {
    bitmap.close?.();
    return file; // déjà petite et légère : inutile de recompresser (évite une perte de qualité)
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // fond blanc au cas où l'original a de la transparence
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file; // pas plus léger → garder l'original
  const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
