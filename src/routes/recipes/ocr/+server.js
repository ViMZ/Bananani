import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { extractRecipe } from '$lib/server/recipe-ocr.js';

const attempts = new Map();
export async function POST({ request, locals, url }) {
  const reply = (error, status) => json({ error }, { status });
  if (!locals.user) return reply('Connecte-toi pour scanner une recette.', 401);
  if (request.headers.get('origin') !== url.origin) return reply('Origine non autorisée.', 403);
  if (!env.MISTRAL_API_KEY) return reply('Le scan n’est pas encore configuré.', 503);
  const now = Date.now();
  for (const [id, state] of attempts) if (now - state.start > 3600000) attempts.delete(id);
  const state = attempts.get(locals.user.id) ?? { start: now, count: 0, busy: false };
  if (state.busy || state.count >= 20) return reply('Limite de scans atteinte. Réessaie plus tard (20 scans par heure).', 429);
  if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024) return reply('Image trop volumineuse (10 Mo maximum).', 413);
  state.busy = true;
  attempts.set(locals.user.id, state);
  try {
    const data = await request.formData();
    const file = data.get('image');
    if (!file || typeof file === 'string' || !file.size || file.size > 10 * 1024 * 1024) return reply('Choisis une image de moins de 10 Mo.', 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
    if (!mime) return reply('Format non pris en charge. Choisis une image JPEG, PNG ou WebP.', 400);
    state.count++;
    const result = await extractRecipe(bytes, mime, env.MISTRAL_API_KEY);
    return json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err?.name === 'TimeoutError' ? 'Le scan prend trop de temps. Réessaie avec une image plus petite.'
      : err instanceof Error && !['TypeError', 'SyntaxError'].includes(err.name) ? err.message : 'Impossible d’analyser cette image. Réessaie.';
    return reply(message, 422);
  } finally { state.busy = false; }
}
