import { error, redirect } from '@sveltejs/kit';
import { getRecipeWithIngredients, deleteRecipe } from '$lib/server/recipes';
import { recipeInList } from '$lib/server/shopping';
import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';

export async function load({ params }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(id);
  if (!data) throw error(404, 'Recette introuvable');
  return { ...data, inShoppingList: await recipeInList(id) };
}

export const actions = {
  delete: async ({ params }) => {
    const id = Number(params.id);
    await deleteRecipe(id);
    throw redirect(303, '/recipes');
  },
  addToShopping: async ({ params }) => {
    const id = Number(params.id);
    const data = await getRecipeWithIngredients(id);
    if (!data) throw error(404);
    const { recipe, ingredients } = data;
    if (ingredients.length === 0) return { added: 0, empty: true };
    // Empêche le doublon : une recette déjà présente n'est pas réinsérée.
    if (await recipeInList(id)) return { alreadyInList: true };

    await db.insert(shoppingItems).values(
      ingredients.map((i) => ({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        canonicalId: i.canonicalId,
        name: i.name,
        brand: i.brand,
        productReference: i.productReference,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
        checked: false
      }))
    );
    throw redirect(303, '/shopping');
  }
};
