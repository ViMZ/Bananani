import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { MAX_CAPTURES, MAX_CAPTURE_BYTES } from '$lib/recipes/import-limits.js';
import { captureMime, combineRecipeCaptures } from '$lib/server/recipe-captures.js';
import { createImportJobs, importError, validImportId } from '$lib/server/recipe-import-jobs.js';
import { importLinkedRecipe, parseRecipeUrl } from '$lib/server/recipe-link.js';
import { analyzeRecipe } from '$lib/server/recipe-review.js';

const attempts = new Map();
const jobs = createImportJobs();
const headers = { 'Cache-Control': 'no-store', Vary: 'Cookie' };
const jobReply = job => json(job, { status: job.status === 'processing' ? 202 : 200, headers });

export async function GET({ url, locals }) {
  if (!locals.user) return json({ error: 'Connecte-toi pour importer une recette.' }, { status: 401, headers });
  const id = url.searchParams.get('job');
  const job = validImportId(id) ? jobs.get(locals.user.id, id) : null;
  return job ? jobReply(job) : json({ error: 'Cet import est introuvable ou a expiré.' }, { status: 404, headers });
}

export async function POST({ request, locals, url }) {
  const reply = (error, status) => json({ error }, { status, headers });
  if (!locals.user) return reply('Connecte-toi pour importer une recette.', 401);
  if (request.headers.get('origin') !== url.origin) return reply('Origine non autorisée.', 403);
  const asyncImport = url.searchParams.get('mode') === 'async';
  const id = request.headers.get('X-Import-Id');
  if (asyncImport) {
    if (!validImportId(id)) return reply('Identifiant d’import invalide.', 400);
    const existing = jobs.get(locals.user.id, id);
    if (existing) return jobReply(existing);
    if (!jobs.canStart()) return reply('Un import est déjà en cours. Réessaie dans quelques instants.', 429);
  }
  const now = Date.now();
  for (const [id, state] of attempts) if (now - state.start > 3600000) attempts.delete(id);
  const state = attempts.get(locals.user.id) ?? { start: now, count: 0, busy: false };
  if (state.busy || state.count >= 20) return reply('Trop d’imports en cours ou récents. Réessaie plus tard.', 429);
  if (Number(request.headers.get('content-length')) > MAX_CAPTURE_BYTES + 1024 * 1024) return reply('Les images doivent faire 10 Mo au total maximum.', 413);
  state.busy = true;
  attempts.set(locals.user.id, state);
  try {
    const data = await request.formData();
    const files = data.getAll('image');
    let work;
    let phase = 'ocr';
    if (data.has('url')) {
      if (files.length || data.getAll('url').length !== 1) return reply('Fournis un lien ou des images.', 400);
      let target;
      try { target = parseRecipeUrl(data.get('url')); } catch (err) { return reply(err.message, 400); }
      phase = 'link';
      work = () => importLinkedRecipe(target);
    } else {
      if (!env.MISTRAL_API_KEY) return reply('Le scan n’est pas encore configuré.', 503);
      if (!files.length || files.length > MAX_CAPTURES || files.some(file => typeof file === 'string' || !file.size)) {
        return reply('Choisis entre 1 et ' + MAX_CAPTURES + ' images.', 400);
      }
      if (files.reduce((size, file) => size + file.size, 0) > MAX_CAPTURE_BYTES) {
        return reply('Les images doivent faire 10 Mo au total maximum.', 413);
      }
      const images = [];
      for (const file of files) {
        const bytes = Buffer.from(await file.arrayBuffer());
        const mime = captureMime(bytes);
        if (!mime) return reply('Format non pris en charge. Choisis une image JPEG, PNG ou WebP.', 400);
        if (files.length > 1 && mime !== 'image/jpeg') return reply('Impossible de préparer toutes les captures. Essaie de les ajouter à nouveau.', 400);
        images.push({ bytes, mime });
      }
      work = async onPhase => {
        if (images.length === 1) return analyzeRecipe(images[0].bytes, images[0].mime, env.MISTRAL_API_KEY, fetch, onPhase);
        const pdf = await combineRecipeCaptures(images.map(image => image.bytes));
        return analyzeRecipe(pdf, 'application/pdf', env.MISTRAL_API_KEY, fetch, onPhase, images.length);
      };
    }

    if (asyncImport && !jobs.canStart()) return reply('Un import est déjà en cours. Réessaie dans quelques instants.', 429);
    state.count++;
    if (asyncImport) {
      return jobReply(jobs.start(locals.user.id, id, async onPhase => {
        try { return await work(onPhase); }
        finally { state.busy = false; }
      }, phase));
    }
    return json(await work(), { headers });
  } catch (err) {
    return reply(importError(err), 422);
  } finally {
    if (!asyncImport || !jobs.get(locals.user.id, id)) state.busy = false;
  }
}
