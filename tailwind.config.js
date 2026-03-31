/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#1a1008",
        accent: "#c8861a",
        cream: "#f5ead8",
        sub: "#a08860",
        card: "rgba(255,255,255,0.04)",
        "card-border": "rgba(255,180,60,0.12)",
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
