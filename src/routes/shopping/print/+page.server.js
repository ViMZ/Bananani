import { db } from '$lib/server/db';
import { shoppingItems, ingredientCatalog } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function load({ url }) {
  const view = url.searchParams.get('view') === 'recipe' ? 'recipe' : 'ingredient';
  const rows = await db
    .select({ item: shoppingItems, category: ingredientCatalog.category })
    .from(shoppingItems)
    .leftJoin(ingredientCatalog, eq(shoppingItems.canonicalId, ingredientCatalog.id))
    .where(eq(shoppingItems.checked, false))
    .orderBy(shoppingItems.addedAt);
  const items = rows.map((r) => ({ ...r.item, category: r.category ?? '' }));
  return { items, view };
}
