import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors.js";

const brandBrown = "#722F37";
const white = "#FFFFFF";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: brandBrown,
        "primary-dark": brandBrown,
        "primary-soft": white,
        "background-light": white,
        "background-dark": white,
        "surface-muted": brandBrown,
        cream: white,
        "cream-light": white,
        "cream-text": white,
        wine: brandBrown,
        "wine-deep": brandBrown,
        "wine-soft": brandBrown,
        "warm-text": brandBrown,
        "warm-muted": brandBrown,
        "warm-border": brandBrown,
        white,
        black: "#0F172A",
        slate: colors.slate,
        gray: colors.gray,
        zinc: colors.zinc,
        neutral: colors.neutral,
        stone: colors.stone,
        emerald: colors.emerald,
        green: colors.green,
        teal: colors.teal,
        cyan: colors.cyan,
        blue: colors.blue,
        red: colors.red,
      },
      fontFamily: {
        display: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        soft: "0 18px 44px rgba(114, 47, 55, 0.12)",
        card: "0 12px 30px rgba(114, 47, 55, 0.09)",
        glow: "0 18px 45px rgba(114, 47, 55, 0.24)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
export default config;
