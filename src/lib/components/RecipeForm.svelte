<script>
  /**
   * @typedef {{ name: string, brand: string, productReference: string, quantity: number | string, unit: string, notes: string }} Ingredient
   */
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
    items = [...items, { name: '', brand: '', productReference: '', quantity: '', unit: '', notes: '' }];
  }

  function removeIngredient(idx) {
    items = items.filter((_, i) => i !== idx);
    if (items.length === 0) addIngredient();
  }
</script>

<form method="POST" enctype="multipart/form-data" class="space-y-6">
  <div class="card space-y-4">
    <div>
      <label class="label" for="title">Titre de la recette *</label>
      <input class="input" id="title" name="title" required value={recipe.title} placeholder="ex. Pâtes à la carbonara" />
    </div>

    <div class="grid sm:grid-cols-[1fr_120px] gap-4">
      <div>
        <label class="label" for="description">Description courte</label>
        <input class="input" id="description" name="description" value={recipe.description ?? ''} placeholder="ex. Recette de mamie" />
      </div>
      <div>
        <label class="label" for="servings">Personnes</label>
        <input class="input" id="servings" name="servings" type="number" min="1" max="50" value={recipe.servings ?? 2} />
      </div>
    </div>

    <div>
      <label class="label" for="photo">Photo du plat</label>
      <input class="input" id="photo" name="photo" type="file" accept="image/*" />
      {#if recipe.photoPath}
        <div class="mt-2 flex items-center gap-3">
          <img src={recipe.photoPath} alt="Photo actuelle" class="w-24 h-24 object-cover rounded-lg" />
          <label class="text-sm text-stone-600 flex items-center gap-2">
            <input type="checkbox" name="remove_photo" /> Supprimer la photo actuelle
          </label>
        </div>
      {/if}
    </div>
  </div>

  <div class="card">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-display font-bold">Ingrédients</h2>
      <button type="button" class="btn-secondary text-sm" onclick={addIngredient}>+ Ajouter</button>
    </div>

    <div class="space-y-3">
      {#each items as item, idx}
        <div class="border border-stone-200 rounded-lg p-3 bg-stone-50">
          <div class="grid sm:grid-cols-[1fr_100px_80px] gap-2 mb-2">
            <input class="input" name="ing_name" placeholder="Nom (ex. Tomates pelées)" required={idx === 0} bind:value={item.name} />
            <input class="input" name="ing_quantity" type="number" step="0.01" min="0" placeholder="Qté" bind:value={item.quantity} />
            <input class="input" name="ing_unit" placeholder="g / ml / pcs" bind:value={item.unit} />
          </div>
          <div class="grid sm:grid-cols-2 gap-2 mb-2">
            <input class="input" name="ing_brand" placeholder="Marque (optionnel)" bind:value={item.brand} />
            <input class="input" name="ing_product_reference" placeholder="Référence produit (optionnel)" bind:value={item.productReference} />
          </div>
          <div class="flex items-start gap-2">
            <input class="input flex-1" name="ing_notes" placeholder="Notes (optionnel)" bind:value={item.notes} />
            <button type="button" class="btn-danger text-sm" onclick={() => removeIngredient(idx)} aria-label="Supprimer">
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="card">
    <label class="label" for="instructions">Instructions</label>
    <textarea
      class="input min-h-[200px] font-sans"
      id="instructions"
      name="instructions"
      placeholder="Étape 1…&#10;Étape 2…"
    >{recipe.instructions ?? ''}</textarea>
  </div>

  <div class="flex gap-2 justify-end">
    <a href={cancelHref} class="btn-secondary">Annuler</a>
    <button type="submit" class="btn-primary">{submitLabel}</button>
  </div>
</form>
