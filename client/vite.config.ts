import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

const certPath = path.resolve(__dirname, "../server/secrets/public-certificate.pem");
const keyPath = path.resolve(__dirname, "../server/secrets/private-key.pem");
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@fullcalendar")) {
            return "calendar-vendor";
          }

          if (id.includes("@radix-ui")) {
            return "radix-vendor";
          }

          if (
            id.includes("@tiptap") ||
            id.includes("prosemirror")
          ) {
            return "tiptap-vendor";
          }

          if (id.includes("lowlight") || id.includes("highlight.js")) {
            return "syntax-vendor";
          }

          if (id.includes("@react-pdf")) {
            return "pdf-vendor";
          }

          if (
            id.includes("react-router") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "react-vendor";
          }

          if (id.includes("date-fns")) {
            return "date-vendor";
          }

          if (id.includes("lucide-react")) {
            return "icons-vendor";
          }

          if (id.includes("react-google-recaptcha")) {
            return "captcha-vendor";
          }

          if (id.includes("/axios/")) {
            return "http-vendor";
          }

          if (id.includes("sonner")) {
            return "notify-vendor";
          }

          if (id.includes("next-themes")) {
            return "theme-vendor";
          }

          if (
            id.includes("@tanstack/react-query") ||
            id.includes("@tanstack/react-table")
          ) {
            return "data-vendor";
          }

          if (id.includes("@supabase") || id.includes("socket.io-client")) {
            return "realtime-vendor";
          }

          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("/zod/")
          ) {
            return "forms-vendor";
          }

          if (id.includes("@hello-pangea/dnd")) {
            return "dnd-vendor";
          }

          if (id.includes("embla-carousel")) {
            return "carousel-vendor";
          }

          if (id.includes("recharts") || id.includes("framer-motion")) {
            return "visual-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    https: httpsOptions,
    host: "localhost",
    port: 5173,
  },
});
