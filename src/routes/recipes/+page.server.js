import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function load({ locals }) {
  const list = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, locals.user.id))
    .orderBy(desc(recipes.createdAt));
  return { recipes: list };
}
