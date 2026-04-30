import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

const certPath = path.resolve(__dirname, "../server/secrets/public-certificate.pem");
const keyPath = path.resolve(__dirname, "../server/secrets/private-key.pem");

const getHttpsOptions = () => {
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return undefined;
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
};

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const httpsOptions = command === "serve" ? getHttpsOptions() : undefined;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      ...(httpsOptions ? { https: httpsOptions } : {}),
      host: "localhost",
      port: 5173,
    },
  };
});
