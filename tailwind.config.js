/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // optician's palette: printed-chart ink, lens-edge glass, tortoiseshell
        paper: '#ffffff',
        glass: { DEFAULT: '#e7edeb', deep: '#d6e0dc', soft: '#f2f6f5' },
        ink: { DEFAULT: '#172031', soft: '#2b3446' },
        graphite: '#5e6878',
        mist: '#8c95a3',
        rule: '#d5ddda',
        shell: { DEFAULT: '#9c5b2e', light: '#f4e8dd' },
        danger: '#b4372f',
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        tile: '6px',
        stage: '20px',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        chartIn: {
          '0%': { opacity: '0', filter: 'blur(6px)' },
          '100%': { opacity: '1', filter: 'blur(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'chart-in': 'chartIn 0.7s ease-out both',
      },
    },
  },
  plugins: [],
};
