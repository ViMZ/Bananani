<script>
  import '../app.css';
  import { page } from '$app/stores';

  let { children, data } = $props();

  let userLabel = $derived(data?.user ? data.user.displayName || data.user.username : '');

  const nav = [
    { href: '/', label: 'Accueil' },
    { href: '/recipes', label: 'Ricettario' },
    { href: '/planning', label: 'Semaine' },
    { href: '/scan', label: 'Scanner' },
    { href: '/shopping', label: 'Courses' }
  ];

  let adminTimer;
  let openedAdmin = false;

  function openAdmin() {
    openedAdmin = true;
    window.location.assign('/admin/login');
  }

  function onLogoPointerDown(event) {
    if (event.pointerType !== 'touch') return;
    openedAdmin = false;
    adminTimer = window.setTimeout(openAdmin, 800);
  }

  function cancelAdminTimer() {
    if (adminTimer) window.clearTimeout(adminTimer);
    adminTimer = undefined;
  }

  function onLogoClick(event) {
    cancelAdminTimer();
    if (openedAdmin) {
      return;
    }
    if (event.altKey) {
      openAdmin();
      return;
    }
    window.location.assign('/');
  }

  function onLogoKeydown(event) {
    if (event.altKey && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openAdmin();
    }
  }

  function isActive(href) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }

  // Pages "auth" et back-office : pas de nav applicative, juste le contenu.
  let isAuthPage = $derived(
    $page.url.pathname === '/login' || $page.url.pathname.startsWith('/admin')
  );
</script>

<div class="app-shell min-h-screen flex flex-col {isAuthPage ? '' : 'pb-20 md:pb-0'}">
  {#if !isAuthPage}
    <!-- Header desktop -->
    <header class="no-print bg-linen/80 backdrop-blur-sm border-b border-umber/15 sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-6">
        <button
          type="button"
          class="group inline-flex items-center gap-2 bg-transparent border-0 p-0 text-left"
          aria-label="Bananani — Accueil"
          onpointerdown={onLogoPointerDown}
          onpointerup={cancelAdminTimer}
          onpointercancel={cancelAdminTimer}
          onpointerleave={cancelAdminTimer}
          oncontextmenu={(event) => event.preventDefault()}
          onclick={onLogoClick}
          onkeydown={onLogoKeydown}
        >
          <span class="text-limone text-lg leading-none">✦</span>
          <span class="font-display italic text-3xl md:text-[28px] leading-none text-umber tracking-tight">
            Bananani
          </span>
        </button>

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

        <!-- Logout mobile (icône discrète) -->
        <form method="POST" action="/logout" class="md:hidden">
          <button
            type="submit"
            class="p-2 -m-2 text-sepia hover:text-terra transition-colors"
            aria-label="Déconnexion"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  {/if}

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-10 md:py-16">
    {@render children()}
  </main>

  {#if !isAuthPage}
    <!-- Bottom nav mobile -->
    <nav class="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-panna/95 backdrop-blur border-t border-umber/15">
      <div class="grid grid-cols-5">
        {#each nav as item}
          <a
            href={item.href}
            class="flex flex-col items-center justify-center py-3 font-sans text-[11px] tracking-wide transition-colors
                   {isActive(item.href) ? 'text-mare font-medium' : 'text-sepia'}"
          >
            {#if isActive(item.href)}
              <span class="text-mare text-xs leading-none mb-1">✦</span>
            {:else}
              <span class="text-sepia opacity-40 text-xs leading-none mb-1" aria-hidden="true">✦</span>
            {/if}
            {item.label}
          </a>
        {/each}
      </div>
    </nav>

    <footer class="no-print border-t border-umber/15 mt-16 py-6 hidden md:block">
      <div class="max-w-6xl mx-auto px-8 flex items-center justify-between text-xs text-sepia">
        <span class="font-display italic text-base">Bananani</span>
        <div class="flex items-center gap-5">
          {#if userLabel}
            <span class="font-mono tracking-wider">{userLabel}</span>
          {/if}
          <form method="POST" action="/logout">
            <button type="submit" class="font-mono tracking-wider uppercase hover:text-terra transition-colors">
              Déconnexion
            </button>
          </form>
          <span class="font-mono tracking-wider uppercase">la dolce vita · v0.1</span>
        </div>
      </div>
    </footer>
  {/if}
</div>
