/**
 * Regroupement de la liste de courses « par recette ».
 *
 * Quand une même recette a été ajoutée plusieurs fois, ses lignes shopping_items
 * sont dupliquées (un lot par ajout, identifiable par `addedAt`). Ce module les
 * fusionne pour rendre la multiplicité explicite : la recette apparaît une seule
 * fois, avec le nombre d'ajouts (`instances`), et chaque ingrédient une seule
 * fois avec sa quantité unitaire et le facteur (« 200 × 2 »).
 *
 * Calcul à la volée (vue) : les lignes en base restent intactes (snapshot).
 * Module pur — importable côté client comme côté serveur.
 */
import { normalizeName } from './normalize.js';
import { resolveUnit, formatQuantity } from './units.js';

/**
 * @typedef {Object} RecipeLine
 * @property {number[]} ids          ids des shopping_items fusionnés
 * @property {boolean} checked       true si toutes les lignes sont cochées
 * @property {string} name
 * @property {string} brand
 * @property {string} productReference
 * @property {string} unit
 * @property {number} count          nombre de lots fusionnés (ajouts présents)
 * @property {number} unitQty        quantité d'un lot (si homogène)
 * @property {number} total          somme des quantités (unité d'origine)
 * @property {boolean} sameQty       true si tous les lots ont la même quantité
 * @property {string} display        quantité formatée (même logique que la vue par ingrédient)
 * @property {string[]} notes        notes distinctes non vides
 */

/**
 * @typedef {Object} RecipeGroup
 * @property {string} title
 * @property {boolean} isRecipe      false pour le groupe « ajouts manuels »
 * @property {number|null} servings  portions de la recette (null si inconnu)
 * @property {number} instances      nombre de fois où la recette a été ajoutée
 * @property {number} itemCount      nombre de lignes shopping_items du groupe
 * @property {RecipeLine[]} lines
 */

/**
 * @param {Array<Object>} items  lignes shopping_items (incluant addedAt, servings si dispo)
 * @param {{ manualLabel?: string }} [opts]  libellé du groupe des ajouts manuels
 * @returns {RecipeGroup[]}
 */
export function groupByRecipe(items, { manualLabel = 'Ajoutés à la main' } = {}) {
  /** @type {Map<string, any>} */
  const groups = new Map();

  for (const item of items) {
    const isRecipe = !!item.recipeTitle;
    const title = isRecipe ? item.recipeTitle : manualLabel;
    let g = groups.get(title);
    if (!g) {
      g = { title, isRecipe, servings: null, items: [] };
      groups.set(title, g);
    }
    if (g.servings == null && item.servings != null) g.servings = item.servings;
    g.items.push(item);
  }

  return [...groups.values()].map((g) => {
    // Ajouts manuels : entrées indépendantes, jamais fusionnées (une ligne par item).
    if (!g.isRecipe) {
      return {
        title: g.title,
        isRecipe: false,
        servings: null,
        instances: 1,
        itemCount: g.items.length,
        lines: g.items.map((i) => {
          const total = Number(i.quantity) || 0;
          const { family, factor } = resolveUnit(i.unit || '');
          return {
            ids: [i.id],
            checked: !!i.checked,
            name: i.name,
            brand: i.brand || '',
            productReference: i.productReference || '',
            unit: i.unit || '',
            count: 1,
            unitQty: total,
            total,
            sameQty: true,
            display: formatQuantity(total * factor, family, i.unit || ''),
            notes: i.notes ? [i.notes] : []
          };
        })
      };
    }

    // Nombre d'ajouts = nombre de lots distincts (CURRENT_TIMESTAMP partagé par lot).
    const addedAts = new Set(g.items.map((i) => i.addedAt));

    /** @type {Map<string, any>} */
    const byKey = new Map();
    for (const i of g.items) {
      const idPart = i.canonicalId != null ? `c:${i.canonicalId}` : `n:${normalizeName(i.name)}`;
      const key = [idPart, i.brand || '', i.productReference || '', i.unit || ''].join('|');
      let l = byKey.get(key);
      if (!l) {
        l = {
          name: i.name,
          brand: i.brand || '',
          productReference: i.productReference || '',
          unit: i.unit || '',
          ids: [],
          qtys: [],
          notes: new Set(),
          allChecked: true
        };
        byKey.set(key, l);
      }
      l.ids.push(i.id);
      l.qtys.push(Number(i.quantity) || 0);
      if (i.notes) l.notes.add(i.notes);
      if (!i.checked) l.allChecked = false;
    }

    const lines = [...byKey.values()].map((l) => {
      const count = l.ids.length;
      const total = l.qtys.reduce((a, b) => a + b, 0);
      const unitQty = l.qtys[0];
      const sameQty = l.qtys.every((q) => q === unitQty);
      // Toutes les lignes fusionnées partagent la même unité (clé de regroupement) :
      // un seul facteur suffit pour exprimer le total dans l'unité de base.
      const { family, factor } = resolveUnit(l.unit);
      return {
        ids: l.ids,
        checked: l.allChecked,
        name: l.name,
        brand: l.brand,
        productReference: l.productReference,
        unit: l.unit,
        count,
        unitQty,
        total,
        sameQty,
        display: formatQuantity(total * factor, family, l.unit),
        notes: [...l.notes]
      };
    });

    return {
      title: g.title,
      isRecipe: true,
      servings: g.servings,
      instances: addedAts.size,
      itemCount: g.items.length,
      lines
    };
  });
}
