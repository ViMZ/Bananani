<script>
  import { tick, onDestroy } from 'svelte';
  import { normalizeName } from '$lib/ingredients/normalize';
  import { cleanCategory, categoryOptions } from '$lib/ingredients/categories';
  import { UNITS, formatUnit } from '$lib/ingredients/units';
  import Combobox from '$lib/components/Combobox.svelte';
  import PhotoCredit from '$lib/components/PhotoCredit.svelte';

  let {
    recipe = { title: '', description: '', owner: '', servings: 2, instructions: '', photoPath: null },
    ingredients = [],
    catalog = [],
    allowScan = false,
    submitLabel = 'Enregistrer',
    cancelHref = '/recipes'
  } = $props();

  let formElement;
  let scanning = $state(false);
  let scanError = $state('');
  let scanResult = $state(null);
  let scanApplied = $state(false);
  let scanFile = $state(null);
  let scanPreparing = $state(false);
  let scanInfo = $state('');
  let scanWarnings = $state([]);
  let scanUseOriginal = $state(false);
  let scanSuggestedFields = $state([]);
  let scanPreview = $derived(scanUseOriginal && scanResult?.original ? scanResult.original : scanResult);
  const suggestionLabels = { title: 'titre', description: 'description', owner: 'auteur', servings: 'personnes', instructions: 'étapes',
    name: 'nom', quantity: 'quantité', unit: 'unité', notes: 'notes', brand: 'marque', productReference: 'référence', category: 'rayon' };
  let reviewingCategories = $state(false);
  let suggestingCategories = $state(false);
  let categoryError = $state('');
  let categorySection = $state();

  async function reviewCategories() {
    reviewingCategories = true;
    suggestingCategories = true;
    categoryError = '';
    await tick();
    categorySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      for (const item of items) prefillFromCatalog(item);
      const missing = items.filter(i => i.name.trim() && !i.category);
      if (!missing.length) return;
      const response = await fetch('/recipes/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: missing.map(i => i.name.trim()) }),
        signal: AbortSignal.timeout(25000)
      });
      if (response.redirected) throw new Error('Ta session a expiré. Reconnecte-toi pour obtenir des suggestions.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Suggestions indisponibles. Choisis les rayons manuellement.');
      const suggestions = new Map((result.suggestions || []).map(i => [i.key, i.category]));
      for (const item of missing) {
        const category = suggestions.get(normalizeName(item.name));
        if (!item.category && cleanCategory(category)) item.category = cleanCategory(category);
      }
      categoryError = result.warning || '';
    } catch (err) {
      categoryError = err?.name === 'TimeoutError' ? 'Les suggestions prennent trop de temps. Choisis les rayons manuellement.'
        : err instanceof Error ? err.message : 'Choisis les rayons manuellement.';
    } finally { suggestingCategories = false; }
  }

  function chooseCategory(item, category) {
    const clean = cleanCategory(category);
    for (const other of items) {
      if (normalizeName(other.name) === normalizeName(item.name)) other.category = clean;
    }
  }

  async function scan() {
    if (!scanFile || scanning) return;
    scanning = true;
    scanError = '';
    scanResult = null;
    scanInfo = '';
    scanUseOriginal = false;
    try {
      scanPreparing = true;
      // Plus de résolution que pour une photo de plat : préserver les petits caractères.
      const image = await maybeCompress(scanFile, 3000, 0.9);
      scanPreparing = false;
      if (image.size > 10 * 1024 * 1024) throw new Error('Cette photo reste trop volumineuse après optimisation. Essaie une photo plus rapprochée de la recette ou une image JPEG.');
      if (image !== scanFile) scanInfo = `Photo optimisée : ${(scanFile.size / 1024 / 1024).toFixed(1)} Mo → ${(image.size / 1024 / 1024).toFixed(1)} Mo`;
      const body = new FormData();
      body.append('image', image);
      const response = await fetch('/recipes/ocr', { method: 'POST', body });
      if (response.redirected) throw new Error('Ta session a expiré. Reconnecte-toi pour scanner.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Le scan a échoué.');
      // Les rayons déjà choisis dans le catalogue priment sur une nouvelle suggestion.
      for (const ingredient of result.ingredients || []) {
        const known = byKey.get(normalizeName(ingredient.name));
        if (known?.category) ingredient.category = known.category;
      }
      scanResult = result;
    } catch (err) {
      scanError = err instanceof Error ? err.message : 'Le scan a échoué. Réessaie.';
    } finally { scanning = false; scanPreparing = false; }
  }

  function applyScan() {
    for (const name of ['title', 'description', 'owner', 'servings', 'instructions']) {
      formElement.elements.namedItem(name).value = scanPreview.recipe[name] ?? '';
    }
    items = scanPreview.ingredients.map((i) => ({ ...blank(), ...i }));
    scanWarnings = scanPreview.warnings || [];
    scanSuggestedFields = scanUseOriginal ? [] : scanResult.review?.suggestedFields || [];
    scanResult = null;
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
  let availableCategories = $derived(categoryOptions([...catalog.map(i => i.category), ...items.map(i => i.category)]));

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

  // Pré-remplit unité et catégorie depuis le catalogue sans écraser une saisie.
  function prefillFromCatalog(item) {
    const key = normalizeName(item.name);
    if (item.categoryName && item.categoryName !== key) item.category = '';
    item.categoryName = key;
    const entry = byKey.get(key);
    if (!entry) return;
    if (!item.unit && entry.unit) item.unit = entry.unit;
    if (!item.category && entry.category) item.category = entry.category;
  }

  // --- Photo : compression/redimensionnement automatique côté client ---
  // On redimensionne au choix du fichier (canvas → JPEG) pour éviter les uploads
  // lourds : plus besoin de réduire l'image soi-même, et on ne dépasse plus la
  // limite serveur (BODY_SIZE_LIMIT). Une validation de taille reste en filet de
  // sécurité — un POST trop lourd renverrait une 500 qui efface toute la saisie.
  const MAX_PHOTO_MB = 15; // garde-fou sur l'original (aligné, avec marge, sur les 16 Mo serveur)
  const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
  const MAX_DIM = 1600; // plus grand côté après redimensionnement
  const JPEG_QUALITY = 0.82;
  const COMPRESS_IF_OVER_BYTES = 1024 * 1024; // ne recompresse pas les images déjà légères
  const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

  let photoError = $state('');
  let photoInfo = $state('');
  let compressing = $state(false);
  let photoInput;
  let photoPreview = $state('');
  let selectedImage = $state(null);
  let imageSearchOpen = $state(false);
  let imageQuery = $state('');
  let imageResults = $state(null);
  let imageSearching = $state(false);
  let imageSearchError = $state('');

  function clearPreview() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = '';
  }
  onDestroy(clearPreview);

  async function searchImages() {
    if (imageSearching) return;
    imageSearching = true;
    imageSearchError = '';
    imageResults = null;
    try {
      const response = await fetch(`/recipes/images?q=${encodeURIComponent(imageQuery)}`);
      if (response.redirected) throw new Error('Ta session a expiré. Reconnecte-toi.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Recherche indisponible.');
      imageResults = result.images;
    } catch (err) { imageSearchError = err instanceof Error ? err.message : 'Recherche indisponible.'; }
    finally { imageSearching = false; }
  }

  function chooseImage(image) {
    clearPreview();
    photoInput.value = '';
    selectedImage = image;
    photoError = '';
    photoInfo = '';
    imageSearchOpen = false;
  }

  /**
   * Renvoie une version optimisée (JPEG redimensionné) si utile, sinon le fichier tel quel.
   * @param {File} file
   */
  async function maybeCompress(file, maxDimension = MAX_DIM, quality = JPEG_QUALITY) {
    if (!COMPRESSIBLE.has(file.type)) return file; // gif animé, etc. → inchangé
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        // Repli pour les navigateurs mobiles sans createImageBitmap fonctionnel.
        const objectUrl = URL.createObjectURL(file);
        try {
          bitmap = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = objectUrl;
          });
        } catch {
          return file;
        } finally { URL.revokeObjectURL(objectUrl); }
      }
    }
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    if (scale === 1 && file.size <= COMPRESS_IF_OVER_BYTES) {
      bitmap.close?.();
      return file; // déjà petite et légère : inutile de recompresser (évite une perte de qualité)
    }
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fond blanc au cas où l'original a de la transparence
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // pas plus léger → garder l'original
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
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

  function onSubmit(e) {
    if (compressing || photoError || scanning || suggestingCategories) {
      e.preventDefault();
      if (photoError) {
        document.getElementById('photo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (!reviewingCategories) {
      e.preventDefault();
      reviewCategories();
    }
  }
</script>

{#if allowScan && !reviewingCategories}
  <section id="import-scan" class="card mb-8 space-y-4">
    <h2 class="h-eyebrow">Scanner une recette papier</h2>
    <p class="text-sm text-sepia">Photographie une fiche personnelle, une page de livre ou une recette manuscrite, ou importe une image. Aucun code Bananani n’est nécessaire. Un titre et une liste d’ingrédients suffisent, même sans quantités ni étapes.</p>
    <p class="text-sm text-sepia">L’image sera envoyée à Mistral pour lire le texte, puis un modèle vérifiera la cohérence et proposera les informations manquantes : portions, quantités, étapes et rayons. Tu pourras comparer avec la lecture OCR et tout corriger avant d’enregistrer.</p>
    <p class="text-xs text-sepia">Cadre la fiche de près, à plat, sans reflet et avec le texte net. Les estimations et ajustements seront signalés pour être vérifiés.</p>
    <div class="flex flex-wrap gap-3">
      <label class="btn-secondary cursor-pointer">
        Prendre une photo
        <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={scanning} onchange={(e) => { scanFile = e.currentTarget.files?.[0] ?? null; scanResult = null; scanError = ''; }} />
      </label>
      <label class="btn-secondary cursor-pointer">
        Choisir une image
        <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={scanning} onchange={(e) => { scanFile = e.currentTarget.files?.[0] ?? null; scanResult = null; scanError = ''; }} />
      </label>
    </div>
    <p class="text-xs text-sepia">Une page · JPEG, PNG ou WebP · photos automatiquement optimisées · photo nette et bien éclairée</p>
    {#if scanFile}<p class="text-sm break-all">{scanFile.name}</p>{/if}
    <button type="button" class="btn-primary" disabled={!scanFile || scanning} onclick={scan}>{scanPreparing ? 'Optimisation de la photo…' : scanning ? 'Lecture et vérification de la recette…' : 'Analyser la recette'}</button>
    <div aria-live="polite">
      {#if scanning}<p class="text-sm text-sepia">Lecture OCR, puis vérification et suggestions culinaires. L’analyse peut prendre jusqu’à deux minutes.</p>{/if}
      {#if scanInfo}<p class="text-sm text-mare">{scanInfo}</p>{/if}
      {#if scanError}<p role="alert" class="text-terra mt-3">{scanError}</p>{/if}
      {#if scanApplied}<p class="text-sm text-mare mt-3">Recette préremplie. Vérifie les quantités, les unités et les portions, puis clique sur « Créer la recette ».</p>{/if}
      {#if scanApplied}{#each scanWarnings as warning}<p class="text-sm text-sepia mt-2">{warning}</p>{/each}{/if}
      {#if scanApplied && scanSuggestedFields.length}<p class="text-sm text-sepia mt-2">Champs complétés ou ajustés à relire : {scanSuggestedFields.map(f => suggestionLabels[f]).join(', ')}.</p>{/if}
    </div>
    {#if scanResult}
      <div class="bg-linen rounded p-4 space-y-3">
        {#if scanResult.review?.status === 'complete'}
          <p class="text-sm font-medium text-mare">Recette relue · suggestions à vérifier</p>
          <p class="text-sm text-sepia">Les champs marqués ont été complétés ou ajustés. Les quantités, portions et étapes proposées peuvent être des estimations.</p>
          {#if scanResult.original}
            <label class="flex gap-2 items-start text-sm"><input type="checkbox" bind:checked={scanUseOriginal} class="mt-1 accent-mare" /> Utiliser seulement la lecture OCR, sans les ajustements ni les suggestions</label>
          {/if}
        {:else if scanResult.review?.status === 'unavailable'}
          <p class="text-sm font-medium text-terra">Lecture OCR seulement · suggestions indisponibles</p>
        {/if}
        <h3 class="font-display text-2xl italic">{scanPreview.recipe.title || 'Titre à compléter'}</h3>
        {#if scanPreview.recipe.description}<p class="text-sm text-sepia">{scanPreview.recipe.description}</p>{/if}
        <p class="text-sm">{scanPreview.ingredients.length} ingrédients · Personnes : {scanPreview.recipe.servings || 'à compléter'}</p>
        {#if !scanUseOriginal && scanResult.review?.suggestedFields.length}<p class="text-xs text-mare">Complété ou ajusté : {scanResult.review.suggestedFields.map(f => suggestionLabels[f]).join(', ')}.</p>{/if}
        <ul class="text-sm space-y-1">
          {#each scanPreview.ingredients as ingredient}
            <li class="py-1">
              {ingredient.quantity} {formatUnit(ingredient.unit, ingredient.quantity)} {ingredient.name}{ingredient.notes ? ` — ${ingredient.notes}` : ''}
              {#if ingredient.brand || ingredient.productReference}<span class="block text-xs text-sepia">{[ingredient.brand, ingredient.productReference].filter(Boolean).join(' · ')}</span>{/if}
              {#if ingredient.category}<span class="block text-xs text-sepia">Rayon : {ingredient.category}</span>{/if}
              {#if ingredient.suggestedFields?.length}<span class="block text-xs text-mare">À vérifier : {ingredient.suggestedFields.map(f => suggestionLabels[f]).join(', ')}.</span>{/if}
            </li>
          {/each}
        </ul>
        <details><summary class="cursor-pointer text-sm">Voir les étapes{!scanUseOriginal && scanResult.review?.suggestedFields.includes('instructions') ? ' proposées ou ajustées' : ''}</summary><p class="whitespace-pre-wrap text-sm mt-2">{scanPreview.recipe.instructions || 'Étapes à compléter'}</p></details>
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
        <p class="text-sm text-sepia">Les champs du formulaire ci-dessous seront remplacés. La photo du plat sera conservée.</p>
        {#each scanPreview.warnings || [] as warning}<p class="text-sm text-sepia">{warning}</p>{/each}
        <button type="button" class="btn-primary" onclick={applyScan}>{!scanUseOriginal && scanResult.review?.status === 'complete' ? 'Préremplir avec ces suggestions' : 'Utiliser la lecture OCR'}</button>
        <button type="button" class="btn-secondary" onclick={() => scanResult = null}>Ignorer</button>
      </div>
    {/if}
  </section>
{/if}

<form bind:this={formElement} method="POST" enctype="multipart/form-data" class="space-y-10" onsubmit={onSubmit}>
  <div class="space-y-10" hidden={reviewingCategories}>
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
          <label class="label" for="servings">Personnes de référence</label>
          <input class="input font-display text-center text-xl" id="servings" name="servings" type="number" min="1" max="50" required value={recipe.servings ?? 2} />
          <p class="text-xs text-sepia mt-1">Quantités pour ce nombre de personnes. Tu pourras l’adapter à chaque repas dans la semaine.</p>
        </div>
      </div>

      <div>
        <label class="label" for="owner">Recette de</label>
        <input class="input italic" id="owner" name="owner" value={recipe.owner ?? ''} placeholder="ex. Mamie, Vincent…" />
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
          <button type="button" class="btn-secondary" disabled={compressing} onclick={() => { imageSearchOpen = !imageSearchOpen; imageQuery ||= formElement.elements.namedItem('title').value; }}>Rechercher une image</button>
        </div>
        <input type="hidden" name="photo_commons_id" value={selectedImage?.pageId ?? ''} />
        {#if photoPreview || selectedImage}
          <div class="mt-3 space-y-2">
            <img src={photoPreview || selectedImage.url} alt="Aperçu du plat choisi" class="w-40 h-40 object-cover rounded" />
            {#if selectedImage}<p class="text-xs text-sepia">{selectedImage.author} · {selectedImage.license} · <a class="underline" href={selectedImage.source} target="_blank" rel="noreferrer">Source</a></p>{/if}
            <button type="button" class="btn-ghost btn-sm" onclick={() => { clearPreview(); selectedImage = null; photoInput.value = ''; photoInfo = ''; photoError = ''; }}>Annuler ce choix</button>
          </div>
        {/if}
        {#if imageSearchOpen}
          <div class="mt-4 p-4 bg-linen rounded space-y-3">
            <p class="text-sm text-sepia">Images réutilisables de Wikimedia Commons. L’auteur, la licence et le lien source seront conservés avec la recette.</p>
            <div class="flex flex-wrap gap-2">
              <input class="input flex-1 min-w-0" aria-label="Nom du plat à illustrer" bind:value={imageQuery} maxlength="100" placeholder="Lasagnes, tarte aux pommes…" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchImages(); } }} />
              <button type="button" class="btn-secondary" disabled={imageSearching || imageQuery.trim().length < 2} onclick={searchImages}>{imageSearching ? 'Recherche…' : 'Chercher'}</button>
            </div>
            <div aria-live="polite">
              {#if imageSearchError}<p role="alert" class="text-sm text-terra">{imageSearchError}</p>{/if}
              {#if imageResults?.length === 0}<p class="text-sm text-sepia">Aucune image trouvée. Essaie un nom plus simple ou en anglais, ou choisis une photo dans la galerie.</p>{/if}
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {#each imageResults || [] as image (image.pageId)}
                <div class="space-y-1 min-w-0">
                  <button type="button" class="w-full text-left" aria-label={`Choisir ${image.title}`} onclick={() => chooseImage(image)}>
                    <img src={image.url} alt={image.title} class="aspect-square object-cover w-full rounded" loading="lazy" />
                    <span class="text-xs block break-words">{image.title}</span>
                  </button>
                  <a class="text-[10px] text-sepia underline break-words" href={image.source} target="_blank" rel="noreferrer">{image.author} · {image.license}</a>
                </div>
              {/each}
            </div>
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
          <div class="mt-3 flex items-center gap-4 p-3 bg-sand rounded border border-umber/15">
            <img src={recipe.photoPath} alt={recipe.title} class="w-20 h-20 object-cover rounded shadow-soft" />
            <label class="text-sm flex items-center gap-2 cursor-pointer text-umber">
              <input type="checkbox" name="remove_photo" class="w-4 h-4 accent-terra" /> Supprimer la photo actuelle
            </label>
          </div>
          <PhotoCredit {recipe} />
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
      placeholder="Step 1. Faire bouillir l'eau salée…&#10;Step 2. Pendant ce temps…"
    >{recipe.instructions ?? ''}</textarea>
  </section>

  </div>
  {#if reviewingCategories}
    <section class="card space-y-5" bind:this={categorySection}>
      <h2 class="h-eyebrow">Vérifier les rayons</h2>
      <p class="text-sm text-sepia">Vérifie le rayon de chaque ingrédient avant d’enregistrer. Les rayons validés sont mémorisés dans le catalogue commun pour les prochaines recettes.</p>
      <p class="text-sm text-sepia">Choisis un rayon existant ou saisis un nouveau nom (80 caractères maximum).</p>
      <div aria-live="polite">
        {#if suggestingCategories}<p class="text-mare">Recherche des rayons…</p>{/if}
        {#if categoryError}<p role="alert" class="text-terra">{categoryError}</p>{/if}
      </div>
      {#each items as item, idx}
        {#if item.name.trim()}
          <div class="grid sm:grid-cols-2 gap-2 items-center">
            <label class="label" for={`category-${idx}`}>{item.name}</label>
            <Combobox id={`category-${idx}`} options={availableCategories} showAllOnFocus placeholder="Choisir ou créer un rayon" disabled={suggestingCategories} bind:value={item.category} onselect={(category) => chooseCategory(item, category)} />
          </div>
        {/if}
      {/each}
    </section>
  {/if}

  <div class="flex flex-wrap gap-3 justify-end">
    {#if reviewingCategories}<button type="button" class="btn-secondary" disabled={suggestingCategories} onclick={() => reviewingCategories = false}>Retour à la recette</button>{/if}
    <a href={cancelHref} class="btn-secondary">Annuler</a>
    <button type="submit" class="btn-primary btn-lg" disabled={compressing || scanning || suggestingCategories}>
      {compressing ? 'Optimisation…' : reviewingCategories ? submitLabel : 'Continuer : vérifier les rayons'}
    </button>
  </div>
</form>
