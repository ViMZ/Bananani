<script>
  import { onMount, tick } from 'svelte';

  let {
    value,
    format = 'CODE128',
    width = 2,
    height = 80,
    displayValue = true,
    margin = 6
  } = $props();

  let svgEl;

  async function render() {
    if (!svgEl || !value) return;
    const JsBarcode = (await import('jsbarcode')).default;
    JsBarcode(svgEl, value, { format, width, height, displayValue, margin, fontSize: 14 });
  }

  onMount(() => {
    render();
  });

  $effect(() => {
    // re-render when value changes
    value;
    tick().then(render);
  });
</script>

<svg bind:this={svgEl} aria-label="Code-barres {value}"></svg>
