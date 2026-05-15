<script>
  import { enhance } from '$app/forms';
  let { data } = $props();

  let grouped = $derived(() => {
    /** @type {Record<string, typeof data.items>} */
    const groups = {};
    for (const item of data.items) {
      const key = item.recipeTitle || 'Ajouts manuels';
      (groups[key] ??= []).push(item);
    }
    return Object.entries(groups);
  });

  let pending = $derived(data.items.filter((i) => !i.checked).length);
  let done = $derived(data.items.filter((i) => i.checked).length);
</script>

<div class="flex flex-wrap items-center justify-between gap-2 mb-4">
  <h1 class="text-2xl font-display font-bold">Liste de courses</h1>
  <div class="flex flex-wrap gap-2">
    <a href="/shopping/print" class="btn-secondary">🖨️ Imprimer</a>
    {#if done > 0}
      <form method="POST" action="?/clearChecked" use:enhance>
        <button class="btn-secondary">Retirer les cochés ({done})</button>
      </form>
    {/if}
    {#if data.items.length > 0}
      <form method="POST" action="?/clearAll" use:enhance>
        <button class="btn-danger">Tout vider</button>
      </form>
    {/if}
  </div>
</div>

<div class="card mb-4">
  <form method="POST" action="?/add" use:enhance class="grid sm:grid-cols-[1fr_100px_100px_120px_auto] gap-2 items-end">
    <div>
      <label class="label">Article</label>
      <input class="input" name="name" placeholder="ex. Lait" required />
    </div>
    <div>
      <label class="label">Qté</label>
      <input class="input" name="quantity" type="number" step="0.01" min="0" />
    </div>
    <div>
      <label class="label">Unité</label>
      <input class="input" name="unit" placeholder="L" />
    </div>
    <div>
      <label class="label">Marque</label>
      <input class="input" name="brand" placeholder="(optionnel)" />
    </div>
    <button class="btn-primary">+ Ajouter</button>
  </form>
</div>

{#if data.items.length === 0}
  <div class="card text-center text-stone-600 py-12">
    <div class="text-5xl mb-3">🛒</div>
    <p class="mb-4">Liste vide.</p>
    <a href="/scan" class="btn-primary">📷 Scanner une fiche</a>
  </div>
{:else}
  <div class="text-sm text-stone-600 mb-2">
    {pending} à acheter · {done} cochés
  </div>

  <div class="space-y-4">
    {#each grouped() as [groupName, items]}
      <section class="card">
        <h2 class="font-display font-bold mb-2 text-banana-700">{groupName}</h2>
        <ul class="divide-y divide-stone-100">
          {#each items as item}
            <li class="flex items-center gap-3 py-2">
              <form method="POST" action="?/toggle" use:enhance>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="checked" value={item.checked ? '0' : '1'} />
                <button
                  type="submit"
                  class="w-6 h-6 rounded-md border-2 flex items-center justify-center
                    {item.checked ? 'bg-banana-500 border-banana-600' : 'bg-white border-stone-300 hover:border-banana-400'}"
                  aria-label={item.checked ? 'Décocher' : 'Cocher'}
                >
                  {#if item.checked}✓{/if}
                </button>
              </form>
              <div class="flex-1 {item.checked ? 'line-through text-stone-400' : ''}">
                <span class="font-medium">{item.name}</span>
                {#if item.quantity}<span class="text-stone-600"> — {item.quantity} {item.unit}</span>{/if}
                {#if item.brand || item.productReference}
                  <span class="text-xs text-stone-500"> ({[item.brand, item.productReference].filter(Boolean).join(' · ')})</span>
                {/if}
                {#if item.notes}
                  <div class="text-xs text-stone-500 italic">{item.notes}</div>
                {/if}
              </div>
              <form method="POST" action="?/remove" use:enhance>
                <input type="hidden" name="id" value={item.id} />
                <button class="text-stone-400 hover:text-red-600 text-sm" aria-label="Supprimer">🗑️</button>
              </form>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
