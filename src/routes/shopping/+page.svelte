<script>
  import { enhance } from '$app/forms';
  import Sprig from '$lib/components/Sprig.svelte';

  let { data } = $props();

  let grouped = $derived(() => {
    const groups = {};
    for (const item of data.items) {
      const key = item.recipeTitle || 'Aggiunti a mano';
      (groups[key] ??= []).push(item);
    }
    return Object.entries(groups);
  });

  let pending = $derived(data.items.filter((i) => !i.checked).length);
  let done = $derived(data.items.filter((i) => i.checked).length);
</script>

<header class="text-center mb-12">
  <div class="h-eyebrow mb-2">Lista della spesa</div>
  <h1 class="h-display text-5xl md:text-6xl italic">Courses</h1>
  <p class="text-sepia mt-3 italic">
    <span class="font-display text-mare not-italic">{pending}</span> à acheter
    <span class="text-sepia/50 mx-2">·</span>
    <span class="font-display text-oliva not-italic">{done}</span> dans le panier
  </p>
</header>

<div class="flex flex-wrap justify-center gap-2 mb-10 no-print">
  <a href="/shopping/print" class="btn-secondary">🍋 Imprimer la liste</a>
  {#if done > 0}
    <form method="POST" action="?/clearChecked" use:enhance>
      <button class="btn-secondary">Retirer les cochés ({done})</button>
    </form>
  {/if}
  {#if data.items.length > 0}
    <form method="POST" action="?/clearAll" use:enhance>
      <button class="btn-ghost text-terra hover:bg-terra/10">Tout vider</button>
    </form>
  {/if}
</div>

<!-- Ajout manuel -->
<section class="card-sand mb-10">
  <div class="h-eyebrow mb-4">— Aggiungere a mano</div>
  <form method="POST" action="?/add" use:enhance class="grid sm:grid-cols-[1fr_90px_90px_1fr_auto] gap-3 items-end">
    <div>
      <label class="label" for="add-name">Article</label>
      <input id="add-name" class="input" name="name" placeholder="ex. Latte fresco" required />
    </div>
    <div>
      <label class="label" for="add-qty">Qté</label>
      <input id="add-qty" class="input font-mono text-center" name="quantity" type="number" step="0.01" min="0" />
    </div>
    <div>
      <label class="label" for="add-unit">Unité</label>
      <input id="add-unit" class="input font-mono" name="unit" placeholder="L" />
    </div>
    <div>
      <label class="label" for="add-brand">Marque</label>
      <input id="add-brand" class="input italic" name="brand" placeholder="(optionnel)" />
    </div>
    <button class="btn-primary">＋ Ajouter</button>
  </form>
</section>

{#if data.items.length === 0}
  <div class="text-center py-16">
    <div class="flex justify-center mb-4 opacity-50">
      <Sprig width={120} />
    </div>
    <h2 class="h-display text-3xl italic text-sepia mb-2">Lista vuota</h2>
    <p class="text-sepia mb-8">Aucun article à acheter — scanne une fiche pour commencer.</p>
    <a href="/scan" class="btn-primary">→ Scanner une fiche</a>
  </div>
{:else}
  <div class="space-y-10">
    {#each grouped() as [groupName, items]}
      <section>
        <div class="flex items-baseline gap-4 mb-4">
          <h2 class="h-display italic text-2xl text-mare">{groupName}</h2>
          <span class="flex-1 h-px bg-mare/30"></span>
          <span class="h-eyebrow text-mare">{items.length}</span>
        </div>

        <ul class="space-y-2">
          {#each items as item}
            <li class="flex items-start gap-3 py-3 px-4 rounded bg-panna border border-umber/10 hover:border-umber/25 transition-colors">
              <form method="POST" action="?/toggle" use:enhance class="pt-0.5">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="checked" value={item.checked ? '0' : '1'} />
                <button
                  type="submit"
                  class="w-5 h-5 border rounded-sm flex items-center justify-center transition-all
                         {item.checked
                           ? 'bg-oliva border-oliva shadow-soft'
                           : 'bg-panna border-umber/40 hover:border-mare hover:bg-mare-soft/30'}"
                  aria-label={item.checked ? 'Décocher' : 'Cocher'}
                >
                  {#if item.checked}
                    <svg class="w-3 h-3 text-panna" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 6 L5 9 L10 3" />
                    </svg>
                  {/if}
                </button>
              </form>
              <div class="flex-1 {item.checked ? 'line-through text-sepia/60' : ''}">
                <div class="flex items-baseline gap-3 flex-wrap">
                  <span class="font-sans text-[15px] font-medium text-umber">{item.name}</span>
                  {#if item.quantity}
                    <span class="font-display text-base text-umber/70">
                      {item.quantity} <span class="font-sans text-xs text-sepia">{item.unit}</span>
                    </span>
                  {/if}
                </div>
                {#if item.brand || item.productReference}
                  <div class="font-mono text-[10px] uppercase tracking-wider text-sepia mt-0.5">
                    {[item.brand, item.productReference].filter(Boolean).join(' · ')}
                  </div>
                {/if}
                {#if item.notes}
                  <div class="text-sm text-sepia italic mt-0.5">{item.notes}</div>
                {/if}
              </div>
              <form method="POST" action="?/remove" use:enhance>
                <input type="hidden" name="id" value={item.id} />
                <button class="text-sepia/60 hover:text-terra p-1 transition-colors" aria-label="Supprimer">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              </form>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
