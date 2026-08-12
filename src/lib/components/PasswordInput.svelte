<script>
  /**
   * Champ mot de passe avec bouton « œil » pour afficher/masquer.
   * Générique : tous les attributs passés (id, name, placeholder, autocomplete,
   * required…) sont transmis à l'`<input>`. Le `type` est piloté ici.
   * @type {{ class?: string, [key: string]: any }}
   */
  let { class: klass = 'input', ...rest } = $props();

  let visible = $state(false);
</script>

<div class="relative">
  <input {...rest} type={visible ? 'text' : 'password'} class="{klass} pr-11" />
  <button
    type="button"
    class="absolute inset-y-0 right-0 flex items-center px-3 text-sepia hover:text-umber transition-colors"
    onclick={() => (visible = !visible)}
    aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    aria-pressed={visible}
    title={visible ? 'Masquer' : 'Afficher'}
  >
    {#if visible}
      <!-- œil barré -->
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    {:else}
      <!-- œil -->
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    {/if}
  </button>
</div>
