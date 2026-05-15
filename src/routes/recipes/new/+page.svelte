<script>
  import RecipeForm from '$lib/components/RecipeForm.svelte';
  let { form } = $props();
</script>

<h1 class="text-2xl font-display font-bold mb-4">Nouvelle recette</h1>

{#if form?.error}
  <div class="card bg-red-50 border-red-200 text-red-800 mb-4">⚠️ {form.error}</div>
{/if}

<RecipeForm submitLabel="Créer la recette" cancelHref="/recipes" />
