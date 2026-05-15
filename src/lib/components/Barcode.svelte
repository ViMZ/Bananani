<script>
  import { onMount, tick } from 'svelte';
  import QRCode from 'qrcode';

  /**
   * Composant "code scannable" : affiche un QR Code SVG.
   * Si `svg` est fourni (SVG string pré-rendu côté serveur), l'utilise directement.
   * Sinon, génère côté client à partir de `value`.
   * Le fichier reste Barcode.svelte pour rétrocompat des imports.
   */
  let {
    value,
    svg = '',
    size = 140,
    margin = 1,
    errorCorrection = 'M'
  } = $props();

  let svgHtml = $state(svg);

  async function render() {
    if (svg) {
      svgHtml = svg;
      return;
    }
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
    value;
    svg;
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
