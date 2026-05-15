import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const USER = process.env.BANANANI_USER ?? '';
const PASSWORD = process.env.BANANANI_PASSWORD ?? '';

export const AUTH_ENABLED = Boolean(USER && PASSWORD);
export const SESSION_COOKIE = 'bananani_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

// Clé HMAC dérivée du password (rotates si on change le password = sessions invalidées)
const KEY = PASSWORD ? createHash('sha256').update(PASSWORD).digest() : null;

function timingSafeStringEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * @param {string} user
 * @param {string} password
 * @returns {boolean}
 */
export function verifyCredentials(user, password) {
  if (!AUTH_ENABLED) return false;
  return timingSafeStringEqual(user, USER) && timingSafeStringEqual(password, PASSWORD);
}

/**
 * Crée une valeur de cookie de session signée HMAC.
 * Format : <user>.<expEpoch>.<hex hmac>
 * @param {string} user
 */
export function createSession(user) {
  if (!KEY) throw new Error('Auth not enabled');
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${user}.${exp}`;
  const mac = createHmac('sha256', KEY).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

/**
 * Vérifie un cookie de session, renvoie { user } si valide, null sinon.
 * @param {string | undefined | null} cookie
 * @returns {{ user: string } | null}
 */
export function verifySession(cookie) {
  if (!cookie || !KEY) return null;
  const lastDot = cookie.lastIndexOf('.');
  if (lastDot === -1) return null;
  const payload = cookie.slice(0, lastDot);
  const mac = cookie.slice(lastDot + 1);
  const expectedMac = createHmac('sha256', KEY).update(payload).digest('hex');
  if (mac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expectedMac, 'hex'))) return null;

  const firstDot = payload.indexOf('.');
  if (firstDot === -1) return null;
  const user = payload.slice(0, firstDot);
  const expStr = payload.slice(firstDot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (user !== USER) return null;

  return { user };
}
