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
          blue: "#0032A0",
          red: "#E4002B",
          amber: "#FF9F1C",
          white: "#FBFBFB",
          dark: "#0F1108",
        },
        space: {
          950: "#0F1108",
          900: "#08090C",
          850: "#0D121D",
          800: "#151D2E",
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
