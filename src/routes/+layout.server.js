/** Expose l'utilisateur connecté (ou undefined sur /login) à tout le layout. */
export async function load({ locals }) {
  return { user: locals.user ?? null };
}
