<script>
  import '../app.css';
  import { page } from '$app/stores';

  let { children } = $props();

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/recipes', label: 'Ricettario' },
    { href: '/scan', label: 'Scansiona' },
    { href: '/shopping', label: 'Lista' }
  ];

  function isActive(href) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="min-h-screen flex flex-col pb-20 md:pb-0">
  <!-- Header desktop -->
  <header class="no-print bg-linen/80 backdrop-blur-sm border-b border-umber/15 sticky top-0 z-30">
    <div class="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-6">
      <a href="/" class="group inline-flex items-center gap-2">
        <span class="text-limone text-lg leading-none">✦</span>
        <span class="font-display italic text-3xl md:text-[28px] leading-none text-umber tracking-tight">
          Bananani
        </span>
      </a>

      <!-- Nav desktop -->
      <nav class="hidden md:flex items-center gap-7">
        {#each nav as item}
          <a
            href={item.href}
            class="font-sans text-sm transition-colors relative
                   {isActive(item.href)
                     ? 'text-umber font-medium'
                     : 'text-sepia hover:text-umber'}"
          >
            {item.label}
            {#if isActive(item.href)}
              <span class="absolute -bottom-1.5 left-0 right-0 h-px bg-mare"></span>
            {/if}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-10 md:py-16">
    {@render children()}
  </main>

  <!-- Bottom nav mobile -->
  <nav class="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-panna/95 backdrop-blur border-t border-umber/15">
    <div class="grid grid-cols-4">
      {#each nav as item}
        <a
          href={item.href}
          class="flex flex-col items-center justify-center py-3 font-sans text-[11px] tracking-wide transition-colors
                 {isActive(item.href) ? 'text-mare font-medium' : 'text-sepia'}"
        >
          {#if isActive(item.href)}
            <span class="text-mare text-xs leading-none mb-1">✦</span>
          {:else}
            <span class="opacity-0 text-xs leading-none mb-1">·</span>
          {/if}
          {item.label}
        </a>
      {/each}
    </div>
  </nav>

  <footer class="no-print border-t border-umber/15 mt-16 py-6 hidden md:block">
    <div class="max-w-6xl mx-auto px-8 flex items-center justify-between text-xs text-sepia">
      <span class="font-display italic text-base">Bananani</span>
      <span class="font-mono tracking-wider uppercase">la dolce vita · v0.1</span>
    </div>
  </footer>
</div>
