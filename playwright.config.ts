import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  webServer: [
    {
      command: "npm run start -w @harborwatch/api",
      url: "http://localhost:5000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        PORT: "5000",
        DATABASE_URL: "memory://e2e",
        JWT_SECRET: "harborwatch-dev-jwt-change-me",
        INGEST_KEY: "harborwatch-ingest-dev",
      },
    },
    {
      command: "npm run dev -w @harborwatch/web",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
