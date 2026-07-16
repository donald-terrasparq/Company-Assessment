import type { Config } from "tailwindcss";

/**
 * Design tokens extracted from design/company_assessment_app.html (the approved prototype)
 * and docs/04-UI-SPEC.md. The CSS variables are declared in app/globals.css so
 * both Tailwind utilities and plain CSS share one source of truth.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)" },
        steel: "var(--steel)",
        slate: "var(--slate)",
        muted: "var(--muted)",
        paper: "var(--paper)",
        card: "var(--card)",
        line: { DEFAULT: "var(--line)", 2: "var(--line-2)" },
        tier1: { DEFAULT: "var(--t1)", soft: "var(--t1-soft)" },
        tier2: "var(--t2)",
        tier3: "var(--t3)",
        fwa: { DEFAULT: "var(--fwa)", soft: "var(--fwa-soft)" },
        starlink: { DEFAULT: "var(--starlink)", soft: "var(--starlink-soft)" },
        mobility: { DEFAULT: "var(--mob)", soft: "var(--mob-soft)" },
        byod: { DEFAULT: "var(--byod)", soft: "var(--byod-soft)" },
        spark: { DEFAULT: "var(--spark)", soft: "var(--spark-soft)" },
      },
      fontFamily: {
        disp: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,45,.04), 0 4px 16px rgba(15,27,45,.06)",
        lg: "0 8px 40px rgba(15,27,45,.12)",
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        // the coral fresh-trigger pulse on the score-anatomy bar
        "spark-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(255,107,74,.5)" },
          "70%": { boxShadow: "0 0 0 7px rgba(255,107,74,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,107,74,0)" },
        },
      },
      animation: {
        "spark-pulse": "spark-pulse 1.8s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
