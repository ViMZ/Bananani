<script>
  /**
   * Médaillon de style menu de trattoria : double cadre, fond crème,
   * tampon de code (BAN-XXXX) en mono sépia.
   */
  let { code, label = 'Code', size = 110 } = $props();
</script>

<div
  class="inline-flex flex-col items-center justify-center gap-1 bg-panna border border-umber/40 rounded-full p-3 shadow-seal"
  style="width: {size}px; height: {size}px; box-shadow: inset 0 0 0 3px #FBF6EA, inset 0 0 0 4px rgba(61,47,37,0.35), 0 2px 0 rgba(61,47,37,0.15);"
>
  <span class="font-sans text-[9px] uppercase tracking-widest text-sepia font-medium">{label}</span>
  <span class="font-mono text-xs tracking-wider text-umber font-medium">{code}</span>
  <span class="text-mare text-base leading-none -mt-0.5">✦</span>
</div>
