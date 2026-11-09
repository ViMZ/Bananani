import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRecipe, reviewRecipe, validateReview, REVIEW_MODEL } from '../src/lib/server/recipe-review.js';
import { validateRecipe } from '../src/lib/server/recipe-ocr.js';
import { CATEGORIES } from '../src/lib/ingredients/categories.js';

const annotation = { isRecipe: true, title: 'Pâtes à la tomate', description: '', owner: '', servings: null, instructions: '',
  ingredients: [{ name: 'Pâtes', quantity: null, unit: '', notes: '' }, { name: 'Tomates', quantity: null, unit: '', notes: '' }, { name: 'Imprimer ce document', quantity: null, unit: '', notes: '' }] };
const row = (sourceIds, name, quantity, unit, category = 'Épicerie salée') => ({ sourceIds, name, quantity, unit, categoryId: CATEGORIES.indexOf(category), notes: '', brand: '', productReference: '' });
const reviewed = { ...annotation, description: 'Pâtes avec une sauce tomate maison.', servings: 4,
  instructions: '1. Cuire les pâtes.\n2. Préparer la sauce et mélanger.',
  ingredients: [row([0], 'Pâtes', 320, 'g'), row([1], 'Tomates', 600, 'g', 'Fruits & légumes')],
  explanations: ['Quantités et portions estimées pour quatre personnes.', 'Le pied de page ne fait pas partie des ingrédients.'] };
const original = validateRecipe(annotation);
const source = { text: 'Pâtes à la tomate\nPâtes\nTomates\nImprimer ce document', recipe: original.recipe,
  ingredients: original.ingredients.map((i, id) => ({ ...i, id, brand: '', productReference: '', category: '' })) };
const chatResponse = value => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });

test('runs OCR then a structured culinary review using only extracted text', async () => {
  const calls = [];
  const result = await analyzeRecipe(Buffer.from('photo'), 'image/jpeg', 'secret', async (url, options) => {
    calls.push(url);
    const request = JSON.parse(options.body);
    if (url.endsWith('/ocr')) return Response.json({ document_annotation: annotation, pages: [{ markdown: source.text }] });
    assert.equal(url, 'https://api.mistral.ai/v1/chat/completions');
    assert.equal(request.model, REVIEW_MODEL);
    assert.equal(request.response_format.type, 'json_schema');
    const data = JSON.parse(request.messages[1].content);
    assert.equal(data.text, source.text);
    assert.equal(data.ingredients[0].quantity, null);
    assert.doesNotMatch(options.body, /data:image|c2VjcmV0/);
    assert.match(request.messages[0].content, /jamais des instructions/);
    return chatResponse(reviewed);
  });
  assert.equal(calls.length, 2);
  assert.equal(result.recipe.servings, 4);
  assert.equal(result.ingredients.length, 2);
  assert.equal(result.original.ingredients.length, 3);
  assert.equal(result.original.recipe.servings, '');
  assert.equal(result.ingredients[0].quantity, 320);
  assert.equal(result.ingredients[0].category, 'Épicerie salée');
  assert.ok(result.ingredients[0].suggestedFields.includes('quantity'));
  assert.ok(result.review.suggestedFields.includes('servings'));
  assert.ok(result.review.suggestedFields.includes('instructions'));
  assert.match(result.review.changes.join('\n'), /Retrait proposé : Imprimer ce document/);
});

test('does not label unchanged facts as suggestions and flags changes even if model omits explanations', () => {
  const knownSource = structuredClone(source);
  knownSource.recipe.servings = 4;
  knownSource.ingredients[0].quantity = 320;
  knownSource.ingredients[0].unit = 'g';
  const result = validateReview({ ...reviewed, explanations: [] }, knownSource);
  assert.ok(!result.review.suggestedFields.includes('title'));
  assert.ok(!result.review.suggestedFields.includes('servings'));
  assert.ok(!result.ingredients[0].suggestedFields.includes('quantity'));
  assert.ok(!result.ingredients[0].suggestedFields.includes('unit'));
  assert.ok(result.ingredients[1].suggestedFields.includes('quantity'));
  assert.match(result.review.changes.join(' '), /Retrait proposé/);
});

test('traces split ingredients, proposed additions and numeric corrections', () => {
  const split = { ...reviewed, ingredients: [row([0], 'Pâtes', 320, 'g'), row([1], 'Tomates fraîches', 300, 'g'), row([1], 'Tomates en conserve', 300, 'g'), row([], 'Huile d’olive', 2, 'c. à soupe')] };
  const result = validateReview(split, source);
  assert.equal(result.ingredients.length, 4);
  assert.ok(result.ingredients[3].suggestedFields.includes('name'));
  assert.match(result.review.changes.join(' '), /Ajout proposé : Huile/);
  assert.ok(!result.review.changes.some(c => c === 'Retrait proposé : Tomates.'));
});

