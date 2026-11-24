import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchRecipeImages, importRecipeImage } from '../src/lib/server/recipe-images.js';

const page = { pageid: 42, title: 'File:Lasagnes.jpg', imageinfo: [{ mime: 'image/jpeg',
  thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/test.jpg/330px-test.jpg',
  extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a>Camille &amp; Co</a>' } } }] };
const result = (pages) => Response.json({ query: { pages: Object.fromEntries(pages.map((p, i) => [i, p])) } });

test('search returns official images with attribution and filters unsafe or unsupported results', async () => {
  const images = await searchRecipeImages('Lasagnes', async url => {
    assert.equal(url.hostname, 'commons.wikimedia.org');
    assert.equal(url.searchParams.get('gsrnamespace'), '6');
    assert.equal(url.searchParams.get('iiurlwidth'), '330');
    return result([page,
      { ...page, imageinfo: [{ ...page.imageinfo[0], thumburl: 'https://example.com/image.jpg' }] },
      { ...page, imageinfo: [{ ...page.imageinfo[0], thumburl: 'https://thumb.wikimedia.org:8443/wikipedia/commons/test.jpg' }] },
      { ...page, imageinfo: [{ ...page.imageinfo[0], mime: 'image/svg+xml' }] },
      { ...page, imageinfo: [{ ...page.imageinfo[0], extmetadata: {} }] }]);
  });
  assert.equal(images.length, 1);
  assert.equal(new URL(images[0].url).hostname, 'thumb.wikimedia.org');
  assert.equal(images[0].author, 'Camille & Co');
  assert.equal(images[0].source, 'https://commons.wikimedia.org/?curid=42');
});

test('retries French variants and keeps the main search term as a fallback', async () => {
  const queries = [];
  const images = await searchRecipeImages('muffins banane chocolat', async url => {
    const query = url.searchParams.get('gsrsearch');
    queries.push(query);
    return result(query.startsWith('muffins banane~ chocolat~ ') ? [page] : []);
  });
  assert.equal(images.length, 1);
  assert.deepEqual(queries, ['muffins banane chocolat filetype:bitmap', 'muffins banane~ chocolat~ filetype:bitmap']);
  const broader = await searchRecipeImages('lasagnes maison', async url => {
    const query = url.searchParams.get('gsrsearch');
    if (query.includes('~')) return Response.json({ error: { code: 'cirrussearch-too-busy-error' } });
    return result(query === 'lasagnes filetype:bitmap' ? [page] : []);
  });
  assert.equal(broader.length, 1);
});

test('import rechecks metadata and stores a bounded image with credit', async () => {
  const image = await importRecipeImage(42, async (url, options) => {
    if (String(url).startsWith('https://commons.')) {
      assert.equal(url.searchParams.get('iiurlwidth'), '960');
      return result([page]);
    }
    assert.equal(options.redirect, 'error');
    return new Response('jpeg-bytes', { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.equal(image.file.name, 'commons-42.jpg');
  assert.match(image.credit, /Camille & Co — CC BY-SA 4.0/);
  assert.equal(await image.file.text(), 'jpeg-bytes');
});

test('rejects invalid ids, large images and upstream errors without exposing details', async () => {
  for (const id of ['https://localhost', 0, -1, 1.5]) await assert.rejects(importRecipeImage(id), /invalide/);
  await assert.rejects(searchRecipeImages('a'), /100 caractères/);
  await assert.rejects(searchRecipeImages('lasagne', async () => new Response('secret', { status: 500 })), /indisponible/);
  await assert.rejects(importRecipeImage(42, async url => String(url).startsWith('https://commons.') ? result([page])
    : new Response('x', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(6 * 1024 * 1024) } })), /5 Mo/);
});
