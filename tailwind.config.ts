import type { Config } from "tailwindcss";

// "Iron & Volt" light theme — tokens from DESIGN.md §2 / UI.md §3.1 (ADR-012).
// Volt (accent) is a fill only: never text, icons or thin lines on a light surface.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        surface: "#F3F3EF",
        "surface-2": "#E8E8E2",
        border: "#E2E2DC",
        "border-strong": "#7A7A72",
        foreground: "#0E0E0E",
        muted: "#5E5E58",
        accent: {
          DEFAULT: "#C6F432",
          foreground: "#0E0E0E",
          muted: "#B4E11F",
        },
        success: "#2E7D0F",
        warning: "#B45309",
        danger: "#C62828",
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      minHeight: {
        tap: "48px",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-in",
      },
    },
  },
  plugins: [],
};

export default config;
