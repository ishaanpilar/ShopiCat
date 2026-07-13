/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0a0a0b',
          900: '#121214',
          800: '#1b1c20',
          700: '#26272c',
          600: '#33343a',
        },
        brand: {
          DEFAULT: '#D93A32',
          soft: 'rgba(217,58,50,0.12)',
        },
      },
    },
  },
  plugins: [],
};
