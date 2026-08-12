import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, verifySession } from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login']);

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const session = await verifySession(event.cookies.get(SESSION_COOKIE));
  if (session) {
    event.locals.user = session;
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
