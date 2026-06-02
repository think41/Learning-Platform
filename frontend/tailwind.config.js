/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Replit-style coral-orange (centered on #F26207)
        brand: {
          50:  '#fff5ef',
          100: '#ffe6d6',
          200: '#ffc9a3',
          300: '#ffac70',
          400: '#ff8a3d',
          500: '#fb6f1c',
          600: '#f26207',
          700: '#c44e06',
          800: '#9b3d07',
        },
        // Warm page backgrounds (white cards float on top of these)
        cream: {
          DEFAULT: '#fbf6ef',
          100:     '#f6efe6',
          200:     '#ece3d8',
        },
        // Remap the cool default gray to a warm neutral (stone) so every
        // existing gray-* border / surface / text becomes subtly warm.
        gray: {
          50:  '#fafaf9',
          100: '#f5f4f2',
          200: '#e9e6e1',
          300: '#d7d2cb',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
    },
  },
  plugins: [],
}
