<script>
  let { data } = $props();
  let { recipe, ingredients } = $derived(data);

  let confirmDelete = $state(false);
</script>

<div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
  <div>
    <h1 class="text-3xl font-display font-bold">{recipe.title}</h1>
    {#if recipe.description}
      <p class="text-stone-600 mt-1">{recipe.description}</p>
    {/if}
    <div class="text-xs text-stone-500 mt-2 font-mono">Code : {recipe.code}</div>
  </div>
  <div class="flex flex-wrap gap-2">
    <a href="/recipes/{recipe.id}/card" class="btn-secondary">🏷️ Fiche imprimable</a>
    <a href="/recipes/{recipe.id}/edit" class="btn-secondary">✏️ Modifier</a>
    <form method="POST" action="?/addToShopping">
      <button class="btn-primary">🛒 Ajouter aux courses</button>
    </form>
  </div>
</div>

<div class="grid md:grid-cols-[1fr_2fr] gap-6">
  <div>
    {#if recipe.photoPath}
      <img src={recipe.photoPath} alt={recipe.title} class="w-full rounded-xl shadow-sm object-cover aspect-square" />
    {:else}
      <div class="w-full rounded-xl bg-stone-100 aspect-square flex items-center justify-center text-7xl">🍽️</div>
    {/if}
    <div class="mt-3 text-sm text-stone-600 text-center">
      Pour {recipe.servings} personne{recipe.servings > 1 ? 's' : ''}
    </div>
  </div>

  <div class="space-y-6">
    <section class="card">
      <h2 class="text-lg font-display font-bold mb-3">Ingrédients</h2>
      {#if ingredients.length === 0}
        <p class="text-stone-500 italic">Aucun ingrédient.</p>
      {:else}
        <ul class="space-y-2">
          {#each ingredients as i}
            <li class="flex flex-wrap items-baseline gap-2 border-b border-stone-100 pb-2 last:border-0">
              <span class="font-medium">{i.name}</span>
              {#if i.quantity}
                <span class="text-stone-600">— {i.quantity} {i.unit}</span>
              {/if}
              {#if i.brand || i.productReference}
                <span class="text-xs text-stone-500">
                  ({[i.brand, i.productReference].filter(Boolean).join(' · ')})
                </span>
              {/if}
              {#if i.notes}
                <div class="w-full text-xs text-stone-500 italic">{i.notes}</div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if recipe.instructions}
      <section class="card">
        <h2 class="text-lg font-display font-bold mb-3">Instructions</h2>
        <div class="whitespace-pre-wrap text-stone-800">{recipe.instructions}</div>
      </section>
    {/if}

    <section class="card border-red-100">
      {#if !confirmDelete}
        <button class="btn-danger" onclick={() => (confirmDelete = true)}>🗑️ Supprimer la recette</button>
      {:else}
        <p class="mb-3 text-stone-700">Confirmer la suppression définitive ?</p>
        <div class="flex gap-2">
          <form method="POST" action="?/delete">
            <button class="btn-danger">Oui, supprimer</button>
          </form>
          <button class="btn-secondary" onclick={() => (confirmDelete = false)}>Annuler</button>
        </div>
      {/if}
    </section>
  </div>
</div>
