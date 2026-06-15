<script>
  import RecipeForm from '$lib/components/RecipeForm.svelte';
  import BackLink from '$lib/components/BackLink.svelte';
  let { data, form } = $props();
</script>

<div class="mb-6">
  <BackLink href="/recipes/{data.recipe.id}" label="Retour à la recette" />
</div>

<header class="text-center mb-12">
  <div class="h-eyebrow mb-2">Modifier · <span class="codice">{data.recipe.code}</span></div>
  <h1 class="h-display text-4xl md:text-5xl italic text-balance">{data.recipe.title}</h1>
</header>

{#if form?.error}
  <div class="card bg-terra-soft/50 border-terra/30 text-umber mb-8 max-w-2xl mx-auto">
    <span class="font-display italic">Erreur : </span>{form.error}
  </div>
{/if}

<div class="max-w-3xl mx-auto">
  <RecipeForm
    recipe={data.recipe}
    ingredients={data.ingredients}
    catalog={data.catalog}
    submitLabel="Enregistrer"
    cancelHref="/recipes/{data.recipe.id}"
  />
</div>
