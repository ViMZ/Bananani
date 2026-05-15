import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function load() {
  const items = await db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.checked, false))
    .orderBy(shoppingItems.addedAt);
  return { items };
}
