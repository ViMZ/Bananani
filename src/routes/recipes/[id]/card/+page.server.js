import { error } from '@sveltejs/kit';
import { getRecipeWithIngredients } from '$lib/server/recipes';

export async function load({ params }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(id);
  if (!data) throw error(404);
  return data;
}
