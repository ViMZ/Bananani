<script>
  import Sprig from '$lib/components/Sprig.svelte';
  let { form } = $props();
</script>

<svelte:head>
  <title>Accedi · Bananani</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center px-4">
  <div class="w-full max-w-md">
    <header class="text-center mb-10">
      <div class="h-eyebrow mb-2">Bananani</div>
      <h1 class="h-display text-5xl md:text-6xl italic">Benvenuto</h1>
      <p class="text-sepia italic mt-3">Connecte-toi pour accéder à ta cucina.</p>
      <div class="flex justify-center mt-5">
        <Sprig width={120} />
      </div>
    </header>

    <form method="POST" class="card space-y-5">
      <div>
        <label class="label" for="user">Utilisateur</label>
        <input
          id="user"
          name="user"
          type="text"
          class="input"
          autocomplete="username"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          required
          value={form?.user ?? ''}
        />
      </div>

      <div>
        <label class="label" for="password">Mot de passe</label>
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

      <button type="submit" class="btn-primary w-full btn-lg">
        Accedi →
      </button>
    </form>

    <p class="text-center text-xs text-sepia italic mt-6">
      Pas de compte ? Les comptes ne sont pas auto-créés.
    </p>
  </div>
</div>
