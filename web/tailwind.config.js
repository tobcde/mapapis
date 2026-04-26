/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        cream: 'var(--cream)',
        coral: 'var(--coral)',
        sun: 'var(--sun)',
        sage: 'var(--sage)',
        mist: 'var(--mist)',
        violet: 'var(--violet)',
      },
      fontFamily: {
        display: ['Geist', 'Inter', '-apple-system', 'system-ui', 'sans-serif'],
        ui: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightish: '-0.03em',
      },
    },
  },
  plugins: [],
};
