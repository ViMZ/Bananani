<script>
  import { dndzone, TRIGGERS } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { invalidateAll, goto } from '$app/navigation';
  import { deserialize } from '$app/forms';
  import RecipeMiniCard from '$lib/components/RecipeMiniCard.svelte';
  import { weekDays, addWeeks, mondayOf, parseISO } from '$lib/date/week';

  let { data } = $props();

  const FLIP = 180;
  const MEALS = /** @type {const} */ (['midi', 'soir']);
  const MEAL_LABEL = { midi: 'Midi', soir: 'Soir' };

  let weekStart = $derived(data.weekStart);
  let days = $derived(weekDays(weekStart));
  let currentWeek = $derived(mondayOf(new Date()));

  let query = $state('');

  // Construit les créneaux : slots[dayOfWeek] = { midi: [], soir: [] }.
  function buildSlots() {
    const next = Array.from({ length: 7 }, () => ({ midi: [], soir: [] }));
    for (const p of data.placements) {
      const meal = p.meal === 'soir' ? 'soir' : 'midi';
      next[p.dayOfWeek][meal].push({
        id: `placement-${p.id}`,
        placementId: p.id,
        recipeId: p.recipeId,
        title: p.title,
        photoPath: p.photoPath
      });
    }
    return next;
  }
  // Tiroir : recettes filtrées par la recherche.
  function buildTray() {
    const q = query.trim().toLowerCase();
    return data.recipes
      .filter((r) => !q || r.title.toLowerCase().includes(q))
      .map((r) => ({ id: `tray-${r.id}`, recipeId: r.id, title: r.title, photoPath: r.photoPath }));
  }

  // État DnD local, initialisé depuis les données (SSR déjà peuplé).
  let slots = $state(buildSlots());
  let trayItems = $state(buildTray());

  // Re-synchronise après chaque invalidateAll (placements) et à la recherche.
  $effect(() => {
    data.placements;
    slots = buildSlots();
  });
  $effect(() => {
    query;
    data.recipes;
    trayItems = buildTray();
  });

  // --- Persistance (fetch + invalidateAll, modèle /scan) ---
  async function post(action, fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
    await fetch(`?/${action}`, { method: 'POST', body: fd });
    await invalidateAll();
  }

  // --- Zones "créneau" (jour + midi/soir) ---
  function slotConsider(d, meal, e) {
    slots[d][meal] = e.detail.items;
  }
  async function slotFinalize(d, meal, e) {
    slots[d][meal] = e.detail.items;
    const info = e.detail.info;
    if (info.trigger !== TRIGGERS.DROPPED_INTO_ZONE) return; // zone réceptrice
    const id = String(info.id);
    const index = e.detail.items.findIndex((it) => String(it.id) === id);
    if (id.startsWith('tray-')) {
      const recipeId = Number(id.slice('tray-'.length));
      await post('place', { recipeId, dayOfWeek: d, meal, weekStart });
    } else if (id.startsWith('placement-')) {
      const placementId = Number(id.slice('placement-'.length));
      await post('move', { id: placementId, dayOfWeek: d, meal, position: index < 0 ? 0 : index });
    }
  }

  // --- Tiroir (source en copie) ---
  function trayConsider(e) {
    trayItems = e.detail.items;
  }
  function trayFinalize() {
    trayItems = buildTray();
  }

  async function removePlacement(id) {
    await post('remove', { id });
  }

  // --- Tiroir / placement au tap (fallback tactile) ---
  let trayOpen = $state(false);
  /** @type {{ day: number, meal: 'midi'|'soir' } | null} */
  let pickTarget = $state(null);

  function openTrayForDrag() {
    pickTarget = null;
    trayOpen = true;
  }
  function openTrayForSlot(day, meal) {
    pickTarget = { day, meal };
    trayOpen = true;
  }
  // Tap dans l'espace vide d'un créneau (pas sur une carte) → ouvre le tiroir ciblé.
  function onSlotClick(day, meal, e) {
    if (e.target === e.currentTarget) openTrayForSlot(day, meal);
  }
  function onSlotKey(day, meal, e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      openTrayForSlot(day, meal);
    }
  }
  async function tapPlace(recipeId) {
    const t = pickTarget;
    trayOpen = false;
    pickTarget = null;
    if (!t) return;
    await post('place', { recipeId, dayOfWeek: t.day, meal: t.meal, weekStart });
  }

  // --- Génération de la liste de courses ---
  let genModalOpen = $state(false);
  let genEmpty = $state(false);
  let genBusy = $state(false);

  async function generate(mode) {
    genModalOpen = false;
    genBusy = true;
    genEmpty = false;
    try {
      const fd = new FormData();
      fd.append('weekStart', weekStart);
      fd.append('mode', mode);
      const res = await fetch('?/generate', { method: 'POST', body: fd });
      const result = deserialize(await res.text());
      if (result.type === 'redirect') {
        await goto(result.location);
        return;
      }
      if (result.type === 'success' && result.data?.empty) {
        genEmpty = true;
      }
    } finally {
      genBusy = false;
    }
  }
  function onGenerateClick() {
    if (data.hasShopping) genModalOpen = true;
    else generate('append');
  }

  // --- Libellés ---
  function dayLabel(dateISO) {
    const d = parseISO(dateISO);
    if (!d) return { weekday: '', num: '' };
    return {
      weekday: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      num: String(d.getDate())
    };
  }
  let rangeLabel = $derived.by(() => {
    const a = parseISO(weekStart);
    const b = parseISO(addWeeks(weekStart, 1));
    if (!a || !b) return '';
    b.setDate(b.getDate() - 1);
    const fmt = (dt, opts) => dt.toLocaleDateString('fr-FR', opts);
    const sameMonth = a.getMonth() === b.getMonth();
    return `${fmt(a, { day: 'numeric', month: sameMonth ? undefined : 'long' })} – ${fmt(b, { day: 'numeric', month: 'long' })}`;
  });
