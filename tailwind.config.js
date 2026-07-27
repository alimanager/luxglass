/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette "magazine années 80" : rouge vermillon, encre brune, moutarde
        primary: {
          50: '#fdf3f1',
          100: '#fbe5e0',
          200: '#f6c8bf',
          300: '#efa08f',
          400: '#e56e55',
          500: '#d94a2b',
          600: '#c23a1c',
          700: '#a02f17',
          800: '#842a17',
          900: '#6e2617',
          950: '#3b1109',
        },
        secondary: {
          50: '#f8f6f2',
          100: '#efeae2',
          200: '#ddd5c7',
          300: '#c4b8a4',
          400: '#a99a82',
          500: '#93826a',
          600: '#7d6c56',
          700: '#665847',
          800: '#55493c',
          900: '#483e34',
          950: '#262019',
        },
        accent: {
          50: '#fbf8eb',
          100: '#f6eec9',
          200: '#eeda8f',
          300: '#e5c355',
          400: '#dcab2f',
          500: '#c98f1f',
          600: '#ad7118',
          700: '#8a5417',
          800: '#73441a',
          900: '#62391b',
          950: '#391d0c',
        },
        ink: '#221a14',
        paper: '#f4ecdc',
        cream: '#faf5e9',
        teal: '#0e7268',
      },
      fontFamily: {
        sans: ['Archivo', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        display: ['Archivo Black', 'Archivo', 'sans-serif'],
        mono: ['Courier Prime', 'monospace'],
      },
      boxShadow: {
        hard: '4px 4px 0 0 #221a14',
        'hard-sm': '2px 2px 0 0 #221a14',
        'hard-lg': '8px 8px 0 0 #221a14',
        'hard-accent': '4px 4px 0 0 #dcab2f',
        'hard-red': '4px 4px 0 0 #c23a1c',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        marquee: 'marquee 22s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      borderRadius: {
        // Esthétique print : tout est carré, seul "full" survit (pastilles, points)
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
