<script>
  import { onMount, tick } from 'svelte';
  import QRCode from 'qrcode';

  /**
   * Composant "code scannable" : génère un QR Code SVG pour `value`.
   * Le nom du fichier reste Barcode.svelte pour la rétrocompat des imports.
   */
  let {
    value,
    size = 140,
    margin = 1,
    errorCorrection = 'M'
  } = $props();

  let svgHtml = $state('');

  async function render() {
    if (!value) {
      svgHtml = '';
      return;
    }
    try {
      svgHtml = await QRCode.toString(value, {
        type: 'svg',
        margin,
        errorCorrectionLevel: errorCorrection,
        width: size,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch {
      svgHtml = '';
    }
  }

  onMount(render);

  $effect(() => {
    // re-render quand value/size/margin changent
    value;
    size;
    margin;
    tick().then(render);
  });
</script>

<div
  class="inline-block leading-none"
  style="width: {size}px; height: {size}px;"
  aria-label="QR Code {value}"
>
  {@html svgHtml}
</div>

<style>
  div :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
