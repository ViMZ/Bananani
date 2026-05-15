<script>
  import Barcode from '$lib/components/Barcode.svelte';
  import Seal from '$lib/components/Seal.svelte';
  import Sprig from '$lib/components/Sprig.svelte';

  let { data } = $props();
  let { recipe, ingredients } = $derived(data);

  function print() {
    window.print();
  }

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
</script>

<div class="no-print flex items-center justify-between gap-4 mb-8">
  <a href="/recipes/{recipe.id}" class="btn-secondary">← Retour</a>
  <button class="btn-primary" onclick={print}>🍋 Imprimer la fiche</button>
</div>

<!-- La carta (carte type menu de trattoria) -->
<article class="fiche relative mx-auto max-w-[760px] bg-panna shadow-soft-lg print-page" style="aspect-ratio: 1 / 1.414;">
  <!-- Cadre double : bordure intérieure en deuxième -->
  <div class="absolute inset-3 border border-mare/40 pointer-events-none"></div>
  <div class="absolute inset-[14px] border border-umber/15 pointer-events-none"></div>

  <div class="relative h-full flex flex-col p-9 md:p-12">
    <!-- Bandeau d'en-tête -->
    <header class="text-center pb-6">
      <div class="h-eyebrow text-mare mb-2">La Casa di Bananani · N° {recipe.id.toString().padStart(4, '0')}</div>

      <h1 class="h-display text-4xl md:text-5xl italic text-balance leading-[1.05]">
        {recipe.title}
      </h1>

      {#if recipe.description}
        <p class="font-display italic text-base text-sepia mt-2">{recipe.description}</p>
      {/if}

      <div class="flex justify-center mt-3">
        <Sprig width={140} />
      </div>
    </header>

    <!-- Photo + meta -->
    <div class="grid grid-cols-[160px_1fr] md:grid-cols-[200px_1fr] gap-6 mb-6 items-start">
      {#if recipe.photoPath}
        <div class="bg-panna p-2 shadow-soft border border-umber/15">
          <img src={recipe.photoPath} alt={recipe.title} class="w-full aspect-square object-cover" />
        </div>
      {:else}
        <div class="bg-panna p-2 shadow-soft border border-umber/15">
          <div class="w-full aspect-square bg-sand flex items-center justify-center">
            <span class="font-display italic text-5xl text-sepia">N°</span>
          </div>
        </div>
      {/if}

      <div class="space-y-2 text-sm">
        <div class="flex items-baseline justify-between border-b border-dotted border-umber/30 pb-1.5">
          <span class="text-sepia italic">Per</span>
          <span class="font-display text-xl text-umber">{recipe.servings} <span class="text-sm font-sans text-sepia">persone</span></span>
        </div>
        <div class="flex items-baseline justify-between border-b border-dotted border-umber/30 pb-1.5">
          <span class="text-sepia italic">Ingredienti</span>
          <span class="font-display text-xl text-umber">{ingredients.length}</span>
        </div>
        <div class="flex items-baseline justify-between border-b border-dotted border-umber/30 pb-1.5">
          <span class="text-sepia italic">Codice</span>
          <span class="font-mono text-xs tracking-wider text-umber">{recipe.code}</span>
        </div>
        <div class="pt-2 text-xs italic text-sepia leading-relaxed">
          Recette de la maison.<br />
          À conserver précieusement sur le frigo.
        </div>
      </div>
    </div>

    <!-- Section ingrédients -->
    <section class="flex-1 overflow-hidden">
      <div class="flex items-baseline gap-4 mb-4">
        <h2 class="h-display italic text-2xl text-mare">Gli ingredienti</h2>
        <span class="flex-1 h-px bg-mare/30"></span>
        <span class="h-eyebrow text-mare">{ingredients.length}</span>
      </div>

      {#if ingredients.length === 0}
        <p class="text-sepia italic text-sm">Niente — pas d'ingrédient.</p>
      {:else}
        <ul class="columns-2 gap-8 text-[13px] leading-snug">
          {#each ingredients as i, idx}
            <li class="break-inside-avoid mb-3 grid grid-cols-[26px_1fr] gap-1.5">
              <span class="font-display italic text-mare pt-0.5">{romanNumerals[idx] || idx + 1}</span>
              <div>
                <span class="font-sans font-medium text-umber">{i.name}</span>
                {#if i.quantity}
                  <span class="font-display text-umber"> — {i.quantity}<span class="text-sepia font-sans text-[11px]">{i.unit}</span></span>
                {/if}
                {#if i.brand || i.productReference}
                  <div class="font-mono text-[10px] uppercase tracking-wider text-sepia">
                    {[i.brand, i.productReference].filter(Boolean).join(' · ')}
                  </div>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Pied avec code-barres + seal -->
    <footer class="mt-6 pt-5 border-t border-mare/30 grid grid-cols-[auto_1fr_auto] gap-5 items-center">
      <Seal code={recipe.code} label="Codice" size={100} />

      <div class="text-center">
        <div class="h-eyebrow text-terra mb-1">Scannez ce code</div>
        <div class="font-display italic text-base text-umber leading-tight">
          Tutti gli ingredienti<br />
          filent dans la liste de courses.
        </div>
      </div>

      <div class="bg-white border border-umber/30 p-2.5 text-center shadow-soft">
        <Barcode value={recipe.code} svg={data.qrSvg} size={120} />
        <div class="font-mono text-[10px] tracking-widest mt-1.5 text-umber">{recipe.code}</div>
      </div>
    </footer>
  </div>
</article>

<style>
  @media print {
    :global(header), :global(footer), :global(.no-print) { display: none !important; }
    :global(main) { padding: 0 !important; max-width: 100% !important; }
    :global(body) { background: white !important; background-image: none !important; }
    .fiche { box-shadow: none !important; }
  }
</style>
