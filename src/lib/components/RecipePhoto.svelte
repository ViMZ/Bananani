<script>
  import { onDestroy, tick } from 'svelte';
  import { enhance } from '$app/forms';
  import PhotoCredit from './PhotoCredit.svelte';
  import RecipeImageSearch from './RecipeImageSearch.svelte';
  import { MAX_PHOTO_BYTES, MAX_PHOTO_MB, maybeCompress } from '$lib/recipes/photo';

  let { recipe } = $props();
  const photoAction = $derived(recipe.photoPath ? 'Modifier la photo' : 'Ajouter une photo');
  let dialog;
  let camera = $state();
  let gallery = $state();
  let heading;
  let view = $state('sources');
  let publicOpened = $state(false);
  let localFile = $state(null);
  let localPreview = $state('');
  let publicImage = $state(null);
  let preparing = $state(false);
  let saving = $state(false);
  let error = $state('');
  let notice = $state('');

  function clearChoice() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    localPreview = '';
    localFile = null;
    publicImage = null;
    error = '';
  }
  onDestroy(clearChoice);

  function open() {
    clearChoice();
    notice = '';
    view = 'sources';
    publicOpened = false;
    dialog.showModal();
  }

  function close() {
    if (!preparing && !saving) dialog.close();
  }

  function onClose() {
    clearChoice();
    publicOpened = false;
  }

  async function showPublic() {
    error = '';
    view = 'public';
    publicOpened = true;
    await tick();
    dialog.scrollTop = 0;
    heading?.focus();
  }

  async function showSources() {
    clearChoice();
    view = 'sources';
    await tick();
    dialog.querySelector('[data-source]')?.focus();
  }

  async function showPreview() {
    view = 'preview';
    await tick();
    dialog.scrollTop = 0;
    heading?.focus();
  }

  function openPicker(input) {
    error = '';
    input.click();
  }

  async function chooseFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    clearChoice();
    preparing = true;
    try {
      const optimized = await maybeCompress(file);
      if (!/\.(jpe?g|png|webp|gif)$/i.test(optimized.name)) {
        throw new Error('Choisis une photo au format JPEG, PNG, WebP ou GIF.');
      }
      if (optimized.size > MAX_PHOTO_BYTES) {
        throw new Error(`Cette photo dépasse ${MAX_PHOTO_MB} Mo. Choisis une image plus légère.`);
      }
      localPreview = URL.createObjectURL(optimized);
      localFile = optimized;
      await showPreview();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Impossible de préparer cette photo.';
    } finally {
      preparing = false;
    }
  }

  function choosePublicImage(image) {
    clearChoice();
    publicImage = image;
    showPreview();
  }

  async function goBack() {
    const cameFromPublic = Boolean(publicImage);
    clearChoice();
    if (cameFromPublic) {
      await showPublic();
    } else {
      await showSources();
    }
  }

  function save({ formData, cancel }) {
    if (saving || (!localFile && !publicImage)) {
      cancel();
      return;
    }
    if (localFile) formData.set('photo', localFile);
    if (publicImage) formData.set('photo_commons_id', String(publicImage.pageId));
    error = '';
    saving = true;
    return async ({ result, update }) => {
      if (result.type === 'success') {
        await update({ reset: false });
        dialog?.close();
        notice = 'Photo enregistrée.';
      } else {
        error = result.type === 'failure' && result.data?.photoError
          ? result.data.photoError : 'Impossible d’enregistrer la photo. Réessaie.';
      }
      saving = false;
    };
  }
</script>

