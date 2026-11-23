import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "example/",
  base: "./",
  build: {
    outDir: "../example-dist",
    emptyOutDir: true,
  },
});
