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
        // Industrial Design System Colors
        amber: {
          DEFAULT: '#FF6B00',
          dark: '#CC5500',
        },
        paper: {
          DEFAULT: '#F5F2EA',
          dark: '#E8E4D8',
        },
      },
      fontFamily: {
        display: ['Space Mono', 'Courier New', 'monospace'],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
      borderWidth: {
        'tech': '2px',
      },
    },
  },
  plugins: [],
};
export default config;
