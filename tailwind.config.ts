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
        // Fluxy design system
        background: {
          DEFAULT: "#0F0F1A",
          secondary: "#1A1A2E",
          card: "#1E1E2E",
          hover: "#252535",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.15)",
        },
        primary: {
          DEFAULT: "#6C63FF",
          foreground: "#ffffff",
          muted: "rgba(108,99,255,0.15)",
          hover: "#7C73FF",
        },
        secondary: {
          DEFAULT: "#22D3EE",
          foreground: "#0F0F1A",
          muted: "rgba(34,211,238,0.12)",
        },
        success: {
          DEFAULT: "#10B981",
          muted: "rgba(16,185,129,0.12)",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#F59E0B",
          muted: "rgba(245,158,11,0.12)",
          foreground: "#0F0F1A",
        },
        danger: {
          DEFAULT: "#EF4444",
          muted: "rgba(239,68,68,0.12)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "rgba(255,255,255,0.06)",
          foreground: "rgba(255,255,255,0.45)",
        },
        text: {
          primary: "rgba(255,255,255,0.95)",
          secondary: "rgba(255,255,255,0.60)",
          muted: "rgba(255,255,255,0.35)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.35)",
        glow: "0 0 20px rgba(108,99,255,0.25)",
        "glow-success": "0 0 20px rgba(16,185,129,0.20)",
        "glow-danger": "0 0 20px rgba(239,68,68,0.20)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "count-up": "countUp 1s ease-out",
        shimmer: "shimmer 2s infinite linear",
        "pulse-subtle": "pulseSubtle 2s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
