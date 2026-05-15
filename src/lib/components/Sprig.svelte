<script>
  /**
   * Petite branche d'olivier décorative en SVG inline.
   * Orientable via prop `flip` (miroir horizontal).
   */
  let { width = 90, flip = false, color = '#7F8B4F' } = $props();
</script>

<svg
  viewBox="0 0 200 60"
  width={width}
  height={width * 0.3}
  class="inline-block pointer-events-none select-none"
  style={flip ? 'transform: scaleX(-1);' : ''}
  aria-hidden="true"
>
  <!-- tige principale -->
  <path
    d="M 8 30 Q 60 28 100 30 T 192 30"
    fill="none"
    stroke={color}
    stroke-width="1.2"
    stroke-linecap="round"
  />
  <!-- feuilles paire 1 (gauche) -->
  <ellipse cx="30" cy="22" rx="11" ry="3.2" transform="rotate(-22 30 22)" fill={color} opacity="0.85" />
  <ellipse cx="34" cy="40" rx="11" ry="3.2" transform="rotate(20 34 40)" fill={color} opacity="0.85" />
  <!-- paire 2 -->
  <ellipse cx="68" cy="20" rx="13" ry="3.6" transform="rotate(-18 68 20)" fill={color} opacity="0.85" />
  <ellipse cx="72" cy="42" rx="13" ry="3.6" transform="rotate(22 72 42)" fill={color} opacity="0.85" />
  <!-- paire 3 -->
  <ellipse cx="108" cy="18" rx="14" ry="3.8" transform="rotate(-16 108 18)" fill={color} opacity="0.9" />
  <ellipse cx="112" cy="44" rx="14" ry="3.8" transform="rotate(20 112 44)" fill={color} opacity="0.9" />
  <!-- paire 4 -->
  <ellipse cx="148" cy="20" rx="13" ry="3.6" transform="rotate(-22 148 20)" fill={color} opacity="0.85" />
  <ellipse cx="152" cy="42" rx="13" ry="3.6" transform="rotate(24 152 42)" fill={color} opacity="0.85" />
  <!-- bourgeon de bout -->
  <ellipse cx="184" cy="30" rx="9" ry="2.6" transform="rotate(-4 184 30)" fill={color} />
  <!-- olives -->
  <circle cx="56" cy="32" r="2.5" fill="#3D2F25" opacity="0.7" />
  <circle cx="124" cy="34" r="2.8" fill="#3D2F25" opacity="0.7" />
  <circle cx="160" cy="28" r="2.4" fill="#3D2F25" opacity="0.6" />
</svg>
