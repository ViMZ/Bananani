<script>
  import Barcode from '$lib/components/Barcode.svelte';
  let { data } = $props();
  let { recipe, ingredients } = $derived(data);

  function print() {
    window.print();
  }
</script>

<div class="no-print flex items-center justify-between gap-4 mb-4">
  <a href="/recipes/{recipe.id}" class="btn-secondary">← Retour</a>
  <button class="btn-primary" onclick={print}>🖨️ Imprimer</button>
</div>

<div class="card mx-auto max-w-[700px] print-page" style="aspect-ratio: 1 / 1.414;">
  <div class="h-full flex flex-col">
    <div class="flex items-start gap-4 mb-4">
      <div class="flex-1">
        <h1 class="text-3xl font-display font-bold leading-tight">{recipe.title}</h1>
        {#if recipe.description}
          <p class="text-stone-600 mt-1">{recipe.description}</p>
        {/if}
        <div class="text-sm text-stone-500 mt-2">
          Pour {recipe.servings} personne{recipe.servings > 1 ? 's' : ''}
        </div>
      </div>
      {#if recipe.photoPath}
        <img src={recipe.photoPath} alt={recipe.title} class="w-32 h-32 object-cover rounded-lg shadow-sm" />
      {:else}
        <div class="w-32 h-32 bg-stone-100 rounded-lg flex items-center justify-center text-5xl">🍽️</div>
      {/if}
    </div>

    <section class="flex-1 overflow-hidden">
      <h2 class="text-base font-bold mb-2 border-b border-stone-300 pb-1">Ingrédients</h2>
      {#if ingredients.length === 0}
        <p class="text-stone-500 italic text-sm">Aucun ingrédient.</p>
      {:else}
        <ul class="text-sm space-y-1 columns-2 gap-6">
          {#each ingredients as i}
            <li class="break-inside-avoid">
              <span class="font-medium">{i.name}</span>
              {#if i.quantity}<span class="text-stone-700"> — {i.quantity} {i.unit}</span>{/if}
              {#if i.brand || i.productReference}
                <span class="text-xs text-stone-500"> ({[i.brand, i.productReference].filter(Boolean).join(' · ')})</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <footer class="mt-4 pt-4 border-t border-stone-300 flex items-end justify-between gap-4">
      <div class="text-xs text-stone-500">
        🍌 Bananani<br />
        Scanne ce code pour ajouter les ingrédients à la liste de courses.
      </div>
      <div class="text-center">
        <Barcode value={recipe.code} height={70} width={2} />
      </div>
    </footer>
  </div>
</div>

<style>
  @media print {
    :global(header), :global(footer), :global(.no-print) { display: none !important; }
    :global(main) { padding: 0 !important; max-width: 100% !important; }
  }
</style>
