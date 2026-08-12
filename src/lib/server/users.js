import { db } from './db/index.js';
import { users } from './db/schema.js';
import { eq, asc } from 'drizzle-orm';

/**
 * Accès aux comptes utilisateurs. Volontairement sans hachage ici : le hachage
 * (scrypt) vit dans `auth.js`, et `auth.js` importe ce module — on garde donc
 * `users.js` dépendant de rien côté auth pour éviter un cycle d'imports. Les
 * appelants (CLI de création de compte) hachent le mot de passe puis passent le
 * hash à `createUser` / `updatePasswordHash`.
 */

/** Normalise un identifiant : minuscules + trim (unicité insensible à la casse). */
export function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .toLowerCase();
}

/** @param {number} id */
export async function getUserById(id) {
  if (!Number.isInteger(id)) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** @param {string} username */
export async function getUserByUsername(username) {
  const key = normalizeUsername(username);
  if (!key) return null;
  const rows = await db.select().from(users).where(eq(users.username, key)).limit(1);
  return rows[0] ?? null;
}

/**
 * Crée un compte. Lève si l'identifiant est déjà pris.
 * @param {string} username
 * @param {string} passwordHash  hash déjà calculé (voir auth.hashPassword)
 * @param {string} [displayName]
 */
export async function createUser(username, passwordHash, displayName = '') {
  const key = normalizeUsername(username);
  if (!key) throw new Error("L'identifiant est requis");
  if (await getUserByUsername(key)) throw new Error(`L'identifiant « ${key} » existe déjà`);
  const [created] = await db
    .insert(users)
    .values({ username: key, passwordHash, displayName: String(displayName ?? '').trim() })
    .returning();
  return created;
}

/**
 * Remplace le hash du mot de passe d'un compte. Renvoie false si le compte est absent.
 * @param {string} username
 * @param {string} passwordHash
 */
export async function updatePasswordHash(username, passwordHash) {
  const user = await getUserByUsername(username);
  if (!user) return false;
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  return true;
}

/**
 * Supprime un compte (ses recettes et items de courses partent en cascade).
 * Renvoie false si le compte est absent.
 * @param {number} id
 */
export async function deleteUserById(id) {
  if (!Number.isInteger(id)) return false;
  const existing = await getUserById(id);
  if (!existing) return false;
  await db.delete(users).where(eq(users.id, id));
  return true;
}

/** Liste tous les comptes (sans le hash), triés par identifiant. */
export async function listUsers() {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(asc(users.username));
}
