// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        secondary: "#2BB673",
        danger: "#E53935",
        regularorange: "#FF7F32",
        surface: "#A1A1A1",
        surfacedark: "#333333",
      },
      fontFamily: {
        regular: ["Satoshi-Regular"],
        bold: ["Satoshi-Bold"],
      },
    },
  },
  plugins: [],
}