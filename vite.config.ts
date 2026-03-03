import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Sem "client/" aqui — index.html na raiz (padrão Vite). Evita o erro do Vercel.
  server: { port: 5173 },
});
