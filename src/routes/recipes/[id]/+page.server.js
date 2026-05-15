import { error, redirect } from '@sveltejs/kit';
import { getRecipeWithIngredients, deleteRecipe } from '$lib/server/recipes';
import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';

export async function load({ params }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(id);
  if (!data) throw error(404, 'Recette introuvable');
  return data;
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
    if (ingredients.length === 0) return { added: 0 };

    await db.insert(shoppingItems).values(
      ingredients.map((i) => ({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
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
