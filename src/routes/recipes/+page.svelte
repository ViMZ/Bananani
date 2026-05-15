<script>
  import Sprig from '$lib/components/Sprig.svelte';
  let { data } = $props();
  let query = $state('');

  let filtered = $derived(
    data.recipes.filter((r) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    })
  );
</script>

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
    placeholder="Cerca… par titre ou code BAN-XXXXXX"
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
      <h2 class="h-display text-2xl italic text-sepia mb-1">Niente trovato</h2>
      <p class="text-sepia">Aucun résultat pour « {query} »</p>
    {/if}
  </div>
{:else}
  <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
    {#each filtered as r}
      <a href="/recipes/{r.id}" class="block group">
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
            <div class="mt-3 flex items-center justify-between">
              <span class="codice flex items-center gap-1.5">
                <span class="text-limone">✦</span>
                {r.code}
              </span>
              <span class="text-mare text-sm group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </a>
    {/each}
  </div>
{/if}
