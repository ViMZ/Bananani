<script>
  import { onDestroy, onMount, untrack } from 'svelte';

  let { initialQuery = '', autoSearch = false, onSelect } = $props();
  let query = $state(untrack(() => initialQuery.trim().slice(0, 100)));
  let images = $state(null);
  let searching = $state(false);
  let error = $state('');
  let request;

  onMount(() => {
    if (autoSearch) search();
  });
  onDestroy(() => request?.abort());

  async function search() {
    const term = query.trim();
    if (searching || term.length < 2) return;
    request = new AbortController();
    searching = true;
    error = '';
    images = null;
    try {
      const response = await fetch(`/recipes/images?q=${encodeURIComponent(term)}`, { signal: request.signal });
      if (response.redirected) throw new Error('Ta session a expiré. Reconnecte-toi.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Recherche indisponible.');
      images = result.images;
    } catch (err) {
      if (err?.name !== 'AbortError') {
        error = err instanceof TypeError ? 'Recherche indisponible. Réessaie dans un instant.' : err.message;
      }
    } finally {
      searching = false;
    }
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap gap-2">
    <input class="input min-w-0 flex-1" aria-label="Nom du plat à illustrer"
      bind:value={query} maxlength="100" placeholder="Muffins, tarte aux pommes…"
      onkeydown={(event) => {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          search();
        }
      }} />
    <button type="button" class="btn-primary w-11 px-0 disabled:opacity-60 sm:w-auto sm:px-5"
      aria-label="Chercher" disabled={searching || query.trim().length < 2} onclick={search}>
      <svg class="size-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <span class="hidden sm:inline">Chercher</span>
    </button>
  </div>
  <div aria-live="polite">
    {#if searching}<p class="text-sm text-mare">Recherche d’images…</p>{/if}
    {#if error}<p class="text-sm text-terra">{error}</p>{/if}
    {#if images?.length === 0}<p class="text-sm text-sepia">Aucune image trouvée. Essaie un nom de plat plus court.</p>{/if}
  </div>
  {#if images?.length}
    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {#each images as image (image.pageId)}
        {@const title = image.title.replace(/\.[^.]+$/, '').replaceAll('_', ' ')}
        <li class="min-w-0 rounded-soft border border-umber/10 bg-linen p-2">
          <button type="button" class="group block w-full overflow-hidden rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare"
            aria-label={`Choisir ${title}`} onclick={() => onSelect(image)}>
            <img src={image.url} alt="" class="aspect-square w-full rounded bg-sand object-cover" loading="lazy" />
            <span class="mt-1.5 block break-words text-xs font-medium group-hover:underline">{title}</span>
          </button>
          <a class="mt-1 block break-words text-[11px] text-sepia underline underline-offset-2" href={image.source}
            target="_blank" rel="noreferrer">{image.author} · {image.license}</a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
