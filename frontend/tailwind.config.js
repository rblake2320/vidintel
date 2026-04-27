/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F0E8D5",
        "paper-card": "#E8DFC8",
        "paper-border": "#CEC6B0",
        ink: "#141210",
        "ink-card": "#1E1A16",
        "ink-border": "#2A2620",
        accent: "#C4532A",
        "accent-hover": "#A84424",
        muted: "#8A7D6E",
        brand: {
          50: "#fdf3ef",
          100: "#fae4da",
          500: "#C4532A",
          600: "#A84424",
          700: "#8C381E",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
      animation: {
        "slide-in": "slideIn 0.25s ease-out",
        "fade-in": "fadeIn 0.15s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

module.exports = config;
