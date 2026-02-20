import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
      clientPort: 5173,
    },
  },
  resolve: {
    alias: [
      { find: "@components", replacement: path.resolve(__dirname, "./src/components") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
