import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_COOKIE } from '$lib/server/auth';

export const POST = async ({ cookies }) => {
  cookies.set(SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev,
    maxAge: 0
  });
  throw redirect(303, '/login');
};
