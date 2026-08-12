import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { getUserById, getUserByUsername } from './users.js';

/**
 * Auth multi-comptes.
 *
 * - Mots de passe hachés avec scrypt (`scrypt$<saltHex>$<hashHex>`), aucune dépendance externe.
 * - Session sans état : cookie `<userId>.<expEpoch>.<hmac>`, signé HMAC-SHA256 avec un secret
 *   serveur (`SESSION_SECRET`) ET le hash du mot de passe de l'utilisateur. Conséquence :
 *   changer le mot de passe d'un compte invalide toutes ses sessions. `verifySession` relit
 *   l'utilisateur en base pour récupérer son hash courant.
 */

const SECRET = process.env.SESSION_SECRET || 'bananani-dev-insecure-secret';
export const SESSION_COOKIE = 'bananani_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

// Back-office admin : realm séparé, protégé par un mot de passe unique (env).
// Sans ADMIN_PASSWORD, le BO est désactivé (routes /admin inaccessibles).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
export const ADMIN_ENABLED = Boolean(ADMIN_PASSWORD);
export const ADMIN_COOKIE = 'bananani_admin';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8 h

// Paramètres scrypt (coût mémoire N, blocs r, parallélisme p, longueur de clé).
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

// Alphabet sans caractères ambigus (0/O, 1/l/I) : mot de passe dictable au téléphone.
const READABLE_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Mot de passe aléatoire lisible : 4 groupes de 4, séparés par des tirets. */
export function generatePassword() {
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += READABLE_ALPHABET[bytes[i] % READABLE_ALPHABET.length];
  }
  return out;
}

/**
 * Hache un mot de passe. Format : `scrypt$<saltHex>$<hashHex>`.
 * @param {string} password
 */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Vérifie un mot de passe contre un hash stocké (comparaison à temps constant).
 * @param {string} password
 * @param {string} stored
 */
export function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length === 0) return false;
  let hash;
  try {
    hash = scryptSync(password, salt, expected.length, SCRYPT);
  } catch {
    return false;
  }
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

/**
 * Vérifie des identifiants. Renvoie l'utilisateur si valides, null sinon.
 * @param {string} username
 * @param {string} password
 */
export async function authenticate(username, password) {
  const user = await getUserByUsername(username);
  if (!user) {
    // Hache quand même pour lisser le temps de réponse (évite d'énumérer les comptes).
    hashPassword(password);
    return null;
  }
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

/**
 * @param {number} userId
 * @param {number} exp
 * @param {string} passwordHash
 */
function sign(userId, exp, passwordHash) {
  return createHmac('sha256', SECRET).update(`${userId}.${exp}.${passwordHash}`).digest('hex');
}

/**
 * Valeur de cookie de session signée.
 * @param {{ id: number, passwordHash: string }} user
 */
export function createSession(user) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const mac = sign(user.id, exp, user.passwordHash);
  return `${user.id}.${exp}.${mac}`;
}

/**
 * Vérifie un cookie de session. Renvoie l'utilisateur (public) si valide, null sinon.
 * @param {string | undefined | null} cookie
 * @returns {Promise<{ id: number, username: string, displayName: string } | null>}
 */
export async function verifySession(cookie) {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 3) return null;
  const [idStr, expStr, mac] = parts;
  const id = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isInteger(id) || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;

  const user = await getUserById(id);
  if (!user) return null;

  const expected = sign(id, exp, user.passwordHash);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))) return null;

  return { id: user.id, username: user.username, displayName: user.displayName ?? '' };
}

// --- Back-office admin ---------------------------------------------------

/** Comparaison de chaînes à temps constant. */
function timingSafeStringEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Vérifie le mot de passe admin. Faux si le BO est désactivé.
 * @param {string} password
 */
export function verifyAdminPassword(password) {
  if (!ADMIN_ENABLED) return false;
  return timingSafeStringEqual(password, ADMIN_PASSWORD);
}

/**
 * Cookie de session admin : `<exp>.<hmac>`, signé avec SECRET + ADMIN_PASSWORD
 * (⇒ changer le mot de passe admin invalide les sessions admin en cours).
 */
export function createAdminSession() {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE;
  const mac = createHmac('sha256', SECRET).update(`admin.${exp}.${ADMIN_PASSWORD}`).digest('hex');
  return `${exp}.${mac}`;
}

/**
 * Vérifie un cookie de session admin.
 * @param {string | undefined | null} cookie
 * @returns {boolean}
 */
export function verifyAdminSession(cookie) {
  if (!ADMIN_ENABLED || !cookie) return false;
  const dot = cookie.indexOf('.');
  if (dot === -1) return false;
  const expStr = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac('sha256', SECRET).update(`admin.${exp}.${ADMIN_PASSWORD}`).digest('hex');
  if (mac.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'));
}
