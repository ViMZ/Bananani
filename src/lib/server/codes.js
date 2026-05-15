const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Génère un code de recette du type `BAN-AB12CD`.
 * Pas de 0/O/1/I/L pour éviter la confusion à la lecture.
 */
export function generateRecipeCode() {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `BAN-${suffix}`;
}
