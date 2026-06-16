<script>
  let { data } = $props();
  let { cards } = $derived(data);

  function print() {
    window.print();
  }
</script>

<div class="no-print flex items-center justify-between gap-4 mb-8">
  <a href="/recipes" class="btn-secondary">← Retour</a>
  <p class="text-sepia italic text-sm">
    {cards.length} fiche{cards.length > 1 ? 's' : ''} · 8 par feuille A4
  </p>
  <button class="btn-primary" onclick={print} disabled={cards.length === 0}>🍋 Imprimer</button>
</div>

{#if cards.length === 0}
  <p class="no-print text-center text-sepia italic py-20">
    Aucune recette à imprimer.
  </p>
{:else}
  <div class="planche">
    {#each cards as c}
      <div class="mini">
        <!-- traits de coupe : 2 coins via .mini, 2 via .crop = 4 angles -->
        <div class="crop"></div>

        <div class="frame">
          <span class="m-lemon">🍋</span>
          <div class="m-title">
            <h2 class="font-display italic text-umber leading-[1.05] m-title-text">{c.title}</h2>
            {#if c.description}
              <p class="font-display italic text-sepia m-desc">{c.description}</p>
            {/if}
          </div>

          <div class="m-main">
            {#if c.photoPath}
              <img class="m-photo" src={c.photoPath} alt={c.title} />
            {:else}
              <div class="m-photo m-photo--empty">
                <span class="font-display italic text-4xl text-sepia">N°</span>
              </div>
            {/if}
            <div class="m-aside">
              <div class="m-qr">{@html c.qrSvg}</div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .planche {
    display: flex;
    flex-wrap: wrap;
    width: 210mm;
    box-sizing: border-box;
    padding: 8mm;
    margin: 0 auto;
    background: #fff;
  }

  .mini {
    box-sizing: border-box;
    width: 97mm;
    height: 70mm;
    padding: 6mm;
    position: relative;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .frame {
    position: relative;
    height: 100%;
    border: 0.3mm solid rgba(31, 86, 115, 0.4); /* mare/40 — cadre déco interne */
    box-sizing: border-box;
    padding: 4mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #fbf6ea; /* panna */
  }

  .m-lemon {
    position: absolute;
    top: 2mm;
    right: 2.5mm;
    font-size: 13px;
    line-height: 1;
  }

  .m-title {
    flex: none;
  }

  .m-title-text {
    font-size: 15px;
    padding-right: 6mm; /* laisse la place au citron dans le coin */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .m-desc {
    font-size: 9px;
    line-height: 1.25;
    margin-top: 1.5mm;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .m-main {
    flex: 1;
    min-height: 0; /* laisse la photo se contraindre dans le flex */
    margin-top: 2.5mm;
    display: flex;
    gap: 4mm;
    align-items: stretch;
  }

  .m-photo {
    flex: 1;
    min-width: 0;
    height: 100%;
    object-fit: cover;
    border: 0.3mm solid rgba(61, 47, 37, 0.15);
    background: #fff;
  }

  .m-photo--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e8dec8; /* sand */
  }

  .m-aside {
    flex: none;
    width: 24mm;
    align-self: stretch; /* conteneur QR = pleine hauteur (= hauteur photo) */
    display: flex;
    align-items: center;
    justify-content: center; /* QR centré dans le conteneur */
  }

  .m-qr {
    width: 24mm;
    height: 24mm;
    flex: none;
    background: #fff;
  }

  .m-qr :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Traits de coupe (4 coins) */
  .mini::before,
  .mini::after,
  .crop::before,
  .crop::after {
    content: '';
    position: absolute;
    width: 4mm;
    height: 4mm;
    pointer-events: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mini::before {
    top: 0;
    left: 0;
    border-top: 0.3mm solid #000;
    border-left: 0.3mm solid #000;
  }
  .mini::after {
    bottom: 0;
    right: 0;
    border-bottom: 0.3mm solid #000;
    border-right: 0.3mm solid #000;
  }
  .crop {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .crop::before {
    top: 0;
    right: 0;
    border-top: 0.3mm solid #000;
    border-right: 0.3mm solid #000;
  }
  .crop::after {
    bottom: 0;
    left: 0;
    border-bottom: 0.3mm solid #000;
    border-left: 0.3mm solid #000;
  }

  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    :global(body) {
      background: #fff !important;
      background-image: none !important;
    }
    :global(main) {
      padding: 0 !important;
      max-width: 100% !important;
    }
    .planche {
      padding: 8mm;
      margin: 0;
    }
    /* Forcer le rendu des fonds + traits noirs (sinon Chromium les supprime). */
    .planche,
    .mini,
    .frame,
    .m-qr,
    .m-qr :global(svg) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* Coupe explicite tous les 8 (renfort de la hauteur fixe 4×70mm). */
    .mini:nth-child(8n) {
      page-break-after: always;
      break-after: page;
    }
    .mini:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
</style>
