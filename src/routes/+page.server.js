import { db } from '$lib/server/db';
import { recipes, shoppingItems } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function load() {
  const recent = await db.select().from(recipes).orderBy(desc(recipes.createdAt)).limit(6);
  const pendingCount = await db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.checked, false));

  return {
    recent,
    pendingShoppingCount: pendingCount.length,
    totalRecipes: (await db.select().from(recipes)).length
  };
}