test('keeps alternatives as one grocery line without mutating source or model output', () => {
  const choices = structuredClone(source);
  choices.ingredients[1].name = 'Tomates ou sauce tomate';
  const proposal = { ...reviewed, ingredients: [row([0], 'Pâtes', 320, 'g'), row([1], 'Tomates', 400, 'g'), row([1], 'Sauce tomate', 200, 'g')], explanations: ['categoryId 5 choisi.'] };
  const result = validateReview(proposal, choices);
  assert.equal(result.ingredients.length, 2);
  assert.equal(result.ingredients[1].name, 'Tomates ou sauce tomate');
  assert.equal(result.ingredients[1].quantity, 400);
  assert.match(result.ingredients[1].notes, /une seule alternative/);
  assert.match(result.ingredients[1].notes, /Sauce tomate : 200 g/);
  assert.ok(!result.review.explanations.some(v => /categoryId/.test(v)));
  assert.equal(proposal.ingredients.length, 3);
  assert.equal(choices.ingredients[1].name, 'Tomates ou sauce tomate');
});

test('discards invented dietary claims while preserving explicit source constraints', () => {
  const proposal = { ...reviewed, title: 'Pâtes végétariennes', description: 'Version sans lactose.',
    ingredients: [{ ...reviewed.ingredients[0], notes: 'Remplacer par du lait végétal.' }], explanations: ['Adaptation sans lactose.'] };
  const result = validateReview(proposal, source);
  assert.equal(result.recipe.title, source.recipe.title);
  assert.equal(result.recipe.description, '');
  assert.equal(result.ingredients[0].notes, '');
  assert.ok(result.review.explanations.some(v => /écartée/.test(v)));
  const explicit = { ...source, text: source.text + '\nVersion sans lactose.' };
  assert.equal(validateReview(proposal, explicit).recipe.description, 'Version sans lactose.');
});

test('rejects invalid references, units, portions and malformed model values', () => {
  for (const patch of [{ sourceIds: [99] }, { sourceIds: [0, 0] }, { unit: 'tasse' }, { categoryId: 99 }, { categoryId: '5' },
    { quantity: Infinity }, { quantity: -1 }, { quantity: '300' }, { quantity: 1000001 }, { quantity: null, unit: 'g' }, { name: '' }]) {
    assert.throws(() => validateReview({ ...reviewed, ingredients: [{ ...reviewed.ingredients[0], ...patch }] }, source));
  }
  for (const patch of [{ servings: 0 }, { servings: 51 }, { ingredients: [] }, { explanations: [null] }, { title: null }, { isRecipe: false }]) assert.throws(() => validateReview({ ...reviewed, ...patch }, source));
});

test('keeps usable OCR when review fails, times out or returns invalid JSON', async () => {
  for (const fail of [async () => new Response('private upstream detail', { status: 503 }),
    async () => { throw new DOMException('private detail', 'TimeoutError'); },
    async () => Response.json({ choices: [{ message: { content: 'invalid-json' } }] })]) {
    const result = await analyzeRecipe(Buffer.from('photo'), 'image/jpeg', 'secret', async (url, options) => url.endsWith('/ocr')
      ? Response.json({ document_annotation: annotation }) : fail());
    assert.equal(result.review.status, 'unavailable');
    assert.deepEqual(result.ingredients, original.ingredients);
    assert.match(result.warnings[0], /OCR reste utilisable/);
    assert.doesNotMatch(JSON.stringify(result), /private|secret/);
  }
});

test('can recover from missing structured OCR using markdown, but cannot manufacture a recipe from nothing', async () => {
  const result = await analyzeRecipe(Buffer.from('photo'), 'image/jpeg', 'test', async url => url.endsWith('/ocr')
    ? Response.json({ document_annotation: 'bad-json', pages: [{ markdown: source.text }] })
    : chatResponse({ ...reviewed, ingredients: reviewed.ingredients.map(i => ({ ...i, sourceIds: [] })) }));
  assert.equal(result.original, null);
  assert.equal(result.review.status, 'complete');
  await assert.rejects(analyzeRecipe(Buffer.from('x'), 'image/jpeg', 'test', async () => Response.json({ document_annotation: null })), /illisible/);
  await assert.rejects(analyzeRecipe(Buffer.from('x'), 'image/jpeg', 'test', async url => url.endsWith('/ocr')
    ? Response.json({ pages: [{ markdown: 'Texte sans recette' }] }) : chatResponse({ ...reviewed, isRecipe: false })), /incomplète/);
});

test('rejects truncated completions and supports text content chunks', async () => {
  await assert.rejects(reviewRecipe(source, 'test', async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(reviewed) } }] })), /incomplète/);
  const result = await reviewRecipe(source, 'test', async () => Response.json({ choices: [{ message: { content: [{ type: 'text', text: JSON.stringify(reviewed) }] } }] }));
  assert.equal(result.review.status, 'complete');
});
