import type { Config } from "tailwindcss";

const brandBrown = "#722F37";
const white = "#FFFFFF";

const warmScale = {
  50: white,
  100: white,
  200: brandBrown,
  300: brandBrown,
  400: brandBrown,
  500: brandBrown,
  600: brandBrown,
  700: brandBrown,
  800: brandBrown,
  900: brandBrown,
  950: brandBrown,
};

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
        black: brandBrown,
        slate: warmScale,
        gray: warmScale,
        zinc: warmScale,
        neutral: warmScale,
        stone: warmScale,
        emerald: warmScale,
        green: warmScale,
        teal: warmScale,
        cyan: warmScale,
        blue: warmScale,
        red: warmScale,
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
