<script>
  let { href, label = 'Retour' } = $props();
</script>

<a
  href={href}
  class="inline-flex items-center gap-1.5 text-sm text-sepia hover:text-mare transition-colors group no-print"
>
  <svg
    class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
  <span>{label}</span>
</a>
