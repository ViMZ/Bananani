<script>
  let { recipe, compact = false } = $props();
</script>

{#if recipe.photoCredit && recipe.photoSource}
  <p class="text-[10px] text-sepia mt-1 break-words leading-relaxed" class:compact>
    <a href={recipe.photoSource} target="_blank" rel="noreferrer" class="underline">{recipe.photoCredit}</a> · cadrage adapté
  </p>
{/if}

<style>
  .compact { font-size: 6px; line-height: 1.1; margin-top: 2px; flex: none; }
</style>
