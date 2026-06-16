<script>
  import { onDestroy } from 'svelte';
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Sprig from '$lib/components/Sprig.svelte';

  let videoEl;
  let scanning = $state(false);
  let cameraError = $state('');
  let frames = $state(0);
  let reader = null;
  let controls = null;

  let manualCode = $state('');
  let recentScans = $state([]);
  /** @type {Set<string>} codes déjà scannés par la caméra pendant la session en cours */
  let sessionCodes = new Set();

  /** Recette en attente de confirmation (card affichée). @type {null | { recipe: any, ingredients: any[] }} */
  let pendingRecipe = $state(null);
  /** Opération réseau en cours (lookup ou add) — sert aussi de garde. */
  let busy = $state(false);

  /** Feedback visuel du dernier scan / de la dernière action. */
  let scanFeedback = $state(/** @type {null | { kind: 'ok' | 'empty' | 'error' | 'already', recipeTitle?: string, added?: number, code?: string, message?: string }} */ (null));
  let feedbackTimeout = null;

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  const roman = (n) => romanNumerals[n - 1] || String(n);

  async function startCamera() {
    cameraError = '';
    scanFeedback = null;
    scanning = true;
    frames = 0;
    sessionCodes = new Set();
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      reader = new BrowserMultiFormatReader(hints);

      const constraints = {
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      };

      controls = await reader.decodeFromConstraints(constraints, videoEl, (result /*, err */) => {
        frames++;
        if (result) {
          const text = result.getText();
          if (text) handleCode(text, { dedup: true });
        }
      });
    } catch (err) {
      cameraError = err instanceof Error ? err.message : 'Erreur caméra';
      scanning = false;
    }
  }

  function stopCamera() {
    if (controls) {
      controls.stop();
      controls = null;
    }
    scanning = false;
    sessionCodes = new Set();
  }

  function setFeedback(value) {
    scanFeedback = value;
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    if (value) {
      feedbackTimeout = setTimeout(() => (scanFeedback = null), 4000);
    }
  }

  function pushRecent(code, recipeTitle) {
    recentScans = [
      { code, time: new Date().toLocaleTimeString(), recipeTitle },
      ...recentScans
    ].slice(0, 10);
  }

  /**
   * Prévisualise une recette à partir d'un code (lecture seule).
   * @param {string} code
   * @param {{ dedup?: boolean }} [opts] dedup=true pour les scans caméra (anti-doublon de frames).
   */
  async function handleCode(code, { dedup = false } = {}) {
    if (pendingRecipe || busy) return; // une seule card / opération à la fois
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (dedup) {
      if (sessionCodes.has(c)) return;
      sessionCodes.add(c);
    }

    busy = true;
    try {
      const fd = new FormData();
      fd.append('code', c);
      const res = await fetch('?/lookup', { method: 'POST', body: fd });
      const parsed = deserialize(await res.text());

      if (parsed.type === 'success' && parsed.data) {
        const data = /** @type {any} */ (parsed.data);
        if (data.alreadyInList) {
          setFeedback({ kind: 'already', recipeTitle: data.recipeTitle, code: data.code });
          pushRecent(c, data.recipeTitle);
          manualCode = '';
        } else if (data.empty) {
          setFeedback({ kind: 'empty', recipeTitle: data.recipeTitle, code: data.code });
          pushRecent(c, data.recipeTitle);
          manualCode = '';
        } else {
          pendingRecipe = { recipe: data.recipe, ingredients: data.ingredients };
          scanFeedback = null;
          manualCode = '';
        }
      } else if (parsed.type === 'failure' && parsed.data) {
        setFeedback({ kind: 'error', message: /** @type {any} */ (parsed.data).error ?? 'Code inconnu', code: c });
      } else {
        setFeedback({ kind: 'error', message: 'Réponse inattendue du serveur', code: c });
      }
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur réseau', code: c });
    } finally {
      busy = false;
    }
  }

  /** Confirme l'ajout de la recette en attente à la liste de courses. */
  async function confirmAdd() {
    if (!pendingRecipe || busy) return;
    const code = pendingRecipe.recipe.code;
    const title = pendingRecipe.recipe.title;
    busy = true;
    try {
      const fd = new FormData();
      fd.append('code', code);
      const res = await fetch('?/add', { method: 'POST', body: fd });
      const parsed = deserialize(await res.text());

      if (parsed.type === 'success' && parsed.data) {
        const data = /** @type {any} */ (parsed.data);
        if (data.alreadyInList) {
          setFeedback({ kind: 'already', recipeTitle: data.recipeTitle ?? title, code });
        } else if (data.empty) {
          setFeedback({ kind: 'empty', recipeTitle: data.recipeTitle ?? title, code });
        } else {
          setFeedback({ kind: 'ok', recipeTitle: data.recipeTitle ?? title, added: data.added, code });
        }
        pushRecent(code, data.recipeTitle ?? title);
      } else if (parsed.type === 'failure' && parsed.data) {
        setFeedback({ kind: 'error', message: /** @type {any} */ (parsed.data).error ?? 'Erreur', code });
      }

      pendingRecipe = null;
      await invalidateAll();
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur réseau', code });
    } finally {
      busy = false;
    }
  }

  function cancelCard() {
    pendingRecipe = null;
  }

  function submitManual(e) {
    e.preventDefault();
    handleCode(manualCode);
  }

  onDestroy(() => {
    stopCamera();
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
  });
