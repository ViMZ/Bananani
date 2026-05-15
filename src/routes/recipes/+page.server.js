import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export async function load() {
  const list = await db.select().from(recipes).orderBy(desc(recipes.createdAt));
  return { recipes: list };
}
