<script>
  import '../app.css';
  import { page } from '$app/stores';

  let { children } = $props();

  const nav = [
    { href: '/', label: 'Accueil', icon: '🏠' },
    { href: '/recipes', label: 'Recettes', icon: '📖' },
    { href: '/scan', label: 'Scanner', icon: '📷' },
    { href: '/shopping', label: 'Courses', icon: '🛒' }
  ];

  function isActive(href) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="min-h-screen flex flex-col">
  <header class="no-print bg-banana-400 border-b-4 border-banana-600 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
      <a href="/" class="text-2xl font-display font-bold tracking-tight">
        🍌 Bananani
      </a>
      <nav class="flex gap-1">
        {#each nav as item}
          <a
            href={item.href}
            class="px-3 py-2 rounded-lg font-medium transition-colors {isActive(item.href)
              ? 'bg-stone-900 text-banana-200'
              : 'hover:bg-banana-300'}"
          >
            <span class="md:hidden">{item.icon}</span>
            <span class="hidden md:inline">{item.icon} {item.label}</span>
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
    {@render children()}
  </main>

  <footer class="no-print text-center text-xs text-stone-500 py-4">
    Bananani · stockage perso de recettes
  </footer>
</div>
