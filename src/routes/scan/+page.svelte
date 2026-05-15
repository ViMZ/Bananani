<script>
  import { onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Sprig from '$lib/components/Sprig.svelte';

  let { form } = $props();

  let videoEl;
  let scanning = $state(false);
  let cameraError = $state('');
  let frames = $state(0);
  let reader = null;
  let controls = null;

  let manualCode = $state('');
  let recentScans = $state([]);
  /** @type {Set<string>} codes déjà soumis pendant la session caméra en cours */
  let sessionCodes = new Set();

  /** Feedback visuel après scan caméra réussi (le `form` prop ne se met à jour qu'au form submit, pas au fetch) */
  let scanFeedback = $state(/** @type {null | { kind: 'ok' | 'empty' | 'error', recipeTitle?: string, added?: number, code?: string, message?: string }} */ (null));
  let feedbackTimeout = null;

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
        // Les erreurs par frame sont normales (NotFoundException = pas de QR dans la frame).
        // Les vraies pannes caméra arrivent dans le try/catch externe, pas ici.
        if (result) {
          const text = result.getText();
          if (text && !sessionCodes.has(text)) {
            sessionCodes.add(text);
            submitCode(text);
          }
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

  async function submitCode(code) {
    try {
      const fd = new FormData();
      fd.append('code', code);
      const res = await fetch('?/add', { method: 'POST', body: fd });
      const parsed = deserialize(await res.text());

      if (parsed.type === 'success' && parsed.data) {
        const data = /** @type {any} */ (parsed.data);
        setFeedback({
          kind: data.empty ? 'empty' : 'ok',
          recipeTitle: data.recipeTitle,
          added: data.added,
          code: data.code ?? code
        });
        recentScans = [
          { code, time: new Date().toLocaleTimeString(), recipeTitle: data.recipeTitle },
          ...recentScans
        ].slice(0, 10);
      } else if (parsed.type === 'failure' && parsed.data) {
        const data = /** @type {any} */ (parsed.data);
        setFeedback({ kind: 'error', message: data.error ?? 'Code inconnu', code });
      } else {
        setFeedback({ kind: 'error', message: 'Réponse inattendue du serveur', code });
      }

      await invalidateAll();
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur réseau', code });
    }
  }

  onDestroy(() => {
    stopCamera();
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
  });
</script>

<header class="text-center mb-12">
  <div class="h-eyebrow mb-2">Capture</div>
  <h1 class="h-display text-5xl md:text-6xl italic">Scansiona</h1>
  <p class="text-sepia italic mt-2">
    Pointe la caméra sur une fiche, ou tape le code BAN-XXXXXX
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
        Errore : {cameraError}
      </div>
    {/if}

    <!-- Viewport avec brackets -->
    <div class="relative bg-umber rounded overflow-hidden aspect-video">
      <video bind:this={videoEl} class="w-full h-full object-cover" muted autoplay playsinline></video>

      {#if !scanning}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="font-display italic text-panna text-4xl">spento</div>
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

    <!-- Feedback du dernier scan caméra -->
    {#if scanFeedback}
      {#if scanFeedback.kind === 'ok'}
        <div class="mt-4 p-3 rounded bg-oliva-soft/50 border border-oliva/30 text-sm animate-fade-in">
          <span class="font-display italic text-oliva text-base">Bene !</span>
          <span class="text-umber">
            {scanFeedback.added} ingrédient{scanFeedback.added > 1 ? 's' : ''} de
            <span class="font-medium">« {scanFeedback.recipeTitle} »</span> ajouté{scanFeedback.added > 1 ? 's' : ''}.
          </span>
        </div>
      {:else if scanFeedback.kind === 'empty'}
        <div class="mt-4 p-3 rounded bg-limone-soft/40 border border-limone/40 text-sm italic animate-fade-in">
          « {scanFeedback.recipeTitle} » : aucune ingrédient à ajouter.
        </div>
      {:else}
        <div class="mt-4 p-3 rounded bg-terra-soft/60 border border-terra/30 text-sm italic animate-fade-in">
          Errore : {scanFeedback.message}
          {#if scanFeedback.code}<span class="font-mono not-italic"> ({scanFeedback.code})</span>{/if}
        </div>
      {/if}
    {/if}

    <p class="text-xs italic text-sepia mt-3">
      Autoriser l'accès caméra · sur mobile, HTTPS recommandé.
    </p>
  </section>

  <!-- Saisie manuelle -->
  <section class="card-sand">
    <div class="h-eyebrow mb-4">— A mano</div>

    <form
      method="POST"
      action="?/add"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success') manualCode = '';
        };
      }}
    >
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
      <button class="btn-primary w-full">Ajouter aux courses →</button>
    </form>

    {#if form?.error}
      <div class="mt-4 p-3 rounded bg-terra-soft/60 border border-terra/30 text-sm italic animate-fade-in">
        Errore : {form.error}
      </div>
    {/if}
    {#if form?.added > 0}
      <div class="mt-4 p-3 rounded bg-oliva-soft/50 border border-oliva/30 text-sm animate-fade-in">
        <span class="font-display italic text-oliva text-base">Bene !</span>
        <span class="text-umber">
          {form.added} ingrédient{form.added > 1 ? 's' : ''} de « {form.recipeTitle} » ajouté{form.added > 1 ? 's' : ''}.
        </span>
      </div>
    {/if}
    {#if form?.empty}
      <div class="mt-4 p-3 rounded bg-limone-soft/40 border border-limone/40 text-sm italic">
        « {form.recipeTitle} » sans ingrédient.
      </div>
    {/if}
  </section>
</div>

{#if recentScans.length > 0}
  <section class="mt-12">
    <div class="flex items-baseline gap-4 mb-4">
      <h2 class="h-display italic text-2xl text-sepia">Scansioni recenti</h2>
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
