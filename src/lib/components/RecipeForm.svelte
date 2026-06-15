<script>
  let {
    recipe = { title: '', description: '', servings: 2, instructions: '', photoPath: null },
    ingredients = [],
    submitLabel = 'Enregistrer',
    cancelHref = '/recipes'
  } = $props();

  let items = $state(
    ingredients.length > 0
      ? ingredients.map((i) => ({ ...i }))
      : [{ name: '', brand: '', productReference: '', quantity: '', unit: '', notes: '' }]
  );

  function addIngredient() {
    items = [{ name: '', brand: '', productReference: '', quantity: '', unit: '', notes: '' }, ...items];
  }

  function removeIngredient(idx) {
    items = items.filter((_, i) => i !== idx);
    if (items.length === 0) addIngredient();
  }

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
</script>

<form method="POST" enctype="multipart/form-data" class="space-y-10">
  <!-- Identité -->
  <section class="card">
    <div class="h-eyebrow mb-5">— Identité de la recette</div>

    <div class="space-y-5">
      <div>
        <label class="label" for="title">Titre *</label>
        <input
          class="input font-display italic text-2xl"
          id="title"
          name="title"
          required
          value={recipe.title}
          placeholder="Pasta alla carbonara…"
        />
      </div>

      <div class="grid sm:grid-cols-[1fr_140px] gap-4">
        <div>
          <label class="label" for="description">Description courte</label>
          <input class="input italic" id="description" name="description" value={recipe.description ?? ''} placeholder="ex. Recette de la nonna" />
        </div>
        <div>
          <label class="label" for="servings">Personnes</label>
          <input class="input font-display text-center text-xl" id="servings" name="servings" type="number" min="1" max="50" value={recipe.servings ?? 2} />
        </div>
      </div>

      <div>
        <label class="label" for="photo">Photo du plat</label>
        <input class="input file:mr-3 file:border-0 file:bg-mare file:text-panna file:px-3 file:py-1.5 file:rounded file:font-sans file:text-xs file:font-medium file:cursor-pointer file:hover:bg-mare-deep" id="photo" name="photo" type="file" accept="image/*" />
        {#if recipe.photoPath}
          <div class="mt-3 flex items-center gap-4 p-3 bg-sand rounded border border-umber/15">
            <img src={recipe.photoPath} alt="Photo actuelle" class="w-20 h-20 object-cover rounded shadow-soft" />
            <label class="text-sm flex items-center gap-2 cursor-pointer text-umber">
              <input type="checkbox" name="remove_photo" class="w-4 h-4 accent-terra" /> Supprimer la photo actuelle
            </label>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- Ingrédients -->
  <section class="card">
    <div class="flex items-center justify-between mb-5">
      <div class="h-eyebrow">— Gli ingredienti</div>
      <button type="button" class="btn-secondary btn-sm" onclick={addIngredient}>＋ Ajouter</button>
    </div>

    <div class="space-y-4">
      {#each items as item, idx}
        <div class="bg-linen rounded p-4 border border-umber/10 relative">
          <span class="absolute -top-3 left-4 px-2 bg-linen font-display italic text-mare text-lg leading-none">
            {romanNumerals[idx] || idx + 1}
          </span>

          <div class="grid sm:grid-cols-[1fr_100px_90px] gap-2 mb-2 mt-1">
            <input class="input" name="ing_name" placeholder="Nom (ex. Pomodori pelati)" required={idx === 0} bind:value={item.name} />
            <input class="input font-mono text-center" name="ing_quantity" type="number" step="0.01" min="0" placeholder="Qté" bind:value={item.quantity} />
            <input class="input font-mono" name="ing_unit" placeholder="g / ml" bind:value={item.unit} />
          </div>
          <div class="grid sm:grid-cols-2 gap-2 mb-2">
            <input class="input" name="ing_brand" placeholder="Marque (ex. Mutti)" bind:value={item.brand} />
            <input class="input font-mono text-sm" name="ing_product_reference" placeholder="Référence produit" bind:value={item.productReference} />
          </div>
          <div class="flex items-start gap-2">
            <input class="input flex-1 italic" name="ing_notes" placeholder="Notes (optionnel)" bind:value={item.notes} />
            <button type="button" class="btn-ghost text-terra hover:bg-terra/10 shrink-0 p-2.5" onclick={() => removeIngredient(idx)} aria-label="Supprimer">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Instructions -->
  <section class="card">
    <div class="h-eyebrow mb-4">— La preparazione</div>
    <textarea
      class="input min-h-[260px] font-sans leading-relaxed"
      id="instructions"
      name="instructions"
      placeholder="Step 1. Faire bouillir l'eau salée…&#10;Step 2. Pendant ce temps…"
    >{recipe.instructions ?? ''}</textarea>
  </section>

  <div class="flex flex-wrap gap-3 justify-end">
    <a href={cancelHref} class="btn-secondary">Annuler</a>
    <button type="submit" class="btn-primary btn-lg">{submitLabel}</button>
  </div>
</form>
