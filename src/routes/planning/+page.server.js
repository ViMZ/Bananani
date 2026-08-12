import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mealPlan, recipes, shoppingItems } from '$lib/server/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { getRecipesForCards, getRecipeWithIngredients } from '$lib/server/recipes';
import { mondayOf, todayISO, isValidISO, isPastDay } from '$lib/date/week';

export async function load({ url, locals }) {
  const userId = locals.user.id;
  const weekParam = url.searchParams.get('week');
  const weekStart = weekParam && isValidISO(weekParam) ? weekParam : mondayOf();

  // Placements de la semaine + infos légères de la recette (titre, miniature).
  const placements = await db
    .select({
      id: mealPlan.id,
      recipeId: mealPlan.recipeId,
      dayOfWeek: mealPlan.dayOfWeek,
      meal: mealPlan.meal,
      position: mealPlan.position,
      title: recipes.title,
      photoPath: recipes.photoPath
    })
    .from(mealPlan)
    .innerJoin(recipes, eq(mealPlan.recipeId, recipes.id))
    .where(and(eq(mealPlan.userId, userId), eq(mealPlan.weekStart, weekStart)))
    .orderBy(asc(mealPlan.dayOfWeek), asc(mealPlan.position));

  // Toutes les recettes de l'utilisateur pour le tiroir (id, title, photoPath…).
  const recipeList = await getRecipesForCards(userId);

  // La liste de courses est-elle déjà non vide ? (décide popup Ajouter/Remplacer)
  const shoppingProbe = await db
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .where(eq(shoppingItems.userId, userId))
    .limit(1);

  return {
    weekStart,
    placements,
    recipes: recipeList,
    hasShopping: shoppingProbe.length > 0,
    todayISO: todayISO()
  };
}

/** Valide un jour de semaine 0..6. */
function validDay(n) {
  return Number.isInteger(n) && n >= 0 && n <= 6;
}

/** Normalise le créneau : 'soir' ou 'midi' (défaut). */
function cleanMeal(v) {
  return v === 'soir' ? 'soir' : 'midi';
}

export const actions = {
  // Poser une recette sur un jour.
  place: async ({ request, locals }) => {
    const userId = locals.user.id;
    const fd = await request.formData();
    const recipeId = Number(fd.get('recipeId'));
    const dayOfWeek = Number(fd.get('dayOfWeek'));
    const meal = cleanMeal(fd.get('meal'));
    const weekStart = String(fd.get('weekStart') ?? '');
    if (!Number.isInteger(recipeId) || !validDay(dayOfWeek) || !isValidISO(weekStart)) {
      return fail(400, { error: 'Paramètres invalides' });
    }

    // La recette doit appartenir à l'utilisateur.
    const owned = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
      .limit(1);
    if (owned.length === 0) return fail(404, { error: 'Recette introuvable' });

    // position = fin de la file du créneau (jour + midi/soir).
    const last = await db
      .select({ position: mealPlan.position })
      .from(mealPlan)
      .where(
        and(
          eq(mealPlan.userId, userId),
          eq(mealPlan.weekStart, weekStart),
          eq(mealPlan.dayOfWeek, dayOfWeek),
          eq(mealPlan.meal, meal)
        )
      )
      .orderBy(desc(mealPlan.position))
      .limit(1);
    const position = last.length ? (last[0].position ?? 0) + 1 : 0;

    const [created] = await db
      .insert(mealPlan)
      .values({ userId, recipeId, weekStart, dayOfWeek, meal, position })
      .returning();
    return { placed: created };
  },

  // Déplacer un placement (changement de jour et/ou de position).
  move: async ({ request, locals }) => {
    const userId = locals.user.id;
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    const dayOfWeek = Number(fd.get('dayOfWeek'));
    const meal = cleanMeal(fd.get('meal'));
    const positionRaw = Number(fd.get('position'));
    if (!Number.isInteger(id) || !validDay(dayOfWeek)) {
      return fail(400, { error: 'Paramètres invalides' });
    }
    const position = Number.isInteger(positionRaw) ? positionRaw : 0;
    await db
      .update(mealPlan)
      .set({ dayOfWeek, meal, position })
      .where(and(eq(mealPlan.userId, userId), eq(mealPlan.id, id)));
    return { moved: true };
  },

  // Retirer un placement.
  remove: async ({ request, locals }) => {
    const userId = locals.user.id;
    const fd = await request.formData();
    const id = Number(fd.get('id'));
    if (!Number.isInteger(id)) return fail(400, { error: 'Paramètres invalides' });
    await db.delete(mealPlan).where(and(eq(mealPlan.userId, userId), eq(mealPlan.id, id)));
    return { removed: true };
  },

  // Générer la liste de courses depuis la semaine, en ignorant les jours passés.
  generate: async ({ request, locals }) => {
    const userId = locals.user.id;
    const fd = await request.formData();
    const weekStart = String(fd.get('weekStart') ?? '');
    const mode = fd.get('mode') === 'replace' ? 'replace' : 'append';
    if (!isValidISO(weekStart)) return fail(400, { error: 'Semaine invalide' });

    const placements = await db
      .select({ recipeId: mealPlan.recipeId, dayOfWeek: mealPlan.dayOfWeek })
      .from(mealPlan)
      .where(and(eq(mealPlan.userId, userId), eq(mealPlan.weekStart, weekStart)))
      .orderBy(asc(mealPlan.dayOfWeek), asc(mealPlan.position));

    // Un placement = une occurrence des ingrédients (doublons voulus).
    const upcoming = placements.filter((p) => !isPastDay(weekStart, p.dayOfWeek));
    if (upcoming.length === 0) return { empty: true };

    /** @type {any[]} */
    const values = [];
    for (const p of upcoming) {
      const data = await getRecipeWithIngredients(userId, p.recipeId);
      if (!data) continue;
      const { recipe, ingredients } = data;
      for (const i of ingredients) {
        values.push({
          userId,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          canonicalId: i.canonicalId,
          name: i.name,
          brand: i.brand,
          productReference: i.productReference,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes,
          checked: false
        });
      }
    }

    // Aucun ingrédient à ajouter et on n'a pas demandé de remise à zéro → rien à faire.
    if (values.length === 0 && mode !== 'replace') return { empty: true };

    if (mode === 'replace') {
      await db.delete(shoppingItems).where(eq(shoppingItems.userId, userId));
    }
    if (values.length > 0) {
      await db.insert(shoppingItems).values(values);
    }
    throw redirect(303, '/shopping');
  }
};
