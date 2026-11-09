import { error, redirect } from '@sveltejs/kit';
import { getRecipeWithIngredients, deleteRecipe } from '$lib/server/recipes';
import { recipeInList, shoppingRows } from '$lib/server/shopping';
import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';

export async function load({ params, locals }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(locals.user.id, id);
  if (!data) throw error(404, 'Recette introuvable');
  return { ...data, inShoppingList: await recipeInList(locals.user.id, id) };
}

export const actions = {
  delete: async ({ params, locals }) => {
    const id = Number(params.id);
    await deleteRecipe(locals.user.id, id);
    throw redirect(303, '/recipes');
  },
  addToShopping: async ({ params, request, locals }) => {
    const userId = locals.user.id;
    const id = Number(params.id);
    const formData = await request.formData();
    // force=1 : l'utilisateur a confirmé l'ajout malgré la présence dans la liste.
    const force = formData.get('force') === '1';
    const data = await getRecipeWithIngredients(userId, id);
    if (!data) throw error(404);
    const { recipe, ingredients } = data;
    if (ingredients.length === 0) return { added: 0, empty: true };
    // Empêche le doublon involontaire ; l'utilisateur peut passer outre avec force.
    if (!force && (await recipeInList(userId, id))) return { alreadyInList: true };

    await db.insert(shoppingItems).values(
      shoppingRows(userId, recipe, ingredients)
    );
    throw redirect(303, '/shopping');
  }
};
