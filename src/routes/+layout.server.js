/** Expose l'utilisateur connecté (ou undefined sur /login) à tout le layout. */
export function load({ locals, depends }) {
  depends('app:favorite-tab');
  return { user: locals.user ?? null };
}
