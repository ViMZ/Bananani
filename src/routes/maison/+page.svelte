<script>
  import { enhance } from '$app/forms';
  import { tick } from 'svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { withUndoWindow } from '$lib/ingredients/shopping-items.svelte.js';
  import { formatQuantity, resolveUnit } from '$lib/ingredients/units';

  let { data } = $props();
  const household = withUndoWindow(() => data);
  let itemDialog = $state(null);
  let draft = $state(null);
  let saving = $state(false);
  let error = $state('');

  async function openItem(item = null) {
    draft = { id: item?.id, name: item?.name ?? '', quantity: item?.quantity || undefined, unit: item?.unit ?? '' };
    error = '';
    await tick();
    itemDialog.showModal();
  }

  function submitItem({ cancel }) {
    if (saving) return cancel();
    saving = true;
    error = '';
    return async ({ result, update }) => {
      try {
        if (result.type === 'failure') {
          error = result.data?.error || 'Impossible d’enregistrer cet article.';
          return;
        }
        if (result.type === 'redirect' || result.type === 'success') itemDialog.close();
        await update();
      } finally {
        saving = false;
      }
    };
  }

  function displayQuantity(item) {
    const { family, factor } = resolveUnit(item.unit);
    return formatQuantity(item.quantity * factor, family, item.unit);
  }
</script>

<svelte:head><title>Maison · Bananani</title></svelte:head>

<div class="mx-auto max-w-2xl">
  <div class="relative mb-3 flex min-h-11 items-center justify-center">
    <PageTitle title="Maison" size="text-3xl md:text-4xl" class="text-center" />
    <button type="button" class="btn-primary absolute right-0 size-11 p-0"
      aria-label="Ajouter un article" title="Ajouter un article" onclick={() => openItem()}>
      <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>

  {#if household.items.length}
    <table class="w-full table-fixed border-collapse text-left">
      <thead class="text-sm text-sepia">
        <tr>
          <th scope="col" class="px-2 pb-2 font-medium">Article</th>
          <th scope="col" class="w-20 pb-2 text-center font-medium">Courses</th>
          <th scope="col" class="w-12"><span class="sr-only">Modification</span></th>
        </tr>
      </thead>
      <tbody class="bg-panna">
        {#each household.items as item (item.id)}
          {@const inShopping = !item.checked && !item.archivedAt}
          <tr class="border-y border-umber/15">
            {#if item.removedUntil}
              <td colspan="3">
                <form method="POST" action="?/undoRemove" use:enhance>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="removedUntil" value={item.removedUntil} />
                  <button type="submit" class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-2 py-1 text-left text-sm text-umber"
                    aria-label={`Annuler la suppression de ${item.name}`}>
                    <span class="min-w-0 break-words">« {item.name} » a été supprimé</span>
                    <span class="font-semibold text-mare underline underline-offset-2">Annuler</span>
                  </button>
                </form>
              </td>
            {:else}
              <td class="break-words px-2 py-1.5">
                <span class="font-semibold text-umber">{item.name}</span>
                {#if item.quantity}
                  <span class="ml-1 inline-block text-sm text-sepia">{displayQuantity(item)}</span>
                {/if}
              </td>
              <td class="text-center">
                <form method="POST" action="?/setInShopping" use:enhance>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="inShopping" value={inShopping ? '0' : '1'} />
                  <button type="submit" role="checkbox" aria-checked={inShopping}
                    aria-label={`${item.name} dans la liste de courses`}
                    class="inline-flex size-11 cursor-pointer items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare">
                    <span class="flex size-5 items-center justify-center rounded border {inShopping ? 'border-oliva bg-oliva text-panna' : 'border-umber/60'}" aria-hidden="true">
                      {#if inShopping}
                        <svg class="size-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 6 5 9 10 3" />
                        </svg>
                      {/if}
                    </span>
                  </button>
                </form>
              </td>
              <td class="text-center">
                <button type="button" class="inline-flex size-11 cursor-pointer items-center justify-center rounded text-mare hover:bg-mare-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare"
                  aria-label={`Modifier ${item.name}`} title={`Modifier ${item.name}`} onclick={() => openItem(item)}>
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15l-1 5z" />
                  </svg>
                </button>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="text-center text-sm text-sepia">Aucun article dans Maison.</p>
  {/if}
</div>

<dialog bind:this={itemDialog} aria-labelledby="item-dialog-title"
  class="card m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md overflow-auto backdrop:bg-umber/50"
  oncancel={(event) => { if (saving) event.preventDefault(); }}>
  {#if draft}
    <h2 id="item-dialog-title" class="h-display mb-4 text-2xl italic text-umber">{draft.id ? 'Modifier l’article' : 'Ajouter un article'}</h2>
    <form id="maison-item-form" method="POST" action={draft.id ? '?/edit' : '?/add'} use:enhance={submitItem}
      class="grid grid-cols-2 gap-3">
      {#if draft.id}<input type="hidden" name="id" value={draft.id} />{/if}
      <div class="col-span-2 min-w-0">
        <label class="label" for="maison-item-name">Article</label>
        <input class="input" id="maison-item-name" name="name" bind:value={draft.name}
          placeholder="Ex. Lessive" maxlength="120" required />
      </div>
      <div class="min-w-0">
        <label class="label" for="maison-item-quantity">Quantité</label>
        <input class="input" id="maison-item-quantity" name="quantity" type="number" step="any" min="0"
          max="1000000" bind:value={draft.quantity} />
      </div>
      <div class="min-w-0">
        <label class="label" for="maison-item-unit">Unité</label>
        <input class="input" id="maison-item-unit" name="unit" bind:value={draft.unit}
          placeholder="Ex. L" maxlength="32" />
      </div>
    </form>
    {#if error}<p class="mt-2 text-sm text-terra" role="alert">{error}</p>{/if}
    <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
      {#if draft.id}
        <form method="POST" action="?/remove" use:enhance={submitItem} class="mr-auto">
          <input type="hidden" name="id" value={draft.id} />
          <button type="submit" class="btn-ghost text-terra" disabled={saving}>Supprimer</button>
        </form>
      {/if}
      <button type="button" class="btn-ghost" disabled={saving} onclick={() => itemDialog.close()}>Annuler</button>
      <button type="submit" form="maison-item-form" class="btn-primary" disabled={saving}>
        {draft.id ? 'Enregistrer' : 'Ajouter'}
      </button>
    </div>
  {/if}
</dialog>
