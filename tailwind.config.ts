import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark gym theme
        background: "#0B0F0C",
        surface: "#161C18",
        "surface-2": "#1E2620",
        border: "#2A3530",
        // Accent — lime/volt green
        accent: {
          DEFAULT: "#B5FF47",
          foreground: "#0B0F0C",
          muted: "#8CC93A",
        },
        // Semantic
        danger: "#FF4444",
        warning: "#F59E0B",
        success: "#B5FF47",
        // Text
        foreground: "#F0F4F1",
        muted: "#8A9E92",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
