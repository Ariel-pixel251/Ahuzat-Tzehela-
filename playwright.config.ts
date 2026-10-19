import { pathToFileURL } from "node:url";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "mobile-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      // a local database and a fixed calendar, so the tests don't depend on outside services
      PGLITE_DIR: ".data/e2e",
      GOOGLE_CALENDAR_ICS_URL: pathToFileURL(path.resolve("e2e/fixtures/calendar.ics")).href,
      DATABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      RESEND_API_KEY: "",
    },
  },
});
