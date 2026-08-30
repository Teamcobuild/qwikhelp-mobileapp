const plugin = require("tailwindcss/plugin");

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
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".font-regular": {
          fontFamily: "Satoshi-Regular",
          fontWeight: "normal",
        },
        ".font-medium": {
          fontFamily: "Satoshi-Regular",
          fontWeight: "500", // Android might fall back here if the font file doesn't support 500, but Satoshi-Regular often does, or iOS handles it. Better to explicitly use Satoshi-Bold if they want a bold look, or just set it.
        },
        ".font-semibold": {
          fontFamily: "Satoshi-Bold",
          fontWeight: "normal",
        },
        ".font-bold": {
          fontFamily: "Satoshi-Bold",
          fontWeight: "normal",
        },
        ".font-extrabold": {
          fontFamily: "Satoshi-Bold",
          fontWeight: "normal",
        },
        ".font-black": {
          fontFamily: "Satoshi-Bold",
          fontWeight: "normal",
        },
      });
    }),
  ],
}