import { redirect, error } from '@sveltejs/kit';
import {
  SESSION_COOKIE,
  verifySession,
  ADMIN_COOKIE,
  ADMIN_ENABLED,
  verifyAdminSession
} from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login']);

/** Realm admin : protégé par le mot de passe admin, indépendant des comptes utilisateurs. */
function handleAdmin(event, resolve) {
  const path = event.url.pathname;
  const isAdminLogin = path === '/admin/login';

  if (!ADMIN_ENABLED) {
    // BO désactivé : on ne laisse que la page de login afficher le message d'aide.
    if (isAdminLogin) return resolve(event);
    throw error(404, 'Introuvable');
  }

  const isAdmin = verifyAdminSession(event.cookies.get(ADMIN_COOKIE));
  if (isAdmin) event.locals.admin = true;

  if (!isAdmin && !isAdminLogin) {
    const from = path === '/admin' ? '' : `?from=${encodeURIComponent(path + event.url.search)}`;
    throw redirect(303, `/admin/login${from}`);
  }
  if (isAdmin && isAdminLogin) {
    throw redirect(303, '/admin');
  }
  return resolve(event);
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  if (event.url.pathname.startsWith('/admin')) {
    return handleAdmin(event, resolve);
  }

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
