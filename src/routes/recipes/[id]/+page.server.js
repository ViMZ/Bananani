import { createHash } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getRecipeWithIngredients, deleteRecipe, updateRecipePhoto, updateRecipeInstructions } from '$lib/server/recipes';
import { improvePreparation, MAX_PREPARATION_LENGTH } from '$lib/server/recipe-review';
import { recipeInList, shoppingRows } from '$lib/server/shopping';
import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';

const preparationAttempts = new Map();

function preparationSource({ recipe, ingredients }) {
  const { title, description, servings, instructions } = recipe;
  return { title, description, servings, instructions, ingredients: ingredients.map(({ name, quantity, unit, notes }) => ({
    name, quantity: quantity || null, unit, notes
  })) };
}

function preparationRevision(source) {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

export async function load({ params, locals }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(locals.user.id, id);
  if (!data) throw error(404, 'Recette introuvable');
  return { ...data, inShoppingList: await recipeInList(locals.user.id, id), maxPreparationLength: MAX_PREPARATION_LENGTH };
}

export const actions = {
  improvePreparation: async ({ params, locals }) => {
    const userId = locals.user.id;
    const id = Number(params.id);
    const data = await getRecipeWithIngredients(userId, id);
    if (!data) return fail(404, { preparationError: 'Recette introuvable.' });
    if (!env.MISTRAL_API_KEY) return fail(503, { preparationError: 'L’amélioration par IA est indisponible pour le moment.' });
    const source = preparationSource(data);
    if (source.instructions?.length > MAX_PREPARATION_LENGTH || JSON.stringify(source).length > 80000) {
      return fail(400, { preparationError: 'Cette recette est trop longue pour l’amélioration par IA.' });
    }

    const now = Date.now();
    for (const [account, attempt] of preparationAttempts) {
      if (!attempt.busy && now - attempt.start >= 3600000) preparationAttempts.delete(account);
    }
    const attempt = preparationAttempts.get(userId) ?? { start: now, count: 0, busy: false };
    if (attempt.busy) return fail(429, { preparationError: 'Une proposition est déjà en cours de génération.' });
    if (attempt.count >= 20) return fail(429, { preparationError: 'Limite atteinte (20 propositions par heure). Réessaie plus tard.' });
    attempt.count++;
    attempt.busy = true;
    preparationAttempts.set(userId, attempt);
    try {
      const instructions = await improvePreparation(source, env.MISTRAL_API_KEY);
      if (!instructions) return fail(422, { preparationError: 'L’IA n’a pas pu proposer d’étapes à partir de cette recette.' });
      return { preparationProposal: { instructions, revision: preparationRevision(source) } };
    } catch {
      return fail(502, { preparationError: 'La proposition n’a pas pu être générée. Réessaie dans quelques instants.' });
    } finally {
      attempt.busy = false;
    }
  },
  savePreparation: async ({ params, request, locals }) => {
    const id = Number(params.id);
    const fields = await request.formData();
    const submitted = fields.get('instructions');
    const instructions = typeof submitted === 'string' ? submitted.replace(/\r\n/g, '\n').trim() : '';
    if (!instructions) {
      return fail(400, { preparationError: 'Saisis une préparation avant de l’enregistrer.' });
    }
    if (instructions.length > MAX_PREPARATION_LENGTH) return fail(400, { preparationError: 'La préparation est trop longue.' });
    const data = await getRecipeWithIngredients(locals.user.id, id);
    if (!data) return fail(404, { preparationError: 'Recette introuvable.' });
    if (fields.get('revision') !== preparationRevision(preparationSource(data))
      || !updateRecipeInstructions(locals.user.id, id, data.recipe.instructions, instructions)) {
      return fail(409, { preparationError: 'La recette a changé. Génère une nouvelle proposition à partir de la version actuelle.' });
    }
    throw redirect(303, `/recipes/${id}#preparation`);
  },
  discardPreparation: ({ params }) => {
    throw redirect(303, `/recipes/${encodeURIComponent(params.id)}#preparation`);
  },
  updatePhoto: async ({ params, request, locals }) => {
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1) return fail(404, { photoError: 'Recette introuvable.' });
    const formData = await request.formData();
    try {
      const updated = await updateRecipePhoto(locals.user.id, id, formData);
      if (!updated) return fail(404, { photoError: 'Recette introuvable.' });
      return { photoUpdated: true };
    } catch (err) {
      return fail(400, { photoError: err instanceof Error ? err.message : 'Impossible d’enregistrer la photo.' });
    }
  },
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
    const rows = shoppingRows(userId, recipe, ingredients);
    if (rows.length === 0) return { added: 0, empty: true };
    // Empêche le doublon involontaire ; l'utilisateur peut passer outre avec force.
    if (!force && (await recipeInList(userId, id))) return { alreadyInList: true };

    await db.insert(shoppingItems).values(rows);
    throw redirect(303, '/shopping');
  }
};
