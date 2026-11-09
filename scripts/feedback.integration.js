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
    const password = 'local-test-only';
    await createUser('feedback', hashPassword(password));
    await createUser('other', hashPassword(password));
    // Let the OS allocate a free loopback port.
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['--import', pathToFileURL(resolve('scripts/fixtures/mistral-preload.js')).href, 'build/index.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin, MISTRAL_API_KEY: 'http-test-only' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
      const data = form({ title: 'Pâtes au saumon', servings: 4, ing_name: ['Œufs', 'Pâtes'], ing_quantity: [4, 300], ing_unit: ['pièce', 'g'] });
      data.set('photo', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n0UAAAAASUVORK5CYII=', 'base64')], 'dish.png', { type: 'image/png' }));
      const edited = await fetch(`${origin}/recipes/${recipeId}/edit`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: origin, Accept: 'text/html' }, body: data });
      assert.equal(edited.status, 303);
      const updated = await (await get(`/recipes/${recipeId}`)).text();
      assert.ok(updated.indexOf('Œufs</span>') < updated.indexOf('Pâtes</span>'));
      assert.match(updated, /\/uploads\/.*\.png/);
      data.set('photo', new File(['unsupported'], 'dish.heic', { type: 'image/heic' }));
      const unsupported = await fetch(`${origin}/recipes/${recipeId}/edit`, { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: origin, Accept: 'text/html' }, body: data });
      assert.equal(unsupported.status, 400);
      assert.match(await (await get(`/recipes/${recipeId}`)).text(), /\/uploads\/.*\.png/);
      assert.equal((await get(`/recipes/${recipeId}`, otherCookie)).status, 404);
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
      assert.match(html, /Case vide : à acheter/);
      const ids = db.$client.prepare("SELECT id FROM shopping_items WHERE name = 'Œufs'").all().map(i => i.id).join(',');
      await post('/shopping?/toggle', { ids, checked: '1' }, otherCookie);
      assert.equal(db.$client.prepare('SELECT SUM(checked) AS count FROM shopping_items').get().count, 0);
      await post('/shopping?/toggle', { ids, checked: '1' });
      const printed = await (await get('/shopping/print')).text();
      assert.doesNotMatch(printed, /Œufs/);
      assert.match(printed, /450 g/);
      await post('/shopping?/toggle', { ids, checked: '0' });
      assert.match(await (await get('/shopping/print')).text(), /Œufs/);
      await post('/shopping?/toggle', { ids, checked: '1' });
      await post('/shopping?/clearChecked', {});
      assert.equal(db.$client.prepare("SELECT COUNT(*) AS count FROM shopping_items WHERE name = 'Œufs'").get().count, 0);
      assert.equal(db.$client.prepare("SELECT SUM(quantity) AS total FROM shopping_items WHERE name = 'Pâtes'").get().total, 450);
    });

    await t.test('explains OCR entry points and shows camera, gallery and search controls', async () => {
      assert.match(await (await get('/scan')).text(), /Importer une recette papier/);
      const html = await (await get('/recipes/new')).text();
      assert.match(html, /Prendre une photo du plat/);
      assert.match(html, /Choisir dans la galerie/);
      assert.match(html, /Rechercher une image/);
      assert.match(html, /fiche personnelle/);
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

    await t.test('searches and imports a real Commons photo with attribution', { skip: process.env.LIVE_COMMONS !== '1' }, async () => {
      const response = await get('/recipes/images?q=lasagna');
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
