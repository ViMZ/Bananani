<script>
  import Sprig from '$lib/components/Sprig.svelte';
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

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
</script>

<div class="no-print flex items-center justify-between gap-4 mb-8">
  <a href="/shopping" class="btn-secondary">← Retour</a>
  <button class="btn-primary" onclick={print}>🍋 Imprimer</button>
</div>

<article class="bg-panna shadow-soft-lg mx-auto max-w-[760px] print-page relative">
  <div class="absolute inset-3 border border-mare/40 pointer-events-none"></div>
  <div class="absolute inset-[14px] border border-umber/15 pointer-events-none"></div>

  <div class="relative p-9 md:p-12">
    <header class="text-center pb-6">
      <div class="h-eyebrow text-mare mb-2">La Casa di Bananani · Liste de courses</div>
      <h1 class="h-display text-4xl md:text-5xl italic">Liste de courses</h1>
      <div class="text-sm italic text-sepia mt-2">
        {today} · {data.items.length} article{data.items.length > 1 ? 's' : ''}
      </div>
      <div class="flex justify-center mt-3">
        <Sprig width={120} />
      </div>
    </header>

    {#if data.items.length === 0}
      <p class="text-center text-sepia italic">Rien — liste vide.</p>
    {:else}
      <div class="space-y-8">
        {#each grouped() as [groupName, items]}
          <section>
            <div class="flex items-baseline gap-4 mb-3">
              <h2 class="h-display italic text-xl text-mare">{groupName}</h2>
              <span class="flex-1 h-px bg-mare/30"></span>
              <span class="h-eyebrow text-mare">{items.length}</span>
            </div>
            <ul class="space-y-1.5">
              {#each items as item}
                <li class="grid grid-cols-[20px_1fr_auto] gap-3 items-baseline">
                  <span class="w-4 h-4 border border-umber/40 rounded-sm inline-block mt-0.5"></span>
                  <div>
                    <span class="font-sans font-medium text-umber">{item.name}</span>
                    {#if item.brand || item.productReference}
                      <span class="font-mono text-[10px] uppercase tracking-wider text-sepia">
                        &nbsp;·&nbsp;{[item.brand, item.productReference].filter(Boolean).join(' · ')}
                      </span>
                    {/if}
                  </div>
                  {#if item.quantity}
                    <span class="font-display text-base text-umber whitespace-nowrap">
                      {item.quantity}<span class="text-sepia text-xs font-sans">{item.unit}</span>
                    </span>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    {/if}

    <footer class="mt-10 pt-4 border-t border-mare/30 text-center text-xs italic text-sepia">
      Bananani · imprimé pour usage en magasin · la dolce vita
    </footer>
  </div>
</article>

<style>
  @media print {
    :global(header), :global(footer), :global(.no-print) { display: none !important; }
    :global(main) { padding: 0 !important; max-width: 100% !important; }
    :global(body) { background: white !important; background-image: none !important; }
    article { box-shadow: none !important; }
  }
</style>
