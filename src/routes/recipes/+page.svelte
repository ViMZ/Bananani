<script>
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
  <div class="bg-panna rounded-card overflow-hidden border border-umber/15 shadow-card group-hover:shadow-soft-lg transition-all duration-200 group-hover:-translate-y-0.5">
    {#if r.photoPath}
      <img src={r.photoPath} alt={r.title} class="w-full aspect-[4/3] object-cover" />
    {:else}
      <div class="w-full aspect-[4/3] bg-sand flex items-center justify-center">
        <span class="font-display italic text-5xl text-sepia">N°</span>
      </div>
    {/if}
    <div class="p-5">
      <h3 class="h-display text-2xl leading-tight text-balance">{r.title}</h3>
      {#if r.description}
        <p class="text-sm text-sepia italic mt-1 line-clamp-1">{r.description}</p>
      {/if}
      {#if r.owner}
        <p class="font-display italic text-mare text-sm mt-1">de {r.owner}</p>
      {/if}
      <div class="mt-3 flex items-center justify-between">
        <span class="codice flex items-center gap-1.5">
          <span class="text-limone">✦</span>
          {r.code}
        </span>
        <span class="text-mare text-sm group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </div>
  </div>
{/snippet}

<header class="mb-10 text-center md:text-left md:flex md:items-end md:justify-between gap-4">
  <div>
    <div class="h-eyebrow mb-2">Il Ricettario</div>
    <h1 class="h-display text-5xl md:text-6xl italic">Recettes</h1>
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
  <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
    {#each filtered as r}
      {#if selectMode}
        <button
          type="button"
          class="block w-full text-left group relative"
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
          <div class="transition-all {selected.has(r.id) ? 'ring-2 ring-mare rounded-card' : ''}">
            {@render card(r)}
          </div>
        </button>
      {:else}
        <a href="/recipes/{r.id}" class="block group">
          {@render card(r)}
        </a>
      {/if}
    {/each}
  </div>
{/if}
