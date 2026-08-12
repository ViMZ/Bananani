<script>
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Admin · Bananani</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center px-4">
  <div class="w-full max-w-md">
    <header class="text-center mb-10">
      <div class="h-eyebrow mb-2">Bananani</div>
      <h1 class="h-display text-5xl md:text-6xl italic">Back-office</h1>
      <p class="text-sepia italic mt-3">Gestion des comptes utilisateurs.</p>
    </header>

    {#if !data.enabled}
      <div class="card text-center space-y-3">
        <p class="text-terra italic">Le back-office est désactivé.</p>
        <p class="text-sm text-sepia">
          Définis la variable d'environnement <span class="code">ADMIN_PASSWORD</span> puis redémarre
          le serveur.
        </p>
      </div>
    {:else}
      <form method="POST" class="card space-y-5">
        <div>
          <label class="label" for="password">Mot de passe admin</label>
          <input
            id="password"
            name="password"
            type="password"
            class="input"
            autocomplete="current-password"
            required
          />
        </div>

        {#if form?.error}
          <div class="text-sm italic text-terra bg-terra-soft/40 border border-terra/30 rounded px-3 py-2">
            {form.error}
          </div>
        {/if}

        <button type="submit" class="btn-primary w-full btn-lg">Entrer →</button>
      </form>
    {/if}
  </div>
</div>
