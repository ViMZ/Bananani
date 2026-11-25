import { error, redirect } from '@sveltejs/kit';
import { APP_TABS, DEFAULT_TAB } from '$lib/navigation';
import { setFavoriteTab } from '$lib/server/users';

export function load({ locals }) {
  const favorite = APP_TABS.find((tab) => tab.href === locals.user?.favoriteTab);
  throw redirect(303, favorite?.href ?? DEFAULT_TAB);
}

export const actions = {
  favorite: async ({ locals, request, url }) => {
    const form = await request.formData();
    const href = form.get('tab');
    const intent = form.get('intent');
    const tab = APP_TABS.find((tab) => tab.href === href);
    if (!tab || (intent !== 'set' && intent !== 'clear')) {
      throw error(400, 'Onglet favori invalide');
    }

    await setFavoriteTab(locals.user.id, tab.href, intent === 'set');
    const target = new URL(tab.href, url);
    target.search = String(form.get('search') ?? '');
    throw redirect(303, target.pathname + target.search);
  }
};
