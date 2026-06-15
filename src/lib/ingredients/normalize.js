/**
 * Normalisation des noms d'ingrédients.
 *
 * Sert à deux choses :
 *  - construire la clé unique du catalogue canonique (`normalizedKey`) ;
 *  - servir de clé de regroupement de secours pour les items legacy qui n'ont
 *    pas de `canonicalId` (recettes saisies avant le catalogue).
 *
 * Module pur, sans dépendance — importable côté client comme côté serveur.
 */

/**
 * Normalise un nom d'ingrédient en une clé de regroupement.
 * minuscules → trim → sans accents → espaces compactés → pluriel simple retiré.
 * @param {string} str
 * @returns {string}
 */
export function normalizeName(str) {
  let s = String(str ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // accents / diacritiques
    .replace(/\s+/g, ' ');

  // Singularisation conservatrice : on ne touche qu'aux mots assez longs
  // pour éviter « radis » → « radi », « cassis » → « cassi », « riz » → « ri ».
  if (s.length > 4 && /[sx]$/.test(s)) {
    s = s.slice(0, -1);
  }

  return s;
}
