import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors.js";

// Carto brand: a deep wine taken from the logo, paired with warm stone neutrals.
const brand = {
  50: "#FBF5F5",
  100: "#F6E7E8",
  200: "#EDCFD2",
  300: "#DEA9AF",
  400: "#C77982",
  500: "#A9505B",
  600: "#8D3B46",
  700: "#722F37",
  800: "#5E272E",
  900: "#4D2329",
  950: "#2B0F13",
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
        brand,
        primary: {
          DEFAULT: brand[700],
          hover: brand[800],
          soft: brand[50],
          muted: brand[100],
        },
        // Semantic surfaces and text, backed by CSS variables in globals.css.
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          muted: "rgb(var(--color-surface-muted) / <alpha-value>)",
          sunken: "rgb(var(--color-surface-sunken) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-ink-subtle) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--color-line) / <alpha-value>)",
          strong: "rgb(var(--color-line-strong) / <alpha-value>)",
        },
        slate: colors.slate,
        stone: colors.stone,
        emerald: colors.emerald,
        amber: colors.amber,
        red: colors.red,
        sky: colors.sky,
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        xs: "0 1px 2px rgb(28 25 23 / 0.05)",
        card: "0 1px 2px rgb(28 25 23 / 0.04), 0 4px 16px -6px rgb(28 25 23 / 0.08)",
        raised: "0 2px 4px rgb(28 25 23 / 0.04), 0 12px 28px -8px rgb(28 25 23 / 0.14)",
        overlay: "0 24px 64px -12px rgb(28 25 23 / 0.32)",
        brand: "0 8px 20px -8px rgb(114 47 55 / 0.55)",
        "nav-top": "0 -8px 24px -12px rgb(28 25 23 / 0.16)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-in": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scan-line": {
          "0%, 100%": { transform: "translateY(-120%)" },
          "50%": { transform: "translateY(120%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out both",
        "rise-in": "rise-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "sheet-in": "sheet-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "scan-line": "scan-line 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
export default config;
