import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, extractRecipe } from '../src/lib/server/recipe-ocr.js';

const sample = { isRecipe: true, title: 'Crêpes', servings: null, instructions: 'Cuire.', ingredients: [{ name: 'farine', quantity: 0.5, unit: 'tasse', notes: 'tamisée' }] };
test('preserves fractions and unsupported units without inventing portions', () => {
  const result = validateRecipe(sample);
  assert.equal(result.recipe.servings, '');
  assert.equal(result.ingredients[0].quantity, 0.5);
  assert.equal(result.ingredients[0].unit, '');
  assert.equal(result.ingredients[0].notes, 'tasse · tamisée');
});
test('rejects non-recipes and malformed ingredients', () => {
  for (const value of [null, {}, { ...sample, isRecipe: false }, { ...sample, ingredients: [null] }]) assert.throws(() => validateRecipe(value));
});
test('does not coerce invented or invalid quantities', () => {
  for (const quantity of [null, -1, '12', Infinity]) assert.equal(validateRecipe({ ...sample, ingredients: [{ name: 'sel', quantity, unit: 'g' }] }).ingredients[0].quantity, '');
});
test('extracts annotations and sends image only to Mistral', async () => {
  const result = await extractRecipe(Buffer.from('image'), 'image/png', 'test-secret', async (url, options) => {
    assert.equal(url, 'https://api.mistral.ai/v1/ocr');
    const body = JSON.parse(options.body);
    assert.equal(body.document.type, 'image_url');
    assert.equal(body.document_annotation_format.type, 'json_schema');
    return Response.json({ document_annotation: JSON.stringify(sample) });
  });
  assert.equal(result.recipe.title, 'Crêpes');
});
test('provider failures never disclose upstream details', async () => {
  await assert.rejects(extractRecipe(Buffer.from('x'), 'image/png', 'secret', async () => new Response('sensitive', { status: 401 })), /accès Mistral/);
  await assert.rejects(extractRecipe(Buffer.from('x'), 'image/png', 'secret', async () => Response.json({ document_annotation: 'invalid' })), /illisible/);
});
