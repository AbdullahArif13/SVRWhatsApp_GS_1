/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1d6fe0",
          hover: "#1a5fc0",
          active: "#8a8f98",
          "active-hover": "#75797f",
          red: "#e63946",
        },
      },
    },
  },
  plugins: [],
};
