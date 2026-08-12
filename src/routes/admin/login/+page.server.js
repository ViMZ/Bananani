import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
  ADMIN_COOKIE,
  ADMIN_ENABLED,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  verifyAdminPassword
} from '$lib/server/auth';

export function load() {
  return { enabled: ADMIN_ENABLED };
}

export const actions = {
  default: async ({ request, cookies, url }) => {
    if (!ADMIN_ENABLED) {
      return fail(503, { error: 'Back-office désactivé (définis ADMIN_PASSWORD).' });
    }
    const data = await request.formData();
    const password = String(data.get('password') ?? '');
    if (!password) return fail(400, { error: 'Mot de passe manquant' });
    if (!verifyAdminPassword(password)) return fail(401, { error: 'Mot de passe invalide' });

    cookies.set(ADMIN_COOKIE, createAdminSession(), {
      path: '/admin',
      httpOnly: true,
      sameSite: 'lax',
      secure: !dev,
      maxAge: ADMIN_SESSION_MAX_AGE
    });

    const from = url.searchParams.get('from');
    const target =
      from && from.startsWith('/admin') && !from.startsWith('//') ? from : '/admin';
    throw redirect(303, target);
  }
};
