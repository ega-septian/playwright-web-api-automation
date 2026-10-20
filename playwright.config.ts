import { defineConfig, type ReporterDescription } from "@playwright/test";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import path from "path";
import type { TargetOptions } from "./tests/api/toolshop/fixtures/target.fixture";
import { toolshop } from "./toolshop.target.mts";
dotenv.config({ path: path.resolve(__dirname, ".env") });

/* Live demo API by default; TOOLSHOP_TARGET=local for Docker (toolshop.target.mts). */
const { target, url } = toolshop();

/*
 * Satu token per `playwright test`: dipasang sebagai atribut launch ReportPortal (redline_run) dan dikirim
 * reporter Redline, supaya Redline bisa menemukan launch yang sama dan mengisi penyebab kegagalannya.
 */
process.env.REDLINE_RUN_TOKEN ??= randomUUID();

/*
 * ReportPortal: mati secara default supaya run debug tidak tercatat, nyalakan dengan REPORTPORTAL=1.
 * Butuh RP_API_KEY di .env (Profile → API Keys di ReportPortal). ID dari tag @TC- dikirim sebagai
 * testCaseId oleh fixture redline-playwright, supaya riwayat test di ReportPortal tidak putus saat judul diganti.
 */
const reportPortal: ReporterDescription[] =
  process.env.REPORTPORTAL === "1" && process.env.RP_API_KEY
    ? [
        [
          "@reportportal/agent-js-playwright",
          {
            apiKey: process.env.RP_API_KEY,
            endpoint: process.env.RP_ENDPOINT ?? "http://localhost:8585/api/v2",
            project: process.env.RP_PROJECT ?? "superadmin_personal",
            launch: process.env.RP_LAUNCH ?? "Toolshop API",
            description: "Playwright API tests for Toolshop (Practice Software Testing)",
            attributes: [
              { key: "app", value: "toolshop" },
              { key: "redline_run", value: process.env.REDLINE_RUN_TOKEN },
            ],
            includeTestSteps: true,
            // Test yang sengaja di-skip bukan masalah: jangan masuk "To Investigate".
            skippedIssue: false,
          },
        ],
      ]
    : [];

export default defineConfig<TargetOptions>({
  testDir: "./tests",
  /* Bukti per test (trace, error-context) dipisah dari laporan di test-results/. */
  outputDir: "test-results/artifacts",
  /* Setelah run, folder kosong (test yang lulus) dihapus: yang tersisa hanya test yang gagal. */
  globalTeardown: "./global-teardown.ts",
  /* Sebelum run: hasil Allure run sebelumnya dikosongkan. */
  globalSetup: "./global-setup.ts",
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
    // Hasil untuk Allure Report (npm run report:allure). Lihat allurerc.mjs.
    ["allure-playwright", { resultsDir: "test-results/allure-results" }],
    // Kirim results.json ke Redline setelah test selesai. Harus setelah reporter "json".
    ["redline-playwright/reporter"],
    ...reportPortal,
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
        baseURL: `${url}/`,
        toolshopTarget: target,
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