</script>

<svelte:head>
  <title>Semaine · Bananani</title>
</svelte:head>

<div class="max-w-2xl mx-auto pb-28">
  <header class="mb-6">
    <div class="h-eyebrow mb-1">Menu de la semaine</div>
    <h1 class="h-display text-4xl md:text-5xl italic">Settimana</h1>
  </header>

  <!-- Navigation de semaine -->
  <div class="flex items-center justify-between gap-3 mb-6">
    <a href="?week={addWeeks(weekStart, -1)}" class="btn-ghost btn-sm" aria-label="Semaine précédente">‹</a>
    <div class="text-center">
      <div class="font-display italic text-lg text-umber">{rangeLabel}</div>
      {#if weekStart !== currentWeek}
        <a href="?week={currentWeek}" class="link text-xs">cette semaine</a>
      {/if}
    </div>
    <a href="?week={addWeeks(weekStart, 1)}" class="btn-ghost btn-sm" aria-label="Semaine suivante">›</a>
  </div>

  <!-- Les 7 jours -->
  <div class="space-y-3">
    {#each days as day (day.dateISO)}
      {@const label = dayLabel(day.dateISO)}
      <section
        class="rounded-card border p-3 transition-colors
          {day.isToday ? 'border-mare/50 bg-mare/5' : 'border-umber/15 bg-panna'}
          {day.isPast ? 'opacity-55' : ''}"
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="font-display italic text-lg capitalize {day.isToday ? 'text-mare' : 'text-umber'}">
            {label.weekday}
          </span>
          <span class="font-mono text-sm text-sepia">{label.num}</span>
          {#if day.isToday}<span class="pill-mare text-[10px]">aujourd'hui</span>{/if}
          {#if day.isPast}<span class="text-[10px] uppercase tracking-wider text-sepia">passé</span>{/if}
        </div>

        <div class="grid grid-cols-2 gap-2">
          {#each MEALS as meal}
            {@const items = slots[day.dayOfWeek][meal]}
            <div>
              <div class="text-[11px] font-sans uppercase tracking-wider text-sepia font-medium mb-1">
                {MEAL_LABEL[meal]}
              </div>
              <div
                class="slot-zone min-h-[4.75rem] space-y-2 rounded-lg bg-linen/40 p-1.5 cursor-pointer"
                class:is-empty={items.length === 0}
                use:dndzone={{ items, flipDurationMs: FLIP, type: 'recipe', dropTargetStyle: { outline: '2px dashed rgba(31,86,115,0.4)', borderRadius: '0.5rem' } }}
                onconsider={(e) => slotConsider(day.dayOfWeek, meal, e)}
                onfinalize={(e) => slotFinalize(day.dayOfWeek, meal, e)}
                onclick={(e) => onSlotClick(day.dayOfWeek, meal, e)}
                onkeydown={(e) => onSlotKey(day.dayOfWeek, meal, e)}
                role="button"
                tabindex="0"
                aria-label="Ajouter une recette — {MEAL_LABEL[meal]} {label.weekday} {label.num}"
              >
                {#each items as item (item.id)}
                  <div class="relative" animate:flip={{ duration: FLIP }}>
                    <RecipeMiniCard recipe={item} />
                    {#if item.placementId}
                      <button
                        type="button"
                        class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-terra text-panna text-xs shadow-soft flex items-center justify-center"
                        aria-label="Retirer"
                        onclick={() => removePlacement(item.placementId)}
                      >
                        ✕
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<!-- Barre d'action fixe -->
<div class="fixed bottom-16 md:bottom-4 inset-x-0 z-20 px-4 no-print">
  <div class="max-w-2xl mx-auto flex gap-2">
    <button type="button" class="btn-secondary flex-1" onclick={openTrayForDrag}>
      + Recettes
    </button>
    <button type="button" class="btn-primary flex-[2]" onclick={onGenerateClick} disabled={genBusy}>
      {genBusy ? 'Génération…' : 'Générer la liste de courses'}
    </button>
  </div>
  {#if genEmpty}
    <p class="max-w-2xl mx-auto mt-2 text-center text-sm italic text-terra bg-panna/90 rounded px-3 py-2 border border-terra/30">
      Aucune recette à venir cette semaine.
    </p>
  {/if}
</div>

<!-- Tiroir de recettes (bottom sheet) -->
{#if trayOpen}
  <div class="fixed inset-0 z-40 flex flex-col justify-end no-print">
    <button
      type="button"
      class="absolute inset-0 bg-umber/40"
      aria-label="Fermer"
      onclick={() => (trayOpen = false)}
    ></button>
    <div class="relative bg-linen rounded-t-card border-t border-umber/15 shadow-soft-lg max-h-[75vh] flex flex-col">
      <div class="p-4 border-b border-umber/10">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display italic text-xl text-umber">
            {#if pickTarget}
              Choisir pour {MEAL_LABEL[pickTarget.meal]}
            {:else}
              Glissez une recette sur un créneau
            {/if}
          </h2>
          <button type="button" class="btn-ghost btn-sm" onclick={() => (trayOpen = false)}>Fermer</button>
        </div>
        <input
          type="text"
          class="input"
          placeholder="Rechercher une recette…"
          bind:value={query}
          autocapitalize="none"
          autocorrect="off"
        />
      </div>

      <div class="p-4 overflow-y-auto">
        {#if data.recipes.length === 0}
          <p class="text-sepia italic text-center py-6">Aucune recette. Créez-en d'abord.</p>
        {:else if pickTarget}
          <!-- Mode tap : liste simple, on touche pour placer -->
          <div class="space-y-2">
            {#each buildTray() as item (item.id)}
              <button type="button" class="w-full text-left" onclick={() => tapPlace(item.recipeId)}>
                <RecipeMiniCard recipe={item} />
              </button>
            {/each}
          </div>
        {:else}
          <!-- Mode glisser : zone source en copie -->
          <div
            class="space-y-2"
            use:dndzone={{ items: trayItems, flipDurationMs: FLIP, type: 'recipe', dropFromOthersDisabled: true, dropTargetStyle: {} }}
            onconsider={trayConsider}
            onfinalize={trayFinalize}
          >
            {#each trayItems as item (item.id)}
              <div animate:flip={{ duration: FLIP }}>
                <RecipeMiniCard recipe={item} />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Popup Ajouter / Remplacer -->
{#if genModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
    <button type="button" class="absolute inset-0 bg-umber/40" aria-label="Annuler" onclick={() => (genModalOpen = false)}></button>
    <div class="relative card max-w-sm w-full">
      <h2 class="font-display italic text-2xl text-umber mb-2">Liste de courses existante</h2>
      <p class="text-sm text-sepia mb-5">
        Une liste de courses existe déjà. Ajouter les recettes de la semaine, ou remplacer la liste ?
      </p>
      <div class="space-y-2">
        <button type="button" class="btn-primary w-full" onclick={() => generate('append')}>
          Ajouter à la liste
        </button>
        <button type="button" class="btn-danger w-full" onclick={() => generate('replace')}>
          Remplacer la liste
        </button>
        <button type="button" class="btn-ghost w-full" onclick={() => (genModalOpen = false)}>
          Annuler
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Le « + » occupe tout l'espace vide du créneau (via ::after), toute la zone
     étant cliquable. pointer-events: none pour que le clic atteigne la zone. */
  .slot-zone {
    position: relative;
  }
  .slot-zone.is-empty::after {
    content: '+';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    line-height: 1;
    color: rgba(120, 103, 80, 0.5);
    pointer-events: none;
  }
</style>
