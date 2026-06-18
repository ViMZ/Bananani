<script>
  import Sprig from '$lib/components/Sprig.svelte';
  import Ornament from '$lib/components/Ornament.svelte';
  import BackLink from '$lib/components/BackLink.svelte';

  let { data, form } = $props();
  let { recipe, ingredients } = $derived(data);

  let confirmDelete = $state(false);

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  function roman(n) {
    return romanNumerals[n - 1] || String(n);
  }
</script>

<div class="mb-6">
  <BackLink href="/recipes" label="Retour au ricettario" />
</div>

<!-- Header éditorial -->
<header class="mb-10 text-center">
  <div class="h-eyebrow mb-3">Ricetta · <span class="codice text-sepia">{recipe.code}</span></div>

  <h1 class="h-display text-4xl sm:text-5xl md:text-7xl italic text-balance max-w-3xl mx-auto leading-[1]">
    {recipe.title}
  </h1>

  {#if recipe.description}
    <p class="mt-4 font-sans text-base text-sepia italic max-w-xl mx-auto">{recipe.description}</p>
  {/if}

  {#if recipe.owner}
    <p class="mt-3 font-display italic text-lg text-mare">de {recipe.owner}</p>
  {/if}

  <div class="flex justify-center mt-6">
    <Sprig width={120} />
  </div>
</header>

<!-- Actions -->
<div class="no-print mb-12">
  <div class="flex flex-wrap gap-2 justify-center">
    {#if data.inShoppingList}
      <a href="/shopping" class="btn-secondary">✓ Déjà dans les courses</a>
      <form method="POST" action="?/addToShopping">
        <input type="hidden" name="force" value="1" />
        <button class="btn-primary">＋ Ajouter à nouveau</button>
      </form>
    {:else}
      <form method="POST" action="?/addToShopping">
        <button class="btn-primary">＋ Ajouter aux courses</button>
      </form>
    {/if}
    <a href="/recipes/{recipe.id}/card" class="btn-lemon">🍋 Recette imprimable</a>
    <a href="/recipes/{recipe.id}/edit" class="btn-secondary">Modifier</a>
  </div>
  {#if form?.alreadyInList}
    <p class="text-center text-sm italic text-sepia mt-3">Cette recette est déjà dans la liste de courses.</p>
  {:else if form?.empty}
    <p class="text-center text-sm italic text-sepia mt-3">Aucun ingrédient à ajouter.</p>
  {/if}
</div>

<!-- Contenu deux colonnes -->
<div class="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10 md:gap-14">
  <aside class="md:sticky md:top-28 self-start space-y-6">
    {#if recipe.photoPath}
      <div class="bg-panna p-3 rounded-card shadow-soft-lg border border-umber/15">
        <img src={recipe.photoPath} alt={recipe.title} class="w-full aspect-square object-cover rounded" />
      </div>
    {:else}
      <div class="bg-sand p-3 rounded-card shadow-soft-lg border border-umber/15">
        <div class="w-full aspect-square bg-linen flex items-center justify-center rounded">
          <span class="font-display italic text-7xl text-sepia">N°</span>
        </div>
      </div>
    {/if}

    <!-- Meta cards -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card-flat text-center py-4">
        <div class="h-eyebrow">Personnes</div>
        <div class="font-display text-3xl text-mare mt-1">{recipe.servings}</div>
      </div>
      <div class="card-flat text-center py-4">
        <div class="h-eyebrow">Ingr.</div>
        <div class="font-display text-3xl text-mare mt-1">{ingredients.length}</div>
      </div>
    </div>
  </aside>

  <!-- Colonne contenu -->
  <div class="space-y-12">
    <section>
      <div class="flex items-baseline gap-4 mb-6">
        <h2 class="h-display text-3xl italic text-umber">Gli ingredienti</h2>
        <span class="flex-1 h-px bg-umber/15"></span>
        <span class="h-eyebrow">{ingredients.length}</span>
      </div>

      {#if ingredients.length === 0}
        <p class="text-sepia italic">Rien — pas encore d'ingrédient.</p>
      {:else}
        <ul class="space-y-4">
          {#each ingredients as i, idx}
            <li class="grid grid-cols-[32px_1fr_auto] gap-4 items-baseline pb-4 border-b border-umber/10 last:border-0">
              <span class="font-display italic text-mare text-lg">{roman(idx + 1)}</span>
              <div>
                <span class="font-sans text-base font-medium">{i.name}</span>
                {#if i.brand || i.productReference}
                  <div class="font-mono text-[11px] uppercase tracking-wider text-sepia mt-0.5">
                    {[i.brand, i.productReference].filter(Boolean).join(' · ')}
                  </div>
                {/if}
                {#if i.notes}
                  <div class="text-sm text-sepia italic mt-0.5">{i.notes}</div>
                {/if}
              </div>
              {#if i.quantity}
                <span class="font-display text-lg text-umber whitespace-nowrap">
                  {i.quantity} <span class="text-sepia text-sm font-sans">{i.unit}</span>
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if recipe.instructions}
      <section>
        <Ornament glyph="✦" tone="terra" />
        <div class="flex items-baseline gap-4 mb-6">
          <h2 class="h-display text-3xl italic text-umber">La preparazione</h2>
          <span class="flex-1 h-px bg-umber/15"></span>
        </div>
        <div class="font-sans whitespace-pre-wrap leading-relaxed text-[15px] text-umber/90">{recipe.instructions}</div>
      </section>
    {/if}

    <section class="no-print pt-8">
      <Ornament glyph="✕" tone="terra" />
      {#if !confirmDelete}
        <div class="text-center">
          <button class="btn-ghost text-terra hover:bg-terra/10" onclick={() => (confirmDelete = true)}>
            Supprimer la recette
          </button>
        </div>
      {:else}
        <div class="card-flat bg-terra-soft/40 text-center max-w-md mx-auto">
          <p class="font-display italic text-lg text-umber mb-4">Supprimer définitivement ?</p>
          <div class="flex gap-2 justify-center">
            <form method="POST" action="?/delete">
              <button class="btn-danger">Oui, supprimer</button>
            </form>
            <button class="btn-secondary" onclick={() => (confirmDelete = false)}>Annuler</button>
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>
