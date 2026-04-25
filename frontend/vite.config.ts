import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@app": path.resolve(__dirname, "src/app"),
      "@features": path.resolve(__dirname, "src/features"),
      "@components": path.resolve(__dirname, "src/components"),
      "@services": path.resolve(__dirname, "src/services"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@apptypes": path.resolve(__dirname, "src/types"),
      "@theme": path.resolve(__dirname, "src/theme"),
      "@constants": path.resolve(__dirname, "src/constants"),
      "@docs": path.resolve(__dirname, "src/docs"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:8000",
        changeOrigin: true,
      },
      // Socket.IO (engine.io) handshake + WebSocket upgrade. The backend
      // mounts python-socketio at the root path ``/socket.io`` (alongside
      // FastAPI under ``/api``), so we forward the same path through with
      // ``ws: true`` so the upgrade survives the proxy hop.
      "/socket.io": {
        target: process.env.VITE_API_PROXY || "http://localhost:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
