import { redirect, fail } from '@sveltejs/kit';
import { createRecipe } from '$lib/server/recipes';

export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    try {
      const created = await createRecipe(formData);
      throw redirect(303, `/recipes/${created.id}`);
    } catch (err) {
      if (err && /** @type {any} */ (err).status === 303) throw err;
      return fail(400, { error: err instanceof Error ? err.message : 'Erreur' });
    }
  }
};
