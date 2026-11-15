/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Major Mono Display"', 'monospace'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        palette: {
          cream: "#D9CEC5",
          charcoal: "#3B3B40",
          slate: "#7F7B8C",
          ochre: "#A6948A",
          obsidian: "#0D0D0D",
          // Alias heredados para compatibilidad
          blue: "#7F7B8C",
          red: "#E4002B",
          amber: "#D9CEC5",
          white: "#FBFBFB",
          dark: "#0D0D0D",
        },
        lunarPalette: {
          50: "#FAF9F7",
          100: "#F2EFEA",
          200: "#D9CEC5",
          300: "#C0B2A6",
          400: "#A6948A",
          500: "#7F7B8C",
          600: "#5D5969",
          700: "#3B3B40",
          800: "#222226",
          900: "#141416",
          950: "#0D0D0D",
        },
        space: {
          950: "#0D0D0D",
          900: "#141416",
          850: "#222226",
          800: "#3B3B40",
        },
        solar: {
          light: "#FFB03A",
          DEFAULT: "#FF9F1C",
          dark: "#D97706",
        },
        lunar: {
          psr: "#06B6D4",
          ice: "#67E8F9",
        },
      },
    },
  },
  plugins: [],
}
