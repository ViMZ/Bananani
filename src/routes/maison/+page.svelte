<script>
  import { enhance } from '$app/forms';
  import { withUndoWindow } from '$lib/ingredients/shopping-items.svelte.js';
  import { formatQuantity, resolveUnit } from '$lib/ingredients/units';

  let { data, form } = $props();
  const household = withUndoWindow(() => data);
  let pending = $derived(household.items.filter((item) => !item.checked));
  let bought = $derived(household.items.filter((item) => item.checked));
  let adding = $state(false);

  function displayQuantity(item) {
    if (!item.quantity) return '';
    const { family, factor } = resolveUnit(item.unit);
    return formatQuantity(item.quantity * factor, family, item.unit);
  }
</script>

<svelte:head><title>Maison · Bananani</title></svelte:head>

{#snippet fields(prefix, values)}
  <div class="col-span-2 min-w-0">
    <label class="label" for={`${prefix}-name`}>Article</label>
    <input class="input" id={`${prefix}-name`} name="name" value={values.name ?? ''}
      placeholder="Ex. Lessive" maxlength="120" required />
  </div>
  <div class="min-w-0">
    <label class="label" for={`${prefix}-quantity`}>Quantité</label>
    <input class="input" id={`${prefix}-quantity`} name="quantity" type="number" step="any" min="0"
      max="1000000" value={values.quantity || ''} />
  </div>
  <div class="min-w-0">
    <label class="label" for={`${prefix}-unit`}>Unité</label>
    <input class="input" id={`${prefix}-unit`} name="unit" value={values.unit ?? ''}
      placeholder="Ex. L" maxlength="32" />
  </div>
{/snippet}

{#snippet itemList(items)}
  <ul class="space-y-2">
    {#each items as item (item.id)}
      <li class="rounded border bg-panna {item.removedUntil ? 'border-dashed border-terra/50' : 'border-umber/15'}">
        {#if item.removedUntil}
          <form method="POST" action="?/undoRemove" use:enhance>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="removedUntil" value={item.removedUntil} />
            <button type="submit" class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm text-umber"
              aria-label={`Annuler la suppression de ${item.name}`}>
              <span class="min-w-0 break-words">« {item.name} » a été supprimé</span>
              <span class="font-semibold text-mare underline underline-offset-2">Annuler</span>
            </button>
          </form>
        {:else}
          <div class="flex min-h-14 items-center justify-between gap-2 px-3 py-1">
            <div class="min-w-0 break-words">
              <span class="font-semibold text-umber">{item.name}</span>
              {#if item.quantity}
                <span class="ml-2 whitespace-nowrap text-sm text-sepia">{displayQuantity(item)}</span>
              {/if}
            </div>
            <form method="POST" action="?/toggle" use:enhance class="shrink-0">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="checked" value={item.checked ? '0' : '1'} />
              <button type="submit" class="btn-secondary min-h-11 px-3 py-1.5 text-sm"
                aria-label={item.checked ? `Racheter ${item.name}` : `Marquer ${item.name} comme acheté`}>
                {item.checked ? 'Racheter' : '✓ Acheté'}
              </button>
            </form>
          </div>
          <div class="flex flex-wrap items-start gap-x-2 border-t border-umber/10 px-2">
            <details class="min-w-0 flex-1" open={form?.id === item.id}>
              <summary class="w-fit cursor-pointer px-2 py-2.5 text-sm text-mare" aria-label={`Modifier ${item.name}`}>Modifier</summary>
              <form method="POST" action="?/edit" class="mb-3 grid grid-cols-2 gap-3 px-2 sm:grid-cols-4"
                use:enhance={({ formElement }) => async ({ result, update }) => {
                  if (result.type === 'redirect') formElement.closest('details').open = false;
                  await update();
                }}>
                <input type="hidden" name="id" value={item.id} />
                {@render fields(`edit-${item.id}`, form?.id === item.id ? form.values : item)}
                {#if form?.id === item.id && form.error}
                  <p class="col-span-full text-sm text-terra" role="alert">{form.error}</p>
                {/if}
                <button type="submit" class="btn-primary col-span-full justify-self-start">Enregistrer</button>
              </form>
            </details>
            <form method="POST" action="?/remove" use:enhance>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" class="cursor-pointer px-2 py-2.5 text-sm text-terra" aria-label={`Retirer ${item.name}`}>Retirer</button>
            </form>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="mx-auto max-w-2xl space-y-7">
  <h1 class="h-display text-center text-3xl italic md:text-4xl">Maison</h1>

  <form method="POST" action="?/add" class="card grid grid-cols-2 gap-3 sm:grid-cols-4"
    use:enhance={({ cancel, formElement }) => {
      if (adding) return cancel();
      adding = true;
      return async ({ result, update }) => {
        try {
          if (result.type === 'redirect') formElement.reset();
          await update();
        } finally {
          adding = false;
        }
      };
    }}>
    {@render fields('add', form?.id == null ? form?.values ?? {} : {})}
    {#if form?.error && form.id == null}
      <p class="col-span-full text-sm text-terra" role="alert">{form.error}</p>
    {/if}
    <button type="submit" class="btn-primary col-span-full justify-self-start" disabled={adding}>Ajouter aux courses</button>
  </form>

  <section aria-labelledby="pending-title">
    <h2 id="pending-title" class="h-display mb-2 text-2xl italic text-mare">À acheter</h2>
    {#if pending.length}
      {@render itemList(pending)}
    {:else}
      <p class="text-sm text-sepia">Aucun article à acheter.</p>
    {/if}
  </section>

  {#if bought.length}
    <section aria-labelledby="bought-title">
      <h2 id="bought-title" class="h-display mb-2 text-2xl italic text-mare">Achetés</h2>
      {@render itemList(bought)}
    </section>
  {/if}
</div>
