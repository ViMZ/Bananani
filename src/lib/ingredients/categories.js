/**
 * Catégories d'ingrédients = rayons de supermarché.
 *
 * L'ordre de la liste correspond à un parcours type en magasin : il sert à
 * ordonner les sections de la liste de courses groupée par rayon.
 *
 * Module pur — importable côté client comme côté serveur.
 */

export const CATEGORIES = [
  'Fruits & légumes',
  'Viandes & volailles',
  'Poissons & fruits de mer',
  'Crémerie & œufs',
  'Boulangerie',
  'Épicerie salée',
  'Épicerie sucrée',
  'Épices & condiments',
  'Herbes aromatiques',
  'Huiles & vinaigres',
  'Surgelés',
  'Boissons'
];

/** Section fourre-tout pour les ingrédients sans catégorie connue. */
export const UNCATEGORIZED = 'Autres';

/** Nettoie les rayons saisis sans limiter les utilisateurs aux rayons prédéfinis. */
export function cleanCategory(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
}

export function categoryOptions(values = []) {
  const result = [...CATEGORIES];
  const seen = new Set(result.map(v => v.toLocaleLowerCase('fr')));
  for (const value of values) {
    const category = cleanCategory(value);
    if (category && !seen.has(category.toLocaleLowerCase('fr'))) {
      result.push(category);
      seen.add(category.toLocaleLowerCase('fr'));
    }
  }
  return result;
}

/** Rang d'une catégorie pour le tri (les inconnues passent en dernier). */
export function categoryRank(category) {
  const i = CATEGORIES.indexOf(category);
  return i === -1 ? CATEGORIES.length : i;
}
