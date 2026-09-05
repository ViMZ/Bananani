<script>
  // Autocomplétion maison qui remplace le <datalist> natif : on maîtrise la
  // hauteur (bornée + scroll interne) et le positionnement, ce que le datalist
  // natif ne permet pas — sur mobile il chevauchait le clavier et changeait de
  // taille à chaque fois. Rend un vrai <input name=...> pour rester compatible
  // avec la soumission FormData de SvelteKit.
  let {
    value = $bindable(''),
    options = [],
    name,
    id = undefined,
    disabled = false,
    showAllOnFocus = false,
    placeholder = '',
    required = false,
    inputClass = 'input',
    // strict : la valeur DOIT appartenir à `options`. Toute saisie hors liste est
    // effacée à la perte de focus (sélection dans une liste fermée, pas free-text).
    strict = false,
    onselect = () => {}
  } = $props();

  let open = $state(false);
  let activeIndex = $state(-1);
  let filtering = $state(false);
  let wrapperEl;
  let inputEl;

  const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Suggestions filtrées par sous-chaîne (insensible casse/accents), plafonnées.
  let filtered = $derived.by(() => {
    const q = showAllOnFocus && !filtering ? '' : norm(value).trim();
    const list = q ? options.filter((o) => norm(o).includes(q)) : options;
    return list.slice(0, 50);
  });

  function choose(opt) {
    value = opt;
    open = false;
    activeIndex = -1;
    onselect();
  }

  function onKeydown(e) {
    if (!open) {
      if (e.key === 'ArrowDown') open = true;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      choose(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      open = false;
      activeIndex = -1;
    }
  }

  function onFocus() {
    open = true;
    filtering = false;
    // Sur mobile : remonter le champ vers le haut du viewport pour dégager de la
    // place sous le clavier virtuel et que la liste reste visible.
    setTimeout(() => {
      if (!inputEl) return;
      const rect = inputEl.getBoundingClientRect();
      const top = window.scrollY + rect.top - window.innerHeight * 0.25;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 50);
  }

  function onWindowPointerdown(e) {
    if (wrapperEl && !wrapperEl.contains(e.target)) {
      open = false;
      activeIndex = -1;
    }
  }

  // En mode strict, à la perte de focus : on recale la saisie sur l'option qui
  // correspond (insensible casse/accents), sinon on l'efface. Une valeur vide
  // reste autorisée (= « aucune unité » / « rayon non renseigné »).
  function onBlur() {
    if (!strict || !value) return;
    const q = norm(value).trim();
    const match = options.find((o) => norm(o).trim() === q);
    if (value !== (match ?? '')) {
      value = match ?? '';
      onselect();
    }
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} />

<div class="relative" bind:this={wrapperEl}>
  <input
    bind:this={inputEl}
    class={inputClass}
    {name}
    {id}
    {disabled}
    {placeholder}
    {required}
    autocomplete="off"
    bind:value
    onfocus={onFocus}
    onclick={() => { if (!open) filtering = false; open = true; }}
    oninput={() => { open = true; filtering = true; activeIndex = -1; }}
    onchange={() => onselect()}
    onblur={onBlur}
    onkeydown={onKeydown}
  />

  {#if open && !disabled && filtered.length > 0}
    <ul class="combobox-list">
      {#each filtered as opt, i (opt)}
        <li>
          <!-- Le clic est annulé lors d'un défilement tactile.
               mousedown conserve le focus sans bloquer le geste tactile. -->
          <button
            type="button"
            class="combobox-option {i === activeIndex ? 'is-active' : ''}"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => choose(opt)}
          >{opt}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .combobox-list {
    position: absolute;
    z-index: 30;
    left: 0;
    top: calc(100% + 4px);
    min-width: 100%;
    width: max-content;
    max-width: min(85vw, 22rem);
    max-height: min(50vh, 16rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    background: #fbf6ea;
    border: 1px solid rgb(61 47 37 / 0.2);
    border-radius: 0.25rem;
    box-shadow: 0 8px 24px rgb(61 47 37 / 0.18);
    padding: 0.25rem;
  }
  .combobox-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.95rem;
    color: rgb(61 47 37 / 0.95);
    cursor: pointer;
  }
  .combobox-option:hover,
  .combobox-option.is-active {
    background: rgb(61 47 37 / 0.07);
  }
</style>
