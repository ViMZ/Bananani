import { db } from '$lib/server/db';
import { shoppingItems, ingredientCatalog, recipes } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { resolveOrCreate } from '$lib/server/ingredients/catalog';

export async function load({ locals }) {
  const rows = await db
    .select({
      item: shoppingItems,
      category: ingredientCatalog.category,
      servings: recipes.servings
    })
    .from(shoppingItems)
    .leftJoin(ingredientCatalog, eq(shoppingItems.canonicalId, ingredientCatalog.id))
    .leftJoin(recipes, eq(shoppingItems.recipeId, recipes.id))
    .where(eq(shoppingItems.userId, locals.user.id))
    .orderBy(shoppingItems.addedAt);
  const items = rows.map((r) => ({
    ...r.item,
    category: r.category ?? '',
    servings: r.servings ?? null
  }));
  return { items };
}

/**
 * Récupère les ids ciblés par une action : un `ids` (CSV, vue agrégée) ou un
 * `id` unique (vue par recette). Renvoie un tableau d'entiers valides.
 * @param {FormData} formData
 */
function targetIds(formData) {
  const raw = formData.get('ids') ?? formData.get('id') ?? '';
  return String(raw)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export const actions = {
  toggle: async ({ request, locals }) => {
    const formData = await request.formData();
    const ids = targetIds(formData);
    if (ids.length === 0) return;
    const checked = formData.get('checked') === '1';
    await db
      .update(shoppingItems)
      .set({ checked })
      .where(and(eq(shoppingItems.userId, locals.user.id), inArray(shoppingItems.id, ids)));
  },
  remove: async ({ request, locals }) => {
    const formData = await request.formData();
    const ids = targetIds(formData);
    if (ids.length === 0) return;
    await db
      .delete(shoppingItems)
      .where(and(eq(shoppingItems.userId, locals.user.id), inArray(shoppingItems.id, ids)));
  },
  clearChecked: async ({ locals }) => {
    await db
      .delete(shoppingItems)
      .where(and(eq(shoppingItems.userId, locals.user.id), eq(shoppingItems.checked, true)));
  },
  clearAll: async ({ locals }) => {
    await db.delete(shoppingItems).where(eq(shoppingItems.userId, locals.user.id));
  },
  add: async ({ request, locals }) => {
    const formData = await request.formData();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    const unit = String(formData.get('unit') ?? '').trim();
    await db.insert(shoppingItems).values({
      userId: locals.user.id,
      canonicalId: await resolveOrCreate(name, unit),
      name,
      quantity: Number(formData.get('quantity') ?? 0) || 0,
      unit,
      brand: String(formData.get('brand') ?? '').trim(),
      productReference: '',
      notes: '',
      recipeTitle: '',
      checked: false
    });
  }
};
