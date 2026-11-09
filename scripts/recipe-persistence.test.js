import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

test('migrates old data, preserves ingredient order, and saves independent meal snapshots', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bananani-feedback-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  let db;
  try {
    const legacy = new Database(join(directory, 'bananani.db'));
    legacy.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE recipes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT DEFAULT '', owner TEXT DEFAULT '', servings INTEGER DEFAULT 2, instructions TEXT DEFAULT '', photo_path TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE meal_plan (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), recipe_id INTEGER NOT NULL REFERENCES recipes(id), week_start TEXT NOT NULL, day_of_week INTEGER NOT NULL, meal TEXT DEFAULT 'midi', position INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE shopping_items (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), recipe_id INTEGER, canonical_id INTEGER, recipe_title TEXT DEFAULT '', name TEXT NOT NULL, brand TEXT DEFAULT '', product_reference TEXT DEFAULT '', quantity REAL DEFAULT 0, unit TEXT DEFAULT '', notes TEXT DEFAULT '', checked INTEGER DEFAULT 0, added_at TEXT DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO users VALUES (1, 'first', 'test', '', CURRENT_TIMESTAMP), (2, 'other', 'test', '', CURRENT_TIMESTAMP);
      INSERT INTO recipes (id, user_id, code, title, servings) VALUES (1, 1, 'BAN-OLD', 'Ancienne recette', 4);
      INSERT INTO meal_plan (id, user_id, recipe_id, week_start, day_of_week) VALUES (1, 1, 1, '2099-01-05', 0);
      INSERT INTO shopping_items (id, user_id, recipe_id, name, quantity, unit) VALUES (1, 1, 1, 'Ancien ingrédient', 300, 'g');
    `);
    legacy.close();
    ({ db } = await import('../src/lib/server/db/index.js'));
    const { getRecipeWithIngredients, createRecipe, updateRecipe } = await import('../src/lib/server/recipes.js');
    const { shoppingRows } = await import('../src/lib/server/shopping.js');
    const { shoppingItems } = await import('../src/lib/server/db/schema.js');
    const { groupByRecipe } = await import('../src/lib/ingredients/byRecipe.js');
    assert.equal((await getRecipeWithIngredients(1, 1)).recipe.title, 'Ancienne recette');
    assert.equal(db.$client.prepare('SELECT servings FROM meal_plan WHERE id = 1').get().servings, null);
    assert.equal(db.$client.prepare('SELECT quantity FROM shopping_items WHERE id = 1').get().quantity, 300);

    function form(names) {
      const data = new FormData();
      data.set('title', 'Pâtes au saumon');
      data.set('servings', '4');
      for (const name of names) {
        data.append('ing_name', name);
        data.append('ing_quantity', '300');
        data.append('ing_unit', 'g');
      }
      return data;
    }
    const names = ['Pâtes', 'Saumon', 'Crème de soja', 'Emmental'];
    const recipe = await createRecipe(1, form(names));
    assert.deepEqual((await getRecipeWithIngredients(1, recipe.id)).ingredients.map(i => i.name), names);
    const reordered = ['Emmental', 'Pâtes', 'Crème de soja', 'Saumon'];
    await updateRecipe(1, recipe.id, form(reordered));
    const data = await getRecipeWithIngredients(1, recipe.id);
    assert.deepEqual(data.ingredients.map(i => i.name), reordered);
    assert.equal(await getRecipeWithIngredients(2, recipe.id), null);
    await assert.rejects(updateRecipe(2, recipe.id, form(names)), /introuvable/);

    const rows = [4, 2].flatMap(n => shoppingRows(1, data.recipe, data.ingredients, n));
    await db.insert(shoppingItems).values(rows);
    const saved = db.$client.prepare('SELECT batch_id AS batchId, servings, quantity, recipe_title AS recipeTitle, name, unit, id FROM shopping_items WHERE recipe_id = ?').all(recipe.id);
    assert.equal(groupByRecipe(saved)[0].totalServings, 6);
    const changed = form(names);
    changed.set('servings', '8');
    await updateRecipe(1, recipe.id, changed);
    assert.equal(groupByRecipe(saved)[0].totalServings, 6);
    assert.equal(db.$client.prepare('SELECT servings FROM shopping_items WHERE recipe_id = ? ORDER BY id LIMIT 1').get(recipe.id).servings, 4);
    const invalid = form(names);
    invalid.set('servings', '0');
    await assert.rejects(createRecipe(1, invalid), /entre 1 et 50/);
  } finally {
    db?.$client.close();
    if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous;
    if (!resolve(directory).startsWith(resolve(tmpdir()) + '\\bananani-feedback-') && !resolve(directory).startsWith(resolve(tmpdir()) + '/bananani-feedback-')) throw new Error('Unexpected test cleanup path');
    rmSync(directory, { recursive: true, force: true });
  }
});
