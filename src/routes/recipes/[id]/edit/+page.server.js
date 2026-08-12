import { error, fail, redirect } from '@sveltejs/kit';
import { getRecipeWithIngredients, updateRecipe } from '$lib/server/recipes';
import { listCatalog } from '$lib/server/ingredients/catalog';

export async function load({ params, locals }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(locals.user.id, id);
  if (!data) throw error(404, 'Recette introuvable');
  return { ...data, catalog: await listCatalog() };
}

export const actions = {
  default: async ({ params, request, locals }) => {
    const id = Number(params.id);
    const formData = await request.formData();
    try {
      const updated = await updateRecipe(locals.user.id, id, formData);
      throw redirect(303, `/recipes/${updated.id}`);
    } catch (err) {
      if (err && /** @type {any} */ (err).status === 303) throw err;
      return fail(400, { error: err instanceof Error ? err.message : 'Erreur' });
    }
  }
};
