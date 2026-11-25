<script>
  import PageTitle from '$lib/components/PageTitle.svelte';
  import Sprig from '$lib/components/Sprig.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { goto } from '$app/navigation';

  let { data } = $props();
  let query = $state('');
  let selectMode = $state(false);
  let selected = new SvelteSet();

  let filtered = $derived(
    data.recipes.filter((r) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    })
  );

  function toggle(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  function cancelSelect() {
    selectMode = false;
    selected.clear();
  }

  function printSelection() {
    if (selected.size === 0) return;
    goto('/recipes/cards?ids=' + [...selected].join(','));
  }
</script>

{#snippet card(r)}
  <div class="relative flex aspect-square flex-col justify-end rounded-card overflow-hidden border border-umber/15 bg-sand shadow-card group-hover:shadow-soft-lg transition-all duration-200 group-hover:-translate-y-0.5">
    {#if r.photoPath}
      <img src={r.photoPath} alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
    {:else}
      <span aria-hidden="true" class="absolute left-2 top-2 font-display italic text-3xl text-sepia/50 sm:left-4 sm:top-4 sm:text-5xl">N°</span>
    {/if}
    <div class="relative p-2.5 sm:p-4 {r.photoPath
      ? 'bg-gradient-to-t from-black/90 to-black/70 text-panna before:absolute before:inset-x-0 before:bottom-full before:h-5 before:bg-gradient-to-t before:from-black/70 before:to-transparent'
      : 'text-umber'}">
      <h3 class="h-display text-lg leading-tight break-words line-clamp-2 sm:text-2xl">{r.title}</h3>
      {#if r.description}
        <p class="hidden text-sm italic mt-0.5 sm:line-clamp-1">{r.description}</p>
      {/if}
      {#if r.owner}
        <p class="hidden font-display italic text-sm mt-0.5 truncate sm:block">de {r.owner}</p>
      {/if}
      <div class="mt-1.5 flex items-center justify-between gap-1 sm:mt-2">
        <span class="flex items-center gap-1 whitespace-nowrap font-mono text-[10px] tracking-wide sm:text-xs">
          <span class="text-limone" aria-hidden="true">✦</span>
          {r.code}
        </span>
        <span class="text-sm group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
      </div>
    </div>
  </div>
{/snippet}

<header class="mb-10 text-center md:text-left md:flex md:items-end md:justify-between gap-4">
  <div>
    <div class="h-eyebrow mb-2">Il Ricettario</div>
    <PageTitle title="Recettes" size="text-5xl md:text-6xl" />
    <p class="text-sepia mt-2 italic">
      {data.recipes.length} recette{data.recipes.length > 1 ? 's' : ''} dans la collection
    </p>
  </div>
  <a href="/recipes/new" class="btn-primary mt-4 md:mt-0">＋ Nouvelle recette</a>
</header>

{#if data.recipes.length > 0}
  <div class="flex flex-wrap items-center gap-2 mb-6">
    {#if selectMode}
      <button class="btn-primary" onclick={printSelection} disabled={selected.size === 0}>
        🍋 Imprimer la planche ({selected.size})
      </button>
      <button class="btn-secondary" onclick={cancelSelect}>Annuler</button>
    {:else}
      <button class="btn-secondary" onclick={() => (selectMode = true)}>Sélectionner</button>
      <a href="/recipes/cards" class="btn-secondary">🍋 Imprimer toutes les fiches</a>
    {/if}
  </div>
{/if}

<div class="relative mb-10">
  <svg
    class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sepia pointer-events-none"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
  <input
    type="search"
    placeholder="Rechercher… par titre ou code BAN-XXXXXX"
    bind:value={query}
    class="input pl-11 italic"
  />
</div>

{#if filtered.length === 0}
  <div class="text-center py-20">
    <div class="flex justify-center mb-4 opacity-50">
      <Sprig width={100} />
    </div>
    {#if data.recipes.length === 0}
      <h2 class="h-display text-3xl italic text-sepia mb-2">Ricettario vide</h2>
      <p class="text-sepia mb-8">Aucune recette enregistrée pour l'instant.</p>
      <a href="/recipes/new" class="btn-primary">＋ Créer la première</a>
    {:else}
      <h2 class="h-display text-2xl italic text-sepia mb-1">Aucun résultat</h2>
      <p class="text-sepia">Aucun résultat pour « {query} »</p>
    {/if}
  </div>
{:else}
  <div class="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-5">
    {#each filtered as r}
      {#if selectMode}
        <button
          type="button"
          class="block w-full h-full text-left group relative"
          aria-pressed={selected.has(r.id)}
          onclick={() => toggle(r.id)}
        >
          <span
            class="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-soft transition-colors {selected.has(
              r.id
            )
              ? 'bg-mare text-white'
              : 'bg-panna/90 text-sepia border border-umber/20'}"
          >
            {selected.has(r.id) ? '✓' : ''}
          </span>
          <div class="h-full transition-all {selected.has(r.id) ? 'ring-2 ring-mare rounded-card' : ''}">
            {@render card(r)}
          </div>
        </button>
      {:else}
        <a href="/recipes/{r.id}" class="block h-full group">
          {@render card(r)}
        </a>
      {/if}
    {/each}
  </div>
{/if}
