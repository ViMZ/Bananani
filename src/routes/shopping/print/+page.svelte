<script>
  import { onMount } from 'svelte';
  let { data } = $props();

  let grouped = $derived(() => {
    const groups = {};
    for (const item of data.items) {
      const key = item.recipeTitle || 'Divers';
      (groups[key] ??= []).push(item);
    }
    return Object.entries(groups);
  });

  function print() {
    window.print();
  }
</script>

<div class="no-print flex items-center justify-between gap-4 mb-4">
  <a href="/shopping" class="btn-secondary">← Retour</a>
  <button class="btn-primary" onclick={print}>🖨️ Imprimer</button>
</div>

<div class="bg-white p-8 max-w-[700px] mx-auto rounded-xl shadow-sm">
  <header class="border-b-2 border-stone-300 pb-2 mb-4">
    <h1 class="text-2xl font-display font-bold">Liste de courses</h1>
    <p class="text-xs text-stone-500">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </header>

  {#if data.items.length === 0}
    <p class="text-stone-500 italic">Aucun article à acheter.</p>
  {:else}
    <div class="space-y-4">
      {#each grouped() as [groupName, items]}
        <section>
          <h2 class="font-bold text-banana-700 mb-1 border-b border-stone-200">{groupName}</h2>
          <ul class="space-y-1">
            {#each items as item}
              <li class="flex items-baseline gap-2">
                <span class="inline-block w-4 h-4 border border-stone-400 rounded-sm flex-shrink-0 mt-1"></span>
                <span>
                  <span class="font-medium">{item.name}</span>
                  {#if item.quantity}<span> — {item.quantity} {item.unit}</span>{/if}
                  {#if item.brand || item.productReference}
                    <span class="text-xs text-stone-600"> ({[item.brand, item.productReference].filter(Boolean).join(' · ')})</span>
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  @media print {
    :global(header), :global(footer), :global(.no-print) { display: none !important; }
    :global(main) { padding: 0 !important; }
    :global(body) { background: white !important; }
  }
</style>
