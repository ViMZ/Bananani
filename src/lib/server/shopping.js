import { db } from './db/index.js';
import { shoppingItems } from './db/schema.js';
import { eq, and } from 'drizzle-orm';

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
