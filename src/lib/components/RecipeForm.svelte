<script>
  import { normalizeName } from '$lib/ingredients/normalize';
  import { CATEGORIES } from '$lib/ingredients/categories';
  import { UNITS } from '$lib/ingredients/units';
  import Combobox from '$lib/components/Combobox.svelte';

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

  async function scan() {
    if (!scanFile || scanning) return;
    scanning = true;
    scanError = '';
    scanResult = null;
    scanInfo = '';
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
      scanResult = result;
    } catch (err) {
      scanError = err instanceof Error ? err.message : 'Le scan a échoué. Réessaie.';
    } finally { scanning = false; scanPreparing = false; }
  }

  function applyScan() {
    for (const name of ['title', 'description', 'owner', 'servings', 'instructions']) {
      formElement.elements.namedItem(name).value = scanResult.recipe[name] ?? '';
    }
    items = scanResult.ingredients.map((i) => ({ ...blank(), ...i }));
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
    return { name: '', brand: '', productReference: '', quantity: '', unit: '', notes: '', category: '' };
  }

  // À l'édition, la catégorie n'est pas stockée sur la ligne : on la retrouve via
  // le catalogue à partir du nom de l'ingrédient.
  let items = $state(
    ingredients.length > 0
      ? ingredients.map((i) => ({
          ...blank(),
          ...i,
          category: i.category || byKey.get(normalizeName(i.name))?.category || ''
        }))
      : [blank()]
  );

  function addIngredient() {
    items = [blank(), ...items];
  }

  function removeIngredient(idx) {
    items = items.filter((_, i) => i !== idx);
    if (items.length === 0) addIngredient();
  }

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  // Pré-remplit unité et catégorie depuis le catalogue sans écraser une saisie.
  function prefillFromCatalog(item) {
    const entry = byKey.get(normalizeName(item.name));
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

    compressing = true;
    try {
      const out = await maybeCompress(file);
      if (out !== file) {
        // Remplace le fichier de l'input par la version optimisée (soumise au submit).
        const dt = new DataTransfer();
        dt.items.add(out);
        input.files = dt.files;
        photoInfo = `Photo optimisée : ${(file.size / 1024 / 1024).toFixed(1)} Mo → ${(out.size / 1024 / 1024).toFixed(1)} Mo`;
      }
    } catch {
      // Compression indisponible : on garde l'original, la validation ci-dessous prend le relais.
    } finally {
      compressing = false;
    }

    const finalFile = input.files?.[0];
    if (finalFile && finalFile.size > MAX_PHOTO_BYTES) {
      photoError = `Même optimisée, cette photo fait ${(finalFile.size / 1024 / 1024).toFixed(1)} Mo (maximum ${MAX_PHOTO_MB} Mo). Choisis une image plus légère — ta saisie est conservée.`;
    }
  }

  function onSubmit(e) {
    if (compressing || photoError) {
      e.preventDefault();
      if (photoError) {
        document.getElementById('photo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
</script>

{#if allowScan}
  <section class="card mb-8 space-y-4">
    <h2 class="h-eyebrow">Scanner une recette papier</h2>
    <p class="text-sm text-sepia">Photographie une recette ou importe une image. Elle sera envoyée à Mistral pour extraire le texte, puis tu pourras le relire avant d’enregistrer.</p>
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
    <button type="button" class="btn-primary" disabled={!scanFile || scanning} onclick={scan}>{scanPreparing ? 'Optimisation de la photo…' : scanning ? 'Lecture de la recette…' : 'Analyser la recette'}</button>
    <div aria-live="polite">
      {#if scanning}<p class="text-sm text-sepia">L’analyse peut prendre quelques dizaines de secondes.</p>{/if}
      {#if scanInfo}<p class="text-sm text-mare">{scanInfo}</p>{/if}
      {#if scanError}<p role="alert" class="text-terra mt-3">{scanError}</p>{/if}
      {#if scanApplied}<p class="text-sm text-mare mt-3">Recette préremplie. Vérifie les quantités, les unités et les portions, puis clique sur « Créer la recette ».</p>{/if}
    </div>
    {#if scanResult}
      <div class="bg-linen rounded p-4 space-y-3">
        <h3 class="font-display text-2xl italic">{scanResult.recipe.title || 'Titre à compléter'}</h3>
        <p class="text-sm">{scanResult.ingredients.length} ingrédients · Portions : {scanResult.recipe.servings || 'à compléter'}</p>
        <ul class="text-sm space-y-1">
          {#each scanResult.ingredients as ingredient}<li>{ingredient.quantity} {ingredient.unit} {ingredient.name}{ingredient.notes ? ` — ${ingredient.notes}` : ''}</li>{/each}
        </ul>
        <details><summary class="cursor-pointer text-sm">Voir les étapes</summary><p class="whitespace-pre-wrap text-sm mt-2">{scanResult.recipe.instructions || 'Étapes à compléter'}</p></details>
        <p class="text-sm text-sepia">Les champs du formulaire ci-dessous seront remplacés. La photo du plat sera conservée.</p>
        <button type="button" class="btn-primary" onclick={applyScan}>Utiliser cette recette</button>
        <button type="button" class="btn-secondary" onclick={() => scanResult = null}>Ignorer</button>
      </div>
    {/if}
  </section>
{/if}

<form bind:this={formElement} method="POST" enctype="multipart/form-data" class="space-y-10" onsubmit={onSubmit}>
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
          <input class="input font-display text-center text-xl" id="servings" name="servings" type="number" min="1" max="50" required={scanApplied} value={recipe.servings ?? 2} />
        </div>
      </div>

      <div>
        <label class="label" for="owner">Recette de</label>
        <input class="input italic" id="owner" name="owner" value={recipe.owner ?? ''} placeholder="ex. Mamie, Vincent…" />
      </div>

      <div>
        <label class="label" for="photo">Photo du plat</label>
        <input class="input file:mr-3 file:border-0 file:bg-mare file:text-panna file:px-3 file:py-1.5 file:rounded file:font-sans file:text-xs file:font-medium file:cursor-pointer file:hover:bg-mare-deep" id="photo" name="photo" type="file" accept="image/*" onchange={onPhotoChange} />
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
            <Combobox name="ing_name" options={catalogNames} placeholder="Nom (ex. Pomodori pelati)" required={idx === 0} bind:value={item.name} onselect={() => prefillFromCatalog(item)} />
            <input class="input font-mono text-center" name="ing_quantity" type="number" step="0.01" min="0" placeholder="Qté" bind:value={item.quantity} />
            <Combobox name="ing_unit" options={UNITS} strict placeholder="Unité" inputClass="input font-mono" bind:value={item.unit} />
          </div>
          <div class="grid sm:grid-cols-3 gap-2 mb-2">
            <input class="input" name="ing_brand" placeholder="Marque (ex. Mutti)" bind:value={item.brand} />
            <input class="input font-mono text-sm" name="ing_product_reference" placeholder="Référence produit" bind:value={item.productReference} />
            <Combobox name="ing_category" options={CATEGORIES} strict placeholder="Rayon (ex. Épicerie salée)" bind:value={item.category} />
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
    <button type="submit" class="btn-primary btn-lg" disabled={compressing}>
      {compressing ? 'Optimisation…' : submitLabel}
    </button>
  </div>
</form>
