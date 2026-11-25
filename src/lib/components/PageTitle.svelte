<script>
  import { enhance } from '$app/forms';
  import { goto, invalidate } from '$app/navigation';
  import { page } from '$app/state';

  let { title, size, class: className = '' } = $props();
  let isFavorite = $derived(page.data.user?.favoriteTab === page.url.pathname);
  let saving = $state(false);
  let saveError = $state(false);

  function saveFavorite({ cancel }) {
    if (saving) return cancel();
    saving = true;
    saveError = false;

    return async ({ result }) => {
      try {
        if (result.type === 'redirect' && result.location.startsWith('/login')) {
          await goto(result.location);
        } else if (result.type === 'redirect') {
          await invalidate('app:favorite-tab');
        } else {
          saveError = true;
        }
      } catch {
        saveError = true;
      } finally {
        saving = false;
      }
    };
  }
</script>

<div class={className}>
  <div class="inline-flex items-center gap-1.5">
    <h1 class="h-display italic {size}">{title}</h1>
    <form method="POST" action="/?/favorite" class="no-print" use:enhance={saveFavorite}>
      <input type="hidden" name="tab" value={page.url.pathname} />
      <input type="hidden" name="search" value={page.url.search} />
      <button
        type="submit"
        name="intent"
        value={isFavorite ? 'clear' : 'set'}
        aria-label="Ouvrir {title} au démarrage"
        aria-pressed={isFavorite}
        title={isFavorite ? 'Retirer le favori' : 'Choisir comme onglet d’ouverture'}
        disabled={saving}
        class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-sand hover:text-umber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mare disabled:opacity-60 {isFavorite ? 'text-umber' : 'text-sepia'}"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill={isFavorite ? '#E5B947' : 'none'} stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.13L12 17.04l-5.5 2.89 1.05-6.13L3.1 9.47l6.15-.9L12 3Z" />
        </svg>
      </button>
    </form>
  </div>
  {#if saveError}
    <p class="no-print text-sm text-terra" role="alert">Impossible d’enregistrer le favori. Réessaie.</p>
  {/if}
</div>
