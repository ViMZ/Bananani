<script>
  import RecipeForm from '$lib/components/RecipeForm.svelte';
  import Sprig from '$lib/components/Sprig.svelte';
  import BackLink from '$lib/components/BackLink.svelte';
  let { form } = $props();
</script>

<div class="mb-6">
  <BackLink href="/recipes" label="Retour au ricettario" />
</div>

<header class="text-center mb-12">
  <div class="h-eyebrow mb-2">Nouvelle recette</div>
  <h1 class="h-display text-5xl md:text-6xl italic">Une nouvelle recette</h1>
  <div class="flex justify-center mt-4">
    <Sprig width={100} />
  </div>
</header>

{#if form?.error}
  <div class="card bg-terra-soft/50 border-terra/30 text-umber mb-8 max-w-2xl mx-auto">
    <span class="font-display italic">Erreur : </span>{form.error}
  </div>
{/if}

<div class="max-w-3xl mx-auto">
  <RecipeForm submitLabel="Créer la recette" cancelHref="/recipes" />
</div>
