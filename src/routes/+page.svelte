<script>
  let { data } = $props();
</script>

<section class="card mb-6 bg-gradient-to-br from-banana-100 to-banana-200 border-banana-300">
  <h1 class="text-3xl font-display font-bold mb-2">Bienvenue 👋</h1>
  <p class="text-stone-700 mb-4">
    Stocke tes recettes préférées, imprime des fiches avec un code-barres à coller sur le frigo,
    et scanne-les pour préparer ta liste de courses.
  </p>
  <div class="flex flex-wrap gap-2">
    <a href="/recipes/new" class="btn-primary">+ Nouvelle recette</a>
    <a href="/scan" class="btn-secondary">📷 Scanner une fiche</a>
  </div>
</section>

<div class="grid sm:grid-cols-3 gap-4 mb-6">
  <a href="/recipes" class="card hover:shadow-md transition-shadow">
    <div class="text-3xl mb-1">📖</div>
    <div class="text-2xl font-bold">{data.totalRecipes}</div>
    <div class="text-stone-600 text-sm">recette{data.totalRecipes > 1 ? 's' : ''} enregistrée{data.totalRecipes > 1 ? 's' : ''}</div>
  </a>
  <a href="/shopping" class="card hover:shadow-md transition-shadow">
    <div class="text-3xl mb-1">🛒</div>
    <div class="text-2xl font-bold">{data.pendingShoppingCount}</div>
    <div class="text-stone-600 text-sm">article{data.pendingShoppingCount > 1 ? 's' : ''} à acheter</div>
  </a>
  <a href="/scan" class="card hover:shadow-md transition-shadow">
    <div class="text-3xl mb-1">📷</div>
    <div class="text-2xl font-bold">Scanner</div>
    <div class="text-stone-600 text-sm">une fiche pour planifier les courses</div>
  </a>
</div>

{#if data.recent.length > 0}
  <h2 class="text-xl font-display font-bold mb-3">Dernières recettes</h2>
  <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
    {#each data.recent as r}
      <a href="/recipes/{r.id}" class="card hover:shadow-md transition-shadow flex flex-col">
        {#if r.photoPath}
          <img src={r.photoPath} alt={r.title} class="w-full h-32 object-cover rounded-lg mb-2" />
        {:else}
          <div class="w-full h-32 bg-stone-100 rounded-lg mb-2 flex items-center justify-center text-4xl">
            🍽️
          </div>
        {/if}
        <div class="font-medium">{r.title}</div>
        <div class="text-xs text-stone-500 mt-1 font-mono">{r.code}</div>
      </a>
    {/each}
  </div>
{:else}
  <div class="card text-center text-stone-600 py-12">
    <div class="text-5xl mb-3">🍳</div>
    <p class="mb-4">Aucune recette pour l'instant.</p>
    <a href="/recipes/new" class="btn-primary">+ Crée ta première recette</a>
  </div>
{/if}
