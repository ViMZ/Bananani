import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function load() {
  const items = await db.select().from(shoppingItems).orderBy(shoppingItems.addedAt);
  return { items };
}

export const actions = {
  toggle: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    const checked = formData.get('checked') === '1';
    await db.update(shoppingItems).set({ checked }).where(eq(shoppingItems.id, id));
  },
  remove: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
  },
  clearChecked: async () => {
    await db.delete(shoppingItems).where(eq(shoppingItems.checked, true));
  },
  clearAll: async () => {
    await db.delete(shoppingItems);
  },
  add: async ({ request }) => {
    const formData = await request.formData();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    await db.insert(shoppingItems).values({
      name,
      quantity: Number(formData.get('quantity') ?? 0) || 0,
      unit: String(formData.get('unit') ?? '').trim(),
      brand: String(formData.get('brand') ?? '').trim(),
      productReference: '',
      notes: '',
      recipeTitle: '',
      checked: false
    });
  }
};
