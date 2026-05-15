import { error } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { UPLOAD_DIR } from '$lib/server/uploads';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

/** @type {import('./$types').RequestHandler} */
export function GET({ params }) {
  const file = params.file;

  // Garde anti path-traversal : nom simple, pas de / ni de ..
  if (!file || file.includes('/') || file.includes('\\') || file.includes('..') || file.startsWith('.')) {
    throw error(400, 'Invalid file name');
  }

  const ext = extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw error(404);

  const fullPath = join(UPLOAD_DIR, file);
  if (!existsSync(fullPath)) throw error(404);

  const buf = readFileSync(fullPath);

  return new Response(buf, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