</script>

<header class="text-center mb-12">
  <div class="h-eyebrow mb-2">Capture</div>
  <h1 class="h-display text-5xl md:text-6xl italic">Scanner</h1>
  <p class="text-sepia italic mt-2">
    Pour voir la recette et ajouter les ingrédients à la liste de courses.
  </p>
  <div class="flex justify-center mt-4">
    <Sprig width={120} />
  </div>
</header>

<div class="grid lg:grid-cols-[3fr_2fr] gap-8">
  <!-- Viewport caméra -->
  <section class="card">
    <div class="flex items-center justify-between mb-4">
      <div class="h-eyebrow">— La macchina fotografica</div>
      <span class="font-mono text-[10px] uppercase tracking-wider text-sepia flex items-center gap-1.5">
        <span class="inline-block w-1.5 h-1.5 rounded-full {scanning ? 'bg-oliva' : 'bg-umber/20'}"></span>
        {scanning ? `live · ${frames} frames` : 'inactive'}
      </span>
    </div>

    {#if cameraError}
      <div class="bg-terra-soft/50 border border-terra/30 rounded p-3 mb-4 text-sm italic text-umber">
        Erreur : {cameraError}
      </div>
    {/if}

    <!-- Viewport avec brackets -->
    <div class="relative bg-umber rounded overflow-hidden aspect-video">
      <video bind:this={videoEl} class="w-full h-full object-cover" muted autoplay playsinline></video>

      {#if !scanning}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="font-display italic text-panna text-4xl">éteint</div>
            <div class="h-eyebrow text-panna/60 mt-1">caméra inactive</div>
          </div>
        </div>
      {/if}

      <!-- Brackets coins (limone) -->
      <svg class="absolute top-3 left-3 w-7 h-7 pointer-events-none" viewBox="0 0 32 32" fill="none" stroke="#E5B947" stroke-width="2" stroke-linecap="round">
        <path d="M2 12 L2 2 L12 2" />
      </svg>
      <svg class="absolute top-3 right-3 w-7 h-7 pointer-events-none" viewBox="0 0 32 32" fill="none" stroke="#E5B947" stroke-width="2" stroke-linecap="round">
        <path d="M20 2 L30 2 L30 12" />
      </svg>
      <svg class="absolute bottom-3 left-3 w-7 h-7 pointer-events-none" viewBox="0 0 32 32" fill="none" stroke="#E5B947" stroke-width="2" stroke-linecap="round">
        <path d="M2 20 L2 30 L12 30" />
      </svg>
      <svg class="absolute bottom-3 right-3 w-7 h-7 pointer-events-none" viewBox="0 0 32 32" fill="none" stroke="#E5B947" stroke-width="2" stroke-linecap="round">
        <path d="M30 20 L30 30 L20 30" />
      </svg>

      {#if scanning}
        <div class="absolute inset-x-6 top-0 h-[2px] bg-limone shadow-[0_0_8px_#E5B947] animate-scanline pointer-events-none"></div>
      {/if}
    </div>

    <div class="flex gap-2 mt-4">
      {#if !scanning}
        <button class="btn-primary flex-1" onclick={startCamera}>▶ Démarrer la caméra</button>
      {:else}
        <button class="btn-secondary flex-1" onclick={stopCamera}>■ Arrêter</button>
      {/if}
    </div>

    <p class="text-xs italic text-sepia mt-3">
      Autoriser l'accès caméra · sur mobile, HTTPS recommandé.
    </p>
  </section>

  <!-- Saisie manuelle -->
  <section class="card-sand">
    <div class="h-eyebrow mb-4">— À la main</div>

    <form onsubmit={submitManual}>
      <label class="label" for="code-input">Code de la fiche</label>
      <input
        id="code-input"
        class="input mb-4 font-mono uppercase text-lg tracking-widest text-center"
        name="code"
        placeholder="BAN-______"
        bind:value={manualCode}
        required
        autocomplete="off"
      />
      <button class="btn-primary w-full" disabled={busy}>Voir la recette →</button>
    </form>
  </section>
</div>

<!-- Feedback partagé (caméra + saisie manuelle) -->
{#if scanFeedback}
  {#if scanFeedback.kind === 'ok'}
    <div class="mt-6 p-3 rounded bg-oliva-soft/50 border border-oliva/30 text-sm animate-fade-in">
      <span class="font-display italic text-oliva text-base">Bene !</span>
      <span class="text-umber">
        {scanFeedback.added} ingrédient{scanFeedback.added > 1 ? 's' : ''} de
        <span class="font-medium">« {scanFeedback.recipeTitle} »</span> ajouté{scanFeedback.added > 1 ? 's' : ''}.
      </span>
    </div>
  {:else if scanFeedback.kind === 'already'}
    <div class="mt-6 p-3 rounded bg-limone-soft/40 border border-limone/40 text-sm italic animate-fade-in">
      « {scanFeedback.recipeTitle} » est déjà dans la liste de courses.
    </div>
  {:else if scanFeedback.kind === 'empty'}
    <div class="mt-6 p-3 rounded bg-limone-soft/40 border border-limone/40 text-sm italic animate-fade-in">
      « {scanFeedback.recipeTitle} » : aucun ingrédient à ajouter.
    </div>
  {:else}
    <div class="mt-6 p-3 rounded bg-terra-soft/60 border border-terra/30 text-sm italic animate-fade-in">
      Erreur : {scanFeedback.message}
      {#if scanFeedback.code}<span class="font-mono not-italic"> ({scanFeedback.code})</span>{/if}
    </div>
  {/if}
{/if}

{#if recentScans.length > 0}
  <section class="mt-12">
    <div class="flex items-baseline gap-4 mb-4">
      <h2 class="h-display italic text-2xl text-sepia">Scans récents</h2>
      <span class="flex-1 h-px bg-umber/15"></span>
      <span class="h-eyebrow">{recentScans.length}</span>
    </div>
    <ul class="space-y-1 text-xs">
      {#each recentScans as s}
        <li class="flex items-center gap-4 py-2 border-b border-umber/10">
          <span class="font-mono text-sepia w-20">{s.time}</span>
          <span class="text-mare font-mono">→</span>
          <span class="font-mono font-medium text-umber w-28">{s.code}</span>
          {#if s.recipeTitle}
            <span class="font-sans italic text-sepia">{s.recipeTitle}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<div class="mt-12 text-center no-print">
  <a href="/shopping" class="link">Voir la liste de courses →</a>
</div>

<!-- Card de prévisualisation de la recette scannée -->
{#if pendingRecipe}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-umber/40 backdrop-blur-sm animate-fade-in"
    role="dialog"
    aria-modal="true"
  >
    <div class="card max-w-lg w-full max-h-[90vh] overflow-auto">
      <div class="flex gap-4 items-start mb-5">
        {#if pendingRecipe.recipe.photoPath}
          <img
            src={pendingRecipe.recipe.photoPath}
            alt={pendingRecipe.recipe.title}
            class="w-24 h-24 object-cover rounded border border-umber/15 shrink-0"
          />
        {:else}
          <div class="w-24 h-24 rounded bg-sand flex items-center justify-center shrink-0">
            <span class="font-display italic text-3xl text-sepia">N°</span>
          </div>
        {/if}
        <div class="min-w-0">
          <h2 class="h-display text-3xl italic leading-tight text-balance">{pendingRecipe.recipe.title}</h2>
          {#if pendingRecipe.recipe.owner}
            <p class="font-display italic text-mare text-sm mt-1">de {pendingRecipe.recipe.owner}</p>
          {/if}
          <p class="h-eyebrow mt-2">
            {pendingRecipe.recipe.servings} pers · {pendingRecipe.ingredients.length} ingrédient{pendingRecipe.ingredients.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <ul class="space-y-2 mb-6 max-h-[40vh] overflow-auto pr-1">
        {#each pendingRecipe.ingredients as i, idx}
          <li class="grid grid-cols-[28px_1fr_auto] gap-3 items-baseline pb-2 border-b border-umber/10 last:border-0">
            <span class="font-display italic text-mare">{roman(idx + 1)}</span>
            <div class="min-w-0">
              <span class="font-sans text-sm font-medium">{i.name}</span>
              {#if i.brand || i.productReference}
                <div class="font-mono text-[10px] uppercase tracking-wider text-sepia">
                  {[i.brand, i.productReference].filter(Boolean).join(' · ')}
                </div>
              {/if}
            </div>
            {#if i.quantity}
              <span class="font-display text-umber whitespace-nowrap">
                {i.quantity}<span class="text-sepia text-xs font-sans">{i.unit}</span>
              </span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="flex gap-2">
        <button class="btn-primary flex-1" onclick={confirmAdd} disabled={busy}>
          ＋ Ajouter à la liste de courses
        </button>
        <button class="btn-secondary" onclick={cancelCard} disabled={busy}>Annuler</button>
      </div>
    </div>
  </div>
{/if}
