<script>
  import Barcode from '$lib/components/Barcode.svelte';
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
  <button class="btn-primary" onclick={print}>🍋 Imprimer la recette</button>
</div>

<!-- La carta (carte type menu de trattoria) -->
<article class="fiche relative mx-auto max-w-[760px] bg-panna shadow-soft-lg">
  <!-- Cadre double : bordure intérieure en deuxième -->
  <div class="absolute inset-3 border border-mare/40 pointer-events-none"></div>
  <div class="absolute inset-[14px] border border-umber/15 pointer-events-none"></div>

  <div class="relative h-full flex flex-col p-7 md:p-9">
    <!-- Bandeau d'en-tête -->
    <header class="text-center pb-3">
      <div class="h-eyebrow text-mare mb-2">La Casa di Bananani · N° {recipe.id.toString().padStart(4, '0')}</div>

      <h1 class="h-display text-3xl md:text-4xl italic text-balance leading-[1.05]">
        {recipe.title}
      </h1>

      {#if recipe.description}
        <p class="font-display italic text-sm text-sepia mt-1">{recipe.description}</p>
      {/if}

      {#if recipe.owner}
        <p class="font-display italic text-sm text-mare mt-1">de {recipe.owner}</p>
      {/if}

      <div class="flex justify-center mt-2">
        <Sprig width={110} />
      </div>
    </header>

    <!-- Photo + meta -->
    <div class="grid grid-cols-[120px_1fr] md:grid-cols-[150px_1fr] gap-5 mb-4 items-start">
      {#if recipe.photoPath}
        <div class="bg-panna p-2 shadow-soft border border-umber/15">
          <img src={recipe.photoPath} alt={recipe.title} class="w-full aspect-square object-cover" />
        </div>
      {:else}
        <div class="bg-panna p-2 shadow-soft border border-umber/15">
          <div class="w-full aspect-square bg-sand flex items-center justify-center">
            <span class="font-display italic text-4xl text-sepia">N°</span>
          </div>
        </div>
      {/if}

      <div class="space-y-1.5 text-sm">
        <div class="flex items-baseline justify-between border-b border-dotted border-umber/30 pb-1">
          <span class="text-sepia italic">Pour</span>
          <span class="font-display text-lg text-umber">{recipe.servings} <span class="text-sm font-sans text-sepia">personnes</span></span>
        </div>
        <div class="flex items-baseline justify-between border-b border-dotted border-umber/30 pb-1">
          <span class="text-sepia italic">Ingredienti</span>
          <span class="font-display text-lg text-umber">{ingredients.length}</span>
        </div>
        <div class="pt-1 text-xs italic text-sepia leading-relaxed">
          Recette de la maison.<br />
          À ranger dans le classeur de recettes.
        </div>
      </div>
    </div>

    <!-- Corps : ingrédients (colonne étroite) + préparation (colonne large) -->
    <div class="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-6 overflow-hidden">
      <!-- Ingrédients -->
      <section class="min-w-0">
        <div class="flex items-baseline gap-3 mb-3">
          <h2 class="h-display italic text-xl text-mare">Gli ingredienti</h2>
          <span class="flex-1 h-px bg-mare/30"></span>
          <span class="h-eyebrow text-mare">{ingredients.length}</span>
        </div>

        {#if ingredients.length === 0}
          <p class="text-sepia italic text-sm">Rien — pas d'ingrédient.</p>
        {:else}
          <ul class="space-y-2 text-[12px] leading-snug">
            {#each ingredients as i, idx}
              <li class="grid grid-cols-[22px_1fr] gap-1.5">
                <span class="font-display italic text-mare">{romanNumerals[idx] || idx + 1}</span>
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

      <!-- Préparation -->
      <section class="min-w-0">
        <div class="flex items-baseline gap-3 mb-3">
          <h2 class="h-display italic text-xl text-mare">La preparazione</h2>
          <span class="flex-1 h-px bg-mare/30"></span>
        </div>
        {#if recipe.instructions?.trim()}
          <div class="font-sans whitespace-pre-wrap leading-relaxed text-[12.5px] text-umber/90">{recipe.instructions}</div>
        {:else}
          <p class="text-sepia italic text-sm">Pas d'étapes renseignées.</p>
        {/if}
      </section>
    </div>

    <!-- Pied avec code-barres -->
    <footer class="mt-4 pt-3 border-t border-mare/30 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <div class="h-eyebrow text-terra mb-1">Scannez ce code</div>
        <div class="font-display italic text-base text-umber leading-tight">
          Tutti gli ingredienti<br />
          filent dans la liste de courses.
        </div>
      </div>

      <div class="bg-white border border-umber/30 p-2 text-center shadow-soft shrink-0">
        <Barcode value={recipe.code} svg={data.qrSvg} size={96} />
        <div class="font-mono text-[10px] tracking-widest mt-1 text-umber">{recipe.code}</div>
      </div>
    </footer>
  </div>
</article>

<style>
  /* Allure feuille A4 à l'écran — mais seulement sur écran assez large.
     Sur mobile, l'aspect-ratio fixe imposait une hauteur trop courte pour le
     contenu, qui débordait du cadre : on laisse alors la hauteur s'adapter. */
  .fiche {
    aspect-ratio: 1 / 1.414;
  }
  @media (max-width: 639px) {
    .fiche {
      aspect-ratio: auto;
    }
  }

  @media print {
    /* Reset structurel (html/body/main/no-print, neutralisation du min-h-screen
       du layout) → assuré globalement dans app.css. Ici, juste le calage A4. */
    @page {
      size: A4;
      margin: 0;
    }
    /* Caler la recette sur une page A4 exacte (210×296mm, un poil sous 297 pour
       absorber l'arrondi). overflow caché = aucun débordement → UNE seule page
       (le contenu est condensé pour tenir). print-color-adjust conserve les
       fonds et bordures colorés. */
    .fiche {
      aspect-ratio: auto !important;
      width: 210mm !important;
      max-width: none !important;
      height: 296mm !important;
      margin: 0 auto !important;
      overflow: hidden !important;
      box-shadow: none !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
