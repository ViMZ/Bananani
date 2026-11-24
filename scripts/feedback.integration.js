// Run after npm run build: node --test scripts/feedback.integration.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';

test('recipe, planning, shopping and tenant isolation through HTTP', { timeout: 60000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bananani-http-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  let db, server;
  let logs = '';
  try {
    ({ db } = await import('../src/lib/server/db/index.js'));
    const { createUser } = await import('../src/lib/server/users.js');
    const { hashPassword } = await import('../src/lib/server/auth.js');
    const password = randomBytes(24).toString('base64url');
    await createUser('feedback', hashPassword(password));
    await createUser('other', hashPassword(password));
    // Let the OS allocate a free loopback port.
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['--import', pathToFileURL(resolve('scripts/fixtures/mistral-preload.js')).href, 'build/index.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin, MISTRAL_API_KEY: randomUUID() }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', data => { logs += data; });
    server.stderr.on('data', data => { logs += data; });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(`${origin}/login`)).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, logs);
    function form(fields) {
      const data = new FormData();
      for (const [key, values] of Object.entries(fields)) for (const value of Array.isArray(values) ? values : [values]) data.append(key, String(value));
      return data;
    }
    async function login(user) {
      const response = await fetch(`${origin}/login`, { method: 'POST', redirect: 'manual', headers: { Origin: origin, Accept: 'text/html' }, body: form({ user, password }) });
      assert.equal(response.status, 303);
      return response.headers.get('set-cookie').split(';')[0];
    }
    const cookie = await login('feedback');
    const otherCookie = await login('other');
    const get = (path, auth = cookie) => fetch(`${origin}${path}`, { headers: { Cookie: auth } });
    const post = (path, fields, auth = cookie) => fetch(`${origin}${path}`, { method: 'POST', redirect: 'manual', headers: { Cookie: auth, Origin: origin, Accept: 'text/html' }, body: form(fields) });

    let recipeId;
    await t.test('creates, reorders, reloads and uploads a dish photo', async () => {
      const response = await post('/recipes/new', { title: 'Pâtes au saumon', servings: 4,
        ing_name: ['Pâtes', 'Saumon', 'Crème', 'Œufs'], ing_quantity: [300, 200, 20, 4], ing_unit: ['g', 'g', 'cl', 'pièce'] });
      assert.equal(response.status, 303);
      recipeId = Number(response.headers.get('location').split('/').pop());
      const html = await (await get(`/recipes/${recipeId}`)).text();
      assert.ok(html.indexOf('Pâtes</span>') < html.indexOf('Saumon</span>'));
      assert.match(html, /pièces/);
      const data = form({ title: 'Pâtes au saumon', description: 'Doubler la sauce la prochaine fois.', servings: 4, instructions: 'Enfourner 25 min à 180 °C.',
        ing_name: ['Œufs', 'Pâtes'], ing_quantity: [4, 300], ing_unit: ['pièce', 'g'] });
      data.set('photo', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n0UAAAAASUVORK5CYII=', 'base64')], 'dish.png', { type: 'image/png' }));
      const edited = await fetch(`${origin}/recipes/${recipeId}/edit`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: origin, Accept: 'text/html' }, body: data });
      assert.equal(edited.status, 303);
      const updated = await (await get(`/recipes/${recipeId}`)).text();
      assert.ok(updated.indexOf('Œufs</span>') < updated.indexOf('Pâtes</span>'));
      assert.match(updated, /Doubler la sauce la prochaine fois/);
      assert.match(await (await get(`/recipes/${recipeId}/edit`)).text(), />Commentaire<\/label>/);
      assert.match(updated, /\/uploads\/.*\.png/);
      data.set('photo', new File(['unsupported'], 'dish.heic', { type: 'image/heic' }));
      const unsupported = await fetch(`${origin}/recipes/${recipeId}/edit`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: origin, Accept: 'text/html' }, body: data });
      assert.equal(unsupported.status, 400);
      assert.match(await (await get(`/recipes/${recipeId}`)).text(), /\/uploads\/.*\.png/);
      assert.equal((await get(`/recipes/${recipeId}`, otherCookie)).status, 404);
    });

    await t.test('previews, discards and saves only approved preparation on the recipe page', async () => {
      const path = `/recipes/${recipeId}`;
      const savedRecipe = () => db.$client.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
      const savedIngredients = () => db.$client.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position').all(recipeId);
      const original = savedRecipe();
      const ingredients = savedIngredients();
      const act = (action, fields = {}, auth = cookie) => post(`${path}?/${action}`, fields, auth);
      const page = await (await get(path)).text();
      assert.match(page, /La preparazione/);
      assert.match(page, /Améliorer la recette/);
      assert.equal((await act('improvePreparation', {}, otherCookie)).status, 404);

      const preview = await act('improvePreparation');
      assert.equal(preview.status, 200);
      const proposalPage = await preview.text();
      assert.match(proposalPage, /Enfourner 25 min à 180 °C/);
      assert.match(proposalPage, /1\. Préchauffer le four à 180 °C/);
      const revision = proposalPage.match(/name="revision" value="([a-f0-9]{64})"/)?.[1];
      assert.ok(revision);
      assert.deepEqual(savedRecipe(), original);
      const cancelled = await act('discardPreparation');
      assert.equal(cancelled.status, 303);
      assert.deepEqual(savedRecipe(), original);

      const edited = { revision, instructions: '1. Préchauffer le four à 180 °C.\n2. Cuire le gratin 25 min.' };
      assert.equal((await act('savePreparation', edited, otherCookie)).status, 404);
      const saved = await act('savePreparation', edited);
      assert.equal(saved.status, 303);
      assert.equal(saved.headers.get('location'), `${path}#preparation`);
      assert.deepEqual(savedRecipe(), { ...original, instructions: edited.instructions });
      assert.deepEqual(savedIngredients(), ingredients);
      assert.equal((await act('savePreparation', { ...edited, instructions: 'Ancienne proposition' })).status, 409);
      assert.match(await (await get(path)).text(), /Cuire le gratin 25 min/);
    });

    await t.test('replaces only the photo from the recipe and checks ownership', async () => {
      const detailsPath = `/recipes/${recipeId}`;
      const html = await (await get(detailsPath)).text();
      assert.match(html, /Modifier la photo/);
      assert.match(html, /Appareil photo/);
      assert.match(html, /Galerie personnelle/);
      assert.match(html, /Galerie publique/);
      const storedRecipe = () => db.$client.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
      const storedIngredients = () => db.$client.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position').all(recipeId);
      const before = storedRecipe();
      const ingredientsBefore = storedIngredients();
      const data = new FormData();
      data.set('title', 'Ce titre ne doit pas être enregistré');
      data.set('photo', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n0UAAAAASUVORK5CYII=', 'base64')], 'new-dish.png', { type: 'image/png' }));
      const savePhoto = (auth) => fetch(`${origin}${detailsPath}?/updatePhoto`, {
        method: 'POST', headers: { Cookie: auth, Origin: origin, Accept: 'application/json', 'x-sveltekit-action': 'true' }, body: data
      });
      const denied = await (await savePhoto(otherCookie)).json();
      assert.equal(denied.status, 404);
      assert.deepEqual(storedRecipe(), before);
      assert.equal((await (await savePhoto(cookie)).json()).type, 'success');
      const after = storedRecipe();
      assert.notEqual(after.photo_path, before.photo_path);
      assert.deepEqual({ ...after, photo_path: before.photo_path }, before);
      assert.deepEqual(storedIngredients(), ingredientsBefore);
      assert.equal((await get(after.photo_path)).status, 200);
      assert.equal((await get(before.photo_path)).status, 404);
    });

    await t.test('stores 4 dinner portions and 2 lunch portions and copies them to the next week', async () => {
      for (const [dayOfWeek, meal, servings] of [[0, 'soir', 4], [1, 'midi', 2]]) {
        assert.equal((await post('/planning?/place', { recipeId, weekStart: '2099-01-05', dayOfWeek, meal, servings })).status, 200);
      }
      const placements = db.$client.prepare('SELECT * FROM meal_plan ORDER BY id').all();
      assert.deepEqual(placements.map(p => p.servings), [4, 2]);
      assert.equal((await post('/planning?/portions', { id: placements[0].id, servings: 0 })).status, 400);
      assert.equal((await post('/planning?/portions', { id: placements[0].id, servings: 10 }, otherCookie)).status, 404);
      assert.equal((await post('/planning?/portions', { id: placements[0].id, servings: 3 })).status, 200);
      assert.equal((await post('/planning?/portions', { id: placements[0].id, servings: 4 })).status, 200);
      assert.equal((await post('/planning?/move', { id: placements[0].id, dayOfWeek: 0, meal: 'soir', position: 1 })).status, 200);
      assert.equal(db.$client.prepare('SELECT servings FROM meal_plan WHERE id = ?').get(placements[0].id).servings, 4);
      await post('/planning?/copyPrevious', { weekStart: '2099-01-12' });
      await post('/planning?/copyPrevious', { weekStart: '2099-01-12' });
      assert.deepEqual(db.$client.prepare("SELECT servings FROM meal_plan WHERE week_start = '2099-01-12' ORDER BY day_of_week").all().map(p => p.servings), [4, 2]);
    });

    await t.test('generates totals for 6 portions, checks purchases and prints only pending items', async () => {
      const response = await post('/planning?/generate', { weekStart: '2099-01-05', mode: 'replace' });
      assert.equal(response.status, 303);
      const html = await (await get('/shopping')).text();
      assert.match(html, /450 g/);
      assert.match(html, /6 pièces/);
      assert.match(await (await get('/shopping/print?view=recipe')).text(), /6 portions au total/);
      assert.doesNotMatch(html, /Comment utiliser la liste de courses/);
      const ids = db.$client.prepare("SELECT id FROM shopping_items WHERE name = 'Œufs'").all().map(i => i.id).join(',');
      await post('/shopping?/toggle', { ids, checked: '1' }, otherCookie);
      assert.equal(db.$client.prepare('SELECT SUM(checked) AS count FROM shopping_items').get().count, 0);
      await post('/shopping?/toggle', { ids, checked: '1' });
      const checkedHtml = await (await get('/shopping')).text();
      assert.match(checkedHtml, /aria-checked="true"/);
      assert.doesNotMatch(checkedHtml, /Retirer les articles achetés/);
      const printed = await (await get('/shopping/print')).text();
      assert.doesNotMatch(printed, /Œufs/);
      assert.match(printed, /450 g/);
      await post('/shopping?/toggle', { ids, checked: '0' });
      assert.match(await (await get('/shopping/print')).text(), /Œufs/);
    });

    await t.test('replaces a removed shopping item with a temporary undo row', async () => {
      const itemIds = db.$client.prepare("SELECT id FROM shopping_items WHERE name = 'Pâtes'").all().map(({ id }) => id);
      const ids = itemIds.join(',');
      const readDeadline = db.$client.prepare('SELECT removed_until AS deadline FROM shopping_items WHERE id = ?');
      const readOrder = (html) => [...html.matchAll(/aria-label="([^"]+) dans le panier"/g)].map((match) => match[1]);
      const before = readOrder(await (await get('/shopping')).text());
      const startedAt = Date.now();
      assert.equal((await post('/shopping?/remove', { ids })).status, 200);
      const removedUntil = readDeadline.get(itemIds[0]).deadline;
      assert.ok(removedUntil >= startedAt + 5000 && removedUntil <= Date.now() + 5000);
      assert.ok(itemIds.every((id) => readDeadline.get(id).deadline === removedUntil));

      const removing = await (await get('/shopping')).text();
      assert.match(removing, /Annuler la suppression de Pâtes/);
      assert.deepEqual(readOrder(removing), before.filter((name) => name !== 'Pâtes'));
      assert.doesNotMatch(await (await get('/shopping/print')).text(), /Pâtes<\/span>/);
      assert.doesNotMatch(await (await get('/shopping', otherCookie)).text(), /Annuler la suppression de Pâtes/);
      await post('/shopping?/undoRemove', { ids, removedUntil }, otherCookie);
      assert.equal(readDeadline.get(itemIds[0]).deadline, removedUntil);
      await post('/shopping?/remove', { ids });
      assert.equal(readDeadline.get(itemIds[0]).deadline, removedUntil);
      await post('/shopping?/undoRemove', { ids, removedUntil });
      assert.deepEqual(readOrder(await (await get('/shopping')).text()), before);

      await post('/shopping?/remove', { ids });
      const expired = Date.now() - 1;
      const setDeadline = db.$client.prepare('UPDATE shopping_items SET removed_until = ? WHERE id = ?');
      for (const id of itemIds) setDeadline.run(expired, id);
      await post('/shopping?/undoRemove', { ids, removedUntil: expired });
      assert.doesNotMatch(await (await get('/shopping')).text(), /(?:Annuler la suppression de Pâtes|Pâtes dans le panier)/);
      assert.equal(readDeadline.get(itemIds[0]), undefined);
    });

    await t.test('filters pantry staples only when transferring recipe ingredients to shopping', async () => {
      const ing_name = ['Sel et poivre', 'Sel fin', 'Poivre noir moulu', 'Eau tiède', 'Huile d’olive extra-vierge',
        'Gros sel', 'Gros sel', 'Fleur de sel', 'Eau gazeuse', 'Huile de sésame'];
      const ing_notes = ['', '', '', '', '', 'Pour l’eau de cuisson', 'Pour la croûte'];
      const created = await post('/recipes/new', { title: 'Recette avec basiques', ing_name, ing_notes });
      assert.equal(created.status, 303);
      const path = created.headers.get('location');
      const id = Number(path.split('/').pop());
      const { code } = db.$client.prepare('SELECT code FROM recipes WHERE id = ?').get(id);
      const shoppingNames = db.$client.prepare('SELECT name FROM shopping_items WHERE recipe_id = ? ORDER BY id').pluck();
      const expected = ing_name.slice(6);

      assert.equal((await post(`${path}?/addToShopping`, {})).status, 303);
      assert.deepEqual(shoppingNames.all(id), expected);
      assert.match(await (await get(path)).text(), /Huile d’olive extra-vierge/);

      assert.equal((await post('/scan?/add', { code, force: '1' })).status, 200);
      assert.deepEqual(shoppingNames.all(id), [...expected, ...expected]);

      const weekStart = '2099-01-19';
      assert.equal((await post('/planning?/place', { recipeId: id, weekStart, dayOfWeek: 0, meal: 'midi', servings: 2 })).status, 200);
      assert.equal((await post('/planning?/generate', { weekStart, mode: 'append' })).status, 303);
      assert.deepEqual(shoppingNames.all(id), [...expected, ...expected, ...expected]);

      const base = await post('/recipes/new', { title: 'Assaisonnement', ing_name: 'Huile d’olive' });
      assert.equal(base.status, 303);
      const basePath = base.headers.get('location');
      const onlyStaples = await post(`${basePath}?/addToShopping`, {});
      assert.equal(onlyStaples.status, 200);
      assert.match(await onlyStaples.text(), /Aucun ingrédient à ajouter/);
      assert.deepEqual(shoppingNames.all(Number(basePath.split('/').pop())), []);

      assert.equal((await post('/shopping?/add', { name: 'Huile d’olive' })).status, 200);
      const manual = db.$client.prepare('SELECT name FROM shopping_items WHERE recipe_id IS NULL').pluck();
      assert.deepEqual(manual.all(), ['Huile d’olive']);
    });

    await t.test('removes all shopping rows for one recipe, even with a shared ingredient and title', async () => {
      const response = await post('/recipes/new', { title: 'Pâtes au saumon',
        ing_name: ['Pâtes', 'Champignons'], ing_quantity: [125, 250], ing_unit: ['g', 'g'] });
      assert.equal(response.status, 303);
      const homonymId = Number(response.headers.get('location').split('/').pop());
      for (const id of [recipeId, recipeId, homonymId]) {
        assert.equal((await post(`/recipes/${id}?/addToShopping`, { force: 1 })).status, 303);
      }
      await post('/shopping?/add', { name: 'Pâtes', quantity: 50, unit: 'g' });
      const print = async () => (await get('/shopping/print')).text();
      assert.match(await print(), /775 g/);

      const recipeRows = db.$client.prepare('SELECT id FROM shopping_items WHERE recipe_id = ?');
      const before = recipeRows.all(recipeId);
      await post('/shopping?/removeRecipe', { recipeId }, otherCookie);
      assert.deepEqual(recipeRows.all(recipeId), before);
      await post('/shopping?/remove', { id: before[0].id });
      await post('/shopping?/toggle', { id: before[1].id, checked: 1 });
      assert.equal((await post('/shopping?/removeRecipe', { recipeId })).status, 200);
      assert.deepEqual(recipeRows.all(recipeId), []);
      assert.equal(recipeRows.all(homonymId).length, 2);
      assert.match(await print(), /175 g/);
      assert.match(await print(), /Champignons/);
      assert.equal((await get(`/recipes/${recipeId}`)).status, 200);

      const insertSnapshot = db.$client.prepare("INSERT INTO shopping_items (user_id, recipe_title, name) SELECT id, 'Pâtes au saumon', 'Saumon' FROM users WHERE username = ?");
      insertSnapshot.run('feedback');
      insertSnapshot.run('other');
      assert.equal((await post('/shopping?/removeRecipe', { recipeTitle: 'Pâtes au saumon' })).status, 200);
      assert.doesNotMatch(await print(), />Saumon<\/span>/);
      assert.match(await (await get('/shopping/print', otherCookie)).text(), />Saumon<\/span>/);
      assert.match(await print(), /175 g/);
    });

    await t.test('requires confirmation to clear shopping and only clears the current account', async () => {
      const html = await (await get('/shopping')).text();
      assert.match(html, /Vider la liste de courses \?/);
      assert.match(html, /name="confirmed" value="1"/);
      assert.equal((await post('/shopping?/clearAll', {})).status, 400);
      assert.match(await (await get('/shopping')).text(), /Champignons dans le panier/);
      assert.equal((await post('/shopping?/clearAll', { confirmed: 1 })).status, 200);
      assert.match(await (await get('/shopping')).text(), /Liste vide/);
      assert.match(await (await get('/shopping', otherCookie)).text(), /Saumon dans le panier/);
    });

    await t.test('shares household purchases across Maison, shopping, planning and print', async () => {
      const read = db.$client.prepare('SELECT * FROM shopping_items WHERE id = ?');
      const household = db.$client.prepare('SELECT * FROM shopping_items WHERE name = ? AND is_household = 1');
      const maison = async (auth) => (await get('/maison', auth)).text();
      const shopping = async () => (await get('/shopping')).text();
      const print = async (view) => (await get(`/shopping/print?view=${view}`)).text();

      assert.equal((await post('/maison?/add', { name: ' ' })).status, 400);
      assert.equal((await post('/maison?/add', { name: 'Lessive', quantity: '-1' })).status, 400);
      assert.equal((await post('/maison?/add', { name: ' Lessive ', quantity: '1,5', unit: 'L' })).status, 303);
      const { id } = household.get('Lessive');
      assert.match(await maison(), /À acheter[\s\S]*Lessive[\s\S]*1,5 l/);
      assert.match(await shopping(), /<h2[^>]*>Maison<\/h2>[\s\S]*Lessive dans le panier/);
      for (const view of ['ingredient', 'recipe']) {
        assert.match(await print(view), /<h2[^>]*>Maison<\/h2>[\s\S]*Lessive<\/span>/);
      }

      assert.doesNotMatch(await maison(otherCookie), /Marquer Lessive comme acheté/);
      assert.equal((await post('/maison?/edit', { id, name: 'Inaccessible' }, otherCookie)).status, 404);
      await post('/maison?/toggle', { id, checked: 1 }, otherCookie);
      await post('/maison?/remove', { id }, otherCookie);
      assert.equal(read.get(id).checked, 0);
      assert.equal(read.get(id).removed_until, null);
      assert.equal((await post('/maison?/edit', { id, name: 'Lessive', quantity: 2, unit: 'L' })).status, 303);
      assert.match(await shopping(), /Lessive dans le panier[\s\S]*2 l/);

      await post('/shopping?/toggle', { id, checked: 1 });
      assert.match(await maison(), /<h2[^>]*>Achetés<\/h2>[\s\S]*Racheter Lessive/);
      assert.doesNotMatch(await print('recipe'), /Lessive<\/span>/);
      await post('/maison?/add', { name: 'Papier toilette' });
      await post('/shopping?/clearAll', { confirmed: 1 });
      assert.match(await shopping(), /Papier toilette dans le panier/);
      assert.doesNotMatch(await shopping(), /Lessive dans le panier/);
      assert.ok(read.get(id).archived_at);
      assert.match(await maison(), /Racheter Lessive/);
      await post('/maison?/toggle', { id, checked: 0 });
      await post('/maison?/toggle', { id, checked: 0 });
      assert.equal(read.get(id).archived_at, null);
      assert.equal(read.get(id).quantity, 2);
      assert.equal(household.all('Lessive').length, 1);
      assert.match(await print('ingredient'), /Lessive<\/span>/);

      await post('/maison?/add', { name: 'Œufs', quantity: 2, unit: 'pièce' });
      const eggs = household.get('Œufs').id;
      await post('/maison?/toggle', { id, checked: 1 });
      assert.equal((await post('/planning?/generate', { weekStart: '2099-01-05', mode: 'replace' })).status, 303);
      assert.ok(read.get(id).archived_at);
      assert.match(await maison(), /Racheter Lessive/);
      assert.match(await shopping(), /Papier toilette dans le panier/);
      assert.equal((await shopping()).match(/Œufs dans le panier/g).length, 2);
      await post('/shopping?/toggle', { id: eggs, checked: 1 });
      assert.match(await print('recipe'), /Œufs<\/span>/);
      assert.equal((await shopping()).match(/aria-checked="true" aria-label="Œufs dans le panier"/g).length, 1);

      await post('/maison?/remove', { id: eggs });
      const removedUntil = read.get(eggs).removed_until;
      assert.match(await shopping(), /Annuler la suppression de Œufs/);
      await post('/shopping?/undoRemove', { id: eggs, removedUntil }, otherCookie);
      assert.equal(read.get(eggs).removed_until, removedUntil);
      await post('/shopping?/undoRemove', { id: eggs, removedUntil });
      assert.match(await maison(), /Racheter Œufs/);
      await post('/shopping?/remove', { id: eggs });
      await post('/maison?/undoRemove', { id: eggs, removedUntil: read.get(eggs).removed_until });
      assert.match(await maison(), /Racheter Œufs/);
      await post('/shopping?/remove', { id: eggs });
      const expired = Date.now() - 1;
      db.$client.prepare('UPDATE shopping_items SET removed_until = ? WHERE id = ?').run(expired, eggs);
      await post('/maison?/undoRemove', { id: eggs, removedUntil: expired });
      assert.doesNotMatch(await maison(), /Racheter Œufs|Annuler la suppression de Œufs/);
      assert.equal(read.get(eggs), undefined);
      assert.match(await shopping(), /Œufs dans le panier/);
    });

    await t.test('explains OCR entry points and shows camera, gallery and search controls', async () => {
      assert.match(await (await get('/scan')).text(), /Importer une recette papier/);
      const html = await (await get('/recipes/new')).text();
      assert.match(html, /Prendre une photo du plat/);
      assert.match(html, /Choisir dans la galerie/);
      assert.match(html, /Rechercher une image/);
      assert.match(html, /fiche personnelle/);
      assert.match(html, /Importer le lien/);
      assert.match(html, /Ajouter des images/);
      assert.match(html, />Commentaire<\/label>/);
      assert.equal((await post('/recipes/ocr', {})).status, 400);
    });

    await t.test('OCR endpoint returns reviewed suggestions and a usable original when review fails', async () => {
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n0UAAAAASUVORK5CYII=', 'base64');
      for (const marker of ['', 'review-unavailable']) {
        const data = new FormData();
        data.set('image', new File([image, marker], 'recipe.png', { type: 'image/png' }));
        const response = await fetch(`${origin}/recipes/ocr`, { method: 'POST', headers: { Cookie: cookie, Origin: origin }, body: data });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.recipe.instructions, '');
        assert.ok(!Object.hasOwn(result.recipe, 'description'));
        assert.ok(!Object.hasOwn(result.original.recipe, 'description'));
        assert.equal(result.review.status, marker ? 'unavailable' : 'complete');
        assert.equal(result.original.ingredients.length, 3);
        if (marker) {
          assert.equal(result.ingredients.length, 3);
          assert.match(result.warnings[0], /OCR reste utilisable/);
        } else {
          assert.equal(result.ingredients.length, 2);
          assert.equal(result.recipe.servings, 4);
          assert.equal(result.ingredients[0].quantity, 320);
          assert.match(result.review.changes.join(' '), /Retrait proposé/);
        }
      }
    });

    await t.test('imports an ordered set of captures as a single recipe', async () => {
      const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAHAAkBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AL+P/9k=', 'base64');
      const data = new FormData();
      data.append('image', new File([jpeg], 'ingredients.jpg', { type: 'image/jpeg' }));
      data.append('image', new File([jpeg], 'preparation.jpg', { type: 'image/jpeg' }));
      const response = await fetch(`${origin}/recipes/ocr`, { method: 'POST', headers: { Cookie: cookie, Origin: origin }, body: data });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.recipe.title, 'Pâtes à la tomate');
      assert.equal(result.recipe.instructions, '1. Préparer la sauce.\n2. Cuire les pâtes et mélanger.');
      assert.equal(result.ingredients.length, 2);
      assert.match(result.ocrText, /600 g de tomates\n\n1. Préparer/);
    });

    await t.test('async OCR imports are resumable, isolated and do not run duplicate analyses', async () => {
      const id = randomUUID();
      const statusPath = `/recipes/ocr?job=${id}`;
      assert.equal((await get(statusPath)).status, 404);
      const data = new FormData();
      data.set('image', new File([Buffer.from([137,80,78,71,13,10,26,10]), 'slow-import'], 'recipe.png', {type: 'image/png'}));
      const start = await fetch(`${origin}/recipes/ocr?mode=async`, {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'X-Import-Id': id}, body: data});
      assert.equal(start.status, 202);
      assert.equal((await start.json()).status, 'processing');
      assert.equal((await get(statusPath, otherCookie)).status, 404);
      const repeat = await fetch(`${origin}/recipes/ocr?mode=async`, {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'X-Import-Id': id}});
      assert.ok([200, 202].includes(repeat.status));
      assert.equal((await repeat.json()).error, undefined);
      const busy = await fetch(`${origin}/recipes/ocr?mode=async`, {method: 'POST', headers: {Cookie: otherCookie, Origin: origin, 'X-Import-Id': randomUUID()}, body: data});
      assert.equal(busy.status, 429);
      let completed;
      for (let i = 0; i < 100; i++) {
        const response = await get(statusPath);
        assert.match(response.headers.get('cache-control'), /no-store/);
        const result = await response.json();
        if (result.status === 'complete') { completed = result; break; }
        assert.equal(response.status, 202);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(completed.result.review.status, 'complete');
      assert.equal(completed.result.ingredients[0].quantity, 320);
      const cached = await fetch(`${origin}/recipes/ocr?mode=async`, {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'X-Import-Id': id}});
      assert.equal(cached.status, 200);
      assert.deepEqual(await cached.json(), completed);
      const bad = await fetch(`${origin}/recipes/ocr?mode=async`, {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'X-Import-Id': 'invalid'}});
      assert.equal(bad.status, 400);
    });

    await t.test('searches and imports a real Commons photo with attribution', { skip: process.env.LIVE_COMMONS !== '1' }, async () => {
      const muffins = await get('/recipes/images?q=muffins');
      assert.equal(muffins.status, 200);
      assert.ok((await muffins.json()).images.length > 0);
      const response = await get('/recipes/images?q=muffins%20banane%20chocolat');
      assert.equal(response.status, 200);
      const { images } = await response.json();
      assert.ok(images.length > 0);
      const created = await post('/recipes/new', { title: 'Illustration test', servings: 2, ing_name: 'Pâtes', ing_quantity: 100, ing_unit: 'g', photo_commons_id: images[0].pageId });
      assert.equal(created.status, 303);
      const html = await (await get(created.headers.get('location'))).text();
      assert.match(html, /commons\.wikimedia\.org/);
      assert.match(html, /CC BY|CC0|Public domain/);
      const stored = db.$client.prepare("SELECT photo_path, photo_credit, photo_source FROM recipes WHERE title = 'Illustration test'").get();
      assert.ok(stored.photo_path.startsWith('/uploads/'));
      assert.ok(stored.photo_credit.length > 0);
      assert.equal((await get(stored.photo_path)).status, 200);
    });
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
    db?.$client.close();
    if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous;
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'bananani-http-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
