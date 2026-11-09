import { json } from '@sveltejs/kit';
import { searchRecipeImages } from '$lib/server/recipe-images';

const attempts = new Map();
export async function GET({ url, locals }) {
  if (!locals.user) return json({ error: 'Connecte-toi pour rechercher une image.' }, { status: 401 });
  const now = Date.now();
  for (const [id, entry] of attempts) if (now - entry.start > 3600000) attempts.delete(id);
  const state = attempts.get(locals.user.id) || { start: now, count: 0 };
  if (state.count >= 60) return json({ error: 'Limite de recherches atteinte. Réessaie dans une heure.' }, { status: 429 });
  state.count++;
  attempts.set(locals.user.id, state);
  try {
    return json({ images: await searchRecipeImages(url.searchParams.get('q')) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return json({ error: err?.name === 'TimeoutError' ? 'La recherche prend trop de temps. Réessaie.' :
      err instanceof Error && err.name === 'Error' ? err.message : 'Recherche indisponible. Réessaie ou choisis une photo.' }, { status: 422 });
  }
}
