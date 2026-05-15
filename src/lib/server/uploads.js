import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const UPLOAD_DIR = 'static/uploads';

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/**
 * @param {File | null | undefined} file
 * @returns {Promise<string | null>} chemin web (`/uploads/xxx.jpg`) ou null
 */
export async function savePhoto(file) {
  if (!file || typeof file === 'string') return null;
  if (!(file instanceof File)) return null;
  if (file.size === 0) return null;

  const ext = extname(file.name || '').toLowerCase() || '.jpg';
  if (!ALLOWED_EXT.has(ext)) return null;

  const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  writeFileSync(join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** @param {string | null | undefined} webPath */
export function deletePhoto(webPath) {
  if (!webPath) return;
  const filename = webPath.replace(/^\/uploads\//, '');
  const fullPath = join(UPLOAD_DIR, filename);
  if (existsSync(fullPath)) {
    try {
      unlinkSync(fullPath);
    } catch {
      // best-effort
    }
  }
}