{#snippet icon(name, size = 'size-6')}
  <svg class={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if name === 'camera'}
      <path d="M8 6.5 9.5 4h5L16 6.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="13" r="3.3" />
    {:else if name === 'gallery'}
      <path d="M5 6V4h14a2 2 0 0 1 2 2v11" />
      <rect x="3" y="8" width="15" height="12" rx="2" />
      <path d="m3.5 17 4-4 3.5 3.5L14 14l4 4" />
      <circle cx="13.5" cy="11.5" r=".7" fill="currentColor" stroke="none" />
    {:else if name === 'public'}
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    {:else if name === 'back'}
      <path d="m14 6-6 6 6 6M8 12h12" />
    {:else}
      <path d="m6 6 12 12M18 6 6 18" />
    {/if}
  </svg>
{/snippet}

<div class="rounded-card border border-umber/15 p-3 shadow-soft-lg {recipe.photoPath ? 'bg-panna' : 'bg-sand'}">
  <button type="button" class="group relative block w-full overflow-hidden rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mare"
    aria-haspopup="dialog" aria-label={photoAction} onclick={open}>
    {#if recipe.photoPath}
      <img src={recipe.photoPath} alt={recipe.title} class="aspect-square w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.02]" />
      <span class="no-print absolute bottom-3 right-3 inline-flex items-center gap-2 rounded bg-panna px-3 py-2 text-xs font-medium text-umber shadow-soft group-hover:bg-linen">
        {@render icon('camera', 'size-4')} {photoAction}
      </span>
    {:else}
      <span class="flex aspect-square flex-col items-center justify-center gap-3 bg-linen p-4 text-center text-mare transition-colors group-hover:bg-panna/70">
        <span class="no-print grid size-12 place-items-center rounded-full border border-mare/20 bg-panna">
          {@render icon('camera')}
        </span>
        <span class="no-print font-display text-2xl italic text-umber">{photoAction}</span>
        <span class="hidden font-display text-7xl italic text-sepia print:inline">N°</span>
      </span>
    {/if}
  </button>
  <PhotoCredit {recipe} />
  <p class="sr-only" role="status">{notice}</p>
</div>

<dialog class="photo-dialog no-print rounded-xl border border-umber/10 bg-panna text-umber"
  aria-labelledby="recipe-photo-title" bind:this={dialog} onclose={onClose}
  oncancel={(event) => { if (preparing || saving) event.preventDefault(); }}>
  <header class="relative border-b border-umber/10 bg-linen/70 px-5 py-5 sm:px-7">
    <button type="button" class="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-umber/15 bg-panna text-umber hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare disabled:opacity-60"
      aria-label="Fermer" disabled={preparing || saving} onclick={close}>
      {@render icon('close', 'size-5')}
    </button>
    <h2 id="recipe-photo-title" class="h-display pr-10 text-3xl italic sm:text-4xl" tabindex="-1" bind:this={heading}>
      {view === 'preview' ? 'Aperçu de la photo' : view === 'public' ? 'Galerie publique' : photoAction}
    </h2>
    <p class="mt-1 break-words pr-10 text-sm text-umber/75">{recipe.title}</p>
  </header>

  <div class="space-y-4 p-5 sm:p-7">
    {#if view === 'sources'}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" class="source-button hover:border-terra/60" data-source disabled={preparing} onclick={() => openPicker(camera)}>
          <span class="source-icon bg-terra-soft/60 text-umber">{@render icon('camera')}</span>
          <span>
            <span class="block font-semibold">Appareil photo</span>
            <span class="mt-1 block text-xs leading-relaxed text-umber/75">Prendre une photo</span>
          </span>
        </button>
        <button type="button" class="source-button hover:border-oliva/70" disabled={preparing} onclick={() => openPicker(gallery)}>
          <span class="source-icon bg-oliva-soft/60 text-umber">{@render icon('gallery')}</span>
          <span>
            <span class="block font-semibold">Galerie personnelle</span>
            <span class="mt-1 block text-xs leading-relaxed text-umber/75">Choisir sur cet appareil</span>
          </span>
        </button>
        <button type="button" class="source-button hover:border-mare/60" disabled={preparing} onclick={showPublic}>
          <span class="source-icon bg-mare-soft/60 text-mare-deep">{@render icon('public')}</span>
          <span>
            <span class="block font-semibold">Galerie publique</span>
            <span class="mt-1 block text-xs leading-relaxed text-umber/75">Rechercher sur Wikimedia Commons</span>
          </span>
        </button>
      </div>
      {#if preparing}<p role="status" class="text-sm text-mare">Préparation de la photo…</p>{/if}
      <input type="file" accept="image/*" capture="environment" hidden bind:this={camera} onchange={chooseFile} />
      <input type="file" accept="image/*" hidden bind:this={gallery} onchange={chooseFile} />
    {/if}

    {#if publicOpened}
      <div hidden={view !== 'public'} class="space-y-3">
        <button type="button" class="btn-ghost btn-sm -ml-2" onclick={showSources}>
          {@render icon('back', 'size-4')} Sources de photo
        </button>
        <RecipeImageSearch initialQuery={recipe.title} autoSearch onSelect={choosePublicImage} />
      </div>
    {/if}

    {#if view === 'preview'}
      <figure class="mx-auto max-w-72">
        <img src={localPreview || publicImage?.url} alt={publicImage?.title || 'Photo sélectionnée'}
          class="mx-auto aspect-square w-full rounded-soft bg-linen object-cover" />
        {#if publicImage}
          <figcaption class="mt-2 text-center text-xs text-umber/75">
            <a href={publicImage.source} target="_blank" rel="noreferrer" class="link">{publicImage.author} · {publicImage.license}</a>
          </figcaption>
        {/if}
      </figure>
      <form method="POST" enctype="multipart/form-data" action="?/updatePhoto" use:enhance={save}
        class="flex flex-wrap justify-between gap-2 border-t border-umber/10 pt-4">
        <button type="button" class="btn-secondary disabled:opacity-60" disabled={saving} onclick={goBack}>
          {@render icon('back', 'size-4')} Retour
        </button>
        <button type="submit" class="btn-primary disabled:opacity-60" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer la photo'}
        </button>
      </form>
    {/if}
    {#if error}<p role="alert" class="text-sm text-terra">{error}</p>{/if}
  </div>
</dialog>

<style lang="postcss">
  .photo-dialog {
    position: fixed;
    inset: 50% auto auto 50%;
    margin: 0;
    transform: translate(-50%, -50%);
    width: min(42rem, calc(100% - 2rem));
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-shadow: 0 24px 80px rgb(37 28 20 / 26%);
  }

  .photo-dialog::backdrop {
    background: rgb(40 32 25 / 54%);
    backdrop-filter: blur(3px);
  }

  .source-button {
    @apply flex min-h-20 items-center gap-3 rounded-soft border border-umber/15 bg-white/45 p-3 text-left text-sm
      transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
      focus-visible:outline-mare disabled:opacity-60 sm:min-h-36 sm:flex-col sm:items-start sm:p-4;
  }

  .source-icon {
    @apply grid size-11 shrink-0 place-items-center rounded-soft;
  }
</style>
