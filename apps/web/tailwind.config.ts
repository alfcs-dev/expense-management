import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        // text
        fluidSm: ["clamp(0.875rem, 0.82rem + 0.2vw, 1rem)", { lineHeight: "1.5" }],
        fluidBase: ["clamp(1rem, 0.95rem + 0.25vw, 1.125rem)", { lineHeight: "1.6" }],
        fluidLg: ["clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem)", { lineHeight: "1.55" }],

        // headings
        fluidH2: ["clamp(1.375rem, 1.2rem + 0.9vw, 1.75rem)", { lineHeight: "1.2" }],
        fluidH1: ["clamp(1.75rem, 1.45rem + 1.6vw, 2.5rem)", { lineHeight: "1.1" }],
      },
    },
  },
  plugins: [],
};

export default config;
