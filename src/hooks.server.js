import { redirect } from '@sveltejs/kit';
import { AUTH_ENABLED, SESSION_COOKIE, verifySession } from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login']);

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  if (!AUTH_ENABLED) {
    // Mode dev sans creds : pas d'auth, comportement legacy.
    return resolve(event);
  }

  const cookie = event.cookies.get(SESSION_COOKIE);
  const session = verifySession(cookie);
  if (session) {
    event.locals.user = session.user;
  }

  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.has(path);

  if (!session && !isPublic) {
    // Pas connecté → rediriger vers /login, mémoriser la cible
    const from = path === '/' ? '' : `?from=${encodeURIComponent(path + event.url.search)}`;
    throw redirect(303, `/login${from}`);
  }

  if (session && path === '/login') {
    // Déjà connecté, pas la peine de revoir le login
    throw redirect(303, '/');
  }

  return resolve(event);
}
