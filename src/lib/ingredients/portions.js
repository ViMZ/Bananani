/** Portions entières, bornées comme dans le formulaire de recette. */
export function parseServings(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    throw new Error('Choisis un nombre de personnes entier entre 1 et 50.');
  }
  return n;
}

/** Les anciens placements héritent des portions de la recette. */
export function effectiveServings(placementServings, recipeServings) {
  return parseServings(placementServings ?? recipeServings ?? 2);
}

export function scaleQuantity(quantity, referenceServings, targetServings) {
  const ratio = parseServings(targetServings) / parseServings(referenceServings);
  return Math.round((Number(quantity) || 0) * ratio * 1e6) / 1e6;
}
