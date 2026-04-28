import type { Config } from "tailwindcss";

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
        primary: "#059669",
        "primary-dark": "#047857",
        "primary-soft": "#d1fae5",
        "background-light": "#f6f8f6",
        "background-dark": "#0f172a",
        "surface-muted": "#eef3ef",
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
        soft: "0 16px 40px rgba(15, 23, 42, 0.08)",
        card: "0 10px 30px rgba(15, 23, 42, 0.06)",
        glow: "0 18px 45px rgba(5, 150, 105, 0.22)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
export default config;
