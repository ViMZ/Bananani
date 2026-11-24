import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shoppingItems, ingredientCatalog, recipes } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { resolveOrCreate } from '$lib/server/ingredients/catalog';
import { clearShoppingItems, deleteExpiredShoppingItems, shoppingItemActions } from '$lib/server/shopping';

export async function load({ locals }) {
  const now = Date.now();
  const ownItems = eq(shoppingItems.userId, locals.user.id);
  deleteExpiredShoppingItems(locals.user.id, now);

  const rows = await db
    .select({
      item: shoppingItems,
      category: ingredientCatalog.category,
      servings: recipes.servings
    })
    .from(shoppingItems)
    .leftJoin(ingredientCatalog, eq(shoppingItems.canonicalId, ingredientCatalog.id))
    .leftJoin(recipes, eq(shoppingItems.recipeId, recipes.id))
    .where(and(ownItems, isNull(shoppingItems.archivedAt)))
    .orderBy(shoppingItems.addedAt, shoppingItems.id);
  const items = rows.map((r) => ({
    ...r.item,
    category: r.category ?? '',
    servings: r.item.servings ?? r.servings ?? null
  }));
  return { items, now };
}

export const actions = {
  ...shoppingItemActions(),
  removeRecipe: async ({ request, locals }) => {
    const formData = await request.formData();
    const rawRecipeId = formData.get('recipeId');
    const recipeId = Number(rawRecipeId);
    const recipeTitle = formData.get('recipeTitle');
    let group;
    if (typeof rawRecipeId === 'string' && Number.isSafeInteger(recipeId) && recipeId > 0) {
      group = eq(shoppingItems.recipeId, recipeId);
    } else if (rawRecipeId === null && typeof recipeTitle === 'string' && recipeTitle) {
      group = and(isNull(shoppingItems.recipeId), eq(shoppingItems.recipeTitle, recipeTitle));
    } else {
      return fail(400);
    }
    await db.delete(shoppingItems).where(and(eq(shoppingItems.userId, locals.user.id), group));
  },
  clearAll: async ({ request, locals }) => {
    const formData = await request.formData();
    if (formData.get('confirmed') !== '1') return fail(400);
    db.transaction((tx) => clearShoppingItems(tx, locals.user.id));
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
