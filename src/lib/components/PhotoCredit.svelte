<script>
  let { recipe, image, printOnly = false, compact = false } = $props();
  const source = $derived(image?.source ?? recipe?.photoSource);
  const credit = $derived(image ? `${image.title} — ${image.author} — ${image.license}` : recipe?.photoCredit);
</script>

{#snippet attribution()}
  <a href={source} target="_blank" rel="noreferrer" class="underline underline-offset-2">{credit}</a> · cadrage adapté
{/snippet}

{#if credit && source}
  {#if printOnly}
    <p class="mt-1 hidden break-words text-[10px] leading-snug text-umber print:block" class:compact>
      {@render attribution()}
    </p>
  {:else}
    <details class="no-print pointer-events-none absolute inset-0 open:z-10">
      <summary aria-label="Crédits de la photo" title="Crédits de la photo"
        class="pointer-events-auto absolute right-2 top-2 grid size-8 cursor-pointer place-items-center rounded-full border border-umber/15 bg-panna text-umber shadow-soft hover:bg-linen focus-visible:outline focus-visible:outline-2 focus-visible:outline-mare">
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      </summary>
      <p class="pointer-events-auto absolute inset-x-1 top-11 max-h-32 overflow-auto rounded border border-umber/15 bg-panna p-2.5 text-xs leading-snug text-umber shadow-soft-lg [overflow-wrap:anywhere]">
        {@render attribution()}
      </p>
    </details>
  {/if}
{/if}

<style>
  summary { list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .compact { font-size: 8px; line-height: 1.1; flex: none; }
</style>
