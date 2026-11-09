import { db } from './db/index.js';
import { recipes, recipeIngredients } from './db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { generateRecipeCode } from './codes.js';
import { savePhoto, deletePhoto } from './uploads.js';
import { resolveOrCreate } from './ingredients/catalog.js';
import { parseServings } from '../ingredients/portions.js';
import { importRecipeImage } from './recipe-images.js';

async function selectedPhoto(formData) {
  const file = formData.get('photo');
  if (file && typeof file !== 'string' && file.size) {
    if (file.size > 15 * 1024 * 1024) throw new Error('La photo dépasse 15 Mo. Choisis une image plus légère.');
    const path = await savePhoto(file);
    if (!path) throw new Error('Format de photo non pris en charge. Choisis une image JPEG, PNG, WebP ou GIF.');
    return { path, credit: '', source: '' };
  }
  const pageId = formData.get('photo_commons_id');
  if (!pageId) return null;
  try {
    const image = await importRecipeImage(pageId);
    return { path: await savePhoto(image.file), credit: image.credit, source: image.source };
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'TypeError') throw new Error('L’import de l’image a échoué. Réessaie ou choisis une photo dans la galerie.');
    throw err;
  }
}

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

/** @param {number} userId @param {FormData} formData */
export async function createRecipe(userId, formData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Le titre est requis');
  const servings = parseServings(formData.get('servings') ?? 2);

  const code = await uniqueRecipeCode();
  const photo = await selectedPhoto(formData);

  const [inserted] = await db
    .insert(recipes)
    .values({
      userId,
      code,
      title,
      description: String(formData.get('description') ?? '').trim(),
      owner: String(formData.get('owner') ?? '').trim(),
      servings,
      instructions: String(formData.get('instructions') ?? ''),
      photoPath: photo?.path ?? null,
      photoCredit: photo?.credit ?? '',
      photoSource: photo?.source ?? ''
    })
    .returning();

  const ings = await withCanonicalIds(parseIngredients(formData));
  if (ings.length > 0) {
    await db.insert(recipeIngredients).values(ings.map((i) => ({ ...i, recipeId: inserted.id })));
  }

  return inserted;
}

/** @param {number} userId @param {number} id @param {FormData} formData */
export async function updateRecipe(userId, id, formData) {
  const existing = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .limit(1);
  if (existing.length === 0) throw new Error('Recette introuvable');
  const current = existing[0];

  const title = String(formData.get('title') ?? '').trim();
  if (!title) throw new Error('Le titre est requis');
  const servings = parseServings(formData.get('servings') ?? 2);

  let photoPath = current.photoPath;
  let photoCredit = current.photoCredit;
  let photoSource = current.photoSource;
  const newPhoto = await selectedPhoto(formData);
  if (newPhoto?.path) {
    deletePhoto(current.photoPath);
    photoPath = newPhoto.path;
    photoCredit = newPhoto.credit;
    photoSource = newPhoto.source;
  } else if (formData.get('remove_photo')) {
    deletePhoto(current.photoPath);
    photoPath = null;
    photoCredit = '';
    photoSource = '';
  }

  await db
    .update(recipes)
    .set({
      title,
      description: String(formData.get('description') ?? '').trim(),
      owner: String(formData.get('owner') ?? '').trim(),
      servings,
      instructions: String(formData.get('instructions') ?? ''),
      photoPath, photoCredit, photoSource
    })
    .where(eq(recipes.id, id));

  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
  const ings = await withCanonicalIds(parseIngredients(formData));
  if (ings.length > 0) {
    await db.insert(recipeIngredients).values(ings.map((i) => ({ ...i, recipeId: id })));
  }

  return { id, code: current.code };
}

/** @param {number} userId @param {number} id */
export async function deleteRecipe(userId, id) {
  const existing = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .limit(1);
  if (existing.length === 0) return;
  deletePhoto(existing[0].photoPath);
  await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
}

/** @param {number} userId @param {number} id */
export async function getRecipeWithIngredients(userId, id) {
  const r = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .limit(1);
  if (r.length === 0) return null;
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(recipeIngredients.position);
  return { recipe: r[0], ingredients: ings };
}

/**
 * Recettes pour la planche imprimable (photo + titre + QR), sans les ingrédients.
 * Si `ids` est fourni, ne renvoie que ces recettes, dans l'ordre des ids reçus
 * (inArray ne garantit pas l'ordre SQL). Sinon, toutes, du plus récent au plus ancien.
 * @param {number} userId
 * @param {number[] | null} ids
 */
export async function getRecipesForCards(userId, ids) {
  const cols = {
    id: recipes.id,
    code: recipes.code,
    title: recipes.title,
    description: recipes.description,
    owner: recipes.owner,
    photoPath: recipes.photoPath,
    photoCredit: recipes.photoCredit,
    photoSource: recipes.photoSource
  };
  if (ids && ids.length > 0) {
    const rows = await db
      .select(cols)
      .from(recipes)
      .where(and(eq(recipes.userId, userId), inArray(recipes.id, ids)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }
  return db
    .select(cols)
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(desc(recipes.createdAt));
}

/** @param {number} userId @param {string} code */
export async function getRecipeByCode(userId, code) {
  const r = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.code, code), eq(recipes.userId, userId)))
    .limit(1);
  if (r.length === 0) return null;
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, r[0].id))
    .orderBy(recipeIngredients.position);
  return { recipe: r[0], ingredients: ings };
}
