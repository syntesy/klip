import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-page":    "var(--color-bg-page)",
        "bg-surface": "var(--color-bg-surface)",
        "bg-subtle":  "var(--color-bg-subtle)",
        "bg-muted":   "var(--color-bg-muted)",
        "sidebar":    "var(--color-sidebar)",
        "blue":       "var(--color-blue)",
        "blue-bright":"var(--color-blue-bright)",
        "green":      "var(--color-green)",
        "amber":      "var(--color-amber)",
        "navy":       "var(--color-navy)",
        "slate-brand":"var(--color-slate)",
        "text-1":     "var(--color-text-1)",
        "text-2":     "var(--color-text-2)",
        "text-3":     "var(--color-text-3)",
        "border":     "var(--color-border)",
        "border-mid": "var(--color-border-mid)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "blue-sm": "0 1px 3px var(--color-blue-dim)",
      },
    },
  },
  plugins: [],
};

export default config;
