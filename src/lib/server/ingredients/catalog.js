import { db } from '../db/index.js';
import { ingredientCatalog } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { normalizeName } from '../../ingredients/normalize.js';

/**
 * Catalogue d'ingrédients canoniques.
 *
 * Construit au fil de l'eau à la sauvegarde des recettes : chaque nom saisi est
 * résolu vers une entrée canonique (clé = `normalizeName`), créée si absente.
 * L'autocomplete de saisie propose ensuite ces noms, ce qui amène les utilisateurs
 * à réutiliser la même entrée plutôt que de retaper une variante.
 */

/**
 * Liste tout le catalogue, trié par nom (pour l'autocomplete).
 * @returns {Promise<Array<{ id: number, name: string, normalizedKey: string, defaultUnit: string }>>}
 */
export async function listCatalog() {
  return db
    .select({
      id: ingredientCatalog.id,
      name: ingredientCatalog.name,
      normalizedKey: ingredientCatalog.normalizedKey,
      defaultUnit: ingredientCatalog.defaultUnit,
      category: ingredientCatalog.category
    })
    .from(ingredientCatalog)
    .orderBy(ingredientCatalog.name);
}

/**
 * Résout un nom d'ingrédient vers son id canonique, en créant l'entrée si besoin.
 * Unité par défaut et catégorie sont mémorisées à la création ; si l'entrée existe
 * mais qu'un de ces champs manque, la première valeur non vide rencontrée l'enrichit.
 * @param {string} name
 * @param {string} [unit]      unité saisie pour cet ingrédient
 * @param {string} [category]  rayon / catégorie de l'ingrédient
 * @returns {Promise<number|null>}  id canonique, ou null si le nom est vide
 */
export async function resolveOrCreate(name, unit = '', category = '') {
  const clean = String(name ?? '').trim();
  if (!clean) return null;

  const key = normalizeName(clean);
  if (!key) return null;

  const cleanUnit = String(unit ?? '').trim();
  const cleanCategory = String(category ?? '').trim();

  const existing = await db
    .select({
      id: ingredientCatalog.id,
      defaultUnit: ingredientCatalog.defaultUnit,
      category: ingredientCatalog.category
    })
    .from(ingredientCatalog)
    .where(eq(ingredientCatalog.normalizedKey, key))
    .limit(1);
  if (existing.length > 0) {
    // Enrichit les champs encore vides.
    const patch = {};
    if (cleanUnit && !existing[0].defaultUnit) patch.defaultUnit = cleanUnit;
    if (cleanCategory && !existing[0].category) patch.category = cleanCategory;
    if (Object.keys(patch).length > 0) {
      await db.update(ingredientCatalog).set(patch).where(eq(ingredientCatalog.id, existing[0].id));
    }
    return existing[0].id;
  }

  const [created] = await db
    .insert(ingredientCatalog)
    .values({ name: clean, normalizedKey: key, defaultUnit: cleanUnit, category: cleanCategory })
    .onConflictDoNothing({ target: ingredientCatalog.normalizedKey })
    .returning({ id: ingredientCatalog.id });
  if (created) return created.id;

  // Conflit : une autre insertion a gagné la course, on relit la clé.
  const [row] = await db
    .select({ id: ingredientCatalog.id })
    .from(ingredientCatalog)
    .where(eq(ingredientCatalog.normalizedKey, key))
    .limit(1);
  return row?.id ?? null;
}
