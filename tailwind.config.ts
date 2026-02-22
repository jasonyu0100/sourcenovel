import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Safelist classes used dynamically in reader settings
  safelist: [
    // Theme backgrounds
    "bg-stone-50",
    "bg-amber-50",
    "bg-[#0a0a0f]",
    // Theme text colors
    "text-stone-900",
    "text-stone-800",
    "text-stone-500",
    "text-amber-950",
    "text-amber-900",
    "text-amber-700",
    "text-slate-200",
    "text-slate-400",
    // Width classes
    "max-w-lg",
    "max-w-2xl",
    "max-w-3xl",
    // Font classes
    "font-serif",
    "font-sans",
    "font-mono",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Lora", "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["SF Mono", "Fira Code", "Monaco", "monospace"],
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
};

export default config;
