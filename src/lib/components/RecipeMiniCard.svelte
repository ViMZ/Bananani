<script>
  /**
   * Carte recette simplifiée : miniature + nom. Réutilisée dans les cases du planning
   * et dans le tiroir de recettes. `recipe.photoPath` est déjà un chemin web (/uploads/…),
   * aucune transformation nécessaire ; placeholder si absent.
   * @type {{ recipe: { title: string, photoPath?: string | null } }}
   */
  let { recipe } = $props();
</script>

<div
  class="flex items-center gap-2.5 bg-panna border border-umber/15 rounded-xl p-1.5 pr-3 shadow-card select-none"
>
  {#if recipe.photoPath}
    <img
      src={recipe.photoPath}
      alt=""
      draggable="false"
      class="w-11 h-11 rounded-lg object-cover flex-shrink-0 pointer-events-none"
    />
  {:else}
    <div class="w-11 h-11 rounded-lg bg-sand flex items-center justify-center flex-shrink-0">
      <span class="font-display italic text-lg text-sepia leading-none">N°</span>
    </div>
  {/if}
  <span class="text-sm font-medium text-umber leading-tight line-clamp-2">{recipe.title}</span>
</div>
