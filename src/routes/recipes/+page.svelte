<script>
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

<div class="flex items-center justify-between gap-4 mb-4">
  <h1 class="text-2xl font-display font-bold">Recettes</h1>
  <a href="/recipes/new" class="btn-primary">+ Nouvelle</a>
</div>

<input
  type="search"
  placeholder="Rechercher par titre ou code…"
  bind:value={query}
  class="input mb-4"
/>

{#if filtered.length === 0}
  <div class="card text-center text-stone-600 py-12">
    {#if data.recipes.length === 0}
      <div class="text-5xl mb-3">🍳</div>
      <p class="mb-4">Aucune recette pour l'instant.</p>
      <a href="/recipes/new" class="btn-primary">+ Crée ta première recette</a>
    {:else}
      <p>Aucun résultat pour « {query} ».</p>
    {/if}
  </div>
{:else}
  <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
    {#each filtered as r}
      <a href="/recipes/{r.id}" class="card hover:shadow-md transition-shadow flex flex-col">
        {#if r.photoPath}
          <img src={r.photoPath} alt={r.title} class="w-full h-40 object-cover rounded-lg mb-2" />
        {:else}
          <div class="w-full h-40 bg-stone-100 rounded-lg mb-2 flex items-center justify-center text-5xl">
            🍽️
          </div>
        {/if}
        <div class="font-medium">{r.title}</div>
        {#if r.description}
          <div class="text-sm text-stone-600 mt-1 line-clamp-2">{r.description}</div>
        {/if}
        <div class="text-xs text-stone-500 mt-2 font-mono">{r.code}</div>
      </a>
    {/each}
  </div>
{/if}
