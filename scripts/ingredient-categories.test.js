import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCategories, suggestCategories } from '../src/lib/server/ingredient-categories.js';

test('deduplicates names and reuses custom catalogue categories', () => {
  const result = prepareCategories(['Sel', 'sel', 'farine'], [{ normalizedKey: 'sel', category: 'Épices & condiments' }, { normalizedKey: 'farine', category: 'Inventé' }]);
  assert.equal(result.length, 2);
  assert.equal(result[0].category, 'Épices & condiments');
  assert.equal(result[1].category, 'Inventé');
});
test('rejects oversized and malformed input', () => {
  for (const names of [null, [null], [''], ['x'.repeat(201)], Array(101).fill('sel')]) assert.throws(() => prepareCategories(names, []));
});
test('does not call Mistral when catalogue covers everything', async () => {
  const entries = prepareCategories(['sel'], [{ normalizedKey: 'sel', category: 'Épices & condiments' }]);
  assert.deepEqual(await suggestCategories(entries, '', () => { throw Error('Unexpected call'); }), entries);
});
test('batches only unknown names and validates model categories and ids', async () => {
  const entries = prepareCategories(['sel', 'farine', 'mystère'], [{ normalizedKey: 'sel', category: 'Épices & condiments' }]);
  let calls = 0;
  const result = await suggestCategories(entries, 'test', async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.mistral.ai/v1/chat/completions');
    assert.deepEqual(JSON.parse(JSON.parse(options.body).messages[1].content), [{ id: 0, name: 'farine' }, { id: 1, name: 'mystère' }]);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ suggestions: [{ id: 0, category: 'Épicerie salée' }, { id: 1, category: 'Inventé' }, { id: 50, category: 'Boissons' }] }) } }] });
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.map(i => i.category), ['Épices & condiments', 'Épicerie salée', '']);
});
test('rejects provider errors without exposing response details', async () => {
  await assert.rejects(suggestCategories(prepareCategories(['farine'], []), 'secret', async () => new Response('private', { status: 401 })), /manuellement/);
});
