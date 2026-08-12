import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession, authenticate } from '$lib/server/auth';

export const actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const user = String(data.get('user') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!user || !password) {
      return fail(400, { error: 'Identifiants manquants', user });
    }

    const account = await authenticate(user, password);
    if (!account) {
      return fail(401, { error: 'Identifiants invalides', user });
    }

    cookies.set(SESSION_COOKIE, createSession(account), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: !dev,
      maxAge: SESSION_MAX_AGE
    });

    const from = url.searchParams.get('from');
    // évite open-redirect : seulement les chemins internes commençant par /
    const target = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
    throw redirect(303, target);
  }
};
