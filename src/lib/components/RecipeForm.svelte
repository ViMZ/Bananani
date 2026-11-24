<script>
  import { tick, onDestroy, untrack } from 'svelte';
  import { normalizeName } from '$lib/ingredients/normalize';
  import { cleanCategory } from '$lib/ingredients/categories';
  import { UNITS, formatUnit } from '$lib/ingredients/units';
  import Combobox from '$lib/components/Combobox.svelte';
  import PhotoCredit from '$lib/components/PhotoCredit.svelte';
  import RecipeImageSearch from '$lib/components/RecipeImageSearch.svelte';
  import { importRecipe } from '$lib/recipes/import.js';
  import { MAX_CAPTURES, MAX_CAPTURE_BYTES, MAX_RECIPE_URL_LENGTH } from '$lib/recipes/import-limits.js';
  import { MAX_PHOTO_BYTES, MAX_PHOTO_MB, maybeCompress } from '$lib/recipes/photo';

  let {
    recipe = { title: '', description: '', owner: '', servings: 2, instructions: '', photoPath: null },
    ingredients = [],
    catalog = [],
    allowScan = false,
    submitLabel = 'Enregistrer',
    cancelHref = '/recipes'
  } = $props();

  let fields = $state(untrack(() => ({
    title: recipe.title,
    description: recipe.description ?? '',
    owner: recipe.owner ?? '',
    servings: recipe.servings ?? 2,
    instructions: recipe.instructions ?? ''
  })));
  let formElement;
  let scanning = $state(false);
  let scanError = $state('');
  let scanResult = $state(null);
  let scanApplied = $state(false);
  let scanCaptures = $state.raw([]);
  let recipeUrl = $state('');
  let linkError = $state('');
  let scanType = $state('captures');
  let scanPreparing = $state(false);
  let scanWarnings = $state([]);
  let scanUseOriginal = $state(false);
  let scanSuggestedFields = $state([]);
  let lastImport;
  let scanPhase = $state('upload');
  let scanPreview = $derived(scanUseOriginal && scanResult?.original ? scanResult.original : scanResult);
  const suggestionLabels = { title: 'titre', description: 'description', owner: 'auteur', servings: 'personnes',
    name: 'nom', quantity: 'quantité', unit: 'unité', notes: 'notes', brand: 'marque', productReference: 'référence' };
  let preparingSave = $state(false);

  async function scan(source) {
    if (!source.length || scanning || preparingSave) return;
    const link = typeof source === 'string';
    scanType = link ? 'link' : 'captures';
    scanning = true;
    scanPhase = link ? 'link' : 'upload';
    if (link) linkError = '';
    else scanError = '';
    if (lastImport?.source !== source) lastImport = { source, id: crypto.randomUUID() };
    try {
      let payload = source;
      if (!link) {
        scanPreparing = true;
        payload = [];
        for (const { file } of source) {
          const image = await maybeCompress(file, 3000, 0.9, source.length > 1);
          if (source.length > 1 && image.type !== 'image/jpeg') throw new Error('Une capture est illisible. Retire-la ou choisis une autre image.');
          payload.push(image);
        }
        scanPreparing = false;
        if (payload.reduce((size, image) => size + image.size, 0) > MAX_CAPTURE_BYTES) {
          throw new Error('Les images dépassent 10 Mo après optimisation. Choisis des captures plus légères ou mieux cadrées.');
        }
      }
      const result = await importRecipe(payload, { id: lastImport.id, onPhase: phase => { scanPhase = phase; } });
      linkError = '';
      scanError = '';
      scanUseOriginal = false;
      scanResult = result;
      applyScan();
    } catch (err) {
      if (err?.restartImport) lastImport = null;
      const message = err instanceof Error && err.name !== 'TypeError' ? err.message
        : 'L’import a échoué. Réessaie ; ta saisie est conservée.';
      if (link) linkError = message;
      else scanError = message;
    } finally {
      scanning = false;
      scanPreparing = false;
    }
  }

  function onScanChange(event) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length || scanning) return;
    if (scanCaptures.length + files.length > MAX_CAPTURES) {
      scanError = `Choisis au maximum ${MAX_CAPTURES} images par recette.`;
      return;
    }
    scanError = '';
    scanCaptures = [...scanCaptures, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))];
  }

  function moveCapture(index, offset) {
    const destination = index + offset;
    const captures = [...scanCaptures];
    [captures[index], captures[destination]] = [captures[destination], captures[index]];
    scanCaptures = captures;
    scanError = '';
  }

  function removeCapture(index) {
    URL.revokeObjectURL(scanCaptures[index].preview);
    scanCaptures = scanCaptures.filter((_, position) => position !== index);
    scanError = '';
  }

  function applyScan() {
    const { title, description, owner, servings, instructions } = scanPreview.recipe;
    fields = { title, description, owner, servings, instructions };
    items = scanPreview.ingredients.map((i) => ({
      ...blank(), ...i,
      categoryName: normalizeName(i.name),
      suggestedFields: i.suggestedFields?.filter(field => field !== 'category')
    }));
    scanWarnings = scanPreview.warnings || [];
    scanSuggestedFields = scanUseOriginal ? [] : scanResult.review?.suggestedFields || [];
    scanApplied = true;
  }

  // Index normalizedKey -> { unité par défaut, catégorie } du catalogue, pour
  // pré-remplir unité et catégorie quand on saisit/choisit un ingrédient connu.
  const byKey = new Map(
    catalog.map((e) => [e.normalizedKey, { unit: e.defaultUnit, category: e.category }])
  );

  // Noms du catalogue, pour l'autocomplétion du champ « Nom ».
  const catalogNames = catalog.map((e) => e.name);

  function blank() {
    return { key: crypto.randomUUID(), name: '', brand: '', productReference: '', quantity: '', unit: '', notes: '', category: '', categoryName: '' };
  }

  // À l'édition, la catégorie n'est pas stockée sur la ligne : on la retrouve via
  // le catalogue à partir du nom de l'ingrédient.
  let items = $state(
    ingredients.length > 0
      ? ingredients.map((i) => ({
          ...blank(),
          ...i,
          categoryName: normalizeName(i.name),
          category: i.category || byKey.get(normalizeName(i.name))?.category || ''
        }))
      : [blank()]
  );

  function addIngredient() {
    items = [...items, blank()];
  }

  function moveIngredient(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    items = next;
  }

  function removeIngredient(idx) {
    items = items.filter((_, i) => i !== idx);
    if (items.length === 0) addIngredient();
  }

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  // Les rayons du catalogue priment sur les suggestions de l’import.
  function prefillFromCatalog(item) {
    const key = normalizeName(item.name);
    if (item.categoryName && item.categoryName !== key) item.category = '';
    item.categoryName = key;
    const entry = byKey.get(key);
    if (!entry) return;
    if (!item.unit && entry.unit) item.unit = entry.unit;
    if (entry.category) item.category = entry.category;
  }

  async function fillMissingCategories() {
    const missing = items.filter(i => i.name.trim() && !i.category);
    if (!missing.length) return;
    try {
      const response = await fetch('/recipes/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: missing.map(i => i.name.trim()) }),
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok || response.redirected) return;
      const result = await response.json();
      const suggestions = new Map(result.suggestions.map(i => [i.key, i.category]));
      for (const item of missing) item.category = cleanCategory(suggestions.get(normalizeName(item.name)));
    } catch {
      // L’enregistrement reste possible si le classement est indisponible.
    }
  }

  // --- Photo : compression/redimensionnement automatique côté client ---
  // On redimensionne au choix du fichier (canvas → JPEG) pour éviter les uploads
  // lourds : plus besoin de réduire l'image soi-même, et on ne dépasse plus la
  // limite serveur (BODY_SIZE_LIMIT). Une validation de taille reste en filet de
  // sécurité — un POST trop lourd renverrait une 500 qui efface toute la saisie.
  let photoError = $state('');
  let photoInfo = $state('');
  let compressing = $state(false);
  let photoInput;
  let photoPreview = $state('');
  let selectedImage = $state(null);
  let imageSearchOpen = $state(false);
  let imageQuery = $state(null);

  function clearPreview() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = '';
  }
  onDestroy(() => {
    clearPreview();
    for (const capture of scanCaptures) URL.revokeObjectURL(capture.preview);
  });

  function chooseImage(image) {
    clearPreview();
    photoInput.value = '';
    selectedImage = image;
    photoError = '';
    photoInfo = '';
    imageSearchOpen = false;
  }

  async function onPhotoChange(e) {
    photoError = '';
    photoInfo = '';
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    selectedImage = null;
    clearPreview();

    compressing = true;
    try {
      const out = await maybeCompress(file);
      if (out !== file || input !== photoInput) {
        // Remplace le fichier de l'input par la version optimisée (soumise au submit).
        const dt = new DataTransfer();
        dt.items.add(out);
        photoInput.files = dt.files;
        if (out !== file) photoInfo = `Photo optimisée : ${(file.size / 1024 / 1024).toFixed(1)} Mo → ${(out.size / 1024 / 1024).toFixed(1)} Mo`;
      }
    } catch {
      photoError = 'Impossible de préparer cette photo. Essaie de la choisir dans la galerie.';
    } finally {
      compressing = false;
    }

    const finalFile = photoInput.files?.[0];
    if (finalFile && finalFile.size > MAX_PHOTO_BYTES) {
      photoError = `Même optimisée, cette photo fait ${(finalFile.size / 1024 / 1024).toFixed(1)} Mo (maximum ${MAX_PHOTO_MB} Mo). Choisis une image plus légère — ta saisie est conservée.`;
    }
    if (finalFile && !photoError) photoPreview = URL.createObjectURL(finalFile);
  }

  async function onSubmit(e) {
    if (compressing || photoError || scanning || preparingSave) {
      e.preventDefault();
      if (photoError) {
        document.getElementById('photo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    e.preventDefault();
    preparingSave = true;
    for (const item of items) prefillFromCatalog(item);
    await fillMissingCategories();
    preparingSave = false;
    // Met à jour les champs masqués et réactive la validation avant l’envoi.
    await tick();
    if (formElement?.reportValidity()) formElement.submit();
  }
</script>

{#if allowScan}
  <section id="import-scan" class="card mb-8 space-y-4" inert={preparingSave}>
    <h2 class="h-eyebrow">Importer une recette</h2>
    <form class="space-y-2" onsubmit={(event) => { event.preventDefault(); void scan(recipeUrl.trim()); }}>
      <label class="label" for="recipe-import-url">Lien de la recette</label>
      <div class="flex flex-wrap gap-2">
        <input id="recipe-import-url" class="input flex-1 min-w-0 basis-52" type="url" bind:value={recipeUrl}
          placeholder="https://…" maxlength={MAX_RECIPE_URL_LENGTH} disabled={scanning} aria-invalid={!!linkError}
          aria-describedby={linkError ? 'recipe-link-error' : undefined} oninput={() => { linkError = ''; }} required />
        <button type="submit" class="btn-secondary" disabled={scanning || !recipeUrl.trim()}>Importer le lien</button>
      </div>
      {#if linkError}<p id="recipe-link-error" role="alert" class="text-sm text-terra">{linkError}</p>{/if}
    </form>

    <div class="border-t border-umber/15 pt-4 space-y-3">
      <h3 class="font-medium">Captures ou photos</h3>
      <p class="text-sm text-sepia">Photographie une fiche personnelle ou ajoute jusqu’à {MAX_CAPTURES} captures. Place les images dans l’ordre de lecture, du haut vers le bas.</p>
      <div class="flex flex-wrap gap-2">
        <label class="btn-secondary cursor-pointer">
          Prendre une photo
          <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
            disabled={scanning || scanCaptures.length >= MAX_CAPTURES} onchange={onScanChange} />
        </label>
        <label class="btn-secondary cursor-pointer">
          Ajouter des images
          <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple
            disabled={scanning || scanCaptures.length >= MAX_CAPTURES} onchange={onScanChange} />
        </label>
      </div>
      {#if scanCaptures.length}
        <ol class="space-y-2">
          {#each scanCaptures as capture, index (capture.preview)}
            <li class="flex flex-wrap items-center gap-2 rounded bg-linen p-2">
              <img class="size-12 rounded object-contain" src={capture.preview} alt="" />
              <span class="flex-1 break-all text-sm min-w-[6rem]">{index + 1}. {capture.file.name}</span>
              <div class="flex gap-1">
                <button type="button" class="btn-secondary btn-sm" disabled={scanning || index === 0}
                  aria-label={`Monter l’image ${index + 1}`} onclick={() => moveCapture(index, -1)}>↑</button>
                <button type="button" class="btn-secondary btn-sm" disabled={scanning || index === scanCaptures.length - 1}
                  aria-label={`Descendre l’image ${index + 1}`} onclick={() => moveCapture(index, 1)}>↓</button>
                <button type="button" class="btn-ghost btn-sm" disabled={scanning}
                  aria-label={`Retirer l’image ${index + 1}`} onclick={() => removeCapture(index)}>Retirer</button>
              </div>
            </li>
          {/each}
        </ol>
        <button type="button" class="btn-secondary" disabled={scanning} onclick={() => scan(scanCaptures)}>
          {scanCaptures.length === 1 ? 'Importer l’image' : `Importer les ${scanCaptures.length} images`}
        </button>
      {/if}
      {#if scanError}<p role="alert" class="text-sm text-terra">{scanError}</p>{/if}
    </div>
    <div aria-live="polite" aria-busy={scanning}>
      {#if scanning}
        <p class="text-sm text-mare">
          {scanPhase === 'reconnecting' ? 'Connexion interrompue. Reprise de l’import…'
            : scanType === 'link' ? 'Lecture de la page de la recette…'
            : scanPreparing ? 'Préparation des images…'
            : scanPhase === 'upload' ? 'Envoi des images…'
            : scanPhase === 'review' ? 'Texte lu. Vérification et préremplissage de la recette…'
            : 'Lecture du texte de la recette…'}
        </p>
      {/if}
      {#if scanApplied}<p class="text-sm text-mare mt-3">Recette préremplie. Vérifie les ingrédients, les portions et les étapes, puis clique sur « Créer la recette ».</p>{/if}
      {#if scanApplied}{#each scanWarnings as warning}<p class="text-sm text-sepia mt-2">{warning}</p>{/each}{/if}
      {#if scanApplied && scanSuggestedFields.length}<p class="text-sm text-sepia mt-2">Champs complétés ou ajustés à relire : {scanSuggestedFields.map(f => suggestionLabels[f]).join(', ')}.</p>{/if}
    </div>
    {#if scanResult}
      <div class="bg-linen rounded p-4 space-y-3">
        {#if scanResult.review?.status === 'complete'}
          <p class="text-sm font-medium text-mare">Recette relue · suggestions à vérifier</p>
          <p class="text-sm text-sepia">Les champs marqués ont été complétés ou ajustés. Les quantités et portions proposées peuvent être des estimations.</p>
          {#if scanResult.original}
            <label class="flex gap-2 items-start text-sm"><input type="checkbox" checked={scanUseOriginal} onchange={(event) => { scanUseOriginal = event.currentTarget.checked; applyScan(); }} class="mt-1 accent-mare" /> Remplacer les champs par la lecture OCR d’origine, sans les suggestions</label>
          {/if}
        {:else if scanResult.review?.status === 'unavailable'}
          <p class="text-sm font-medium text-terra">Lecture OCR seulement · suggestions indisponibles</p>
        {/if}
        <p class="text-sm">{scanPreview.recipe.title || 'Titre à compléter'} · {scanPreview.ingredients.length} ingrédients importés dans le formulaire ci-dessous.</p>
        {#if scanResult.review?.status === 'complete'}
          <details>
            <summary class="cursor-pointer text-sm">Voir les ajustements et leurs explications</summary>
            <ul class="text-sm space-y-1 mt-2">{#each scanResult.review.explanations as explanation}<li>{explanation}</li>{/each}</ul>
            <ul class="text-xs text-sepia space-y-1 mt-3">{#each scanResult.review.changes as change}<li>{change}</li>{/each}</ul>
          </details>
        {/if}
        {#if scanResult.original || scanResult.ocrText}
          <details>
            <summary class="cursor-pointer text-sm">Voir la lecture OCR d’origine</summary>
            {#if scanResult.original}
              <p class="text-sm mt-2">{scanResult.original.recipe.title} · Personnes : {scanResult.original.recipe.servings || 'non indiquées'}</p>
              <ul class="text-sm space-y-1 mt-2">{#each scanResult.original.ingredients as ingredient}<li>{ingredient.quantity} {formatUnit(ingredient.unit, ingredient.quantity)} {ingredient.name}{ingredient.notes ? ` — ${ingredient.notes}` : ''}</li>{/each}</ul>
              <p class="whitespace-pre-wrap text-sm mt-2">{scanResult.original.recipe.instructions}</p>
            {/if}
            {#if scanResult.ocrText}<pre class="whitespace-pre-wrap break-words text-xs mt-3 max-h-72 overflow-auto">{scanResult.ocrText}</pre>{/if}
          </details>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<form bind:this={formElement} method="POST" enctype="multipart/form-data" class="space-y-10" onsubmit={onSubmit}>
  <fieldset class="space-y-10 min-w-0" inert={preparingSave} disabled={scanning} aria-label="Saisie de la recette">
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
          bind:value={fields.title}
          placeholder="Pasta alla carbonara…"
        />
      </div>

      <div class="grid sm:grid-cols-[1fr_140px] gap-4">
        <div>
          <label class="label" for="description">Description courte</label>
          <input class="input italic" id="description" name="description" bind:value={fields.description} placeholder="ex. Recette de la nonna" />
        </div>
        <div>
          <label class="label" for="servings">Personnes de référence</label>
          <input class="input font-display text-center text-xl" id="servings" name="servings" type="number" min="1" max="50" required bind:value={fields.servings} />
          <p class="text-xs text-sepia mt-1">Quantités pour ce nombre de personnes. Tu pourras l’adapter à chaque repas dans la semaine.</p>
        </div>
      </div>

      <div>
        <label class="label" for="owner">Recette de</label>
        <input class="input italic" id="owner" name="owner" bind:value={fields.owner} placeholder="ex. Mamie, Vincent…" />
      </div>

      <div>
        <label class="label" for="photo">Photo du plat</label>
        <div class="flex flex-wrap gap-2">
          <label class="btn-secondary cursor-pointer">Prendre une photo du plat
            <input class="sr-only" aria-label="Prendre une photo du plat" type="file" accept="image/*" capture="environment" disabled={compressing} onchange={onPhotoChange} />
          </label>
          <label class="btn-secondary cursor-pointer">Choisir dans la galerie
            <input class="sr-only" bind:this={photoInput} id="photo" name="photo" type="file" accept="image/*" disabled={compressing} onchange={onPhotoChange} />
          </label>
          <button type="button" class="btn-secondary" disabled={compressing} onclick={() => { imageSearchOpen = !imageSearchOpen; imageQuery ??= fields.title; }}>Rechercher une image</button>
        </div>
        <input type="hidden" name="photo_commons_id" value={selectedImage?.pageId ?? ''} />
        {#if photoPreview || selectedImage}
          <div class="mt-3 space-y-2">
            <div class="relative w-40">
              <img src={photoPreview || selectedImage.url} alt="Aperçu du plat choisi" class="size-40 rounded object-cover" />
              {#if selectedImage}<PhotoCredit image={selectedImage} />{/if}
            </div>
            <button type="button" class="btn-ghost btn-sm" onclick={() => { clearPreview(); selectedImage = null; photoInput.value = ''; photoInfo = ''; photoError = ''; }}>Annuler ce choix</button>
          </div>
        {/if}
        {#if imageQuery !== null}
          <div hidden={!imageSearchOpen} class="mt-4 p-4 bg-linen rounded space-y-3">
            <p class="text-sm text-sepia">Images réutilisables de Wikimedia Commons. L’auteur, la licence et le lien source seront conservés avec la recette.</p>
            <RecipeImageSearch initialQuery={imageQuery} onSelect={chooseImage} />
          </div>
        {/if}
        <p class="text-xs text-sepia italic mt-1.5">
          JPEG, PNG, WebP ou GIF · les grandes photos sont automatiquement optimisées.
        </p>
        {#if compressing}
          <p class="mt-2 text-sm italic text-mare">Optimisation de la photo…</p>
        {/if}
        {#if photoInfo}
          <p class="mt-2 text-sm italic text-oliva">{photoInfo}</p>
        {/if}
        {#if photoError}
          <p class="mt-2 text-sm italic text-terra bg-terra-soft/40 border border-terra/30 rounded px-3 py-2">
            {photoError}
          </p>
        {/if}
        {#if recipe.photoPath}
          <div class="relative mt-3 flex items-center gap-4 p-3 bg-sand rounded border border-umber/15"
            class:pr-12={recipe.photoCredit && recipe.photoSource}>
            <img src={recipe.photoPath} alt={recipe.title} class="w-20 h-20 object-cover rounded shadow-soft" />
            <label class="text-sm flex items-center gap-2 cursor-pointer text-umber">
              <input type="checkbox" name="remove_photo" class="w-4 h-4 accent-terra" /> Supprimer la photo actuelle
            </label>
            <PhotoCredit {recipe} />
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

    <p class="text-sm text-sepia mb-5">Les ingrédients gardent leur ordre de saisie. Utilise les flèches pour les déplacer.</p>
    <div class="space-y-4">
      {#each items as item, idx (item.key)}
        <div class="bg-linen rounded p-4 border border-umber/10 relative">
          <span class="absolute -top-3 left-4 px-2 bg-linen font-display italic text-mare text-lg leading-none">
            {romanNumerals[idx] || idx + 1}
          </span>

          <div class="flex justify-end gap-2 mb-2">
            <button type="button" class="btn-secondary btn-sm" disabled={idx === 0} aria-label={`Monter l’ingrédient ${idx + 1}`} onclick={() => moveIngredient(idx, -1)}>↑ Monter</button>
            <button type="button" class="btn-secondary btn-sm" disabled={idx === items.length - 1} aria-label={`Descendre l’ingrédient ${idx + 1}`} onclick={() => moveIngredient(idx, 1)}>↓ Descendre</button>
          </div>
          {#if item.suggestedFields?.length}<p class="text-xs text-mare mb-2">Import · champs complétés ou ajustés : {item.suggestedFields.map(f => suggestionLabels[f]).join(', ')}. À vérifier.</p>{/if}

          <div class="grid sm:grid-cols-[1fr_100px_90px] gap-2 mb-2 mt-1">
            <Combobox name="ing_name" options={catalogNames} placeholder="Nom (ex. Pomodori pelati)" required={idx === 0} bind:value={item.name} onselect={() => prefillFromCatalog(item)} />
            <input class="input font-mono text-center" name="ing_quantity" type="number" step="0.01" min="0" placeholder="Qté" bind:value={item.quantity} />
            <Combobox name="ing_unit" options={UNITS} strict placeholder="Unité" inputClass="input font-mono" bind:value={item.unit} />
          </div>
          <div class="grid sm:grid-cols-2 gap-2 mb-2">
            <input class="input" name="ing_brand" placeholder="Marque (ex. Mutti)" bind:value={item.brand} />
            <input class="input font-mono text-sm" name="ing_product_reference" placeholder="Référence produit" bind:value={item.productReference} />
            <input type="hidden" name="ing_category" value={item.category} />
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
    <button type="button" class="btn-secondary mt-4" onclick={addIngredient}>＋ Ajouter un ingrédient</button>
  </section>

  <!-- Instructions -->
  <section class="card">
    <div class="h-eyebrow mb-4">— La preparazione</div>
    <textarea
      class="input min-h-[260px] font-sans leading-relaxed"
      id="instructions"
      name="instructions"
      bind:value={fields.instructions}
      placeholder="Step 1. Faire bouillir l'eau salée…&#10;Step 2. Pendant ce temps…"
    ></textarea>
  </section>

  </fieldset>
  <div class="flex flex-wrap gap-3 justify-end">
    <a href={cancelHref} class="btn-secondary">Annuler</a>
    <button type="submit" class="btn-primary btn-lg" disabled={compressing || scanning || preparingSave}>
      {compressing ? 'Optimisation…' : preparingSave ? 'Enregistrement…' : submitLabel}
    </button>
  </div>
</form>
