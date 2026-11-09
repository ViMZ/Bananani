import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { analyzeRecipe } from '$lib/server/recipe-review.js';
import { createImportJobs, importError, validImportId } from '$lib/server/recipe-import-jobs.js';

const attempts = new Map();
const jobs = createImportJobs();
const headers = { 'Cache-Control': 'no-store', Vary: 'Cookie' };
const jobReply = job => json(job, { status: job.status === 'processing' ? 202 : 200, headers });

export async function GET({ url, locals }) {
  if (!locals.user) return json({ error: 'Connecte-toi pour importer une recette.' }, { status: 401, headers });
  const id = url.searchParams.get('job');
  const job = validImportId(id) ? jobs.get(locals.user.id, id) : null;
  return job ? jobReply(job) : json({ error: 'Cet import est introuvable ou a expiré. Choisis à nouveau la photo.' }, { status: 404, headers });
}

export async function POST({ request, locals, url }) {
  const reply = (error, status) => json({ error }, { status, headers });
  if (!locals.user) return reply('Connecte-toi pour scanner une recette.', 401);
  if (request.headers.get('origin') !== url.origin) return reply('Origine non autorisée.', 403);
  const asyncImport = url.searchParams.get('mode') === 'async';
  const id = request.headers.get('X-Import-Id');
  if (asyncImport) {
    if (!validImportId(id)) return reply('Identifiant d’import invalide.', 400);
    const existing = jobs.get(locals.user.id, id);
    if (existing) return jobReply(existing);
    if (!jobs.canStart()) return reply('Un import est déjà en cours. Réessaie dans quelques instants.', 429);
  }
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
    if (asyncImport) {
      const job = jobs.start(locals.user.id, id, async onPhase => {
        try { return await analyzeRecipe(bytes, mime, env.MISTRAL_API_KEY, fetch, onPhase); }
        finally { state.busy = false; }
      });
      return jobReply(job);
    }
    const result = await analyzeRecipe(bytes, mime, env.MISTRAL_API_KEY);
    return json(result, { headers });
  } catch (err) {
    return reply(importError(err), 422);
  } finally {
    if (!asyncImport || !jobs.get(locals.user.id, id)) state.busy = false;
  }
}
