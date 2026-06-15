<script>
  import Sprig from '$lib/components/Sprig.svelte';
  import Ornament from '$lib/components/Ornament.svelte';

  let { data } = $props();
</script>

<!-- Hero -->
<section class="text-center mb-16 md:mb-20">
  <div class="h-eyebrow mb-4">Bananani · Ricettario di famiglia</div>

  <div class="flex justify-center mb-4">
    <Sprig width={140} />
  </div>

  <h1 class="h-display text-5xl md:text-7xl lg:text-[88px] text-balance max-w-3xl mx-auto leading-[1]">
    <span class="italic">La tua cucina,</span><br />
    sur le frigo.
  </h1>

  <p class="mt-6 max-w-xl mx-auto text-base md:text-lg leading-relaxed text-sepia">
    Conserve tes recettes préférées. Imprime de jolies fiches avec code-barres.
    Scanne-les avant les courses — tous les ingrédients filent dans ta liste.
  </p>

  <div class="mt-8 flex flex-wrap gap-3 justify-center">
    <a href="/recipes/new" class="btn-primary btn-lg">＋ Nouvelle recette</a>
    <a href="/scan" class="btn-secondary btn-lg">Scanner une fiche</a>
  </div>
</section>

<!-- Stats — discrète bande -->
<section class="mb-16 md:mb-20">
  <Ornament glyph="❦" tone="terra" />

  <div class="grid grid-cols-3 gap-4 md:gap-10 text-center">
    <a href="/recipes" class="block group">
      <div class="font-display text-5xl md:text-6xl text-mare leading-none group-hover:text-mare-deep transition-colors">
        {data.totalRecipes}
      </div>
      <div class="h-eyebrow mt-2">Ricette</div>
    </a>
    <a href="/shopping" class="block group">
      <div class="font-display text-5xl md:text-6xl leading-none transition-colors {data.pendingShoppingCount > 0 ? 'text-terra group-hover:text-terra/80' : 'text-mare group-hover:text-mare-deep'}">
        {data.pendingShoppingCount}
      </div>
      <div class="h-eyebrow mt-2">À acheter</div>
    </a>
    <a href="/scan" class="block group">
      <div class="font-display italic text-4xl md:text-5xl text-oliva leading-tight group-hover:text-oliva/80 transition-colors">
        scan&nbsp;→
      </div>
      <div class="h-eyebrow mt-2">Aux courses</div>
    </a>
  </div>

  <Ornament glyph="❦" tone="terra" />
</section>

<!-- Dernières recettes -->
{#if data.recent.length > 0}
  <section>
    <div class="flex items-end justify-between mb-8 flex-wrap gap-4">
      <div>
        <div class="h-eyebrow mb-1">Les dernières</div>
        <h2 class="h-display text-3xl md:text-4xl italic">Dernières recettes</h2>
      </div>
      <a href="/recipes" class="link text-sm">Voir tout le ricettario →</a>
    </div>

    <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
      {#each data.recent as r}
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
              <div class="codice mt-3 flex items-center gap-2">
                <span class="text-limone">✦</span>
                {r.code}
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </section>
{:else}
  <section class="text-center py-16">
    <div class="flex justify-center mb-4 opacity-50">
      <Sprig width={120} />
    </div>
    <h2 class="h-display text-3xl italic text-sepia mb-2">Ricettario vide</h2>
    <p class="text-sepia mb-8">Pas encore de recettes — commence ta collection.</p>
    <a href="/recipes/new" class="btn-primary btn-lg">＋ Ajouter une première recette</a>
  </section>
{/if}
