/**
 * Agrégation de la liste de courses « par ingrédient ».
 *
 * Regroupe les lignes shopping_items partageant le même ingrédient, puis
 * additionne les quantités par famille d'unité. Calcul à la volée (vue) :
 * les lignes en base restent intactes (snapshot dénormalisé).
 *
 * Clé de regroupement :
 *   - `canonicalId` quand il est présent (résolution exacte via le catalogue) ;
 *   - sinon `normalizeName(name)` (rattrapage des items legacy free-text).
 *
 * Module pur — importable côté client comme côté serveur.
 */
import { normalizeName } from './normalize.js';
import { resolveUnit, formatQuantity } from './units.js';
import { CATEGORIES, UNCATEGORIZED, categoryRank } from './categories.js';

/**
 * @typedef {Object} AggregatedGroup
 * @property {string} key            clé de regroupement
 * @property {string} label          nom affiché (le plus fréquent du groupe)
 * @property {number[]} ids          ids des shopping_items couverts
 * @property {boolean} checked       true si toutes les lignes sont cochées
 * @property {string[]} recipes      titres de recettes sources (distincts)
 * @property {string} brand          marque si homogène, sinon ''
 * @property {string} productReference  référence si homogène, sinon ''
 * @property {string[]} notes        notes distinctes non vides
 * @property {{ family: string, total: number, display: string }[]} subtotals
 *           un sous-total par famille d'unité (multi-familles non additionnables)
 */

/**
 * @param {Array<Object>} items  lignes shopping_items
 * @returns {AggregatedGroup[]}
 */
export function aggregateItems(items) {
  /** @type {Map<string, any>} */
  const groups = new Map();

  for (const item of items) {
    const key =
      item.canonicalId != null ? `c:${item.canonicalId}` : `n:${normalizeName(item.name)}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        ids: [],
        nameCounts: new Map(),
        recipes: new Set(),
        brands: new Set(),
        refs: new Set(),
        notes: new Set(),
        category: '',
        allChecked: true,
        // famille -> { total dans l'unité de base, unité d'origine à afficher }
        families: new Map()
      };
      groups.set(key, g);
    }

    if (!g.category && item.category) g.category = item.category;

    g.ids.push(item.id);
    g.nameCounts.set(item.name, (g.nameCounts.get(item.name) ?? 0) + 1);
    if (item.recipeTitle) g.recipes.add(item.recipeTitle);
    if (item.brand) g.brands.add(item.brand);
    if (item.productReference) g.refs.add(item.productReference);
    if (item.notes) g.notes.add(item.notes);
    if (!item.checked) g.allChecked = false;

    const { family, factor } = resolveUnit(item.unit);
    const qty = Number(item.quantity) || 0;
    const fam = g.families.get(family) ?? { total: 0, unit: item.unit };
    fam.total += qty * factor;
    g.families.set(family, fam);
  }

  /** @type {AggregatedGroup[]} */
  const result = [];
  for (const g of groups.values()) {
    // Libellé = le nom le plus fréquent (casse d'origine conservée).
    let label = '';
    let best = -1;
    for (const [name, count] of g.nameCounts) {
      if (count > best) {
        best = count;
        label = name;
      }
    }

    const subtotals = [...g.families.entries()]
      .filter(([, fam]) => fam.total > 0)
      .map(([family, fam]) => ({
        family,
        total: fam.total,
        display: formatQuantity(fam.total, family, fam.unit)
      }));

    result.push({
      key: g.key,
      label,
      ids: g.ids,
      checked: g.allChecked,
      category: g.category || UNCATEGORIZED,
      recipes: [...g.recipes],
      brand: g.brands.size === 1 ? [...g.brands][0] : '',
      productReference: g.refs.size === 1 ? [...g.refs][0] : '',
      notes: [...g.notes],
      subtotals
    });
  }

  // Items non cochés d'abord, puis tri alphabétique sur le libellé.
  result.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.label.localeCompare(b.label, 'fr');
  });

  return result;
}

/**
 * Regroupe des groupes agrégés par catégorie/rayon, dans l'ordre du parcours
 * magasin (CATEGORIES), la section « Autres » en dernier.
 * @param {AggregatedGroup[]} groups  résultat de aggregateItems
 * @returns {Array<[string, AggregatedGroup[]]>}
 */
export function groupByCategory(groups) {
  const byCat = new Map();
  for (const g of groups) {
    const cat = g.category || UNCATEGORIZED;
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(g);
  }
  return [...byCat.entries()].sort((a, b) => {
    const ra = a[0] === UNCATEGORIZED ? CATEGORIES.length + 1 : categoryRank(a[0]);
    const rb = b[0] === UNCATEGORIZED ? CATEGORIES.length + 1 : categoryRank(b[0]);
    return ra - rb || a[0].localeCompare(b[0], 'fr');
  });
}
