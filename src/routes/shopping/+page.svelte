<script>
  import { enhance } from '$app/forms';
  import Sprig from '$lib/components/Sprig.svelte';
  import { aggregateItems, groupByCategory } from '$lib/ingredients/aggregate';
  import { groupByRecipe } from '$lib/ingredients/byRecipe';

  let { data } = $props();

  // Vue : 'ingredient' (quantités additionnées) ou 'recipe' (groupé par recette).
  let viewMode = $state('ingredient');
  $effect(() => {
    const saved = localStorage.getItem('shopping-view');
    if (saved === 'recipe' || saved === 'ingredient') viewMode = saved;
  });
  function setView(mode) {
    viewMode = mode;
    localStorage.setItem('shopping-view', mode);
  }

  let expiredUntil = $state(0);
  let visibleItems = $derived(data.items.filter((item) => !item.removedUntil || item.removedUntil > expiredUntil));
  let hasActiveItems = $derived(visibleItems.some((item) => !item.removedUntil));

  $effect(() => {
    const deadlines = new Set(data.items.map((item) => item.removedUntil).filter(Boolean));
    const timers = [...deadlines].map((deadline) => setTimeout(() => {
      expiredUntil = Math.max(expiredUntil, deadline);
    }, Math.max(0, deadline - data.now)));
    return () => timers.forEach(clearTimeout);
  });

  // Vue par recette : une entrée par recette ; les ajouts multiples sont fusionnés
  // et rendus explicites (« 2 pers × 2 », « 200 × 2 »).
  let recipeGroups = $derived(groupByRecipe(visibleItems));

  // Vue par ingrédient : agrégation + addition, groupée par rayon de magasin.
  let byCategory = $derived(groupByCategory(aggregateItems(visibleItems)));

  // Ajout manuel : bouton → modale.
  let addModalOpen = $state(false);
  let nameInput = $state(null);
  $effect(() => {
    if (addModalOpen && nameInput) nameInput.focus();
  });
</script>

