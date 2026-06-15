import { db } from './db/index.js';
import { recipes, recipeIngredients } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { generateRecipeCode } from './codes.js';
import { savePhoto, deletePhoto } from './uploads.js';
import { resolveOrCreate } from './ingredients/catalog.js';

/**
 * Parse les champs d'ingrédients depuis un FormData (champs répétés `ing_*`).
 * @param {FormData} formData
 */
function parseIngredients(formData) {
  const names = formData.getAll('ing_name');
  const brands = formData.getAll('ing_brand');
  const refs = formData.getAll('ing_product_reference');
  const qtys = formData.getAll('ing_quantity');
  const units = formData.getAll('ing_unit');
  const notes = formData.getAll('ing_notes');
  const categories = formData.getAll('ing_category');

  const result = [];
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] ?? '').trim();
    if (!name) continue;
    result.push({
      name,
      brand: String(brands[i] ?? '').trim(),
      productReference: String(refs[i] ?? '').trim(),
      quantity: Number(qtys[i] ?? 0) || 0,
      unit: String(units[i] ?? '').trim(),
      notes: String(notes[i] ?? '').trim(),
      position: i,
      // Transient : sert à enrichir le catalogue, pas une colonne de recipe_ingredients.
      _category: String(categories[i] ?? '').trim()
    });
  }
  return result;
}

/**
 * Résout le canonicalId de chaque ingrédient (catalogue alimenté au fil de l'eau).
 * Séquentiel à dessein : deux ingrédients d'une même recette peuvent normaliser
 * vers la même clé, on évite ainsi toute course sur la contrainte d'unicité.
 * @param {ReturnType<typeof parseIngredients>} ings
 */
async function withCanonicalIds(ings) {
  const out = [];
  for (const ing of ings) {
    // `_category` n'est pas une colonne de recipe_ingredients : on l'extrait pour
    // enrichir le catalogue, et on ne garde que les champs persistés dans la ligne.
    const { _category, ...row } = ing;
    const canonicalId = await resolveOrCreate(ing.name, ing.unit, _category);
    out.push({ ...row, canonicalId });
  }
  return out;
}

async function uniqueRecipeCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRecipeCode();
    const existing = await db.select().from(recipes).where(eq(recipes.code, code)).limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error('Impossible de générer un code unique');
}

/** @param {FormData} formData */
export async function createRecipe(formData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Le titre est requis');

  const code = await uniqueRecipeCode();
  const photoFile = formData.get('photo');
  const photoPath = await savePhoto(photoFile);

  const [inserted] = await db
    .insert(recipes)
    .values({
      code,
      title,
      description: String(formData.get('description') ?? '').trim(),
      servings: Number(formData.get('servings') ?? 2) || 2,
      instructions: String(formData.get('instructions') ?? ''),
      photoPath
    })
    .returning();

  const ings = await withCanonicalIds(parseIngredients(formData));
  if (ings.length > 0) {
    await db.insert(recipeIngredients).values(ings.map((i) => ({ ...i, recipeId: inserted.id })));
  }

  return inserted;
}

/** @param {number} id @param {FormData} formData */
export async function updateRecipe(id, formData) {
  const existing = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  if (existing.length === 0) throw new Error('Recette introuvable');
  const current = existing[0];

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Le titre est requis');

  let photoPath = current.photoPath;
  const photoFile = formData.get('photo');
  const newPhoto = await savePhoto(photoFile);
  if (newPhoto) {
    deletePhoto(current.photoPath);
    photoPath = newPhoto;
  } else if (formData.get('remove_photo')) {
    deletePhoto(current.photoPath);
    photoPath = null;
  }

  await db
    .update(recipes)
    .set({
      title,
      description: String(formData.get('description') ?? '').trim(),
      servings: Number(formData.get('servings') ?? 2) || 2,
      instructions: String(formData.get('instructions') ?? ''),
      photoPath
    })
    .where(eq(recipes.id, id));

  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
  const ings = await withCanonicalIds(parseIngredients(formData));
  if (ings.length > 0) {
    await db.insert(recipeIngredients).values(ings.map((i) => ({ ...i, recipeId: id })));
  }

  return { id, code: current.code };
}

/** @param {number} id */
export async function deleteRecipe(id) {
  const existing = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  if (existing.length === 0) return;
  deletePhoto(existing[0].photoPath);
  await db.delete(recipes).where(eq(recipes.id, id));
}

/** @param {number} id */
export async function getRecipeWithIngredients(id) {
  const r = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  if (r.length === 0) return null;
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(recipeIngredients.position);
  return { recipe: r[0], ingredients: ings };
}

/** @param {string} code */
export async function getRecipeByCode(code) {
  const r = await db.select().from(recipes).where(eq(recipes.code, code)).limit(1);
  if (r.length === 0) return null;
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, r[0].id))
    .orderBy(recipeIngredients.position);
  return { recipe: r[0], ingredients: ings };
}
