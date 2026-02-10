import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),
  server: {
    port: 3000,
    proxy: {
      "/ws": {
        target: "ws://localhost:18800",
        ws: true,
      },
      "/api": {
        target: "http://localhost:18800",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
