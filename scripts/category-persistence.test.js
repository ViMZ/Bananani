import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('saves changed and custom aisles and reloads them from SQLite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bananani-category-test-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  let db;
  try {
    ({ db } = await import('../src/lib/server/db/index.js'));
    const { resolveOrCreate, listCatalog } = await import('../src/lib/server/ingredients/catalog.js');
    const { prepareCategories, suggestCategories } = await import('../src/lib/server/ingredient-categories.js');
    const id = await resolveOrCreate('Farine test', 'g', 'Épicerie salée');
    assert.equal(await resolveOrCreate('Farine test', 'g', 'Épicerie sucrée'), id);
    assert.equal((await listCatalog())[0].category, 'Épicerie sucrée');
    await resolveOrCreate('Farine test', 'g', '  Produits   du monde  ');
    const catalog = await listCatalog();
    assert.equal(catalog[0].category, 'Produits du monde');
    const entries = prepareCategories(['Farine test'], catalog);
    assert.deepEqual(await suggestCategories(entries, '', () => { throw Error('Unexpected API call'); }), entries);
    assert.equal(entries[0].category, 'Produits du monde');
  } finally {
    db?.$client.close();
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
