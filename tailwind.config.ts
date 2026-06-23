import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        neon: {
          green: '#00ff88',
          cyan:  '#00cfff',
          pink:  '#ff2d6b',
          gold:  '#ffd700',
          purple:'#b06aff',
        },
        game: {
          bg:      '#08080f',
          surface: '#0d0d1a',
          panel:   '#111128',
          border:  '#1e1e3a',
          muted:   '#3a3a5c',
        },
      },
    },
  },
  plugins: [],
};
export default config;
