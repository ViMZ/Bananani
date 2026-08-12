import { db } from '$lib/server/db';
import { recipes, shoppingItems } from '$lib/server/db/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function load({ locals }) {
  const userId = locals.user.id;
  const recent = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(desc(recipes.createdAt))
    .limit(6);
  const pendingCount = await db
    .select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, false)));

  return {
    recent,
    pendingShoppingCount: pendingCount.length,
    totalRecipes: (await db.select().from(recipes).where(eq(recipes.userId, userId))).length
  };
}
