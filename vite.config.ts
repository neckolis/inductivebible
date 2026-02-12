import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/bible": {
        target: "https://bolls.life",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/bible/, "/get-chapter"),
      },
    },
  },
});