{#snippet shoppingItem({ ids, name, checked, removedUntil, quantity, recipeCount = 0 }, details)}
  <li
    class="relative rounded border transition-colors {removedUntil
      ? 'border-dashed border-terra/50 bg-panna'
      : checked
        ? 'border-l-4 border-oliva/50 border-l-oliva bg-oliva-soft/60'
        : 'border-l-4 border-umber/15 bg-panna hover:border-umber/30'}"
  >
    {#if removedUntil}
      <form method="POST" action="?/undoRemove" use:enhance>
        <input type="hidden" name="ids" value={ids.join(',')} />
        <input type="hidden" name="removedUntil" value={removedUntil} />
        <button
          type="submit"
          class="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-umber hover:bg-sand/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare"
          aria-label={`Annuler la suppression de ${name}`}
        >
          <span class="min-w-0 break-words">« {name} » a été supprimé</span>
          <span class="shrink-0 font-semibold text-mare underline underline-offset-2">Annuler</span>
        </button>
      </form>
    {:else}
      <form method="POST" action="?/toggle" use:enhance>
        <input type="hidden" name="ids" value={ids.join(',')} />
        <input type="hidden" name="checked" value={checked ? '0' : '1'} />
        <button
          type="submit"
          class="group flex w-full cursor-pointer items-start gap-2 rounded py-1 pl-11 pr-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare"
          role="checkbox" aria-checked={checked} aria-label={`${name} dans le panier`}
        >
          <span class="min-w-0 flex-1 py-2.5">
            <span class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span class="min-w-0 break-words font-sans text-[15px] font-semibold {checked
                ? 'text-umber/80 line-through decoration-2'
                : 'text-umber'}">{name}</span>
              {#if quantity}
                <span class="font-display text-base text-umber/80">{quantity}</span>
              {/if}
              {#if recipeCount > 1}
                <span class="font-mono text-[10px] uppercase tracking-wider text-mare bg-mare-soft/30 rounded-full px-2 py-0.5">
                  ×{recipeCount} recettes
                </span>
              {/if}
            </span>
            {@render details()}
          </span>
          <span class="flex size-11 shrink-0 items-center justify-center" aria-hidden="true">
            <span class="flex size-7 items-center justify-center rounded border-2 transition-colors {checked
              ? 'border-[#566131] bg-[#566131] text-panna'
              : 'border-umber/60 bg-panna group-hover:border-mare group-hover:bg-mare-soft/30'}">
              {#if checked}
                <svg class="size-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 6 L5 9 L10 3" />
                </svg>
              {/if}
            </span>
          </span>
        </button>
      </form>

      <form method="POST" action="?/remove" use:enhance class="absolute left-2 top-1">
        <input type="hidden" name="ids" value={ids.join(',')} />
        <button type="submit" class="flex h-11 w-7 items-center justify-center text-sepia transition-colors hover:text-terra" aria-label={`Exclure ${name} de la liste`}>
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
        </button>
      </form>
    {/if}
  </li>
{/snippet}

<h1 class="h-display text-center text-3xl italic md:text-4xl">Courses</h1>

<div class="no-print sticky top-[var(--app-header-height)] z-20 -mx-4 mb-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-b border-umber/15 bg-linen px-2 py-1 md:-mx-8 md:px-8">
  <div class="inline-flex rounded-full border border-umber/20 bg-panna p-0.5 text-xs font-medium" role="group" aria-label="Regrouper les courses">
    <button
      type="button"
      class="h-7 rounded-full px-2 transition-colors {viewMode === 'ingredient' ? 'bg-mare text-panna' : 'text-umber hover:text-mare'}"
      aria-pressed={viewMode === 'ingredient'}
      onclick={() => setView('ingredient')}
    >Ingrédient</button>
    <button
      type="button"
      class="h-7 rounded-full px-2 transition-colors {viewMode === 'recipe' ? 'bg-mare text-panna' : 'text-umber hover:text-mare'}"
      aria-pressed={viewMode === 'recipe'}
      onclick={() => setView('recipe')}
    >Recette</button>
  </div>

  <div class="flex items-center gap-1">
    <button type="button" class="btn-primary h-8 whitespace-nowrap px-2 py-0 text-xs" onclick={() => (addModalOpen = true)}>+ Ajouter</button>
    <a href="/shopping/print?view={viewMode}" class="btn-secondary size-8 p-0" aria-label="Imprimer la liste" title="Imprimer la liste">
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 9V3h12v6M6 18H3V9h18v9h-3M17 12h1" />
        <path d="M6 14h12v7H6z" />
      </svg>
    </a>
    <form method="POST" action="?/clearAll" use:enhance>
      <button type="submit" class="btn-secondary size-8 p-0 text-terra disabled:opacity-50" aria-label="Vider la liste" title="Vider la liste" disabled={!hasActiveItems}>
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6m4-6v6" />
        </svg>
      </button>
    </form>
  </div>
</div>

{#if visibleItems.length === 0}
  <div class="text-center py-16">
    <div class="flex justify-center mb-4 opacity-50">
      <Sprig width={120} />
    </div>
    <h2 class="h-display text-3xl italic text-sepia mb-2">Liste vide</h2>
    <p class="text-sepia mb-8">Aucun article à acheter — scanne une fiche pour commencer.</p>
    <a href="/scan" class="btn-primary">→ Scanner une fiche</a>
  </div>
{:else if viewMode === 'ingredient'}
  <!-- Vue agrégée : un article par ingrédient, quantités additionnées, par rayon. -->
  <div class="space-y-10">
    {#each byCategory as [categoryName, groups]}
      <section>
        <div class="flex items-baseline gap-4 mb-2">
          <h2 class="h-display italic text-2xl text-mare">{categoryName}</h2>
          <span class="flex-1 h-px bg-mare/30"></span>
          <span class="h-eyebrow text-mare">{groups.length}</span>
        </div>
        <ul class="space-y-2">
          {#each groups as group (group.key)}
            {#snippet details()}
              {#if group.brand || group.productReference}
                <span class="block font-mono text-[10px] uppercase tracking-wider text-umber/75 mt-0.5">
                  {[group.brand, group.productReference].filter(Boolean).join(' · ')}
                </span>
              {/if}
              {#if group.recipes.length > 0}
                <span class="block text-xs text-umber/75 italic mt-0.5">{group.recipes.join(', ')}</span>
              {/if}
              {#if group.notes.length > 0}
                <span class="block text-sm text-umber/75 italic mt-0.5">{group.notes.join(' · ')}</span>
              {/if}
            {/snippet}
            {@render shoppingItem({
              ids: group.ids,
              name: group.label,
              checked: group.checked,
              removedUntil: group.removedUntil,
              quantity: group.subtotals.map((subtotal) => subtotal.display).join(' · '),
              recipeCount: group.recipes.length
            }, details)}
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{:else}
  <div class="space-y-10">
    {#each recipeGroups as group (group.title)}
      <section>
        <div class="flex items-baseline gap-4 mb-2">
          <h2 class="h-display italic text-2xl text-mare">{group.title}</h2>
          {#if group.totalServings || group.instances > 1}
            <span class="font-mono text-[10px] uppercase tracking-wider text-mare bg-mare-soft/30 rounded-full px-2 py-0.5">
              {#if group.totalServings}{group.totalServings} portions au total · {group.instances} repas{:else}× {group.instances}{/if}
            </span>
          {/if}
          <span class="flex-1 h-px bg-mare/30"></span>
          <span class="h-eyebrow text-mare">{group.lines.length}</span>
        </div>

        <ul class="space-y-2">
          {#each group.lines as line (line.ids.join(','))}
            {#snippet details()}
              {#if line.brand || line.productReference}
                <span class="block font-mono text-[10px] uppercase tracking-wider text-umber/75 mt-0.5">
                  {[line.brand, line.productReference].filter(Boolean).join(' · ')}
                </span>
              {/if}
              {#if line.notes.length > 0}
                <span class="block text-sm text-umber/75 italic mt-0.5">{line.notes.join(' · ')}</span>
              {/if}
            {/snippet}
            {@render shoppingItem({
              ids: line.ids,
              name: line.name,
              checked: line.checked,
              removedUntil: line.removedUntil,
              quantity: line.total ? line.display : ''
            }, details)}
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<!-- Modale d'ajout manuel -->
{#if addModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
    <button type="button" class="absolute inset-0 bg-umber/40" aria-label="Fermer" onclick={() => (addModalOpen = false)}></button>
    <div class="relative card max-w-md w-full">
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-display italic text-2xl text-umber">Ajouter un article</h2>
        <button type="button" class="btn-ghost btn-sm" onclick={() => (addModalOpen = false)}>Fermer</button>
      </div>
      <form
        method="POST"
        action="?/add"
        use:enhance={() => {
          return async ({ result, update }) => {
            await update();
            if (result.type === 'success') addModalOpen = false;
          };
        }}
        class="space-y-4"
      >
        <div>
          <label class="label" for="add-name">Article</label>
          <input id="add-name" bind:this={nameInput} class="input" name="name" placeholder="ex. Latte fresco" required />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="add-qty">Qté</label>
            <input id="add-qty" class="input font-mono text-center" name="quantity" type="number" step="0.01" min="0" />
          </div>
          <div>
            <label class="label" for="add-unit">Unité</label>
            <input id="add-unit" class="input font-mono" name="unit" placeholder="L" />
          </div>
        </div>
        <div>
          <label class="label" for="add-brand">Marque</label>
          <input id="add-brand" class="input italic" name="brand" placeholder="(optionnel)" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-ghost" onclick={() => (addModalOpen = false)}>Annuler</button>
          <button type="submit" class="btn-primary">＋ Ajouter</button>
        </div>
      </form>
    </div>
  </div>
{/if}
