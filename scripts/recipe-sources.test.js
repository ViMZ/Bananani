import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { importRecipe } from '../src/lib/recipes/import.js';
import { combineRecipeCaptures } from '../src/lib/server/recipe-captures.js';
import { extractLinkedRecipe, isPublicAddress, parseRecipeUrl } from '../src/lib/server/recipe-link.js';
import { readRecipeDocument } from '../src/lib/server/recipe-ocr.js';

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAHAAkBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AL+P/9k=', 'base64');

test('reads a complete linked recipe from schema.org, preserving ingredient and step order', () => {
  const schema = { '@graph': [{ '@type': 'Article' }, {
    '@type': ['Thing', 'https://schema.org/Recipe'],
    name: 'Gâteau &amp; pommes',
    author: [{ name: 'Marie' }],
    recipeYield: ['4 personnes', '1 gâteau'],
    recipeIngredient: ['250 g de farine', '1½ c. à s. d’huile', '2 à 3 pommes', '½ tasse de sucre'],
    recipeInstructions: [
      { '@type': 'HowToSection', name: 'Préparation', itemListElement: [
        { '@type': 'HowToStep', text: 'Tamiser la farine.<br>Ajouter l’huile.' },
        { '@type': 'HowToStep', text: 'Incorporer les pommes.' }
      ] },
      { '@type': 'HowToStep', text: 'Cuire à 180 °C pendant 25 minutes.' }
    ]
  }] };
  const html = '<script type="application/ld+json">malformed</script>' +
    '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>';
  const result = extractLinkedRecipe(html);
  assert.equal(result.recipe.title, 'Gâteau & pommes');
  assert.equal(result.recipe.owner, 'Marie');
  assert.equal(result.recipe.servings, 4);
  assert.equal(result.recipe.instructions,
    'Préparation\n\nTamiser la farine.\nAjouter l’huile.\n\nIncorporer les pommes.\n\nCuire à 180 °C pendant 25 minutes.');
  assert.deepEqual(result.ingredients, [
    { name: 'farine', quantity: 250, unit: 'g', notes: '' },
    { name: 'huile', quantity: 1.5, unit: 'c. à soupe', notes: '' },
    { name: '2 à 3 pommes', quantity: '', unit: '', notes: '' },
    { name: 'sucre', quantity: '', unit: '', notes: '1/2 tasse' }
  ]);
});

test('points to captures when the page offers no complete recipe', () => {
  assert.throws(() => extractLinkedRecipe(
    '<script type="application/ld+json">{"@type":"Recipe","name":"Pâtes","recipeIngredient":["Pâtes"]}</script>'
  ), /importer tes captures/);
});

test('rejects unsuitable URL schemes and private or special-use addresses', () => {
  for (const url of ['file:///tmp/recipe', 'https://user:password@example.com', 'https://example.com:8443',
    'http://127.0.0.1', 'http://[::1]', 'http://localhost']) {
    assert.throws(() => parseRecipeUrl(url), /page publique/);
  }
  assert.equal(parseRecipeUrl('https://example.com/recipe#steps').href, 'https://example.com/recipe');
  for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '192.0.0.1', '198.18.0.1',
    '::1', '::ffff:127.0.0.1', 'fe80::1', 'fdaa::1', '2001:db8::1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700::1111'), true);
});

test('posts captures in displayed order and sends a link without images', async () => {
  const id = 'c8f62001-de30-4374-9436-f5f9bf53ab26';
  const first = new File([jpeg], 'ingredients.jpg', { type: 'image/jpeg' });
  const second = new File([jpeg], 'preparation.jpg', { type: 'image/jpeg' });
  for (const source of [[first, second], 'https://example.com/recipe']) {
    await importRecipe(source, { id, fetcher: async (_, request) => {
      if (request.method !== 'POST') return Response.json({}, { status: 404 });
      assert.equal(request.body.get('url'), typeof source === 'string' ? source : null);
      assert.deepEqual(request.body.getAll('image').map(file => file.name),
        Array.isArray(source) ? ['ingredients.jpg', 'preparation.jpg'] : []);
      return Response.json({ status: 'complete', result: { recipe: { title: 'Pâtes' }, ingredients: [] } });
    } });
  }
});

test('sends one ordered PDF to Mistral and rejects a scan with missing pages', async () => {
  const second = Buffer.from(jpeg);
  const frame = second.indexOf(Buffer.from([0xff, 0xc0]));
  second.writeUInt16BE(5, frame + 7);
  const pdf = await combineRecipeCaptures([jpeg, second]);
  const fakeOcr = async (_, request) => {
    const { document, document_annotation_prompt: prompt } = JSON.parse(request.body);
    assert.equal(document.type, 'document_url');
    assert.match(document.document_url, /^data:application\/pdf;base64,/);
    assert.match(prompt, /Lis toutes les pages dans l’ordre/);
    const received = await PDFDocument.load(Buffer.from(document.document_url.split(',')[1], 'base64'));
    assert.deepEqual(received.getPages().map(page => page.getWidth()), [9, 5]);
    return Response.json({ pages: [{ markdown: 'Ingrédients' }, { markdown: 'Préparation' }] });
  };
  assert.equal((await readRecipeDocument(pdf, 'application/pdf', 'test', fakeOcr, 2)).text, 'Ingrédients\n\nPréparation');
  await assert.rejects(readRecipeDocument(pdf, 'application/pdf', 'test', async () =>
    Response.json({ pages: [{ markdown: 'Ingrédients' }] }), 2), /Toutes les captures/);
});
