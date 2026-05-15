<script>
  /**
   * Diviseur orné style ❦ ✦ • pour séparer les sections.
   */
  let { glyph = '✦', tone = 'sepia' } = $props();

  const toneClasses = {
    sepia: 'text-sepia',
    mare: 'text-mare',
    terra: 'text-terra',
    oliva: 'text-oliva',
    limone: 'text-limone'
  };
</script>

<div class="flex items-center gap-4 my-6">
  <span class="flex-1 h-px bg-umber/15"></span>
  <span class="{toneClasses[tone] || 'text-sepia'} text-lg leading-none">{glyph}</span>
  <span class="flex-1 h-px bg-umber/15"></span>
</div>
