import { db } from './db/index.js';
import { shoppingItems } from './db/schema.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { effectiveServings, scaleQuantity } from '../ingredients/portions.js';

/** Snapshot d'un repas : ses quantités et portions ne changent plus avec la recette. */
export function shoppingRows(userId, recipe, ingredients, servings = recipe.servings) {
  const target = effectiveServings(servings, recipe.servings);
  const batchId = randomUUID();
  return ingredients.map((i) => ({
    userId, recipeId: recipe.id, recipeTitle: recipe.title,
    canonicalId: i.canonicalId, name: i.name, brand: i.brand,
    productReference: i.productReference,
    quantity: scaleQuantity(i.quantity, recipe.servings || 2, target),
    unit: i.unit, notes: i.notes, checked: false, batchId, servings: target
  }));
}

/**
 * Vrai si au moins une ligne de la liste de courses de cet utilisateur provient de
 * cette recette. Sert à empêcher d'ajouter deux fois la même recette, quelle que
 * soit la source (scan, page détail…).
 * @param {number} userId
 * @param {number} recipeId
 */
export async function recipeInList(userId, recipeId) {
  const rows = await db
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .where(and(eq(shoppingItems.userId, userId), eq(shoppingItems.recipeId, recipeId)))
    .limit(1);
  return rows.length > 0;
}
