<script>
  import { onDestroy, onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { form } = $props();

  let videoEl;
  let scanning = $state(false);
  let cameraError = $state('');
  let lastResult = $state('');
  /** @type {import('@zxing/browser').BrowserMultiFormatReader | null} */
  let reader = null;
  let controls = null;

  let manualCode = $state('');
  let recentScans = $state([]);

  async function startCamera() {
    cameraError = '';
    scanning = true;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result) => {
        if (result) {
          const text = result.getText();
          if (text && text !== lastResult) {
            lastResult = text;
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
  }

  async function submitCode(code) {
    const fd = new FormData();
    fd.append('code', code);
    const res = await fetch('?/add', { method: 'POST', body: fd });
    const result = await res.json();
    const payload = result?.data ? JSON.parse(result.data) : null;
    // SvelteKit serializes action results — easier to just refresh
    await invalidateAll();
    recentScans = [{ code, time: new Date().toLocaleTimeString() }, ...recentScans].slice(0, 10);
    // Allow re-scanning the same code after a small delay
    setTimeout(() => (lastResult = ''), 1500);
  }

  onDestroy(stopCamera);
</script>

<h1 class="text-2xl font-display font-bold mb-4">Scanner une fiche</h1>

<div class="grid md:grid-cols-2 gap-6">
  <section class="card">
    <h2 class="font-display font-bold mb-3">📷 Caméra</h2>

    {#if cameraError}
      <div class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-3 text-sm">
        ⚠️ {cameraError}
      </div>
    {/if}

    <div class="relative bg-stone-900 rounded-lg overflow-hidden aspect-video mb-3">
      <video bind:this={videoEl} class="w-full h-full object-cover" muted autoplay playsinline></video>
      {#if !scanning}
        <div class="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
          Caméra inactive
        </div>
      {/if}
    </div>

    <div class="flex gap-2">
      {#if !scanning}
        <button class="btn-primary flex-1" onclick={startCamera}>Démarrer la caméra</button>
      {:else}
        <button class="btn-secondary flex-1" onclick={stopCamera}>Arrêter</button>
      {/if}
    </div>
    <p class="text-xs text-stone-500 mt-2">
      Astuce : sur ordinateur le navigateur demandera l'autorisation caméra. Sur téléphone, ça marche
      mieux en HTTPS.
    </p>
  </section>

  <section class="card">
    <h2 class="font-display font-bold mb-3">⌨️ Saisie manuelle</h2>
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
      <input
        class="input mb-3 font-mono uppercase"
        name="code"
        placeholder="BAN-XXXXXX"
        bind:value={manualCode}
        required
      />
      <button class="btn-primary w-full">Ajouter aux courses</button>
    </form>

    {#if form?.error}
      <div class="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
        ⚠️ {form.error}
      </div>
    {/if}
    {#if form?.added > 0}
      <div class="mt-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-2">
        ✅ {form.added} ingrédient{form.added > 1 ? 's' : ''} de « {form.recipeTitle} » ajouté{form.added > 1 ? 's' : ''}.
      </div>
    {/if}
    {#if form?.empty}
      <div class="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
        ℹ️ Recette « {form.recipeTitle} » sans ingrédient.
      </div>
    {/if}
  </section>
</div>

{#if recentScans.length > 0}
  <section class="card mt-6">
    <h2 class="font-display font-bold mb-2">Scans récents</h2>
    <ul class="text-sm space-y-1 font-mono">
      {#each recentScans as s}
        <li>{s.time} — {s.code}</li>
      {/each}
    </ul>
  </section>
{/if}

<div class="mt-6">
  <a href="/shopping" class="btn-secondary">Voir la liste de courses →</a>
</div>
