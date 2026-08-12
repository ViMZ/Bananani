import { fail } from '@sveltejs/kit';
import { generatePassword, hashPassword } from '$lib/server/auth';
import {
  listUsers,
  createUser,
  updatePasswordHash,
  deleteUserById,
  getUserById
} from '$lib/server/users';

export async function load() {
  return { users: await listUsers() };
}

export const actions = {
  create: async ({ request }) => {
    const data = await request.formData();
    const username = String(data.get('username') ?? '').trim();
    const displayName = String(data.get('name') ?? '').trim();
    const typed = String(data.get('password') ?? '').trim();
    if (!username) return fail(400, { error: "L'identifiant est requis." });

    const password = typed || generatePassword();
    try {
      const user = await createUser(username, hashPassword(password), displayName);
      return {
        created: {
          username: user.username,
          displayName: user.displayName ?? '',
          password,
          generated: !typed
        }
      };
    } catch (err) {
      return fail(400, { error: err instanceof Error ? err.message : 'Erreur' });
    }
  },

  passwd: async ({ request }) => {
    const data = await request.formData();
    const id = Number(data.get('id'));
    const typed = String(data.get('password') ?? '').trim();
    const user = await getUserById(id);
    if (!user) return fail(404, { error: 'Compte introuvable.' });

    const password = typed || generatePassword();
    await updatePasswordHash(user.username, hashPassword(password));
    return {
      reset: { username: user.username, password, generated: !typed }
    };
  },

  delete: async ({ request }) => {
    const data = await request.formData();
    const id = Number(data.get('id'));
    const user = await getUserById(id);
    if (!user) return fail(404, { error: 'Compte introuvable.' });
    await deleteUserById(id);
    return { deleted: user.username };
  }
};
