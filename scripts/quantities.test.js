import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUnit, formatQuantity, resolveUnit, canonicalUnit } from '../src/lib/ingredients/units.js';
import { parseServings, effectiveServings, scaleQuantity } from '../src/lib/ingredients/portions.js';
import { aggregateItems } from '../src/lib/ingredients/aggregate.js';
import { groupByRecipe } from '../src/lib/ingredients/byRecipe.js';

test('accords units after scaling, with invariant symbols and canonical plural aliases', () => {
  for (const [unit, singular, plural] of [['tranche', 'tranche', 'tranches'], ['pièce', 'pièce', 'pièces'], ['g', 'g', 'g'], ['ml', 'ml', 'ml'], ['c. à soupe', 'c. à soupe', 'c. à soupe']]) {
    assert.equal(formatUnit(unit, 1), singular);
    assert.equal(formatUnit(unit, 4), plural);
  }
  assert.equal(canonicalUnit('pièces'), 'pièce');
  assert.equal(canonicalUnit('c. à café'), 'c. à café');
  assert.equal(canonicalUnit('c. à soupe'), 'c. à soupe');
  assert.equal(formatUnit('tranches', 1), 'tranche');
  assert.equal(formatUnit('pièce', 0.5), 'pièce');
  assert.equal(resolveUnit('tranches').family, resolveUnit('tranche').family);
  assert.equal(formatQuantity(4, resolveUnit('pièce').family, 'pièce'), '4 pièces');
});

test('servings reject malformed values and legacy meals inherit recipe servings', () => {
  for (const value of ['', null, 0, -1, 51, 1.5, 'abc', Infinity]) assert.throws(() => parseServings(value));
  assert.equal(parseServings('4'), 4);
  assert.equal(effectiveServings(null, 4), 4);
  assert.equal(effectiveServings(2, 4), 2);
  assert.equal(scaleQuantity(300, 4, 2), 150);
  assert.equal(scaleQuantity(0, 2, 6), 0);
});

test('4 people plus 2 people produce groceries and recipe totals for 6 portions', () => {
  const items = [4, 2].map((servings, n) => ({ id: n + 1, canonicalId: 1, recipeId: 1,
    recipeTitle: 'Pâtes au saumon', name: 'Pâtes', quantity: scaleQuantity(300, 4, servings),
    unit: 'g', servings, batchId: `meal-${n}`, addedAt: 'same-second', checked: false }));
  assert.equal(aggregateItems(items)[0].subtotals[0].display, '450 g');
  const group = groupByRecipe(items)[0];
  assert.equal(group.totalServings, 6);
  assert.equal(group.instances, 2);
  assert.equal(group.lines[0].display, '450 g');
  items[0].checked = true;
  assert.equal(aggregateItems(items)[0].checked, false);
  items[1].checked = true;
  assert.equal(aggregateItems(items)[0].checked, true);
});
