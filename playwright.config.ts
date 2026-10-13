import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    // Laporan mesin (JSON) untuk diolah tool lain, misalnya triage kegagalan.
    ["json", { outputFile: "test-results/results.json" }],
    // Kirim results.json ke Redline setelah test selesai. Harus setelah reporter "json".
    ["./reporters/redline.ts"],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Simpan trace hanya untuk test yang gagal (lokal maupun CI). See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
  },

  /* Satu project per API, masing-masing dengan testDir dan baseURL sendiri. */
  projects: [
    {
      name: "toolshop",
      testDir: "./tests/api/toolshop",
      use: {
        baseURL: "http://localhost:8091/",
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
