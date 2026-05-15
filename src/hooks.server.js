import { timingSafeEqual } from 'node:crypto';

const USER = process.env.BANANANI_USER;
const PASSWORD = process.env.BANANANI_PASSWORD;
const AUTH_ENABLED = Boolean(USER && PASSWORD);
const REALM = 'Bananani';

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function unauthorized() {
  return new Response('Authentification requise', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  if (AUTH_ENABLED) {
    const header = event.request.headers.get('authorization') ?? '';
    if (!header.toLowerCase().startsWith('basic ')) {
      return unauthorized();
    }
    let user = '';
    let pass = '';
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
      const idx = decoded.indexOf(':');
      if (idx === -1) return unauthorized();
      user = decoded.slice(0, idx);
      pass = decoded.slice(idx + 1);
    } catch {
      return unauthorized();
    }
    if (!safeEqual(user, USER) || !safeEqual(pass, PASSWORD)) {
      return unauthorized();
    }
  }
  return resolve(event);
}
