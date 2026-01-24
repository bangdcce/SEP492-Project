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
  server: {
    https: httpsOptions,
    host: "localhost",
    port: 5173,
  },
});
