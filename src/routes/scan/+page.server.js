import { fail } from '@sveltejs/kit';
import { getRecipeByCode } from '$lib/server/recipes';
import { recipeInList } from '$lib/server/shopping';
import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';

export const actions = {
  // Lecture seule : retrouve la recette pour prévisualisation (aucune insertion).
  lookup: async ({ request }) => {
    const formData = await request.formData();
    const code = String(formData.get('code') ?? '').trim().toUpperCase();
    if (!code) return fail(400, { error: 'Code manquant' });

    const data = await getRecipeByCode(code);
    if (!data) return fail(404, { error: `Aucune recette trouvée pour le code « ${code} »`, code });

    const { recipe, ingredients } = data;
    return {
      recipe,
      ingredients,
      code: recipe.code,
      recipeTitle: recipe.title,
      alreadyInList: await recipeInList(recipe.id),
      empty: ingredients.length === 0
    };
  },

  // Écriture : ajoute réellement les ingrédients à la liste de courses.
  add: async ({ request }) => {
    const formData = await request.formData();
    const code = String(formData.get('code') ?? '').trim().toUpperCase();
    if (!code) return fail(400, { error: 'Code manquant' });

    const data = await getRecipeByCode(code);
    if (!data) return fail(404, { error: `Aucune recette trouvée pour le code « ${code} »`, code });

    const { recipe, ingredients } = data;
    if (ingredients.length === 0) {
      return { added: 0, recipeTitle: recipe.title, code: recipe.code, empty: true };
    }
    if (await recipeInList(recipe.id)) {
      return { added: 0, recipeTitle: recipe.title, code: recipe.code, alreadyInList: true };
    }

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

    return { added: ingredients.length, recipeTitle: recipe.title, code: recipe.code };
  }
};
