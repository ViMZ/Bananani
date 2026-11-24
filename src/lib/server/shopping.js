import { db } from './db/index.js';
import { shoppingItems } from './db/schema.js';
import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { normalizeName } from '../ingredients/normalize.js';
import { effectiveServings, scaleQuantity } from '../ingredients/portions.js';

const PANTRY_STAPLES = new Set([
  'eau', 'eau du robinet', 'eau de cuisson', 'eau froide', 'eau tiede', 'eau chaude', 'eau bouillante',
  'sel', 'sel fin', 'sel de table', 'sel de cuisine', 'sel et poivre', 'sel, poivre', 'sel/poivre',
  'poivre', 'poivre moulu', 'poivre du moulin', 'poivre noir', 'poivre noir moulu',
  'poivre noir du moulin', 'poivre noir fraichement moulu',
  "huile d'olive", "huile d'olive vierge", "huile d'olive vierge extra", "huile d'olive extra vierge",
  "huile d'olive extra-vierge"
]);

function isPantryStaple(ingredient) {
  const name = normalizeName(ingredient.name)
    .replaceAll('’', "'")
    .replace(/^(?:de l'|[dl]'|du |de |(?:une )?pincee de )/, '');
  if (PANTRY_STAPLES.has(name)) return true;

  // Le gros sel peut aussi servir à préparer une croûte de sel.
  const use = `${name} ${normalizeName(ingredient.notes).replaceAll('’', "'")}`;
  return /^gros sel(?:$|\s*(?:[,(:]|pour\b))/.test(name)
    && /\b(?:eau de cuisson|saler l'eau|cuisson des pates?)\b/.test(use);
}

/** Snapshot d'un repas : ses quantités et portions ne changent plus avec la recette. */
export function shoppingRows(userId, recipe, ingredients, servings = recipe.servings) {
  const target = effectiveServings(servings, recipe.servings);
  const batchId = randomUUID();
  return ingredients.filter((ingredient) => !isPantryStaple(ingredient)).map((i) => ({
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
    .where(and(eq(shoppingItems.userId, userId), eq(shoppingItems.recipeId, recipeId), isNull(shoppingItems.removedUntil)))
    .limit(1);
  return rows.length > 0;
}

const UNDO_WINDOW_MS = 5000;

export function deleteExpiredShoppingItems(userId, now) {
  db.delete(shoppingItems)
    .where(and(eq(shoppingItems.userId, userId), lte(shoppingItems.removedUntil, now)))
    .run();
}

/** À appeler dans la transaction qui vide ou remplace les courses. */
export function clearShoppingItems(tx, userId) {
  const ownItems = eq(shoppingItems.userId, userId);
  tx.update(shoppingItems)
    .set({ archivedAt: Date.now() })
    .where(and(ownItems, eq(shoppingItems.isHousehold, true), eq(shoppingItems.checked, true),
      isNull(shoppingItems.archivedAt), isNull(shoppingItems.removedUntil)))
    .run();
  tx.delete(shoppingItems).where(and(ownItems, eq(shoppingItems.isHousehold, false))).run();
}

function targetIds(formData) {
  const raw = formData.get('ids') ?? formData.get('id') ?? '';
  return String(raw).split(',').map((id) => Number(id.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}

export function shoppingItemActions({ householdOnly = false } = {}) {
  const scope = householdOnly ? eq(shoppingItems.isHousehold, true) : isNull(shoppingItems.archivedAt);

  return {
    toggle: async ({ request, locals }) => {
      const formData = await request.formData();
      const ids = targetIds(formData);
      if (ids.length === 0) return;
      const checked = formData.get('checked') === '1';
      db.update(shoppingItems)
        .set(checked ? { checked } : { checked, archivedAt: null })
        .where(and(eq(shoppingItems.userId, locals.user.id), scope, inArray(shoppingItems.id, ids),
          isNull(shoppingItems.removedUntil)))
        .run();
    },
    remove: async ({ request, locals }) => {
      const ids = targetIds(await request.formData());
      if (ids.length === 0) return;
      db.update(shoppingItems)
        .set({ removedUntil: Date.now() + UNDO_WINDOW_MS })
        .where(and(eq(shoppingItems.userId, locals.user.id), scope, inArray(shoppingItems.id, ids),
          isNull(shoppingItems.removedUntil)))
        .run();
    },
    undoRemove: async ({ request, locals }) => {
      const formData = await request.formData();
      const ids = targetIds(formData);
      const removedUntil = Number(formData.get('removedUntil'));
      if (ids.length === 0 || !Number.isSafeInteger(removedUntil)) return;
      db.update(shoppingItems)
        .set({ removedUntil: null })
        .where(and(eq(shoppingItems.userId, locals.user.id), scope, inArray(shoppingItems.id, ids),
          eq(shoppingItems.removedUntil, removedUntil), gt(shoppingItems.removedUntil, Date.now())))
        .run();
    }
  };
}
