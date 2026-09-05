import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { listCatalog } from '$lib/server/ingredients/catalog.js';
import { prepareCategories, suggestCategories } from '$lib/server/ingredient-categories.js';

const attempts = new Map();
export async function POST({ request, locals, url }) {
  const reply = (data, status = 200) => json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!locals.user) return reply({ error: 'Connecte-toi pour proposer les rayons.' }, 401);
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'Origine non autorisée.' }, 403);
  // Borner le corps lu, même en l’absence de Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Liste d’ingrédients manquante.' }, 400);
  let entries;
  try {
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) { await reader.cancel(); return reply({ error: 'Liste trop volumineuse.' }, 413); }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    entries = prepareCategories(data.names, await listCatalog());
  } catch { return reply({ error: 'Liste invalide : maximum 100 ingrédients de 200 caractères.' }, 400); }
  finally { reader.releaseLock(); }
  if (entries.every(i => i.category)) return reply({ suggestions: entries });
  if (!env.MISTRAL_API_KEY) return reply({ suggestions: entries, warning: 'Suggestions indisponibles. Choisis les rayons manuellement.' });
  const now = Date.now();
  for (const [id, state] of attempts) if (!state.busy && now - state.start >= 3600000) attempts.delete(id);
  const state = attempts.get(locals.user.id) ?? { start: now, count: 0, busy: false };
  if (state.busy || state.count >= 30) return reply({ suggestions: entries, warning: 'Limite de suggestions atteinte. Tu peux choisir les rayons manuellement.' });
  state.busy = true;
  state.count++;
  attempts.set(locals.user.id, state);
  try { return reply({ suggestions: await suggestCategories(entries, env.MISTRAL_API_KEY) }); }
  catch { return reply({ suggestions: entries, warning: 'Suggestions indisponibles pour le moment. Tu peux choisir les rayons manuellement.' }); }
  finally { state.busy = false; }
}
