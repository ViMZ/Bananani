/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte}'],
  theme: {
    extend: {
      colors: {
        // Murs limestone / papier crème (fonds)
        linen: '#F4ECDB',
        panna: '#FBF6EA',
        sand: '#E8DEC8',

        // Encres (textes)
        umber: '#3D2F25',
        sepia: '#8A7560',
        ash: '#B8AC98',

        // Mer Méditerranée
        mare: {
          DEFAULT: '#1F5673',
          deep: '#143E54',
          soft: '#B8D0DD'
        },
        // Terre cuite des toits
        terra: {
          DEFAULT: '#B5654F',
          soft: '#E8C9BD'
        },
        // Oliveraie
        oliva: {
          DEFAULT: '#7F8B4F',
          soft: '#C9CFA8'
        },
        // Citron de Sorrente
        limone: {
          DEFAULT: '#E5B947',
          soft: '#F5E4A8'
        }
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        script: ['"Caveat"', 'cursive']
      },
      letterSpacing: {
        editorial: '0.04em',
        wider: '0.08em',
        widest: '0.16em'
      },
      boxShadow: {
        soft: '0 4px 20px -10px rgba(31, 86, 115, 0.25)',
        'soft-lg': '0 12px 40px -16px rgba(31, 86, 115, 0.3)',
        seal: '0 2px 0 rgba(61, 47, 37, 0.15)',
        card: '0 1px 0 rgba(61, 47, 37, 0.08), 0 8px 24px -12px rgba(31, 86, 115, 0.15)'
      },
      borderRadius: {
        DEFAULT: '4px',
        soft: '8px',
        card: '6px'
      },
      backgroundImage: {
        // Rayures cabana subtiles (transparent + bleu doux)
        stripes: 'repeating-linear-gradient(45deg, transparent 0 16px, rgba(31, 86, 115, 0.05) 16px 17px)',
        // Rayures parasol horizontales (limone)
        awning: 'repeating-linear-gradient(180deg, #F5E4A8 0 24px, #FBF6EA 24px 48px)'
      }
    }
  },
  plugins: []
};
