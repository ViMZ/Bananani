import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { ADMIN_COOKIE } from '$lib/server/auth';

export const POST = async ({ cookies }) => {
  cookies.set(ADMIN_COOKIE, '', {
    path: '/admin',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev,
    maxAge: 0
  });
  throw redirect(303, '/admin/login');
};
