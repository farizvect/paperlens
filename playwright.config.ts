import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3005",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- -p 3005",
    url: "http://localhost:3005",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
