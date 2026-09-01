<script>
  let { data, form } = $props();

  const revealed = $derived(form?.created ?? form?.reset ?? null);

  function copy(text) {
    navigator.clipboard?.writeText(text);
  }

  function confirmDelete(event, username) {
    if (!confirm(`Supprimer le compte « ${username} » et toutes ses données (recettes, liste de courses) ? Cette action est irréversible.`)) {
      event.preventDefault();
    }
  }
</script>

<svelte:head>
  <title>Comptes · Admin · Bananani</title>
</svelte:head>

<div class="max-w-3xl mx-auto">
  <header class="flex items-end justify-between gap-4 mb-8">
    <div>
      <div class="h-eyebrow mb-1">Back-office</div>
      <h1 class="h-display text-4xl md:text-5xl italic">Comptes</h1>
    </div>
    <div class="flex items-center gap-2">
      <a href="/" class="btn-ghost btn-sm">← Retour à l’application</a>
      <form method="POST" action="/admin/logout">
        <button type="submit" class="btn-ghost btn-sm">Quitter</button>
      </form>
    </div>
  </header>

  {#if form?.error}
    <div class="mb-6 text-sm italic text-terra bg-terra-soft/40 border border-terra/30 rounded px-4 py-3">
      {form.error}
    </div>
  {/if}

  {#if form?.deleted}
    <div class="mb-6 text-sm italic text-umber bg-sand border border-umber/15 rounded px-4 py-3">
      Compte « {form.deleted} » supprimé.
    </div>
  {/if}

  {#if revealed}
    <div class="card-mare mb-8">
      <div class="h-eyebrow text-panna/70 mb-2">
        {form?.created ? 'Compte créé' : 'Mot de passe réinitialisé'} — à transmettre
      </div>
      <div class="space-y-2 font-mono text-sm">
        <div class="flex items-center justify-between gap-3">
          <span class="text-panna/70">identifiant</span>
          <span class="text-panna text-base">{revealed.username}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-panna/70">mot de passe</span>
          <span class="text-panna text-base tracking-wider">{revealed.password}</span>
        </div>
      </div>
      <button
        type="button"
        class="btn-lemon btn-sm mt-4"
        onclick={() => copy(`${revealed.username} / ${revealed.password}`)}
      >
        Copier
      </button>
      {#if revealed.generated}
        <p class="text-panna/60 text-xs italic mt-3">Mot de passe généré automatiquement.</p>
      {/if}
      <p class="text-panna/60 text-xs italic mt-1">
        Ne sera plus affiché : note-le maintenant.
      </p>
    </div>
  {/if}

  <!-- Création -->
  <section class="card mb-8">
    <h2 class="font-display italic text-2xl text-umber mb-5">Nouveau compte</h2>
    <form method="POST" action="?/create" class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="username">Identifiant</label>
        <input
          id="username"
          name="username"
          type="text"
          class="input"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          placeholder="ex. giulia"
          required
        />
      </div>
      <div>
        <label class="label" for="name">Nom affiché (optionnel)</label>
        <input id="name" name="name" type="text" class="input" placeholder="ex. Giulia" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="password">Mot de passe (optionnel — généré si vide)</label>
        <input
          id="password"
          name="password"
          type="text"
          class="input"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          placeholder="laisser vide pour générer"
        />
      </div>
      <div class="sm:col-span-2">
        <button type="submit" class="btn-primary">Créer le compte</button>
      </div>
    </form>
  </section>

  <!-- Liste -->
  <section class="card">
    <h2 class="font-display italic text-2xl text-umber mb-5">
      Comptes existants
      <span class="text-sepia text-base not-italic">({data.users.length})</span>
    </h2>

    {#if data.users.length === 0}
      <p class="text-sepia italic">Aucun compte pour l'instant.</p>
    {:else}
      <ul class="divide-y divide-umber/10">
        {#each data.users as u (u.id)}
          <li class="py-4 flex flex-wrap items-center gap-x-4 gap-y-3 justify-between">
            <div class="min-w-0">
              <div class="font-medium text-umber">
                {u.username}
                {#if u.displayName}
                  <span class="text-sepia font-normal">· {u.displayName}</span>
                {/if}
              </div>
              <div class="code text-[11px]">créé le {u.createdAt}</div>
            </div>

            <div class="grid w-full gap-2 sm:w-auto sm:flex sm:items-center">
              <form method="POST" action="?/passwd" class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
                <input type="hidden" name="id" value={u.id} />
                <input
                  name="password"
                  type="text"
                  class="input min-w-0 py-1.5 px-3 text-sm sm:w-40"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck="false"
                  placeholder="nouveau (ou vide)"
                />
                <button type="submit" class="btn-secondary btn-sm whitespace-nowrap">
                  Réinit. mdp
                </button>
              </form>

              <form method="POST" action="?/delete" class="w-full sm:w-auto" onsubmit={(e) => confirmDelete(e, u.username)}>
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" class="btn-danger btn-sm w-full sm:w-auto">Supprimer</button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
