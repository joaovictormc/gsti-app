import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build vai para ../public/admin (servido pelo server.js em /admin).
// Em desenvolvimento: `npm run dev` com o servidor rodando na porta 3030.
export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  build: { outDir: "../public/admin", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5174, proxy: { "/admin/api": `http://localhost:${process.env.PORT || 3030}` } },
});
