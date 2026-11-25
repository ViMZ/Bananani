import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { shoppingItems } from '$lib/server/db/schema';
import { deleteExpiredShoppingItems, shoppingItemActions } from '$lib/server/shopping';

function householdItems(userId) {
  return and(eq(shoppingItems.userId, userId), eq(shoppingItems.isHousehold, true));
}

const { remove, undoRemove } = shoppingItemActions({ householdOnly: true });

export function load({ locals }) {
  const now = Date.now();
  deleteExpiredShoppingItems(locals.user.id, now);
  const items = db.select().from(shoppingItems).where(householdItems(locals.user.id))
    .orderBy(desc(shoppingItems.id)).all();
  return { items, now };
}

function readItem(formData) {
  const values = {
    name: String(formData.get('name') ?? '').trim(),
    quantity: String(formData.get('quantity') ?? '').trim(),
    unit: String(formData.get('unit') ?? '').trim()
  };
  const quantity = Number(values.quantity.replace(',', '.'));
  let error;
  if (!values.name || values.name.length > 120) error = 'Saisis un nom de 1 à 120 caractères.';
  else if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
    error = 'Saisis une quantité comprise entre 0 et 1 000 000.';
  } else if (values.unit.length > 32) error = 'L’unité peut contenir jusqu’à 32 caractères.';
  return { values, item: { ...values, quantity }, error };
}

export const actions = {
  remove,
  undoRemove,
  setInShopping: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    const inShopping = formData.get('inShopping');
    if (!Number.isSafeInteger(id) || id <= 0 || (inShopping !== '0' && inShopping !== '1')) return fail(400);
    db.update(shoppingItems)
      .set(inShopping === '1' ? { checked: false, archivedAt: null } : { checked: true, archivedAt: Date.now() })
      .where(and(householdItems(locals.user.id), eq(shoppingItems.id, id), isNull(shoppingItems.removedUntil)))
      .run();
  },
  add: async ({ request, locals }) => {
    const { values, item, error } = readItem(await request.formData());
    if (error) return fail(400, { values, error });
    db.insert(shoppingItems).values({ ...item, userId: locals.user.id, isHousehold: true }).run();
    throw redirect(303, '/maison');
  },
  edit: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return fail(400, { error: 'Article invalide.' });
    const { values, item, error } = readItem(formData);
    if (error) return fail(400, { id, values, error });
    const result = db.update(shoppingItems).set(item)
      .where(and(householdItems(locals.user.id), eq(shoppingItems.id, id), isNull(shoppingItems.removedUntil)))
      .run();
    if (!result.changes) return fail(404, { error: 'Article introuvable.' });
    throw redirect(303, '/maison');
  }
};
