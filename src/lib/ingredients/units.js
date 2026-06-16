/**
 * Familles d'unités convertibles + formatage.
 *
 * On ne peut additionner des quantités que si elles partagent la même famille
 * (masse, volume…). Toute unité hors des familles connues (« pièce », « pincée »,
 * « c. à soupe »…) devient sa propre micro-famille : elle ne s'additionne donc
 * qu'avec elle-même, jamais avec une autre unité.
 *
 * Module pur, sans dépendance — importable côté client comme côté serveur.
 */

/**
 * Familles à unités convertibles. Chaque unité porte son facteur vers l'unité
 * de base de la famille (`base`).
 */
const FAMILIES = {
  masse: { base: 'g', units: { mg: 0.001, g: 1, kg: 1000 } },
  volume: { base: 'ml', units: { ml: 1, cl: 10, l: 1000 } }
};

/**
 * Liste curée d'unités proposées à la saisie (combobox à liste fermée).
 * Ordre : masse, volume, puis unités « pièce » courantes en cuisine.
 * Les valeurs sont les formes canoniques (celles que `resolveUnit` reconnaît).
 */
export const UNITS = [
  'g',
  'kg',
  'mg',
  'ml',
  'cl',
  'l',
  'pièce',
  'c. à café',
  'c. à soupe',
  'pincée',
  'gousse',
  'tranche',
  'botte',
  'branche',
  'feuille',
  'sachet',
  'boîte',
  'verre',
  'poignée',
  'filet',
  'goutte',
  'zeste'
];

/** Alias de saisie → unité canonique d'une famille. */
const ALIASES = {
  gr: 'g',
  gramme: 'g',
  grammes: 'g',
  kilo: 'kg',
  kilos: 'kg',
  kilogramme: 'kg',
  litre: 'l',
  litres: 'l',
  millilitre: 'ml',
  millilitres: 'ml',
  centilitre: 'cl',
  centilitres: 'cl'
};

/**
 * Normalise une unité brute (minuscules, trim, sans accents, alias résolus).
 * @param {string} raw
 * @returns {string}
 */
function normalizeUnit(raw) {
  const u = String(raw ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
  return ALIASES[u] ?? u;
}

/**
 * Résout une unité brute vers { family, factor, base }.
 * - Unité d'une famille convertible → famille + facteur vers la base.
 * - Sinon → micro-famille propre (clé = unité normalisée), facteur 1.
 *   L'unité vide devient la micro-famille 'sans-unite'.
 * @param {string} raw
 * @returns {{ family: string, factor: number, base: string }}
 */
export function resolveUnit(raw) {
  const u = normalizeUnit(raw);
  for (const [family, def] of Object.entries(FAMILIES)) {
    if (u in def.units) {
      return { family, factor: def.units[u], base: def.base };
    }
  }
  const family = u === '' ? 'sans-unite' : u;
  return { family, factor: 1, base: u };
}

/**
 * Formate un nombre proprement (vire les artefacts flottants, virgule FR).
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  // Arrondi à 3 décimales puis suppression des zéros superflus.
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded).replace('.', ',');
}

/**
 * Formate une quantité totale (exprimée dans l'unité de base de la famille)
 * en libellé lisible, en remontant vers l'unité la plus grande si pertinent.
 * @param {number} totalInBase  total dans l'unité de base
 * @param {string} family       famille renvoyée par resolveUnit
 * @param {string} [displayUnit] unité d'origine à afficher pour les micro-familles
 *                               (préserve la casse/accents saisis, ex. « pièce »)
 * @returns {string}            ex. « 1,5 kg », « 200 g », « 3 pièce »
 */
export function formatQuantity(totalInBase, family, displayUnit) {
  const def = FAMILIES[family];
  if (def) {
    // Choisir la plus grande unité donnant une valeur >= 1.
    const sorted = Object.entries(def.units).sort((a, b) => b[1] - a[1]);
    for (const [unit, factor] of sorted) {
      if (totalInBase >= factor) {
        return `${formatNumber(totalInBase / factor)} ${unit}`;
      }
    }
    // Plus petit que toutes les unités (ou 0) : on reste sur la base.
    return `${formatNumber(totalInBase)} ${def.base}`;
  }

  // Micro-famille : 'sans-unite' n'affiche pas de libellé d'unité.
  if (family === 'sans-unite') return formatNumber(totalInBase);
  return `${formatNumber(totalInBase)} ${displayUnit || family}`;
}
