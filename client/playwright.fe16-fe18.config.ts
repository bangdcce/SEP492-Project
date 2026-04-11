import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const installedBrowserPath = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => fs.existsSync(candidate));

export default defineConfig({
  testDir: "./e2e/fe16-fe18",
  testMatch: "workflows.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "line",
  use: {
    baseURL: "https://localhost:4173",
    headless: true,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: installedBrowserPath
      ? {
          executablePath: installedBrowserPath,
        }
      : undefined,
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host localhost --port 4173",
    cwd: currentDir,
    env: {
      ...process.env,
      VITE_API_URL: "https://localhost:3000",
    },
    port: 4173,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
